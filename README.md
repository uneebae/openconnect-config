<p align="center">
  <img src="src/img/favicon.png" alt="OpenConnect Logo" width="80" />
</p>

<h1 align="center">OpenConnect Configuration</h1>

<p align="center">
  <strong>No-code API endpoint configuration automation for payment systems</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#database-connections">Database Connections</a> •
  <a href="#security">Security</a> •
  <a href="#testing">Testing</a> •
  <a href="#project-structure">Project Structure</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-5.2-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-demo_db-003B57?style=flat-square&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/SQL_Server-mssql_12-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tests-119_passing-22C55E?style=flat-square&logo=vitest&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
</p>

---

## Overview

**OpenConnect Configuration** is a production-grade web application that automates the process of configuring payment gateway API endpoints. Instead of manually writing SQL scripts and JSON configs for each new client integration, teams use a guided multi-step wizard to generate, test, and deploy configurations in minutes.

Built for **Paysys Labs** to streamline integrations like **Ethswitch**, **JazzCash**, and other payment APIs — reducing configuration time from **weeks to minutes**.

The backend supports **dynamic multi-database connections** (SQL Server, PostgreSQL, MySQL, SQLite) at runtime, with AES-256-GCM password encryption, OWASP-aligned security hardening, and a full automated test suite of **119 tests**.

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-step Wizard** | 6-step guided flow: Service → Endpoint → Auth → Fields → Responses → Review |
| **Real-time SQL Generation** | Auto-generates production SQL from form inputs, preview before execution |
| **JSON Export** | One-click export of full configuration as structured JSON |
| **Demo Database Testing** | Execute generated SQL against a local SQLite DB and verify results instantly |
| **Dynamic DB Connections** | Connect to SQL Server, PostgreSQL, or MySQL at runtime via the UI |
| **Config Persistence** | Save, load, and manage multiple configurations via the backend |
| **OAuth2 Token Setup** | Built-in token endpoint configuration with secret masking |
| **Field Mapping Builder** | Dynamic table for mapping request parameters with regex validation |
| **Response Code Translation** | Map external API response codes to internal codes with wildcard support |
| **Live Backend Status** | Real-time health check indicator in the UI header |
| **Encrypted Credentials** | Saved DB passwords encrypted at rest with AES-256-GCM |
| **Professional Dark UI** | Glassmorphism design, smooth animations, Inter + JetBrains Mono fonts |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/uneebae/openconnect-config.git
cd openconnect-config

# 2. Install dependencies
npm install

# 3. (Optional) Configure environment
cp .env.example .env
# Edit .env to set DB_ENCRYPTION_KEY and other settings

# 4. Start the backend server (port 3002)
npm run server

# 5. In a new terminal, start the frontend (port 3000)
npm run dev
```

Open **http://localhost:3000** in your browser. The UI will automatically connect to the backend.

### One-Command Start (Linux/macOS)

```bash
npm run dev:full
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Express server port |
| `NODE_ENV` | `development` | Environment mode |
| `DB_ENCRYPTION_KEY` | *(dev default)* | AES-256-GCM key for encrypting stored passwords — **change in production** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Port 3000)                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              React + Tailwind CSS Frontend           │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │  Wizard  │  │   SQL    │  │  Config Manager  │  │    │
│  │  │  Steps   │  │ Preview  │  │  (Save/Load)     │  │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │         DB Connection Manager Modal          │   │    │
│  │  │  (SQL Server / PostgreSQL / MySQL profiles)  │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │ /api/*                            │
│  ┌───────────────────────▼─────────────────────────────┐    │
│  │              Vite Dev Server (Proxy)                 │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                Express.js Backend (Port 3002)                │
│  helmet · express-rate-limit · cors · input validation       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Execute  │ │  Verify  │ │  Config  │ │  Dynamic DB   │  │
│  │   SQL    │ │   Data   │ │   CRUD   │ │  Connection   │  │
│  │ (≤200    │ │          │ │          │ │  Manager      │  │
│  │ stmts)   │ │          │ │          │ │               │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘  │
│       └────────────┴────────────┘               │           │
│                    │                             │           │
│  ┌─────────────────▼──────────┐   ┌─────────────▼────────┐  │
│  │  SQLite (demo.db)          │   │  External DB         │  │
│  │  Schema + seed data        │   │  SQL Server / PG     │  │
│  │  AES-256-GCM passwords     │   │  MySQL               │  │
│  │  db_connections table      │   │  SELECT + INSERT only │  │
│  └────────────────────────────┘   └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
openconnect-config/
├── index.html                  # App entry point (Vite)
├── package.json                # Dependencies & scripts
├── vite.config.js              # Vite config with API proxy
├── vitest.config.js            # Vitest test configuration
├── setup.sh                    # Automated setup script
│
├── src/
│   ├── index.jsx               # React DOM mount
│   ├── App.jsx                 # Root component
│   ├── OpenConnectConfigUI.jsx # Main application (~1100 lines)
│   └── img/
│       ├── favicon.png         # App logo
│       └── pfp.jpg             # Developer profile picture
│
├── server/
│   ├── index.js                # Express API server (all routes, security middleware)
│   ├── db.js                   # SQLite schema, seed data, AES-256-GCM crypto
│   ├── dynamic-db.js           # Runtime multi-DB connection manager
│   └── view-db.js              # CLI utility to inspect database
│
├── tests/
│   ├── helpers.js              # Shared test utilities
│   ├── db.test.js              # Database layer tests (12 tests)
│   ├── api.test.js             # API endpoint tests (44 tests)
│   ├── security.test.js        # Security & hardening tests (46 tests)
│   └── dynamic-db.test.js      # Multi-DB connection tests (17 tests)
│
├── public/
│   └── index.html              # Static fallback
│
└── docs/
    ├── TEST_PLAN.md                # Full test case documentation (119 tests)
    ├── IMPLEMENTATION_GUIDE.md     # Step-by-step technical usage
    ├── EXECUTIVE_SUMMARY.md        # Business overview & ROI
    ├── TROUBLESHOOTING_GUIDE.md    # Common issues & solutions
    ├── DELIVERY_SUMMARY.md         # Delivery notes
    └── ethswitch-config-sample.json # Example Ethswitch configuration
```

---

## API Reference

All endpoints are served from `http://localhost:3002`.

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check — returns server status |
| `POST` | `/api/execute-sql` | Execute SQL statements (max 200, SELECT + INSERT only) |
| `GET` | `/api/verify` | Retrieve all data from all configuration tables |
| `GET` | `/api/table/:name` | Get rows from a specific table |
| `POST` | `/api/reset` | Clear all config tables — **blocked when external DB is connected** |

### Saved Configurations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/configs` | List all saved configurations |
| `POST` | `/api/configs` | Save a new configuration |
| `GET` | `/api/configs/:id` | Load a specific saved configuration |
| `DELETE` | `/api/configs/:id` | Delete a saved configuration |

### Database Connection Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/db/connect` | Connect to an external database |
| `POST` | `/api/db/disconnect` | Disconnect from external database |
| `GET` | `/api/db/status` | Get current connection status (no credentials exposed) |
| `POST` | `/api/db/test` | Test a connection without saving |
| `GET` | `/api/db/connections` | List saved connection profiles |
| `POST` | `/api/db/connections` | Save a new connection profile (password encrypted at rest) |
| `PUT` | `/api/db/connections/:id` | Update a saved connection profile |
| `DELETE` | `/api/db/connections/:id` | Delete a saved connection profile |

### Example: Execute SQL

```bash
curl -X POST http://localhost:3002/api/execute-sql \
  -H "Content-Type: application/json" \
  -d '{
    "statements": [
      "INSERT INTO ws_config (base_url, type, service_name) VALUES ('"'"'https://api.example.com'"'"', '"'"'payment-gateway'"'"', '"'"'My Gateway'"'"')"
    ]
  }'
```

### Example: Connect to SQL Server

```bash
curl -X POST http://localhost:3002/api/db/connect \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mssql",
    "host": "10.5.70.5",
    "port": 1440,
    "database": "MyDatabase",
    "user": "appuser",
    "password": "secret"
  }'
```

---

## Database Schema

The demo database (`server/demo.db`) contains **8 tables**:

| Table | Purpose |
|-------|---------|
| `ws_config` | Service registration (base URL, type, name) |
| `ws_token_config` | OAuth2 token settings (field paths, expiry) |
| `ws_endpoint_config` | Endpoint details (method, path, headers, timeouts) |
| `ws_response_definition` | Response code mapping (API code → internal code) |
| `ws_req_param_details` | Transaction routing config (queues, host ID) |
| `tran_req_map` | Field mappings (param name, regex, priority) |
| `saved_configs` | Saved UI configurations (JSON blob storage) |
| `db_connections` | Saved external DB profiles (passwords AES-256-GCM encrypted) |

The database auto-creates on first server start and seeds **2 demo configurations** (Ethswitch, JazzCash).

---

## Database Connections

The application supports **dynamic runtime connections** to external databases — no code changes required.

### Supported Drivers

| Database | Driver | Notes |
|----------|--------|-------|
| SQL Server | `mssql` 12.2 | TDS protocol, Windows/SQL auth |
| PostgreSQL | `pg` 8.20 | Standard Postgres wire protocol |
| MySQL / MariaDB | `mysql2` 3.22 | Binary protocol |
| SQLite (demo) | `better-sqlite3` 12.8 | Local embedded, always available |

### Adding a Connection

1. Click **"Connect Database"** in the UI header
2. Fill in host, port, database name, username, password
3. Click **"Test"** to verify connectivity before saving
4. Click **"Save & Connect"** — credentials are encrypted at rest

### Execution Safety

When an external DB is connected, the SQL execution path applies:
- **Whitelist**: Only `SELECT` and `INSERT` statements are allowed
- **Blocked**: `DELETE`, `UPDATE`, `DROP`, `ALTER`, `TRUNCATE`
- **Limit**: Maximum **200 statements** per request
- **SQL comment bypass protection**: Block comments (`/* ... */`) are stripped before statement validation
- **Reset endpoint**: Returns `403 Forbidden` to prevent accidental data wipes

---

## Security

This application is hardened against the OWASP Top 10 with the following controls:

| Control | Implementation |
|---------|---------------|
| **Security headers** | `helmet` middleware (CSP, HSTS, X-Frame-Options, etc.) |
| **Rate limiting** | `express-rate-limit` — 100 req/15 min per IP |
| **SQL injection prevention** | Parameterized queries + statement whitelist + keyword blocking |
| **Password encryption** | AES-256-GCM with random IV per encryption via Node.js `crypto` |
| **SQL comment bypass protection** | Block comments stripped before validation |
| **Credential leak prevention** | `/api/db/status` never returns username or password |
| **Statement count limit** | Max 200 SQL statements per execute request |
| **XSS / content injection** | 404 handler sanitizes reflected URL (strips `<>"'`) |
| **CORS** | Restricted to frontend origin |
| **Input validation** | Required fields validated on all mutating endpoints |

> **Production Note:** Set a strong `DB_ENCRYPTION_KEY` in your `.env` before deploying. The default dev key must not be used in production.

---

## Testing

The project ships with a full automated test suite built with **Vitest** and **Supertest**.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

### Test Coverage Summary

| Suite | File | Tests |
|-------|------|-------|
| Database Layer | `tests/db.test.js` | 12 |
| API Endpoints | `tests/api.test.js` | 44 |
| Security & Hardening | `tests/security.test.js` | 46 |
| Dynamic DB Connections | `tests/dynamic-db.test.js` | 17 |
| **Total** | | **119** |

All **119 tests pass**. See [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) for the full test case documentation.

### Notable Security Tests

- DELETE / UPDATE / TRUNCATE blocked in all execution paths
- SQL block-comment bypass attempts rejected
- Statement count limit enforced (> 200 → 400)
- Saved passwords are never stored in plaintext (encrypted format verified)
- `/api/db/status` does not expose username
- 404 handler does not reflect injectable content

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Vite frontend dev server on port 3000 |
| `server` | `npm run server` | Start Express backend on port 3002 |
| `dev:full` | `npm run dev:full` | Start both backend and frontend (Linux/macOS) |
| `build` | `npm run build` | Build for production (outputs to `dist/`) |
| `preview` | `npm run preview` | Preview production build locally |
| `test` | `npm test` | Run all 119 tests once |
| `test:watch` | `npm run test:watch` | Run tests in watch mode |

---

## Configuration Workflow

1. **Service Config** — Enter the base URL, service type, and name
2. **Endpoint** — Set HTTP method, path, request body template, timeouts
3. **Authentication** — Configure OAuth2 client credentials (optional)
4. **Field Mapping** — Map request parameters with validation rules
5. **Response Codes** — Translate API codes to internal codes
6. **Review & Deploy** — Preview SQL, copy/export, execute against demo or live DB, save

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.3.1 |
| Styling | Tailwind CSS (CDN) | 3.x |
| Icons | Lucide React | 0.383.0 |
| Bundler | Vite | 5.4.21 |
| Backend | Express.js | 5.2.1 |
| Local DB | better-sqlite3 | 12.8.0 |
| SQL Server | mssql | 12.2.1 |
| PostgreSQL | pg | 8.20.0 |
| MySQL | mysql2 | 3.22.0 |
| Security | helmet, express-rate-limit | 8.x, 8.x |
| Encryption | Node.js crypto (AES-256-GCM) | built-in |
| Testing | Vitest + Supertest | 4.1.4, 7.2.2 |
| Fonts | Inter, JetBrains Mono | Google Fonts |

---

## Connecting to a Production Database

The demo SQLite database (`server/demo.db`) is a local placeholder seeded with sample data. To execute configurations against your real database:

1. Open the **"Connect Database"** panel in the UI
2. Enter your production DB credentials (SQL Server, PostgreSQL, or MySQL)
3. Use **"Test Connection"** before saving
4. Once connected, the **"Execute in DB"** button targets your production database
5. Only `SELECT` and `INSERT` are permitted — destructive operations are blocked at the API level

The demo DB auto-generates on startup and is listed in `.gitignore`.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Developed with precision by <strong>Uneeb Ahmed</strong> at <strong>Paysys Labs</strong></sub>
</p>
