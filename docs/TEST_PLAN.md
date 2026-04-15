# OpenConnect Configuration UI — Test Plan

**Project:** Open Connect Configuration UI  
**Author:** Uneeb Ahmed  
**Stack:** Node.js · Express · SQLite (better-sqlite3) · React · Vitest · Supertest  
**Last Updated:** April 2026  

---

## Overview

This document covers all test cases written for the OpenConnect Config project. Tests are organized by layer and concern, matching the `/tests` directory structure.

Run all tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

---

## Test Files

| File | Scope | Tests |
|---|---|---|
| `tests/db.test.js` | Database layer (SQLite) | 12 |
| `tests/api.test.js` | REST API endpoints | 44 |
| `tests/security.test.js` | Security & safety | 36 |
| `tests/dynamic-db.test.js` | Dynamic DB module | 17 |
| **Total** | | **109** |

---

## 1. Database Layer Tests — `tests/db.test.js`

Tests `server/db.js`: SQLite schema, seeding, reset, and CRUD.

### 1.1 Schema Initialization

| # | Test Case | Expected |
|---|---|---|
| DB-01 | `initSchema()` creates all 8 required tables | Tables exist: `ws_config`, `ws_token_config`, `ws_endpoint_config`, `ws_response_definition`, `ws_req_param_details`, `tran_req_map`, `saved_configs`, `db_connections` |
| DB-02 | `initSchema()` called twice does not throw | Idempotent — no error |

### 1.2 Reset Database

| # | Test Case | Expected |
|---|---|---|
| DB-03 | `resetDb()` clears all 6 config tables | `ws_config` count = 0 after reset |
| DB-04 | `resetDb()` does not touch `saved_configs` | App-level config storage is preserved |

### 1.3 Seed Demo Data

| # | Test Case | Expected |
|---|---|---|
| DB-05 | `seedDemoData()` inserts demo configs when table is empty | `saved_configs` count > 0 |
| DB-06 | `seedDemoData()` called twice does not duplicate data | Count unchanged on second call |
| DB-07 | Seeded config data is valid JSON with expected shape | `config_data` parses without error; has `client` and `service` fields |

### 1.4 CRUD Operations

| # | Test Case | Expected |
|---|---|---|
| DB-08 | INSERT + SELECT `ws_config` record | Record stored with correct `base_url`, `type`, `service_name`; `created_at` auto-set |
| DB-09 | INSERT `ws_endpoint_config` with defaults | `request_format='JSON'`, `response_format='JSON'`, `connection_timeout=5000`, `read_timeout=30000` |
| DB-10 | Foreign key constraint on `ws_endpoint_config` | INSERT with non-existent `config_id` throws |
| DB-11 | INSERT + SELECT `db_connections` record | All fields stored correctly including `port`, `password` |
| DB-12 | INSERT + SELECT `tran_req_map` with all fields | `tran_id`, `param_name`, `is_mandatory`, `max_length`, `regex`, `log_parameter`, `log_column` correctly stored |

---

## 2. API Endpoint Tests — `tests/api.test.js`

Tests all Express routes in `server/index.js` via HTTP with Supertest.

### 2.1 Health Check

| # | Endpoint | Test Case | Expected |
|---|---|---|---|
| API-01 | `GET /api/health` | Returns status in SQLite mode | `status: 'ok'`, `mode: 'sqlite'`, `connected: true` |

### 2.2 Execute SQL

| # | Endpoint | Test Case | Expected |
|---|---|---|---|
| API-02 | `POST /api/execute-sql` | Execute INSERT statement | `200`, `success: true`, `results[0].type: 'INSERT'`, `changes: 1` |
| API-03 | `POST /api/execute-sql` | Execute SELECT statement | `200`, `results[0].type: 'SELECT'`, rows returned |
| API-04 | `POST /api/execute-sql` | Execute multiple statements in a transaction | `200`, 3 results, SELECT returns only the 2 tagged rows just inserted |
| API-05 | `POST /api/execute-sql` | Skip empty strings and comments (`--`) | `200`, `results: []` |
| API-06 | `POST /api/execute-sql` | Reject DROP statement | `400`, error matches `/not allowed/i` |
| API-07 | `POST /api/execute-sql` | Reject ALTER statement | `400`, error matches `/not allowed/i` |
| API-08 | `POST /api/execute-sql` | Reject CREATE statement | `400`, error matches `/not allowed/i` |
| API-09 | `POST /api/execute-sql` | Body `statements` is a string, not array | `400`, error includes `Provide` |
| API-10 | `POST /api/execute-sql` | Empty body | `400` |

### 2.3 Verify (Read All Tables)

| # | Endpoint | Test Case | Expected |
|---|---|---|---|
| API-11 | `GET /api/verify` | Returns all 6 config tables | `success: true`, `mode: 'sqlite'`, data has all 6 keys, `counts` defined |
| API-12 | `GET /api/verify` | Count matches data array length for each table | `counts[table] === data[table].length` for all 6 tables |

### 2.4 Get Single Table

| # | Endpoint | Test Case | Expected |
|---|---|---|---|
| API-13 | `GET /api/table/ws_config` | Valid table name | `200`, `success: true`, `rows` array |
| API-14 | `GET /api/table/users` | Invalid table name | `400`, error matches `/Invalid table/` |
| API-15 | `GET /api/table/ws_config;DROP TABLE ws_config` | SQL-injection-style name | `400` |

### 2.5 Reset

| # | Endpoint | Test Case | Expected |
|---|---|---|---|
| API-16 | `POST /api/reset` | Resets SQLite demo tables | `200`, `success: true`, `mode: 'sqlite'`, `ws_config` count = 0 |

### 2.6 Saved Configurations CRUD

| # | Endpoint | Test Case | Expected |
|---|---|---|---|
| API-17 | `POST /api/configs` | Save new config | `200`, `success: true`, `id > 0` |
| API-18 | `GET /api/configs` | List configs (no `config_data` in list) | `200`, array of objects with `name`, `client`; no `config_data` field |
| API-19 | `GET /api/configs/:id` | Get single config with parsed JSON data | `200`, `config_data` is an object (parsed) |
| API-20 | `GET /api/configs/:id` | Non-existent ID | `404`, `success: false` |
| API-21 | `GET /api/configs/:id` | Non-numeric ID (`abc`) | `400`, error matches `/Invalid id/` |
| API-22 | `DELETE /api/configs/:id` | Delete existing config | `200`, subsequent GET returns `404` |
| API-23 | `DELETE /api/configs/:id` | Delete non-existent ID | `404` |
| API-24 | `POST /api/configs` | Missing required fields | `400`, error matches `/required/` |
| API-25 | `POST /api/configs` | Name > 200 characters | `400`, error matches `/maximum length/` |
| API-26 | `POST /api/configs` | Config data > 500KB | `400` or `413` (never `200`) |

### 2.7 Saved Database Connections CRUD

| # | Endpoint | Test Case | Expected |
|---|---|---|---|
| API-27 | `POST /api/db/connections` | Save valid connection | `200`, `success: true`, `id > 0` |
| API-28 | `GET /api/db/connections` | List connections — no passwords in list | `200`, each item lacks `password` field |
| API-29 | `GET /api/db/connections/:id` | Password field is masked | `password === '••••••••'`, not plaintext |
| API-30 | `GET /api/db/connections/:id` | Non-existent ID | `404` |
| API-31 | `DELETE /api/db/connections/:id` | Delete connection | `200`, subsequent GET returns `404` |
| API-32 | `POST /api/db/connections` | Missing required fields | `400`, error matches `/required/` |
| API-33 | `POST /api/db/connections` | Unsupported DB type (`oracle`) | `400`, error matches `/Unsupported/` |
| API-34 | `POST /api/db/connections` | Host > 255 characters | `400`, error matches `/maximum length/` |

### 2.8 External DB Connection Management

| # | Endpoint | Test Case | Expected |
|---|---|---|---|
| API-35 | `GET /api/db/status` | No connection active | `connected: false` |
| API-36 | `POST /api/db/disconnect` | Already disconnected | `200`, `success: true` (idempotent) |
| API-37 | `GET /api/db/test` | No active connection | `connected: false` |
| API-38 | `POST /api/db/connect` | Missing required fields | `400`, error matches `/required/` |
| API-39 | `POST /api/db/connect` | Unsupported type (`oracle`) | `400`, error matches `/Unsupported/` |
| API-40 | `POST /api/db/connect` | Port `-1` | `400`, error matches `/Port must be/` |
| API-41 | `POST /api/db/connect` | Port `0` | `400`, error matches `/Port must be/` |
| API-42 | `POST /api/db/connect` | Port `70000` | `400`, error matches `/Port must be/` |
| API-43 | `POST /api/db/connect` | Host > 255 characters | `400`, error matches `/maximum length/` |

### 2.9 404 Handler

| # | Endpoint | Test Case | Expected |
|---|---|---|---|
| API-44 | `GET /api/nonexistent` | Unknown route | `404`, JSON body with `success: false` and `Route not found` |
| API-45 | `POST /api/unknown/route` | Unknown POST route | `404`, error includes method and path |

---

## 3. Security & Safety Tests — `tests/security.test.js`

### 3.1 SQL Injection Prevention

| # | Test Case | Expected |
|---|---|---|
| SEC-01 | INSERT with single quote in value (`O'Brien`) | `200` — stored correctly as `O'Brien Service` in DB |
| SEC-02 | INSERT with `; DROP TABLE ws_config;--` appended | Error or insert-only — `ws_config` table still exists |
| SEC-03 | `GET /api/table/sqlite_master` | `400` — not in allowlist |
| SEC-04 | `GET /api/table/../../etc/passwd` | `400` or `404` — never `200` |

### 3.2 Destructive Statement Blocking (SQLite)

| # | Test Case | Expected |
|---|---|---|
| SEC-05 | `DROP TABLE ws_config` | `400`, error matches `/not allowed/i` |
| SEC-06 | `ALTER TABLE ws_config ADD COLUMN evil TEXT` | `400`, error matches `/not allowed/i` |
| SEC-07 | `CREATE TABLE malicious (...)` | `400`, error matches `/not allowed/i` |
| SEC-08 | `drop table ws_config` (lowercase) | `400` — case-insensitive blocking |
| SEC-09 | `Drop Table ws_config` (mixed case) | `400` — case-insensitive blocking |
| SEC-10 | `DROP TABLE ws_config` (uppercase) | `400` — case-insensitive blocking |

### 3.3 Reset Protection

| # | Test Case | Expected |
|---|---|---|
| SEC-11 | `POST /api/reset` in SQLite mode | `200`, `mode: 'sqlite'` — allowed |
| SEC-12 | Data cleared after reset | `ws_config` count = 0 |

> **Note:** Reset is blocked with `403` when connected to an external DB (mssql/postgres/mysql). This is enforced at the API layer — not testable without a real connection, but the backend code path is covered.

### 3.4 Password Masking

| # | Test Case | Expected |
|---|---|---|
| SEC-13 | `GET /api/db/connections/:id` with saved password | `password === '••••••••'`— never returns plaintext |
| SEC-14 | `GET /api/db/connections/:id` with empty password | `password === ''` |
| SEC-15 | `GET /api/db/connections` (list endpoint) | No `password` field in any item |

### 3.5 Input Length Validation

| # | Test Case | Expected |
|---|---|---|
| SEC-16 | Config `name` > 200 chars | `400`, error matches `/maximum length/` |
| SEC-17 | Config `client` > 100 chars | `400`, error matches `/maximum length/` |
| SEC-18 | DB connection `host` > 255 chars (save endpoint) | `400`, error matches `/maximum length/` |
| SEC-19 | DB connection `database_name` > 128 chars | `400`, error matches `/maximum length/` |
| SEC-20 | DB connection `username` > 128 chars | `400`, error matches `/maximum length/` |
| SEC-21 | DB connect `host` > 255 chars (connect endpoint) | `400`, error matches `/maximum length/` |

### 3.6 Port Range Validation

| # | Test Case | Expected |
|---|---|---|
| SEC-22 | `POST /api/db/connect` with port `-1` | `400`, error matches `/Port must be/` |
| SEC-23 | `POST /api/db/connect` with port `70000` | `400`, error matches `/Port must be/` |
| SEC-24 | `POST /api/db/connect` with port `0` | `400`, error matches `/Port must be/` |

### 3.7 Request Size Limits

| # | Test Case | Expected |
|---|---|---|
| SEC-25 | Config data > 500KB | `400` (app check) or `413` (Express body limit) — never `200` |

### 3.8 Error Handling

| # | Test Case | Expected |
|---|---|---|
| SEC-26 | `GET /api/does-not-exist` | `404`, `Content-Type: application/json`, `success: false` |
| SEC-27 | `POST /api/does-not-exist` | `404`, error contains `Route not found` |

### 3.9 Database Type Whitelist

| # | Test Case | Expected |
|---|---|---|
| SEC-28 | `type: 'oracle'` | `400`, error matches `/Unsupported/` |
| SEC-29 | `type: 'sqlite'` | `400`, error matches `/Unsupported/` |
| SEC-30 | `type: 'mongodb'` | `400`, error matches `/Unsupported/` |
| SEC-31 | `type: 'redis'` | `400`, error matches `/Unsupported/` |
| SEC-32 | `type: 'cassandra'` | `400`, error matches `/Unsupported/` |
| SEC-33 | `type: 'SQL Server'` | `400`, error matches `/Unsupported/` |
| SEC-34 | `type: ''` | `400` |
| SEC-35 | `type: 'mssql'` (valid — fails on no DB, not on validation) | `400` or `429` — error is NOT `Unsupported` |
| SEC-36 | `type: 'postgres'` | `400` or `429` — error is NOT `Unsupported` |
| SEC-37 | `type: 'mysql'` | `400` or `429` — error is NOT `Unsupported` |

---

## 4. Dynamic DB Module Tests — `tests/dynamic-db.test.js`

Tests `server/dynamic-db.js` in isolation — no real DB connections needed.

### 4.1 Connection State

| # | Test Case | Expected |
|---|---|---|
| DDB-01 | Module starts disconnected | `isConnected() === false` |
| DDB-02 | `getStatus()` when disconnected | `{ connected: false, type: null, host: null, database: null }` |
| DDB-03 | `getType()` when disconnected | Returns `null` |
| DDB-04 | `disconnect()` when already disconnected | Resolves without throwing |
| DDB-05 | `testConnection()` when disconnected | `{ connected: false, error: 'No active connection' }` |

### 4.2 Operations Without a Connection

| # | Test Case | Expected |
|---|---|---|
| DDB-06 | `executeSql(['SELECT 1'])` with no connection | Throws `/No database connected/` |
| DDB-07 | `getAllData()` with no connection | Throws `/No database connected/` |
| DDB-08 | `getTable('ws_config')` with no connection | Throws `/No database connected/` |
| DDB-09 | `getTable('users')` — invalid table name | Throws `/Invalid table name/` regardless of connection |
| DDB-10 | `getTable('ws_config; DROP TABLE ws_config')` | Throws `/Invalid table name/` |

### 4.3 Connect Validation

| # | Test Case | Expected |
|---|---|---|
| DDB-11 | `connect({ type: 'oracle', ... })` | Throws `/Unsupported database type/` |
| DDB-12 | Failed connection resets state | `isConnected() === false` after any failed `connect()` |

### 4.4 Statement Validation (Behavior Documentation)

Validated indirectly via API and security tests. Expected behavior:

| Statement Type | Allowed |
|---|---|
| `SELECT ...` | ✅ Yes |
| `INSERT ...` | ✅ Yes |
| `DELETE ...` | ❌ Blocked — `BLOCKED: DELETE statements are not allowed` |
| `UPDATE ...` | ❌ Blocked — `BLOCKED: UPDATE statements are not allowed` |
| `DROP ...` | ❌ Blocked — `BLOCKED: Destructive statements are not allowed` |
| `ALTER ...` | ❌ Blocked — `BLOCKED: Destructive statements are not allowed` |
| `TRUNCATE ...` | ❌ Blocked — `BLOCKED: Destructive statements are not allowed` |
| `-- comment` | ⏭ Skipped silently |
| Empty string | ⏭ Skipped silently |

---

## 5. Not Covered (Requires Real Database)

These cases require an active connection to SQL Server / PostgreSQL / MySQL and are not run in CI:

| # | Test Case | How to Test Manually |
|---|---|---|
| EXT-01 | Connect to `Raast_Openconnect_uneeb` via SQL Server | Use "Connect DB" in the UI while on Jazz VPN |
| EXT-02 | `POST /api/reset` blocked when external DB connected | Connect via UI, then call `POST /api/reset` → expect `403` |
| EXT-03 | `DELETE` statement blocked on external DB | Connect, then try `POST /api/execute-sql` with DELETE → expect `400` |
| EXT-04 | `UPDATE` statement blocked on external DB | Same as above with UPDATE |
| EXT-05 | `POST /api/db/test` returns healthy when connected | Connect, then `GET /api/db/test` → `connected: true` |
| EXT-06 | `GET /api/verify` returns real table data | Connect, then GET verify → returns rows from SQL Server |
| EXT-07 | Transaction rollback on partial failure | Send statements where last INSERT fails → all rolled back |
| EXT-08 | Rate limit triggers on 11th connect attempt | Send > 10 `POST /api/db/connect` within 60s → `429` |

---

## 6. Test Coverage Summary

| Area | Covered | Method |
|---|---|---|
| SQLite schema creation | ✅ | Unit |
| SQLite CRUD | ✅ | Unit |
| FK constraints | ✅ | Unit |
| All 9 API route groups | ✅ | Integration |
| Happy path (200s) | ✅ | Integration |
| Validation errors (400s) | ✅ | Integration |
| Not found (404s) | ✅ | Integration |
| SQL injection prevention | ✅ | Integration |
| Destructive SQL blocking (SQLite) | ✅ | Integration |
| Destructive SQL blocking (external DB) | ⚠️ Manual only |
| Password masking | ✅ | Integration |
| Input length limits | ✅ | Integration |
| Port range validation | ✅ | Integration |
| Request size limits | ✅ | Integration |
| DB type whitelist | ✅ | Integration |
| Dynamic DB state management | ✅ | Unit |
| Rate limiting | ⚠️ Manual only (10 req/min limit) |
| Real DB connections | ⚠️ Manual only (requires VPN) |
