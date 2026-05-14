/**
 * Validation History Service
 * Persists and retrieves API validation history in SQLite.
 */

import { getDb } from './db.js';
import { maskSensitiveFields, maskHeaders } from './securityMaskingService.js';

/**
 * Create the api_validation_history table if it doesn't exist.
 */
export function initValidationHistorySchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_validation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id INTEGER NOT NULL,
      environment TEXT NOT NULL DEFAULT 'mock',
      target_url TEXT,
      method TEXT,
      request_headers TEXT,
      request_payload TEXT,
      auth_type TEXT DEFAULT 'none',
      auth_status TEXT DEFAULT 'skipped',
      raw_response TEXT,
      http_status INTEGER,
      external_code TEXT,
      mapped_code TEXT,
      mapped_description TEXT,
      extracted_fields TEXT,
      validation_flags TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      error_message TEXT,
      stages TEXT,
      db_load_ms INTEGER DEFAULT 0,
      auth_ms INTEGER DEFAULT 0,
      external_api_ms INTEGER DEFAULT 0,
      mapping_ms INTEGER DEFAULT 0,
      total_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_vh_config_id ON api_validation_history(config_id);
    CREATE INDEX IF NOT EXISTS idx_vh_created_at ON api_validation_history(created_at);
  `);
  db.close();
}

/**
 * Save a validation result to history.
 * Masks sensitive data before persistence.
 */
export function saveValidationResult(result) {
  const db = getDb();
  try {
    const stmt = db.prepare(`
      INSERT INTO api_validation_history (
        config_id, environment, target_url, method,
        request_headers, request_payload, auth_type, auth_status,
        raw_response, http_status, external_code, mapped_code, mapped_description,
        extracted_fields, validation_flags, success, error_code, error_message,
        stages, db_load_ms, auth_ms, external_api_ms, mapping_ms, total_ms
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    const flags = [];
    if (result.missingFields?.length > 0) flags.push('MISSING_FIELDS');
    if (result.errorCode) flags.push(result.errorCode);

    const info = stmt.run(
      result.configId,
      result.environment || 'mock',
      result.targetUrl,
      result.method,
      JSON.stringify(maskHeaders(result.requestHeaders || {})),
      JSON.stringify(maskSensitiveFields(result.requestPayload || {})),
      result.authType || 'none',
      result.authStatus || 'skipped',
      JSON.stringify(maskSensitiveFields(result.rawResponse || {})),
      result.httpStatus,
      result.externalCode,
      result.mappedCode,
      result.mappedDescription,
      JSON.stringify(result.extractedFields || {}),
      JSON.stringify(flags),
      result.success ? 1 : 0,
      result.errorCode || null,
      result.errorMessage || null,
      JSON.stringify(result.stages || []),
      result.timing?.db_load_ms || 0,
      result.timing?.auth_ms || 0,
      result.timing?.external_api_ms || 0,
      result.timing?.mapping_ms || 0,
      result.timing?.total_ms || 0
    );

    return { id: info.lastInsertRowid };
  } finally {
    db.close();
  }
}

/**
 * Get validation history for a given configId. Most recent first.
 */
export function getValidationHistory(configId, { limit = 50, offset = 0, success, environment } = {}) {
  const db = getDb();
  try {
    let sql = `SELECT id, config_id, environment, target_url, method, http_status,
                      external_code, mapped_code, mapped_description, success,
                      error_code, error_message, total_ms, created_at
               FROM api_validation_history WHERE config_id = ?`;
    const params = [configId];

    if (success !== undefined) {
      sql += ' AND success = ?';
      params.push(success ? 1 : 0);
    }
    if (environment) {
      sql += ' AND environment = ?';
      params.push(environment);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  } finally {
    db.close();
  }
}

/**
 * Get full detail for a single history entry.
 */
export function getValidationDetail(historyId) {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM api_validation_history WHERE id = ?').get(historyId);
    if (!row) return null;

    // Parse JSON fields
    const jsonFields = ['request_headers', 'request_payload', 'raw_response', 'extracted_fields', 'validation_flags', 'stages'];
    for (const f of jsonFields) {
      if (row[f]) {
        try { row[f] = JSON.parse(row[f]); } catch { /* keep as string */ }
      }
    }
    row.success = !!row.success;
    return row;
  } finally {
    db.close();
  }
}

/**
 * Get all validation history (not filtered by configId).
 */
export function getAllValidationHistory({ limit = 100, offset = 0, success, environment } = {}) {
  const db = getDb();
  try {
    let sql = `SELECT id, config_id, environment, target_url, method, http_status,
                      external_code, mapped_code, mapped_description, success,
                      error_code, error_message, total_ms, created_at
               FROM api_validation_history WHERE 1=1`;
    const params = [];

    if (success !== undefined) {
      sql += ' AND success = ?';
      params.push(success ? 1 : 0);
    }
    if (environment) {
      sql += ' AND environment = ?';
      params.push(environment);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  } finally {
    db.close();
  }
}
