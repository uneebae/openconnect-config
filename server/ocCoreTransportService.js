/**
 * OC Core Transport Service
 *
 * Node.js port of com.paysyslabs.cas.util.OpenConnectUtils (Java).
 *
 * Implements the CAS → OpenConnect Core wire protocol:
 *   GET  → endPoint + URLEncode(params_csv) + "/" + SHA256(encoded_csv + ",secret")
 *   POST → endPoint + SHA256(encoded_csv + ",secret")
 *          body = comma-separated individually-encoded params
 *
 * Response envelope from OC Core is always:
 *   { "response": { "response_code": "00", "response_desc": "...", ...tran_data } }
 *
 * Error code handling mirrors OpenConnectUtils.postAndParse / getAndParse:
 *   "00"              → success
 *   null / timeout    → code "501" — Request Timeout
 *   "503"             → Unable to Process
 *   "400"             → dig into response[tranType] for statusCode / description
 *   timeout codes     → (optional) trigger inquiry / pacs028 flow
 *   other non-"00"    → failure
 */

import crypto from 'crypto';

// ─── Secret ───────────────────────────────────────────────────────
// Override via OC_CORE_SECRET env var in production
const OC_CORE_SECRET = process.env.OC_CORE_SECRET || 'paysys@123';

if (!process.env.OC_CORE_SECRET) {
  // Warn once at startup — never in test environments
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[ocCoreTransport] OC_CORE_SECRET not set — using insecure default. Set env var for production.');
  }
}

// ─── Default timeout codes (matches Java: ${timeout.response-code}) ───
const DEFAULT_TIMEOUT_CODES = ['501', '504', 'TIMEOUT'];

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * URL-encode a single param value.
 * Matches Java: URLParamEncoder.encode(value)
 */
function encodeParam(val) {
  return encodeURIComponent(String(val === null || val === undefined ? 'null' : val));
}

/**
 * Replace null/undefined entries in the params array with the string "null".
 * Matches Java: validateParams(params)
 */
function normaliseParams(params) {
  return params.map(p => (p === null || p === undefined ? 'null' : String(p)));
}

/**
 * SHA-256 hex digest.
 * Matches Java: DigestUtils.sha256Hex(input)
 */
function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// ─── URL Builders ─────────────────────────────────────────────────

/**
 * Build a signed GET URL.
 *
 * Java equivalent:
 *   prepareQueryStringWithSignature → endPoint + encodedCSV + "/" + sha256sig
 *
 * Steps:
 *   1. Individually URL-encode each param
 *   2. Join with comma
 *   3. URL-encode the entire CSV string (double-encode — matches Java)
 *   4. Signature = SHA256("enc1,enc2,...,secret")
 *   5. Final URL = endPoint + doubleEncodedCSV + "/" + sig
 */
export function buildSignedGetUrl(endpoint, params) {
  const validated = normaliseParams(params);
  const encoded   = validated.map(encodeParam);                  // step 1
  const csv       = encoded.join(',');                           // step 2
  const doubleEnc = encodeURIComponent(csv);                    // step 3 (Java double-encodes)
  const sigInput  = [...encoded, OC_CORE_SECRET].join(',');      // step 4
  const sig       = sha256Hex(sigInput);
  return `${endpoint}${doubleEnc}/${sig}`;                      // step 5
}

/**
 * Build a signed POST URL (path only, no body).
 *
 * Java equivalent:
 *   prepareSha256WithSignature → sha256hex of individually-encoded params + secret
 *
 * Final URL = endPoint + sha256sig
 */
export function buildSignedPostUrl(endpoint, params) {
  const validated = normaliseParams(params);
  const encoded   = validated.map(encodeParam);
  const sigInput  = [...encoded, OC_CORE_SECRET].join(',');
  const sig       = sha256Hex(sigInput);
  return `${endpoint}${sig}`;
}

/**
 * Build the POST request body.
 *
 * Java equivalent:
 *   prepareBodyString → comma-separated individually-encoded params
 */
export function buildPostBody(params) {
  const validated = normaliseParams(params);
  return validated.map(encodeParam).join(',');
}

// ─── Raw Transport ────────────────────────────────────────────────

/**
 * Execute a signed GET request to an OC Core endpoint.
 * Returns raw string body or null on timeout/error.
 *
 * @param {string} endpoint    Full base URL + path (no trailing slash before params)
 * @param {string[]} params    Positional params array
 * @param {string} rrn         Reference/correlation ID for logging
 * @param {number} timeoutMs   Read timeout in ms (default 30s)
 */
export async function ocGet(endpoint, params, rrn = '', timeoutMs = 30_000) {
  const url        = buildSignedGetUrl(endpoint, params);
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  const startMs = Date.now();
  try {
    const resp   = await fetch(url, { method: 'GET', signal: controller.signal });
    const body   = await resp.text();
    const elapsed = Date.now() - startMs;
    clearTimeout(timer);

    if (!body || !body.trim()) {
      return { raw: null, elapsed_ms: elapsed, timedOut: true };
    }
    return { raw: body, elapsed_ms: elapsed, timedOut: false, httpStatus: resp.status };
  } catch (err) {
    clearTimeout(timer);
    const elapsed = Date.now() - startMs;
    if (err.name === 'AbortError') {
      return { raw: null, elapsed_ms: elapsed, timedOut: true };
    }
    return { raw: null, elapsed_ms: elapsed, timedOut: false, networkError: err.message };
  }
}

/**
 * Execute a signed POST request to an OC Core endpoint.
 * Body = comma-separated URL-encoded params (Java wire format).
 *
 * @param {string} endpoint    Full base URL + path
 * @param {string[]} params    Positional params array
 * @param {string} rrn         Reference/correlation ID for logging
 * @param {number} timeoutMs   Read timeout in ms (default 30s)
 */
export async function ocPost(endpoint, params, rrn = '', timeoutMs = 30_000) {
  const url        = buildSignedPostUrl(endpoint, params);
  const body       = buildPostBody(params);
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  const startMs = Date.now();
  try {
    const resp    = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
      signal:  controller.signal,
    });
    const rawBody = await resp.text();
    const elapsed  = Date.now() - startMs;
    clearTimeout(timer);

    if (!rawBody || !rawBody.trim()) {
      return { raw: null, elapsed_ms: elapsed, timedOut: true };
    }
    return { raw: rawBody, elapsed_ms: elapsed, timedOut: false, httpStatus: resp.status };
  } catch (err) {
    clearTimeout(timer);
    const elapsed = Date.now() - startMs;
    if (err.name === 'AbortError') {
      return { raw: null, elapsed_ms: elapsed, timedOut: true };
    }
    return { raw: null, elapsed_ms: elapsed, timedOut: false, networkError: err.message };
  }
}

// ─── Response Parser ──────────────────────────────────────────────

/**
 * Parse the standard OC Core response envelope.
 *
 * Java equivalent: JSON parsing + response_code/response_desc extraction
 * in getAndParse / postAndParse.
 *
 * OC Core always wraps responses as:
 *   { "response": { "response_code": "xx", "response_desc": "...", ...data } }
 *
 * @returns {object}
 *   {
 *     success: boolean,
 *     rspCode: string,
 *     rspDesc: string,
 *     data: object,          // full response object (minus code/desc)
 *     raw: object,           // full parsed JSON
 *     errorCode: string,     // internal error classification
 *     errorMessage: string,
 *   }
 */
export function parseOcCoreResponse(rawString, tranType, timeoutCodes = DEFAULT_TIMEOUT_CODES) {
  if (!rawString) {
    return {
      success:      false,
      rspCode:      '501',
      rspDesc:      'Request Timeout',
      data:         null,
      raw:          null,
      errorCode:    'OC_TIMEOUT',
      errorMessage: 'OC Core returned null or empty response',
    };
  }

  let json;
  try {
    json = JSON.parse(rawString);
  } catch {
    return {
      success:      false,
      rspCode:      '500',
      rspDesc:      'Invalid JSON Response',
      data:         rawString,
      raw:          null,
      errorCode:    'OC_INVALID_RESPONSE',
      errorMessage: 'OC Core returned non-JSON body',
    };
  }

  const response = json?.response;
  if (!response) {
    return {
      success:      false,
      rspCode:      '500',
      rspDesc:      'Missing response envelope',
      data:         json,
      raw:          json,
      errorCode:    'OC_MISSING_ENVELOPE',
      errorMessage: 'Response missing top-level "response" key',
    };
  }

  const rspCode = String(response.response_code ?? '');
  const rspDesc = String(response.response_desc ?? '');

  // Code "503" — unable to process
  if (rspCode === '503') {
    return {
      success:      false,
      rspCode,
      rspDesc:      'Unable to Process',
      data:         response,
      raw:          json,
      errorCode:    'OC_UNABLE_TO_PROCESS',
      errorMessage: rspDesc,
    };
  }

  // Code "400" — dig into tran-type sub-object for detail
  if (rspCode === '400' && tranType) {
    const tranData = response[tranType.toLowerCase()];
    if (tranData) {
      return {
        success:      false,
        rspCode:      String(tranData.statusCode ?? '400'),
        rspDesc:      String(tranData.description ?? rspDesc),
        data:         response,
        raw:          json,
        errorCode:    'OC_BAD_REQUEST',
        errorMessage: String(tranData.description ?? rspDesc),
      };
    }
  }

  // Timeout codes (configurable, matches Java: ${timeout.response-code})
  if (timeoutCodes.includes(rspCode)) {
    return {
      success:      false,
      rspCode,
      rspDesc:      'Transaction Timeout',
      data:         response,
      raw:          json,
      errorCode:    'OC_TIMEOUT',
      errorMessage: `Timeout response code: ${rspCode}`,
    };
  }

  // Success
  if (rspCode === '00') {
    // Strip meta fields from data
    const { response_code, response_desc, ...rest } = response;  // eslint-disable-line no-unused-vars
    return {
      success:      true,
      rspCode,
      rspDesc,
      data:         rest,
      raw:          json,
      errorCode:    null,
      errorMessage: null,
    };
  }

  // All other non-"00" — generic failure
  const sbpRejectCode   = response.sbp_reject_code   || null;
  const sbpRejectReason = response.sbp_reject_reason || null;

  return {
    success:      false,
    rspCode,
    rspDesc,
    data:         response,
    raw:          json,
    errorCode:    'OC_FAILURE',
    errorMessage: rspDesc,
    ...(sbpRejectCode && { sbpRejectCode }),
    ...(sbpRejectReason && { sbpRejectReason }),
  };
}

// ─── High-level Helpers ───────────────────────────────────────────

/**
 * Signed GET + parse.
 * Equivalent of OpenConnectUtils.getAndParse (without audit logging).
 */
export async function getAndParse(endpoint, params, { rrn = '', tranType, timeoutMs = 30_000, timeoutCodes } = {}) {
  const { raw, elapsed_ms, timedOut, networkError, httpStatus } = await ocGet(endpoint, params, rrn, timeoutMs);

  if (timedOut || networkError) {
    return {
      ...parseOcCoreResponse(null, tranType, timeoutCodes),
      elapsed_ms,
      ...(networkError && { networkError }),
    };
  }

  return {
    ...parseOcCoreResponse(raw, tranType, timeoutCodes),
    elapsed_ms,
    httpStatus,
  };
}

/**
 * Signed POST + parse.
 * Equivalent of OpenConnectUtils.postAndParse (without audit logging / inquiry).
 */
export async function postAndParse(endpoint, params, { rrn = '', tranType, timeoutMs = 30_000, timeoutCodes } = {}) {
  const { raw, elapsed_ms, timedOut, networkError, httpStatus } = await ocPost(endpoint, params, rrn, timeoutMs);

  if (timedOut || networkError) {
    return {
      ...parseOcCoreResponse(null, tranType, timeoutCodes),
      elapsed_ms,
      ...(networkError && { networkError }),
    };
  }

  return {
    ...parseOcCoreResponse(raw, tranType, timeoutCodes),
    elapsed_ms,
    httpStatus,
  };
}
