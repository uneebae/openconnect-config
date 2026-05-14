# OpenConnect Configuration — Demo Test Guide

> **Purpose**: Step-by-step guide to demonstrate the full OpenConnect flow.
> Fill the form → Generate SQL → Insert into MSSQL → Invoke API → Verify Response

---

## Prerequisites

### 1. Start all three servers

Open **three separate terminals** in the project root:

```bash
# Terminal 1 — Backend (port 3002)
npm run server

# Terminal 2 — Frontend (port 3000)
npm run dev

# Terminal 3 — Mock Banking API (port 3010)
npm run test-api
```

### 2. Connect to MSSQL

1. Open the UI at **http://localhost:3000**
2. Click **"Connect External DB"** at the top
3. Fill in the MSSQL connection details:
   - **Type**: `mssql`
   - **Host**: `10.5.70.5`
   - **Port**: `1440`
   - **Database**: `Raast_Openconnect_uneeb`
   - **User**: `appuser_demo`
   - **Password**: `K@r@achi@2016`
   - **Name** (label): `MSSQL-Raast`
4. Click **Connect** — badge should turn green: **"Connected: MSSQL"**

---

## Test Case 1: Balance Inquiry (Happy Flow)

### Step 1 — Service Configuration

| Field          | Value                        |
|----------------|------------------------------|
| Base URL       | `http://localhost:3010`      |
| Type           | `REST`                       |
| Service Name   | `Balance-Inquiry-Service`    |

Click **Next →**

### Step 2 — Endpoint Configuration

| Field                   | Value                                  |
|-------------------------|----------------------------------------|
| HTTP Method             | `POST`                                 |
| Endpoint Template       | `/api/v1/account/balance-inquiry`      |
| Request Format          | `JSON`                                 |
| Response Format         | `JSON`                                 |
| Data Template           | *(paste the JSON below)*               |
| Connection Timeout (ms) | `5000`                                 |
| Read Timeout (ms)       | `30000`                                |
| Response Code Path      | `$.responseCode`                       |
| Response Include Paths  | `$.data.accountTitle,$.data.availableBalance,$.data.iban,$.data.accountStatus` |
| Type                    | `BALANCE_INQUIRY`                      |
| Reversal Type           | `NONE`                                 |
| Guaranteed              | ☐ *(unchecked)*                        |
| Ex Req/Res Log          | ☑ *(checked)*                          |

**Data Template** — paste this exactly:
```json
{
  "channelId": "{{channelId}}",
  "requestId": "{{requestId}}",
  "traceId": "{{traceId}}",
  "transactionDateTime": "{{transactionDateTime}}",
  "bankCode": "{{bankCode}}",
  "accountNumber": "{{accountNumber}}",
  "iban": "{{iban}}",
  "rrn": "{{rrn}}",
  "stan": "{{stan}}"
}
```

Click **Next →**

### Step 3 — Authentication (Optional)

> For this demo the mock API has **no authentication**. You can leave these fields empty.
> If you want to demo the token config section, leave Client ID empty and skip it.

Click **Next →**

### Step 4 — Field Mappings (tran_req_map)

Click **"+ Add Field"** for each row below:

| # | ID  | Param Name            | Value                | Is Mandatory | Max Length | Regex | Log Parameter | Log Column |
|---|-----|-----------------------|----------------------|--------------|-----------|-------|---------------|------------|
| 1 | 101 | channelId             | MOBILE_APP           | Y            | 20        |       | 0             |            |
| 2 | 102 | requestId             | {AUTO_GENERATE}      | Y            | 40        |       | 1             | request_id |
| 3 | 103 | traceId               | {AUTO_GENERATE}      | Y            | 40        |       | 0             |            |
| 4 | 104 | transactionDateTime   | {CURRENT_TIMESTAMP}  | Y            | 30        |       | 0             |            |
| 5 | 105 | bankCode              | 01                   | Y            | 10        |       | 0             |            |
| 6 | 106 | accountNumber         | 1234567890           | Y            | 20        | ^\d+$ | 1             | account_no |
| 7 | 107 | iban                  |                      | N            | 34        |       | 0             |            |
| 8 | 108 | rrn                   | 123456789015         | Y            | 12        |       | 1             | rrn        |
| 9 | 109 | stan                  | 123459               | Y            | 6         |       | 1             | stan       |

Click **Next →**

### Step 5 — Response Code Mappings

Click **"+ Add Mapping"** for each row:

| Match Code | Our Code | Our Description                    |
|-----------|----------|------------------------------------|
| 000       | 00       | Success                            |
| 001       | 14       | Account not found                  |
| 002       | 91       | Bank not reachable                 |
| 003       | 30       | Invalid request format             |

Click **Next →**

### Step 6 — Routing & Queue Configuration

| Field          | Value           |
|----------------|-----------------|
| Transaction ID | `5001`          |
| Transaction Type | `BALANCE_INQ` |
| Queue In       | `OPENCONNECT.IN`|
| Queue Type     | `REQUEST`       |
| From IP        | `0.0.0.0`       |
| Host ID        | `1`             |
| Response Type  | `JSON`          |
| SAF Queue      | *(leave empty)* |

---

## Execute & Verify

### A. Preview SQL

Click **"Preview SQL"** — you should see 5+ INSERT statements:
1. `INSERT INTO ws_config ...`
2. `INSERT INTO ws_endpoint_config ...` (with `{LAST_INSERT_ID}` for config_id)
3. `INSERT INTO ws_response_definition ...` (×4 rows)
4. `INSERT INTO ws_req_param_details ...`
5. `INSERT INTO tran_req_map ...` (×9 rows)

### B. Execute on MSSQL

Click **"Execute in Database"** → Confirm the production warning dialog → All statements should show ✅ green.

### C. Verify Database Contents

Scroll down to **"Database Contents"** — click **Verify** (or it auto-verifies).
You should see:
- **ws_config**: 1 row with base_url = `http://localhost:3010`
- **ws_endpoint_config**: 1 row linked to that config
- **ws_response_definition**: 4 rows (000, 001, 002, 003)
- **ws_req_param_details**: 1 row with tran_id = 5001
- **tran_req_map**: 9 rows linked to tran_id 5001

### D. Test via API Layer

1. Scroll to **"API Layer Test"** section
2. Select the config from the dropdown (should show the new config)
3. The test payload is pre-filled. Adjust if needed:
```json
{
  "channelId": "MOBILE_APP",
  "requestId": "TF20260420120100001",
  "traceId": "TRACE20260420120100001",
  "transactionDateTime": "2025-06-21T12:00:00.000Z",
  "bankCode": "01",
  "accountNumber": "1234567890",
  "iban": "",
  "rrn": "123456789015",
  "stan": "123459"
}
```
4. Click **"Invoke API"**
5. Expected response:
```json
{
  "responseCode": "000",
  "responseMessage": "Balance inquiry successful",
  "data": {
    "accountTitle": "MUHAMMAD AHMED KHAN",
    "accountNumber": "1234567890",
    "availableBalance": "150,250.75",
    "currency": "PKR",
    "accountStatus": "ACTIVE"
  }
}
```
6. The mapped response code should show: **Our Code = 00, Description = Success**

---

## Test Case 2: Error Scenarios (Optional Demo)

### Account Not Found
Change `accountNumber` to `0000000000` in the test payload → Response: `001` → mapped to **14 / Account not found**

### Bank Unreachable
Change `bankCode` to `999` → Response: `002` → mapped to **91 / Bank not reachable**

### Invalid Request
Remove both `accountNumber` and `iban` from payload → Response: `003` → mapped to **30 / Invalid request format**

---

## Test Case 3: Fund Transfer (Second Config)

If time permits, repeat the full flow with these values:

**Step 1** — Service Config:
- Base URL: `http://localhost:3010`
- Type: `REST`
- Service Name: `Fund-Transfer-Service`

**Step 2** — Endpoint:
- Endpoint Template: `/api/v1/account/fund-transfer`
- Data Template:
```json
{
  "fromAccount": "{{fromAccount}}",
  "toAccount": "{{toAccount}}",
  "amount": "{{amount}}",
  "currency": "{{currency}}",
  "rrn": "{{rrn}}",
  "stan": "{{stan}}",
  "bankCode": "{{bankCode}}"
}
```
- Response Code Path: `$.responseCode`
- Response Include Paths: `$.data.transactionId,$.data.status,$.data.transactionDate`
- Type: `FUND_TRANSFER`

**Step 4** — Field Mappings:

| # | ID  | Param Name  | Value        | Is Mandatory |
|---|-----|-------------|--------------|--------------|
| 1 | 201 | fromAccount | 1234567890   | Y            |
| 2 | 202 | toAccount   | 9876543210   | Y            |
| 3 | 203 | amount      | 50000        | Y            |
| 4 | 204 | currency    | PKR          | Y            |
| 5 | 205 | rrn         | 123456789016 | Y            |
| 6 | 206 | stan        | 123460       | Y            |
| 7 | 207 | bankCode    | 01           | Y            |

**Step 5** — Response Codes:

| Match | Our Code | Description                  |
|-------|----------|------------------------------|
| 000   | 00       | Transfer successful          |
| 003   | 30       | Missing required fields      |
| 004   | 61       | Amount exceeds limit         |
| 005   | 62       | Same account transfer error  |

**Step 6** — Routing:
- Transaction ID: `5002`
- Transaction Type: `FUND_XFER`
- Queue In: `OPENCONNECT.IN`

---

## Quick Reference — Server Ports

| Service          | Port  | Command           |
|------------------|-------|-------------------|
| Backend API      | 3002  | `npm run server`  |
| Frontend UI      | 3000  | `npm run dev`     |
| Mock Banking API | 3010  | `npm run test-api`|

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot connect to backend" | Make sure `npm run server` is running on port 3002 |
| "MSSQL connection failed" | Check VPN/network access to 10.5.70.5:1440 |
| "Endpoint not found" when invoking | Make sure `npm run test-api` is running on port 3010 |
| "FOREIGN KEY constraint failed" | Use fresh transaction IDs (5001, 5002 etc.) that don't already exist |
| SQL shows `{LAST_INSERT_ID}` error | Ensure ws_config INSERT runs first — check SQL preview order |
| Response code not mapped | Verify response code mappings in Step 5 match mock API codes |

