/**
 * cURL Import Service — Comprehensive Tests
 * Covers: parsing, tokenization, auth detection, body handling, confidence scoring, edge cases
 */
import { describe, it, expect } from 'vitest';
import { parseCurlCommand } from '../server/curlImportService.js';

// ─── Basic Parsing ──────────────────────────────────────────────

describe('parseCurlCommand — basic', () => {
  it('should return error for null input', () => {
    const r = parseCurlCommand(null);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no curl/i);
  });

  it('should return error for empty string', () => {
    const r = parseCurlCommand('');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no curl/i);
  });

  it('should return error for non-string input', () => {
    const r = parseCurlCommand(123);
    expect(r.success).toBe(false);
  });

  it('should return error when input does not start with curl', () => {
    const r = parseCurlCommand('wget https://example.com');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/must start with.*curl/i);
  });

  it('should parse a simple GET request', () => {
    const r = parseCurlCommand('curl https://api.example.com/users');
    expect(r.success).toBe(true);
    expect(r.config.wsConfig.baseUrl).toBe('https://api.example.com');
    expect(r.parsed.method).toBe('GET');
  });

  it('should parse curl with --url flag', () => {
    const r = parseCurlCommand('curl --url https://api.example.com/data');
    expect(r.success).toBe(true);
    expect(r.parsed.url).toContain('api.example.com');
  });

  it('should return error for missing URL', () => {
    const r = parseCurlCommand('curl -H "Accept: application/json"');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/url/i);
  });

  it('should return error for invalid URL', () => {
    const r = parseCurlCommand('curl not-a-url');
    expect(r.success).toBe(false);
  });
});

// ─── Method Detection ───────────────────────────────────────────

describe('parseCurlCommand — method detection', () => {
  it('should detect explicit -X POST', () => {
    const r = parseCurlCommand('curl -X POST https://api.example.com/submit');
    expect(r.success).toBe(true);
    expect(r.parsed.method).toBe('POST');
  });

  it('should detect --request PUT', () => {
    const r = parseCurlCommand('curl --request PUT https://api.example.com/update');
    expect(r.success).toBe(true);
    expect(r.parsed.method).toBe('PUT');
  });

  it('should detect DELETE method', () => {
    const r = parseCurlCommand('curl -X DELETE https://api.example.com/item/1');
    expect(r.success).toBe(true);
    expect(r.parsed.method).toBe('DELETE');
  });

  it('should infer POST when -d data is present', () => {
    const r = parseCurlCommand('curl https://api.example.com/submit -d \'{"key":"val"}\'');
    expect(r.success).toBe(true);
    expect(r.parsed.method).toBe('POST');
  });

  it('should default to GET when no body and no -X', () => {
    const r = parseCurlCommand('curl https://api.example.com/list');
    expect(r.success).toBe(true);
    expect(r.parsed.method).toBe('GET');
  });

  it('should handle case-insensitive method names', () => {
    const r = parseCurlCommand('curl -X post https://api.example.com/submit');
    expect(r.success).toBe(true);
    expect(r.parsed.method).toBe('POST');
  });
});

// ─── Header Parsing ─────────────────────────────────────────────

describe('parseCurlCommand — headers', () => {
  it('should parse -H headers', () => {
    const r = parseCurlCommand(
      'curl https://api.example.com -H "Content-Type: application/json" -H "Accept: text/html"'
    );
    expect(r.success).toBe(true);
    expect(r.parsed.rawHeaders['Content-Type']).toBe('application/json');
    expect(r.parsed.rawHeaders['Accept']).toBe('text/html');
  });

  it('should parse --header long flag', () => {
    const r = parseCurlCommand(
      'curl https://api.example.com --header "X-Custom: value123"'
    );
    expect(r.success).toBe(true);
    expect(r.parsed.rawHeaders['X-Custom']).toBe('value123');
  });

  it('should handle headers with colons in value', () => {
    const r = parseCurlCommand(
      "curl https://api.example.com -H 'Authorization: Bearer abc:def:ghi'"
    );
    expect(r.success).toBe(true);
    expect(r.parsed.rawHeaders['Authorization']).toBe('Bearer abc:def:ghi');
  });
});

// ─── Auth Detection ─────────────────────────────────────────────

describe('parseCurlCommand — auth detection', () => {
  it('should detect Bearer auth', () => {
    const r = parseCurlCommand(
      'curl https://api.example.com -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test"'
    );
    expect(r.success).toBe(true);
    expect(r.parsed.auth.type).toBe('BEARER');
    expect(r.parsed.auth.token).toContain('eyJhbG');
  });

  it('should detect Basic auth', () => {
    const encoded = Buffer.from('admin:password123').toString('base64');
    const r = parseCurlCommand(
      `curl https://api.example.com -H "Authorization: Basic ${encoded}"`
    );
    expect(r.success).toBe(true);
    expect(r.parsed.auth.type).toBe('BASIC');
    expect(r.parsed.auth.username).toBe('admin');
    expect(r.parsed.auth.password).toBe('password123');
  });

  it('should detect API key header', () => {
    const r = parseCurlCommand(
      'curl https://api.example.com -H "x-api-key: sk-1234567890"'
    );
    expect(r.success).toBe(true);
    expect(r.parsed.auth.type).toBe('API_KEY');
  });

  it('should return NONE when no auth present', () => {
    const r = parseCurlCommand(
      'curl https://api.example.com -H "Content-Type: application/json"'
    );
    expect(r.success).toBe(true);
    expect(r.parsed.auth.type).toBe('NONE');
  });

  it('should detect Token auth', () => {
    const r = parseCurlCommand(
      'curl https://api.example.com -H "Authorization: Token abc123"'
    );
    expect(r.success).toBe(true);
    expect(r.parsed.auth.type).toBe('TOKEN');
  });
});

// ─── Body Parsing ───────────────────────────────────────────────

describe('parseCurlCommand — body parsing', () => {
  it('should parse JSON body from -d flag', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.example.com/submit -H "Content-Type: application/json" -d \'{"name":"John","age":30}\''
    );
    expect(r.success).toBe(true);
    expect(r.parsed.bodyParsed).toEqual({ name: 'John', age: 30 });
    expect(r.parsed.fields.length).toBeGreaterThanOrEqual(2);
  });

  it('should parse body from --data-raw', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.example.com --data-raw \'{"x":1}\''
    );
    expect(r.success).toBe(true);
    expect(r.parsed.bodyParsed).toEqual({ x: 1 });
  });

  it('should handle non-JSON body gracefully', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.example.com -d "key=value&foo=bar"'
    );
    expect(r.success).toBe(true);
    expect(r.parsed.bodyParsed).toBeNull();
    expect(r.parsed.body).toBe('key=value&foo=bar');
  });

  it('should extract nested fields from JSON body', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.example.com -d \'{"user":{"name":"Alice","address":{"city":"LA"}}}\''
    );
    expect(r.success).toBe(true);
    expect(r.parsed.fields.some(f => f.path === 'user.name')).toBe(true);
    expect(r.parsed.fields.some(f => f.path === 'user.address.city')).toBe(true);
  });

  it('should handle empty body string', () => {
    const r = parseCurlCommand('curl -X POST https://api.example.com -d ""');
    expect(r.success).toBe(true);
  });
});

// ─── Confidence Scoring ─────────────────────────────────────────

describe('parseCurlCommand — confidence scoring', () => {
  it('should give high confidence for a fully-featured cURL', () => {
    const r = parseCurlCommand(
      `curl -X POST https://api.example.com/v1/payment \\
       -H "Content-Type: application/json" \\
       -H "Authorization: Bearer token123" \\
       -d '{"amount":100,"currency":"PKR","account":"1234"}'`
    );
    expect(r.success).toBe(true);
    expect(r.confidence.score).toBeGreaterThanOrEqual(70);
  });

  it('should give lower confidence for bare GET', () => {
    const r = parseCurlCommand('curl https://example.com');
    expect(r.success).toBe(true);
    expect(r.confidence.score).toBeLessThan(50);
  });

  it('should produce warnings array', () => {
    const r = parseCurlCommand('curl https://example.com');
    expect(r.success).toBe(true);
    expect(Array.isArray(r.confidence.warnings)).toBe(true);
  });

  it('should return fieldCount', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.example.com -d \'{"a":1,"b":2,"c":3}\''
    );
    expect(r.success).toBe(true);
    expect(r.fieldCount).toBe(3);
  });
});

// ─── Line Continuation & Special Characters ─────────────────────

describe('parseCurlCommand — line continuation & escaping', () => {
  it('should handle backslash line continuations', () => {
    const r = parseCurlCommand(
      `curl -X POST \\\nhttps://api.example.com/test \\\n-H "Accept: application/json"`
    );
    expect(r.success).toBe(true);
    expect(r.parsed.url).toContain('api.example.com');
  });

  it('should handle single-quoted strings', () => {
    const r = parseCurlCommand(
      "curl -X POST https://api.example.com -d '{\"key\":\"value\"}'"
    );
    expect(r.success).toBe(true);
  });

  it('should handle double-quoted strings with escapes', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.example.com -d "{\\"name\\":\\"test\\"}"'
    );
    expect(r.success).toBe(true);
  });

  it('should handle --compressed flag without error', () => {
    const r = parseCurlCommand('curl --compressed https://api.example.com/gzip');
    expect(r.success).toBe(true);
  });

  it('should handle -k/--insecure flag', () => {
    const r = parseCurlCommand('curl -k https://self-signed.example.com/data');
    expect(r.success).toBe(true);
  });

  it('should skip ignored flags like -s -L -v', () => {
    const r = parseCurlCommand('curl -sLv https://api.example.com/users');
    expect(r.success).toBe(true);
  });
});

// ─── Config Scaffold ────────────────────────────────────────────

describe('parseCurlCommand — config scaffold', () => {
  it('should generate wsConfig with baseUrl and type', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.bank.com/v1/balance -H "Content-Type: application/json" -d \'{"acc":"123"}\''
    );
    expect(r.success).toBe(true);
    expect(r.config.wsConfig.baseUrl).toBe('https://api.bank.com');
    expect(r.config.wsConfig.type).toBe('REST');
  });

  it('should generate wsEndpointConfig with method and template', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.bank.com/v1/balance -d \'{"acc":"123"}\''
    );
    expect(r.success).toBe(true);
    expect(r.config.wsEndpointConfig.method).toBe('POST');
    expect(r.config.wsEndpointConfig.endpointTemplate).toContain('/v1/balance');
  });

  it('should generate response definitions with success + wildcard', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.example.com/pay -d \'{"x":1}\''
    );
    expect(r.success).toBe(true);
    expect(r.config.wsResponseDefinition.length).toBeGreaterThanOrEqual(2);
    const codes = r.config.wsResponseDefinition.map(d => d.matchCode);
    expect(codes).toContain('000');
    expect(codes).toContain('*');
  });

  it('should generate tranRequestMap from JSON body fields', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.example.com -d \'{"name":"test","amount":100}\''
    );
    expect(r.success).toBe(true);
    expect(r.config.tranRequestMap.length).toBeGreaterThanOrEqual(2);
    expect(r.config.tranRequestMap[0]).toHaveProperty('paramName');
    expect(r.config.tranRequestMap[0]).toHaveProperty('isMandatory');
  });

  it('should auto-generate service name from URL path', () => {
    const r = parseCurlCommand('curl https://api.example.com/payment-gateway/v2/inquiry');
    expect(r.success).toBe(true);
    expect(r.config.wsConfig.serviceName).toBeTruthy();
    expect(typeof r.config.wsConfig.serviceName).toBe('string');
  });

  it('should generate wsReqParamDetails', () => {
    const r = parseCurlCommand(
      'curl -X POST https://api.example.com/pay -d \'{"x":1}\''
    );
    expect(r.success).toBe(true);
    expect(r.config.wsReqParamDetails).toBeDefined();
    expect(r.config.wsReqParamDetails.queueIn).toBe('OPENCONNECT.IN');
  });

  it('should detect token config for Bearer auth', () => {
    const r = parseCurlCommand(
      'curl https://api.example.com -H "Authorization: Bearer sometoken123456"'
    );
    expect(r.success).toBe(true);
    expect(r.tokenConfig).toBeDefined();
    expect(r.tokenConfig.hasToken).toBe(true);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────

describe('parseCurlCommand — edge cases', () => {
  it('should handle URL with query parameters', () => {
    const r = parseCurlCommand('curl "https://api.example.com/search?q=test&page=1"');
    expect(r.success).toBe(true);
    expect(r.parsed.url).toContain('q=test');
  });

  it('should handle very long cURL command', () => {
    const bigBody = JSON.stringify({ data: 'x'.repeat(5000) });
    const r = parseCurlCommand(
      `curl -X POST https://api.example.com/big -d '${bigBody}'`
    );
    expect(r.success).toBe(true);
  });

  it('should handle cURL with only whitespace body', () => {
    const r = parseCurlCommand('curl -X POST https://api.example.com -d "   "');
    expect(r.success).toBe(true);
  });

  it('should handle mixed single and double quotes', () => {
    const r = parseCurlCommand(
      `curl -X POST https://api.example.com -H 'Content-Type: application/json' -d "{\\"key\\":\\"val\\"}"`
    );
    expect(r.success).toBe(true);
  });
});
