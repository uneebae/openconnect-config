/**
 * Validation History Service — Comprehensive Tests
 * Covers: schema init, save, query, detail retrieval, filtering, masking, edge cases
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, setupTestDbWithSeed, teardownTestDb, getDb } from './helpers.js';
import {
  initValidationHistorySchema,
  saveValidationResult,
  getValidationHistory,
  getValidationDetail,
  getAllValidationHistory,
} from '../server/validationHistoryService.js';

const api = createTestClient();

beforeAll(async () => {
  await setupTestDbWithSeed();
  initValidationHistorySchema();
});

afterAll(async () => {
  await teardownTestDb();
});

// ─── Schema ─────────────────────────────────────────────────────

describe('initValidationHistorySchema', () => {
  it('should create api_validation_history table', () => {
    const db = getDb();
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_validation_history'").get();
    db.close();
    expect(table).toBeTruthy();
  });

  it('should be idempotent', () => {
    expect(() => initValidationHistorySchema()).not.toThrow();
  });
});

// ─── saveValidationResult ───────────────────────────────────────

describe('saveValidationResult', () => {
  it('should save a successful validation result', () => {
    const r = saveValidationResult({
      configId: 1,
      environment: 'mock',
      targetUrl: 'http://localhost:3010/api/v1/validate',
      method: 'POST',
      requestHeaders: { 'Content-Type': 'application/json', 'Authorization': 'Bearer secret' },
      requestPayload: { accountNumber: '1234', password: 'topsecret123' },
      authType: 'BEARER',
      authStatus: 'configured',
      rawResponse: { responseCode: '000', data: { balance: '50000' } },
      httpStatus: 200,
      externalCode: '000',
      mappedCode: '00',
      mappedDescription: 'Success',
      extractedFields: { balance: '50000' },
      missingFields: [],
      success: true,
      stages: [{ name: 'configLoad', status: 'success', ms: 5 }],
      timing: { db_load_ms: 5, auth_ms: 1, external_api_ms: 150, mapping_ms: 2, total_ms: 160 },
    });
    expect(r.id).toBeDefined();
    expect(Number(r.id)).toBeGreaterThan(0);
  });

  it('should save a failed validation result', () => {
    const r = saveValidationResult({
      configId: 1,
      environment: 'mock',
      success: false,
      errorCode: 'API_TIMEOUT',
      errorMessage: 'Timeout after 30000ms',
      stages: [],
      timing: { total_ms: 30000 },
    });
    expect(r.id).toBeDefined();
  });

  it('should mask sensitive data before storage', () => {
    const id = saveValidationResult({
      configId: 1,
      environment: 'mock',
      requestHeaders: { Authorization: 'Bearer super-secret-token-1234' },
      requestPayload: { password: 'MyPassword123' },
      rawResponse: { token: 'refresh-token-xyz-1234' },
      success: true,
      stages: [],
      timing: {},
    }).id;

    const detail = getValidationDetail(Number(id));
    // Headers should be masked
    expect(detail.request_headers.Authorization).toContain('••••••••');
    // Payload should be masked
    expect(detail.request_payload.password).toContain('••••••••');
  });
});

// ─── getValidationHistory ───────────────────────────────────────

describe('getValidationHistory', () => {
  it('should return history for configId', () => {
    const history = getValidationHistory(1);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  it('should filter by success', () => {
    const successes = getValidationHistory(1, { success: true });
    successes.forEach(r => expect(r.success).toBe(1));
  });

  it('should filter by environment', () => {
    const results = getValidationHistory(1, { environment: 'mock' });
    results.forEach(r => expect(r.environment).toBe('mock'));
  });

  it('should respect limit and offset', () => {
    const page1 = getValidationHistory(1, { limit: 1, offset: 0 });
    const page2 = getValidationHistory(1, { limit: 1, offset: 1 });
    if (page1.length > 0 && page2.length > 0) {
      expect(page1[0].id).not.toBe(page2[0].id);
    }
  });

  it('should return empty array for non-existent configId', () => {
    const history = getValidationHistory(9999);
    expect(history).toEqual([]);
  });
});

// ─── getValidationDetail ────────────────────────────────────────

describe('getValidationDetail', () => {
  it('should return full detail with parsed JSON fields', () => {
    const history = getValidationHistory(1, { limit: 1 });
    if (history.length === 0) return;
    const detail = getValidationDetail(history[0].id);
    expect(detail).not.toBeNull();
    expect(detail).toHaveProperty('config_id');
    expect(detail).toHaveProperty('environment');
    expect(detail).toHaveProperty('created_at');
    expect(typeof detail.success).toBe('boolean');
  });

  it('should parse JSON fields into objects', () => {
    const history = getValidationHistory(1, { limit: 1 });
    if (history.length === 0) return;
    const detail = getValidationDetail(history[0].id);
    if (detail.stages) {
      expect(typeof detail.stages).toBe('object'); // parsed from JSON string
    }
  });

  it('should return null for non-existent historyId', () => {
    const detail = getValidationDetail(999999);
    expect(detail).toBeNull();
  });
});

// ─── getAllValidationHistory ─────────────────────────────────────

describe('getAllValidationHistory', () => {
  it('should return all history regardless of configId', () => {
    const all = getAllValidationHistory();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  it('should filter by success', () => {
    const failed = getAllValidationHistory({ success: false });
    failed.forEach(r => expect(r.success).toBe(0));
  });

  it('should respect limit', () => {
    const limited = getAllValidationHistory({ limit: 1 });
    expect(limited.length).toBeLessThanOrEqual(1);
  });
});
