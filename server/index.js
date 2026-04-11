import express from 'express';
import cors from 'cors';
import { getDb, initSchema, resetDb, seedDemoData } from './db.js';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Initialize database on startup
initSchema();
seedDemoData();
console.log('  Database initialized');

// ---------- API Routes ----------

// Execute SQL statements from the UI (SQLite-compatible)
app.post('/api/execute-sql', (req, res) => {
  const { statements } = req.body;
  if (!statements || !Array.isArray(statements)) {
    return res.status(400).json({ error: 'Provide { statements: [...] }' });
  }

  const db = getDb();
  const results = [];

  try {
    const runAll = db.transaction(() => {
      for (const sql of statements) {
        const trimmed = sql.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;

        // Block dangerous statements
        const upper = trimmed.toUpperCase();
        if (upper.startsWith('DROP') || upper.startsWith('ALTER') || upper.startsWith('CREATE')) {
          throw new Error(`Statement not allowed: ${trimmed.substring(0, 50)}`);
        }

        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(trimmed).all();
          results.push({ sql: trimmed.substring(0, 80), type: 'SELECT', rows });
        } else if (upper.startsWith('INSERT')) {
          const info = db.prepare(trimmed).run();
          results.push({
            sql: trimmed.substring(0, 80),
            type: 'INSERT',
            lastInsertRowid: Number(info.lastInsertRowid),
            changes: info.changes
          });
        } else if (upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
          const info = db.prepare(trimmed).run();
          results.push({ sql: trimmed.substring(0, 80), type: upper.split(' ')[0], changes: info.changes });
        }
      }
    });

    runAll();
    res.json({ success: true, results });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

// Get all config data for verification
app.get('/api/verify', (req, res) => {
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
    for (const [table, rows] of Object.entries(data)) {
      counts[table] = rows.length;
    }

    res.json({ success: true, counts, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

// Get a specific table's data
app.get('/api/table/:name', (req, res) => {
  const allowed = ['ws_config', 'ws_token_config', 'ws_endpoint_config', 'ws_response_definition', 'ws_req_param_details', 'tran_req_map'];
  const tableName = req.params.name;

  if (!allowed.includes(tableName)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  const db = getDb();
  try {
    const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY id`).all();
    res.json({ success: true, table: tableName, count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

// Reset database (clear all data, keep schema)
app.post('/api/reset', (req, res) => {
  try {
    resetDb();
    res.json({ success: true, message: 'Database reset. All tables cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'SQLite (demo)', tables: 7 });
});

// ========== Saved Configurations CRUD ==========

// List all saved configs
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

// Get a single saved config
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

// Save a new config
app.post('/api/configs', (req, res) => {
  const { name, client, config } = req.body;
  if (!name || !client || !config) {
    return res.status(400).json({ success: false, error: 'name, client, and config are required' });
  }

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

// Delete a saved config
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

app.listen(PORT, () => {
  console.log(`\n  OpenConnect Demo Server`);
  console.log(`  ──────────────────────`);
  console.log(`  URL:     http://localhost:${PORT}`);
  console.log(`  DB:      SQLite (demo.db)`);
  console.log(`  Status:  Running\n`);
  console.log(`  API Endpoints:`);
  console.log(`  POST /api/execute-sql  - Execute SQL statements`);
  console.log(`  GET  /api/verify       - View all config data`);
  console.log(`  GET  /api/table/:name  - View specific table`);
  console.log(`  POST /api/reset        - Reset database`);
  console.log(`  GET  /api/health       - Health check`);
  console.log(`  GET  /api/configs      - List saved configs`);
  console.log(`  POST /api/configs      - Save a config`);
  console.log(`  GET  /api/configs/:id  - Get saved config`);
  console.log(`  DELETE /api/configs/:id - Delete config\n`);
});
