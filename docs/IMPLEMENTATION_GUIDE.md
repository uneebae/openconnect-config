# Open Connect Configuration UI - Implementation Guide
**For Paysys Labs | Client: Ethswitch | Status: Production-Ready**

---

## 📋 Quick Start (5 Minutes)

### 1. Install & Run in VS Code with Copilot

```bash
# Create a new React app or add to existing project
npx create-react-app open-connect-config
cd open-connect-config

# Install required icon library
npm install lucide-react

# Copy the OpenConnectConfigUI.jsx into src/
# Then update src/App.jsx:

import OpenConnectConfigUI from './OpenConnectConfigUI';

function App() {
  return <OpenConnectConfigUI />;
}

export default App;

# Start dev server
npm start
```

The UI will open at `http://localhost:3000`

---

## 🏗️ Architecture Overview

### Component Structure
```
OpenConnectConfigUI (Main Container)
├── State Management (6 configuration objects)
├── Step Components (6-step wizard)
├── SQL Generator
├── JSON Exporter
└── Validation Engine
```

### Configuration Objects Generated

1. **ws_config** - Service base URL registry
2. **ws_endpoint_config** - Endpoint configuration (payment + token)
3. **ws_token_config** - OAuth2 token authentication
4. **tran_req_map** - Field mapping definitions
5. **ws_response_definition** - Response code mappings
6. **ws_req_param_details** - Request routing configuration

---

## 🔧 Database Integration

### Option 1: Direct SQL Execution (Recommended for Urgent Deployment)

After filling the form, click **"Copy SQL"** in the Review step:

```sql
-- Paste entire output into SQL Server Management Studio
-- Run against your Open Connect database

-- Example workflow:
-- 1. Execute Step 1 (ws_config) → Note the config_id
-- 2. Execute Step 2 (ws_token_config) if using OAuth → Note the token_config_id
-- 3. Execute Steps 3-7 in order
-- 4. Verify with validation queries
```

### Option 2: Backend Integration (Production Setup)

Create a backend endpoint to save configurations:

```javascript
// Backend: Node.js/Express example
app.post('/api/openconnect/save-config', async (req, res) => {
  const { configData, sqlStatements } = req.body;
  
  try {
    // Save configuration metadata
    await db.table('oc_configurations').insert({
      client_name: 'Ethswitch',
      config_json: JSON.stringify(configData),
      created_by: req.user.id,
      created_at: new Date(),
      status: 'draft'
    });

    // Save SQL for audit trail
    await db.table('oc_config_scripts').insert({
      sql_script: sqlStatements,
      status: 'pending_review'
    });

    res.json({ success: true, message: 'Configuration saved for review' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📝 Step-by-Step Usage Guide for Your Team

### Step 1: Service Configuration
**What you're doing:** Registering the Ethswitch service

```
Service Base URL: https://api.ethswitch.com/v1
Service Type: Payment Gateway
Service Name: Ethswitch Payment Gateway
```

### Step 2: Endpoint Configuration
**What you're doing:** Defining how to call Ethswitch's fund transfer API

```
Method: POST
Endpoint Path: /transactions/transfer
Request Body Template:
{
  "fromAccount":"{FROM_ACCOUNT}",
  "toAccount":"{TO_ACCOUNT}",
  "amount":"{AMOUNT}",
  "currency":"PKR"
}

Response Code Path: $.responseCode
Extract Fields: $.rrn,$.description,$.stan
Connection Timeout: 5000ms
Read Timeout: 30000ms
```

### Step 3: Authentication
**Skip if Ethswitch uses API Key in headers; fill if they use OAuth2**

```
Client ID: your_ethswitch_app_id
Client Secret: your_ethswitch_secret
Token Endpoint: /auth/token
Token JSON Path: $.access_token
Expiry Path: $.expires_in
```

### Step 4: Field Mapping
**Map your internal field names to what Ethswitch expects**

| Param Name | Value | Mandatory | Max Length | Regex | Log |
|---|---|---|---|---|---|
| fromAccount | {FROM_ACCOUNT} | Y | 20 | ^[0-9]+$ | ✓ |
| toAccount | {TO_ACCOUNT} | Y | 20 | ^[0-9]+$ | ✓ |
| amount | {AMOUNT} | Y | 15 | ^[0-9]+(\.[0-9]{1,2})?$ | ✓ |
| currency | PKR | Y | 3 | ^[A-Z]{3}$ | ✗ |

### Step 5: Response Code Mapping
**Translate Ethswitch's codes to your standard codes**

| API Code | Your Code | Description |
|---|---|---|
| 00 | 000 | Transaction Approved |
| 01 | 100 | Insufficient Funds |
| 05 | 102 | Transaction Declined |
| 96 | 500 | System Error |
| * | 999 | Unknown Error |

### Step 6: Review & Export
- Review all settings
- Copy SQL → paste into SQL Server
- Copy JSON → save for backup/version control

---

## 🔐 Security Best Practices for Ethswitch

### Credentials Management

```javascript
// DO NOT hardcode secrets in config
WRONG:
{
  "clientSecret": "abc123def456"
}

RIGHT:
// Store in environment variables
const clientSecret = process.env.ETHSWITCH_CLIENT_SECRET;
// Or use Azure Key Vault / AWS Secrets Manager
```

### Database Access

```sql
-- Restrict permissions to service account only
-- Only the Open Connect service should modify ws_token_config
GRANT INSERT, UPDATE ON ws_token_config TO [openconnect_service];
DENY SELECT ON ws_token_config TO [developer_team];
```

### API Keys in Headers

If Ethswitch uses API Key authentication instead of OAuth2:

```json
{
  "request_headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {API_KEY}",
    "X-Client-ID": "paysys_ethswitch"
  }
}
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "API Call Failed - Timeout"
**Cause:** readTimeout is too short for Ethswitch's API
**Solution:**
```sql
-- Update endpoint
UPDATE ws_endpoint_config
SET read_timeout = 45000  -- Increase to 45 seconds
WHERE id = 10;
```

### Issue 2: "Unknown Response Code - 999"
**Cause:** Ethswitch returned a code you didn't map
**Solution:**
1. Check transactions_log_req_resp for actual response
2. Add the new mapping:
```sql
INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description)
VALUES (10, '07', '103', 'Ethswitch Specific Error');
```

### Issue 3: "Field Validation Failed"
**Cause:** Incoming data doesn't match regex pattern
**Solution:**
```sql
-- Check what data is being sent
SELECT identifier, amount, mpay_req_datetime
FROM transactions_log
WHERE status = 'FAILED' AND tran_type = 'FUND_TRANSFER'
ORDER BY id DESC;

-- If pattern is too strict, update:
UPDATE tran_req_map
SET regex = '^[0-9]+\.?[0-9]{0,2}$'
WHERE param_name = 'amount';
```

### Issue 4: "Token Expired - Cannot Refresh"
**Cause:** OAuth2 credentials are wrong or endpoint down
**Solution:**
```bash
# Test token endpoint manually
curl -X POST https://api.ethswitch.com/v1/auth/token \
  -d "grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET" \
  -H "Content-Type: application/x-www-form-urlencoded"

# If this fails, fix credentials in:
UPDATE ws_endpoint_config
SET data_template = 'grant_type=client_credentials&client_id=CORRECTED_ID&client_secret=CORRECTED_SECRET'
WHERE type = 'TOKEN';
```

---

## 📊 Validation Checklist Before Go-Live

Run these queries after executing the SQL:

```sql
-- Check 1: Service is registered
SELECT * FROM ws_config WHERE id = 1;
-- Expected: 1 row with https://api.ethswitch.com/v1

-- Check 2: Endpoints exist
SELECT id, type, endpoint_template FROM ws_endpoint_config 
WHERE config_id = 1 ORDER BY type;
-- Expected: 2 rows (PAYMENT and TOKEN)

-- Check 3: All response codes mapped
SELECT COUNT(*) as total_mappings
FROM ws_response_definition WHERE config_id = 10;
-- Expected: At least 6 rows including '*' wildcard

-- Check 4: Token config is set up
SELECT * FROM ws_token_config WHERE id = 5;
-- Expected: current_expiry_epoch should be populated after first use

-- Check 5: Field mappings are complete
SELECT COUNT(*) as field_count FROM tran_req_map WHERE tran_id = 501;
-- Expected: At least 4 rows (fromAccount, toAccount, amount, currency)

-- Check 6: Request routing exists
SELECT * FROM ws_req_param_details 
WHERE tran_type = 'FUND_TRANSFER' AND queue_in = 'ETHSWITCH_API';
-- Expected: 1 row
```

---

## 🚀 Deployment to Production

### Phase 1: Development Testing (This Week)
1. Set up UI in your dev environment
2. Fill out configuration for Ethswitch
3. Copy SQL and execute against DEV database
4. Test fund transfers end-to-end
5. Verify logs in transactions_log

### Phase 2: User Acceptance Testing
1. Have QA team test all scenarios:
   - Happy path (successful transfer)
   - Invalid account format
   - Insufficient funds
   - API timeout handling
   - Token expiration and refresh

### Phase 3: Production Deployment
```bash
# 1. Backup production database
BACKUP DATABASE [OpenConnect] 
TO DISK = 'Z:\backups\OpenConnect_2024_04_10.bak';

# 2. Execute SQL in production (during maintenance window)
# 3. Verify with validation queries above
# 4. Monitor transactions_log for 24 hours
# 5. Have rollback plan ready (DELETE rows from configuration tables)
```

---

## 📱 Using with Copilot in VS Code

When you have the component open:

1. **Ask Copilot:** "Add validation for ISO 8583 formatted amounts"
   - It will suggest regex patterns and validation logic

2. **Ask Copilot:** "Add export to CSV functionality"
   - It will add CSV download capability

3. **Ask Copilot:** "Create API endpoint to save this config to database"
   - It will generate backend code

4. **Ask Copilot:** "Add dark mode toggle"
   - It will add theme switching

### Example Copilot Prompt for Your Team
```
@workspace I need to add a feature to OpenConnectConfigUI.jsx 
that allows importing previously saved configurations from JSON. 
The UI should have:
1. File upload input for JSON files
2. Validation that the JSON matches our schema
3. Auto-populate all form fields from the uploaded config
4. Show success message when loaded

Suggest the implementation approach.
```

---

## 📈 Monitoring & Troubleshooting

### Dashboard Query
Create this in SSMS for real-time monitoring:

```sql
-- Open Connect Transaction Dashboard
SELECT 
  CAST(DATEPART(HOUR, client_req_datetime) AS VARCHAR) + ':00' as hour,
  COUNT(*) as total_txns,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
  AVG(DATEDIFF(MILLISECOND, client_req_datetime, client_resp_datetime)) as avg_response_ms,
  MAX(DATEDIFF(MILLISECOND, client_req_datetime, client_resp_datetime)) as max_response_ms
FROM transactions_log
WHERE tran_type = 'FUND_TRANSFER' 
  AND client_req_datetime > DATEADD(HOUR, -24, GETDATE())
GROUP BY DATEPART(HOUR, client_req_datetime)
ORDER BY hour DESC;
```

---

## 🆘 Emergency Contacts & Escalation

**If something breaks in production:**

1. **Check transactions_log:**
   ```sql
   SELECT TOP 10 * FROM transactions_log 
   WHERE status = 'FAILED' 
   ORDER BY id DESC;
   ```

2. **Check Ethswitch response:**
   ```sql
   SELECT * FROM transactions_log_req_resp 
   WHERE transactions_log_id = [FAILED_TXN_ID];
   ```

3. **Rollback if needed:**
   ```sql
   -- Delete recent configuration changes
   DELETE FROM ws_response_definition WHERE config_id = 10 AND id > 206;
   DELETE FROM tran_req_map WHERE tran_id = 501 AND id > 1005;
   ```

4. **Contact Ethswitch Support** with:
   - transactions_log.correlation_id from the failed transaction
   - Full mpay_resp from transactions_log_req_resp
   - Your ws_config.id and ws_endpoint_config.id values

---

## 📚 Additional Resources

- **Open Connect Developer Guide:** Reference the PDF provided (40 pages)
- **Ethswitch API Documentation:** Get from your account manager
- **Paysys Internal Wiki:** [Link to your wiki]
- **SQL Query Reference:** See Common Mistakes section in dev guide

---

## 🎯 Next Steps for CEO Briefing

**Timeline:**
- [ ] Today: UI built & tested locally ✅
- [ ] Tomorrow: Integrated with DEV database
- [ ] Day 3: QA testing with Ethswitch sample data
- [ ] Day 4-5: Production deployment & monitoring
- [ ] Day 6+: Monitor & optimize

**Success Criteria:**
- [ ] 100+ fund transfers per day processed through Ethswitch
- [ ] <500ms average response time
- [ ] 99.5% success rate
- [ ] Zero critical errors in transaction logs
- [ ] Team can add new endpoints without code changes

---

**Built for Paysys Labs | Client: Ethswitch | v1.0 | April 2024**
