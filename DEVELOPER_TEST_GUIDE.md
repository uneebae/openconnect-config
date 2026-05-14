# OpenConnect Configuration — Developer Test Guide

**Version:** 2.0  
**Date:** May 2026  
**Stack:** Node.js · React · Express · SQLite · Vite  

---

## 📋 Quick Start

### Prerequisites
```bash
node --version  # v18+ required
npm --version   # v10+ required
```

### Install & Setup
```bash
cd open-connect-config
npm install

# Create .env file (optional, defaults are provided)
cp .env.example .env  # if exists, or create manually

# Verify setup
npm test  # Runs 119 automated tests
```

### Start All Servers
```bash
npm run dev  # Starts all 3 servers in parallel
```

**Expected Output:**
- Mock API: `http://localhost:3010` ✓
- Backend: `http://localhost:3002` ✓
- Frontend: `http://localhost:3006` (or 3008) ✓

---

## 🎯 Core Features to Test

### 1️⃣ Configuration Wizard (6-Step Flow)

**Location:** Left sidebar under "Configuration Steps"

| Step | What to Test | Expected Result |
|------|--------------|-----------------|
| **Service Config** | Enter Service Base URL, Service Type, Service Name | All fields required; error toast if missing |
| **Endpoint** | Add endpoint path, configure timeout (5000ms default) | Path appended to base URL correctly |
| **Authentication** | Select OAuth2 or API Key; enter credentials | Credentials stored securely (AES-256) |
| **Field Mapping** | Map JSON keys to parameter names | Mappings saved; test with sample request |
| **Response Codes** | Define response code translations (e.g., "200" → "Success") | Response parser uses these definitions |
| **Review & Deploy** | Export config as JSON/SQL; test API endpoint | Config file valid; SQL generates correct schema |

**Manual Test:**
1. Click "Service Config" step button
2. Fill: Base URL = `https://api.example.com`, Service Type = "Payment Gateway", Service Name = "TestAPI"
3. Click "Next" → Continue through all 6 steps
4. On Review & Deploy: Click "Export as JSON" → Save file
5. Verify exported JSON contains all configuration

---

### 2️⃣ Quick Import (Guided Mode)

**Location:** Header → "Quick Import" button

**Test Steps:**
1. Click "Quick Import" → "Guided Import"
2. Enter:
   - Full API URL: `http://localhost:3010/api/v1/test`
   - Service Name: `TestService`
   - Method: `POST`
3. Paste sample request body:
   ```json
   {
     "account_id": "12345",
     "amount": 1000,
     "currency": "PKR"
   }
   ```
4. Paste sample response:
   ```json
   {
     "status": "success",
     "transaction_id": "TXN-123",
     "timestamp": "2026-05-14T10:30:00Z"
   }
   ```
5. Click "Generate Configuration"
6. Verify: Wizard auto-populates with parsed fields

---

### 3️⃣ Quick Import (cURL Mode)

**Location:** Quick Import → "Paste cURL" tab

**Test Steps:**
1. Click "Paste cURL"
2. Paste a cURL command:
   ```bash
   curl -X POST https://api.example.com/v1/payment \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer token123" \
     -d '{"account":"ACC001","amount":500}'
   ```
3. Click "Parse & Import"
4. Verify: Base URL, endpoint path, headers, and body parsed correctly

---

### 4️⃣ Database Testing

**Location:** Left sidebar → "Database" section

**Supported Databases:**
- SQLite (default) ✓
- SQL Server ✓
- PostgreSQL ✓
- MySQL ✓

**Manual Test — SQLite:**
1. Select "SQLite" from Database dropdown
2. Click "Browse" → Select `test.db` (or create new)
3. Click "Test Connection"
4. Expected: Green checkmark + "Connection successful"

**Manual Test — SQL Server:**
1. Select "SQL Server" from dropdown
2. Enter:
   - Server: `localhost` (or your server IP)
   - Port: `1433`
   - Username: `sa`
   - Password: `YourPassword`
   - Database: `master`
3. Click "Test Connection"
4. Expected: Green checkmark

**Create Table:**
1. After connection test passes, click "Create Table"
2. Click "Execute SQL"
3. Expected: New table created in database
4. Verify: Run query in DB client to confirm

---

### 5️⃣ API Validation & Testing

**Location:** "Review & Deploy" → "Target Environment"

#### 5A. Test via Mock API
1. Select Environment: "Mock API (port 3010)"
2. Configure:
   - Endpoint: `/api/v1/payment`
   - Method: `POST`
   - Sample body:
     ```json
     {
       "account_id": "ACC001",
       "amount": 5000,
       "currency": "PKR"
     }
     ```
3. Click "Test API" → "Invoke API"
4. Expected: Response shown with status 200, execution time logged

#### 5B. Test via Backend
1. Select Environment: "Mock API"
2. Body:
   ```json
   {
     "recipient": "02333456789",
     "amount": 1000
   }
   ```
3. Click "Test API"
4. Expected: Mock API responds, response shown in dashboard

---

### 6️⃣ OC Core Transport (CAS Protocol)

**Location:** Review & Deploy → "OC Core Routing Parameters"

#### 6A. Basic SHA-256 Signing
1. Select Environment: **"MPAY Gateway"**
2. Verify: Endpoint auto-set to `/mpg/queueforwarding/`
3. Method auto-set to `GET`
4. Click "Quick Presets" → Select **"1link Title Fetch"**
5. Verify: All 19 parameters auto-populate
6. Click "Preview Signed URL"
7. Expected: Shows full signed URL with:
   - URL format: `http://10.0.142.4:7033/mpg/queueforwarding/title-fetch%2C000000002000%2C0220104400...`
   - SHA-256 signature at end
8. Click "Copy cURL" → Paste in terminal (with `-k` for self-signed)

#### 6B. Test with Custom Parameters
1. Clear preset → Enter manual params:
   - Param 0: `title-fetch`
   - Param 1: `000000002000`
   - Param 2: `0220104400`
   - (Add more as needed)
2. Click "Preview Signed URL"
3. Click "Invoke API" (if MPAY accessible)
4. Expected: Signed URL generated, response parsed

#### 6C. Postman JSON Import
1. Click "Postman JSON Importer" toggle
2. Paste Postman collection request:
   ```json
   {
     "meta_data": {
       "trans_type": "title-fetch"
     },
     "body": {
       "param1": "000000002000",
       "param2": "0220104400"
     }
   }
   ```
3. Click "Extract from Postman"
4. Expected: Auto-converts to positional param array

---

### 7️⃣ Validation History & Logs

**Location:** Left sidebar → "Validation History" / "Transaction Logs"

**Test Steps:**
1. Make several API calls (from sections 5 & 6)
2. Click "Validation History"
3. Expected:
   - All previous invocations listed
   - Shows endpoint, status, response time
   - Can click to view full response
4. Click "Transaction Logs"
5. Expected:
   - Detailed transaction records
   - Includes request/response pair
   - Execution timestamp and status

---

### 8️⃣ Production Readiness Checker

**Location:** Left sidebar → "Production Readiness"

**What It Checks (21 criteria):**
- ✓ HTTPS endpoints (production only)
- ✓ Valid credentials encrypted
- ✓ Response codes mapped
- ✓ Database connection secured
- ✓ API timeout configured
- ✓ Error handling defined
- ✓ Monitoring enabled
- ✓ Backup strategy in place
- ... and 13 more

**Manual Test:**
1. Click "Production Readiness"
2. Review checklist
3. Expected:
   - Green ✓ for compliant items
   - Red ✗ for issues
   - Yellow ⚠ for warnings
4. Click each section to expand details
5. Verify: Actionable guidance provided

---

### 9️⃣ UI/UX Features

#### Theme Toggle
- Click moon/sun icon (top-right)
- Expected: UI switches between dark/light mode
- Colors remain aurora violet/cyan in both modes

#### Sidebar Navigation
- Click each sidebar item
- Expected: Smooth view transitions
- Progress indicator updates

#### Responsive Design
1. Open DevTools (F12)
2. Toggle device toolbar (mobile view)
3. Resize to: 375px (mobile), 768px (tablet), 1440px (desktop)
4. Expected: Layout adapts, no overflow, buttons accessible

#### Spacing & Readability
- Verify: Generous gaps between sections
- Form fields have clear spacing
- Cards don't feel crowded
- Text is readable with good line-height

---

## 🔧 API Endpoints to Test

### Health & Status
```bash
GET http://localhost:3002/health
# Expected: { status: "ok", timestamp: "...", version: "..." }
```

### Configuration Endpoints
```bash
POST http://localhost:3002/api/config
# Body: { baseUrl, serviceName, authType, ... }
# Expected: 200 + { configId, ... }

GET http://localhost:3002/api/config/:id
# Expected: 200 + full config

PUT http://localhost:3002/api/config/:id
# Expected: 200 + updated config

DELETE http://localhost:3002/api/config/:id
# Expected: 200 + { deleted: true }
```

### OC Core / CAS Transport
```bash
POST http://localhost:3002/api/oc-core/invoke
# Body: { environment, endpoint, params: [...], method: "POST" }
# Expected: 200 + { rspCode, rspDesc, elapsed_ms, data }

POST http://localhost:3002/api/oc-core/invoke/preview
# Body: { environment, params: [...], method: "GET" }
# Expected: 200 + { signedUrl, curlCommand }

GET http://localhost:3002/api/oc-core/environments
# Expected: 200 + [{ id, label, baseUrl, ocCoreMode, casTransport }, ...]
```

---

## 🧪 Automated Test Suite

Run all tests:
```bash
npm test
```

Watch mode (re-run on file changes):
```bash
npm run test:watch
```

Coverage report:
```bash
npm test -- --coverage
```

**Test Categories:**
- **DB Tests** (12) — Database schema, CRUD, transactions
- **API Tests** (44) — Endpoint validation, auth, response parsing
- **Security Tests** (36) — Encryption, SQL injection, XSS prevention
- **Dynamic DB Tests** (17) — Connection pooling, dialect switching
- **OC Core Tests** (10) — SHA-256 signing, CAS protocol
- **Total: 119 tests** ✅

---

## 🐛 Troubleshooting

### Issue: "Port 3002 already in use"
```bash
# Windows PowerShell
Get-Process -Name node | Stop-Process -Force

# Or find process on port 3002
netstat -ano | findstr :3002
taskkill /PID <PID> /F
```

### Issue: "Cannot find module 'sqlite3'"
```bash
npm install
# If still fails:
npm rebuild better-sqlite3
```

### Issue: "MPAY Gateway connection refused"
- Verify: Is MPAY accessible at `http://10.0.142.4:7033`?
- If in development: Use "Mock API" or "OC_CORE_LOCAL" instead
- Check firewall: Ensure port 7033 is not blocked

### Issue: "Auth credentials not encrypting"
- Verify: `.env` has `ENCRYPTION_KEY` set
- If missing: Generate new key:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### Issue: "Database connection fails"
- SQL Server: Check TCP/IP enabled in SQL Server Configuration Manager
- PostgreSQL: Verify user has password authentication enabled
- MySQL: Ensure MySQL service running
- SQLite: Verify file path is writable

---

## ✅ Pre-Deployment Checklist

Before sending to production:

- [ ] All 119 tests passing: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors in browser DevTools
- [ ] Production Readiness checker all green ✓
- [ ] HTTPS enforced (production)
- [ ] API timeouts configured
- [ ] Database backups scheduled
- [ ] Error logging enabled
- [ ] Rate limiting configured
- [ ] CORS whitelist set
- [ ] Environment variables documented
- [ ] Credentials rotated

---

## 📞 Support & Questions

**Issue Found?**
- Check `/docs/TROUBLESHOOTING_GUIDE.md` for common issues
- Review server logs: `server/logs/`
- Run tests: `npm test` to isolate problem
- Check `.env` configuration

**For Questions:**
- Review `/docs/IMPLEMENTATION_GUIDE.md` for architecture
- Check `/docs/EXECUTIVE_SUMMARY.md` for feature overview
- Consult `/README.md` for project structure

---

**Happy Testing! 🚀**
