/**
 * API Endpoint Tests — server/index.js
 * Tests all Express routes: health, SQL execution, verify, reset, configs, connections.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createTestClient, setupTestDb, setupTestDbWithSeed, teardownTestDb, getDb } from './helpers.js';

const api = createTestClient();

beforeAll(async () => {
  await setupTestDbWithSeed();
});

afterAll(async () => {
  await teardownTestDb();
});

// ─── Health Check ────────────────────────────────────

describe('GET /api/health', () => {
  it('should return status ok in sqlite mode', async () => {
    const res = await api.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.mode).toBe('sqlite');
    expect(res.body.connected).toBe(true);
  });
});

// ─── Execute SQL ─────────────────────────────────────

describe('POST /api/execute-sql', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  it('should execute INSERT statements', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: [
        "INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://api.test.com', 'REST', 'Test Service')"
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].type).toBe('INSERT');
    expect(res.body.results[0].changes).toBe(1);
  });

  it('should execute SELECT statements', async () => {
    // Insert a unique record and select it by service_name
    const uniqueName = `SelectTest-${Date.now()}`;
    await api.post('/api/execute-sql').send({
      statements: [`INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://api.test.com', 'REST', '${uniqueName}')`]
    });

    const res = await api.post('/api/execute-sql').send({
      statements: [`SELECT * FROM ws_config WHERE service_name = '${uniqueName}'`]
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results[0].type).toBe('SELECT');
    expect(res.body.results[0].rows.length).toBe(1);
    expect(res.body.results[0].rows[0].service_name).toBe(uniqueName);
  });

  it('should execute multiple statements in a transaction', async () => {
    // Insert unique records and filter by them
    const tag = `TxTest-${Date.now()}`;
    const res = await api.post('/api/execute-sql').send({
      statements: [
        `INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://a.com', 'REST', '${tag}-A')`,
        `INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://b.com', 'REST', '${tag}-B')`,
        `SELECT * FROM ws_config WHERE service_name LIKE '${tag}%'`,
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results[2].rows.length).toBe(2);
  });

  it('should skip empty statements and comments', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['', '-- this is a comment', '   ']
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toHaveLength(0);
  });

  it('should reject DROP statements', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['DROP TABLE ws_config']
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should reject ALTER statements', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['ALTER TABLE ws_config ADD COLUMN foo TEXT']
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should reject CREATE statements', async () => {
    const res = await api.post('/api/execute-sql').send({
      statements: ['CREATE TABLE evil (id INT)']
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('should return 400 when statements is not an array', async () => {
    const res = await api.post('/api/execute-sql').send({ statements: 'SELECT 1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Provide/);
  });

  it('should return 400 when body is empty', async () => {
    const res = await api.post('/api/execute-sql').send({});
    expect(res.status).toBe(400);
  });
});

// ─── Verify ──────────────────────────────────────────

describe('GET /api/verify', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  it('should return all 6 config tables', async () => {
    const res = await api.get('/api/verify');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mode).toBe('sqlite');
    expect(res.body.data).toHaveProperty('ws_config');
    expect(res.body.data).toHaveProperty('ws_token_config');
    expect(res.body.data).toHaveProperty('ws_endpoint_config');
    expect(res.body.data).toHaveProperty('ws_response_definition');
    expect(res.body.data).toHaveProperty('ws_req_param_details');
    expect(res.body.data).toHaveProperty('tran_req_map');
    expect(res.body.counts).toBeDefined();
  });

  it('should return correct counts matching data lengths', async () => {
    // Counts and data arrays must be in sync — regardless of how many rows exist
    const res = await api.get('/api/verify');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Every count must match its corresponding data array length
    for (const [table, count] of Object.entries(res.body.counts)) {
      expect(res.body.data[table]).toHaveLength(count);
    }
  });
});

// ─── Get Table ───────────────────────────────────────

describe('GET /api/table/:name', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  it('should return data for valid table name', async () => {
    const res = await api.get('/api/table/ws_config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.table).toBe('ws_config');
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it('should reject invalid table name', async () => {
    const res = await api.get('/api/table/users');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid table/);
  });

  it('should reject SQL-injection-style table name', async () => {
    const res = await api.get('/api/table/ws_config;DROP TABLE ws_config');
    expect(res.status).toBe(400);
  });
});

// ─── Reset ───────────────────────────────────────────

describe('POST /api/reset', () => {
  it('should reset SQLite demo tables', async () => {
    // Insert some data
    const db = getDb();
    db.prepare("INSERT INTO ws_config (base_url, type, service_name) VALUES ('https://a.com', 'REST', 'A')").run();
    db.close();

    const res = await api.post('/api/reset');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mode).toBe('sqlite');

    // Verify data is cleared
    const db2 = getDb();
    const count = db2.prepare('SELECT COUNT(*) as c FROM ws_config').get().c;
    db2.close();
    expect(count).toBe(0);
  });
});

// ─── Saved Configurations CRUD ───────────────────────

describe('Saved Configurations API', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  it('POST /api/configs — should save a new config', async () => {
    const res = await api.post('/api/configs').send({
      name: 'Test Gateway',
      client: 'TestClient',
      config: { service: 'test', version: 1 }
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('GET /api/configs — should list saved configs', async () => {
    // Create a config first
    await api.post('/api/configs').send({
      name: 'ListTest',
      client: 'Client1',
      config: { test: true }
    });

    const res = await api.get('/api/configs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.configs.length).toBeGreaterThan(0);
    expect(res.body.configs[0]).toHaveProperty('name');
    expect(res.body.configs[0]).toHaveProperty('client');
    // Should NOT contain config_data in list view
    expect(res.body.configs[0]).not.toHaveProperty('config_data');
  });

  it('GET /api/configs/:id — should return a single config with parsed data', async () => {
    const { body: { id } } = await api.post('/api/configs').send({
      name: 'DetailTest',
      client: 'Client2',
      config: { key: 'value' }
    });

    const res = await api.get(`/api/configs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.name).toBe('DetailTest');
    expect(res.body.config.config_data).toEqual({ key: 'value' });
  });

  it('GET /api/configs/:id — should return 404 for non-existent id', async () => {
    const res = await api.get('/api/configs/99999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/configs/:id — should return 400 for invalid id', async () => {
    const res = await api.get('/api/configs/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid id/);
  });

  it('DELETE /api/configs/:id — should delete a config', async () => {
    const { body: { id } } = await api.post('/api/configs').send({
      name: 'DeleteTest',
      client: 'ClientDel',
      config: { temp: true }
    });

    const res = await api.delete(`/api/configs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it's gone
    const res2 = await api.get(`/api/configs/${id}`);
    expect(res2.status).toBe(404);
  });

  it('DELETE /api/configs/:id — should return 404 for non-existent id', async () => {
    const res = await api.delete('/api/configs/99999');
    expect(res.status).toBe(404);
  });

  it('POST /api/configs — should reject missing required fields', async () => {
    const res = await api.post('/api/configs').send({ name: 'OnlyName' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('POST /api/configs — should reject oversized name', async () => {
    const res = await api.post('/api/configs').send({
      name: 'x'.repeat(201),
      client: 'Test',
      config: {}
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });

  it('POST /api/configs — should reject oversized config data', async () => {
    const res = await api.post('/api/configs').send({
      name: 'Big Config',
      client: 'Test',
      config: 'x'.repeat(600000)
    });
    // Either 400 (app-level size check) or 413 (Express body-parser limit)
    expect([400, 413]).toContain(res.status);
  });
});

// ─── Saved DB Connections CRUD ───────────────────────

describe('Saved DB Connections API', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  const validConnection = {
    name: 'Test MSSQL',
    type: 'mssql',
    host: '10.5.70.5',
    port: 1440,
    database_name: 'TestDB',
    username: 'admin',
    password: 'secret123',
    options: {}
  };

  it('POST /api/db/connections — should save a connection', async () => {
    const res = await api.post('/api/db/connections').send(validConnection);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('GET /api/db/connections — should list connections without passwords', async () => {
    await api.post('/api/db/connections').send(validConnection);

    const res = await api.get('/api/db/connections');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.connections.length).toBeGreaterThan(0);
    // List endpoint should NOT expose password
    const conn = res.body.connections[0];
    expect(conn).not.toHaveProperty('password');
    expect(conn).toHaveProperty('name');
    expect(conn).toHaveProperty('type');
    expect(conn).toHaveProperty('host');
  });

  it('GET /api/db/connections/:id — should mask password', async () => {
    const { body: { id } } = await api.post('/api/db/connections').send(validConnection);

    const res = await api.get(`/api/db/connections/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.connection.password).toBe('••••••••');
    expect(res.body.connection.name).toBe('Test MSSQL');
  });

  it('GET /api/db/connections/:id — should return 404 for non-existent id', async () => {
    const res = await api.get('/api/db/connections/99999');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/db/connections/:id — should delete a connection', async () => {
    const { body: { id } } = await api.post('/api/db/connections').send(validConnection);

    const res = await api.delete(`/api/db/connections/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const res2 = await api.get(`/api/db/connections/${id}`);
    expect(res2.status).toBe(404);
  });

  it('POST /api/db/connections — should reject missing required fields', async () => {
    const res = await api.post('/api/db/connections').send({ name: 'NoHost' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('POST /api/db/connections — should reject unsupported DB type', async () => {
    const res = await api.post('/api/db/connections').send({
      ...validConnection,
      type: 'oracle'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported/);
  });

  it('POST /api/db/connections — should reject oversized inputs', async () => {
    const res = await api.post('/api/db/connections').send({
      ...validConnection,
      host: 'x'.repeat(256)
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });
});

// ─── DB Connection Management (no real DB) ───────────

describe('DB Connection Management', () => {
  it('GET /api/db/status — should show disconnected by default', async () => {
    const res = await api.get('/api/db/status');
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });

  it('POST /api/db/disconnect — should succeed even when already disconnected', async () => {
    const res = await api.post('/api/db/disconnect');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/db/test — should report not connected', async () => {
    const res = await api.get('/api/db/test');
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });

  it('POST /api/db/connect — should reject missing fields', async () => {
    const res = await api.post('/api/db/connect').send({ type: 'mssql' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('POST /api/db/connect — should reject unsupported type', async () => {
    const res = await api.post('/api/db/connect').send({
      type: 'oracle',
      host: 'localhost',
      database: 'test',
      user: 'admin'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported/);
  });

  it('POST /api/db/connect — should reject invalid port', async () => {
    const res = await api.post('/api/db/connect').send({
      type: 'mssql',
      host: 'localhost',
      port: 99999,
      database: 'test',
      user: 'admin'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Port must be/);
  });

  it('POST /api/db/connect — should reject port 0', async () => {
    const res = await api.post('/api/db/connect').send({
      type: 'mssql',
      host: 'localhost',
      port: 0,
      database: 'test',
      user: 'admin'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Port must be/);
  });

  it('POST /api/db/connect — should reject oversized host', async () => {
    const res = await api.post('/api/db/connect').send({
      type: 'mssql',
      host: 'x'.repeat(256),
      database: 'test',
      user: 'admin'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/);
  });
});

// ─── 404 Handler ─────────────────────────────────────

describe('404 Handler', () => {
  it('should return 404 JSON for unknown routes', async () => {
    const res = await api.get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Route not found/);
  });

  it('should include method and path in error', async () => {
    const res = await api.post('/api/unknown/route');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('POST');
    expect(res.body.error).toContain('/api/unknown/route');
  });
});
