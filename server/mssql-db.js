import sql from 'mssql';

let pool = null;

const config = {
  server: process.env.MSSQL_HOST,
  port: parseInt(process.env.MSSQL_PORT, 10) || 1440,
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: process.env.MSSQL_TRUST_CERT === 'true',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

async function testConnection() {
  try {
    const p = await getPool();
    const result = await p.request().query('SELECT 1 AS ok');
    return { connected: true, server: config.server, database: config.database };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// ─── Read operations (all tables) ────────────────────

async function getAllData() {
  const p = await getPool();
  const tables = ['ws_config', 'ws_endpoint_config', 'ws_token_config', 'ws_response_definition', 'ws_req_param_details', 'tran_req_map'];
  const data = {};
  const counts = {};

  for (const table of tables) {
    const result = await p.request().query(`SELECT * FROM ${table} ORDER BY id`);
    data[table] = result.recordset;
    counts[table] = result.recordset.length;
  }

  return { data, counts };
}

async function getTable(tableName) {
  const allowed = ['ws_config', 'ws_token_config', 'ws_endpoint_config', 'ws_response_definition', 'ws_req_param_details', 'tran_req_map'];
  if (!allowed.includes(tableName)) throw new Error('Invalid table name');

  const p = await getPool();
  const result = await p.request().query(`SELECT * FROM ${tableName} ORDER BY id`);
  return result.recordset;
}

// ─── Execute SQL statements ──────────────────────

async function executeSql(statements) {
  const p = await getPool();
  const transaction = new sql.Transaction(p);
  await transaction.begin();
  const results = [];

  try {
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;

      const upper = trimmed.toUpperCase();
      // Block dangerous statements — no DELETE, DROP, ALTER, TRUNCATE on production
      if (upper.startsWith('DROP') || upper.startsWith('ALTER') || upper.startsWith('TRUNCATE')) {
        throw new Error(`Statement not allowed: ${trimmed.substring(0, 50)}`);
      }
      if (upper.startsWith('DELETE')) {
        throw new Error('DELETE statements are blocked on production SQL Server. Use SQL Server Management Studio for manual data operations.');
      }
      if (upper.startsWith('UPDATE')) {
        throw new Error('UPDATE statements are blocked on production SQL Server. Use SQL Server Management Studio for manual data operations.');
      }

      // Only SELECT and INSERT are allowed on production
      if (!upper.startsWith('SELECT') && !upper.startsWith('INSERT')) {
        throw new Error(`Statement not allowed on production: ${trimmed.substring(0, 50)}`);
      }

      const request = new sql.Request(transaction);
      const result = await request.query(trimmed);

      if (upper.startsWith('SELECT')) {
        results.push({ sql: trimmed.substring(0, 80), type: 'SELECT', rows: result.recordset });
      } else if (upper.startsWith('INSERT')) {
        results.push({
          sql: trimmed.substring(0, 80),
          type: 'INSERT',
          rowsAffected: result.rowsAffected[0]
        });
      }
    }

    await transaction.commit();
    return { success: true, results };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ─── Reset — PERMANENTLY DISABLED for production safety ───
// This function is intentionally removed. Production data cannot be deleted through this tool.
// Use SQL Server Management Studio (SSMS) for any manual data operations.

// ─── Saved Configurations (using saved_configs table in SQLite — local only) ───
// Note: saved_configs stays in SQLite even in MSSQL mode, since it's app-level state

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export { getPool, testConnection, getAllData, getTable, executeSql, closePool };
