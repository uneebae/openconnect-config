# Open Connect Configuration UI - Troubleshooting & Advanced Guide

---

## 🔧 Common Issues & Solutions

### ISSUE 1: "Cannot find module 'react'"

**Symptoms:**
```
Error: Cannot find module 'react'
```

**Cause:** React not installed or installed in wrong location

**Solution:**
```bash
# Reinstall dependencies
npm install --legacy-peer-deps react react-dom lucide-react

# Or clean and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps react react-dom lucide-react
```

---

### ISSUE 2: "Tailwind styles not loading"

**Symptoms:**
- UI appears unstyled
- Colors are missing
- Layout is broken

**Cause:** Tailwind CSS CDN not loaded or conflicting styles

**Solution:**
Check that `public/index.html` has Tailwind CDN:
```html
<script src="https://cdn.tailwindcss.com"></script>
```

If using Vite, add to `vite.config.js`:
```javascript
import tailwindcss from 'tailwindcss'

export default {
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        require('autoprefixer'),
      ],
    },
  },
}
```

---

### ISSUE 3: "SQL Syntax Error When Executing"

**Symptoms:**
```
Msg 102, Level 15, State 1: Incorrect syntax near 'xyz'
```

**Cause:** Special characters in field values breaking SQL string

**Solution:**

The UI auto-escapes single quotes. If you still get errors:

```sql
-- WRONG: Single quote not escaped
INSERT INTO tran_req_map ... value = 'O'Reilly';

-- RIGHT: Should be double single quote
INSERT INTO tran_req_map ... value = 'O''Reilly';
```

**In the UI:** If your field values contain quotes, ensure they're properly formatted:
```
Before:  O'Reilly's Bank
In UI:   O''Reilly''s Bank
In SQL:  'O''Reilly''s Bank'
```

---

### ISSUE 4: "API Call Fails with 'Invalid JSON'"

**Symptoms:**
```
Error: Invalid JSON in request body
```

**Cause:** Data template has malformed JSON

**Solution:**

Validate your data template JSON:

```javascript
// In the UI, the data template should be valid JSON
// WRONG:
{fromAccount: {FROM_ACCOUNT}}

// RIGHT:
{"fromAccount":"{FROM_ACCOUNT}"}
```

Use an online JSON validator: https://jsonlint.com/

---

### ISSUE 5: "Token Endpoint Returns 401 Unauthorized"

**Symptoms:**
```
401 Unauthorized
Invalid credentials
```

**Cause:** Client ID/Secret are wrong or API endpoint changed

**Solution:**

1. **Verify credentials with Ethswitch:**
```bash
curl -X POST https://api.ethswitch.com/v1/auth/token \
  -d "grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET" \
  -H "Content-Type: application/x-www-form-urlencoded"

# Should return: {"access_token":"...","expires_in":3600}
```

2. **If manual test works but UI fails:**
   - Check that spaces aren't being added in the UI
   - Verify token endpoint path starts with `/` (not `auth/token`, should be `/auth/token`)

3. **Update in SQL if credentials are wrong:**
```sql
UPDATE ws_endpoint_config
SET data_template = 'grant_type=client_credentials&client_id=NEW_ID&client_secret=NEW_SECRET'
WHERE type = 'TOKEN' AND config_id = 1;

-- Then reset token to force refresh
UPDATE ws_token_config
SET current_expiry_epoch = 0
WHERE id = 5;
```

---

### ISSUE 6: "Field Validation Error: REGEX_MISMATCH"

**Symptoms:**
```
Field validation failed: amount regex mismatch
Expected pattern: ^[0-9]+(\.[0-9]{1,2})?$
Got: 5000.00a
```

**Cause:** Data doesn't match regex pattern

**Solution:**

Test regex patterns in the UI before going live:

```javascript
// JavaScript regex tester
const pattern = /^[0-9]+(\.[0-9]{1,2})?$/;
const testValues = ["5000", "5000.00", "5000.99", "5000.999", "abc"];

testValues.forEach(val => {
  console.log(`${val}: ${pattern.test(val)}`);
});
// Output:
// 5000: true
// 5000.00: true
// 5000.99: true
// 5000.999: false ← ERROR
// abc: false ← ERROR
```

**Common Regex Patterns:**

```regex
# Account numbers (11-20 digits)
^[0-9]{11,20}$

# Amount (decimal 2 places)
^[0-9]+(\.[0-9]{1,2})?$

# IBAN format (flexible)
^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$

# Currency codes
^[A-Z]{3}$

# MSISDN (phone number)
^92[0-9]{10}$

# Reference numbers (alphanumeric)
^[A-Z0-9]{1,20}$
```

---

### ISSUE 7: "Response Code Not Mapping - Getting Code 999"

**Symptoms:**
```
API returned code: 04
But mapped to: 999 (Unknown Error)
```

**Cause:** Response code mapping missing

**Solution:**

1. **Check what code Ethswitch actually returned:**
```sql
SELECT TOP 10 
  correlation_id,
  mpay_resp_code,
  client_resp_code,
  mpay_resp
FROM transactions_log
WHERE status = 'FAILED' AND client_resp_code = '999'
ORDER BY id DESC;
```

2. **Look at full response in:**
```sql
SELECT mpay_resp 
FROM transactions_log_req_resp 
WHERE transactions_log_id = [ID_FROM_ABOVE];
```

3. **Add missing mapping:**
```sql
INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description)
VALUES (10, '04', '105', 'Ethswitch Specific Error - Check with support');
```

---

### ISSUE 8: "Timeout - API Taking Too Long"

**Symptoms:**
```
Request took 35 seconds
Timeout after 30 seconds
Status: TIMEOUT
```

**Cause:** Read timeout set too low

**Solution:**

1. **Check current timeout:**
```sql
SELECT read_timeout FROM ws_endpoint_config WHERE id = 10;
```

2. **Increase timeout (work with Ethswitch on their SLA):**
```sql
UPDATE ws_endpoint_config
SET read_timeout = 45000  -- 45 seconds
WHERE id = 10;
```

3. **Monitor response times:**
```sql
SELECT 
  AVG(DATEDIFF(MS, mpay_req_datetime, mpay_resp_datetime)) as avg_response_ms,
  MAX(DATEDIFF(MS, mpay_req_datetime, mpay_resp_datetime)) as max_response_ms,
  COUNT(*) as transactions
FROM transactions_log
WHERE tran_type = 'FUND_TRANSFER' 
  AND mpay_req_datetime > DATEADD(HOUR, -1, GETDATE());
```

**Timeout Recommendations:**
- Quick APIs (balance check): 10-15 seconds
- Standard APIs (transfers): 25-35 seconds
- Batch/Report APIs: 60-120 seconds

---

### ISSUE 9: "Cannot Execute SQL - Permission Denied"

**Symptoms:**
```
Msg 229, Level 15: The INSERT permission was denied on object 'ws_config'
```

**Cause:** SQL Server user doesn't have INSERT permission

**Solution:**

Run as database owner or ask DBA to grant permissions:

```sql
-- Run as DBA
USE [OpenConnect];
GO

-- Grant permissions to the user executing the SQL
GRANT INSERT, UPDATE, DELETE ON ws_config TO [domain\username];
GRANT INSERT, UPDATE, DELETE ON ws_endpoint_config TO [domain\username];
GRANT INSERT, UPDATE, DELETE ON ws_token_config TO [domain\username];
GRANT INSERT, UPDATE, DELETE ON tran_req_map TO [domain\username];
GRANT INSERT, UPDATE, DELETE ON ws_response_definition TO [domain\username];
GRANT INSERT, UPDATE, DELETE ON ws_req_param_details TO [domain\username];

-- Verify permissions
SELECT * FROM fn_my_permissions('[ws_config]', 'OBJECT');
```

---

### ISSUE 10: "UI Form Not Saving State"

**Symptoms:**
- Fields reset when switching steps
- Data disappears
- Can't go back to previous steps

**Cause:** Browser local storage issue or React state not updating

**Solution:**

```javascript
// In browser console, check if state is persisting:
console.log(sessionStorage.getItem('openconnect_config'));

// Hard refresh the page:
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

// Or clear browser cache:
Chrome → Settings → Privacy → Clear browsing data
Select: Cookies, Cached images and files → Clear data
```

**For developers:** Add localStorage persistence:

```javascript
// Add to OpenConnectConfigUI component
useEffect(() => {
  localStorage.setItem('openconnect_form', JSON.stringify({
    wsConfig,
    wsEndpointConfig,
    tranRequestMap,
    // ... other state
  }));
}, [wsConfig, wsEndpointConfig, tranRequestMap]);

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('openconnect_form');
  if (saved) {
    const data = JSON.parse(saved);
    setWsConfig(data.wsConfig);
    // ... restore other state
  }
}, []);
```

---

## 🎯 Advanced Usage

### Scenario 1: Multiple Instances of Same API

**Requirement:** Use Ethswitch for two different transaction types (payments + settlements)

**Solution:**

1. Create two tran_id values:
   - tran_id 501: FUND_TRANSFER (for payments)
   - tran_id 601: SETTLEMENT_REQUEST (for settlements)

2. Create two routing entries:
   ```sql
   INSERT INTO ws_req_param_details (tran_id, tran_type, queue_in, ...)
   VALUES (601, 'SETTLEMENT_REQUEST', 'ETHSWITCH_API', ...);
   ```

3. Create field mappings for each:
   ```sql
   INSERT INTO tran_req_map (id, tran_id, param_name, value, ...)
   VALUES 
   (2001, 601, 'settlementAccount', '{SETTLEMENT_ACCOUNT}', ...),
   (2002, 601, 'settlementAmount', '{AMOUNT}', ...);
   ```

4. Can reuse same endpoint (same config_id) for both!

---

### Scenario 2: Request Transformation Functions

**Requirement:** Encrypt sensitive data before sending to Ethswitch

**Current state:** The UI doesn't have function_name field visible

**Solution for future enhancement:**

```sql
-- Extend tran_req_map with transformation
UPDATE tran_req_map
SET function_name = 'ENCRYPT_AES256'
WHERE param_name = 'account' AND tran_id = 501;

-- In code, call encryption:
const encryptedValue = await encryptField(
  fieldValue, 
  'ENCRYPT_AES256',
  encryptionKey
);
```

---

### Scenario 3: Conditional Response Mapping

**Requirement:** Map different codes based on transaction amount

**Current:** One mapping per code

**Solution:** Use additional fields in response:

```json
{
  "responseCode": "00",
  "subCode": "00_LARGE",
  "amount": 999999.99
}
```

Mapping:
```sql
-- Map based on subCode instead
INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description)
VALUES (10, '00_LARGE', '001', 'Large Transaction Approved - Requires Review');
```

Then in code, parse subCode instead of just responseCode.

---

### Scenario 4: Rate Limiting & Throttling

**Requirement:** Ethswitch allows max 100 requests/minute

**Solution:**

```sql
-- Add rate limit config (extend ws_endpoint_config)
ALTER TABLE ws_endpoint_config ADD COLUMN 
  max_requests_per_minute INT DEFAULT 100;

-- Update for Ethswitch
UPDATE ws_endpoint_config
SET max_requests_per_minute = 100
WHERE id = 10;
```

In application code:
```javascript
const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000 // 1 minute
});

// Check before sending request
if (!rateLimiter.isAllowed('ethswitch')) {
  // Queue for later
  return queueTransaction(txn);
}
```

---

### Scenario 5: Circuit Breaker Pattern

**Requirement:** If Ethswitch is down, fail fast instead of timeout

**Solution:**

```sql
-- Track API health
ALTER TABLE ws_config ADD COLUMN
  circuit_breaker_state VARCHAR(20) DEFAULT 'CLOSED'; -- CLOSED, OPEN, HALF_OPEN
  
ALTER TABLE ws_config ADD COLUMN
  consecutive_failures INT DEFAULT 0;
```

Logic:
```javascript
// If 5 consecutive failures, open circuit
if (error) {
  consecutiveFailures++;
  if (consecutiveFailures >= 5) {
    openCircuit('ethswitch');
    // Reject all requests immediately
    throw new Error('Ethswitch circuit breaker OPEN');
  }
}

// If circuit was open and we recover, try half-open
if (circuitBreaker.state === 'HALF_OPEN') {
  try {
    // Try one request
    response = await callAPI();
    // Success - close circuit
    closeCircuit('ethswitch');
  } catch {
    // Reopen circuit
    openCircuit('ethswitch');
  }
}
```

---

## 📊 Performance Tuning

### Query Optimization

```sql
-- Add indexes for faster lookups
CREATE INDEX idx_req_param_tran_queue 
  ON ws_req_param_details(tran_type, queue_in);

CREATE INDEX idx_req_map_tran 
  ON tran_req_map(tran_id);

CREATE INDEX idx_response_def_config 
  ON ws_response_definition(config_id);

CREATE INDEX idx_txn_log_tran_type 
  ON transactions_log(tran_type, client_req_datetime DESC);
```

### Monitor Query Performance

```sql
-- Check slowest queries
SELECT TOP 10
  SUM(DATEDIFF(MS, start_time, GETDATE())) as total_duration_ms,
  COUNT(*) as execution_count,
  statement
FROM sys.dm_exec_requests
WHERE status = 'running'
GROUP BY statement
ORDER BY total_duration_ms DESC;
```

---

## 🔍 Debugging Strategies

### Strategy 1: Full Request/Response Inspection

```sql
-- Get the full request and response for a failed transaction
SELECT 
  tl.correlation_id,
  tl.tran_type,
  tl.status,
  tl.client_resp_code,
  tlrr.client_req,
  tlrr.mpay_req,
  tlrr.mpay_resp,
  tlrr.client_resp
FROM transactions_log tl
JOIN transactions_log_req_resp tlrr ON tl.id = tlrr.transactions_log_id
WHERE tl.correlation_id = 'TXN_ID_HERE'
ORDER BY tl.id DESC;
```

### Strategy 2: Token Debugging

```sql
-- Check if token is refreshing properly
SELECT 
  id,
  current_token,
  current_expiry_epoch,
  DATEADD(SECOND, (current_expiry_epoch - UNIX_TIMESTAMP()), GETDATE()) as expires_at,
  CASE 
    WHEN current_expiry_epoch < UNIX_TIMESTAMP() THEN 'EXPIRED'
    ELSE 'VALID'
  END as token_status
FROM ws_token_config
WHERE id = 5;

-- Force token refresh
UPDATE ws_token_config
SET current_expiry_epoch = 0
WHERE id = 5;
```

### Strategy 3: Field Mapping Validation

```sql
-- Ensure all placeholders in data_template exist in tran_req_map
SELECT 
  ec.id as endpoint_id,
  ec.data_template,
  'POTENTIAL ISSUE' as note
FROM ws_endpoint_config ec
WHERE ec.data_template LIKE '%{%}%'
  AND ec.type = 'PAYMENT'
  AND NOT EXISTS (
    SELECT 1 FROM tran_req_map trm
    WHERE ec.id = trm.endpoint_id -- Adjust if no foreign key
  );
```

---

## 🆘 When All Else Fails

### Escalation Path

1. **Check logs first:**
   ```sql
   SELECT TOP 100 * FROM transactions_log
   WHERE status = 'FAILED'
   ORDER BY id DESC;
   ```

2. **Get Ethswitch's response:**
   ```sql
   SELECT mpay_resp FROM transactions_log_req_resp
   WHERE transactions_log_id = [ID];
   ```

3. **Verify configuration:**
   ```sql
   SELECT * FROM ws_config WHERE id = 1;
   SELECT * FROM ws_endpoint_config WHERE config_id = 1;
   SELECT * FROM ws_token_config WHERE id = 5;
   ```

4. **Test endpoint manually:**
   ```bash
   # Test with curl
   curl -X POST https://api.ethswitch.com/v1/transactions/transfer \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"fromAccount":"03001234567","toAccount":"03009876543","amount":"5000"}'
   ```

5. **Contact Ethswitch support with:**
   - transactions_log.correlation_id
   - mpay_resp (full response body)
   - Your ws_config settings
   - Screenshots of failed transactions

---

## 📝 Checklist for Production Readiness

```sql
-- Run before deploying
SELECT 
  'ws_config exists' as check,
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM ws_config WHERE id = 1
UNION ALL
SELECT 'Endpoint configured', 
  CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'FAIL' END
FROM ws_endpoint_config WHERE config_id = 1
UNION ALL
SELECT 'Response codes mapped',
  CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END
FROM ws_response_definition WHERE config_id = 10
UNION ALL
SELECT 'Wildcard mapping exists',
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END
FROM ws_response_definition WHERE config_id = 10 AND match_code = '*'
UNION ALL
SELECT 'Field mappings complete',
  CASE WHEN COUNT(*) >= 4 THEN 'PASS' ELSE 'FAIL' END
FROM tran_req_map WHERE tran_id = 501
UNION ALL
SELECT 'Request routing configured',
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END
FROM ws_req_param_details WHERE tran_type = 'FUND_TRANSFER';
```

---

**Version:** 1.0
**Last Updated:** April 2024
**For:** Paysys Labs | Ethswitch Integration
