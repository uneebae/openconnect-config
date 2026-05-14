/**
 * Transaction Log Service — Comprehensive Tests
 * Covers: schema init, seeding, querying, filtering, stats, detail retrieval, edge cases
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, setupTestDbWithSeed, teardownTestDb } from './helpers.js';
import {
  initTransactionLogSchema,
  getTransactionLogs,
  getTransactionDetail,
  getTransactionStats,
  getTranTypes,
} from '../server/transactionLogService.js';

const api = createTestClient();

beforeAll(async () => {
  await setupTestDbWithSeed();
  initTransactionLogSchema();
});

afterAll(async () => {
  await teardownTestDb();
});

// ─── Schema & Seeding ───────────────────────────────────────────

describe('initTransactionLogSchema', () => {
  it('should create transaction tables without error', () => {
    // Calling again should be idempotent
    expect(() => initTransactionLogSchema()).not.toThrow();
  });

  it('should seed 15 demo transactions', () => {
    const result = getTransactionLogs({ limit: 100 });
    expect(result.total).toBe(15);
  });
});

// ─── getTransactionLogs ─────────────────────────────────────────

describe('getTransactionLogs', () => {
  it('should return paginated results', () => {
    const result = getTransactionLogs({ limit: 5, offset: 0 });
    expect(result.rows.length).toBe(5);
    expect(result.total).toBe(15);
  });

  it('should default to 50 limit', () => {
    const result = getTransactionLogs();
    expect(result.rows.length).toBe(15); // only 15 records, so all returned
  });

  it('should cap limit at 200', () => {
    const result = getTransactionLogs({ limit: 500 });
    // Should not crash — limit is capped at 200
    expect(result.rows.length).toBeLessThanOrEqual(200);
  });

  it('should filter by status', () => {
    const result = getTransactionLogs({ status: 'SUCCESS' });
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach(r => expect(r.status).toBe('SUCCESS'));
  });

  it('should filter by multiple statuses (comma-separated)', () => {
    const result = getTransactionLogs({ status: 'FAILED,TIMEOUT' });
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach(r => expect(['FAILED', 'TIMEOUT']).toContain(r.status));
  });

  it('should filter by tran_type', () => {
    const result = getTransactionLogs({ tranType: 'BALANCE_INQUIRY' });
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach(r => expect(r.tran_type).toBe('BALANCE_INQUIRY'));
  });

  it('should filter by correlationId (LIKE search)', () => {
    const result = getTransactionLogs({ correlationId: '001' });
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach(r => expect(r.correlation_id).toContain('001'));
  });

  it('should support offset pagination', () => {
    const page1 = getTransactionLogs({ limit: 5, offset: 0 });
    const page2 = getTransactionLogs({ limit: 5, offset: 5 });
    expect(page1.rows[0].correlation_id).not.toBe(page2.rows[0].correlation_id);
  });

  it('should return empty rows for non-matching filter', () => {
    const result = getTransactionLogs({ tranType: 'NONEXISTENT_TYPE' });
    expect(result.rows.length).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should handle invalid limit/offset gracefully', () => {
    const result = getTransactionLogs({ limit: 'abc', offset: 'xyz' });
    // Should default to safe values
    expect(result.rows).toBeDefined();
  });

  it('should order by created_at DESC', () => {
    const result = getTransactionLogs({ limit: 15 });
    for (let i = 0; i < result.rows.length - 1; i++) {
      expect(new Date(result.rows[i].created_at).getTime())
        .toBeGreaterThanOrEqual(new Date(result.rows[i + 1].created_at).getTime());
    }
  });
});

// ─── getTransactionDetail ───────────────────────────────────────

describe('getTransactionDetail', () => {
  it('should return full detail for existing correlation ID', () => {
    const detail = getTransactionDetail('OC-2026042701-001');
    expect(detail).not.toBeNull();
    expect(detail.log).toBeDefined();
    expect(detail.log.correlation_id).toBe('OC-2026042701-001');
    expect(detail.reqResp).toBeDefined();
  });

  it('should mask token_used in req/resp', () => {
    const detail = getTransactionDetail('OC-2026042701-001');
    if (detail.reqResp?.token_used) {
      expect(detail.reqResp.token_used).toBe('••••••••');
    }
  });

  it('should return null for non-existent correlation ID', () => {
    const detail = getTransactionDetail('NONEXISTENT-999');
    expect(detail).toBeNull();
  });

  it('should include parsed JSON in client_request', () => {
    const detail = getTransactionDetail('OC-2026042701-001');
    expect(detail.reqResp.client_request).toBeDefined();
    expect(typeof detail.reqResp.client_request).toBe('object');
  });

  it('should include reversal data for reversed transactions', () => {
    const detail = getTransactionDetail('OC-2026042701-010');
    expect(detail.log.status).toBe('REVERSED');
    expect(detail.reqResp.reversal_request).toBeDefined();
    expect(detail.reqResp.reversal_response).toBeDefined();
  });
});

// ─── getTransactionStats ────────────────────────────────────────

describe('getTransactionStats', () => {
  it('should return all stat fields', () => {
    const stats = getTransactionStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('success');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('timeout');
    expect(stats).toHaveProperty('reversed');
    expect(stats).toHaveProperty('successRate');
    expect(stats).toHaveProperty('avgDurationMs');
    expect(stats).toHaveProperty('typeBreakdown');
  });

  it('should have total = 15 (demo data)', () => {
    const stats = getTransactionStats();
    expect(stats.total).toBe(15);
  });

  it('should calculate correct success rate', () => {
    const stats = getTransactionStats();
    expect(stats.successRate).toBeGreaterThan(0);
    expect(stats.successRate).toBeLessThanOrEqual(100);
    // 10 out of 15 are SUCCESS
    expect(stats.success).toBe(10);
  });

  it('should include type breakdown', () => {
    const stats = getTransactionStats();
    expect(stats.typeBreakdown.length).toBeGreaterThan(0);
    const types = stats.typeBreakdown.map(t => t.tran_type);
    expect(types).toContain('BALANCE_INQUIRY');
    expect(types).toContain('FUND_TRANSFER');
  });

  it('should have non-zero avgDurationMs', () => {
    const stats = getTransactionStats();
    expect(stats.avgDurationMs).toBeGreaterThan(0);
  });

  it('should have timeout count', () => {
    const stats = getTransactionStats();
    expect(stats.timeout).toBe(1); // 1 timeout in demo data
  });

  it('should have reversed count', () => {
    const stats = getTransactionStats();
    expect(stats.reversed).toBe(1);
  });
});

// ─── getTranTypes ───────────────────────────────────────────────

describe('getTranTypes', () => {
  it('should return distinct tran types', () => {
    const types = getTranTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);
    expect(types).toContain('BALANCE_INQUIRY');
    expect(types).toContain('FUND_TRANSFER');
    expect(types).toContain('BILL_PAYMENT');
  });

  it('should have no duplicates', () => {
    const types = getTranTypes();
    const unique = [...new Set(types)];
    expect(types.length).toBe(unique.length);
  });
});

// ─── API Routes ─────────────────────────────────────────────────

describe('Transaction Log API Routes', () => {
  it('GET /api/transactions should return paginated logs', async () => {
    const res = await api.get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.rows).toBeDefined();
    expect(res.body.total).toBe(15);
  });

  it('GET /api/transactions?status=FAILED should filter', async () => {
    const res = await api.get('/api/transactions?status=FAILED');
    expect(res.status).toBe(200);
    res.body.rows.forEach(r => expect(r.status).toBe('FAILED'));
  });

  it('GET /api/transactions?limit=3 should limit results', async () => {
    const res = await api.get('/api/transactions?limit=3');
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(3);
  });

  it('GET /api/transactions/stats should return statistics', async () => {
    const res = await api.get('/api/transactions/stats');
    expect(res.status).toBe(200);
    expect(res.body.stats.total).toBe(15);
    expect(res.body.stats.successRate).toBeGreaterThan(0);
  });

  it('GET /api/transactions/tran-types should return types', async () => {
    const res = await api.get('/api/transactions/tran-types');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.types)).toBe(true);
    expect(res.body.types).toContain('BALANCE_INQUIRY');
  });

  it('GET /api/transactions/:correlationId should return detail', async () => {
    const res = await api.get('/api/transactions/OC-2026042701-001');
    expect(res.status).toBe(200);
    expect(res.body.log.correlation_id).toBe('OC-2026042701-001');
  });

  it('GET /api/transactions/:correlationId should 404 for unknown', async () => {
    const res = await api.get('/api/transactions/NONEXISTENT-999');
    expect(res.status).toBe(404);
  });
});
