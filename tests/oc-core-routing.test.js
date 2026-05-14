/**
 * OC Core Routing Service — Comprehensive Tests
 * Covers: environment listing, resolution, overrides, health checks, request building, cURL generation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getEnvironments,
  getEnvironment,
  setEnvironmentOverride,
  resolveEndpoint,
  checkHealth,
  buildOcCoreRequest,
  generateOcCoreCurl,
} from '../server/ocCoreRoutingService.js';

// ─── getEnvironments ────────────────────────────────────────────

describe('getEnvironments', () => {
  it('should return all 4 environments', () => {
    const envs = getEnvironments();
    expect(envs.length).toBe(4);
    const ids = envs.map(e => e.id);
    expect(ids).toContain('MOCK');
    expect(ids).toContain('OC_CORE_LOCAL');
    expect(ids).toContain('OC_CORE_UAT');
    expect(ids).toContain('OC_CORE_PROD');
  });

  it('should return required fields for each environment', () => {
    const envs = getEnvironments();
    for (const env of envs) {
      expect(env).toHaveProperty('id');
      expect(env).toHaveProperty('label');
      expect(env).toHaveProperty('baseUrl');
      expect(env).toHaveProperty('color');
      expect(env).toHaveProperty('endpoints');
      expect(Array.isArray(env.endpoints)).toBe(true);
    }
  });

  it('MOCK should not be in ocCoreMode', () => {
    const envs = getEnvironments();
    const mock = envs.find(e => e.id === 'MOCK');
    expect(mock.ocCoreMode).toBe(false);
  });

  it('OC_CORE_PROD should be readOnly', () => {
    const envs = getEnvironments();
    const prod = envs.find(e => e.id === 'OC_CORE_PROD');
    expect(prod.readOnly).toBe(true);
  });
});

// ─── getEnvironment ─────────────────────────────────────────────

describe('getEnvironment', () => {
  it('should return full config for valid envId', () => {
    const env = getEnvironment('MOCK');
    expect(env).not.toBeNull();
    expect(env.id).toBe('MOCK');
    expect(env.baseUrl).toContain('localhost:3010');
    expect(env.endpoints).toHaveProperty('validate');
    expect(env.endpoints).toHaveProperty('healthCheck');
  });

  it('should return null for unknown envId', () => {
    const env = getEnvironment('NONEXISTENT');
    expect(env).toBeNull();
  });

  it('should return OC Core endpoints for LOCAL', () => {
    const env = getEnvironment('OC_CORE_LOCAL');
    expect(env.endpoints.validate).toBe('/oc/ws/validate');
    expect(env.endpoints.tokenRefresh).toBe('/oc/token/refresh');
    expect(env.ocCoreMode).toBe(true);
  });

  it('should include headers', () => {
    const env = getEnvironment('OC_CORE_UAT');
    expect(env.headers['Content-Type']).toBe('application/json');
    expect(env.headers['X-OC-Env']).toBe('uat');
  });
});

// ─── setEnvironmentOverride ─────────────────────────────────────

describe('setEnvironmentOverride', () => {
  it('should allow overriding baseUrl', () => {
    const result = setEnvironmentOverride('MOCK', { baseUrl: 'http://custom:9999' });
    expect(result).toBe(true);
    const env = getEnvironment('MOCK');
    expect(env.baseUrl).toBe('http://custom:9999');
    // Reset
    setEnvironmentOverride('MOCK', { baseUrl: 'http://localhost:3010' });
  });

  it('should return false for unknown envId', () => {
    const result = setEnvironmentOverride('INVALID', { baseUrl: 'http://x' });
    expect(result).toBe(false);
  });

  it('should only accept allowed override keys (baseUrl, endpoints)', () => {
    const env1 = getEnvironment('OC_CORE_LOCAL');
    const origLabel = env1.label;
    setEnvironmentOverride('OC_CORE_LOCAL', { label: 'HACKED', baseUrl: 'http://custom' });
    const env2 = getEnvironment('OC_CORE_LOCAL');
    expect(env2.label).toBe(origLabel); // label should NOT change
    expect(env2.baseUrl).toBe('http://custom');
    // Reset
    setEnvironmentOverride('OC_CORE_LOCAL', { baseUrl: 'http://localhost:8080' });
  });

  it('should merge endpoint overrides', () => {
    setEnvironmentOverride('MOCK', { endpoints: { custom: '/api/custom' } });
    const env = getEnvironment('MOCK');
    expect(env.endpoints.custom).toBe('/api/custom');
    expect(env.endpoints.validate).toBeDefined(); // original still there
    // Reset
    setEnvironmentOverride('MOCK', { baseUrl: 'http://localhost:3010' });
  });
});

// ─── resolveEndpoint ────────────────────────────────────────────

describe('resolveEndpoint', () => {
  it('should resolve full URL for MOCK validate', () => {
    // Ensure default base
    setEnvironmentOverride('MOCK', { baseUrl: 'http://localhost:3010' });
    const r = resolveEndpoint('MOCK', 'validate');
    expect(r).not.toBeNull();
    expect(r.url).toBe('http://localhost:3010/api/v1/validate');
    expect(r.method).toBe('POST');
    expect(r.envId).toBe('MOCK');
  });

  it('should use GET method for healthCheck', () => {
    const r = resolveEndpoint('OC_CORE_LOCAL', 'healthCheck');
    expect(r.method).toBe('GET');
  });

  it('should return null for unknown envId', () => {
    expect(resolveEndpoint('INVALID', 'validate')).toBeNull();
  });

  it('should return null for unknown endpoint type', () => {
    expect(resolveEndpoint('MOCK', 'nonexistent')).toBeNull();
  });

  it('should include headers from environment', () => {
    const r = resolveEndpoint('OC_CORE_UAT', 'submit');
    expect(r.headers['X-OC-Env']).toBe('uat');
    expect(r.headers['X-OC-Source']).toBe('config-platform');
  });
});

// ─── buildOcCoreRequest ─────────────────────────────────────────

describe('buildOcCoreRequest', () => {
  it('should build a request with header and body', () => {
    const req = buildOcCoreRequest({
      configId: 1,
      tranType: 'BALANCE_INQUIRY',
      queueIn: 'OPENCONNECT.IN',
      queueType: 'REST',
      hostId: '1',
      fromIp: '192.168.1.1',
      params: { accountNumber: '1234567890' },
    });

    expect(req.header.tran_type).toBe('BALANCE_INQUIRY');
    expect(req.header.queue_in).toBe('OPENCONNECT.IN');
    expect(req.header.queue_type).toBe('REST');
    expect(req.header.host_id).toBe('1');
    expect(req.header.from_ip).toBe('192.168.1.1');
    expect(req.header.timestamp).toBeTruthy();
    expect(req.body.config_id).toBe(1);
    expect(req.body.accountNumber).toBe('1234567890');
  });

  it('should use defaults when optional fields are missing', () => {
    const req = buildOcCoreRequest({ configId: 5, params: {} });
    expect(req.header.tran_type).toBe('BALANCE_INQUIRY');
    expect(req.header.queue_in).toBe('WS_QUEUE');
    expect(req.header.queue_type).toBe('REST');
    expect(req.header.from_ip).toBe('127.0.0.1');
  });

  it('should include all params in body', () => {
    const req = buildOcCoreRequest({
      configId: 1,
      params: { a: 1, b: 'test', c: true },
    });
    expect(req.body.a).toBe(1);
    expect(req.body.b).toBe('test');
    expect(req.body.c).toBe(true);
  });
});

// ─── generateOcCoreCurl ─────────────────────────────────────────

describe('generateOcCoreCurl', () => {
  it('should generate a valid cURL command', () => {
    // Reset MOCK
    setEnvironmentOverride('MOCK', { baseUrl: 'http://localhost:3010' });
    const curl = generateOcCoreCurl('MOCK', 'validate', { test: true });
    expect(curl).toBeTruthy();
    expect(curl).toContain('curl');
    expect(curl).toContain('http://localhost:3010/api/v1/validate');
    expect(curl).toContain('-H');
  });

  it('should return null for unknown environment', () => {
    expect(generateOcCoreCurl('INVALID', 'validate', {})).toBeNull();
  });

  it('should return null for unknown endpoint', () => {
    expect(generateOcCoreCurl('MOCK', 'nonexistent', {})).toBeNull();
  });

  it('should include payload in -d flag', () => {
    const curl = generateOcCoreCurl('MOCK', 'submit', { amount: '1000' });
    expect(curl).toContain('amount');
  });
});

// ─── checkHealth (mocked fetch) ─────────────────────────────────

describe('checkHealth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    setEnvironmentOverride('MOCK', { baseUrl: 'http://localhost:3010' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return reachable=true on successful health check', async () => {
    fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ status: 'ok' }),
    });

    const r = await checkHealth('MOCK');
    expect(r.reachable).toBe(true);
    expect(r.httpStatus).toBe(200);
    expect(r.envId).toBe('MOCK');
    expect(r.elapsed_ms).toBeGreaterThanOrEqual(0);
  });

  it('should return reachable=false on timeout', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    fetch.mockRejectedValueOnce(abortError);

    const r = await checkHealth('MOCK');
    expect(r.reachable).toBe(false);
    expect(r.error).toContain('timed out');
  });

  it('should return reachable=false on connection error', async () => {
    fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const r = await checkHealth('MOCK');
    expect(r.reachable).toBe(false);
    expect(r.error).toBe('ECONNREFUSED');
  });

  it('should return error for unknown environment', async () => {
    const r = await checkHealth('NONEXISTENT');
    expect(r.reachable).toBe(false);
    expect(r.error).toMatch(/unknown/i);
  });
});
