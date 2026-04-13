import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ChevronDown, Plus, Save, Trash2, Eye, EyeOff, AlertCircle,
  CheckCircle, Copy, Code, Database, RefreshCw, Play, Table, Server,
  Shield, Zap, ArrowRight, ArrowLeft, Download,
  Activity, Globe, Key, Layers, FileJson, Terminal, X, Check, Loader2, Settings,
  Link2, Clock, Hash
} from 'lucide-react';

const API_BASE = '/api';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'from-emerald-500 to-emerald-600 text-white',
    error: 'from-red-500 to-red-600 text-white',
    info: 'from-blue-500 to-blue-600 text-white',
    warning: 'from-amber-500 to-amber-600 text-white'
  };

  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl bg-gradient-to-r ${colors[type]} animate-slide-in`}>
      {type === 'success' && <Check className="w-5 h-5" />}
      {type === 'error' && <AlertCircle className="w-5 h-5" />}
      {type === 'info' && <Activity className="w-5 h-5" />}
      {type === 'warning' && <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70 transition"><X className="w-4 h-4" /></button>
    </div>
  );
};

const OpenConnectConfigUI = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [clientName] = useState('Ethswitch');
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [isSaving, setIsSaving] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [showSavedConfigs, setShowSavedConfigs] = useState(false);

  const [wsConfig, setWsConfig] = useState({
    baseUrl: 'https://api.ethswitch.com/v1',
    type: 'payment-gateway',
    serviceName: 'Ethswitch Payment Gateway'
  });

  const [wsEndpointConfig, setWsEndpointConfig] = useState({
    method: 'POST',
    endpointTemplate: '/transactions/transfer',
    requestFormat: 'JSON',
    responseFormat: 'JSON',
    dataTemplate: '',
    requestHeaders: { 'Content-Type': 'application/json' },
    connectionTimeout: 5000,
    readTimeout: 30000,
    responseCodePath: '$.responseCode',
    responseIncludePaths: '$.rrn,$.description,$.stan',
    type: 'PAYMENT',
    reversalType: 'FULL_REVERSAL',
    guaranteed: true,
    variableFields: [],
    exReqResLog: true,
    tokenConfigId: null,
    tokenRequestId: null
  });

  const [wsTokenConfig, setWsTokenConfig] = useState({
    tokenField: '$.access_token',
    expiryField: '$.expires_in',
    expiryType: 'SECONDS',
    clientId: '',
    clientSecret: '',
    tokenEndpoint: '/auth/token',
    currentToken: null,
    currentExpiryEpoch: 0
  });

  const [tranRequestMap, setTranRequestMap] = useState([
    { id: 1001, paramName: 'fromAccount', value: '{FROM_ACCOUNT}', isMandatory: 'Y', maxLength: 20, regex: '^[0-9]+$', logParameter: 1, logColumn: 'identifier' },
    { id: 1002, paramName: 'toAccount', value: '{TO_ACCOUNT}', isMandatory: 'Y', maxLength: 20, regex: '^[0-9]+$', logParameter: 1, logColumn: 'to_account' },
    { id: 1003, paramName: 'amount', value: '{AMOUNT}', isMandatory: 'Y', maxLength: 15, regex: '^[0-9]+(\\.[0-9]{1,2})?$', logParameter: 1, logColumn: 'amount' },
    { id: 1004, paramName: 'currency', value: 'PKR', isMandatory: 'Y', maxLength: 3, regex: '^[A-Z]{3}$', logParameter: 0, logColumn: null }
  ]);

  const [wsResponseDefinition, setWsResponseDefinition] = useState([
    { matchCode: '00', ourCode: '000', ourDescription: 'Transaction Approved' },
    { matchCode: '01', ourCode: '100', ourDescription: 'Insufficient Funds' },
    { matchCode: '05', ourCode: '102', ourDescription: 'Transaction Declined' },
    { matchCode: '96', ourCode: '500', ourDescription: 'System Error' },
    { matchCode: 'TIMEOUT', ourCode: '503', ourDescription: 'Service Timeout' },
    { matchCode: '*', ourCode: '999', ourDescription: 'Unknown Error' }
  ]);

  const [wsReqParamDetails, setWsReqParamDetails] = useState({
    tranId: 501,
    tranType: 'FUND_TRANSFER',
    queueIn: 'ETHSWITCH_API',
    queueType: 'REQUEST',
    fromIp: '0.0.0.0',
    hostId: 1,
    responseType: 'JSON',
    safQueue: 'SAF_TRANSFER_QUEUE'
  });

  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [dbResults, setDbResults] = useState(null);
  const [verifyData, setVerifyData] = useState(null);
  const [showVerify, setShowVerify] = useState(false);
  const [dbMode, setDbMode] = useState('sqlite');
  const [dbInfo, setDbInfo] = useState(null);

  const showToast = (message, type = 'info') => setToast({ message, type });

  // Backend health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const resp = await fetch(`${API_BASE}/health`);
        if (resp.ok) {
          const data = await resp.json();
          setBackendStatus(data.status === 'ok' ? 'connected' : 'error');
          setDbMode(data.mode || 'sqlite');
          setDbInfo(data);
        } else {
          setBackendStatus('error');
        }
      } catch {
        setBackendStatus('disconnected');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load saved configs
  useEffect(() => {
    if (backendStatus === 'connected') fetchSavedConfigs();
  }, [backendStatus]);

  const fetchSavedConfigs = async () => {
    try {
      const resp = await fetch(`${API_BASE}/configs`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) setSavedConfigs(data.configs || []);
      }
    } catch { /* silent */ }
  };

  const validateStep = useCallback((step) => {
    switch (step) {
      case 0: return wsConfig.baseUrl && wsConfig.type && wsConfig.serviceName;
      case 1: return wsEndpointConfig.method && wsEndpointConfig.endpointTemplate;
      case 2: return true;
      case 3: return tranRequestMap.length > 0 && tranRequestMap.every(f => f.paramName && f.value);
      case 4: return wsResponseDefinition.length > 0 && wsResponseDefinition.some(r => r.matchCode === '*');
      default: return true;
    }
  }, [wsConfig, wsEndpointConfig, tranRequestMap, wsResponseDefinition]);

  const generateSqlStatements = useCallback(() => {
    const sqls = [];
    sqls.push(`-- OpenConnect Configuration SQL\n-- Generated: ${new Date().toISOString()}\n-- Client: ${clientName}\n`);
    sqls.push(`INSERT INTO ws_config (base_url, [type], service_name)\nVALUES ('${wsConfig.baseUrl}', '${wsConfig.type}', '${wsConfig.serviceName}');\n`);

    if (wsTokenConfig.clientId) {
      sqls.push(`INSERT INTO ws_token_config (token_field, expiry_field, expiry_type, current_token, current_expiry_epoch)\nVALUES ('${wsTokenConfig.tokenField}', '${wsTokenConfig.expiryField}', '${wsTokenConfig.expiryType}', NULL, 0);\n`);
    }

    const headerJson = JSON.stringify(wsEndpointConfig.requestHeaders).replace(/'/g, "''");
    sqls.push(`INSERT INTO ws_endpoint_config (config_id, [method], endpoint_template, request_format, response_format, data_template, request_headers, connection_timeout, read_timeout, response_code_path, response_include_paths, [type], reversal_type, guaranteed, variable_fields, ex_req_res_log)\nVALUES (1, '${wsEndpointConfig.method}', '${wsEndpointConfig.endpointTemplate}', '${wsEndpointConfig.requestFormat}', '${wsEndpointConfig.responseFormat}', '${wsEndpointConfig.dataTemplate.replace(/'/g, "''")}', '${headerJson}', ${wsEndpointConfig.connectionTimeout}, ${wsEndpointConfig.readTimeout}, '${wsEndpointConfig.responseCodePath}', '${wsEndpointConfig.responseIncludePaths}', '${wsEndpointConfig.type}', '${wsEndpointConfig.reversalType}', ${wsEndpointConfig.guaranteed ? 1 : 0}, '${wsEndpointConfig.variableFields.join(',')}', '${wsEndpointConfig.exReqResLog ? 'Y' : 'N'}');\n`);

    sqls.push(`-- Response Code Mappings`);
    wsResponseDefinition.forEach((resp) => {
      sqls.push(`INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description)\nVALUES (1, '${resp.matchCode}', '${resp.ourCode}', '${resp.ourDescription}');`);
    });
    sqls.push('');

    sqls.push(`INSERT INTO ws_req_param_details (tran_id, tran_type, queue_in, queue_type, from_ip, host_id, response_type, saf_queue)\nVALUES (${wsReqParamDetails.tranId}, '${wsReqParamDetails.tranType}', '${wsReqParamDetails.queueIn}', '${wsReqParamDetails.queueType}', '${wsReqParamDetails.fromIp}', ${wsReqParamDetails.hostId}, '${wsReqParamDetails.responseType}', '${wsReqParamDetails.safQueue}');\n`);

    sqls.push(`-- Field Mappings`);
    tranRequestMap.forEach((field, idx) => {
      const regexVal = field.regex ? `'${field.regex}'` : "''";
      sqls.push(`INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, is_escape, param_priority)\nVALUES (${field.id}, ${wsReqParamDetails.tranId}, '${field.paramName}', '${field.value}', '${field.isMandatory}', '${field.maxLength}', ${regexVal}, ${field.logParameter}, ${field.logColumn ? `'${field.logColumn}'` : 'NULL'}, 0, 0, ${idx + 1});`);
    });

    return sqls.join('\n');
  }, [clientName, wsConfig, wsEndpointConfig, wsTokenConfig, tranRequestMap, wsResponseDefinition, wsReqParamDetails]);

  const generateJsonConfig = useMemo(() => ({
    client: clientName,
    service: wsConfig,
    endpoint: wsEndpointConfig,
    authentication: wsTokenConfig.clientId ? { type: 'OAuth2', ...wsTokenConfig } : null,
    fieldMappings: tranRequestMap,
    responseCodeMappings: wsResponseDefinition,
    routing: wsReqParamDetails
  }), [clientName, wsConfig, wsEndpointConfig, wsTokenConfig, tranRequestMap, wsResponseDefinition, wsReqParamDetails]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`, 'success');
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wsConfig.serviceName, client: clientName, config: generateJsonConfig })
      });
      const data = await resp.json();
      if (data.success) {
        showToast('Configuration saved to database', 'success');
        fetchSavedConfigs();
      } else {
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch {
      showToast('Cannot connect to backend server', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const loadConfig = async (id) => {
    try {
      const resp = await fetch(`${API_BASE}/configs/${id}`);
      const data = await resp.json();
      if (data.success && data.config) {
        const cfg = typeof data.config.config_data === 'string' ? JSON.parse(data.config.config_data) : data.config.config_data;
        if (cfg.service) setWsConfig(cfg.service);
        if (cfg.endpoint) setWsEndpointConfig(cfg.endpoint);
        if (cfg.authentication) setWsTokenConfig(prev => ({ ...prev, ...cfg.authentication }));
        if (cfg.fieldMappings) setTranRequestMap(cfg.fieldMappings);
        if (cfg.responseCodeMappings) setWsResponseDefinition(cfg.responseCodeMappings);
        if (cfg.routing) setWsReqParamDetails(cfg.routing);
        setShowSavedConfigs(false);
        setCurrentStep(0);
        showToast('Configuration loaded successfully', 'success');
      }
    } catch {
      showToast('Failed to load configuration', 'error');
    }
  };

  const deleteConfig = async (id) => {
    try {
      await fetch(`${API_BASE}/configs/${id}`, { method: 'DELETE' });
      showToast('Configuration deleted', 'info');
      fetchSavedConfigs();
    } catch {
      showToast('Failed to delete configuration', 'error');
    }
  };

  const generateSqliteStatements = useCallback(() => {
    const stmts = [];
    stmts.push(`INSERT INTO ws_config (base_url, type, service_name) VALUES ('${wsConfig.baseUrl}', '${wsConfig.type}', '${wsConfig.serviceName}')`);
    if (wsTokenConfig.clientId) {
      stmts.push(`INSERT INTO ws_token_config (token_field, expiry_field, expiry_type, current_token, current_expiry_epoch) VALUES ('${wsTokenConfig.tokenField}', '${wsTokenConfig.expiryField}', '${wsTokenConfig.expiryType}', NULL, 0)`);
    }
    const headerJson = JSON.stringify(wsEndpointConfig.requestHeaders).replace(/'/g, "''");
    const dataTemplate = wsEndpointConfig.dataTemplate.replace(/'/g, "''");
    stmts.push(`INSERT INTO ws_endpoint_config (config_id, method, endpoint_template, request_format, response_format, data_template, request_headers, connection_timeout, read_timeout, response_code_path, response_include_paths, type, reversal_type, guaranteed, variable_fields, ex_req_res_log) VALUES (1, '${wsEndpointConfig.method}', '${wsEndpointConfig.endpointTemplate}', '${wsEndpointConfig.requestFormat}', '${wsEndpointConfig.responseFormat}', '${dataTemplate}', '${headerJson}', ${wsEndpointConfig.connectionTimeout}, ${wsEndpointConfig.readTimeout}, '${wsEndpointConfig.responseCodePath}', '${wsEndpointConfig.responseIncludePaths}', '${wsEndpointConfig.type}', '${wsEndpointConfig.reversalType}', ${wsEndpointConfig.guaranteed ? 1 : 0}, '${wsEndpointConfig.variableFields.join(',')}', '${wsEndpointConfig.exReqResLog ? 'Y' : 'N'}')`);
    wsResponseDefinition.forEach((resp) => {
      stmts.push(`INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description) VALUES (1, '${resp.matchCode}', '${resp.ourCode}', '${resp.ourDescription}')`);
    });
    stmts.push(`INSERT INTO ws_req_param_details (tran_id, tran_type, queue_in, queue_type, from_ip, host_id, response_type, saf_queue) VALUES (${wsReqParamDetails.tranId}, '${wsReqParamDetails.tranType}', '${wsReqParamDetails.queueIn}', '${wsReqParamDetails.queueType}', '${wsReqParamDetails.fromIp}', ${wsReqParamDetails.hostId}, '${wsReqParamDetails.responseType}', '${wsReqParamDetails.safQueue}')`);
    tranRequestMap.forEach((field, idx) => {
      const regexVal = field.regex ? `'${field.regex}'` : "''";
      stmts.push(`INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, is_escape, param_priority) VALUES (${field.id}, ${wsReqParamDetails.tranId}, '${field.paramName}', '${field.value}', '${field.isMandatory}', '${field.maxLength}', ${regexVal}, ${field.logParameter}, ${field.logColumn ? `'${field.logColumn}'` : 'NULL'}, 0, 0, ${idx + 1})`);
    });
    return stmts;
  }, [wsConfig, wsEndpointConfig, wsTokenConfig, tranRequestMap, wsResponseDefinition, wsReqParamDetails]);

  const executeInDemoDB = async () => {
    setDbStatus('executing');
    setDbResults(null);
    setVerifyData(null);
    setShowVerify(false);
    try {
      await fetch(`${API_BASE}/reset`, { method: 'POST' });
      const statements = generateSqliteStatements();
      const resp = await fetch(`${API_BASE}/execute-sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements })
      });
      const data = await resp.json();
      if (data.success) {
        setDbStatus('success');
        setDbResults(data.results);
        showToast(`${data.results.length} SQL statements executed`, 'success');
      } else {
        setDbStatus('error');
        setDbResults({ error: data.error });
        showToast('SQL execution failed', 'error');
      }
    } catch {
      setDbStatus('error');
      setDbResults({ error: 'Cannot connect to demo server. Run: npm run server' });
      showToast('Backend server not reachable', 'error');
    }
  };

  const verifyDemoDB = async () => {
    try {
      const resp = await fetch(`${API_BASE}/verify`);
      const data = await resp.json();
      if (data.success) {
        setVerifyData(data);
        setShowVerify(true);
        showToast('Database verified', 'info');
      }
    } catch {
      setVerifyData({ error: 'Cannot connect to demo server' });
      setShowVerify(true);
    }
  };

  const resetDemoDB = async () => {
    try {
      await fetch(`${API_BASE}/reset`, { method: 'POST' });
      setDbStatus(null);
      setDbResults(null);
      setVerifyData(null);
      setShowVerify(false);
      showToast('Database reset complete', 'info');
    } catch {
      showToast('Reset failed - server not running', 'error');
    }
  };

  const stepIcons = [Globe, Link2, Key, Layers, FileJson, CheckCircle];

  const inputClass = "w-full px-4 py-2.5 bg-slate-800/80 border border-slate-600/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm";
  const monoInputClass = `${inputClass} font-mono`;
  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  const FormInput = ({ label, hint, icon: Icon, children }) => (
    <div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
        {Icon && <Icon className="w-4 h-4 text-blue-400" />}
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );

  // ============ STEP COMPONENTS ============
  const StepServiceConfig = () => (
    <div className="space-y-5">
      <FormInput label="Service Base URL" hint="Full base URL where all endpoint paths will be appended" icon={Globe}>
        <input type="text" placeholder="https://api.example.com/v1" value={wsConfig.baseUrl}
          onChange={(e) => setWsConfig({ ...wsConfig, baseUrl: e.target.value })} className={monoInputClass} />
      </FormInput>
      <FormInput label="Service Type" icon={Settings}>
        <select value={wsConfig.type} onChange={(e) => setWsConfig({ ...wsConfig, type: e.target.value })} className={selectClass}>
          <option value="payment-gateway">Payment Gateway</option>
          <option value="core-banking">Core Banking</option>
          <option value="fraud-detection">Fraud Detection</option>
          <option value="settlement">Settlement System</option>
          <option value="custom">Custom API</option>
        </select>
      </FormInput>
      <FormInput label="Service Name" icon={Server}>
        <input type="text" placeholder="My Payment Gateway" value={wsConfig.serviceName}
          onChange={(e) => setWsConfig({ ...wsConfig, serviceName: e.target.value })} className={inputClass} />
      </FormInput>
    </div>
  );

  const StepEndpointConfig = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormInput label="HTTP Method" icon={Zap}>
          <select value={wsEndpointConfig.method}
            onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, method: e.target.value })} className={selectClass}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </FormInput>
        <FormInput label="Endpoint Path" icon={Link2}>
          <input type="text" placeholder="/transactions/transfer" value={wsEndpointConfig.endpointTemplate}
            onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, endpointTemplate: e.target.value })} className={monoInputClass} />
        </FormInput>
      </div>
      <FormInput label="Request Body Template (JSON)" hint="Use {PLACEHOLDER} for dynamic values" icon={Code}>
        <textarea placeholder='{"fromAccount":"{FROM_ACCOUNT}","toAccount":"{TO_ACCOUNT}","amount":"{AMOUNT}"}'
          value={wsEndpointConfig.dataTemplate}
          onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, dataTemplate: e.target.value })}
          rows="4" className={`${monoInputClass} resize-none`} />
      </FormInput>
      <div className="grid grid-cols-2 gap-4">
        <FormInput label="Connection Timeout (ms)" icon={Clock}>
          <input type="number" value={wsEndpointConfig.connectionTimeout}
            onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, connectionTimeout: parseInt(e.target.value) || 0 })} className={inputClass} />
        </FormInput>
        <FormInput label="Read Timeout (ms)" icon={Clock}>
          <input type="number" value={wsEndpointConfig.readTimeout}
            onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, readTimeout: parseInt(e.target.value) || 0 })} className={inputClass} />
        </FormInput>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormInput label="Response Code JSON Path" icon={Hash}>
          <input type="text" placeholder="$.responseCode" value={wsEndpointConfig.responseCodePath}
            onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, responseCodePath: e.target.value })} className={monoInputClass} />
        </FormInput>
        <FormInput label="Extract Response Fields" icon={Hash}>
          <input type="text" placeholder="$.rrn,$.description,$.stan" value={wsEndpointConfig.responseIncludePaths}
            onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, responseIncludePaths: e.target.value })} className={monoInputClass} />
        </FormInput>
      </div>
    </div>
  );

  const StepTokenConfig = () => (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-300">OAuth2 Token Configuration</p>
          <p className="text-xs text-amber-400/70 mt-1">Leave empty to skip token authentication. Tokens are auto-refreshed by Open Connect.</p>
        </div>
      </div>
      <FormInput label="Client ID" icon={Key}>
        <input type="text" placeholder="my_app_id" value={wsTokenConfig.clientId}
          onChange={(e) => setWsTokenConfig({ ...wsTokenConfig, clientId: e.target.value })} className={inputClass} />
      </FormInput>
      <FormInput label="Client Secret" icon={Shield}>
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} placeholder="••••••••••••"
            value={wsTokenConfig.clientSecret}
            onChange={(e) => setWsTokenConfig({ ...wsTokenConfig, clientSecret: e.target.value })}
            className={`${inputClass} pr-12`} />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </FormInput>
      <div className="grid grid-cols-2 gap-4">
        <FormInput label="Token JSON Path" icon={Hash}>
          <input type="text" placeholder="$.access_token" value={wsTokenConfig.tokenField}
            onChange={(e) => setWsTokenConfig({ ...wsTokenConfig, tokenField: e.target.value })} className={monoInputClass} />
        </FormInput>
        <FormInput label="Expiry JSON Path" icon={Hash}>
          <input type="text" placeholder="$.expires_in" value={wsTokenConfig.expiryField}
            onChange={(e) => setWsTokenConfig({ ...wsTokenConfig, expiryField: e.target.value })} className={monoInputClass} />
        </FormInput>
      </div>
      <FormInput label="Token Endpoint Path" icon={Link2}>
        <input type="text" placeholder="/auth/token" value={wsTokenConfig.tokenEndpoint}
          onChange={(e) => setWsTokenConfig({ ...wsTokenConfig, tokenEndpoint: e.target.value })} className={monoInputClass} />
      </FormInput>
    </div>
  );

  const StepFieldMapping = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-300">
          Use dynamic values like <code className="px-1.5 py-0.5 bg-blue-500/20 rounded text-blue-200 text-xs font-mono">{'{FROM_ACCOUNT}'}</code> to map fields. Static values like <code className="px-1.5 py-0.5 bg-blue-500/20 rounded text-blue-200 text-xs font-mono">PKR</code> are sent as-is.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/80">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Param Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Value</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Required</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Max Len</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Regex</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Log</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {tranRequestMap.map((field, idx) => (
              <tr key={field.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-2.5">
                  <input type="text" value={field.paramName}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].paramName = e.target.value; setTranRequestMap(u); }}
                    className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-600/40 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                </td>
                <td className="px-4 py-2.5">
                  <input type="text" value={field.value}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].value = e.target.value; setTranRequestMap(u); }}
                    className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-600/40 rounded-md text-sm text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    placeholder="{FIELD_NAME}" />
                </td>
                <td className="px-4 py-2.5">
                  <select value={field.isMandatory}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].isMandatory = e.target.value; setTranRequestMap(u); }}
                    className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-600/40 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50">
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <input type="number" value={field.maxLength}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].maxLength = e.target.value; setTranRequestMap(u); }}
                    className="w-20 px-2.5 py-1.5 bg-slate-800/60 border border-slate-600/40 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                </td>
                <td className="px-4 py-2.5">
                  <input type="text" value={field.regex}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].regex = e.target.value; setTranRequestMap(u); }}
                    className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-600/40 rounded-md text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <input type="checkbox" checked={field.logParameter === 1}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].logParameter = e.target.checked ? 1 : 0; setTranRequestMap(u); }}
                    className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/30 bg-slate-800" />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button onClick={() => setTranRequestMap(tranRequestMap.filter((_, i) => i !== idx))}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => {
        const newId = Math.max(...tranRequestMap.map(f => f.id), 1000) + 1;
        setTranRequestMap([...tranRequestMap, { id: newId, paramName: '', value: '', isMandatory: 'Y', maxLength: 50, regex: '', logParameter: 0, logColumn: null }]);
      }}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition text-sm font-medium">
        <Plus className="w-4 h-4" /> Add Field
      </button>
    </div>
  );

  const StepResponseMapping = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <FileJson className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-300">
          Map API response codes to internal codes. The <code className="px-1.5 py-0.5 bg-blue-500/20 rounded text-blue-200 text-xs font-mono">*</code> wildcard catches all unmapped responses.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/80">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">API Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {wsResponseDefinition.map((resp, idx) => (
              <tr key={idx} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-2.5">
                  <input type="text" value={resp.matchCode}
                    onChange={(e) => { const u = [...wsResponseDefinition]; u[idx].matchCode = e.target.value; setWsResponseDefinition(u); }}
                    className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-600/40 rounded-md text-sm text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    placeholder="00 or *" />
                </td>
                <td className="px-4 py-2.5">
                  <input type="text" value={resp.ourCode}
                    onChange={(e) => { const u = [...wsResponseDefinition]; u[idx].ourCode = e.target.value; setWsResponseDefinition(u); }}
                    className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-600/40 rounded-md text-sm text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    placeholder="000" />
                </td>
                <td className="px-4 py-2.5">
                  <input type="text" value={resp.ourDescription}
                    onChange={(e) => { const u = [...wsResponseDefinition]; u[idx].ourDescription = e.target.value; setWsResponseDefinition(u); }}
                    className="w-full px-2.5 py-1.5 bg-slate-800/60 border border-slate-600/40 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button onClick={() => setWsResponseDefinition(wsResponseDefinition.filter((_, i) => i !== idx))}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setWsResponseDefinition([...wsResponseDefinition, { matchCode: '', ourCode: '', ourDescription: '' }])}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition text-sm font-medium">
        <Plus className="w-4 h-4" /> Add Mapping
      </button>
    </div>
  );

  const StepReview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-blue-400" />
            <h4 className="font-semibold text-slate-200 text-sm">Service</h4>
          </div>
          <dl className="space-y-1.5">
            <div className="flex items-start gap-2"><dt className="text-xs text-slate-500 min-w-[40px]">URL</dt><dd className="text-xs text-slate-300 font-mono break-all">{wsConfig.baseUrl}</dd></div>
            <div className="flex items-start gap-2"><dt className="text-xs text-slate-500 min-w-[40px]">Type</dt><dd className="text-xs text-slate-300">{wsConfig.type}</dd></div>
            <div className="flex items-start gap-2"><dt className="text-xs text-slate-500 min-w-[40px]">Name</dt><dd className="text-xs text-slate-300">{wsConfig.serviceName}</dd></div>
          </dl>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-emerald-400" />
            <h4 className="font-semibold text-slate-200 text-sm">Endpoint</h4>
          </div>
          <dl className="space-y-1.5">
            <div className="flex items-start gap-2"><dt className="text-xs text-slate-500 min-w-[52px]">Method</dt><dd className="text-xs text-slate-300 font-mono">{wsEndpointConfig.method}</dd></div>
            <div className="flex items-start gap-2"><dt className="text-xs text-slate-500 min-w-[52px]">Path</dt><dd className="text-xs text-slate-300 font-mono break-all">{wsEndpointConfig.endpointTemplate}</dd></div>
            <div className="flex items-start gap-2"><dt className="text-xs text-slate-500 min-w-[52px]">Timeout</dt><dd className="text-xs text-slate-300">{wsEndpointConfig.readTimeout}ms</dd></div>
          </dl>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-amber-400" />
            <h4 className="font-semibold text-slate-200 text-sm">Stats</h4>
          </div>
          <dl className="space-y-1.5">
            <div className="flex items-start gap-2"><dt className="text-xs text-slate-500 min-w-[52px]">Fields</dt><dd className="text-xs text-slate-300">{tranRequestMap.length} mapped</dd></div>
            <div className="flex items-start gap-2"><dt className="text-xs text-slate-500 min-w-[52px]">Codes</dt><dd className="text-xs text-slate-300">{wsResponseDefinition.length} mapped</dd></div>
            <div className="flex items-start gap-2"><dt className="text-xs text-slate-500 min-w-[52px]">Auth</dt><dd className="text-xs text-slate-300">{wsTokenConfig.clientId ? 'OAuth2' : 'None'}</dd></div>
          </dl>
        </div>
      </div>

      <div className="border border-slate-700/50 rounded-xl overflow-hidden">
        <button onClick={() => setShowSqlPreview(!showSqlPreview)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-800/50 hover:bg-slate-700/50 transition text-sm font-medium text-slate-300">
          <span className="flex items-center gap-2"><Terminal className="w-4 h-4 text-blue-400" />SQL Preview</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSqlPreview ? 'rotate-180' : ''}`} />
        </button>
        {showSqlPreview && (
          <div className="bg-slate-950 p-5 font-mono text-xs text-emerald-400 overflow-x-auto max-h-80 overflow-y-auto border-t border-slate-700/50">
            <pre className="whitespace-pre-wrap">{generateSqlStatements()}</pre>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={() => copyToClipboard(generateSqlStatements(), 'SQL')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition font-medium text-sm shadow-lg shadow-blue-600/20">
          <Copy className="w-4 h-4" /> Copy SQL
        </button>
        <button onClick={() => copyToClipboard(JSON.stringify(generateJsonConfig, null, 2), 'JSON')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-500 transition font-medium text-sm shadow-lg shadow-amber-600/20">
          <Copy className="w-4 h-4" /> Copy JSON
        </button>
        <button onClick={saveConfig} disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition font-medium text-sm shadow-lg shadow-emerald-600/20 disabled:opacity-50">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Saving...' : 'Save to DB'}
        </button>
      </div>

      {/* Database Testing */}
      <div className="border-t border-slate-700/50 pt-6">
        <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2 text-sm">
          <Database className="w-4 h-4 text-indigo-400" />
          Database Testing
          {dbMode === 'mssql' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 ml-1">LIVE SQL Server</span>
          )}
        </h4>
        <div className={`flex items-start gap-3 p-4 rounded-xl mb-4 ${dbMode === 'mssql' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
          <Database className={`w-5 h-5 flex-shrink-0 mt-0.5 ${dbMode === 'mssql' ? 'text-blue-400' : 'text-indigo-400'}`} />
          <div>
            {dbMode === 'mssql' ? (
              <>
                <p className="text-sm text-blue-300">Connected to <strong>{dbInfo?.database || 'SQL Server'}</strong> at <code className="bg-blue-500/20 px-1.5 rounded text-xs">{dbInfo?.server || ''}</code></p>
                <p className="text-xs text-blue-400/60 mt-1">SQL will execute directly on your production SQL Server database.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-indigo-300">Execute generated SQL against local SQLite demo database, then verify data.</p>
                <p className="text-xs text-indigo-400/60 mt-1">Requires: <code className="bg-indigo-500/20 px-1.5 rounded">npm run server</code></p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-3 mb-4">
          <button onClick={executeInDemoDB} disabled={dbStatus === 'executing'}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600/90 text-white rounded-xl hover:bg-emerald-500 transition font-medium text-sm disabled:opacity-50">
            {dbStatus === 'executing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {dbStatus === 'executing' ? 'Executing...' : (dbMode === 'mssql' ? 'Execute on SQL Server' : 'Execute in Demo DB')}
          </button>
          <button onClick={verifyDemoDB}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600/90 text-white rounded-xl hover:bg-indigo-500 transition font-medium text-sm">
            <Table className="w-4 h-4" /> Verify Data
          </button>
          <button onClick={resetDemoDB}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600/80 text-white rounded-xl hover:bg-red-500 transition font-medium text-sm">
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>

        {dbStatus === 'success' && dbResults && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="font-medium text-emerald-300 text-sm">SQL executed successfully</span>
              <span className="text-xs text-emerald-500 ml-auto">{dbResults.length} statement(s)</span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {dbResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span className="text-emerald-400/80 font-mono truncate">{r.sql}...</span>
                  {r.lastInsertRowid && <span className="text-emerald-500 ml-auto flex-shrink-0">ID: {r.lastInsertRowid}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {dbStatus === 'error' && dbResults && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="font-medium text-red-300 text-sm">Execution failed</span>
            </div>
            <p className="text-sm text-red-400/80 mt-2 font-mono">{dbResults.error}</p>
          </div>
        )}

        {showVerify && verifyData && !verifyData.error && (
          <div className="border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="bg-indigo-500/10 border-b border-indigo-500/20 px-5 py-3">
              <h5 className="font-medium text-indigo-300 flex items-center gap-2 text-sm">
                <Database className="w-4 h-4" /> Database Contents
              </h5>
            </div>
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto bg-slate-900/50">
              {Object.entries(verifyData.data).map(([table, rows]) => (
                <div key={table}>
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-sm font-semibold text-slate-300 font-mono">{table}</h6>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full ${rows.length > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                      {rows.length} row{rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {rows.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-slate-700/30">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-800/60">
                            {Object.keys(rows[0]).map(col => (
                              <th key={col} className="px-2.5 py-1.5 text-left font-medium text-slate-500">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/20">
                          {rows.map((row, ri) => (
                            <tr key={ri} className="hover:bg-slate-700/20">
                              {Object.values(row).map((val, ci) => (
                                <td key={ci} className="px-2.5 py-1.5 text-slate-400 font-mono max-w-48 truncate" title={String(val)}>
                                  {val === null ? <span className="text-slate-600 italic">NULL</span> : String(val).substring(0, 60)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 italic">No rows</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showVerify && verifyData && verifyData.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-sm text-red-400">{verifyData.error}</p>
          </div>
        )}
      </div>
    </div>
  );

  // ============ MAIN RENDER ============
  const steps = [
    { title: 'Service Config', desc: 'Define the external service', component: StepServiceConfig },
    { title: 'Endpoint', desc: 'Configure API endpoint & timeouts', component: StepEndpointConfig },
    { title: 'Authentication', desc: 'Set up OAuth2 credentials', component: StepTokenConfig },
    { title: 'Field Mapping', desc: 'Map request fields to params', component: StepFieldMapping },
    { title: 'Response Codes', desc: 'Define response translations', component: StepResponseMapping },
    { title: 'Review & Deploy', desc: 'Review, export, and test', component: StepReview }
  ];

  const CurrentStepComponent = steps[currentStep].component;
  const StepIcon = stepIcons[currentStep];

  const proTips = [
    'Use HTTPS endpoints only in production. Document your API credentials securely.',
    'Test timeouts with minimal values in DEV to catch slow APIs early.',
    'Create a TOKEN endpoint if your API requires OAuth2 authentication.',
    'Use regex patterns to validate field formats. Empty regex means no validation.',
    'Always add a wildcard (*) response mapping to handle unexpected codes.',
    'Keep your config in version control. Export JSON for backups.'
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200">
      <style>{`
        @keyframes slide-in { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
        .glass { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
        .glass-card { background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(51, 65, 85, 0.3); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.5); }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Saved Configs Modal */}
      {showSavedConfigs && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">Saved Configurations</h3>
              <button onClick={() => setShowSavedConfigs(false)} className="p-1.5 hover:bg-slate-700 rounded-lg transition"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {savedConfigs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No saved configurations yet</p>
              ) : (
                <div className="space-y-3">
                  {savedConfigs.map((cfg) => (
                    <div key={cfg.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{cfg.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{cfg.client} &middot; {new Date(cfg.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => loadConfig(cfg.id)}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition font-medium">Load</button>
                        <button onClick={() => deleteConfig(cfg.id)}
                          className="px-3 py-1.5 text-xs bg-red-600/50 text-red-300 rounded-lg hover:bg-red-600 hover:text-white transition font-medium">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="glass border-b border-slate-700/50 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-blue-500/20 border border-blue-500/20 flex-shrink-0">
                  <img src="/src/img/favicon.png" alt="OpenConnect Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">OpenConnect</h1>
                  <p className="text-[11px] text-slate-500 -mt-0.5">Configuration Automation</p>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-700/50 mx-2" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <span className="text-xs text-slate-500">Client:</span>
                <span className="text-xs font-semibold text-amber-400">{clientName}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <span className={`w-2 h-2 rounded-full ${backendStatus === 'connected' ? 'bg-emerald-400 pulse-dot' : backendStatus === 'checking' ? 'bg-amber-400 pulse-dot' : 'bg-red-400'}`} />
                <span className="text-xs text-slate-400">
                  {backendStatus === 'connected' ? 'Connected' : backendStatus === 'checking' ? 'Checking...' : 'Offline'}
                </span>
                {backendStatus === 'connected' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${dbMode === 'mssql' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-600/30 text-slate-400 border border-slate-600/30'}`}>
                    {dbMode === 'mssql' ? 'SQL Server' : 'SQLite'}
                  </span>
                )}
              </div>
              <button onClick={() => { setShowSavedConfigs(true); fetchSavedConfigs(); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition text-xs text-slate-400 hover:text-slate-200">
                <Download className="w-3.5 h-3.5" /> Saved ({savedConfigs.length})
              </button>
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-600/50 flex-shrink-0">
                  <img src="/src/img/pfp.jpg" alt="Uneeb" className="w-full h-full object-cover" />
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">By</p>
                  <p className="text-xs font-semibold text-slate-300 leading-tight">Uneeb</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* SIDEBAR */}
          <div className="col-span-3">
            <div className="glass-card rounded-2xl p-5 sticky top-20">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Configuration Steps</h3>
              <div className="space-y-1">
                {steps.map((step, idx) => {
                  const Icon = stepIcons[idx];
                  const isActive = idx === currentStep;
                  const isCompleted = validateStep(idx) && idx < currentStep;
                  return (
                    <button key={idx} onClick={() => setCurrentStep(idx)}
                      className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-700/30 border border-transparent'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-blue-600 shadow-lg shadow-blue-600/30' : isCompleted ? 'bg-emerald-600/80' : 'bg-slate-700/50 group-hover:bg-slate-600/50'}`}>
                          {isCompleted ? <Check className="w-4 h-4 text-white" /> : <Icon className="w-4 h-4 text-white/80" />}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isActive ? 'text-blue-300' : 'text-slate-300'}`}>{step.title}</p>
                          <p className="text-[11px] text-slate-500">{step.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 pt-5 border-t border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">Progress</span>
                  <span className="text-xs font-semibold text-blue-400">
                    {Math.round((steps.filter((_, idx) => validateStep(idx) && idx < currentStep).length / steps.length) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${(steps.filter((_, idx) => validateStep(idx) && idx < currentStep).length / steps.length) * 100}%` }} />
                </div>
              </div>
              <div className="mt-5 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-wider mb-1.5">Pro Tip</p>
                <p className="text-xs text-amber-400/60 leading-relaxed">{proTips[currentStep]}</p>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="col-span-9">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-700/30 bg-gradient-to-r from-blue-600/10 to-indigo-600/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center">
                    <StepIcon className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white">{steps[currentStep].title}</h2>
                      <span className="px-2 py-0.5 rounded-md bg-slate-700/50 text-[11px] text-slate-400 font-mono">Step {currentStep + 1}/{steps.length}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5">{steps[currentStep].desc}</p>
                  </div>
                </div>
              </div>
              <div className="p-8">
                <CurrentStepComponent />
              </div>
              <div className="px-8 py-4 border-t border-slate-700/30 bg-slate-900/30 flex justify-between items-center">
                <button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm font-medium">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex items-center gap-1.5">
                  {steps.map((_, idx) => (
                    <button key={idx} onClick={() => setCurrentStep(idx)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-blue-500' : validateStep(idx) && idx < currentStep ? 'bg-emerald-500' : 'bg-slate-600 hover:bg-slate-500'}`} />
                  ))}
                </div>
                <button onClick={() => {
                  if (currentStep === steps.length - 1) saveConfig();
                  else if (validateStep(currentStep)) setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
                  else showToast('Please fill in all required fields', 'warning');
                }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all ${currentStep === steps.length - 1 ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40' : validateStep(currentStep) ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                  {currentStep === steps.length - 1 ? (<><Save className="w-4 h-4" /> Save Configuration</>) : (<>Next <ArrowRight className="w-4 h-4" /></>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/50 mt-12">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg overflow-hidden border border-slate-600/30 flex-shrink-0">
                <img src="/src/img/favicon.png" alt="OpenConnect Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-slate-600">OpenConnect Configuration &middot; Paysys Labs</span>
            </div>
            <div className="text-xs text-slate-600">
              Developed with precision by <span className="text-slate-400 font-medium">Uneeb</span> &middot; &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OpenConnectConfigUI;
