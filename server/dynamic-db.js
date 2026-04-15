/**
 * Dynamic Database Connection Manager
 * Supports: SQL Server (mssql), PostgreSQL (pg), MySQL (mysql2)
 * Connections are managed at runtime via API — no .env restart needed.
 */

import sql from 'mssql';
import pg from 'pg';
import mysql from 'mysql2/promise';

// ─── Active connection state ─────────────────────
let activeConnection = null; // { type, pool, config, connectedAt }

// ─── Connect ─────────────────────────────────────
async function connect({ type, host, port, database, user, password, options = {} }) {
  // Close existing connection first
  await disconnect();

  const connConfig = { type, host, port: parseInt(port, 10), database, user, password };

  try {
    if (type === 'mssql') {
      const pool = await sql.connect({
        server: host,
        port: parseInt(port, 10) || 1433,
        database,
        user,
        password,
        options: {
          encrypt: options.encrypt || false,
          trustServerCertificate: options.trustCert !== false,
        },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      });
      // Test
      await pool.request().query('SELECT 1 AS ok');
      activeConnection = { type, pool, config: connConfig, connectedAt: new Date().toISOString() };

    } else if (type === 'postgres') {
      const pool = new pg.Pool({
        host,
        port: parseInt(port, 10) || 5432,
        database,
        user,
        password,
        max: 10,
        idleTimeoutMillis: 30000,
        ssl: options.ssl ? { rejectUnauthorized: false } : false,
      });
      // Test
      const client = await pool.connect();
      await client.query('SELECT 1 AS ok');
      client.release();
      activeConnection = { type, pool, config: connConfig, connectedAt: new Date().toISOString() };

    } else if (type === 'mysql') {
      const pool = mysql.createPool({
        host,
        port: parseInt(port, 10) || 3306,
        database,
        user,
        password,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: options.ssl ? {} : undefined,
      });
      // Test
      const conn = await pool.getConnection();
      await conn.query('SELECT 1 AS ok');
      conn.release();
      activeConnection = { type, pool, config: connConfig, connectedAt: new Date().toISOString() };

    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }

    return { success: true, type, host, database, connectedAt: activeConnection.connectedAt };
  } catch (err) {
    activeConnection = null;
    throw err;
  }
}

// ─── Disconnect ──────────────────────────────────
async function disconnect() {
  if (!activeConnection) return;
  try {
    if (activeConnection.type === 'mssql') {
      await activeConnection.pool.close();
    } else if (activeConnection.type === 'postgres') {
      await activeConnection.pool.end();
    } else if (activeConnection.type === 'mysql') {
      await activeConnection.pool.end();
    }
  } catch { /* ignore close errors */ }
  activeConnection = null;
}

// ─── Status ──────────────────────────────────────
function getStatus() {
  if (!activeConnection) {
    return { connected: false, type: null, host: null, database: null };
  }
  return {
    connected: true,
    type: activeConnection.type,
    host: activeConnection.config.host,
    port: activeConnection.config.port,
    database: activeConnection.config.database,
    // Intentionally omit 'user' — do not leak credentials in status responses
    connectedAt: activeConnection.connectedAt,
  };
}

function isConnected() {
  return activeConnection !== null;
}

function getType() {
  return activeConnection?.type || null;
}

// ─── Read: Get all 6 tables ─────────────────────
async function getAllData() {
  if (!activeConnection) throw new Error('No database connected');
  const tables = ['ws_config', 'ws_endpoint_config', 'ws_token_config', 'ws_response_definition', 'ws_req_param_details', 'tran_req_map'];
  const data = {};
  const counts = {};

  for (const table of tables) {
    const rows = await queryRows(`SELECT * FROM ${table} ORDER BY id`);
    data[table] = rows;
    counts[table] = rows.length;
  }
  return { data, counts };
}

// ─── Read: Single table ─────────────────────────
async function getTable(tableName) {
  const allowed = ['ws_config', 'ws_token_config', 'ws_endpoint_config', 'ws_response_definition', 'ws_req_param_details', 'tran_req_map'];
  if (!allowed.includes(tableName)) throw new Error('Invalid table name');
  if (!activeConnection) throw new Error('No database connected');
  return await queryRows(`SELECT * FROM ${tableName} ORDER BY id`);
}

// ─── Execute SQL (SELECT + INSERT only) ──────────
async function executeSql(statements) {
  if (!activeConnection) throw new Error('No database connected');

  const results = [];

  // Use transaction for safety
  if (activeConnection.type === 'mssql') {
    const transaction = new sql.Transaction(activeConnection.pool);
    await transaction.begin();
    try {
      for (const stmt of statements) {
        const result = await executeSingleStatement(stmt, transaction);
        if (result) results.push(result);
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

  } else if (activeConnection.type === 'postgres') {
    const client = await activeConnection.pool.connect();
    try {
      await client.query('BEGIN');
      for (const stmt of statements) {
        const result = await executeSingleStatementPg(stmt, client);
        if (result) results.push(result);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }
    client.release();

  } else if (activeConnection.type === 'mysql') {
    const conn = await activeConnection.pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const stmt of statements) {
        const result = await executeSingleStatementMysql(stmt, conn);
        if (result) results.push(result);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
    conn.release();
  }

  return { success: true, results };
}

// ─── Test connection (ping) ──────────────────────
async function testConnection() {
  if (!activeConnection) return { connected: false, error: 'No active connection' };
  try {
    await queryRows('SELECT 1 AS ok');
    return { connected: true, ...getStatus() };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// ─── Internal: unified query helper ─────────────
async function queryRows(queryStr) {
  if (!activeConnection) throw new Error('No database connected');

  if (activeConnection.type === 'mssql') {
    const result = await activeConnection.pool.request().query(queryStr);
    return result.recordset;
  } else if (activeConnection.type === 'postgres') {
    const result = await activeConnection.pool.query(queryStr);
    return result.rows;
  } else if (activeConnection.type === 'mysql') {
    const [rows] = await activeConnection.pool.query(queryStr);
    return rows;
  }
}

// ─── Internal: validate + execute single stmt ────
function validateStatement(stmt) {
  const trimmed = stmt.trim();
  if (!trimmed || trimmed.startsWith('--')) return null; // skip

  // Strip SQL block comments (/* ... */) to prevent bypass
  const stripped = trimmed.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!stripped) return null; // comment-only statement
  const upper = stripped.toUpperCase();

  // BLOCK all destructive operations
  if (upper.startsWith('DROP') || upper.startsWith('ALTER') || upper.startsWith('TRUNCATE')) {
    throw new Error(`BLOCKED: ${trimmed.substring(0, 50)} — Destructive statements are not allowed.`);
  }
  if (upper.startsWith('DELETE')) {
    throw new Error('BLOCKED: DELETE statements are not allowed. Use your database management tool for manual operations.');
  }
  if (upper.startsWith('UPDATE')) {
    throw new Error('BLOCKED: UPDATE statements are not allowed. Use your database management tool for manual operations.');
  }

  // Only SELECT and INSERT are permitted
  if (!upper.startsWith('SELECT') && !upper.startsWith('INSERT')) {
    throw new Error(`BLOCKED: Only SELECT and INSERT statements are allowed. Got: ${trimmed.substring(0, 30)}`);
  }

  return { trimmed, upper };
}

// MSSQL execution
async function executeSingleStatement(stmt, transaction) {
  const v = validateStatement(stmt);
  if (!v) return null;
  const { trimmed, upper } = v;

  const request = new sql.Request(transaction);
  const result = await request.query(trimmed);

  if (upper.startsWith('SELECT')) {
    return { sql: trimmed.substring(0, 80), type: 'SELECT', rows: result.recordset };
  } else {
    return { sql: trimmed.substring(0, 80), type: 'INSERT', rowsAffected: result.rowsAffected[0] };
  }
}

// PostgreSQL execution
async function executeSingleStatementPg(stmt, client) {
  const v = validateStatement(stmt);
  if (!v) return null;
  const { trimmed, upper } = v;

  const result = await client.query(trimmed);

  if (upper.startsWith('SELECT')) {
    return { sql: trimmed.substring(0, 80), type: 'SELECT', rows: result.rows };
  } else {
    return { sql: trimmed.substring(0, 80), type: 'INSERT', rowsAffected: result.rowCount };
  }
}

// MySQL execution
async function executeSingleStatementMysql(stmt, conn) {
  const v = validateStatement(stmt);
  if (!v) return null;
  const { trimmed, upper } = v;

  const [result] = await conn.query(trimmed);

  if (upper.startsWith('SELECT')) {
    return { sql: trimmed.substring(0, 80), type: 'SELECT', rows: result };
  } else {
    return { sql: trimmed.substring(0, 80), type: 'INSERT', rowsAffected: result.affectedRows };
  }
}

export {
  connect,
  disconnect,
  getStatus,
  isConnected,
  getType,
  getAllData,
  getTable,
  executeSql,
  testConnection,
};
