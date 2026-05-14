/**
 * Validation Service
 * Core engine for the API Validation Dashboard.
 * Re-uses shared helpers from api-layer, adds stage tracking and history persistence.
 */

import { getDb } from './db.js';
import * as dynamicDb from './dynamic-db.js';
import { createTracker } from './performanceTracker.js';
import { maskSensitiveFields, maskHeaders } from './securityMaskingService.js';

// ─── Error classification codes ───
export const ErrorCodes = {
  CONFIG_NOT_FOUND:         'CONFIG_NOT_FOUND',
  INVALID_TEMPLATE:         'INVALID_TEMPLATE',
  MISSING_PARAMS:           'MISSING_PARAMS',
  AUTH_FAILURE:             'AUTH_FAILURE',
  TOKEN_FAILURE:            'TOKEN_FAILURE',
  API_TIMEOUT:              'API_TIMEOUT',
  API_UNREACHABLE:          'API_UNREACHABLE',
  INVALID_RESPONSE:         'INVALID_RESPONSE',
  RESPONSE_PATH_FAILURE:    'RESPONSE_PATH_FAILURE',
  MAPPING_FAILURE:          'MAPPING_FAILURE',
  FIELD_EXTRACTION_FAILURE: 'FIELD_EXTRACTION_FAILURE',
};

// ─── Shared helpers (duplicated from api-layer to keep module boundaries clean) ───

function resolveJsonPath(obj, path) {
  if (!path || !path.startsWith('$.')) return undefined;
  const keys = path.substring(2).split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}

function flattenParams(obj, prefix = '') {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenParams(val, fullKey));
    } else {
      result[fullKey] = val;
      result[key] = val;
    }
  }
  return result;
}

function toSnake(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/\./g, '_').toUpperCase();
}

function buildRequestBody(dataTemplate, params) {
  if (!dataTemplate) return params;
  let body = dataTemplate;
  const flat = flattenParams(params);
  const aliases = {
    TXN_DATETIME: flat['transactionDateTime'] ?? flat['txnDatetime'] ?? flat['txnDateTime'],
    CHANNEL_ID: flat['channelId'], REQUEST_ID: flat['requestId'], TRACE_ID: flat['traceId'],
    BANK_CODE: flat['bankCode'], ACCOUNT_NUMBER: flat['accountNumber'], IBAN: flat['iban'],
    RRN: flat['rrn'], STAN: flat['stan'],
  };
  for (const [ph, val] of Object.entries(aliases)) {
    if (val !== undefined) {
      body = body.replaceAll(`{{${ph}}}`, val ?? '');
      body = body.replaceAll(`{${ph}}`, val ?? '');
    }
  }
  for (const [key, val] of Object.entries(flat)) {
    const sv = val ?? '';
    body = body.replaceAll(`{{${key.toUpperCase()}}}`, sv);
    body = body.replaceAll(`{{${toSnake(key)}}}`, sv);
    body = body.replaceAll(`{{${key}}}`, sv);
    body = body.replaceAll(`{${key.toUpperCase()}}`, sv);
    body = body.replaceAll(`{${toSnake(key)}}`, sv);
    body = body.replaceAll(`{${key}}`, sv);
  }
  try { return JSON.parse(body); } catch { return body; }
}

function mapResponseCode(rawCode, responseDefs) {
  if (!responseDefs || !responseDefs.length) return { ourCode: rawCode, ourDescription: 'Unmapped' };
  const exact = responseDefs.find(r => r.match_code === String(rawCode));
  if (exact) return { ourCode: exact.our_code, ourDescription: exact.our_description };
  const wildcard = responseDefs.find(r => r.match_code === '*');
  if (wildcard) return { ourCode: wildcard.our_code, ourDescription: wildcard.our_description };
  return { ourCode: rawCode, ourDescription: 'Unmapped response code' };
}

function extractResponseFields(body, includePaths) {
  if (!includePaths) return {};
  const paths = includePaths.split(',').map(p => p.trim()).filter(Boolean);
  const extracted = {};
  for (const p of paths) {
    const key = p.replace('$.', '').replace(/\./g, '_');
    extracted[key] = resolveJsonPath(body, p);
  }
  return extracted;
}

// ─── Config loader ───

async function loadEndpointConfig(configId) {
  if (dynamicDb.isConnected()) {
    const configs = await dynamicDb.queryRows(`SELECT * FROM ws_config WHERE id = ${Number(configId)}`);
    const wsConfig = configs[0];
    if (!wsConfig) return null;
    const endpoints = await dynamicDb.queryRows(`SELECT * FROM ws_endpoint_config WHERE config_id = ${Number(configId)}`);
    const endpoint = endpoints[0] || null;
    const responses = await dynamicDb.queryRows(`SELECT * FROM ws_response_definition WHERE config_id = ${Number(configId)}`);
    const rp = await dynamicDb.queryRows(`SELECT * FROM ws_req_param_details WHERE host_id = ${Number(wsConfig.id)}`);
    const reqParams = rp[0] || null;
    const fieldMappings = reqParams
      ? await dynamicDb.queryRows(`SELECT * FROM tran_req_map WHERE tran_id = ${Number(reqParams.tran_id)}`)
      : [];
    return { wsConfig, endpoint, responses, reqParams, fieldMappings };
  }
  const db = getDb();
  try {
    const wsConfig = db.prepare('SELECT * FROM ws_config WHERE id = ?').get(configId);
    if (!wsConfig) return null;
    const endpoint = db.prepare('SELECT * FROM ws_endpoint_config WHERE config_id = ?').get(configId);
    const responses = db.prepare('SELECT * FROM ws_response_definition WHERE config_id = ?').all(configId);
    const reqParams = db.prepare('SELECT * FROM ws_req_param_details WHERE host_id = ?').get(wsConfig.id);
    const fieldMappings = reqParams
      ? db.prepare('SELECT * FROM tran_req_map WHERE tran_id = ?').all(reqParams.tran_id)
      : [];
    return { wsConfig, endpoint, responses, reqParams, fieldMappings };
  } finally { db.close(); }
}

// ─── Detect unreplaced placeholders ───

function findUnreplacedPlaceholders(body) {
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  const matches = str.match(/\{\{?\w+\}?\}/g) || [];
  return [...new Set(matches)];
}

// ─── Main Validation Engine ───

export async function runValidation(configId, params, environment = 'mock') {
  const tracker = createTracker();
  const stages = [];
  let errorCode = null;
  let errorMessage = null;

  // Stage 1: Load Config
  tracker.start('configLoad');
  let config;
  try {
    config = await loadEndpointConfig(configId);
    if (!config || !config.wsConfig || !config.endpoint) {
      tracker.fail('configLoad', 'Configuration not found');
      return buildResult({ tracker, errorCode: ErrorCodes.CONFIG_NOT_FOUND, errorMessage: `No config for id=${configId}`, environment, configId });
    }
    tracker.pass('configLoad', `${config.wsConfig.service_name || config.wsConfig.type}`);
  } catch (err) {
    tracker.fail('configLoad', err.message);
    return buildResult({ tracker, errorCode: ErrorCodes.CONFIG_NOT_FOUND, errorMessage: err.message, environment, configId });
  }

  const { wsConfig, endpoint, responses } = config;

  // Resolve environment-based URL
  let baseUrl = wsConfig.base_url;
  if (environment === 'uat' && wsConfig.uat_url) baseUrl = wsConfig.uat_url;
  else if (environment === 'production' && wsConfig.prod_url) baseUrl = wsConfig.prod_url;
  const fullUrl = `${baseUrl}${endpoint.endpoint_template}`;

  // Stage 2: Build Template
  tracker.start('templateBuild');
  let requestBody;
  try {
    requestBody = buildRequestBody(endpoint.data_template, params);
    const unreplaced = findUnreplacedPlaceholders(requestBody);
    if (unreplaced.length > 0) {
      tracker.pass('templateBuild', `Warning: unreplaced placeholders: ${unreplaced.join(', ')}`);
    } else {
      tracker.pass('templateBuild', 'All placeholders resolved');
    }
  } catch (err) {
    tracker.fail('templateBuild', err.message);
    return buildResult({ tracker, errorCode: ErrorCodes.INVALID_TEMPLATE, errorMessage: err.message, environment, configId, config });
  }

  // Stage 3: Apply Auth
  tracker.start('authApply');
  let headers = { 'Content-Type': 'application/json' };
  let authType = 'none';
  let authStatus = 'skipped';
  try {
    if (endpoint.request_headers) {
      headers = { ...headers, ...JSON.parse(endpoint.request_headers) };
    }
    // Check if token config exists
    if (endpoint.token_configuration_id) {
      authType = 'OAuth2';
      authStatus = 'configured';
    }
    tracker.pass('authApply', authType === 'none' ? 'No auth required' : `${authType} headers applied`);
  } catch (err) {
    tracker.fail('authApply', err.message);
    authStatus = 'error';
  }

  // Stage 4: Call External API
  tracker.start('externalCall');
  let externalResp, responseBody, httpStatus;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), endpoint.read_timeout || 30000);
  try {
    externalResp = await fetch(fullUrl, {
      method: endpoint.method || 'POST',
      headers,
      body: endpoint.method !== 'GET' ? JSON.stringify(requestBody) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    httpStatus = externalResp.status;
    tracker.pass('externalCall', `HTTP ${httpStatus}`);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      tracker.fail('externalCall', 'Request timed out');
      return buildResult({
        tracker, errorCode: ErrorCodes.API_TIMEOUT,
        errorMessage: `Timeout after ${endpoint.read_timeout || 30000}ms`,
        environment, configId, config, fullUrl, requestBody, headers, authType, authStatus,
      });
    }
    tracker.fail('externalCall', err.message);
    return buildResult({
      tracker, errorCode: ErrorCodes.API_UNREACHABLE,
      errorMessage: err.message,
      environment, configId, config, fullUrl, requestBody, headers, authType, authStatus,
    });
  }

  // Stage 5: Parse Response
  tracker.start('responseReceive');
  try {
    responseBody = await externalResp.json();
    tracker.pass('responseReceive', `${JSON.stringify(responseBody).length} bytes`);
  } catch (err) {
    tracker.fail('responseReceive', 'Invalid JSON response');
    return buildResult({
      tracker, errorCode: ErrorCodes.INVALID_RESPONSE,
      errorMessage: 'Response is not valid JSON',
      environment, configId, config, fullUrl, requestBody, headers, authType, authStatus, httpStatus,
    });
  }

  // Stage 6: Map Response Code
  tracker.start('codeMapping');
  let rawCode, mapped;
  try {
    rawCode = resolveJsonPath(responseBody, endpoint.response_code_path);
    if (rawCode === undefined) {
      tracker.fail('codeMapping', `Path "${endpoint.response_code_path}" returned undefined`);
      rawCode = String(httpStatus);
      mapped = { ourCode: rawCode, ourDescription: 'Path extraction failed — using HTTP status' };
      errorCode = ErrorCodes.RESPONSE_PATH_FAILURE;
      errorMessage = `Response code path "${endpoint.response_code_path}" not found in response`;
    } else {
      mapped = mapResponseCode(String(rawCode), responses);
      tracker.pass('codeMapping', `${rawCode} → ${mapped.ourCode} (${mapped.ourDescription})`);
    }
  } catch (err) {
    tracker.fail('codeMapping', err.message);
    rawCode = httpStatus;
    mapped = { ourCode: String(rawCode), ourDescription: 'Mapping error' };
    errorCode = ErrorCodes.MAPPING_FAILURE;
    errorMessage = err.message;
  }

  // Stage 7: Extract Fields
  tracker.start('fieldExtraction');
  let extractedFields = {};
  let missingFields = [];
  try {
    extractedFields = extractResponseFields(responseBody, endpoint.response_include_paths);
    // Flatten data_ prefix
    const flat = {};
    for (const [k, v] of Object.entries(extractedFields)) {
      const cleanKey = k.replace(/^data_/, '');
      flat[cleanKey] = v;
      if (v === undefined || v === null) missingFields.push(k);
    }
    extractedFields = flat;
    if (missingFields.length > 0) {
      tracker.pass('fieldExtraction', `${Object.keys(flat).length} fields, ${missingFields.length} missing`);
    } else {
      tracker.pass('fieldExtraction', `${Object.keys(flat).length} fields extracted`);
    }
  } catch (err) {
    tracker.fail('fieldExtraction', err.message);
    if (!errorCode) {
      errorCode = ErrorCodes.FIELD_EXTRACTION_FAILURE;
      errorMessage = err.message;
    }
  }

  return buildResult({
    tracker,
    errorCode,
    errorMessage,
    environment,
    configId,
    config,
    fullUrl,
    requestBody,
    headers,
    authType,
    authStatus,
    httpStatus,
    rawCode: String(rawCode ?? httpStatus),
    mapped,
    extractedFields,
    missingFields,
    responseBody,
  });
}

// ─── Build normalized result ───

function buildResult(opts) {
  const {
    tracker, errorCode, errorMessage, environment, configId,
    config, fullUrl, requestBody, headers, authType, authStatus,
    httpStatus, rawCode, mapped, extractedFields, missingFields, responseBody,
  } = opts;

  const success = !errorCode || errorCode === ErrorCodes.RESPONSE_PATH_FAILURE || errorCode === ErrorCodes.FIELD_EXTRACTION_FAILURE;

  return {
    success,
    configId,
    environment,
    targetUrl: fullUrl || null,
    method: config?.endpoint?.method || null,
    requestHeaders: maskHeaders(headers || {}),
    requestPayload: maskSensitiveFields(requestBody || null),
    authType: authType || 'none',
    authStatus: authStatus || 'skipped',
    rawResponse: maskSensitiveFields(responseBody || null),
    httpStatus: httpStatus || null,
    externalCode: rawCode || null,
    mappedCode: mapped?.ourCode || null,
    mappedDescription: mapped?.ourDescription || null,
    extractedFields: extractedFields || {},
    missingFields: missingFields || [],
    errorCode,
    errorMessage,
    stages: tracker.getStages(),
    timing: {
      db_load_ms: tracker.get('configLoad'),
      auth_ms: tracker.get('authApply'),
      external_api_ms: tracker.get('externalCall'),
      response_parse_ms: tracker.get('responseReceive'),
      mapping_ms: tracker.get('codeMapping'),
      extraction_ms: tracker.get('fieldExtraction'),
      total_ms: tracker.total(),
    },
  };
}
