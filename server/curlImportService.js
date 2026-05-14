/**
 * curlImportService.js
 * Parses a raw cURL command string into a structured OpenConnect-compatible config object.
 * Handles: URL, method, headers, auth detection (Bearer/Basic/API-Key), request body, placeholder extraction.
 */

/** Confidence scoring weights */
const WEIGHTS = {
  hasUrl:        20,
  hasMethod:     10,
  hasBody:       15,
  hasAuthHeader: 20,
  hasJsonBody:   10,
  hasContentType: 5,
  hasEndpointPath: 10,
  hasFields:     10,
};

/**
 * Tokenise the curl string into logical segments.
 * Handles line-continuation backslashes and quoted strings.
 */
function tokenize(raw) {
  // Normalize line continuations
  const normalized = raw.replace(/\\\r?\n/g, ' ').trim();

  const tokens = [];
  let i = 0;

  while (i < normalized.length) {
    // Skip whitespace
    while (i < normalized.length && /\s/.test(normalized[i])) i++;
    if (i >= normalized.length) break;

    const ch = normalized[i];

    // Single-quoted string
    if (ch === "'") {
      let val = '';
      i++; // skip opening quote
      while (i < normalized.length && normalized[i] !== "'") {
        if (normalized[i] === '\\' && normalized[i + 1] === "'") {
          val += "'";
          i += 2;
        } else {
          val += normalized[i++];
        }
      }
      i++; // skip closing quote
      tokens.push(val);
    // Double-quoted string
    } else if (ch === '"') {
      let val = '';
      i++;
      while (i < normalized.length && normalized[i] !== '"') {
        if (normalized[i] === '\\') {
          i++;
          const esc = normalized[i];
          val += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === '"' ? '"' : '\\' + esc;
          i++;
        } else {
          val += normalized[i++];
        }
      }
      i++;
      tokens.push(val);
    // Unquoted token
    } else {
      let val = '';
      while (i < normalized.length && !/\s/.test(normalized[i])) {
        val += normalized[i++];
      }
      tokens.push(val);
    }
  }

  return tokens;
}

/**
 * Detect the authentication type from headers.
 */
function detectAuthType(headers) {
  const authHeader = Object.entries(headers).find(([k]) =>
    k.toLowerCase() === 'authorization'
  );
  if (!authHeader) {
    // Check for common API key header patterns
    const apiKeyHeader = Object.entries(headers).find(([k]) =>
      /api[-_]?key|x-api-key|apikey/i.test(k)
    );
    if (apiKeyHeader) {
      return { type: 'API_KEY', header: apiKeyHeader[0], value: '{{API_KEY}}' };
    }
    return { type: 'NONE' };
  }

  const value = authHeader[1];
  if (/^Bearer\s+/i.test(value)) {
    return { type: 'BEARER', token: value.replace(/^Bearer\s+/i, '').trim() };
  }
  if (/^Basic\s+/i.test(value)) {
    const encoded = value.replace(/^Basic\s+/i, '').trim();
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx !== -1) {
        return {
          type: 'BASIC',
          username: decoded.substring(0, colonIdx),
          password: decoded.substring(colonIdx + 1),
          encoded,
        };
      }
    } catch {}
    return { type: 'BASIC', encoded };
  }
  if (/^Token\s+/i.test(value)) {
    return { type: 'TOKEN', token: value.replace(/^Token\s+/i, '').trim() };
  }
  return { type: 'CUSTOM', value };
}

/**
 * Flatten JSON object to field list (max depth 4).
 */
function flattenFields(obj, prefix = '', depth = 0) {
  if (depth > 4 || typeof obj !== 'object' || obj === null) return [];
  return Object.entries(obj).flatMap(([key, val]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      return flattenFields(val, path, depth + 1);
    }
    return [{ name: key, path, value: val, type: Array.isArray(val) ? 'array' : typeof val }];
  });
}

/**
 * Replace leaf values in a JSON template with {{placeholder}} syntax.
 */
function buildTemplateFromBody(obj, depth = 0) {
  if (depth > 6 || typeof obj !== 'object' || obj === null) return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object' && val !== null) {
      result[key] = buildTemplateFromBody(val, depth + 1);
    } else {
      result[key] = `{{${key}}}`;
    }
  }
  return result;
}

/**
 * Detect response-code path from a sample response body.
 */
function detectResponseCodePath(respObj, depth = 0, prefix = '$') {
  if (depth > 3 || typeof respObj !== 'object' || respObj === null) return null;
  for (const [key, val] of Object.entries(respObj)) {
    if (/response.?code|resp.?code|result.?code|status.?code|rc|code/i.test(key)) {
      return `${prefix}.${key}`;
    }
  }
  // Recurse into first level nested objects
  for (const [key, val] of Object.entries(respObj)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const found = detectResponseCodePath(val, depth + 1, `${prefix}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get all leaf JSON paths.
 */
function getLeafPaths(obj, prefix = '$', depth = 0) {
  if (depth > 5 || typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([key, val]) => {
    const path = `${prefix}.${key}`;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      return getLeafPaths(val, path, depth + 1);
    }
    return [path];
  });
}

/**
 * Calculate confidence score 0-100 for the parsed result.
 */
function scoreConfidence(parsed) {
  let score = 0;
  const warnings = [];

  if (parsed.url) score += WEIGHTS.hasUrl;
  else warnings.push('No URL detected');

  if (parsed.method && parsed.method !== 'GET') score += WEIGHTS.hasMethod;
  else if (parsed.method === 'GET') score += 5;

  if (parsed.body) score += WEIGHTS.hasBody;
  else if (parsed.method !== 'GET') warnings.push('No request body found');

  if (parsed.auth.type !== 'NONE') score += WEIGHTS.hasAuthHeader;
  else warnings.push('No authentication header detected');

  if (parsed.bodyParsed) score += WEIGHTS.hasJsonBody;
  else if (parsed.body) warnings.push('Request body is not valid JSON');

  if (parsed.headers['Content-Type'] || parsed.headers['content-type']) score += WEIGHTS.hasContentType;

  if (parsed.endpointPath && parsed.endpointPath !== '/') score += WEIGHTS.hasEndpointPath;
  else warnings.push('No meaningful endpoint path detected');

  if (parsed.fields && parsed.fields.length > 0) score += WEIGHTS.hasFields;

  return { score: Math.min(100, score), warnings };
}

/**
 * Main export: Parse a raw cURL command string.
 * Returns a structured object suitable for populating the OpenConnect wizard.
 */
export function parseCurlCommand(rawCurl) {
  if (!rawCurl || typeof rawCurl !== 'string') {
    return { success: false, error: 'No cURL command provided' };
  }

  const trimmed = rawCurl.trim();

  // Must start with 'curl'
  if (!/^curl(\s|$)/i.test(trimmed)) {
    return { success: false, error: 'Input does not appear to be a curl command. It must start with "curl".' };
  }

  try {
    const tokens = tokenize(trimmed);
    let i = 1; // skip 'curl'

    let url = null;
    let method = null;
    let headers = {};
    let body = null;
    let compressed = false;
    let insecure = false;

    // ── Parse flags ────────────────────────────────────────────────
    while (i < tokens.length) {
      const tok = tokens[i];

      // URL positional arg (not a flag)
      if (!tok.startsWith('-') && !url && /^https?:\/\//i.test(tok)) {
        url = tok;
        i++;
        continue;
      }

      // --url URL
      if (tok === '--url') {
        url = tokens[++i];
        i++;
        continue;
      }

      // -X METHOD or --request METHOD
      if (tok === '-X' || tok === '--request') {
        method = tokens[++i].toUpperCase();
        i++;
        continue;
      }

      // -H "Header: Value" or --header
      if (tok === '-H' || tok === '--header') {
        const raw = tokens[++i];
        const colonIdx = raw.indexOf(':');
        if (colonIdx !== -1) {
          const hKey = raw.substring(0, colonIdx).trim();
          const hVal = raw.substring(colonIdx + 1).trim();
          headers[hKey] = hVal;
        }
        i++;
        continue;
      }

      // -d or --data or --data-raw or --data-binary
      if (['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode'].includes(tok)) {
        body = tokens[++i];
        i++;
        continue;
      }

      // --compressed
      if (tok === '--compressed') { compressed = true; i++; continue; }
      // -k or --insecure
      if (tok === '-k' || tok === '--insecure') { insecure = true; i++; continue; }

      // -L --location  -s --silent  -v --verbose  -o --output (skip their args if they have one)
      if (['-L', '--location', '-s', '--silent', '-v', '--verbose', '-i', '--include', '--no-keepalive'].includes(tok)) {
        i++;
        continue;
      }
      if (['-o', '--output', '-u', '--user', '-A', '--user-agent', '-e', '--referer', '--max-time', '--connect-timeout', '--retry', '--cacert', '--cert', '--key', '--proxy'].includes(tok)) {
        i += 2; // skip flag + value
        continue;
      }

      // Catch URL as positional arg when it comes before flags
      if (!tok.startsWith('-') && !url && (tok.startsWith('http') || tok.startsWith('ftp'))) {
        url = tok;
        i++;
        continue;
      }

      // Consume combined short flags like -sL
      if (tok.startsWith('-') && !tok.startsWith('--') && tok.length > 2) {
        // Unpack combined: -sLX POST → already tokenized, just skip
        i++;
        continue;
      }

      i++;
    }

    // ── Validate URL ───────────────────────────────────────────────
    if (!url) {
      return { success: false, error: 'Could not find a URL in the curl command. Make sure the URL starts with http:// or https://' };
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { success: false, error: `Invalid URL: ${url.substring(0, 100)}` };
    }

    // ── Infer method ───────────────────────────────────────────────
    if (!method) {
      method = body ? 'POST' : 'GET';
    }

    // ── Parse body ─────────────────────────────────────────────────
    let bodyParsed = null;
    let bodyParseError = null;
    if (body) {
      try {
        bodyParsed = JSON.parse(body);
      } catch (e) {
        bodyParseError = e.message;
      }
    }

    // ── Auth detection ─────────────────────────────────────────────
    const auth = detectAuthType(headers);

    // ── Extract fields ─────────────────────────────────────────────
    const fields = bodyParsed ? flattenFields(bodyParsed) : [];

    // ── Build data template ────────────────────────────────────────
    const dataTemplate = bodyParsed ? JSON.stringify(buildTemplateFromBody(bodyParsed), null, 2) : (body || '');

    // ── Build URL parts ────────────────────────────────────────────
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const endpointPath = parsedUrl.pathname + (parsedUrl.search || '');

    // ── Auto-generate service name from path ───────────────────────
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || 'service';
    const autoServiceName = lastSegment.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

    // ── Build masked headers for display ──────────────────────────
    const displayHeaders = { ...headers };
    if (displayHeaders['Authorization']) {
      displayHeaders['Authorization'] = displayHeaders['Authorization'].replace(/(?<=Bearer\s|Basic\s|Token\s).+/i, '••••••••');
    }

    // ── Confidence score ────────────────────────────────────────────
    const parsed = { url, method, body, bodyParsed, endpointPath, auth, headers, fields };
    const { score, warnings } = scoreConfidence(parsed);

    // ── Build OpenConnect config scaffold ──────────────────────────
    const config = {
      wsConfig: {
        baseUrl,
        type: 'REST',
        serviceName: autoServiceName,
      },
      wsEndpointConfig: {
        method,
        endpointTemplate: endpointPath,
        requestFormat: 'JSON',
        responseFormat: 'JSON',
        dataTemplate,
        requestHeaders: headers,
        connectionTimeout: 5000,
        readTimeout: 30000,
        type: autoServiceName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').substring(0, 30),
        reversalType: 'NONE',
        guaranteed: false,
        variableFields: fields.map(f => f.name),
        exReqResLog: true,
      },
      tranRequestMap: fields.map((f, idx) => ({
        id: Math.floor(Date.now() / 1000) % 100000 * 10 + idx + 1,
        paramName: f.name,
        value: `{{${f.name}}}`,
        isMandatory: 'Y',
        maxLength: '50',
        regex: '',
        logParameter: 0,
        logColumn: '',
      })),
      wsResponseDefinition: [
        { matchCode: '000', ourCode: '00', ourDescription: 'Success' },
        { matchCode: '*', ourCode: '96', ourDescription: 'Unknown / unmapped error' },
      ],
      wsReqParamDetails: {
        tranId: String(Math.floor(Date.now() / 1000) % 100000),
        tranType: autoServiceName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').substring(0, 30),
        queueIn: 'OPENCONNECT.IN',
        queueType: 'REQUEST',
        fromIp: '0.0.0.0',
        hostId: 1,
        responseType: 'JSON',
        safQueue: '',
      },
    };

    // ── Token config if Bearer auth detected ──────────────────────
    let tokenConfig = null;
    if (auth.type === 'BEARER') {
      tokenConfig = {
        hasToken: true,
        tokenNote: 'Bearer token detected in Authorization header. Consider creating a TOKEN endpoint in Step 2.',
      };
    } else if (auth.type === 'BASIC') {
      tokenConfig = {
        hasToken: false,
        tokenNote: 'Basic authentication detected. Configure credentials in the Token step.',
      };
    }

    return {
      success: true,
      parsed: {
        url,
        baseUrl,
        endpointPath,
        method,
        headers: displayHeaders,
        rawHeaders: headers,
        body,
        bodyParsed,
        bodyParseError,
        auth,
        fields,
        autoServiceName,
        dataTemplate,
        insecure,
        compressed,
      },
      config,
      tokenConfig,
      confidence: { score, warnings },
      fieldCount: fields.length,
    };
  } catch (err) {
    return { success: false, error: `Failed to parse curl command: ${err.message}` };
  }
}
