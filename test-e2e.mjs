/**
 * End-to-end test script: SQL INSERT → Verify → API Layer Invoke → Response Check
 */

const API = 'http://localhost:3002';
const MOCK_API = 'http://localhost:3010';

async function run() {
  // ─── Step 0: Verify servers are up ────────────────
  console.log('=== CHECKING SERVERS ===');
  
  try {
    const h1 = await fetch(`${API}/api/health`);
    const d1 = await h1.json();
    console.log(`  Backend:  ${d1.status} (mode: ${d1.mode}, db: ${d1.database})`);
    if (d1.mode !== 'mssql') {
      console.log('  ⚠  Not in MSSQL mode. Connect to MSSQL first.');
      process.exit(1);
    }
  } catch {
    console.log('  ✗ Backend not running on port 3002');
    process.exit(1);
  }

  try {
    const h2 = await fetch(`${MOCK_API}/api/v1/health`);
    const d2 = await h2.json();
    console.log(`  Mock API: ${d2.status} (${d2.service})`);
  } catch {
    console.log('  ✗ Mock API not running on port 3010');
    process.exit(1);
  }

  // ─── Step 1: Clean up previous test data (if any) ─
  // NOTE: DELETE is blocked on external DBs for safety.
  // If re-running, use a different tran_id or clean up via SSMS.
  console.log('\n=== SKIP CLEANUP (DELETE blocked on external DB) ===');

  // ─── Step 2: Insert test data ─────────────────────
  console.log('\n=== INSERTING TEST DATA ===');

  const dataTemplate = JSON.stringify({
    channelId: "{{channelId}}",
    requestId: "{{requestId}}",
    traceId: "{{traceId}}",
    transactionDateTime: "{{transactionDateTime}}",
    bankCode: "{{bankCode}}",
    accountNumber: "{{accountNumber}}",
    iban: "{{iban}}",
    rrn: "{{rrn}}",
    stan: "{{stan}}"
  });

  const headers = JSON.stringify({ "Content-Type": "application/json" });

  const statements = [
    // ws_config
    `INSERT INTO ws_config (base_url, type) VALUES ('http://localhost:3010', 'REST')`,

    // ws_endpoint_config
    `INSERT INTO ws_endpoint_config (config_id, method, endpoint_template, request_format, response_format, data_template, request_headers, connection_timeout, read_timeout, response_code_path, response_include_paths, type, reversal_type, guaranteed, variable_fields, ex_req_res_log) VALUES ({LAST_INSERT_ID}, 'POST', '/api/v1/account/balance-inquiry', 'JSON', 'JSON', '${dataTemplate.replace(/'/g, "''")}', '${headers.replace(/'/g, "''")}', 5000, 30000, '$.responseCode', '$.data.accountTitle,$.data.availableBalance,$.data.iban,$.data.accountStatus', 'BALANCE_INQUIRY', 'NONE', 0, '', 'Y')`,

    // ws_response_definition
    `INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description) VALUES ({LAST_INSERT_ID}, '000', '00', 'Success')`,
    `INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description) VALUES ({LAST_INSERT_ID}, '001', '14', 'Account not found')`,
    `INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description) VALUES ({LAST_INSERT_ID}, '002', '91', 'Bank not reachable')`,
    `INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description) VALUES ({LAST_INSERT_ID}, '003', '30', 'Invalid request format')`,

    // ws_req_param_details
    `INSERT INTO ws_req_param_details (tran_id, tran_type, queue_in, queue_type, from_ip, host_id, response_type) VALUES (5002, 'BALANCE_INQ', 'OPENCONNECT.IN', 'REQUEST', '0.0.0.0', 1, 'JSON')`,

    // tran_req_map (9 fields)
    `INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (9101, 5002, 'channelId', 'MOBILE_APP', 'Y', '20', '', 0, NULL, 0, 1)`,
    `INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (9102, 5002, 'requestId', '{AUTO_GENERATE}', 'Y', '40', '', 1, 'request_id', 0, 2)`,
    `INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (9103, 5002, 'traceId', '{AUTO_GENERATE}', 'Y', '40', '', 0, NULL, 0, 3)`,
    `INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (9104, 5002, 'transactionDateTime', '{CURRENT_TIMESTAMP}', 'Y', '30', '', 0, NULL, 0, 4)`,
    `INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (9105, 5002, 'bankCode', '01', 'Y', '10', '', 0, NULL, 0, 5)`,
    `INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (9106, 5002, 'accountNumber', '1234567890', 'Y', '20', '', 1, 'account_no', 0, 6)`,
    `INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (9107, 5002, 'iban', '', 'N', '34', '', 0, NULL, 0, 7)`,
    `INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (9108, 5002, 'rrn', '123456789015', 'Y', '12', '', 1, 'rrn', 0, 8)`,
    `INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (9109, 5002, 'stan', '123459', 'Y', '6', '', 1, 'stan', 0, 9)`,
  ];

  const r = await fetch(`${API}/api/execute-sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statements })
  });
  const d = await r.json();

  if (!d.success) {
    console.log('  ✗ SQL EXECUTION FAILED:', d.error);
    if (d.results) {
      d.results.forEach((r, i) => {
        if (r.error) console.log(`    [${i + 1}] ${r.error}`);
      });
    }
    process.exit(1);
  }

  let configId = null;
  console.log(`  ✓ ${d.results.length} statements executed successfully`);
  d.results.forEach((r, i) => {
    const affected = r.rowsAffected !== undefined ? `rows=${r.rowsAffected}` : 'ok';
    const lid = r.lastInsertId ? ` → lastInsertId=${r.lastInsertId}` : '';
    if (r.lastInsertId && i === 0) configId = r.lastInsertId;
    console.log(`    [${i + 1}] ${affected}${lid}`);
  });

  console.log(`\n  ★ New ws_config.id = ${configId}`);

  // ─── Step 3: Verify data in MSSQL ────────────────
  console.log('\n=== VERIFYING INSERTED DATA ===');

  const verify = [
    `SELECT id, base_url, type FROM ws_config WHERE base_url = 'http://localhost:3010'`,
    `SELECT id, config_id, method, endpoint_template, type FROM ws_endpoint_config WHERE config_id = ${configId}`,
    `SELECT id, config_id, match_code, our_code, our_description FROM ws_response_definition WHERE config_id = ${configId}`,
    `SELECT tran_id, tran_type, queue_in, response_type FROM ws_req_param_details WHERE tran_id = 5002`,
    `SELECT id, tran_id, param_name, value FROM tran_req_map WHERE tran_id = 5002 ORDER BY param_priority`,
  ];

  const vr = await fetch(`${API}/api/execute-sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statements: verify })
  });
  const vd = await vr.json();

  const tableNames = ['ws_config', 'ws_endpoint_config', 'ws_response_definition', 'ws_req_param_details', 'tran_req_map'];
  vd.results.forEach((r, i) => {
    const count = r.rows ? r.rows.length : 0;
    console.log(`  ${count > 0 ? '✓' : '✗'} ${tableNames[i]}: ${count} row(s)`);
    if (r.rows && r.rows.length > 0 && i < 3) {
      r.rows.forEach(row => console.log(`    ${JSON.stringify(row)}`));
    }
  });

  // ─── Step 4: Test API Layer — Get configs ─────────
  console.log('\n=== API LAYER — LOADING CONFIGS ===');

  const cfgResp = await fetch(`${API}/api/layer/configs`);
  const cfgData = await cfgResp.json();
  console.log(`  Found ${cfgData.configs?.length || 0} config(s)`);

  const testConfig = cfgData.configs?.find(c => String(c.id) === String(configId));
  if (!testConfig) {
    console.log(`  ✗ Config ${configId} not found in API layer configs`);
    console.log('  Available:', cfgData.configs?.map(c => `${c.id}: ${c.base_url}`).join(', '));
    process.exit(1);
  }
  console.log(`  ✓ Found config: id=${testConfig.id}, base_url=${testConfig.base_url}, type=${testConfig.type}`);

  // ─── Step 5: Invoke API Layer — Happy Path ────────
  console.log('\n=== API LAYER — INVOKE (Happy Path) ===');

  const invokePayload = {
    channelId: 'MOBILE_APP',
    requestId: 'TF20260421180000001',
    traceId: 'TRACE20260421180000001',
    transactionDateTime: new Date().toISOString(),
    bankCode: '01',
    accountNumber: '1234567890',
    iban: '',
    rrn: '123456789015',
    stan: '123459'
  };

  const invokeResp = await fetch(`${API}/api/layer/invoke/${configId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invokePayload)
  });
  const invokeData = await invokeResp.json();

  if (invokeData.success) {
    console.log('  ✓ API invocation successful!');
    console.log(`  Response Code: ${invokeData.externalResponse?.rawResponseCode}`);
    console.log(`  Message:       ${invokeData.externalResponse?.fullBody?.responseMessage}`);
    console.log(`  Account Title: ${invokeData.externalResponse?.fullBody?.data?.accountTitle}`);
    console.log(`  Balance:       ${invokeData.externalResponse?.fullBody?.data?.availableBalance}`);
    console.log(`  Mapped Code:   ${invokeData.externalResponse?.mappedCode}`);
    console.log(`  Mapped Desc:   ${invokeData.externalResponse?.mappedDescription}`);
    
    const isPass = invokeData.externalResponse?.rawResponseCode === '000' 
      && invokeData.externalResponse?.fullBody?.data?.accountTitle === 'MUHAMMAD AHMED KHAN';
    console.log(`\n  ${isPass ? '★ HAPPY PATH: PASS ★' : '✗ HAPPY PATH: FAIL'}`);
  } else {
    console.log('  ✗ API invocation failed:', invokeData.error);
    console.log('  Details:', JSON.stringify(invokeData, null, 2));
  }

  // ─── Step 6: Invoke API Layer — Account Not Found ─
  console.log('\n=== API LAYER — INVOKE (Account Not Found) ===');

  const notFoundPayload = { ...invokePayload, accountNumber: '0000000000' };
  const nfResp = await fetch(`${API}/api/layer/invoke/${configId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notFoundPayload)
  });
  const nfData = await nfResp.json();

  if (nfData.success) {
    console.log(`  Response Code: ${nfData.externalResponse?.rawResponseCode}`);
    console.log(`  Mapped: ${nfData.externalResponse?.mappedCode} — ${nfData.externalResponse?.mappedDescription}`);
    const isPass = nfData.externalResponse?.rawResponseCode === '001';
    console.log(`  ${isPass ? '✓ ACCOUNT NOT FOUND: PASS' : '✗ ACCOUNT NOT FOUND: FAIL'}`);
  } else {
    console.log('  ✗ Failed:', nfData.error);
  }

  // ─── Step 7: Invoke API Layer — Bank Unreachable ──
  console.log('\n=== API LAYER — INVOKE (Bank Unreachable) ===');

  const bankPayload = { ...invokePayload, bankCode: '999' };
  const brResp = await fetch(`${API}/api/layer/invoke/${configId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bankPayload)
  });
  const brData = await brResp.json();

  if (brData.success) {
    console.log(`  Response Code: ${brData.externalResponse?.rawResponseCode}`);
    console.log(`  Mapped: ${brData.externalResponse?.mappedCode} — ${brData.externalResponse?.mappedDescription}`);
    const isPass = brData.externalResponse?.rawResponseCode === '002';
    console.log(`  ${isPass ? '✓ BANK UNREACHABLE: PASS' : '✗ BANK UNREACHABLE: FAIL'}`);
  } else {
    console.log('  ✗ Failed:', brData.error);
  }

  // ─── Summary ──────────────────────────────────────
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║        END-TO-END TEST COMPLETE           ║');
  console.log('╚═══════════════════════════════════════════╝');
}

run().catch(e => {
  console.error('\n✗ FATAL ERROR:', e.message);
  process.exit(1);
});
