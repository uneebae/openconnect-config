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
  <a href="#project-structure">Project Structure</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-CDN-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
</p>

---

## Overview

**OpenConnect Configuration** is a production-grade web application that automates the process of configuring payment gateway API endpoints. Instead of manually writing SQL scripts and JSON configs for each new client integration, teams use a guided multi-step wizard to generate, test, and deploy configurations in minutes.

Built for **Paysys Labs** to streamline integrations like **Ethswitch**, **JazzCash**, and other payment APIs — reducing configuration time from **weeks to minutes**.

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-step Wizard** | 6-step guided flow: Service → Endpoint → Auth → Fields → Responses → Review |
| **Real-time SQL Generation** | Auto-generates production SQL from form inputs, preview before execution |
| **JSON Export** | One-click export of full configuration as structured JSON |
| **Demo Database Testing** | Execute generated SQL against a local SQLite DB and verify results instantly |
| **Config Persistence** | Save, load, and manage multiple configurations via the backend |
| **OAuth2 Token Setup** | Built-in token endpoint configuration with secret masking |
| **Field Mapping Builder** | Dynamic table for mapping request parameters with regex validation |
| **Response Code Translation** | Map external API response codes to internal codes with wildcard support |
| **Live Backend Status** | Real-time health check indicator in the UI header |
| **Professional Dark UI** | Glassmorphism design, smooth animations, Inter + JetBrains Mono fonts |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/paysyslab/openconnect-config.git
cd openconnect-config

# 2. Install dependencies
npm install

# 3. Start the backend server (port 3002)
npm run server

# 4. In a new terminal, start the frontend (port 3000)
npm run dev
```

Open **http://localhost:3000** in your browser. The UI will automatically connect to the backend.

### One-Command Start (Linux/macOS)

```bash
npm run dev:full
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Port 3000)                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │           React + Tailwind CSS Frontend            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │  Wizard   │ │   SQL    │ │  Config Manager  │  │  │
│  │  │  Steps    │ │ Preview  │ │  (Save/Load)     │  │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │ /api/*                        │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │           Vite Dev Server (Proxy)                  │  │
│  └───────────────────────┬───────────────────────────┘  │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                Express.js Backend (Port 3002)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Execute  │ │  Verify  │ │  Config  │ │  Health  │   │
│  │   SQL    │ │   Data   │ │   CRUD   │ │  Check   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────┘   │
│       └─────────────┴────────────┘                       │
│                      │                                   │
│  ┌───────────────────▼───────────────────────────────┐  │
│  │            SQLite Database (demo.db)               │  │
│  │  Tables: ws_config, ws_endpoint_config,            │  │
│  │  ws_token_config, ws_response_definition,          │  │
│  │  ws_req_param_details, tran_req_map,               │  │
│  │  saved_configs                                     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
openconnect-config/
├── index.html                  # App entry point (Vite)
├── package.json                # Dependencies & scripts
├── vite.config.js              # Vite config with API proxy
├── setup.sh                    # Automated setup script
│
├── src/
│   ├── index.jsx               # React DOM mount
│   ├── App.jsx                 # Root component
│   ├── OpenConnectConfigUI.jsx # Main application (wizard, forms, DB testing)
│   └── img/
│       ├── favicon.png         # App logo
│       └── pfp.jpg             # Developer profile picture
│
├── server/
│   ├── index.js                # Express API server (all routes)
│   ├── db.js                   # SQLite schema, seed data, helpers
│   └── view-db.js              # CLI utility to inspect database
│
├── public/
│   └── index.html              # Static fallback
│
└── docs/
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
| `POST` | `/api/execute-sql` | Execute an array of SQL statements in a transaction |
| `GET` | `/api/verify` | Retrieve all data from all configuration tables |
| `GET` | `/api/table/:name` | Get rows from a specific table |
| `POST` | `/api/reset` | Clear all configuration tables (keeps schema) |

### Saved Configurations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/configs` | List all saved configurations |
| `POST` | `/api/configs` | Save a new configuration |
| `GET` | `/api/configs/:id` | Load a specific saved configuration |
| `DELETE` | `/api/configs/:id` | Delete a saved configuration |

### Example: Save a Configuration

```bash
curl -X POST http://localhost:3002/api/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Gateway",
    "client": "Ethswitch",
    "config": { "service": { "baseUrl": "https://api.example.com" } }
  }'
```

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

---

## Database Schema

The demo database contains **7 tables**:

| Table | Purpose |
|-------|---------|
| `ws_config` | Service registration (base URL, type, name) |
| `ws_token_config` | OAuth2 token settings (field paths, expiry) |
| `ws_endpoint_config` | Endpoint details (method, path, headers, timeouts) |
| `ws_response_definition` | Response code mapping (API code → internal code) |
| `ws_req_param_details` | Transaction routing config (queues, host ID) |
| `tran_req_map` | Field mappings (param name, regex, priority) |
| `saved_configs` | Saved UI configurations (JSON blob storage) |

The database auto-creates on first server start and seeds **2 demo configurations** (Ethswitch, JazzCash).

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Vite frontend dev server on port 3000 |
| `server` | `npm run server` | Start Express backend on port 3002 |
| `dev:full` | `npm run dev:full` | Start both backend and frontend |
| `build` | `npm run build` | Build for production (outputs to `dist/`) |
| `preview` | `npm run preview` | Preview production build locally |

---

## Configuration Workflow

1. **Service Config** — Enter the base URL, service type, and name
2. **Endpoint** — Set HTTP method, path, request body template, timeouts
3. **Authentication** — Configure OAuth2 client credentials (optional)
4. **Field Mapping** — Map request parameters with validation rules
5. **Response Codes** — Translate API codes to internal codes
6. **Review & Deploy** — Preview SQL, copy/export, execute in demo DB, save

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.3 |
| Styling | Tailwind CSS (CDN) | 3.x |
| Icons | Lucide React | 0.383 |
| Bundler | Vite | 5.4 |
| Backend | Express.js | 5.2 |
| Database | better-sqlite3 | 12.8 |
| Fonts | Inter, JetBrains Mono | Google Fonts |

---

## Replacing the Demo Database

The current SQLite database (`server/demo.db`) is a **demo placeholder**. To connect to your production database:

1. Update `server/db.js` — replace `better-sqlite3` with your database driver (e.g., `mssql`, `pg`, `mysql2`)
2. Update connection settings with your production credentials
3. Ensure the same table schema exists in your production DB
4. Update the `server/index.js` query methods as needed

The demo DB auto-generates on startup and is listed in `.gitignore` — it will not be committed.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Developed with precision by <strong>Uneeb</strong> at <strong>Paysys Labs</strong></sub>
</p>
