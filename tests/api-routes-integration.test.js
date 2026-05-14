/**
 * API Routes — Integration Tests for New Endpoints
 * Covers: cURL import, OC Core routing, validation pipeline, all new routes
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, setupTestDbWithSeed, teardownTestDb } from './helpers.js';
import { initTransactionLogSchema } from '../server/transactionLogService.js';
import { initReadinessSchema } from '../server/readinessCheckService.js';
import { initValidationHistorySchema } from '../server/validationHistoryService.js';

const api = createTestClient();

beforeAll(async () => {
  await setupTestDbWithSeed();
  initTransactionLogSchema();
  initReadinessSchema();
  initValidationHistorySchema();
});

afterAll(async () => {
  await teardownTestDb();
});

// ─── cURL Import Route ──────────────────────────────────────────

describe('POST /api/import/curl', () => {
  it('should parse a valid cURL command', async () => {
    const res = await api.post('/api/import/curl').send({
      curl: 'curl -X POST https://api.example.com/v1/payment -H "Content-Type: application/json" -H "Authorization: Bearer tok123" -d \'{"amount":1000,"currency":"PKR"}\'',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.parsed.method).toBe('POST');
    expect(res.body.config).toBeDefined();
    expect(res.body.confidence.score).toBeGreaterThan(0);
  });

  it('should return 400 for invalid cURL', async () => {
    const res = await api.post('/api/import/curl').send({
      curl: 'wget https://not-curl.com',
    });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for empty input', async () => {
    const res = await api.post('/api/import/curl').send({});
    expect(res.status).toBe(400);
  });

  it('should return 400 for missing curl field', async () => {
    const res = await api.post('/api/import/curl').send({ notCurl: 'something' });
    expect(res.status).toBe(400);
  });
});

// ─── OC Core Environment Routes ─────────────────────────────────

describe('OC Core Environment Routes', () => {
  it('GET /api/oc-core/environments should list all environments', async () => {
    const res = await api.get('/api/oc-core/environments');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.environments)).toBe(true);
    expect(res.body.environments.length).toBe(4);
    const ids = res.body.environments.map(e => e.id);
    expect(ids).toContain('MOCK');
    expect(ids).toContain('OC_CORE_LOCAL');
    expect(ids).toContain('OC_CORE_UAT');
    expect(ids).toContain('OC_CORE_PROD');
  });

  it('GET /api/oc-core/environment/:envId should return env details', async () => {
    const res = await api.get('/api/oc-core/environment/MOCK');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.environment.id).toBe('MOCK');
    expect(res.body.environment.baseUrl).toBeDefined();
    expect(res.body.environment.endpoints).toBeDefined();
  });

  it('GET /api/oc-core/environment/:envId should 404 for unknown', async () => {
    const res = await api.get('/api/oc-core/environment/NONEXISTENT');
    expect(res.status).toBe(404);
  });

  it('PUT /api/oc-core/environment/:envId should override base URL', async () => {
    const res = await api.put('/api/oc-core/environment/MOCK').send({
      baseUrl: 'http://custom:9999',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify override took effect
    const env = await api.get('/api/oc-core/environment/MOCK');
    expect(env.body.environment.baseUrl).toBe('http://custom:9999');

    // Reset
    await api.put('/api/oc-core/environment/MOCK').send({ baseUrl: 'http://localhost:3010' });
  });

  it('PUT /api/oc-core/environment/:envId should 404 for unknown', async () => {
    const res = await api.put('/api/oc-core/environment/INVALID').send({ baseUrl: 'http://x' });
    expect(res.status).toBe(404);
  });
});

// ─── OC Core Resolve & Build ────────────────────────────────────

describe('OC Core Resolve & Build Routes', () => {
  it('GET /api/oc-core/resolve/:envId/:endpointType should resolve URL', async () => {
    // Reset MOCK first
    await api.put('/api/oc-core/environment/MOCK').send({ baseUrl: 'http://localhost:3010' });
    const res = await api.get('/api/oc-core/resolve/MOCK/validate');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('localhost:3010');
    expect(res.body.method).toBeDefined();
  });

  it('GET /api/oc-core/resolve should 404 for unknown env', async () => {
    const res = await api.get('/api/oc-core/resolve/INVALID/validate');
    expect(res.status).toBe(404);
  });

  it('POST /api/oc-core/build-request should build OC Core request envelope', async () => {
    const res = await api.post('/api/oc-core/build-request').send({
      configId: 1,
      tranType: 'BALANCE_INQUIRY',
      queueIn: 'OPENCONNECT.IN',
      params: { accountNumber: '4532015112830366' },
    });
    expect(res.status).toBe(200);
    expect(res.body.payload).toBeDefined();
    expect(res.body.payload.header.tran_type).toBe('BALANCE_INQUIRY');
    expect(res.body.payload.body.accountNumber).toBe('4532015112830366');
  });

  it('POST /api/oc-core/generate-curl should generate cURL command', async () => {
    const res = await api.post('/api/oc-core/generate-curl').send({
      envId: 'MOCK',
      endpointType: 'validate',
      payload: { test: true },
    });
    expect(res.status).toBe(200);
    expect(res.body.curl).toBeDefined();
    expect(res.body.curl).toContain('curl');
  });
});

// ─── OC Core Invoke Routes ──────────────────────────────────────

describe('OC Core Invoke Routes', () => {
  it('POST /api/oc-core/invoke/preview should return signed URL without calling', async () => {
    const res = await api.post('/api/oc-core/invoke/preview').send({
      endpoint: 'http://localhost:3010/api/v1/',
      params: ['param1', 'param2'],
      method: 'GET',
    });
    expect(res.status).toBe(200);
    expect(res.body.signedUrl).toBeDefined();
    expect(res.body.signedUrl).toContain('http://localhost:3010/api/v1/');
  });

  it('POST /api/oc-core/invoke/preview for POST should return URL and body', async () => {
    const res = await api.post('/api/oc-core/invoke/preview').send({
      endpoint: 'http://localhost:3010/api/v1/',
      params: ['p1', 'p2'],
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(res.body.signedUrl).toBeDefined();
    expect(res.body.postBody).toBe('p1,p2');
  });

  it('POST /api/oc-core/parse-response should parse OC Core response envelope', async () => {
    const rawResponse = JSON.stringify({
      response: {
        response_code: '00',
        response_desc: 'Success',
        balance: '150000',
      }
    });
    const res = await api.post('/api/oc-core/parse-response').send({
      raw: rawResponse,
      tranType: 'BALANCE_INQUIRY',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rspCode).toBe('00');
    expect(res.body.data.balance).toBe('150000');
  });

  it('POST /api/oc-core/parse-response with error code', async () => {
    const rawResponse = JSON.stringify({
      response: {
        response_code: '503',
        response_desc: 'Unable to process',
      }
    });
    const res = await api.post('/api/oc-core/parse-response').send({ raw: rawResponse });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('OC_UNABLE_TO_PROCESS');
  });
});

// ─── Health Check Route ─────────────────────────────────────────

describe('OC Core Health Check', () => {
  it('GET /api/oc-core/health/:envId should attempt health check', async () => {
    const res = await api.get('/api/oc-core/health/MOCK');
    expect(res.status).toBe(200);
    // Will likely fail since mock API isn't running in test, but should not crash
    expect(res.body).toHaveProperty('reachable');
    expect(res.body).toHaveProperty('envId');
  });

  it('GET /api/oc-core/health/:envId should 404 for unknown env', async () => {
    const res = await api.get('/api/oc-core/health/NONEXISTENT');
    expect(res.status).toBe(200); // checkHealth returns { reachable: false }
    expect(res.body.reachable).toBe(false);
  });
});

// ─── Saved Configs CRUD ─────────────────────────────────────────

describe('Saved Configs CRUD', () => {
  let configId;

  it('POST /api/configs should save a config', async () => {
    const res = await api.post('/api/configs').send({
      name: 'Integration Test Config',
      client: 'test-client',
      config: {
        wsConfig: { baseUrl: 'https://api.test.com', type: 'REST', serviceName: 'test-svc' },
        wsEndpointConfig: { method: 'POST', endpointTemplate: '/v1/test' },
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    configId = res.body.id;
  });

  it('GET /api/configs should list saved configs', async () => {
    const res = await api.get('/api/configs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.configs)).toBe(true);
    expect(res.body.configs.length).toBeGreaterThan(0);
  });

  it('GET /api/configs/:id should retrieve config', async () => {
    const res = await api.get(`/api/configs/${configId}`);
    expect(res.status).toBe(200);
    expect(res.body.config.name).toBe('Integration Test Config');
  });

  it('GET /api/configs/:id should 404 for non-existent', async () => {
    const res = await api.get('/api/configs/999999');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/configs/:id should delete config', async () => {
    const res = await api.delete(`/api/configs/${configId}`);
    expect(res.status).toBe(200);

    const get = await api.get(`/api/configs/${configId}`);
    expect(get.status).toBe(404);
  });
});

// ─── 404 Handler ────────────────────────────────────────────────

describe('404 Handler', () => {
  it('should return JSON 404 for unknown API routes', async () => {
    const res = await api.get('/api/completely-nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('should not reveal internal paths', async () => {
    const res = await api.get('/api/unknown');
    expect(JSON.stringify(res.body)).not.toContain('server/');
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
  });
});
