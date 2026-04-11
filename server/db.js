import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'demo.db');

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS ws_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_url TEXT NOT NULL,
      type TEXT NOT NULL,
      service_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ws_token_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_field TEXT,
      expiry_field TEXT,
      expiry_type TEXT DEFAULT 'SECONDS',
      current_token TEXT,
      current_expiry_epoch INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ws_endpoint_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id INTEGER,
      method TEXT NOT NULL,
      endpoint_template TEXT NOT NULL,
      request_format TEXT DEFAULT 'JSON',
      response_format TEXT DEFAULT 'JSON',
      data_template TEXT,
      request_headers TEXT,
      connection_timeout INTEGER DEFAULT 5000,
      read_timeout INTEGER DEFAULT 30000,
      response_code_path TEXT,
      response_include_paths TEXT,
      type TEXT,
      reversal_type TEXT,
      guaranteed INTEGER DEFAULT 0,
      variable_fields TEXT,
      ex_req_res_log TEXT DEFAULT 'Y',
      token_configuration_id INTEGER,
      token_request_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (config_id) REFERENCES ws_config(id)
    );

    CREATE TABLE IF NOT EXISTS ws_response_definition (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id INTEGER,
      match_code TEXT NOT NULL,
      our_code TEXT NOT NULL,
      our_description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ws_req_param_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tran_id INTEGER NOT NULL,
      tran_type TEXT NOT NULL,
      queue_in TEXT,
      queue_type TEXT,
      from_ip TEXT DEFAULT '0.0.0.0',
      host_id INTEGER DEFAULT 1,
      response_type TEXT DEFAULT 'JSON',
      saf_queue TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tran_req_map (
      id INTEGER PRIMARY KEY,
      tran_id INTEGER NOT NULL,
      param_name TEXT NOT NULL,
      value TEXT,
      is_mandatory TEXT DEFAULT 'Y',
      max_length TEXT,
      regex TEXT,
      log_parameter INTEGER DEFAULT 0,
      log_column TEXT,
      is_batch INTEGER DEFAULT 0,
      is_escape INTEGER DEFAULT 0,
      param_priority INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS saved_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client TEXT NOT NULL,
      config_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.close();
}

function seedDemoData() {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as count FROM saved_configs').get();
  if (existing.count === 0) {
    const demoConfigs = [
      {
        name: 'Ethswitch Payment Gateway',
        client: 'Ethswitch',
        config: {
          client: 'Ethswitch',
          service: { baseUrl: 'https://api.ethswitch.com/v1', type: 'payment-gateway', serviceName: 'Ethswitch Payment Gateway' },
          endpoint: { method: 'POST', endpointTemplate: '/transactions/transfer', requestFormat: 'JSON', responseFormat: 'JSON', dataTemplate: '{"fromAccount":"{FROM_ACCOUNT}","toAccount":"{TO_ACCOUNT}","amount":"{AMOUNT}","currency":"{CURRENCY}"}', requestHeaders: { 'Content-Type': 'application/json' }, connectionTimeout: 5000, readTimeout: 30000, responseCodePath: '$.responseCode', responseIncludePaths: '$.rrn,$.description,$.stan', type: 'PAYMENT', reversalType: 'FULL_REVERSAL', guaranteed: true, variableFields: [], exReqResLog: true },
          authentication: null,
          fieldMappings: [
            { id: 1001, paramName: 'fromAccount', value: '{FROM_ACCOUNT}', isMandatory: 'Y', maxLength: 20, regex: '^[0-9]+$', logParameter: 1, logColumn: 'identifier' },
            { id: 1002, paramName: 'toAccount', value: '{TO_ACCOUNT}', isMandatory: 'Y', maxLength: 20, regex: '^[0-9]+$', logParameter: 1, logColumn: 'to_account' },
            { id: 1003, paramName: 'amount', value: '{AMOUNT}', isMandatory: 'Y', maxLength: 15, regex: '^[0-9]+(\\.[0-9]{1,2})?$', logParameter: 1, logColumn: 'amount' }
          ],
          responseCodeMappings: [
            { matchCode: '00', ourCode: '000', ourDescription: 'Approved' },
            { matchCode: '01', ourCode: '100', ourDescription: 'Insufficient Funds' },
            { matchCode: '*', ourCode: '999', ourDescription: 'Unknown Error' }
          ],
          routing: { tranId: 501, tranType: 'FUND_TRANSFER', queueIn: 'ETHSWITCH_API', queueType: 'REQUEST', fromIp: '0.0.0.0', hostId: 1, responseType: 'JSON', safQueue: 'SAF_TRANSFER_QUEUE' }
        }
      },
      {
        name: 'JazzCash Mobile Wallet',
        client: 'JazzCash',
        config: {
          client: 'JazzCash',
          service: { baseUrl: 'https://api.jazzcash.com.pk/v2', type: 'payment-gateway', serviceName: 'JazzCash Mobile Wallet' },
          endpoint: { method: 'POST', endpointTemplate: '/wallet/transfer', requestFormat: 'JSON', responseFormat: 'JSON', dataTemplate: '{"mobileNo":"{MOBILE}","amount":"{AMOUNT}","cnic":"{CNIC}"}', requestHeaders: { 'Content-Type': 'application/json' }, connectionTimeout: 3000, readTimeout: 15000, responseCodePath: '$.status', responseIncludePaths: '$.transactionId,$.message', type: 'PAYMENT', reversalType: 'FULL_REVERSAL', guaranteed: true, variableFields: [], exReqResLog: true },
          authentication: { type: 'OAuth2', tokenField: '$.token', expiryField: '$.expires', expiryType: 'SECONDS', clientId: 'jazzcash_demo', clientSecret: '***', tokenEndpoint: '/auth/token' },
          fieldMappings: [
            { id: 2001, paramName: 'mobileNo', value: '{MOBILE}', isMandatory: 'Y', maxLength: 11, regex: '^03[0-9]{9}$', logParameter: 1, logColumn: 'identifier' },
            { id: 2002, paramName: 'amount', value: '{AMOUNT}', isMandatory: 'Y', maxLength: 10, regex: '^[0-9]+$', logParameter: 1, logColumn: 'amount' }
          ],
          responseCodeMappings: [
            { matchCode: 'SUCCESS', ourCode: '000', ourDescription: 'Success' },
            { matchCode: 'FAILED', ourCode: '100', ourDescription: 'Failed' },
            { matchCode: '*', ourCode: '999', ourDescription: 'Unknown' }
          ],
          routing: { tranId: 601, tranType: 'MOBILE_WALLET', queueIn: 'JAZZCASH_API', queueType: 'REQUEST', fromIp: '0.0.0.0', hostId: 2, responseType: 'JSON', safQueue: 'SAF_JAZZCASH_QUEUE' }
        }
      }
    ];

    const insert = db.prepare('INSERT INTO saved_configs (name, client, config_data) VALUES (?, ?, ?)');
    for (const demo of demoConfigs) {
      insert.run(demo.name, demo.client, JSON.stringify(demo.config));
    }
    console.log('  Demo seed data inserted (2 sample configs)');
  }
  db.close();
}

function resetDb() {
  const db = getDb();
  db.exec(`
    DELETE FROM tran_req_map;
    DELETE FROM ws_response_definition;
    DELETE FROM ws_req_param_details;
    DELETE FROM ws_endpoint_config;
    DELETE FROM ws_token_config;
    DELETE FROM ws_config;
  `);
  db.close();
}

export { getDb, initSchema, resetDb, seedDemoData, DB_PATH };
