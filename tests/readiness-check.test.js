/**
 * Readiness Check Service — Comprehensive Tests
 * Covers: schema init, check execution, scoring, categories, history, edge cases
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, setupTestDbWithSeed, teardownTestDb, getDb } from './helpers.js';
import {
  initReadinessSchema,
  runReadinessCheck,
  getReadinessHistory,
} from '../server/readinessCheckService.js';

const api = createTestClient();

beforeAll(async () => {
  await setupTestDbWithSeed();
  initReadinessSchema();
});

afterAll(async () => {
  await teardownTestDb();
});

// ─── Schema ─────────────────────────────────────────────────────

describe('initReadinessSchema', () => {
  it('should create readiness_check_history table', () => {
    const db = getDb();
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='readiness_check_history'").get();
    db.close();
    expect(table).toBeTruthy();
    expect(table.name).toBe('readiness_check_history');
  });

  it('should be idempotent', () => {
    expect(() => initReadinessSchema()).not.toThrow();
  });
});

// ─── runReadinessCheck ──────────────────────────────────────────

describe('runReadinessCheck', () => {
  it('should return a check result with all required fields', async () => {
    const result = await runReadinessCheck('Test Config');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('passedChecks');
    expect(result).toHaveProperty('totalChecks');
    expect(result).toHaveProperty('failedChecks');
    expect(result).toHaveProperty('readiness');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('byCategory');
    expect(result).toHaveProperty('criticalFailures');
    expect(result).toHaveProperty('highFailures');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('checkedAt');
  });

  it('should have score between 0 and 100', async () => {
    const result = await runReadinessCheck();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should return all 21 check results', async () => {
    const result = await runReadinessCheck();
    expect(result.totalChecks).toBeGreaterThanOrEqual(21);
    expect(result.results.length).toBe(result.totalChecks);
  });

  it('should classify readiness correctly', async () => {
    const result = await runReadinessCheck();
    const validLabels = ['production-ready', 'nearly-ready', 'needs-work', 'not-ready'];
    expect(validLabels).toContain(result.readiness);
  });

  it('each check result should have required properties', async () => {
    const result = await runReadinessCheck();
    for (const check of result.results) {
      expect(check).toHaveProperty('id');
      expect(check).toHaveProperty('category');
      expect(check).toHaveProperty('severity');
      expect(check).toHaveProperty('title');
      expect(check).toHaveProperty('passed');
      expect(check).toHaveProperty('detail');
      expect(typeof check.passed).toBe('boolean');
    }
  });

  it('should group results by category', async () => {
    const result = await runReadinessCheck();
    expect(result.byCategory).toBeDefined();
    const categories = Object.keys(result.byCategory);
    expect(categories).toContain('Core Config');
    expect(categories).toContain('Response Mapping');
  });

  it('critical failures should only contain critical severity', async () => {
    const result = await runReadinessCheck();
    for (const f of result.criticalFailures) {
      expect(f.severity).toBe('critical');
      expect(f.passed).toBe(false);
    }
  });

  it('high failures should only contain high severity', async () => {
    const result = await runReadinessCheck();
    for (const f of result.highFailures) {
      expect(f.severity).toBe('high');
      expect(f.passed).toBe(false);
    }
  });

  it('should pass WS_CONFIG_EXISTS with seeded data', async () => {
    // Ensure at least one ws_config row exists (may be cleared by other test suites)
    const db = getDb();
    try {
      db.prepare("INSERT OR IGNORE INTO ws_config (id, base_url, type, service_name) VALUES (9999, 'https://test.com', 'REST', 'readiness-test')").run();
    } finally { db.close(); }
    const result = await runReadinessCheck();
    const check = result.results.find(r => r.id === 'WS_CONFIG_EXISTS');
    expect(check.passed).toBe(true);
  });

  it('should pass ENDPOINT_EXISTS with seeded data', async () => {
    // Ensure at least one ws_endpoint_config row exists
    const db = getDb();
    try {
      db.prepare("INSERT OR IGNORE INTO ws_config (id, base_url, type, service_name) VALUES (9999, 'https://test.com', 'REST', 'readiness-test')").run();
      db.prepare("INSERT OR IGNORE INTO ws_endpoint_config (id, config_id, method, endpoint_template) VALUES (9999, 9999, 'POST', '/test')").run();
    } finally { db.close(); }
    const result = await runReadinessCheck();
    const check = result.results.find(r => r.id === 'ENDPOINT_EXISTS');
    expect(check.passed).toBe(true);
  });

  it('should save result to history', async () => {
    const before = getReadinessHistory(1000);
    await runReadinessCheck('HistoryTest');
    const after = getReadinessHistory(1000);
    expect(after.length).toBeGreaterThan(before.length);
  });
});

// ─── Check Severity Coverage ────────────────────────────────────

describe('Check severity weights', () => {
  it('should contain checks of all severity levels', async () => {
    const result = await runReadinessCheck();
    const severities = [...new Set(result.results.map(r => r.severity))];
    expect(severities).toContain('critical');
    expect(severities).toContain('high');
    expect(severities).toContain('warning');
    expect(severities).toContain('low');
  });

  it('passedChecks + failedChecks should equal totalChecks', async () => {
    const result = await runReadinessCheck();
    expect(result.passedChecks + result.failedChecks).toBe(result.totalChecks);
  });
});

// ─── getReadinessHistory ────────────────────────────────────────

describe('getReadinessHistory', () => {
  it('should return history entries', () => {
    const history = getReadinessHistory(10);
    expect(Array.isArray(history)).toBe(true);
  });

  it('should respect limit parameter', () => {
    const history = getReadinessHistory(2);
    expect(history.length).toBeLessThanOrEqual(2);
  });

  it('should cap limit at 100', () => {
    const history = getReadinessHistory(999);
    expect(history.length).toBeLessThanOrEqual(100);
  });

  it('history entries should have required fields', () => {
    const history = getReadinessHistory(1);
    if (history.length > 0) {
      expect(history[0]).toHaveProperty('id');
      expect(history[0]).toHaveProperty('config_name');
      expect(history[0]).toHaveProperty('score');
      expect(history[0]).toHaveProperty('total_checks');
      expect(history[0]).toHaveProperty('passed_checks');
      expect(history[0]).toHaveProperty('checked_at');
    }
  });
});

// ─── API Routes ─────────────────────────────────────────────────

describe('Readiness Check API Routes', () => {
  it('POST /api/config/readiness-check should run checks', async () => {
    const res = await api.post('/api/config/readiness-check').send({ configName: 'API Test' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.totalChecks).toBeGreaterThanOrEqual(21);
  });

  it('GET /api/config/readiness-history should return history', async () => {
    const res = await api.get('/api/config/readiness-history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.history)).toBe(true);
  });
});
