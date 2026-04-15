/**
 * Security & Safety Tests
 * Validates that all production safety measures work correctly:
 * - SQL injection protection
 * - Destructive statement blocking
 * - Input validation & length limits
 * - Password masking
 * - Rate limiting existence
 * - 404 / error handling
 */
import { describe, it, expect } from 'vitest';
import { createTestClient, getDb } from './helpers.js';

const api = createTestClient();

// ─── SQL Injection Prevention ────────────────────────

describe('SQL Injection Prevention', () => {
  it('should handle single quotes in INSERT values safely', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: [
        "INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://test.com', 'REST', 'O''Brien Service')"
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify the data was stored correctly
    const db = getDb();
    const row = db.prepare("SELECT service_name FROM ws_config WHERE service_name LIKE '%Brien%'").get();
    db.close();
    expect(row.service_name).toBe("O'Brien Service");
  });

  it('should not execute statements hidden after semicolons (SQLite handles this safely)', async () => {
    // SQLite only executes one statement per prepare(), so injection via semicolons is prevented
    const res = await api.post('/api/execute-sql').send({
      statements: [
        "INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://safe.com', 'REST', 'Safe'); DROP TABLE ws_config;--"
      ]
    });
    // This will error because SQLite prepare() doesn't allow multiple statements
    // OR it will insert but not execute the DROP
    // Either way, ws_config table must still exist
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ws_config'").all();
    db.close();
    expect(tables.length).toBe(1);
  });

  it('should reject table names that are not in the allowlist', async () => {
    const res = await api.get('/api/table/sqlite_master');
    expect(res.status).toBe(400);
  });

  it('should not serve files via path traversal in table name', async () => {
    const res = await api.get('/api/table/../../etc/passwd');
    // Express normalizes the path — either 400 (allowlist rejects) or 404 (no route matched)
    expect([400, 404]).toContain(res.status);
    // Critically: must never return 200 with file contents
    expect(res.status).not.toBe(200);
  });
});

// ─── Destructive Statement Blocking (SQLite mode) ────

describe('Destructive Statement Blocking (SQLite)', () => {
  it('should block DROP TABLE', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['DROP TABLE ws_config']
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should block ALTER TABLE', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['ALTER TABLE ws_config ADD COLUMN evil TEXT']
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should block CREATE TABLE', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['CREATE TABLE malicious (id INT, data TEXT)']
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should block case-insensitive destructive statements', async () => {
    const variants = ['drop table ws_config', 'Drop Table ws_config', 'DROP TABLE ws_config'];
    for (const stmt of variants) {
      const res = await api.post('/api/execute-sql').send({ statements: [stmt] });
      expect(res.status).toBe(400);
    }
  });

  it('should block DELETE statements in SQLite mode', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['DELETE FROM ws_config WHERE id = 1']
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should block UPDATE statements in SQLite mode', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ["UPDATE ws_config SET service_name = 'hacked' WHERE id = 1"]
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should block TRUNCATE statements', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['TRUNCATE TABLE ws_config']
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should block SQL comment bypass: /* comment */ DELETE', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['/* bypass */ DELETE FROM ws_config']
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should block SQL comment bypass: /* comment */ DROP TABLE', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['/* admin */ DROP TABLE ws_config']
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should reject unknown statement types in SQLite mode', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['EXEC sp_who']
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });
});

// ─── Reset Protection ────────────────────────────────

describe('Reset Protection', () => {
  it('should allow reset in SQLite mode', async () => {
    const res = await api.post('/api/reset');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mode).toBe('sqlite');
  });

  it('should clear config tables on reset but not crash', async () => {
    // Insert data
    const db = getDb();
    db.prepare("INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://test.com', 'REST', 'Test')").run();
    db.close();

    await api.post('/api/reset');

    const db2 = getDb();
    const count = db2.prepare('SELECT COUNT(*) as c FROM ws_config').get().c;
    db2.close();
    expect(count).toBe(0);
  });
});

// ─── Password Masking ────────────────────────────────

describe('Password Masking', () => {
  it('should mask password when retrieving a saved connection', async () => {
    const { body: { id } } = await api.post('/api/db/connections').send({
      name: 'SecretDB',
      type: 'mssql',
      host: '10.5.70.5',
      port: 1440,
      database_name: 'Production',
      username: 'admin',
      password: 'SuperSecret123!'
    });

    const res = await api.get(`/api/db/connections/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.connection.password).toBe('••••••••');
    expect(res.body.connection.password).not.toBe('SuperSecret123!');
  });

  it('should return empty string when password is empty', async () => {
    const { body: { id } } = await api.post('/api/db/connections').send({
      name: 'NoPwdDB',
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      database_name: 'testdb',
      username: 'user',
      password: ''
    });

    const res = await api.get(`/api/db/connections/${id}`);
    expect(res.body.connection.password).toBe('');
  });

  it('should not expose password in list endpoint', async () => {
    await api.post('/api/db/connections').send({
      name: 'ListPwdTest',
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      database_name: 'mydb',
      username: 'root',
      password: 'root123'
    });

    const res = await api.get('/api/db/connections');
    expect(res.status).toBe(200);
    for (const conn of res.body.connections) {
      expect(conn).not.toHaveProperty('password');
    }
  });
});

// ─── Input Validation ────────────────────────────────

describe('Input Validation', () => {
  it('should reject config with name > 200 chars', async () => {
    const res = await api.post('/api/configs').send({
      name: 'A'.repeat(201),
      client: 'Test',
      config: {}
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });

  it('should reject config with client > 100 chars', async () => {
    const res = await api.post('/api/configs').send({
      name: 'Valid',
      client: 'C'.repeat(101),
      config: {}
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });

  it('should reject connections with host > 255 chars', async () => {
    const res = await api.post('/api/db/connections').send({
      name: 'Test',
      type: 'mssql',
      host: 'H'.repeat(256),
      database_name: 'test',
      username: 'admin'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });

  it('should reject connections with database_name > 128 chars', async () => {
    const res = await api.post('/api/db/connections').send({
      name: 'Test',
      type: 'mssql',
      host: 'localhost',
      database_name: 'D'.repeat(129),
      username: 'admin'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });

  it('should reject connections with username > 128 chars', async () => {
    const res = await api.post('/api/db/connections').send({
      name: 'Test',
      type: 'mssql',
      host: 'localhost',
      database_name: 'testdb',
      username: 'U'.repeat(129)
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });

  it('should reject DB connect with invalid port (negative)', async () => {
    const res = await api.post('/api/db/connect').send({
      type: 'mssql',
      host: 'localhost',
      port: -1,
      database: 'test',
      user: 'admin'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Port must be/);
  });

  it('should reject DB connect with port > 65535', async () => {
    const res = await api.post('/api/db/connect').send({
      type: 'mssql',
      host: 'localhost',
      port: 70000,
      database: 'test',
      user: 'admin'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Port must be/);
  });

  it('should reject invalid id format', async () => {
    const res = await api.get('/api/configs/not-a-number');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid id/);
  });

  it('should reject connection with only name (missing type, host, etc.)', async () => {
    const res = await api.post('/api/db/connections').send({ name: 'TestOnly' });
    expect(res.status).toBe(400);
  });

  it('should reject connect request with only type (missing host, database, user)', async () => {
    const res = await api.post('/api/db/connect').send({ type: 'mssql' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });
});

// ─── JSON Body Size Limit ──────────────────────────

describe('Request Size Limits', () => {
  it('should reject config data > 500KB', async () => {
    const bigConfig = { data: 'x'.repeat(600000) };
    const res = await api.post('/api/configs').send({
      name: 'BigConfig',
      client: 'Test',
      config: bigConfig
    });
    // Either 400 (app-level 500KB check) or 413 (Express 512kb body-parser limit)
    expect([400, 413]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});

// ─── Error Handling ──────────────────────────────────

describe('Global Error Handling', () => {
  it('should return JSON for 404 routes', async () => {
    const res = await api.get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.success).toBe(false);
  });

  it('should handle POST to non-existent route', async () => {
    const res = await api.post('/api/does-not-exist').send({ test: true });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Route not found');
  });
});

// ─── DB Type Whitelist ───────────────────────────────

describe('Database Type Whitelist', () => {
  const invalidTypes = ['oracle', 'sqlite', 'mongodb', 'redis', 'cassandra', 'SQL Server', ''];

  for (const type of invalidTypes) {
    it(`should reject DB type: "${type}"`, async () => {
      const res = await api.post('/api/db/connect').send({
        type,
        host: 'localhost',
        database: 'test',
        user: 'admin'
      });
      expect(res.status).toBe(400);
    });
  }

  const validTypes = ['mssql', 'postgres', 'mysql'];

  for (const type of validTypes) {
    it(`should accept DB type: "${type}" (will fail on connect but pass validation)`, async () => {
      const res = await api.post('/api/db/connect').send({
        type,
        host: '192.0.2.1', // unreachable test address
        database: 'test',
        user: 'admin',
        password: 'pass'
      });
      // Should pass type validation: either 400 (connection failed) or 429 (rate limited)
      // Both are acceptable — what matters is it's NOT 400 with "Unsupported"
      expect([400, 429]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.error).not.toMatch(/Unsupported/);
      }
    });
  }
});

// ─── Statement Count Limit ──────────────────────────

describe('Statement Count Limit', () => {
  it('should reject more than 200 statements', async () => {
    const statements = Array.from({ length: 201 }, (_, i) =>
      `INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://test${i}.com', 'REST', 'Test${i}')`
    );
    const res = await api.post('/api/execute-sql').send({ statements });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Too many statements/);
  });
});

// ─── Username Leak Prevention ────────────────────────

describe('Username Leak Prevention', () => {
  it('GET /api/db/status should not expose username', async () => {
    const res = await api.get('/api/db/status');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('user');
  });
});

// ─── Password Encryption ────────────────────────────

describe('Password Encryption', () => {
  it('should not store password as plaintext in SQLite', async () => {
    const { body: { id } } = await api.post('/api/db/connections').send({
      name: 'EncTest',
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      database_name: 'testdb',
      username: 'admin',
      password: 'MyP@ssw0rd!'
    });

    // Read raw from SQLite — password should be encrypted, not plaintext
    const db = getDb();
    const row = db.prepare('SELECT password FROM db_connections WHERE id = ?').get(id);
    db.close();

    expect(row.password).not.toBe('MyP@ssw0rd!');
    expect(row.password).not.toBe('');
    // Encrypted format: iv:tag:ciphertext
    expect(row.password).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });
});

// ─── 404 Content Injection Prevention ────────────────

describe('404 Content Injection', () => {
  it('should sanitize reflected URL in 404 response', async () => {
    const res = await api.get('/api/<script>alert(1)</script>');
    expect(res.status).toBe(404);
    expect(res.body.error).not.toContain('<script>');
    expect(res.body.error).not.toContain('<');
  });
});
