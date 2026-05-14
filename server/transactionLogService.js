/**
 * transactionLogService.js
 * Manages the transactions_log and transactions_log_req_resp tables.
 * Provides seed demo data for standalone / SQLite demo mode.
 */

import { getDb } from './db.js';
import { maskSensitiveFields, maskHeaders } from './securityMaskingService.js';

// ─── Schema Init ─────────────────────────────────────────────────────────────

export function initTransactionLogSchema() {
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions_log (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        correlation_id        TEXT NOT NULL,
        tran_type             TEXT,
        queue_in              TEXT,
        amount                TEXT,
        identifier            TEXT,
        status                TEXT DEFAULT 'PENDING',
        client_response_code  TEXT,
        external_response_code TEXT,
        duration_ms           INTEGER,
        error_reason          TEXT,
        from_ip               TEXT,
        host_id               INTEGER,
        created_at            TEXT DEFAULT (datetime('now')),
        updated_at            TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS transactions_log_req_resp (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        correlation_id    TEXT NOT NULL,
        tran_log_id       INTEGER,
        client_request    TEXT,
        client_response   TEXT,
        external_request  TEXT,
        external_response TEXT,
        reversal_request  TEXT,
        reversal_response TEXT,
        token_used        TEXT,
        created_at        TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (tran_log_id) REFERENCES transactions_log(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tran_log_correlation
        ON transactions_log(correlation_id);
      CREATE INDEX IF NOT EXISTS idx_tran_log_created
        ON transactions_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_tran_log_status
        ON transactions_log(status);
      CREATE INDEX IF NOT EXISTS idx_tran_rr_correlation
        ON transactions_log_req_resp(correlation_id);
    `);
    seedTransactionDemoData(db);
  } finally {
    db.close();
  }
}

// ─── Demo Seed Data ───────────────────────────────────────────────────────────

function seedTransactionDemoData(db) {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM transactions_log').get();
  if (existing.cnt > 0) return; // Already seeded

  const now = new Date();
  const transactions = [
    { corr: 'OC-2026042701-001', type: 'BALANCE_INQUIRY', queue: 'OPENCONNECT.IN', amount: '0.00', identifier: '4532015112830366', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 312 },
    { corr: 'OC-2026042701-002', type: 'FUND_TRANSFER',   queue: 'OPENCONNECT.IN', amount: '15000.00', identifier: '4532015112830366', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 548 },
    { corr: 'OC-2026042701-003', type: 'BILL_PAYMENT',    queue: 'OPENCONNECT.IN', amount: '3500.00', identifier: '4716149063571121', status: 'FAILED',  clientCode: '96', extCode: '51',  duration: 1204, error: 'Insufficient funds' },
    { corr: 'OC-2026042701-004', type: 'BALANCE_INQUIRY', queue: 'OPENCONNECT.IN', amount: '0.00', identifier: '5425233430109903', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 287 },
    { corr: 'OC-2026042701-005', type: 'MINI_STATEMENT',  queue: 'OPENCONNECT.IN', amount: '0.00', identifier: '4532015112830366', status: 'TIMEOUT',  clientCode: '68', extCode: '-1',  duration: 30012, error: 'External API timeout after 30s' },
    { corr: 'OC-2026042701-006', type: 'FUND_TRANSFER',   queue: 'OPENCONNECT.IN', amount: '250000.00', identifier: '4716149063571121', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 622 },
    { corr: 'OC-2026042701-007', type: 'BALANCE_INQUIRY', queue: 'OPENCONNECT.IN', amount: '0.00', identifier: '5425233430109903', status: 'FAILED',  clientCode: '14', extCode: '14',  duration: 198, error: 'Invalid account number' },
    { corr: 'OC-2026042701-008', type: 'BILL_PAYMENT',    queue: 'OPENCONNECT.IN', amount: '1200.00', identifier: '4532015112830366', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 441 },
    { corr: 'OC-2026042701-009', type: 'TOKEN_REFRESH',   queue: 'OPENCONNECT.IN', amount: '0.00', identifier: 'SYSTEM', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 156 },
    { corr: 'OC-2026042701-010', type: 'FUND_TRANSFER',   queue: 'OPENCONNECT.IN', amount: '75000.00', identifier: '4716149063571121', status: 'REVERSED', clientCode: '05', extCode: '05', duration: 889, error: 'Do not honour — reversal initiated' },
    { corr: 'OC-2026042701-011', type: 'BALANCE_INQUIRY', queue: 'OPENCONNECT.IN', amount: '0.00', identifier: '4532015112830366', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 299 },
    { corr: 'OC-2026042701-012', type: 'CAS_INQUIRY',     queue: 'OPENCONNECT.IN', amount: '0.00', identifier: '0312-3456789', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 518 },
    { corr: 'OC-2026042601-013', type: 'FUND_TRANSFER',   queue: 'OPENCONNECT.IN', amount: '5000.00', identifier: '4532015112830366', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 491 },
    { corr: 'OC-2026042601-014', type: 'BILL_PAYMENT',    queue: 'OPENCONNECT.IN', amount: '800.00', identifier: '4716149063571121', status: 'FAILED',  clientCode: '57', extCode: '57',  duration: 223, error: 'Transaction not permitted' },
    { corr: 'OC-2026042501-015', type: 'BALANCE_INQUIRY', queue: 'OPENCONNECT.IN', amount: '0.00', identifier: '5425233430109903', status: 'SUCCESS', clientCode: '00', extCode: '000', duration: 311 },
  ];

  const insertLog = db.prepare(`
    INSERT INTO transactions_log
      (correlation_id, tran_type, queue_in, amount, identifier, status,
       client_response_code, external_response_code, duration_ms, error_reason, from_ip, host_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRR = db.prepare(`
    INSERT INTO transactions_log_req_resp
      (correlation_id, tran_log_id, client_request, client_response, external_request, external_response, reversal_request, reversal_response, token_used, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runSeed = db.transaction(() => {
    transactions.forEach((t, idx) => {
      const createdAt = new Date(now.getTime() - idx * 8 * 60 * 1000).toISOString();
      const info = insertLog.run(
        t.corr, t.type, t.queue, t.amount, t.identifier, t.status,
        t.clientCode, t.extCode, t.duration, t.error || null,
        '192.168.1.' + (10 + idx), 1, createdAt, createdAt
      );

      // Sample req/resp payloads per type
      const clientReq = JSON.stringify({
        correlationId: t.corr,
        tranType: t.type,
        queueIn: t.queue,
        identifier: t.identifier,
        amount: t.amount,
        channelId: 'MOBILE_APP',
        hostId: 1,
      });

      const clientResp = JSON.stringify(t.status === 'SUCCESS'
        ? { responseCode: t.clientCode, responseMessage: 'Success', correlationId: t.corr }
        : { responseCode: t.clientCode, responseMessage: t.error || 'Failed', correlationId: t.corr });

      const extReq = t.type !== 'TOKEN_REFRESH' ? JSON.stringify({
        accountNumber: t.identifier,
        bankCode: '01',
        channelId: 'OPENCONNECT',
        rrn: t.corr.replace('OC-', ''),
      }) : JSON.stringify({ grant_type: 'client_credentials' });

      const extResp = JSON.stringify(t.status === 'SUCCESS'
        ? { responseCode: t.extCode, responseMessage: 'Approved', data: { balance: '150,250.00', currency: 'PKR' } }
        : { responseCode: t.extCode, responseMessage: t.error || 'Declined' });

      const reversalReq  = t.status === 'REVERSED' ? JSON.stringify({ correlationId: t.corr, action: 'REVERSAL' }) : null;
      const reversalResp = t.status === 'REVERSED' ? JSON.stringify({ responseCode: '00', responseMessage: 'Reversal accepted' }) : null;

      insertRR.run(
        t.corr, Number(info.lastInsertRowid),
        clientReq, clientResp, extReq, extResp,
        reversalReq, reversalResp,
        '••••••••',    // token masked
        createdAt
      );
    });
  });

  runSeed();
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get paginated transaction log with optional filters.
 */
export function getTransactionLogs({ limit = 50, offset = 0, status, tranType, correlationId, dateFrom, dateTo } = {}) {
  const db = getDb();
  try {
    const conditions = [];
    const params = [];

    if (status) {
      // Allow comma-separated status values
      const statuses = status.split(',').map(s => s.trim().toUpperCase());
      conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (tranType) {
      conditions.push('tran_type = ?');
      params.push(tranType.toUpperCase());
    }
    if (correlationId) {
      conditions.push('correlation_id LIKE ?');
      params.push(`%${correlationId}%`);
    }
    if (dateFrom) {
      conditions.push('created_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('created_at <= ?');
      params.push(dateTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit  = Math.min(parseInt(limit) || 50, 200);
    const safeOffset = parseInt(offset) || 0;

    const rows = db.prepare(`
      SELECT * FROM transactions_log
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, safeLimit, safeOffset);

    const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM transactions_log ${where}`).get(...params);

    return { rows, total: totalRow.cnt };
  } finally {
    db.close();
  }
}

/**
 * Get full request/response detail for a correlation ID.
 * Masks sensitive fields before returning.
 */
export function getTransactionDetail(correlationId) {
  const db = getDb();
  try {
    const log = db.prepare('SELECT * FROM transactions_log WHERE correlation_id = ?').get(correlationId);
    if (!log) return null;

    const rr = db.prepare('SELECT * FROM transactions_log_req_resp WHERE correlation_id = ?').get(correlationId);

    const parseJson = (s) => { try { return s ? JSON.parse(s) : null; } catch { return s; } };

    return {
      log,
      reqResp: rr ? {
        ...rr,
        client_request:    maskSensitiveFields(parseJson(rr.client_request)),
        client_response:   parseJson(rr.client_response),
        external_request:  maskSensitiveFields(parseJson(rr.external_request)),
        external_response: parseJson(rr.external_response),
        reversal_request:  parseJson(rr.reversal_request),
        reversal_response: parseJson(rr.reversal_response),
        token_used:        rr.token_used ? '••••••••' : null,
      } : null,
    };
  } finally {
    db.close();
  }
}

/**
 * Get transaction summary stats.
 */
export function getTransactionStats() {
  const db = getDb();
  try {
    const total    = db.prepare("SELECT COUNT(*) as cnt FROM transactions_log").get().cnt;
    const success  = db.prepare("SELECT COUNT(*) as cnt FROM transactions_log WHERE status = 'SUCCESS'").get().cnt;
    const failed   = db.prepare("SELECT COUNT(*) as cnt FROM transactions_log WHERE status = 'FAILED'").get().cnt;
    const timeout  = db.prepare("SELECT COUNT(*) as cnt FROM transactions_log WHERE status = 'TIMEOUT'").get().cnt;
    const reversed = db.prepare("SELECT COUNT(*) as cnt FROM transactions_log WHERE status = 'REVERSED'").get().cnt;
    const avgDurationRow = db.prepare("SELECT AVG(duration_ms) as avg FROM transactions_log WHERE duration_ms IS NOT NULL").get();
    const typeBreakdown = db.prepare("SELECT tran_type, COUNT(*) as cnt FROM transactions_log GROUP BY tran_type ORDER BY cnt DESC LIMIT 10").all();

    return {
      total, success, failed, timeout, reversed,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      avgDurationMs: avgDurationRow.avg ? Math.round(avgDurationRow.avg) : 0,
      typeBreakdown,
    };
  } finally {
    db.close();
  }
}

/**
 * Get distinct tran_types for filter dropdown.
 */
export function getTranTypes() {
  const db = getDb();
  try {
    return db.prepare('SELECT DISTINCT tran_type FROM transactions_log ORDER BY tran_type').all().map(r => r.tran_type);
  } finally {
    db.close();
  }
}
