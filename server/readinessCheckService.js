/**
 * readinessCheckService.js
 * Automates the OpenConnect go-live checklist.
 * Works against both SQLite demo DB and the connected external DB.
 */

import { getDb } from './db.js';
import * as dynamicDb from './dynamic-db.js';

// ─── Schema Init ─────────────────────────────────────────────────────────────

export function initReadinessSchema() {
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS readiness_check_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        config_name   TEXT,
        score         INTEGER,
        total_checks  INTEGER,
        passed_checks INTEGER,
        result_json   TEXT,
        checked_at    TEXT DEFAULT (datetime('now'))
      );
    `);
  } finally {
    db.close();
  }
}

// ─── Check Registry ──────────────────────────────────────────────────────────

const CHECKS = [
  // ws_config checks
  {
    id: 'WS_CONFIG_EXISTS',
    category: 'Core Config',
    severity: 'critical',
    title: 'ws_config record exists',
    description: 'At least one web service configuration must be present.',
  },
  {
    id: 'WS_CONFIG_HTTPS',
    category: 'Security',
    severity: 'warning',
    title: 'Service base URL uses HTTPS',
    description: 'Production services must use HTTPS for encrypted transport.',
    recommendation: 'Replace http:// with https:// in the base URL.',
  },
  {
    id: 'WS_CONFIG_SERVICE_NAME',
    category: 'Core Config',
    severity: 'critical',
    title: 'Service name is set',
    description: 'ws_config.service_name must not be empty.',
  },
  // ws_endpoint_config checks
  {
    id: 'ENDPOINT_EXISTS',
    category: 'Core Config',
    severity: 'critical',
    title: 'Endpoint configuration exists',
    description: 'At least one endpoint must be configured in ws_endpoint_config.',
  },
  {
    id: 'ENDPOINT_TEMPLATE',
    category: 'Core Config',
    severity: 'critical',
    title: 'Endpoint has a URL template',
    description: 'ws_endpoint_config.endpoint_template must be set.',
  },
  {
    id: 'ENDPOINT_DATA_TEMPLATE',
    category: 'Core Config',
    severity: 'high',
    title: 'Request data template configured',
    description: 'ws_endpoint_config.data_template must have a valid JSON template.',
  },
  {
    id: 'ENDPOINT_TIMEOUT_SANE',
    category: 'Performance',
    severity: 'warning',
    title: 'Connection/read timeouts are sane',
    description: 'connection_timeout should be ≤ 10 000 ms, read_timeout ≤ 60 000 ms.',
    recommendation: 'Adjust timeouts in Step 3 (Endpoint Config).',
  },
  {
    id: 'ENDPOINT_RESPONSE_CODE_PATH',
    category: 'Response Mapping',
    severity: 'critical',
    title: 'Response code path configured',
    description: 'The JSONPath to the external response code must be set (e.g. $.responseCode).',
  },
  {
    id: 'ENDPOINT_METHOD_SET',
    category: 'Core Config',
    severity: 'high',
    title: 'HTTP method is specified',
    description: 'ws_endpoint_config.method must not be empty.',
  },
  // ws_token_config checks
  {
    id: 'TOKEN_ENDPOINT_EXISTS',
    category: 'Authentication',
    severity: 'high',
    title: 'TOKEN endpoint exists',
    description: 'If your API requires OAuth2 / Bearer tokens, a TOKEN endpoint must be configured.',
  },
  {
    id: 'TOKEN_CONFIG_VALID',
    category: 'Authentication',
    severity: 'warning',
    title: 'Token config has required fields',
    description: 'token_url and client_id must be set in ws_token_config.',
  },
  // ws_response_definition checks
  {
    id: 'RESPONSE_DEFS_EXIST',
    category: 'Response Mapping',
    severity: 'critical',
    title: 'Response definitions exist',
    description: 'At least one response mapping must exist in ws_response_definition.',
  },
  {
    id: 'RESPONSE_WILDCARD_EXISTS',
    category: 'Response Mapping',
    severity: 'high',
    title: 'Wildcard (*) mapping exists',
    description: 'A catch-all (*) mapping ensures unknown codes are handled gracefully.',
    recommendation: 'Add a row with match_code = * in ws_response_definition.',
  },
  {
    id: 'RESPONSE_TIMEOUT_MAPPING',
    category: 'Response Mapping',
    severity: 'high',
    title: 'TIMEOUT mapping exists',
    description: 'A specific mapping for timeout scenarios prevents silent failures.',
    recommendation: 'Add a TIMEOUT or -1 code mapping in ws_response_definition.',
  },
  {
    id: 'RESPONSE_SUCCESS_MAPPING',
    category: 'Response Mapping',
    severity: 'critical',
    title: 'Success (000 / 00) mapping exists',
    description: 'The primary success code must be mapped.',
  },
  // tran_req_map checks
  {
    id: 'TRAN_REQ_MAP_EXISTS',
    category: 'Field Mapping',
    severity: 'critical',
    title: 'tran_req_map entries exist',
    description: 'Request field mappings are required for parameterised requests.',
  },
  {
    id: 'TRAN_REQ_MAP_MANDATORY',
    category: 'Field Mapping',
    severity: 'warning',
    title: 'Mandatory fields are marked',
    description: 'Critical fields should have is_mandatory = Y to ensure validation.',
    recommendation: 'Review tran_req_map and mark critical fields as mandatory.',
  },
  {
    id: 'TRAN_REQ_MAP_REGEX',
    category: 'Validation',
    severity: 'low',
    title: 'Regex validation configured for key fields',
    description: 'At least some fields should have regex patterns for format validation.',
    recommendation: 'Add regex patterns for account numbers, amounts, and identifiers.',
  },
  // ws_req_param_details checks
  {
    id: 'REQ_PARAMS_EXISTS',
    category: 'Routing',
    severity: 'critical',
    title: 'ws_req_param_details row exists',
    description: 'The routing record (tran_type, queue_in) must be configured.',
  },
  {
    id: 'REQ_PARAMS_TRAN_TYPE',
    category: 'Routing',
    severity: 'critical',
    title: 'tran_type is set',
    description: 'The transaction type identifier must not be empty.',
  },
  {
    id: 'REQ_PARAMS_QUEUE_IN',
    category: 'Routing',
    severity: 'high',
    title: 'queue_in is set',
    description: 'The input queue identifier is required for OC Core routing.',
  },
];

// ─── Run Check ───────────────────────────────────────────────────────────────

async function fetchAllData() {
  if (dynamicDb.isConnected()) {
    const { data } = await dynamicDb.getAllData();
    return data;
  }
  const db = getDb();
  try {
    return {
      ws_config:             db.prepare('SELECT * FROM ws_config ORDER BY id').all(),
      ws_token_config:       db.prepare('SELECT * FROM ws_token_config ORDER BY id').all(),
      ws_endpoint_config:    db.prepare('SELECT * FROM ws_endpoint_config ORDER BY id').all(),
      ws_response_definition: db.prepare('SELECT * FROM ws_response_definition ORDER BY id').all(),
      ws_req_param_details:  db.prepare('SELECT * FROM ws_req_param_details ORDER BY id').all(),
      tran_req_map:          db.prepare('SELECT * FROM tran_req_map ORDER BY param_priority').all(),
    };
  } finally {
    db.close();
  }
}

export async function runReadinessCheck(configName = 'Current Config') {
  const data = await fetchAllData();

  const {
    ws_config:             cfgs    = [],
    ws_token_config:       tokens  = [],
    ws_endpoint_config:    eps     = [],
    ws_response_definition: rdefs  = [],
    ws_req_param_details:  rparams = [],
    tran_req_map:          rmap    = [],
  } = data;

  const cfg  = cfgs[0]    || null;
  const ep   = eps[0]     || null;
  const tok  = tokens[0]  || null;

  // ── Run each check ────────────────────────────────────────────
  const results = CHECKS.map(check => {
    let passed = false;
    let detail = '';
    let value  = null;

    switch (check.id) {
      case 'WS_CONFIG_EXISTS':
        passed = cfgs.length > 0;
        detail = passed ? `${cfgs.length} config(s) found` : 'No ws_config records';
        break;

      case 'WS_CONFIG_HTTPS':
        value  = cfg?.base_url || '';
        passed = /^https:\/\//i.test(value);
        detail = passed
          ? 'Base URL uses HTTPS'
          : `Base URL is: ${(value || 'not set').substring(0, 80)}`;
        break;

      case 'WS_CONFIG_SERVICE_NAME':
        value  = cfg?.service_name || '';
        passed = !!value.trim();
        detail = passed ? `Service: ${value}` : 'service_name is empty';
        break;

      case 'ENDPOINT_EXISTS':
        passed = eps.length > 0;
        detail = passed ? `${eps.length} endpoint(s) found` : 'No ws_endpoint_config records';
        break;

      case 'ENDPOINT_TEMPLATE':
        value  = ep?.endpoint_template || '';
        passed = !!value.trim();
        detail = passed ? `Template: ${value.substring(0, 60)}` : 'endpoint_template is empty';
        break;

      case 'ENDPOINT_DATA_TEMPLATE':
        value = ep?.data_template || '';
        passed = !!value.trim();
        detail = passed ? 'data_template is configured' : 'data_template is empty';
        break;

      case 'ENDPOINT_TIMEOUT_SANE': {
        const conn = parseInt(ep?.connection_timeout) || 0;
        const read = parseInt(ep?.read_timeout) || 0;
        passed = conn > 0 && conn <= 10000 && read > 0 && read <= 60000;
        detail = `connection=${conn}ms, read=${read}ms`;
        break;
      }

      case 'ENDPOINT_RESPONSE_CODE_PATH':
        value  = ep?.response_code_path || '';
        passed = !!value.trim();
        detail = passed ? `Code path: ${value}` : 'response_code_path is not set';
        break;

      case 'ENDPOINT_METHOD_SET':
        value  = ep?.method || '';
        passed = !!value.trim();
        detail = passed ? `Method: ${value}` : 'HTTP method is not set';
        break;

      case 'TOKEN_ENDPOINT_EXISTS':
        passed = tokens.length > 0;
        detail = passed ? `${tokens.length} token config(s) found` : 'No token config — use only if API requires OAuth2/Bearer';
        // Not critical if no token is needed — mark as info
        if (!passed) { passed = true; detail += ' (OK if no auth needed)'; }
        break;

      case 'TOKEN_CONFIG_VALID':
        if (tokens.length === 0) { passed = true; detail = 'No token required'; break; }
        passed = !!(tok?.token_url || tok?.token_url_override) && !!tok?.client_id;
        detail = passed ? 'Token URL and client_id are set' : 'token_url or client_id is missing';
        break;

      case 'RESPONSE_DEFS_EXIST':
        passed = rdefs.length > 0;
        detail = passed ? `${rdefs.length} response definition(s)` : 'No response definitions';
        break;

      case 'RESPONSE_WILDCARD_EXISTS': {
        const wildcard = rdefs.find(r => r.match_code === '*' || r.ext_response_code === '*');
        passed = !!wildcard;
        detail = passed ? 'Wildcard (*) mapping found' : 'No wildcard mapping — unknown codes will not be handled';
        break;
      }

      case 'RESPONSE_TIMEOUT_MAPPING': {
        const timeoutRow = rdefs.find(r =>
          /timeout|-1|TO/i.test(r.match_code || '') ||
          /timeout|-1|TO/i.test(r.ext_response_code || '')
        );
        passed = !!timeoutRow;
        detail = passed ? 'Timeout mapping found' : 'No TIMEOUT/–1 mapping — timeouts will fall through to wildcard';
        break;
      }

      case 'RESPONSE_SUCCESS_MAPPING': {
        const successRow = rdefs.find(r =>
          r.match_code === '000' || r.match_code === '00' ||
          r.ext_response_code === '000' || r.ext_response_code === '00'
        );
        passed = !!successRow;
        detail = passed ? 'Success mapping found' : 'No success (000/00) mapping';
        break;
      }

      case 'TRAN_REQ_MAP_EXISTS':
        passed = rmap.length > 0;
        detail = passed ? `${rmap.length} field mapping(s)` : 'No tran_req_map entries';
        break;

      case 'TRAN_REQ_MAP_MANDATORY': {
        if (rmap.length === 0) { passed = true; detail = 'No fields to check'; break; }
        const mandCount = rmap.filter(r => r.is_mandatory === 'Y').length;
        passed = mandCount > 0;
        detail = passed ? `${mandCount}/${rmap.length} fields marked mandatory` : 'No fields marked mandatory';
        break;
      }

      case 'TRAN_REQ_MAP_REGEX': {
        if (rmap.length === 0) { passed = true; detail = 'No fields to check'; break; }
        const regexCount = rmap.filter(r => r.regex && r.regex.trim()).length;
        passed = regexCount > 0;
        detail = passed ? `${regexCount}/${rmap.length} fields have regex validation` : 'No regex patterns defined';
        break;
      }

      case 'REQ_PARAMS_EXISTS':
        passed = rparams.length > 0;
        detail = passed ? `${rparams.length} routing config(s)` : 'No ws_req_param_details records';
        break;

      case 'REQ_PARAMS_TRAN_TYPE': {
        const first = rparams[0];
        value  = first?.tran_type || '';
        passed = !!value.trim();
        detail = passed ? `tran_type: ${value}` : 'tran_type is empty';
        break;
      }

      case 'REQ_PARAMS_QUEUE_IN': {
        const first = rparams[0];
        value  = first?.queue_in || '';
        passed = !!value.trim();
        detail = passed ? `queue_in: ${value}` : 'queue_in is empty';
        break;
      }

      default:
        passed = false;
        detail = 'Unknown check';
    }

    return {
      ...check,
      passed,
      detail,
      value,
    };
  });

  // ── Score ─────────────────────────────────────────────────────
  const weights = { critical: 10, high: 6, warning: 3, low: 1 };
  const totalWeight  = CHECKS.reduce((sum, c) => sum + (weights[c.severity] || 1), 0);
  const earnedWeight = results.reduce((sum, r) => r.passed ? sum + (weights[r.severity] || 1) : sum, 0);
  const score        = Math.round((earnedWeight / totalWeight) * 100);

  const passedChecks = results.filter(r => r.passed).length;
  const failedChecks = results.filter(r => !r.passed);

  // Group by category
  const byCategory = {};
  results.forEach(r => {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  });

  // ── Save to history ───────────────────────────────────────────
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO readiness_check_history (config_name, score, total_checks, passed_checks, result_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(configName, score, CHECKS.length, passedChecks, JSON.stringify(results));
    db.close();
  } catch { /* non-fatal */ }

  return {
    success: true,
    score,
    passedChecks,
    totalChecks: CHECKS.length,
    failedChecks: failedChecks.length,
    readiness: score >= 90 ? 'production-ready' : score >= 70 ? 'nearly-ready' : score >= 50 ? 'needs-work' : 'not-ready',
    results,
    byCategory,
    criticalFailures: failedChecks.filter(r => r.severity === 'critical'),
    highFailures:     failedChecks.filter(r => r.severity === 'high'),
    warnings:         failedChecks.filter(r => r.severity === 'warning' || r.severity === 'low'),
    checkedAt: new Date().toISOString(),
  };
}

export function getReadinessHistory(limit = 20) {
  const db = getDb();
  try {
    return db.prepare('SELECT id, config_name, score, total_checks, passed_checks, checked_at FROM readiness_check_history ORDER BY checked_at DESC LIMIT ?').all(Math.min(limit, 100));
  } finally {
    db.close();
  }
}
