# Quick Test Checklist for Dev

## ⚡ Pre-Flight Check (5 minutes)

- [ ] Node v18+ installed: `node --version`
- [ ] npm v10+ installed: `npm --version`
- [ ] Code extracted: All files present
- [ ] `npm install` completed successfully
- [ ] `npm test` passes (119 tests) ✓

---

## 🚀 Quick Start Tests (10 minutes)

### Server Startup
```bash
npm run dev
```
- [ ] Mock API starts on port 3010 ✓
- [ ] Backend starts on port 3002 ✓
- [ ] Frontend starts on port 3006 (or 3008) ✓
- [ ] No errors in terminal ✓

### UI Access
- [ ] Open http://localhost:3006 in browser
- [ ] UI loads (aurora dark theme visible) ✓
- [ ] Header shows "Backend Online" ✓
- [ ] Sidebar visible with all menu items ✓
- [ ] Theme toggle works (moon/sun icon) ✓

---

## 📝 Feature Tests (30 minutes)

### 1. Configuration Wizard ✓
- [ ] Step 1 (Service Config): Can enter base URL, service type, name
- [ ] Step 2 (Endpoint): Can add endpoint path with timeout
- [ ] Step 3 (Auth): Can select OAuth2 or API Key
- [ ] Step 4 (Field Mapping): Can map request fields
- [ ] Step 5 (Response Codes): Can define response translations
- [ ] Step 6 (Review): Can export as JSON and SQL
- [ ] All steps navigable with Next/Back buttons ✓

### 2. Quick Import ✓
- [ ] Guided Import: Parses service URL and sample request/response
- [ ] cURL Import: Extracts headers, body, URL from cURL command
- [ ] Both auto-populate wizard fields ✓

### 3. Database Testing ✓
- [ ] SQLite: Can select file and test connection
- [ ] SQL Server: Can enter credentials and test
- [ ] PostgreSQL: Can enter connection details and test
- [ ] MySQL: Can enter hostname/port/credentials and test
- [ ] Create Table: SQL executes without errors ✓

### 4. API Testing ✓
- [ ] Mock API environment: Can invoke test requests
- [ ] Responses show in dashboard with execution time
- [ ] Validation History saves all requests ✓

### 5. OC Core / CAS Transport ✓
- [ ] MPAY Gateway environment: Visible in environment dropdown
- [ ] Quick Presets: "1link Title Fetch" loads all 19 parameters
- [ ] Preview Signed URL: Shows SHA-256 signed URL
- [ ] Method auto-set to GET when MPAY selected ✓
- [ ] Endpoint path auto-set to `/mpg/queueforwarding/` ✓

### 6. Production Readiness ✓
- [ ] Readiness Checker shows 21 criteria
- [ ] Criteria show green ✓ or red ✗ status
- [ ] Can expand sections for details ✓

---

## 🔌 API Endpoint Tests (15 minutes)

Open terminal and run:

```bash
# Health check
curl http://localhost:3002/health
# Expected: { "status": "ok", ... }

# Get OC Core environments
curl http://localhost:3002/api/oc-core/environments
# Expected: Array with MOCK, MPAY, OC_CORE_LOCAL, OC_CORE_UAT, OC_CORE_PROD

# Test API endpoint
curl -X POST http://localhost:3002/api/oc-core/invoke/preview \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "MOCK",
    "endpoint": "/api/v1/test",
    "params": ["payment", "ACC001", "1000"],
    "method": "POST"
  }'
# Expected: { "signedUrl": "...", "curlCommand": "..." }
```

- [ ] Health check returns ok ✓
- [ ] Environments list returns all 5 environments ✓
- [ ] Preview endpoint generates signed URL ✓

---

## 🎨 UI/UX Quality (10 minutes)

- [ ] **Spacing**: Sections have generous gaps, not crowded ✓
- [ ] **Colors**: Aurora violet/cyan theme applied throughout ✓
- [ ] **Dark Mode**: Proper contrast and readability ✓
- [ ] **Light Mode**: All text visible, proper styling ✓
- [ ] **Responsive**: Works on mobile (375px), tablet (768px), desktop (1440px) ✓
- [ ] **No Errors**: Browser console shows no errors ✓
- [ ] **No Black Gaps**: Page bottom has proper background ✓

---

## 🧪 Automated Test Suite (5 minutes)

```bash
npm test
# Or with coverage
npm test -- --coverage
```

- [ ] All 119 tests pass ✓
- [ ] No skipped tests ✓
- [ ] Execution time < 30 seconds ✓

---

## 🏗️ Build Test (10 minutes)

```bash
npm run build
```

- [ ] Build completes successfully ✓
- [ ] No errors in terminal ✓
- [ ] `dist/` folder created with:
  - [ ] `index.html`
  - [ ] `assets/index-*.js`
  - [ ] `assets/index-*.css`
  - [ ] Bundle size reasonable (< 250KB gzip) ✓

---

## 📱 Responsive Design Test (10 minutes)

Open DevTools (F12) → Toggle device toolbar:

**Mobile (375px)**
- [ ] Layout stacks vertically ✓
- [ ] Text readable without zooming ✓
- [ ] Buttons clickable (no overlap) ✓
- [ ] No horizontal scrolling ✓

**Tablet (768px)**
- [ ] Two-column layout where appropriate ✓
- [ ] Spacing proportional ✓
- [ ] All elements visible ✓

**Desktop (1440px)**
- [ ] Full layout with sidebar and main content ✓
- [ ] Spacing generous ✓
- [ ] No content stretches excessively ✓

---

## 🔐 Security Quick Check (5 minutes)

- [ ] No API keys in source code (check .env)
- [ ] Passwords stored encrypted (check endpoints with /api/config)
- [ ] HTTPS recommended in docs (check for production notes) ✓

---

## ✅ Final Approval

**Total Time:** ~90 minutes for complete testing

**Sign-Off:**
```
Developer: ____________________
Date: ____________________
All Tests Passed: [ ] YES  [ ] NO
Notes: ____________________
```

---

## 🆘 If Something Fails

1. Check `/docs/TROUBLESHOOTING_GUIDE.md` for common issues
2. Run `npm test` to identify which tests fail
3. Review server logs in `/server/logs/`
4. Verify `.env` file has all required variables
5. Check NodeJS version: `node --version` (need v18+)

---

**Ready to test? Start with:**
```bash
npm install
npm test              # Quick validation (2 min)
npm run dev           # Start servers (5 min)
# Then open http://localhost:3006 and follow manual checklist above
```
