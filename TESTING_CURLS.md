# OpenConnect API — Testing cURLs

**Base URL:** `http://localhost:3002`  
**Frontend:** `http://localhost:3006`  
**Mock API:** `http://localhost:3010`

---

## 🚀 Quick Health Check

```bash
curl http://localhost:3002/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-14T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 45.234
}
```

---

## 📋 Configuration Endpoints

### 1. Create Configuration

```bash
curl -X POST http://localhost:3002/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://api.example.com",
    "serviceName": "PaymentGateway",
    "serviceType": "payment",
    "endpoint": "/v1/payment",
    "authType": "oauth2",
    "authConfig": {
      "clientId": "client_123",
      "clientSecret": "secret_abc"
    },
    "timeout": 5000
  }'
```

### 2. Get All Configurations

```bash
curl http://localhost:3002/api/config
```

### 3. Get Single Configuration

```bash
curl http://localhost:3002/api/config/CONFIG_ID
```

### 4. Update Configuration

```bash
curl -X PUT http://localhost:3002/api/config/CONFIG_ID \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "UpdatedGateway",
    "timeout": 10000
  }'
```

### 5. Delete Configuration

```bash
curl -X DELETE http://localhost:3002/api/config/CONFIG_ID
```

---

## 🔐 Encryption & Security

### Test Credential Encryption

```bash
curl -X POST http://localhost:3002/api/security/encrypt \
  -H "Content-Type: application/json" \
  -d '{
    "data": "secret_password_123"
  }'
```

Response:
```json
{
  "encrypted": "base64_encrypted_string",
  "iv": "initialization_vector"
}
```

### Decrypt Credentials (verify encryption works)

```bash
curl -X POST http://localhost:3002/api/security/decrypt \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted": "base64_encrypted_string",
    "iv": "initialization_vector"
  }'
```

---

## 🗄️ Database Testing

### 1. Test SQLite Connection

```bash
curl -X POST http://localhost:3002/api/db/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sqlite",
    "config": {
      "path": "./config.db"
    }
  }'
```

### 2. Test SQL Server Connection

```bash
curl -X POST http://localhost:3002/api/db/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mssql",
    "config": {
      "server": "localhost",
      "port": 1433,
      "username": "sa",
      "password": "YourPassword",
      "database": "master"
    }
  }'
```

### 3. Test PostgreSQL Connection

```bash
curl -X POST http://localhost:3002/api/db/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql",
    "config": {
      "host": "localhost",
      "port": 5432,
      "user": "postgres",
      "password": "postgres",
      "database": "postgres"
    }
  }'
```

### 4. Test MySQL Connection

```bash
curl -X POST http://localhost:3002/api/db/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mysql",
    "config": {
      "host": "localhost",
      "port": 3306,
      "user": "root",
      "password": "root",
      "database": "mysql"
    }
  }'
```

### 5. Execute Query

```bash
curl -X POST http://localhost:3002/api/db/execute \
  -H "Content-Type: application/json" \
  -d '{
    "dbType": "sqlite",
    "query": "SELECT * FROM sqlite_master WHERE type=\"table\";",
    "config": {
      "path": "./config.db"
    }
  }'
```

---

## 🌐 OC Core / CAS Transport

### 1. Get Available Environments

```bash
curl http://localhost:3002/api/oc-core/environments
```

Response:
```json
[
  {
    "id": "MOCK",
    "label": "Mock API",
    "baseUrl": "http://localhost:3010",
    "ocCoreMode": true,
    "casTransport": false
  },
  {
    "id": "MPAY",
    "label": "MPAY Gateway",
    "baseUrl": "http://10.0.142.4:7033",
    "ocCoreMode": true,
    "casTransport": true
  },
  {
    "id": "OC_CORE_LOCAL",
    "label": "OC Core (Local)",
    "baseUrl": "http://localhost:8080",
    "ocCoreMode": true,
    "casTransport": true
  },
  {
    "id": "OC_CORE_UAT",
    "label": "OC Core (UAT)",
    "baseUrl": "https://uat.occore.com",
    "ocCoreMode": true,
    "casTransport": true
  },
  {
    "id": "OC_CORE_PROD",
    "label": "OC Core (Production)",
    "baseUrl": "https://prod.occore.com",
    "ocCoreMode": true,
    "casTransport": true
  }
]
```

### 2. Preview Signed URL (without invoking)

```bash
curl -X POST http://localhost:3002/api/oc-core/invoke/preview \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "MOCK",
    "endpoint": "/api/v1/payment",
    "params": ["payment", "ACC001", "1000", "PKR"],
    "method": "GET"
  }'
```

Response:
```json
{
  "signedUrl": "http://localhost:3010/api/v1/payment/payment%2CACC001%2C1000%2CPKR/SHA256HASH",
  "curlCommand": "curl -X GET 'http://localhost:3010/api/v1/payment/payment%2CACC001%2C1000%2CPKR/SHA256HASH'",
  "fullUrl": "http://localhost:3010/api/v1/payment/payment,ACC001,1000,PKR/SHA256HASH"
}
```

### 3. Invoke OC Core API (GET)

```bash
curl -X POST http://localhost:3002/api/oc-core/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "MOCK",
    "endpoint": "/api/v1/payment",
    "params": ["payment", "ACC001", "1000", "PKR"],
    "method": "GET"
  }'
```

### 4. Invoke OC Core API (POST)

```bash
curl -X POST http://localhost:3002/api/oc-core/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "MOCK",
    "endpoint": "/api/v1/payment",
    "params": ["payment", "ACC001", "1000", "PKR"],
    "method": "POST"
  }'
```

### 5. Parse OC Core Response

```bash
curl -X POST http://localhost:3002/api/oc-core/parse-response \
  -H "Content-Type: application/json" \
  -d '{
    "response": "200,SUCCESS,TXN123,2026-05-14T10:30:00Z"
  }'
```

Response:
```json
{
  "rspCode": "200",
  "rspDesc": "SUCCESS",
  "transactionId": "TXN123",
  "timestamp": "2026-05-14T10:30:00Z"
}
```

### 6. Get Environment Details

```bash
curl http://localhost:3002/api/oc-core/environment/MPAY
```

### 7. Override Environment URL (Runtime)

```bash
curl -X PUT http://localhost:3002/api/oc-core/environment/MPAY \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "http://10.0.142.5:7033"
  }'
```

---

## 📊 Validation & API Testing

### 1. Test API Endpoint

```bash
curl -X POST http://localhost:3002/api/validate/test \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "http://localhost:3010/api/v1/test",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer token123"
    },
    "body": {
      "account_id": "ACC001",
      "amount": 1000
    },
    "timeout": 5000
  }'
```

### 2. Get Validation History

```bash
curl http://localhost:3002/api/validate/history
```

### 3. Get Single Validation Record

```bash
curl http://localhost:3002/api/validate/history/RECORD_ID
```

---

## 📝 Transaction Logging

### Get Transaction Logs

```bash
curl http://localhost:3002/api/logs/transactions
```

### Get Filtered Logs

```bash
curl "http://localhost:3002/api/logs/transactions?status=success&limit=10"
```

### Get Transaction by ID

```bash
curl http://localhost:3002/api/logs/transactions/TXN123
```

---

## 📋 Validation History

### Get All Validations

```bash
curl http://localhost:3002/api/validation-history
```

### Get Validations with Filters

```bash
curl "http://localhost:3002/api/validation-history?status=pass&environment=MOCK&limit=5"
```

---

## 🏥 Production Readiness

### Get Readiness Status

```bash
curl http://localhost:3002/api/readiness/check
```

Response example:
```json
{
  "status": "partial",
  "score": 65,
  "checks": [
    {
      "id": "https_endpoints",
      "name": "HTTPS Endpoints",
      "status": "pass",
      "message": "All endpoints use HTTPS"
    },
    {
      "id": "database_connection",
      "name": "Database Connection",
      "status": "fail",
      "message": "No database configured"
    },
    {
      "id": "error_handling",
      "name": "Error Handling",
      "status": "pass",
      "message": "Global error handler configured"
    }
  ]
}
```

---

## 🔧 Import/Export

### 1. Import from cURL

```bash
curl -X POST http://localhost:3002/api/import/curl \
  -H "Content-Type: application/json" \
  -d '{
    "curlCommand": "curl -X POST https://api.example.com/v1/payment -H \"Content-Type: application/json\" -d '{\"account\":\"ACC001\",\"amount\":500}'"
  }'
```

### 2. Import from Postman

```bash
curl -X POST http://localhost:3002/api/import/postman \
  -H "Content-Type: application/json" \
  -d '{
    "collection": {
      "meta_data": {
        "trans_type": "payment"
      },
      "body": {
        "account": "ACC001",
        "amount": 1000
      }
    }
  }'
```

### 3. Export Configuration as JSON

```bash
curl http://localhost:3002/api/export/json/CONFIG_ID
```

### 4. Export Configuration as SQL

```bash
curl http://localhost:3002/api/export/sql/CONFIG_ID
```

---

## 🎯 Mock API Test Endpoints

These endpoints are on port 3010 and can be used for testing:

### Test with JSON Response

```bash
curl -X POST http://localhost:3010/api/v1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "ACC001",
    "amount": 1000,
    "currency": "PKR"
  }'
```

Expected response:
```json
{
  "status": "success",
  "transaction_id": "TXN-2026-05-14-001",
  "amount": 1000,
  "currency": "PKR",
  "timestamp": "2026-05-14T10:30:00Z"
}
```

### Test with Positional Params (OC Core format)

```bash
curl -X GET "http://localhost:3010/api/v1/payment/payment%2CACC001%2C1000%2CPKR/SIGNATURE"
```

---

## 🧪 Batch Testing Script

Save as `test-all.sh` (Unix/Mac) or `test-all.ps1` (PowerShell):

```bash
#!/bin/bash

BASE="http://localhost:3002"

echo "Testing Health..."
curl $BASE/health

echo -e "\n\nTesting OC Core Environments..."
curl $BASE/api/oc-core/environments

echo -e "\n\nTesting Preview Signed URL..."
curl -X POST $BASE/api/oc-core/invoke/preview \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "MOCK",
    "endpoint": "/api/v1/payment",
    "params": ["payment", "ACC001", "1000", "PKR"],
    "method": "GET"
  }'

echo -e "\n\nTesting Readiness Check..."
curl $BASE/api/readiness/check

echo -e "\n\nTesting Transaction Logs..."
curl $BASE/api/logs/transactions

echo -e "\n\n✅ All tests completed!"
```

Run with:
```bash
bash test-all.sh
```

---

## 📌 Common Test Scenarios

### Scenario 1: Complete Config Workflow

```bash
# 1. Create config
CONFIG_ID=$(curl -s -X POST http://localhost:3002/api/config \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"https://api.example.com","serviceName":"TestAPI"}' | jq -r '.id')

echo "Created config: $CONFIG_ID"

# 2. Test endpoint
curl -X POST http://localhost:3002/api/validate/test \
  -H "Content-Type: application/json" \
  -d "{\"endpoint\":\"https://api.example.com/v1/test\",\"method\":\"GET\"}"

# 3. Export as JSON
curl http://localhost:3002/api/export/json/$CONFIG_ID

# 4. Get history
curl http://localhost:3002/api/validate/history
```

### Scenario 2: OC Core CAS Testing

```bash
# 1. Get environments
curl http://localhost:3002/api/oc-core/environments

# 2. Preview signed URL (MPAY)
curl -X POST http://localhost:3002/api/oc-core/invoke/preview \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "MPAY",
    "endpoint": "/mpg/queueforwarding/",
    "params": ["title-fetch", "000000002000", "0220104400"],
    "method": "GET"
  }'

# 3. Invoke (if MPAY accessible)
curl -X POST http://localhost:3002/api/oc-core/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "MPAY",
    "endpoint": "/mpg/queueforwarding/",
    "params": ["title-fetch", "000000002000", "0220104400"],
    "method": "POST"
  }'
```

### Scenario 3: Database Connection Testing

```bash
# Test SQLite
curl -X POST http://localhost:3002/api/db/test \
  -H "Content-Type: application/json" \
  -d '{"type":"sqlite","config":{"path":"./config.db"}}'

# Execute query
curl -X POST http://localhost:3002/api/db/execute \
  -H "Content-Type: application/json" \
  -d '{
    "dbType":"sqlite",
    "query":"SELECT name FROM sqlite_master WHERE type=\"table\";",
    "config":{"path":"./config.db"}
  }'
```

---

## 🔗 Tips & Tricks

### Pretty Print JSON Response

```bash
curl http://localhost:3002/health | jq .
```

### Save Response to File

```bash
curl http://localhost:3002/api/oc-core/environments > environments.json
```

### Extract Specific Field

```bash
curl -s http://localhost:3002/api/oc-core/environments | jq '.[0].label'
```

### Add Custom Headers

```bash
curl -X POST http://localhost:3002/api/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"serviceName":"Test"}'
```

### Enable Verbose Output (debug)

```bash
curl -v http://localhost:3002/health
```

### Follow Redirects

```bash
curl -L http://localhost:3002/api/config/CONFIG_ID
```

---

## ✅ Quick Validation

Run these to verify everything works:

```bash
# 1. Health check (should return ok)
curl http://localhost:3002/health

# 2. Environments (should list 5 environments)
curl http://localhost:3002/api/oc-core/environments | jq '.length'

# 3. Readiness (should return status)
curl http://localhost:3002/api/readiness/check | jq '.status'

# If all three pass, backend is working! ✅
```

---

**Happy Testing! 🚀**
