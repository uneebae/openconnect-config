# OpenConnect Configuration — For Dev Team

## 📦 What's Included

You've received the complete OpenConnect Configuration automation platform. This includes:

### Code & Configuration
- **Backend:** Express.js API server (port 3002)
- **Frontend:** React + Vite (port 3006)
- **Database:** SQLite (default) + SQL Server, PostgreSQL, MySQL support
- **Testing:** 119 automated tests (Vitest + Supertest)

### Key Features
✅ 6-step configuration wizard  
✅ Quick import (JSON, cURL, Postman)  
✅ Multi-database support  
✅ OC Core CAS transport (SHA-256 signing)  
✅ MPAY Gateway integration  
✅ API validation & testing  
✅ Transaction logging  
✅ Production readiness checker  
✅ Aurora UI theme (dark/light)  

---

## 🚀 Getting Started (15 minutes)

### 1. Setup
```bash
cd open-connect-config
npm install
```

### 2. Run Tests
```bash
npm test
# Expected: 119 tests passing ✓
```

### 3. Start Development
```bash
npm run dev
# Starts: Mock API (3010) + Backend (3002) + Frontend (3006)
```

### 4. Test in Browser
Open: **http://localhost:3006**

---

## 📋 Testing Files (READ FIRST)

### For Quick Start
- **[QUICK_TEST_CHECKLIST.md](QUICK_TEST_CHECKLIST.md)** — 5-minute validation + manual checklist

### For Comprehensive Testing
- **[DEVELOPER_TEST_GUIDE.md](DEVELOPER_TEST_GUIDE.md)** — Full feature documentation + test scenarios

### For Running Tests Automatically
```bash
node run-tests.js --quick   # Run automated tests
node run-tests.js --full    # Tests + build + endpoint check
node run-tests.js --ui      # Start dev server with UI
```

### Reference Documentation
- `docs/TEST_PLAN.md` — Detailed test coverage (119 tests)
- `docs/IMPLEMENTATION_GUIDE.md` — Architecture & technical details
- `docs/TROUBLESHOOTING_GUIDE.md` — Common issues & solutions
- `README.md` — Project overview & commands

---

## ✅ Pre-Deployment Checklist

Before deploying to production:

```bash
# 1. Run all tests
npm test

# 2. Build production bundle
npm run build

# 3. Check production readiness in UI
# Navigate to left sidebar → "Production Readiness"
# Verify all items are green ✓

# 4. Review environment configuration
# Check: .env file has all required variables
# Check: Database connection credentials are secure
# Check: API endpoints are HTTPS (production)
```

---

## 🔧 Configuration

### Environment Variables
Create `.env` file in project root:

```env
# Backend
PORT=3002
NODE_ENV=development

# OC Core
OC_CORE_SECRET=paysys@123
OC_CORE_TIMEOUT=30000

# Database
DB_PATH=./config.db

# Encryption
ENCRYPTION_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### Supported Databases
- **SQLite** (default, zero-config)
- **SQL Server** (requires connection string)
- **PostgreSQL** (requires host, user, password)
- **MySQL** (requires host, user, password)

---

## 📊 Feature Overview

### Configuration Wizard
- Step-by-step service setup
- Field mapping (JSON → API parameters)
- Response code translation
- Export as JSON/SQL

### Quick Import
- **Guided:** Paste service URL + sample request/response
- **cURL:** Paste curl command, auto-extract everything

### Database Testing
- Multi-DB support (SQLite, SQL Server, PostgreSQL, MySQL)
- Connection testing
- Table creation from schema
- SQL preview before execution

### API Testing
- Test endpoints from UI
- View response with execution time
- Transaction history logging
- Validation dashboard

### OC Core CAS Integration
- Environment selection (MOCK, MPAY, LOCAL, UAT, PROD)
- SHA-256 signed URL generation
- GET/POST method selection
- Parameter array editor
- Postman JSON import
- Quick presets for common transactions
- cURL command generation

---

## 🧪 Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Database Layer | 12 | ✅ Passing |
| REST API | 44 | ✅ Passing |
| Security | 36 | ✅ Passing |
| Dynamic DB | 17 | ✅ Passing |
| OC Core | 10 | ✅ Passing |
| **Total** | **119** | **✅ 100% Pass** |

Run tests:
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode (re-run on changes)
npm test -- --coverage  # Coverage report
```

---

## 🎯 What to Test First

### 5-Minute Smoke Test
1. `npm install`
2. `npm test` (verify 119 pass)
3. `npm run dev` (start servers)
4. Open http://localhost:3006
5. Verify UI loads and theme works

### 30-Minute Feature Test
Follow **[QUICK_TEST_CHECKLIST.md](QUICK_TEST_CHECKLIST.md)**

### Comprehensive Test (90 minutes)
Follow **[DEVELOPER_TEST_GUIDE.md](DEVELOPER_TEST_GUIDE.md)**

---

## 🐛 Troubleshooting

### Issue: Port 3002/3006 already in use
```bash
# Kill all node processes
Get-Process -Name node | Stop-Process -Force
```

### Issue: Tests fail
```bash
# Clear cache and reinstall
rm -r node_modules package-lock.json
npm install
npm test
```

### Issue: Database connection fails
- Verify database server is running
- Check connection credentials in `.env`
- SQL Server: Enable TCP/IP
- PostgreSQL: Check pg_hba.conf for password auth

### Issue: MPAY Gateway not accessible
- Development: Use "Mock API" or "OC_CORE_LOCAL" instead
- Production: Verify `http://10.0.142.4:7033` is reachable
- Check firewall rules for port 7033

---

## 📱 Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Tested Resolutions:**
- Mobile: 375px ✓
- Tablet: 768px ✓
- Desktop: 1440px+ ✓

---

## 📞 Common Questions

**Q: How do I test OC Core without access to the live MPAY gateway?**
A: Use the "Mock API" environment in the dropdown, or test with "OC_CORE_LOCAL" which simulates responses.

**Q: Can I modify the configuration after exporting?**
A: Yes! Everything is editable. Use Quick Import as a head-start, then customize each field.

**Q: How do I add a new database type?**
A: Database modules are in `server/`. Create new adapter following pattern of `mssql-db.js`, then register in `dynamic-db.js`.

**Q: How are credentials encrypted?**
A: AES-256-GCM with key from `.env` (ENCRYPTION_KEY). Keys are never logged or transmitted.

**Q: Is there API rate limiting?**
A: Not in development. Configure in production using middleware like `express-rate-limit`.

---

## 🚢 Deployment

### Build for Production
```bash
npm run build
# Creates optimized bundle in dist/
```

### Start Production Server
```bash
NODE_ENV=production node server/index.js
# Runs on port 3002 by default
```

### Serve Frontend
```bash
# Copy dist/ to your web server (nginx, Apache, etc.)
# Or serve via Node:
npx serve dist
```

---

## 📞 Support

For questions or issues:
1. Check `/docs/TROUBLESHOOTING_GUIDE.md`
2. Review `/docs/IMPLEMENTATION_GUIDE.md`
3. Run tests to identify failures: `npm test`
4. Check server logs: `server/logs/`

---

## ✨ Quick Reference

```bash
npm install              # Install dependencies
npm test                 # Run all 119 tests
npm run dev              # Start dev servers
npm run build            # Build for production
npm run test:watch      # Watch mode testing
node run-tests.js       # Run test automation script
```

**Default Ports:**
- Mock API: http://localhost:3010
- Backend: http://localhost:3002
- Frontend: http://localhost:3006

---

**You're all set! Start with `npm test` then `npm run dev` to get going.** 🚀

For detailed testing instructions, see [DEVELOPER_TEST_GUIDE.md](DEVELOPER_TEST_GUIDE.md)
