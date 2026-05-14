/**
 * OpenConnect API Layer
 * 
 * Reads endpoint configurations from the DB and proxies requests
 * to the configured external API (e.g. Mockoon title-fetch).
 * 
 * Usage:
 *   import { createApiLayerRoutes } from './api-layer.js';
 *   createApiLayerRoutes(app);
 */

import { getDb } from './db.js';
import * as dynamicDb from './dynamic-db.js';

// ─── JSON Path resolver (simple $.dot.path support) ──
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

// ─── Flatten nested object to dot-notation entries ──
function flattenParams(obj, prefix = '') {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenParams(val, fullKey));
    } else {
      result[fullKey] = val;
      result[key] = val; // also store by leaf key alone
    }
  }
  return result;
}

// ─── camelCase → UPPER_SNAKE_CASE ────────────────
function toSnake(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\./g, '_')
    .toUpperCase();
}

// ─── Build request body from template + params ──
function buildRequestBody(dataTemplate, params) {
  if (!dataTemplate) return params;
  let body = dataTemplate;

  // Flatten nested params so data.bankCode → both "data.bankCode" and "bankCode"
  const flat = flattenParams(params);

  // Add known aliases for common fields
  const aliases = {
    TXN_DATETIME: flat['transactionDateTime'] ?? flat['txnDatetime'] ?? flat['txnDateTime'],
    CHANNEL_ID:   flat['channelId'],
    REQUEST_ID:   flat['requestId'],
    TRACE_ID:     flat['traceId'],
    BANK_CODE:    flat['bankCode'],
    ACCOUNT_NUMBER: flat['accountNumber'],
    IBAN:         flat['iban'],
    RRN:          flat['rrn'],
    STAN:         flat['stan'],
  };

  // Apply aliases first (both {{ALIAS}} and {ALIAS} forms)
  for (const [placeholder, val] of Object.entries(aliases)) {
    if (val !== undefined) {
      body = body.replaceAll(`{{${placeholder}}}`, val ?? '');
      body = body.replaceAll(`{${placeholder}}`, val ?? '');
    }
  }

  // Then replace all flattened params in snake/upper/camel variants
  for (const [key, val] of Object.entries(flat)) {
    const safeVal = val ?? '';
    body = body.replaceAll(`{{${key.toUpperCase()}}}`, safeVal);
    body = body.replaceAll(`{{${toSnake(key)}}}`, safeVal);
    body = body.replaceAll(`{{${key}}}`, safeVal);
    body = body.replaceAll(`{${key.toUpperCase()}}`, safeVal);
    body = body.replaceAll(`{${toSnake(key)}}`, safeVal);
    body = body.replaceAll(`{${key}}`, safeVal);
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

// ─── Load config from DB ─────────────────────────
async function loadEndpointConfig(configId) {
  if (dynamicDb.isConnected()) {
    return loadEndpointConfigDynamic(configId);
  }
  return loadEndpointConfigSqlite(configId);
}

function loadEndpointConfigSqlite(configId) {
  const db = getDb();
  try {
    const wsConfig = db.prepare('SELECT * FROM ws_config WHERE id = ?').get(configId);
    if (!wsConfig) return null;

    const endpoint = db.prepare('SELECT * FROM ws_endpoint_config WHERE config_id = ?').get(configId);
    const responses = db.prepare('SELECT * FROM ws_response_definition WHERE config_id = ?').all(configId);
    const reqParams = db.prepare(
      'SELECT * FROM ws_req_param_details WHERE host_id = ?'
    ).get(wsConfig.id);
    const fieldMappings = reqParams
      ? db.prepare('SELECT * FROM tran_req_map WHERE tran_id = ?').all(reqParams.tran_id)
      : [];

    return { wsConfig, endpoint, responses, reqParams, fieldMappings };
  } finally {
    db.close();
  }
}

async function loadEndpointConfigDynamic(configId) {
  const configs = await dynamicDb.queryRows(`SELECT * FROM ws_config WHERE id = ${Number(configId)}`);
  const wsConfig = configs[0];
  if (!wsConfig) return null;

  const endpoints = await dynamicDb.queryRows(`SELECT * FROM ws_endpoint_config WHERE config_id = ${Number(configId)}`);
  const endpoint = endpoints[0] || null;
  const responses = await dynamicDb.queryRows(`SELECT * FROM ws_response_definition WHERE config_id = ${Number(configId)}`);
  const reqParamsAll = await dynamicDb.queryRows(`SELECT * FROM ws_req_param_details WHERE host_id = ${Number(wsConfig.id)}`);
  const reqParams = reqParamsAll[0] || null;
  const fieldMappings = reqParams
    ? await dynamicDb.queryRows(`SELECT * FROM tran_req_map WHERE tran_id = ${Number(reqParams.tran_id)}`)
    : [];

  return { wsConfig, endpoint, responses, reqParams, fieldMappings };
}

// ─── Map response code ───────────────────────────
function mapResponseCode(rawCode, responseDefs) {
  if (!responseDefs || !responseDefs.length) return { ourCode: rawCode, ourDescription: 'Unmapped' };

  // Exact match first
  const exact = responseDefs.find(r => r.match_code === String(rawCode));
  if (exact) return { ourCode: exact.our_code, ourDescription: exact.our_description };

  // Wildcard fallback
  const wildcard = responseDefs.find(r => r.match_code === '*');
  if (wildcard) return { ourCode: wildcard.our_code, ourDescription: wildcard.our_description };

  return { ourCode: rawCode, ourDescription: 'Unmapped response code' };
}

// ─── Extract response fields ─────────────────────
function extractResponseFields(body, includePaths) {
  if (!includePaths) return {};
  const paths = includePaths.split(',').map(p => p.trim()).filter(Boolean);
  const extracted = {};
  for (const path of paths) {
    const key = path.replace('$.', '').replace(/\./g, '_');
    extracted[key] = resolveJsonPath(body, path);
  }
  return extracted;
}

// ─── Register routes ─────────────────────────────
export function createApiLayerRoutes(app) {

  /**
   * GET /api/layer/configs
   * List all available endpoint configs that can be invoked
   */
  app.get('/api/layer/configs', async (req, res) => {
    try {
      if (dynamicDb.isConnected()) {
        // MSSQL schema has no service_name column
        const isMssql = dynamicDb.getType() === 'mssql';
        const serviceCol = isMssql ? "''" : 'wc.service_name';
        const configs = await dynamicDb.queryRows(`
          SELECT wc.id, wc.base_url, wc.type, ${serviceCol} AS service_name,
                 we.method, we.endpoint_template, we.type as endpoint_type
          FROM ws_config wc
          LEFT JOIN ws_endpoint_config we ON we.config_id = wc.id
        `);
        return res.json({ success: true, configs });
      }

      const db = getDb();
      try {
        const configs = db.prepare(`
          SELECT wc.id, wc.base_url, wc.type, wc.service_name,
                 we.method, we.endpoint_template, we.type as endpoint_type
          FROM ws_config wc
          LEFT JOIN ws_endpoint_config we ON we.config_id = wc.id
        `).all();
        res.json({ success: true, configs });
      } finally {
        db.close();
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/layer/invoke/:configId
   * Invoke the external API using a stored configuration.
   * 
   * Body: the actual request parameters (e.g. bankCode, rrn, etc.)
   * The layer will:
   *   1. Load the endpoint config from DB
   *   2. Build the request from the template + provided params
   *   3. Call the external API
   *   4. Map the response code using ws_response_definition
   *   5. Extract configured response fields
   *   6. Return the full result
   */
  app.post('/api/layer/invoke/:configId', async (req, res) => {
    const configId = parseInt(req.params.configId, 10);
    if (!Number.isFinite(configId)) {
      return res.status(400).json({ success: false, error: 'Invalid configId' });
    }

    const config = await loadEndpointConfig(configId);
    if (!config || !config.wsConfig || !config.endpoint) {
      return res.status(404).json({ success: false, error: `No endpoint configuration found for config_id=${configId}` });
    }

    const { wsConfig, endpoint, responses } = config;
    const fullUrl = `${wsConfig.base_url}${endpoint.endpoint_template}`;

    // Parse stored headers
    let headers = { 'Content-Type': 'application/json' };
    try {
      if (endpoint.request_headers) {
        headers = { ...headers, ...JSON.parse(endpoint.request_headers) };
      }
    } catch { /* keep defaults */ }

    // Build request body from template
    const requestBody = buildRequestBody(endpoint.data_template, req.body);

    // Call external API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), endpoint.read_timeout || 30000);

    try {
      const startTime = Date.now();
      const externalResp = await fetch(fullUrl, {
        method: endpoint.method || 'POST',
        headers,
        body: endpoint.method !== 'GET' ? JSON.stringify(requestBody) : undefined,
        signal: controller.signal,
      });
      const elapsed = Date.now() - startTime;
      clearTimeout(timeout);

      const responseBody = await externalResp.json();

      // Extract response code from configured path
      const rawCode = resolveJsonPath(responseBody, endpoint.response_code_path) ?? externalResp.status;

      // Map it
      const mapped = mapResponseCode(String(rawCode), responses);

      // Extract configured response fields (flat keys like accountTitle, availableBalance)
      const extractedFields = extractResponseFields(responseBody, endpoint.response_include_paths);

      // Flatten extracted fields to top-level (strip "data_" prefix for cleaner output)
      const flatFields = {};
      for (const [k, v] of Object.entries(extractedFields)) {
        const cleanKey = k.replace(/^data_/, '');
        flatFields[cleanKey] = v;
      }

      res.json({
        success: true,
        mappedCode: mapped.ourCode,
        mappedDescription: mapped.ourDescription,
        rawResponseCode: String(rawCode),
        elapsed_ms: elapsed,
        ...flatFields,
        invocation: {
          configId,
          service: wsConfig.service_name || wsConfig.type,
          url: fullUrl,
          method: endpoint.method,
          requestBody,
        },
        rawResponse: responseBody,
      });
    } catch (err) {
      clearTimeout(timeout);

      if (err.name === 'AbortError') {
        const mapped = mapResponseCode('TIMEOUT', responses);
        return res.status(504).json({
          success: false,
          error: 'Request timed out',
          mappedCode: mapped.ourCode,
          mappedDescription: mapped.ourDescription,
          url: fullUrl,
          timeout_ms: endpoint.read_timeout || 30000,
        });
      }

      res.status(502).json({
        success: false,
        error: `Failed to reach external API: ${err.message}`,
        url: fullUrl,
      });
    }
  });

  /**
   * GET /api/layer/test/:configId
   * Quick test with empty/default body — useful for health checking the external API
   */
  app.get('/api/layer/test/:configId', async (req, res) => {
    const configId = parseInt(req.params.configId, 10);
    if (!Number.isFinite(configId)) {
      return res.status(400).json({ success: false, error: 'Invalid configId' });
    }

    const config = await loadEndpointConfig(configId);
    if (!config || !config.wsConfig || !config.endpoint) {
      return res.status(404).json({ success: false, error: `No config found for id=${configId}` });
    }

    const { wsConfig, endpoint } = config;
    const fullUrl = `${wsConfig.base_url}${endpoint.endpoint_template}`;

    try {
      const startTime = Date.now();
      const resp = await fetch(fullUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      const elapsed = Date.now() - startTime;

      res.json({
        success: true,
        service: wsConfig.service_name,
        url: fullUrl,
        reachable: true,
        httpStatus: resp.status,
        elapsed_ms: elapsed,
      });
    } catch (err) {
      res.json({
        success: false,
        service: wsConfig.service_name,
        url: fullUrl,
        reachable: false,
        error: err.message,
      });
    }
  });
}
