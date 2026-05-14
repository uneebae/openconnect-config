import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getDb, initSchema, resetDb, seedDemoData, encryptPassword, decryptPassword } from './db.js';
import * as dynamicDb from './dynamic-db.js';
import { createApiLayerRoutes } from './api-layer.js';
import { runValidation } from './validationService.js';
import { initValidationHistorySchema, saveValidationResult, getValidationHistory, getAllValidationHistory, getValidationDetail } from './validationHistoryService.js';
import { parseCurlCommand } from './curlImportService.js';
import { initTransactionLogSchema, getTransactionLogs, getTransactionDetail, getTransactionStats, getTranTypes } from './transactionLogService.js';
import { initReadinessSchema, runReadinessCheck, getReadinessHistory } from './readinessCheckService.js';
import { getEnvironments, getEnvironment, setEnvironmentOverride, resolveEndpoint, checkHealth, buildOcCoreRequest, generateOcCoreCurl } from './ocCoreRoutingService.js';
import { getAndParse, postAndParse, buildSignedGetUrl, buildSignedPostUrl, buildPostBody, parseOcCoreResponse } from './ocCoreTransportService.js';

const app = express();
const PORT = process.env.PORT || 3002;
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Security Middleware ─────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // handled by frontend
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: IS_PROD
    ? (process.env.CORS_ORIGIN || 'http://localhost:3000')
    : true,
  credentials: true,
}));

app.use(express.json({ limit: '512kb' }));

// ─── Rate Limiting ───────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Try again later.' },
});

const connectLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many connection attempts. Try again later.' },
});

app.use('/api/', apiLimiter);
app.use('/api/db/connect', connectLimiter);

// ─── Request Logging ─────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
    console.log(`  ${color}${req.method}\x1b[0m ${req.originalUrl} → ${status} (${ms}ms)`);
  });
  next();
});

// ─── Initialization ──────────────────────────────
async function init() {
  // SQLite always initializes (for saved_configs + db_connections)
  initSchema();
  initValidationHistorySchema();
  initTransactionLogSchema();
  initReadinessSchema();
  seedDemoData();
  console.log('  ✓ SQLite local storage ready');
}

// ─── Health Check ────────────────────────────────
app.get('/api/health', async (req, res) => {
  const dbStatus = dynamicDb.getStatus();
  if (dbStatus.connected) {
    const test = await dynamicDb.testConnection();
    res.json({
      status: test.connected ? 'ok' : 'degraded',
      mode: dbStatus.type,
      server: dbStatus.host,
      port: dbStatus.port,
      database: dbStatus.database,
      connected: test.connected,
      error: test.connected ? null : test.error,
      tables: 6
    });
  } else {
    res.json({ status: 'ok', mode: 'sqlite', database: 'demo.db', tables: 7, connected: true });
  }
});

// ─── Execute SQL ─────────────────────────────────
app.post('/api/execute-sql', async (req, res) => {
  const { statements } = req.body;
  if (!statements || !Array.isArray(statements)) {
    return res.status(400).json({ error: 'Provide { statements: [...] }' });
  }

  // Limit number of statements to prevent resource exhaustion
  if (statements.length > 200) {
    return res.status(400).json({ success: false, error: 'Too many statements (max 200 per request)' });
  }

  try {
    if (dynamicDb.isConnected()) {
      const result = await dynamicDb.executeSql(statements);
      res.json(result);
    } else {
      // SQLite demo execution
      const db = getDb();
      const results = [];
      let lastInsertId = null;
      try {
        const runAll = db.transaction(() => {
          for (let i = 0; i < statements.length; i++) {
            let stmt = statements[i];
            const trimmed = stmt.trim();
            if (!trimmed || trimmed.startsWith('--')) continue;
            // Strip SQL block comments before checking statement type
            const stripped = trimmed.replace(/\/\*[\s\S]*?\*\//g, '').trim();
            const upper = stripped.toUpperCase();
            // BLOCK all destructive operations — only SELECT and INSERT allowed
            if (upper.startsWith('DROP') || upper.startsWith('ALTER') || upper.startsWith('CREATE') || upper.startsWith('TRUNCATE')) {
              throw new Error(`Statement not allowed: ${trimmed.substring(0, 50)}`);
            }
            if (upper.startsWith('DELETE')) {
              throw new Error('DELETE statements are not allowed. Use a database management tool for manual operations.');
            }
            if (upper.startsWith('UPDATE')) {
              throw new Error('UPDATE statements are not allowed. Use a database management tool for manual operations.');
            }
            if (upper.startsWith('SELECT')) {
              const rows = db.prepare(trimmed).all();
              results.push({ sql: trimmed.substring(0, 80), type: 'SELECT', rows });
            } else if (upper.startsWith('INSERT')) {
              // Support {LAST_INSERT_ID} placeholder for foreign key references
              // Replace placeholder BEFORE executing: '{LAST_INSERT_ID}' -> actual numeric ID
              const usesPlaceholder = stmt.includes('{LAST_INSERT_ID}');
              if (lastInsertId !== null && usesPlaceholder) {
                // Replace all variations: {LAST_INSERT_ID}, '{LAST_INSERT_ID}', "{LAST_INSERT_ID}"
                const idString = String(lastInsertId);
                stmt = stmt.split('{LAST_INSERT_ID}').join(idString);
              } else if (lastInsertId === null && usesPlaceholder) {
                // First statement cannot use placeholder
                throw new Error('Cannot use {LAST_INSERT_ID} in first INSERT statement');
              }
              
              const info = db.prepare(stmt).run();
              // Only update lastInsertId from the FIRST insert (the parent row)
              // so that subsequent references keep pointing to it
              if (lastInsertId === null) {
                lastInsertId = Number(info.lastInsertRowid);
              }
              results.push({ sql: stmt.substring(0, 80), type: 'INSERT', lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes });
            } else if (!upper) {
              // comment-only statement after stripping — skip
            } else {
              throw new Error(`Statement not allowed: ${trimmed.substring(0, 50)}`);
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
    if (dynamicDb.isConnected()) {
      const { data, counts } = await dynamicDb.getAllData();
      res.json({ success: true, mode: dynamicDb.getType(), counts, data });
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
    if (dynamicDb.isConnected()) {
      const rows = await dynamicDb.getTable(tableName);
      res.json({ success: true, mode: dynamicDb.getType(), table: tableName, count: rows.length, rows });
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
// SAFETY: Reset is BLOCKED when connected to external DB
app.post('/api/reset', async (req, res) => {
  try {
    if (dynamicDb.isConnected()) {
      return res.status(403).json({
        success: false,
        mode: dynamicDb.getType(),
        error: 'Reset is disabled when connected to an external database. Production data cannot be deleted through this tool.'
      });
    } else {
      resetDb();
      res.json({ success: true, mode: 'sqlite', message: 'Database reset. All tables cleared.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Database Connection Management ──────────────

// Connect to external database
app.post('/api/db/connect', async (req, res) => {
  const { type, host, port, database, user, password, options } = req.body;
  if (!type || !host || !database || !user) {
    return res.status(400).json({ success: false, error: 'type, host, database, and user are required' });
  }
  const allowedTypes = ['mssql', 'postgres', 'mysql'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ success: false, error: `Unsupported type. Use: ${allowedTypes.join(', ')}` });
  }
  // Input length validation
  if (String(host).length > 255 || String(database).length > 128 || String(user).length > 128) {
    return res.status(400).json({ success: false, error: 'Input values exceed maximum length' });
  }
  const portProvided = port !== undefined && port !== null && port !== '';
  const parsedPort = portProvided ? parseInt(port, 10) : undefined;
  if (portProvided && (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535)) {
    return res.status(400).json({ success: false, error: 'Port must be between 1 and 65535' });
  }
  try {
    const result = await dynamicDb.connect({ type, host, port: parsedPort, database, user, password, options });
    console.log(`  ✓ Connected to ${type}: ${host}:${parsedPort || 'default'}/${database}`);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Disconnect from external database
app.post('/api/db/disconnect', async (req, res) => {
  await dynamicDb.disconnect();
  console.log('  ✓ Disconnected from external database');
  res.json({ success: true, message: 'Disconnected. Now using SQLite demo mode.' });
});

// Get connection status
app.get('/api/db/status', (req, res) => {
  res.json(dynamicDb.getStatus());
});

// Test active connection
app.get('/api/db/test', async (req, res) => {
  const result = await dynamicDb.testConnection();
  res.json(result);
});

// ─── Saved Database Connections (SQLite local) ───

app.get('/api/db/connections', (req, res) => {
  const db = getDb();
  try {
    const connections = db.prepare('SELECT id, name, type, host, port, database_name, username, created_at FROM db_connections ORDER BY created_at DESC').all();
    res.json({ success: true, connections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

app.post('/api/db/connections', (req, res) => {
  const { name, type, host, port, database_name, username, password, options } = req.body;
  if (!name || !type || !host || !database_name || !username) {
    return res.status(400).json({ success: false, error: 'name, type, host, database_name, and username are required' });
  }
  const allowedTypes = ['mssql', 'postgres', 'mysql'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ success: false, error: `Unsupported type. Use: ${allowedTypes.join(', ')}` });
  }
  if (String(name).length > 100 || String(host).length > 255 || String(database_name).length > 128 || String(username).length > 128) {
    return res.status(400).json({ success: false, error: 'Input values exceed maximum length' });
  }
  const db = getDb();
  try {
    const info = db.prepare(
      'INSERT INTO db_connections (name, type, host, port, database_name, username, password, options) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(String(name).substring(0, 100), type, host, port || null, database_name, username, encryptPassword(password || ''), JSON.stringify(options || {}));
    res.json({ success: true, id: Number(info.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

app.get('/api/db/connections/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM db_connections WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ success: false, error: 'Connection not found' });
    row.options = JSON.parse(row.options || '{}');
    // Mask password — never return plaintext credentials in API responses
    row.password = row.password ? '••••••••' : '';
    res.json({ success: true, connection: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
  }
});

app.delete('/api/db/connections/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
  const db = getDb();
  try {
    const info = db.prepare('DELETE FROM db_connections WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ success: false, error: 'Connection not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.close();
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
  if (String(name).length > 200 || String(client).length > 100) {
    return res.status(400).json({ success: false, error: 'Name or client exceeds maximum length' });
  }
  const db = getDb();
  try {
    const configData = typeof config === 'string' ? config : JSON.stringify(config);
    if (configData.length > 500000) {
      return res.status(400).json({ success: false, error: 'Configuration data too large (max 500KB)' });
    }
    const info = db.prepare('INSERT INTO saved_configs (name, client, config_data) VALUES (?, ?, ?)').run(String(name).substring(0, 200), String(client).substring(0, 100), configData);
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

// ─── API Layer (OpenConnect proxy to external APIs) ──
createApiLayerRoutes(app);

// ─── API Validation Dashboard Routes ─────────────

// POST /api/layer/validate/:configId — Full validation with stage tracking
app.post('/api/layer/validate/:configId', async (req, res) => {
  const configId = parseInt(req.params.configId, 10);
  if (!Number.isFinite(configId)) {
    return res.status(400).json({ success: false, error: 'Invalid configId' });
  }
  const environment = req.body._environment || 'mock';
  const allowedEnvs = ['mock', 'uat', 'production'];
  if (!allowedEnvs.includes(environment)) {
    return res.status(400).json({ success: false, error: 'Invalid environment. Use: mock, uat, production' });
  }
  // Strip internal meta-params before passing to validation engine
  const params = { ...req.body };
  delete params._environment;
  delete params._save;

  try {
    const result = await runValidation(configId, params, environment);

    // Auto-save to history if requested (default true)
    if (req.body._save !== false) {
      try {
        const saved = saveValidationResult(result);
        result.historyId = saved.id;
      } catch (err) {
        console.error('  Failed to save validation history:', err.message);
      }
    }

    const statusCode = result.success ? 200 : (result.errorCode === 'CONFIG_NOT_FOUND' ? 404 : 502);
    res.status(statusCode).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/layer/validation-history/:configId — History for a config
app.get('/api/layer/validation-history/:configId', (req, res) => {
  const configId = parseInt(req.params.configId, 10);
  if (!Number.isFinite(configId)) {
    return res.status(400).json({ success: false, error: 'Invalid configId' });
  }
  try {
    const success = req.query.success !== undefined ? req.query.success === 'true' : undefined;
    const history = getValidationHistory(configId, {
      limit: Math.min(parseInt(req.query.limit) || 50, 200),
      offset: parseInt(req.query.offset) || 0,
      success,
      environment: req.query.environment || undefined,
    });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/layer/validation-history — All history (no configId filter)
app.get('/api/layer/validation-history', (req, res) => {
  try {
    const success = req.query.success !== undefined ? req.query.success === 'true' : undefined;
    const history = getAllValidationHistory({
      limit: Math.min(parseInt(req.query.limit) || 100, 200),
      offset: parseInt(req.query.offset) || 0,
      success,
      environment: req.query.environment || undefined,
    });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/layer/validation-history/detail/:historyId — Single entry detail
app.get('/api/layer/validation-history/detail/:historyId', (req, res) => {
  const historyId = parseInt(req.params.historyId, 10);
  if (!Number.isFinite(historyId)) {
    return res.status(400).json({ success: false, error: 'Invalid historyId' });
  }
  try {
    const detail = getValidationDetail(historyId);
    if (!detail) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, detail });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── cURL Import ─────────────────────────────────────────────────
app.post('/api/import/curl', (req, res) => {
  const { curl } = req.body;
  if (!curl || typeof curl !== 'string') {
    return res.status(400).json({ success: false, error: 'Provide { curl: "..." }' });
  }
  if (curl.length > 8000) {
    return res.status(400).json({ success: false, error: 'cURL command too long (max 8000 chars)' });
  }
  const result = parseCurlCommand(curl);
  if (!result.success) {
    return res.status(422).json(result);
  }
  res.json(result);
});

// ─── Transaction Log ──────────────────────────────────────────────

app.get('/api/transactions', (req, res) => {
  try {
    const { limit, offset, status, tranType, correlationId, dateFrom, dateTo } = req.query;
    const result = getTransactionLogs({ limit, offset, status, tranType, correlationId, dateFrom, dateTo });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/transactions/stats', (req, res) => {
  try {
    const stats = getTransactionStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/transactions/tran-types', (req, res) => {
  try {
    const types = getTranTypes();
    res.json({ success: true, types });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/transactions/:correlationId', (req, res) => {
  const { correlationId } = req.params;
  if (!correlationId || correlationId.length > 100 || /[<>"'\\;]/.test(correlationId)) {
    return res.status(400).json({ success: false, error: 'Invalid correlationId' });
  }
  try {
    const detail = getTransactionDetail(correlationId);
    if (!detail) return res.status(404).json({ success: false, error: 'Transaction not found' });
    res.json({ success: true, ...detail });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Production Readiness Checker ────────────────────────────────

app.post('/api/config/readiness-check', async (req, res) => {
  const configName = req.body?.configName;
  try {
    const result = await runReadinessCheck(configName || 'Current Config');
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/config/readiness-history', (req, res) => {
  try {
    const history = getReadinessHistory(parseInt(req.query.limit) || 20);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── OC Core Environment Routes ──────────────────

app.get('/api/oc-core/environments', (req, res) => {
  res.json({ success: true, environments: getEnvironments() });
});

app.get('/api/oc-core/environment/:envId', (req, res) => {
  const env = getEnvironment(req.params.envId);
  if (!env) return res.status(404).json({ success: false, error: 'Unknown environment' });
  res.json({ success: true, environment: env });
});

app.put('/api/oc-core/environment/:envId', (req, res) => {
  const { baseUrl, endpoints } = req.body;
  if (baseUrl && (typeof baseUrl !== 'string' || baseUrl.length > 500)) {
    return res.status(400).json({ success: false, error: 'Invalid baseUrl' });
  }
  const ok = setEnvironmentOverride(req.params.envId, { baseUrl, endpoints });
  if (!ok) return res.status(404).json({ success: false, error: 'Unknown environment' });
  res.json({ success: true });
});

app.get('/api/oc-core/health/:envId', async (req, res) => {
  const result = await checkHealth(req.params.envId);
  res.json(result);
});

app.get('/api/oc-core/resolve/:envId/:endpointType', (req, res) => {
  const resolved = resolveEndpoint(req.params.envId, req.params.endpointType);
  if (!resolved) return res.status(404).json({ success: false, error: 'Cannot resolve endpoint' });
  res.json({ success: true, ...resolved });
});

app.post('/api/oc-core/build-request', (req, res) => {
  const { configId, tranType, queueIn, queueType, hostId, fromIp, params } = req.body;
  const payload = buildOcCoreRequest({ configId, tranType, queueIn, queueType, hostId, fromIp, params });
  res.json({ success: true, payload });
});

app.post('/api/oc-core/generate-curl', (req, res) => {
  const { envId, endpointType, configId, tranType, queueIn, queueType, hostId, fromIp, params } = req.body;
  const payload = buildOcCoreRequest({ configId, tranType, queueIn, queueType, hostId, fromIp, params });
  const curl = generateOcCoreCurl(envId || 'MOCK', endpointType || 'validate', payload);
  if (!curl) return res.status(400).json({ success: false, error: 'Could not generate cURL' });
  res.json({ success: true, curl });
});

// ─── OC Core CAS-Format Transport Routes ──────────────────────────
// These routes use the SHA-256 signed positional-params protocol
// ported from com.paysyslabs.cas.util.OpenConnectUtils

/**
 * POST /api/oc-core/invoke
 * Invoke an OC Core endpoint using CAS-style signed transport.
 *
 * Body:
 *   {
 *     endpoint: string,     // full URL of OC Core endpoint
 *     method: 'GET'|'POST', // HTTP method (default: POST)
 *     params: string[],     // positional params array (tran_type is params[0])
 *     rrn: string,          // correlation/reference ID for logging
 *     tranType: string,     // transaction type (for 400 error parsing)
 *     timeoutMs: number,    // optional timeout override
 *     timeoutCodes: string[], // optional timeout response code overrides
 *   }
 */
app.post('/api/oc-core/invoke', async (req, res) => {
  const { endpoint, method = 'POST', params, rrn, tranType, timeoutMs, timeoutCodes } = req.body;

  if (!endpoint || typeof endpoint !== 'string' || endpoint.length > 1000) {
    return res.status(400).json({ success: false, error: 'Invalid or missing endpoint' });
  }
  if (!Array.isArray(params) || params.length === 0) {
    return res.status(400).json({ success: false, error: 'params must be a non-empty array' });
  }
  // Limit array length to prevent abuse
  if (params.length > 50) {
    return res.status(400).json({ success: false, error: 'params array too large (max 50)' });
  }

  const opts = {
    rrn: rrn || '',
    tranType: tranType || String(params[0]),
    ...(timeoutMs && { timeoutMs: parseInt(timeoutMs) }),
    ...(Array.isArray(timeoutCodes) && { timeoutCodes }),
  };

  try {
    const result = method.toUpperCase() === 'GET'
      ? await getAndParse(endpoint, params, opts)
      : await postAndParse(endpoint, params, opts);

    const httpStatus = result.success ? 200 : (result.errorCode === 'OC_TIMEOUT' ? 504 : 422);
    res.status(httpStatus).json({ ...result, endpoint, method: method.toUpperCase(), params_count: params.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/oc-core/invoke/preview
 * Preview signed URL + body without making the actual call.
 * Useful for debugging and cURL generation.
 */
app.post('/api/oc-core/invoke/preview', (req, res) => {
  const { endpoint, method = 'POST', params } = req.body;

  if (!endpoint || typeof endpoint !== 'string' || endpoint.length > 1000) {
    return res.status(400).json({ success: false, error: 'Invalid or missing endpoint' });
  }
  if (!Array.isArray(params) || params.length === 0) {
    return res.status(400).json({ success: false, error: 'params must be a non-empty array' });
  }

  const isGet = method.toUpperCase() === 'GET';
  const signedUrl  = isGet ? buildSignedGetUrl(endpoint, params) : buildSignedPostUrl(endpoint, params);
  const postBody   = isGet ? null : buildPostBody(params);

  const curlLines = [
    `curl -X ${method.toUpperCase()} "${signedUrl}"`,
    ...(isGet ? [] : [
      '  -H "Content-Type: text/plain"',
      `  -d '${postBody}'`,
    ]),
  ];

  res.json({
    success: true,
    method: method.toUpperCase(),
    signedUrl,
    postBody,
    curl: curlLines.join(' \\\n'),
    params_count: params.length,
    note: 'Signature uses SHA-256(URL-encoded params + ,secret). Secret masked from output.',
  });
});

/**
 * POST /api/oc-core/parse-response
 * Parse a raw OC Core response string into structured result.
 * Useful for testing / debugging existing OC Core logs.
 */
app.post('/api/oc-core/parse-response', (req, res) => {
  const { raw, tranType } = req.body;
  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({ success: false, error: 'Provide { raw: "...json string..." }' });
  }
  const result = parseOcCoreResponse(raw, tranType);
  res.json(result);
});

/**
 * POST /api/oc-core/passthrough
 * Forward Postman collection format (JSON body) directly to OC Core.
 * This is for testing connectivity with your existing Postman collection.
 * 
 * Body:
 *   {
 *     endpoint: string,         // OC Core URL
 *     method: 'GET'|'POST',     // HTTP method
 *     body: object,             // The JSON body from Postman (with meta_data + body)
 *     timeoutMs: number         // optional timeout
 *   }
 */
app.post('/api/oc-core/passthrough', async (req, res) => {
  const { endpoint, method = 'GET', body, timeoutMs = 30000 } = req.body;

  if (!endpoint || typeof endpoint !== 'string' || endpoint.length > 1000) {
    return res.status(400).json({ success: false, error: 'Invalid or missing endpoint' });
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ success: false, error: 'Body must be an object' });
  }

  try {
    const fetchMethod = method.toUpperCase();
    const options = {
      method: fetchMethod,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(body), // Always include body for both GET and POST
    };

    const response = await fetch(endpoint, options);
    const responseText = await response.text();
    
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { raw: responseText };
    }

    res.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: parsed,
      meta_data: body.meta_data,
    });
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      res.status(504).json({ success: false, error: 'Request timeout', code: 'OC_TIMEOUT' });
    } else if (err.code === 'ECONNREFUSED') {
      res.status(503).json({ success: false, error: 'Connection refused - OC Core unreachable' });
    } else {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// ─── 404 Handler ─────────────────────────────────
app.use((req, res) => {
  // Sanitize reflected URL to prevent content injection
  const safeUrl = req.originalUrl.substring(0, 200).replace(/[<>"']/g, '');
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${safeUrl}` });
});

// ─── Global Error Handler ────────────────────────
app.use((err, req, res, _next) => {
  console.error(`  \x1b[31mERROR\x1b[0m ${req.method} ${req.originalUrl}:`, err.message);
  res.status(err.status || 500).json({
    success: false,
    error: IS_PROD ? 'Internal server error' : err.message,
  });
});

// ─── Export for testing ──────────────────────────
export { app, init };

// ─── Start Server ────────────────────────────────
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
if (!isTestEnv) {
init().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`\n  OpenConnect Server v${process.env.npm_package_version || '1.0.0'}`);
    console.log(`  ──────────────────`);
    console.log(`  URL:     http://localhost:${PORT}`);
    console.log(`  Env:     ${IS_PROD ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`  Mode:    Dynamic (connect via UI)`);
    console.log(`  Status:  Running\n`);
  });

  // ─── Graceful Shutdown ───────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n  Received ${signal}. Shutting down gracefully...`);
    await dynamicDb.disconnect();
    server.close(() => {
      console.log('  Server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    console.error('  \x1b[31mUnhandled Rejection:\x1b[0m', err);
  });
});
}
