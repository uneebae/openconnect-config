import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDb, initSchema, resetDb, seedDemoData } from './db.js';
import * as mssqlDb from './mssql-db.js';

const app = express();
const PORT = process.env.PORT || 3002;
const DB_MODE = process.env.DB_MODE || 'sqlite'; // 'sqlite' or 'mssql'

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ─── Initialization ──────────────────────────────
async function init() {
  // SQLite always initializes (for saved_configs)
  initSchema();
  seedDemoData();

  if (DB_MODE === 'mssql') {
    const status = await mssqlDb.testConnection();
    if (status.connected) {
      console.log(`  ✓ SQL Server connected: ${status.server} / ${status.database}`);
    } else {
      console.error(`  ✗ SQL Server connection failed: ${status.error}`);
      console.log('  Falling back to SQLite demo mode');
    }
  } else {
    console.log('  ✓ SQLite demo mode');
  }
}

// ─── Helper: is MSSQL active? ────────────────────
function isMssql() {
  return DB_MODE === 'mssql';
}

// ─── Health Check ────────────────────────────────
app.get('/api/health', async (req, res) => {
  if (isMssql()) {
    const status = await mssqlDb.testConnection();
    res.json({
      status: status.connected ? 'ok' : 'degraded',
      mode: 'mssql',
      server: process.env.MSSQL_HOST,
      database: process.env.MSSQL_DATABASE,
      connected: status.connected,
      error: status.error || null,
      tables: 6
    });
  } else {
    res.json({ status: 'ok', mode: 'sqlite', database: 'demo.db', tables: 7 });
  }
});

// ─── Execute SQL ─────────────────────────────────
app.post('/api/execute-sql', async (req, res) => {
  const { statements } = req.body;
  if (!statements || !Array.isArray(statements)) {
    return res.status(400).json({ error: 'Provide { statements: [...] }' });
  }

  try {
    if (isMssql()) {
      // Convert SQLite-style SQL to MSSQL-compatible
      const mssqlStatements = statements.map(s => convertToMssql(s));
      const result = await mssqlDb.executeSql(mssqlStatements);
      res.json(result);
    } else {
      // SQLite execution
      const db = getDb();
      const results = [];
      try {
        const runAll = db.transaction(() => {
          for (const sql of statements) {
            const trimmed = sql.trim();
            if (!trimmed || trimmed.startsWith('--')) continue;
            const upper = trimmed.toUpperCase();
            if (upper.startsWith('DROP') || upper.startsWith('ALTER') || upper.startsWith('CREATE')) {
              throw new Error(`Statement not allowed: ${trimmed.substring(0, 50)}`);
            }
            if (upper.startsWith('SELECT')) {
              const rows = db.prepare(trimmed).all();
              results.push({ sql: trimmed.substring(0, 80), type: 'SELECT', rows });
            } else if (upper.startsWith('INSERT')) {
              const info = db.prepare(trimmed).run();
              results.push({ sql: trimmed.substring(0, 80), type: 'INSERT', lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes });
            } else if (upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
              const info = db.prepare(trimmed).run();
              results.push({ sql: trimmed.substring(0, 80), type: upper.split(' ')[0], changes: info.changes });
            }
          }
        });
        runAll();
        res.json({ success: true, results });
      } finally {
        db.close();
      }
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Verify (read all tables) ────────────────────
app.get('/api/verify', async (req, res) => {
  try {
    if (isMssql()) {
      const { data, counts } = await mssqlDb.getAllData();
      res.json({ success: true, mode: 'mssql', counts, data });
    } else {
      const db = getDb();
      try {
        const data = {
          ws_config: db.prepare('SELECT * FROM ws_config ORDER BY id').all(),
          ws_token_config: db.prepare('SELECT * FROM ws_token_config ORDER BY id').all(),
          ws_endpoint_config: db.prepare('SELECT * FROM ws_endpoint_config ORDER BY id').all(),
          ws_response_definition: db.prepare('SELECT * FROM ws_response_definition ORDER BY id').all(),
          ws_req_param_details: db.prepare('SELECT * FROM ws_req_param_details ORDER BY id').all(),
          tran_req_map: db.prepare('SELECT * FROM tran_req_map ORDER BY param_priority').all()
        };
        const counts = {};
        for (const [table, rows] of Object.entries(data)) counts[table] = rows.length;
        res.json({ success: true, mode: 'sqlite', counts, data });
      } finally {
        db.close();
      }
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Get specific table ──────────────────────────
app.get('/api/table/:name', async (req, res) => {
  const allowed = ['ws_config', 'ws_token_config', 'ws_endpoint_config', 'ws_response_definition', 'ws_req_param_details', 'tran_req_map'];
  const tableName = req.params.name;
  if (!allowed.includes(tableName)) return res.status(400).json({ error: 'Invalid table name' });

  try {
    if (isMssql()) {
      const rows = await mssqlDb.getTable(tableName);
      res.json({ success: true, mode: 'mssql', table: tableName, count: rows.length, rows });
    } else {
      const db = getDb();
      try {
        const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY id`).all();
        res.json({ success: true, mode: 'sqlite', table: tableName, count: rows.length, rows });
      } finally {
        db.close();
      }
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Reset (clear config tables) ─────────────────
app.post('/api/reset', async (req, res) => {
  try {
    if (isMssql()) {
      await mssqlDb.resetData();
      res.json({ success: true, mode: 'mssql', message: 'All config tables cleared on SQL Server.' });
    } else {
      resetDb();
      res.json({ success: true, mode: 'sqlite', message: 'Database reset. All tables cleared.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Saved Configurations (always SQLite) ────────

app.get('/api/configs', (req, res) => {
  const db = getDb();
  try {
    const configs = db.prepare('SELECT id, name, client, created_at, updated_at FROM saved_configs ORDER BY updated_at DESC').all();
    res.json({ success: true, configs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

app.get('/api/configs/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM saved_configs WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ success: false, error: 'Config not found' });
    row.config_data = JSON.parse(row.config_data);
    res.json({ success: true, config: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

app.post('/api/configs', (req, res) => {
  const { name, client, config } = req.body;
  if (!name || !client || !config) return res.status(400).json({ success: false, error: 'name, client, and config are required' });
  const db = getDb();
  try {
    const configData = typeof config === 'string' ? config : JSON.stringify(config);
    const info = db.prepare('INSERT INTO saved_configs (name, client, config_data) VALUES (?, ?, ?)').run(name, client, configData);
    res.json({ success: true, id: Number(info.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

app.delete('/api/configs/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
  const db = getDb();
  try {
    const info = db.prepare('DELETE FROM saved_configs WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ success: false, error: 'Config not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

// ─── SQL Converter (SQLite → MSSQL) ─────────────
function convertToMssql(sql) {
  // Remove SQLite-specific syntax
  let converted = sql.trim();
  // SCOPE_IDENTITY() is already MSSQL. If SQLite used last_insert_rowid(), swap it.
  // No major conversions needed since the UI generates standard SQL.
  return converted;
}

// ─── Start Server ────────────────────────────────
init().then(() => {
  app.listen(PORT, () => {
    const modeLabel = isMssql()
      ? `SQL Server (${process.env.MSSQL_HOST}:${process.env.MSSQL_PORT}/${process.env.MSSQL_DATABASE})`
      : 'SQLite (demo.db)';

    console.log(`\n  OpenConnect Server`);
    console.log(`  ──────────────────`);
    console.log(`  URL:     http://localhost:${PORT}`);
    console.log(`  Mode:    ${DB_MODE.toUpperCase()}`);
    console.log(`  DB:      ${modeLabel}`);
    console.log(`  Status:  Running\n`);
    console.log(`  API Endpoints:`);
    console.log(`  GET  /api/health       - Health check & DB status`);
    console.log(`  POST /api/execute-sql  - Execute SQL statements`);
    console.log(`  GET  /api/verify       - View all config data`);
    console.log(`  GET  /api/table/:name  - View specific table`);
    console.log(`  POST /api/reset        - Reset config tables`);
    console.log(`  GET  /api/configs      - List saved configs`);
    console.log(`  POST /api/configs      - Save a config`);
    console.log(`  GET  /api/configs/:id  - Get saved config`);
    console.log(`  DELETE /api/configs/:id - Delete config\n`);
  });
});
