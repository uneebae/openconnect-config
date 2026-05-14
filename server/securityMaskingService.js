/**
 * Security Masking Service
 * Masks sensitive fields in objects before storage or display.
 */

const SENSITIVE_KEYS = [
  'client_secret', 'clientSecret', 'password', 'token', 'access_token',
  'authorization', 'Authorization', 'secret', 'api_key', 'apiKey',
  'refresh_token', 'bearer', 'credential', 'private_key', 'privateKey'
];

const SENSITIVE_HEADER_KEYS = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

/**
 * Mask a single string value, keeping first 4 chars visible if long enough.
 */
export function maskValue(val) {
  if (val == null) return val;
  const s = String(val);
  if (s.length <= 8) return '••••••••';
  return s.substring(0, 4) + '••••••••';
}

/**
 * Deep-clone an object, masking any keys that look sensitive.
 */
export function maskSensitiveFields(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitiveFields);

  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lower.includes(sk.toLowerCase()))) {
      result[key] = maskValue(val);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = maskSensitiveFields(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Mask sensitive headers (authorization, api keys, cookies).
 */
export function maskHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const masked = {};
  for (const [key, val] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.includes(key.toLowerCase())) {
      masked[key] = maskValue(val);
    } else {
      masked[key] = val;
    }
  }
  return masked;
}
