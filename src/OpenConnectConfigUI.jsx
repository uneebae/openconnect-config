import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ChevronDown, Plus, Save, Trash2, Eye, EyeOff, AlertCircle,
  CheckCircle, Copy, Code, Database, RefreshCw, Play, Table, Server,
  Shield, Zap, ArrowRight, ArrowLeft, Download,
  Activity, Globe, Key, Layers, FileJson, Terminal, X, Check, Loader2, Settings,
  Link2, Clock, Hash, Power, PlugZap, Unplug, Sun, Moon, ShieldCheck
} from 'lucide-react';
import APIValidationDashboard from './components/APIValidationDashboard';
import PasteCurlImport from './components/PasteCurlImport';
import TransactionsLogViewer from './components/TransactionsLogViewer';
import ProductionReadinessChecker from './components/ProductionReadinessChecker';
import OCCoreEnvironmentSelector from './components/OCCoreEnvironmentSelector';
import './theme.css';

const API_BASE = '/api';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-600 text-white shadow-emerald-600/25',
    error: 'bg-red-600 text-white shadow-red-600/25',
    info: 'bg-blue-600 text-white shadow-blue-600/25',
    warning: 'bg-amber-600 text-white shadow-amber-600/25'
  };

  return (
    <div className={`fixed top-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl ${styles[type]} oc-toast-enter`}>
      {type === 'success' && <Check className="w-5 h-5 opacity-90" />}
      {type === 'error' && <AlertCircle className="w-5 h-5 opacity-90" />}
      {type === 'info' && <Activity className="w-5 h-5 opacity-90" />}
      {type === 'warning' && <AlertCircle className="w-5 h-5 opacity-90" />}
      <span className="text-sm font-medium tracking-tight">{message}</span>
      <button onClick={onClose} className="ml-3 p-1 rounded-lg hover:bg-white/20 transition"><X className="w-4 h-4" /></button>
    </div>
  );
};

const OpenConnectConfigUI = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [clientName] = useState('OpenConnect-TitleFetch');
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [isSaving, setIsSaving] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [showSavedConfigs, setShowSavedConfigs] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('oc-theme');
    return saved ? saved === 'dark' : true; // default dark
  });

  const toggleTheme = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('oc-theme', next ? 'dark' : 'light');
      // Immediately swap the class on the wrapper so the visual update
      // happens synchronously — before React's next paint cycle.
      const wrapper = document.getElementById('oc-root');
      if (wrapper) {
        wrapper.classList.toggle('oc-dark', next);
        wrapper.classList.toggle('oc-light', !next);
      }
      return next;
    });
  };

  const [wsConfig, setWsConfig] = useState({
    baseUrl: '',
    type: '',
    serviceName: ''
  });

  const [wsEndpointConfig, setWsEndpointConfig] = useState({
    method: 'POST',
    endpointTemplate: '',
    requestFormat: 'JSON',
    responseFormat: 'JSON',
    dataTemplate: '',
    requestHeaders: { 'Content-Type': 'application/json' },
    connectionTimeout: 5000,
    readTimeout: 30000,
    responseCodePath: '',
    responseIncludePaths: '',
    type: '',
    reversalType: 'NONE',
    guaranteed: false,
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

  const [tranRequestMap, setTranRequestMap] = useState([]);

  const [wsResponseDefinition, setWsResponseDefinition] = useState([]);

  const [wsReqParamDetails, setWsReqParamDetails] = useState({
    tranId: '',
    tranType: '',
    queueIn: '',
    queueType: 'REQUEST',
    fromIp: '0.0.0.0',
    hostId: 1,
    responseType: 'JSON',
    safQueue: ''
  });

  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [dbResults, setDbResults] = useState(null);
  const [verifyData, setVerifyData] = useState(null);
  const [showVerify, setShowVerify] = useState(false);
  const [dbMode, setDbMode] = useState('sqlite');
  const [dbInfo, setDbInfo] = useState(null);

  // ─── Database Connection Form State ────────────
  const [showDbConnect, setShowDbConnect] = useState(false);
  const [dbConnecting, setDbConnecting] = useState(false);
  const [dbConnForm, setDbConnForm] = useState({
    type: 'mssql', host: '', port: '', database: '', user: '', password: '', name: ''
  });
  const [savedConnections, setSavedConnections] = useState([]);
  const [showDbPassword, setShowDbPassword] = useState(false);

  // ─── API Layer Test State ───────────────────────
  const [apiLayerConfigs, setApiLayerConfigs] = useState([]);
  const [selectedApiConfigId, setSelectedApiConfigId] = useState('');
  const [apiTestParams, setApiTestParams] = useState(
    JSON.stringify({
      channelId: 'MOBILE_APP',
      requestId: 'TF20260420120100001',
      traceId: 'TRACE20260420120100001',
      transactionDateTime: new Date().toISOString(),
      bankCode: '01',
      accountNumber: '',
      iban: '',
      rrn: '123456789015',
      stan: '123459'
    }, null, 2)
  );
  const [apiTestResult, setApiTestResult] = useState(null);
  const [apiTestStatus, setApiTestStatus] = useState(null); // null | 'running' | 'success' | 'error'
  const [showApiTest, setShowApiTest] = useState(false);
  const [targetEnv, setTargetEnv] = useState('MOCK');

  // ─── App View ───────────────────────────────────
  // 'wizard' = classic 6-step form | 'import' = Quick Import screen | 'review' = Review & Deploy screen
  const [appView, setAppView] = useState('wizard');

  // ─── Quick Import State ─────────────────────────
  const [showQuickImport, setShowQuickImport] = useState(false); // legacy (unused)
  const [quickImportTab, setQuickImportTab] = useState('url'); // 'url' | 'request' | 'response'
  const [quickImportMode, setQuickImportMode] = useState('guided'); // 'guided' | 'curl'
  const [quickImport, setQuickImport] = useState({
    method: 'POST',
    url: '',
    serviceName: '',
    serviceType: 'REST',
    requestBody: '',
    responseBody: '',
  });
  const [quickImportErrors, setQuickImportErrors] = useState({});

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
    sqls.push(`INSERT INTO ws_config (base_url, [type], service_name)\nVALUES (${esc(wsConfig.baseUrl)}, ${esc(wsConfig.type)}, ${esc(wsConfig.serviceName)});\n`);

    if (wsTokenConfig.clientId) {
      sqls.push(`INSERT INTO ws_token_config (token_field, expiry_field, expiry_type, current_token, current_expiry_epoch)\nVALUES (${esc(wsTokenConfig.tokenField)}, ${esc(wsTokenConfig.expiryField)}, ${esc(wsTokenConfig.expiryType)}, NULL, 0);\n`);
    }

    const headerJson = JSON.stringify(wsEndpointConfig.requestHeaders);
    // Use {LAST_INSERT_ID} placeholder to reference the ws_config ID inserted above
    // Wrap placeholder in quotes so SQLite parses it as a string to be substituted by backend
    sqls.push(`INSERT INTO ws_endpoint_config (config_id, [method], endpoint_template, request_format, response_format, data_template, request_headers, connection_timeout, read_timeout, response_code_path, response_include_paths, [type], reversal_type, guaranteed, variable_fields, ex_req_res_log)\nVALUES ('{LAST_INSERT_ID}', ${esc(wsEndpointConfig.method)}, ${esc(wsEndpointConfig.endpointTemplate)}, ${esc(wsEndpointConfig.requestFormat)}, ${esc(wsEndpointConfig.responseFormat)}, ${esc(wsEndpointConfig.dataTemplate)}, ${esc(headerJson)}, ${escNum(wsEndpointConfig.connectionTimeout)}, ${escNum(wsEndpointConfig.readTimeout)}, ${esc(wsEndpointConfig.responseCodePath)}, ${esc(wsEndpointConfig.responseIncludePaths)}, ${esc(wsEndpointConfig.type)}, ${esc(wsEndpointConfig.reversalType)}, ${wsEndpointConfig.guaranteed ? 1 : 0}, ${esc(wsEndpointConfig.variableFields.join(','))}, ${esc(wsEndpointConfig.exReqResLog ? 'Y' : 'N')});\n`);

    sqls.push(`-- Response Code Mappings`);
    wsResponseDefinition.forEach((resp) => {
      // Use {LAST_INSERT_ID} placeholder to reference the ws_config ID
      // Wrap placeholder in quotes so SQLite parses it as a string to be substituted by backend
      sqls.push(`INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description)\nVALUES ('{LAST_INSERT_ID}', ${esc(resp.matchCode)}, ${esc(resp.ourCode)}, ${esc(resp.ourDescription)});`);
    });
    sqls.push('');

    sqls.push(`INSERT INTO ws_req_param_details (tran_id, tran_type, queue_in, queue_type, from_ip, host_id, response_type, saf_queue)\nVALUES (${escNum(wsReqParamDetails.tranId)}, ${esc(wsReqParamDetails.tranType)}, ${esc(wsReqParamDetails.queueIn)}, ${esc(wsReqParamDetails.queueType)}, ${esc(wsReqParamDetails.fromIp)}, ${escNum(wsReqParamDetails.hostId)}, ${esc(wsReqParamDetails.responseType)}, ${esc(wsReqParamDetails.safQueue)});\n`);

    sqls.push(`-- Field Mappings`);
    tranRequestMap.forEach((field, idx) => {
      sqls.push(`INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, is_escape, param_priority)\nVALUES (${escNum(field.id)}, ${escNum(wsReqParamDetails.tranId)}, ${esc(field.paramName)}, ${esc(field.value)}, ${esc(field.isMandatory)}, ${esc(field.maxLength)}, ${esc(field.regex)}, ${escNum(field.logParameter)}, ${field.logColumn ? esc(field.logColumn) : 'NULL'}, 0, 0, ${idx + 1});`);
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

  // ─── Load Demo Config (One-click happy flow) ───
  const loadDemoConfig = () => {
    setWsConfig({
      baseUrl: 'http://localhost:3010',
      type: 'REST',
      serviceName: 'Balance-Inquiry-Service'
    });
    setWsEndpointConfig({
      method: 'POST',
      endpointTemplate: '/api/v1/account/balance-inquiry',
      requestFormat: 'JSON',
      responseFormat: 'JSON',
      dataTemplate: JSON.stringify({
        channelId: '{{channelId}}',
        requestId: '{{requestId}}',
        traceId: '{{traceId}}',
        transactionDateTime: '{{transactionDateTime}}',
        bankCode: '{{bankCode}}',
        accountNumber: '{{accountNumber}}',
        iban: '{{iban}}',
        rrn: '{{rrn}}',
        stan: '{{stan}}'
      }, null, 2),
      requestHeaders: { 'Content-Type': 'application/json' },
      connectionTimeout: 5000,
      readTimeout: 30000,
      responseCodePath: '$.responseCode',
      responseIncludePaths: '$.data.accountTitle,$.data.availableBalance,$.data.iban,$.data.accountStatus',
      type: 'BALANCE_INQUIRY',
      reversalType: 'NONE',
      guaranteed: false,
      variableFields: [],
      exReqResLog: true,
      tokenConfigId: null,
      tokenRequestId: null
    });
    setWsTokenConfig({
      tokenField: '$.access_token',
      expiryField: '$.expires_in',
      expiryType: 'SECONDS',
      clientId: '',
      clientSecret: '',
      tokenEndpoint: '/auth/token',
      currentToken: null,
      currentExpiryEpoch: 0
    });
    // Use timestamp-based IDs to avoid PK conflicts on re-runs
    const base = Math.floor(Date.now() / 1000) % 100000;
    setTranRequestMap([
      { id: base * 10 + 1, paramName: 'channelId',             value: 'MOBILE_APP',        isMandatory: 'Y', maxLength: '20', regex: '',      logParameter: 0, logColumn: '' },
      { id: base * 10 + 2, paramName: 'requestId',             value: '{AUTO_GENERATE}',   isMandatory: 'Y', maxLength: '40', regex: '',      logParameter: 1, logColumn: 'request_id' },
      { id: base * 10 + 3, paramName: 'traceId',               value: '{AUTO_GENERATE}',   isMandatory: 'Y', maxLength: '40', regex: '',      logParameter: 0, logColumn: '' },
      { id: base * 10 + 4, paramName: 'transactionDateTime',   value: '{CURRENT_TIMESTAMP}', isMandatory: 'Y', maxLength: '30', regex: '',    logParameter: 0, logColumn: '' },
      { id: base * 10 + 5, paramName: 'bankCode',              value: '01',                isMandatory: 'Y', maxLength: '10', regex: '',      logParameter: 0, logColumn: '' },
      { id: base * 10 + 6, paramName: 'accountNumber',         value: '1234567890',        isMandatory: 'Y', maxLength: '20', regex: '^\\d+$', logParameter: 1, logColumn: 'account_no' },
      { id: base * 10 + 7, paramName: 'iban',                  value: '',                  isMandatory: 'N', maxLength: '34', regex: '',      logParameter: 0, logColumn: '' },
      { id: base * 10 + 8, paramName: 'rrn',                   value: '123456789015',      isMandatory: 'Y', maxLength: '12', regex: '',      logParameter: 1, logColumn: 'rrn' },
      { id: base * 10 + 9, paramName: 'stan',                  value: '123459',            isMandatory: 'Y', maxLength: '6',  regex: '',      logParameter: 1, logColumn: 'stan' },
    ]);
    setWsResponseDefinition([
      { matchCode: '000', ourCode: '00', ourDescription: 'Success' },
      { matchCode: '001', ourCode: '14', ourDescription: 'Account not found' },
      { matchCode: '002', ourCode: '91', ourDescription: 'Bank not reachable' },
      { matchCode: '003', ourCode: '30', ourDescription: 'Invalid request format' },
      { matchCode: '*',   ourCode: '96', ourDescription: 'Unknown error' },
    ]);
    // Use timestamp-based tran_id to avoid PK conflicts
    setWsReqParamDetails({
      tranId: String(base),
      tranType: 'BALANCE_INQ',
      queueIn: 'OPENCONNECT.IN',
      queueType: 'REQUEST',
      fromIp: '0.0.0.0',
      hostId: 1,
      responseType: 'JSON',
      safQueue: ''
    });
    setCurrentStep(0);
    setDbStatus(null);
    setDbResults(null);
    setVerifyData(null);
    setShowVerify(false);
    showToast('Demo config loaded — Balance Inquiry (Mock API)', 'success');
  };

  // ─── Quick Import Helpers ───────────────────────
  // Recursively replace primitive values with {{key}} placeholders
  const buildRequestTemplate = (obj) => {
    if (Array.isArray(obj)) return obj.map(buildRequestTemplate);
    if (obj !== null && typeof obj === 'object') {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== null && typeof v === 'object') result[k] = buildRequestTemplate(v);
        else result[k] = `{{${k}}}`;
      }
      return result;
    }
    return obj;
  };

  // Find the response-code key (tries common names)
  const findResponseCodePath = (obj, prefix = '$') => {
    if (!obj || typeof obj !== 'object') return null;
    const priority = ['responseCode', 'response_code', 'code', 'status', 'responseStatus', 'statusCode', 'resultCode', 'respCode'];
    for (const k of priority) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) return `${prefix}.${k}`;
    }
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const nested = findResponseCodePath(v, `${prefix}.${k}`);
        if (nested) return nested;
      }
    }
    return null;
  };

  // Get all leaf JSON paths (skip arrays of primitives)
  const getLeafPaths = (obj, prefix = '$') => {
    const paths = [];
    if (!obj || typeof obj !== 'object') return paths;
    for (const [k, v] of Object.entries(obj)) {
      const path = `${prefix}.${k}`;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        paths.push(...getLeafPaths(v, path));
      } else {
        paths.push(path);
      }
    }
    return paths;
  };

  // Get top-level primitive keys with sample values (for tran_req_map)
  const flattenRequestFields = (obj) => {
    const fields = [];
    if (!obj || typeof obj !== 'object') return fields;
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && typeof v === 'object') continue; // skip nested for field mappings
      fields.push({ name: k, value: v == null ? '' : String(v) });
    }
    return fields;
  };

  // ─── Generate Configuration from Quick Import ──
  const generateFromImport = () => {
    const errors = {};

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(quickImport.url);
    } catch {
      errors.url = 'Invalid URL. Example: http://localhost:3010/api/v1/account/balance-inquiry';
    }

    // Validate JSON
    let reqBody = {};
    if (quickImport.requestBody.trim()) {
      try { reqBody = JSON.parse(quickImport.requestBody); }
      catch { errors.request = 'Invalid JSON'; }
    } else {
      errors.request = 'Request body is required';
    }

    let respBody = {};
    if (quickImport.responseBody.trim()) {
      try { respBody = JSON.parse(quickImport.responseBody); }
      catch { errors.response = 'Invalid JSON'; }
    } else {
      errors.response = 'Response body is required';
    }

    if (!quickImport.serviceName.trim()) errors.serviceName = 'Service name is required';

    setQuickImportErrors(errors);
    if (Object.keys(errors).length > 0) {
      showToast('Please fix the errors in each tab', 'error');
      return;
    }

    // ─── Parse URL ──────────────────────────
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const endpointPath = parsedUrl.pathname + (parsedUrl.search || '');

    // ─── Build data template ────────────────
    const dataTemplate = JSON.stringify(buildRequestTemplate(reqBody), null, 2);

    // ─── Build field mappings from request ──
    const fields = flattenRequestFields(reqBody);
    const base = Math.floor(Date.now() / 1000) % 100000;
    const mappings = fields.map((f, idx) => ({
      id: base * 10 + idx + 1,
      paramName: f.name,
      value: f.value || `{{${f.name}}}`,
      isMandatory: f.value ? 'Y' : 'N',
      maxLength: '50',
      regex: '',
      logParameter: 0,
      logColumn: ''
    }));

    // ─── Parse response body ────────────────
    const codePath = findResponseCodePath(respBody) || '$.responseCode';
    const allPaths = getLeafPaths(respBody);
    const includePaths = allPaths.filter(p => p !== codePath).join(',');
    const detectedCode = codePath && respBody
      ? String(codePath.substring(2).split('.').reduce((o, k) => (o ? o[k] : undefined), respBody) ?? '000')
      : '000';

    // ─── Auto response code mappings ────────
    const responseDefs = [
      { matchCode: detectedCode, ourCode: '00', ourDescription: 'Success' },
      { matchCode: '*', ourCode: '96', ourDescription: 'Unknown error' },
    ];

    // ─── Apply everything to form state ─────
    setWsConfig({
      baseUrl,
      type: quickImport.serviceType || 'REST',
      serviceName: quickImport.serviceName.trim()
    });

    setWsEndpointConfig(prev => ({
      ...prev,
      method: quickImport.method || 'POST',
      endpointTemplate: endpointPath,
      requestFormat: 'JSON',
      responseFormat: 'JSON',
      dataTemplate,
      requestHeaders: { 'Content-Type': 'application/json' },
      connectionTimeout: 5000,
      readTimeout: 30000,
      responseCodePath: codePath,
      responseIncludePaths: includePaths,
      type: quickImport.serviceName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').substring(0, 30),
      reversalType: 'NONE',
      guaranteed: false,
      variableFields: fields.map(f => f.name),
      exReqResLog: true,
    }));

    setTranRequestMap(mappings);
    setWsResponseDefinition(responseDefs);
    setWsReqParamDetails({
      tranId: String(base),
      tranType: quickImport.serviceName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').substring(0, 30),
      queueIn: 'OPENCONNECT.IN',
      queueType: 'REQUEST',
      fromIp: '0.0.0.0',
      hostId: 1,
      responseType: 'JSON',
      safQueue: ''
    });

    setShowQuickImport(false);
    setAppView('review');
    setCurrentStep(5);
    setShowSqlPreview(true);
    setShowApiTest(true);
    setDbStatus(null);
    setDbResults(null);
    setVerifyData(null);
    setShowVerify(false);
    setQuickImportErrors({});
    showToast(`Configuration auto-generated — ${fields.length} fields, ${allPaths.length} response paths`, 'success');
  };

  // ─── SQL Escape Helper (prevents SQL injection) ─
  const esc = (val) => {
    if (val == null) return 'NULL';
    return "'" + String(val).replace(/'/g, "''") + "'";
  };
  const escNum = (val) => { const n = Number(val); return Number.isFinite(n) ? n : 0; };

  const generateSqliteStatements = useCallback(() => {
    const stmts = [];
    const isMssql = dbMode === 'mssql';

    // ws_config — MSSQL schema has no service_name column
    if (isMssql) {
      stmts.push(`INSERT INTO ws_config (base_url, type) VALUES (${esc(wsConfig.baseUrl)}, ${esc(wsConfig.type)})`);
    } else {
      stmts.push(`INSERT INTO ws_config (base_url, type, service_name) VALUES (${esc(wsConfig.baseUrl)}, ${esc(wsConfig.type)}, ${esc(wsConfig.serviceName)})`);
    }

    // ws_token_config — same across both schemas
    if (wsTokenConfig.clientId) {
      stmts.push(`INSERT INTO ws_token_config (token_field, expiry_field, expiry_type, current_token, current_expiry_epoch) VALUES (${esc(wsTokenConfig.tokenField)}, ${esc(wsTokenConfig.expiryField)}, ${esc(wsTokenConfig.expiryType)}, NULL, 0)`);
    }

    // ws_endpoint_config
    const headerJson = JSON.stringify(wsEndpointConfig.requestHeaders);
    // MSSQL config_id is bigint — use unquoted placeholder; SQLite uses quoted
    const fkRef = isMssql ? '{LAST_INSERT_ID}' : "'{LAST_INSERT_ID}'";
    stmts.push(`INSERT INTO ws_endpoint_config (config_id, method, endpoint_template, request_format, response_format, data_template, request_headers, connection_timeout, read_timeout, response_code_path, response_include_paths, type, reversal_type, guaranteed, variable_fields, ex_req_res_log) VALUES (${fkRef}, ${esc(wsEndpointConfig.method)}, ${esc(wsEndpointConfig.endpointTemplate)}, ${esc(wsEndpointConfig.requestFormat)}, ${esc(wsEndpointConfig.responseFormat)}, ${esc(wsEndpointConfig.dataTemplate)}, ${esc(headerJson)}, ${escNum(wsEndpointConfig.connectionTimeout)}, ${escNum(wsEndpointConfig.readTimeout)}, ${esc(wsEndpointConfig.responseCodePath)}, ${esc(wsEndpointConfig.responseIncludePaths)}, ${esc(wsEndpointConfig.type)}, ${esc(wsEndpointConfig.reversalType)}, ${wsEndpointConfig.guaranteed ? 1 : 0}, ${esc(wsEndpointConfig.variableFields.join(','))}, ${esc(wsEndpointConfig.exReqResLog ? 'Y' : 'N')})`);

    // ws_response_definition
    wsResponseDefinition.forEach((resp) => {
      stmts.push(`INSERT INTO ws_response_definition (config_id, match_code, our_code, our_description) VALUES (${fkRef}, ${esc(resp.matchCode)}, ${esc(resp.ourCode)}, ${esc(resp.ourDescription)})`);
    });

    // ws_req_param_details — MSSQL has different columns (no saf_queue)
    if (isMssql) {
      stmts.push(`INSERT INTO ws_req_param_details (tran_id, tran_type, queue_in, queue_type, from_ip, host_id, response_type) VALUES (${escNum(wsReqParamDetails.tranId)}, ${esc(wsReqParamDetails.tranType)}, ${esc(wsReqParamDetails.queueIn)}, ${esc(wsReqParamDetails.queueType)}, ${esc(wsReqParamDetails.fromIp)}, ${escNum(wsReqParamDetails.hostId)}, ${esc(wsReqParamDetails.responseType)})`);
    } else {
      stmts.push(`INSERT OR REPLACE INTO ws_req_param_details (tran_id, tran_type, queue_in, queue_type, from_ip, host_id, response_type, saf_queue) VALUES (${escNum(wsReqParamDetails.tranId)}, ${esc(wsReqParamDetails.tranType)}, ${esc(wsReqParamDetails.queueIn)}, ${esc(wsReqParamDetails.queueType)}, ${esc(wsReqParamDetails.fromIp)}, ${escNum(wsReqParamDetails.hostId)}, ${esc(wsReqParamDetails.responseType)}, ${esc(wsReqParamDetails.safQueue)})`);
    }

    // tran_req_map — MSSQL has no is_escape column
    tranRequestMap.forEach((field, idx) => {
      if (isMssql) {
        stmts.push(`INSERT INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, param_priority) VALUES (${escNum(field.id)}, ${escNum(wsReqParamDetails.tranId)}, ${esc(field.paramName)}, ${esc(field.value)}, ${esc(field.isMandatory)}, ${esc(field.maxLength)}, ${esc(field.regex)}, ${escNum(field.logParameter)}, ${field.logColumn ? esc(field.logColumn) : 'NULL'}, 0, ${idx + 1})`);
      } else {
        stmts.push(`INSERT OR REPLACE INTO tran_req_map (id, tran_id, param_name, value, is_mandatory, max_length, regex, log_parameter, log_column, is_batch, is_escape, param_priority) VALUES (${escNum(field.id)}, ${escNum(wsReqParamDetails.tranId)}, ${esc(field.paramName)}, ${esc(field.value)}, ${esc(field.isMandatory)}, ${esc(field.maxLength)}, ${esc(field.regex)}, ${escNum(field.logParameter)}, ${field.logColumn ? esc(field.logColumn) : 'NULL'}, 0, 0, ${idx + 1})`);
      }
    });
    return stmts;
  }, [wsConfig, wsEndpointConfig, wsTokenConfig, tranRequestMap, wsResponseDefinition, wsReqParamDetails, dbMode]);

  const executeInDemoDB = async () => {
    // Safety confirmation for external DB modes
    if (dbMode !== 'sqlite') {
      const confirmed = window.confirm(
        `⚠️ WARNING: You are about to INSERT data into the PRODUCTION ${dbTypeLabels[dbMode] || dbMode} database.\n\n` +
        'This will add new rows to the live database. Make sure you know what you are doing.\n\n' +
        'Click OK to proceed or Cancel to abort.'
      );
      if (!confirmed) return;
    }
    setDbStatus('executing');
    setDbResults(null);
    setVerifyData(null);
    setShowVerify(false);
    try {
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
        fetchApiLayerConfigs(); // refresh available configs for API layer test
        // Auto-verify so Database Contents shows the new data immediately
        verifyDemoDB();
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
    // Block reset when connected to any external database
    if (dbMode !== 'sqlite') {
      showToast('Reset is disabled when connected to an external database. Production data is protected.', 'error');
      return;
    }
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

  // ─── Database Connection Management ────────────
  const defaultPorts = { mssql: 1433, postgres: 5432, mysql: 3306 };
  const dbTypeLabels = { mssql: 'SQL Server', postgres: 'PostgreSQL', mysql: 'MySQL' };

  const fetchSavedConnections = async () => {
    try {
      const resp = await fetch(`${API_BASE}/db/connections`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) setSavedConnections(data.connections || []);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (backendStatus === 'connected') {
      fetchSavedConnections();
      fetchApiLayerConfigs();
    }
  }, [backendStatus]);

  const connectToDatabase = async () => {
    if (!dbConnForm.host || !dbConnForm.database || !dbConnForm.user) {
      showToast('Host, Database, and Username are required', 'warning');
      return;
    }
    setDbConnecting(true);
    try {
      const resp = await fetch(`${API_BASE}/db/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: dbConnForm.type,
          host: dbConnForm.host,
          port: dbConnForm.port || defaultPorts[dbConnForm.type],
          database: dbConnForm.database,
          user: dbConnForm.user,
          password: dbConnForm.password,
          options: { trustCert: true }
        })
      });
      const data = await resp.json();
      if (data.success) {
        setDbMode(data.type);
        setDbInfo({ server: data.host, database: data.database, mode: data.type });
        setShowDbConnect(false);
        showToast(`Connected to ${dbTypeLabels[data.type]}: ${data.database}`, 'success');
      } else {
        showToast(`Connection failed: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast(`Connection error: ${err.message}`, 'error');
    } finally {
      setDbConnecting(false);
    }
  };

  const disconnectDatabase = async () => {
    try {
      await fetch(`${API_BASE}/db/disconnect`, { method: 'POST' });
      setDbMode('sqlite');
      setDbInfo(null);
      showToast('Disconnected. Using SQLite demo mode.', 'info');
    } catch {
      showToast('Failed to disconnect', 'error');
    }
  };

  const saveConnection = async () => {
    if (!dbConnForm.name) {
      showToast('Give this connection a name before saving', 'warning');
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/db/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dbConnForm.name,
          type: dbConnForm.type,
          host: dbConnForm.host,
          port: dbConnForm.port || defaultPorts[dbConnForm.type],
          database_name: dbConnForm.database,
          username: dbConnForm.user,
          password: dbConnForm.password,
          options: { trustCert: true }
        })
      });
      const data = await resp.json();
      if (data.success) {
        showToast('Connection saved', 'success');
        fetchSavedConnections();
      }
    } catch {
      showToast('Failed to save connection', 'error');
    }
  };

  const loadSavedConnection = async (id) => {
    try {
      const resp = await fetch(`${API_BASE}/db/connections/${id}`);
      const data = await resp.json();
      if (data.success) {
        const c = data.connection;
        setDbConnForm({
          type: c.type,
          host: c.host,
          port: c.port || '',
          database: c.database_name,
          user: c.username,
          password: '', // Password is masked by the API — user must re-enter
          name: c.name
        });
        showToast(`Loaded: ${c.name} (re-enter password to connect)`, 'info');
      }
    } catch {
      showToast('Failed to load connection', 'error');
    }
  };

  const deleteSavedConnection = async (id) => {
    try {
      await fetch(`${API_BASE}/db/connections/${id}`, { method: 'DELETE' });
      showToast('Connection deleted', 'info');
      fetchSavedConnections();
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  // ─── API Layer Test ─────────────────────────────
  const fetchApiLayerConfigs = async () => {
    try {
      const resp = await fetch(`${API_BASE}/layer/configs`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.configs.length > 0) {
          setApiLayerConfigs(data.configs);
          // Auto-select the config matching the current form's base_url (most recent), or fall back to last
          const match = wsConfig.baseUrl
            ? [...data.configs].reverse().find(c => c.base_url === wsConfig.baseUrl)
            : null;
          setSelectedApiConfigId(String(match ? match.id : data.configs[data.configs.length - 1].id));
        }
      }
    } catch { /* silent */ }
  };

  const runApiLayerTest = async () => {
    if (!selectedApiConfigId) {
      showToast('No config selected — execute the form in DB first', 'warning');
      return;
    }
    let params;
    try {
      params = JSON.parse(apiTestParams);
    } catch {
      showToast('Test payload is not valid JSON', 'error');
      return;
    }
    setApiTestStatus('running');
    setApiTestResult(null);
    try {
      const resp = await fetch(`${API_BASE}/layer/invoke/${selectedApiConfigId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await resp.json();
      setApiTestResult(data);
      setApiTestStatus(data.success ? 'success' : 'error');
      if (data.success) {
        showToast(`API responded: ${data.externalResponse?.mappedCode} — ${data.externalResponse?.mappedDescription}`, 'success');
      } else {
        showToast(`API error: ${data.error}`, 'error');
      }
    } catch (err) {
      setApiTestResult({ success: false, error: err.message });
      setApiTestStatus('error');
      showToast('Could not reach OpenConnect server', 'error');
    }
  };

  const stepIcons = [Globe, Link2, Key, Layers, FileJson, CheckCircle];

  const inputClass = `w-full px-4 py-3.5 border rounded-xl placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm ${darkMode ? 'bg-slate-800/50 border-slate-700/40 text-slate-100 hover:border-slate-600/60 focus:bg-slate-800/70' : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300 focus:bg-white shadow-sm'}`;
  const monoInputClass = `${inputClass} font-mono text-[13px]`;
  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  const FormInput = ({ label, hint, icon: Icon, required, children }) => (
    <div className="space-y-2.5">
      <label className={`flex items-center gap-3 text-xs font-semibold tracking-wide ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
        {Icon && <Icon className="w-3.5 h-3.5 text-blue-400 opacity-80" />}
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className={`text-[11px] mt-2 leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>}
    </div>
  );

  // ============ STEP COMPONENTS ============
  const StepServiceConfig = () => (
    <div className="space-y-12">
      <FormInput label="Service Base URL" hint="Full base URL where all endpoint paths will be appended" icon={Globe} required>
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
      <FormInput label="Service Name" icon={Server} required>
        <input type="text" placeholder="My Payment Gateway" value={wsConfig.serviceName}
          onChange={(e) => setWsConfig({ ...wsConfig, serviceName: e.target.value })} className={inputClass} />
      </FormInput>
    </div>
  );

  const StepEndpointConfig = () => (
    <div className="space-y-12">
      {/* Request */}
      <div className={`rounded-2xl p-8 sm:p-10 border space-y-8 ${darkMode ? 'bg-slate-800/20 border-violet-500/10' : 'bg-slate-50/60 border-slate-200/50'}`}>
        <div className="flex items-center gap-3.5">
          <Link2 className="w-5 h-5 text-violet-400 opacity-80" />
          <span className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Request</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          <FormInput label="HTTP Method" icon={Zap}>
            <select value={wsEndpointConfig.method}
              onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, method: e.target.value })} className={selectClass}>
              {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </FormInput>
          <div className="sm:col-span-2">
            <FormInput label="Endpoint Path" icon={Link2} required>
              <input type="text" placeholder="/transactions/transfer" value={wsEndpointConfig.endpointTemplate}
                onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, endpointTemplate: e.target.value })} className={monoInputClass} />
            </FormInput>
          </div>
        </div>
        <FormInput label="Request Body Template (JSON)" hint="Use {PLACEHOLDER} for dynamic values" icon={Code}>
          <textarea placeholder='{"fromAccount":"{FROM_ACCOUNT}","toAccount":"{TO_ACCOUNT}","amount":"{AMOUNT}"}'
            value={wsEndpointConfig.dataTemplate}
            onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, dataTemplate: e.target.value })}
            rows="5" className={`${monoInputClass} resize-none leading-relaxed`} />
        </FormInput>
      </div>
      {/* Timeouts */}
      <div className={`rounded-2xl p-8 sm:p-10 border space-y-8 ${darkMode ? 'bg-slate-800/20 border-amber-500/10' : 'bg-slate-50/60 border-slate-200/50'}`}>
        <div className="flex items-center gap-3.5">
          <Clock className="w-5 h-5 text-amber-400 opacity-80" />
          <span className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Timeouts</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          <FormInput label="Connection Timeout (ms)" icon={Clock}>
            <input type="number" value={wsEndpointConfig.connectionTimeout}
              onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, connectionTimeout: parseInt(e.target.value) || 0 })} className={inputClass} />
          </FormInput>
          <FormInput label="Read Timeout (ms)" icon={Clock}>
            <input type="number" value={wsEndpointConfig.readTimeout}
              onChange={(e) => setWsEndpointConfig({ ...wsEndpointConfig, readTimeout: parseInt(e.target.value) || 0 })} className={inputClass} />
          </FormInput>
        </div>
      </div>
      {/* Response paths */}
      <div className={`rounded-2xl p-8 sm:p-10 border space-y-8 ${darkMode ? 'bg-slate-800/20 border-indigo-500/10' : 'bg-slate-50/60 border-slate-200/50'}`}>
        <div className="flex items-center gap-3.5">
          <Hash className="w-5 h-5 text-indigo-400 opacity-80" />
          <span className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Response Parsing</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
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
    </div>
  );

  const StepTokenConfig = () => (
    <div className="space-y-12">
      <div className={`flex items-start gap-4 p-6 rounded-2xl border ${darkMode ? 'bg-amber-500/6 border-amber-500/15' : 'bg-amber-50/70 border-amber-200/50'}`}>
        <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className={`text-sm font-semibold ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>OAuth2 Token Configuration</p>
          <p className={`text-[13px] mt-1.5 leading-relaxed ${darkMode ? 'text-amber-400/60' : 'text-amber-600/70'}`}>Leave empty to skip token authentication. Tokens are auto-refreshed by Open Connect.</p>
        </div>
      </div>
      <div className={`rounded-2xl p-8 sm:p-10 border space-y-8 ${darkMode ? 'bg-slate-800/20 border-slate-700/30' : 'bg-slate-50/60 border-slate-200/50'}`}>
        <div className="flex items-center gap-3.5">
          <Key className="w-5 h-5 text-amber-400 opacity-80" />
          <span className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Credentials</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
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
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-1 rounded-md hover:bg-slate-700/30">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormInput>
        </div>
        <FormInput label="Token Endpoint Path" icon={Link2}>
          <input type="text" placeholder="/auth/token" value={wsTokenConfig.tokenEndpoint}
            onChange={(e) => setWsTokenConfig({ ...wsTokenConfig, tokenEndpoint: e.target.value })} className={monoInputClass} />
        </FormInput>
      </div>
      <div className={`rounded-2xl p-8 sm:p-10 border space-y-8 ${darkMode ? 'bg-slate-800/20 border-slate-700/30' : 'bg-slate-50/60 border-slate-200/50'}`}>
        <div className="flex items-center gap-3.5">
          <Hash className="w-5 h-5 text-indigo-400 opacity-80" />
          <span className={`text-[11px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Response Paths</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          <FormInput label="Token JSON Path" icon={Hash}>
            <input type="text" placeholder="$.access_token" value={wsTokenConfig.tokenField}
              onChange={(e) => setWsTokenConfig({ ...wsTokenConfig, tokenField: e.target.value })} className={monoInputClass} />
          </FormInput>
          <FormInput label="Expiry JSON Path" icon={Hash}>
            <input type="text" placeholder="$.expires_in" value={wsTokenConfig.expiryField}
              onChange={(e) => setWsTokenConfig({ ...wsTokenConfig, expiryField: e.target.value })} className={monoInputClass} />
          </FormInput>
        </div>
      </div>
    </div>
  );

  const StepFieldMapping = () => (
    <div className="space-y-8">
      <div className={`flex items-start gap-4 p-6 rounded-2xl border ${darkMode ? 'bg-blue-500/5 border-blue-500/15' : 'bg-blue-50/70 border-blue-200/50'}`}>
        <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className={`text-[13px] leading-relaxed ${darkMode ? 'text-blue-300/90' : 'text-blue-700'}`}>
          Use dynamic values like <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${darkMode ? 'bg-blue-500/15 text-blue-200' : 'bg-blue-100 text-blue-700'}`}>{'{FROM_ACCOUNT}'}</code> to map fields. Static values like <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${darkMode ? 'bg-blue-500/15 text-blue-200' : 'bg-blue-100 text-blue-700'}`}>PKR</code> are sent as-is.
        </p>
      </div>
      <div className={`rounded-2xl border overflow-x-auto ${darkMode ? 'border-slate-700/30' : 'border-slate-200/50'}`}>
        <table className="w-full text-[13px] min-w-[700px]">
          <thead>
            <tr className={darkMode ? 'bg-slate-800/60' : 'bg-slate-50/80'}>
              <th className={`px-5 py-4.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Param Name</th>
              <th className={`px-5 py-4.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Value</th>
              <th className={`px-5 py-4.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Required</th>
              <th className={`px-5 py-4.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Max Len</th>
              <th className={`px-5 py-4.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Regex</th>
              <th className={`px-5 py-4.5 text-center text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Log</th>
              <th className="w-14"></th>
            </tr>
          </thead>
          <tbody className={`divide-y ${darkMode ? 'divide-slate-700/20' : 'divide-slate-200/50'}`}>
            {tranRequestMap.map((field, idx) => (
              <tr key={field.id} className={`transition-colors ${darkMode ? 'hover:bg-slate-700/15' : 'hover:bg-slate-50/70'}`}>
                <td className="px-5 py-4">
                  <input type="text" value={field.paramName}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].paramName = e.target.value; setTranRequestMap(u); }}
                    className={`w-full px-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${darkMode ? 'bg-slate-800/50 border border-slate-600/30 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`} />
                </td>
                <td className="px-5 py-4">
                  <input type="text" value={field.value}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].value = e.target.value; setTranRequestMap(u); }}
                    className={`w-full px-3 py-2.5 rounded-lg text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${darkMode ? 'bg-slate-800/50 border border-slate-600/30 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`}
                    placeholder="{FIELD_NAME}" />
                </td>
                <td className="px-5 py-4">
                  <select value={field.isMandatory}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].isMandatory = e.target.value; setTranRequestMap(u); }}
                    className={`w-full px-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${darkMode ? 'bg-slate-800/50 border border-slate-600/30 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`}>
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </select>
                </td>
                <td className="px-5 py-4">
                  <input type="number" value={field.maxLength}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].maxLength = e.target.value; setTranRequestMap(u); }}
                    className={`w-24 px-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${darkMode ? 'bg-slate-800/50 border border-slate-600/30 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`} />
                </td>
                <td className="px-5 py-4">
                  <input type="text" value={field.regex}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].regex = e.target.value; setTranRequestMap(u); }}
                    className={`w-full px-3 py-2.5 rounded-lg text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${darkMode ? 'bg-slate-800/50 border border-slate-600/30 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`} />
                </td>
                <td className="px-5 py-4 text-center">
                  <input type="checkbox" checked={field.logParameter === 1}
                    onChange={(e) => { const u = [...tranRequestMap]; u[idx].logParameter = e.target.checked ? 1 : 0; setTranRequestMap(u); }}
                    className="w-4.5 h-4.5 rounded border-slate-600 text-blue-500 focus:ring-blue-500/30 bg-slate-800 cursor-pointer" />
                </td>
                <td className="px-5 py-4 text-center">
                  <button onClick={() => setTranRequestMap(tranRequestMap.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
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
        className={`flex items-center gap-3.5 px-5 py-3.5 rounded-xl text-[13px] font-semibold transition ${darkMode ? 'bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-600/18' : 'bg-violet-50 text-violet-600 border border-violet-200/50 hover:bg-violet-100/80'}`}>
        <Plus className="w-4.5 h-4.5" /> Add Field
      </button>
    </div>
  );

  const StepResponseMapping = () => (
    <div className="space-y-8">
      <div className={`flex items-start gap-4 p-6 rounded-2xl border ${darkMode ? 'bg-blue-500/5 border-blue-500/15' : 'bg-blue-50/70 border-blue-200/50'}`}>
        <FileJson className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className={`text-[13px] leading-relaxed ${darkMode ? 'text-blue-300/90' : 'text-blue-700'}`}>
          Map API response codes to internal codes. The <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${darkMode ? 'bg-blue-500/15 text-blue-200' : 'bg-blue-100 text-blue-700'}`}>*</code> wildcard catches all unmapped responses.
        </p>
      </div>
      <div className={`rounded-2xl border overflow-x-auto ${darkMode ? 'border-slate-700/30' : 'border-slate-200/50'}`}>
        <table className="w-full text-[13px] min-w-[500px]">
          <thead>
            <tr className={darkMode ? 'bg-slate-800/60' : 'bg-slate-50/80'}>
              <th className={`px-6 py-4.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>API Code</th>
              <th className={`px-6 py-4.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your Code</th>
              <th className={`px-6 py-4.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Description</th>
              <th className="w-14"></th>
            </tr>
          </thead>
          <tbody className={`divide-y ${darkMode ? 'divide-slate-700/20' : 'divide-slate-200/50'}`}>
            {wsResponseDefinition.map((resp, idx) => (
              <tr key={idx} className={`transition-colors ${darkMode ? 'hover:bg-slate-700/15' : 'hover:bg-slate-50/70'}`}>
                <td className="px-6 py-4">
                  <input type="text" value={resp.matchCode}
                    onChange={(e) => { const u = [...wsResponseDefinition]; u[idx].matchCode = e.target.value; setWsResponseDefinition(u); }}
                    className={`w-full px-3 py-2.5 rounded-lg text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${darkMode ? 'bg-slate-800/50 border border-slate-600/30 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`}
                    placeholder="00 or *" />
                </td>
                <td className="px-6 py-4">
                  <input type="text" value={resp.ourCode}
                    onChange={(e) => { const u = [...wsResponseDefinition]; u[idx].ourCode = e.target.value; setWsResponseDefinition(u); }}
                    className={`w-full px-3 py-2.5 rounded-lg text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${darkMode ? 'bg-slate-800/50 border border-slate-600/30 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`}
                    placeholder="000" />
                </td>
                <td className="px-6 py-4">
                  <input type="text" value={resp.ourDescription}
                    onChange={(e) => { const u = [...wsResponseDefinition]; u[idx].ourDescription = e.target.value; setWsResponseDefinition(u); }}
                    className={`w-full px-3 py-2.5 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${darkMode ? 'bg-slate-800/50 border border-slate-600/30 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`} />
                </td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => setWsResponseDefinition(wsResponseDefinition.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setWsResponseDefinition([...wsResponseDefinition, { matchCode: '', ourCode: '', ourDescription: '' }])}
        className={`flex items-center gap-3.5 px-5 py-3.5 rounded-xl text-[13px] font-semibold transition ${darkMode ? 'bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-600/18' : 'bg-violet-50 text-violet-600 border border-violet-200/50 hover:bg-violet-100/80'}`}>
        <Plus className="w-4.5 h-4.5" /> Add Mapping
      </button>
    </div>
  );

  const StepReview = () => (
    <div className="space-y-8">

      {/* ── 1. Configuration Summary ─────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${darkMode ? 'bg-slate-800/30 border-slate-700/40 shadow-black/10' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
        <div className={`px-6 py-5 border-b flex items-center justify-between ${darkMode ? 'border-slate-700/30' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${darkMode ? 'bg-blue-500/15' : 'bg-blue-100'}`}>
              <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Configuration Summary</h3>
              <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{tranRequestMap.length} fields mapped · {wsResponseDefinition.length} response codes · {wsConfig.serviceName || 'Unnamed service'}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: Globe,    color: 'blue',    label: 'Service',  items: [['URL', wsConfig.baseUrl, true], ['Type', wsConfig.type], ['Name', wsConfig.serviceName]] },
              { icon: Link2,    color: 'emerald', label: 'Endpoint', items: [['Method', wsEndpointConfig.method, true], ['Path', wsEndpointConfig.endpointTemplate, true], ['Timeout', `${wsEndpointConfig.readTimeout}ms`]] },
              { icon: Activity, color: 'amber',   label: 'Stats',    items: [['Fields', `${tranRequestMap.length} mapped`], ['Codes', `${wsResponseDefinition.length} mapped`], ['Auth', wsTokenConfig.clientId ? 'OAuth2' : 'None']] },
            ].map(({ icon: Icon, color, label, items }) => (
              <div key={label} className={`rounded-xl p-5 border ${darkMode ? 'bg-slate-800/30 border-slate-700/30' : 'bg-slate-50 border-slate-200/70'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${color === 'blue' ? 'bg-blue-500/15' : color === 'emerald' ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                    <Icon className={`w-3.5 h-3.5 ${color === 'blue' ? 'text-blue-400' : color === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}`} />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
                </div>
                <dl className="space-y-3">
                  {items.map(([k, v, mono]) => (
                    <div key={k} className="flex items-start gap-3">
                      <dt className={`text-[11px] w-14 pt-0.5 flex-shrink-0 font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{k}</dt>
                      <dd className={`text-xs break-all leading-relaxed ${mono ? 'font-mono' : ''} ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{v || <span className="italic opacity-30">—</span>}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. SQL Preview ───────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${darkMode ? 'bg-slate-800/30 border-slate-700/40 shadow-black/10' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
        <button onClick={() => setShowSqlPreview(!showSqlPreview)}
          className={`w-full flex items-center justify-between px-6 py-5 text-sm font-semibold transition ${darkMode ? 'hover:bg-slate-700/20 text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}>
          <span className="flex items-center gap-3.5">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${darkMode ? 'bg-blue-500/15' : 'bg-blue-100'}`}>
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
            </div>
            SQL Preview
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${darkMode ? 'text-slate-500' : 'text-slate-400'} ${showSqlPreview ? 'rotate-180' : ''}`} />
        </button>
        {showSqlPreview && (
          <div className={`border-t ${darkMode ? 'border-slate-700/30 bg-slate-950/60' : 'border-slate-100 bg-slate-950'} p-5 font-mono text-xs text-emerald-400 overflow-x-auto max-h-72 overflow-y-auto`}>
            <pre className="whitespace-pre-wrap leading-relaxed">{generateSqlStatements()}</pre>
          </div>
        )}

        {/* Action buttons inside the SQL card */}
        <div className={`px-6 py-5 border-t flex flex-wrap gap-3 items-center ${darkMode ? 'border-slate-700/30' : 'border-slate-100'}`}>
          <button onClick={() => copyToClipboard(generateSqlStatements(), 'SQL')}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold transition border ${darkMode ? 'bg-blue-500/10 border-blue-500/25 text-blue-300 hover:bg-blue-500/20' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'}`}>
            <Copy className="w-3.5 h-3.5" /> Copy SQL
          </button>
          <button onClick={() => copyToClipboard(JSON.stringify(generateJsonConfig, null, 2), 'JSON')}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold transition border ${darkMode ? 'bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20' : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'}`}>
            <Copy className="w-3.5 h-3.5" /> Copy JSON
          </button>
          <button onClick={saveConfig} disabled={isSaving}
            className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold transition shadow-sm shadow-emerald-600/20 disabled:opacity-50 ml-auto">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving…' : 'Save to DB'}
          </button>
        </div>
      </div>

      {/* ── 3. Database Testing ──────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${darkMode ? 'bg-slate-800/30 border-slate-700/40 shadow-black/10' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
        <div className={`px-6 py-5 border-b flex items-center gap-3.5 ${darkMode ? 'border-slate-700/30' : 'border-slate-100'}`}>
          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${darkMode ? 'bg-indigo-500/15' : 'bg-indigo-100'}`}>
            <Database className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h3 className={`text-sm font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Database Testing</h3>
            {dbMode !== 'sqlite' && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">LIVE {(dbTypeLabels[dbMode] || dbMode).toUpperCase()}</span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Info banner */}
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${dbMode !== 'sqlite' ? (darkMode ? 'bg-blue-500/8 border-blue-500/20' : 'bg-blue-50 border-blue-200') : (darkMode ? 'bg-indigo-500/8 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200')}`}>
            <Database className={`w-4 h-4 flex-shrink-0 mt-0.5 ${dbMode !== 'sqlite' ? 'text-blue-400' : 'text-indigo-400'}`} />
            <div>
              {dbMode !== 'sqlite' ? (
                <>
                  <p className={`text-sm font-medium ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Connected to <strong>{dbInfo?.database || 'Database'}</strong> at <code className={`text-xs px-1.5 py-0.5 rounded font-mono ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>{dbInfo?.server || ''}</code></p>
                  <p className={`text-xs mt-0.5 ${darkMode ? 'text-blue-400/60' : 'text-blue-500'}`}>SQL will execute directly on your {dbTypeLabels[dbMode] || dbMode} database.</p>
                </>
              ) : (
                <>
                  <p className={`text-sm font-medium ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>Execute generated SQL against the local SQLite demo database.</p>
                  <p className={`text-xs mt-0.5 ${darkMode ? 'text-indigo-400/60' : 'text-indigo-500'}`}>Requires: <code className={`text-xs px-1.5 py-0.5 rounded font-mono ${darkMode ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>npm run server</code></p>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button onClick={executeInDemoDB} disabled={dbStatus === 'executing'}
              className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100">
              {dbStatus === 'executing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {dbStatus === 'executing' ? 'Executing…' : (dbMode !== 'sqlite' ? `Execute on ${dbTypeLabels[dbMode] || dbMode}` : 'Execute in Demo DB')}
            </button>
            <button onClick={verifyDemoDB}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold transition border ${darkMode ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20' : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'}`}>
              <Table className="w-3.5 h-3.5" /> Verify Data
            </button>
            <button onClick={resetDemoDB} disabled={dbMode !== 'sqlite'}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold transition border ${dbMode !== 'sqlite' ? (darkMode ? 'border-slate-700/30 text-slate-600 cursor-not-allowed' : 'border-slate-200 text-slate-400 cursor-not-allowed') : (darkMode ? 'bg-red-500/10 border-red-500/25 text-red-300 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100')}`}
              title={dbMode !== 'sqlite' ? 'Reset is disabled when connected to external database' : 'Reset demo database'}>
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>

          {/* Success result */}
          {dbStatus === 'success' && dbResults && (
            <div className={`rounded-xl border p-4 ${darkMode ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className={`text-sm font-semibold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>SQL executed successfully</span>
                <span className={`text-xs ml-auto ${darkMode ? 'text-emerald-500' : 'text-emerald-500'}`}>{dbResults.length} statement(s)</span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {dbResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span className={`font-mono truncate ${darkMode ? 'text-emerald-400/70' : 'text-emerald-600'}`}>{r.sql}…</span>
                    {r.lastInsertRowid && <span className="text-emerald-500 ml-auto flex-shrink-0 font-mono">ID: {r.lastInsertRowid}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error result */}
          {dbStatus === 'error' && dbResults && (
            <div className={`rounded-xl border p-4 ${darkMode ? 'bg-red-500/8 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-3 mb-1">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className={`text-sm font-semibold ${darkMode ? 'text-red-300' : 'text-red-700'}`}>Execution failed</span>
              </div>
              <p className={`text-xs font-mono mt-1 ${darkMode ? 'text-red-400/80' : 'text-red-600'}`}>{dbResults.error}</p>
            </div>
          )}

          {/* Verify table */}
          {showVerify && verifyData && !verifyData.error && (
            <div className={`rounded-xl border overflow-hidden ${darkMode ? 'border-slate-700/30' : 'border-slate-200'}`}>
              <div className={`px-5 py-3 border-b flex items-center gap-3 ${darkMode ? 'bg-indigo-500/8 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'}`}>
                <Database className="w-4 h-4 text-indigo-400" />
                <span className={`text-sm font-semibold ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>Database Contents</span>
              </div>
              <div className={`p-4 space-y-4 max-h-96 overflow-y-auto ${darkMode ? 'bg-slate-900/40' : 'bg-slate-50/50'}`}>
                {Object.entries(verifyData.data).map(([table, rows]) => (
                  <div key={table}>
                    <div className="flex items-center justify-between mb-2">
                      <h6 className={`text-sm font-semibold font-mono ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{table}</h6>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rows.length > 0 ? (darkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-600') : (darkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-500')}`}>
                        {rows.length} row{rows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {rows.length > 0 ? (
                      <div className={`overflow-x-auto rounded-lg border ${darkMode ? 'border-slate-700/30' : 'border-slate-200'}`}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className={darkMode ? 'bg-slate-800/60' : 'bg-slate-100'}>
                              {Object.keys(rows[0]).map(col => (
                                <th key={col} className={`px-3 py-2 text-left font-semibold ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${darkMode ? 'divide-slate-700/20' : 'divide-slate-100'}`}>
                            {rows.map((row, ri) => (
                              <tr key={ri} className={darkMode ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50'}>
                                {Object.values(row).map((val, ci) => (
                                  <td key={ci} className={`px-3 py-2 font-mono max-w-48 truncate ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} title={String(val)}>
                                    {val === null ? <span className={`italic ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>NULL</span> : String(val).substring(0, 60)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className={`text-xs italic ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>No rows</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showVerify && verifyData?.error && (
            <div className={`rounded-xl border p-4 ${darkMode ? 'bg-red-500/8 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{verifyData.error}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Target Environment ────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${darkMode ? 'bg-slate-800/30 border-slate-700/40 shadow-black/10' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
        <div className="p-6">
          <OCCoreEnvironmentSelector
            darkMode={darkMode}
            currentEnv={targetEnv}
            onEnvChange={setTargetEnv}
            showToast={showToast}
          />
        </div>
      </div>

      {/* ── 5. API Validation Dashboard ──────────────────── */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${darkMode ? 'bg-slate-800/30 border-slate-700/40 shadow-black/10' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
        <button onClick={() => { setShowApiTest(!showApiTest); if (!showApiTest) fetchApiLayerConfigs(); }}
          className={`w-full flex items-center justify-between px-6 py-5 text-sm font-semibold transition ${darkMode ? 'hover:bg-slate-700/20 text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}>
          <span className="flex items-center gap-3.5">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${darkMode ? 'bg-amber-500/15' : 'bg-amber-100'}`}>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            API Validation Dashboard
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/15 to-indigo-500/15 text-blue-400 border border-blue-500/20">ENTERPRISE</span>
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${darkMode ? 'text-slate-500' : 'text-slate-400'} ${showApiTest ? 'rotate-180' : ''}`} />
        </button>

        {showApiTest && (
          <div className={`border-t p-6 ${darkMode ? 'border-slate-700/30' : 'border-slate-100'}`}>
            <APIValidationDashboard
              apiLayerConfigs={apiLayerConfigs}
              selectedApiConfigId={selectedApiConfigId}
              setSelectedApiConfigId={setSelectedApiConfigId}
              apiTestParams={apiTestParams}
              setApiTestParams={setApiTestParams}
              fetchApiLayerConfigs={fetchApiLayerConfigs}
              wsConfig={wsConfig}
              wsEndpointConfig={wsEndpointConfig}
              showToast={showToast}
              darkMode={darkMode}
              targetEnvironment={targetEnv}
            />
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
    <div id="oc-root" className={`min-h-screen flex flex-col ${darkMode ? 'oc-dark' : 'oc-light'}`}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ─── NAVBAR (always at top) ─────────────── */}
      <header className="glass border-b border-slate-700/50 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-10 h-[60px] sm:h-[68px] flex items-center justify-between gap-4 sm:gap-6">

          {/* ── Brand + Client Badge ── */}
          <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-shrink-0">
            <div className="flex items-center gap-3.5 sm:gap-3.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-violet-500/20 shadow-lg shadow-violet-900/30">
                <img src="/src/img/favicon.png" alt="OpenConnect Logo" className="w-full h-full object-cover" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[14px] font-bold tracking-tight leading-tight oc-gradient-text">OpenConnect</p>
                <p className={`text-[10.5px] leading-none mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Configuration Automation</p>
              </div>
            </div>
            {/* Client badge */}
            <span className={`hidden md:inline-flex px-3.5 py-1.5 rounded-lg text-[11px] font-semibold ${darkMode ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-200/60 text-emerald-700'}`}>
              Client: <span className="font-bold ml-1">{wsConfig.serviceName ? wsConfig.serviceName.split(/[-_ ]/)[0] : 'Default'}</span>
            </span>
          </div>

          {/* ── Right Actions ── */}
          <div className="flex items-center gap-3 sm:gap-3.5 flex-shrink-0">

            {/* Backend Status */}
            <div className="oc-nav-status">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                backendStatus === 'connected' ? 'bg-emerald-400 pulse-dot'
                : backendStatus === 'checking' ? 'bg-amber-400 pulse-dot'
                : 'bg-red-400'
              }`} />
              <span className="hidden sm:inline">
                {backendStatus === 'connected' ? 'Backend Online' : backendStatus === 'checking' ? 'Connecting' : 'Backend Offline'}
              </span>
            </div>

            <div className="oc-nav-divider hidden sm:block" />

            {/* DB Connect / Disconnect */}
            {dbMode !== 'sqlite' ? (
              <button onClick={disconnectDatabase} className="oc-nav-btn oc-nav-btn-danger">
                <Unplug className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Disconnect</span>
              </button>
            ) : (
              <button onClick={() => { setShowDbConnect(true); fetchSavedConnections(); }} className="oc-nav-btn">
                <PlugZap className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Connect DB</span>
              </button>
            )}

            {/* Saved configs */}
            <button onClick={() => { setShowSavedConfigs(true); fetchSavedConfigs(); }} className="oc-nav-btn">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Saved</span>
              {savedConfigs.length > 0 && (
                <span className="oc-count-badge">{savedConfigs.length}</span>
              )}
            </button>

            {/* Quick Import CTA */}
            <button
              onClick={() => { setAppView('import'); setQuickImportTab('url'); setQuickImportErrors({}); }}
              className={`oc-nav-cta${appView === 'import' ? ' active' : ''}`}>
              <Zap className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Quick Import</span>
            </button>

            {/* Transactions Log */}
            <button
              onClick={() => setAppView('logs')}
              className={`oc-nav-btn hidden md:inline-flex${appView === 'logs' ? ' !border-blue-500/40 !text-blue-300' : ''}`}>
              <Activity className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Logs</span>
            </button>

            {/* Production Readiness */}
            <button
              onClick={() => setAppView('readiness')}
              className={`oc-nav-btn hidden md:inline-flex${appView === 'readiness' ? ' !border-emerald-500/40 !text-emerald-300' : ''}`}>
              <ShieldCheck className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Readiness</span>
            </button>

            <div className="oc-nav-divider hidden sm:block" />

            {/* Theme toggle */}
            <button onClick={toggleTheme} className="oc-nav-icon-btn" title={darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}>
              {darkMode
                ? <Sun className="w-4 h-4 text-amber-400" />
                : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>

            {/* Avatar */}
            <button className="oc-nav-avatar">
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-white/15">
                <img src="/src/img/pfp.jpg" alt="Uneeb" className="w-full h-full object-cover" />
              </div>
              <div className="text-left leading-none hidden sm:block">
                <span className={`text-[9px] block ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>By</span>
                <span className={`text-[12px] font-semibold block ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Uneeb</span>
              </div>
            </button>
          </div>

        </div>
      </header>

      <main className="flex-1 flex flex-col">
      {/* ═══════════════════════════════════════════ */}
      {/* QUICK IMPORT — Full-screen page             */}
      {/* ═══════════════════════════════════════════ */}
      {appView === 'import' && (
        <div className="flex-1 oc-view-enter flex flex-col">
          <div className="max-w-[1440px] mx-auto px-5 sm:px-10 lg:px-14 py-10 sm:py-12 flex-1 flex flex-col w-full">

            {/* ── Hero + Mode Toggle Row ──────────────────────── */}
            <div className="mb-10 sm:mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
              <div className="flex items-center gap-5">
                <div className="w-13 h-13 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/20"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #22d3ee)' }}>
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>Quick Import</h1>
                    <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${darkMode ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'}`}>Beta</span>
                  </div>
                  <p className={`text-sm max-w-xl leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Paste the service URL, a sample request and a sample response — we'll auto-generate the full 6-step configuration.
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-1 p-1.5 rounded-xl w-fit flex-shrink-0 ${darkMode ? 'bg-slate-800/30 border border-slate-700/25' : 'bg-slate-100/80 border border-slate-200/50'}`}>
                <button onClick={() => setQuickImportMode('guided')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    quickImportMode === 'guided'
                      ? (darkMode ? 'bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 shadow-sm' : 'bg-white border border-emerald-300/50 text-emerald-700 shadow-sm')
                      : (darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/25' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60')
                  }`}>
                  <Globe className="w-3.5 h-3.5" /> Guided Import
                </button>
                <button onClick={() => setQuickImportMode('curl')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    quickImportMode === 'curl'
                      ? (darkMode ? 'bg-violet-500/12 border border-violet-500/25 text-violet-300 shadow-sm' : 'bg-white border border-violet-300/50 text-violet-700 shadow-sm')
                      : (darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/25' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60')
                  }`}>
                  <Terminal className="w-3.5 h-3.5" /> Paste cURL
                </button>
              </div>
            </div>

            {/* ── cURL Import Mode ────────────────────────────── */}
            {quickImportMode === 'curl' && (
              <PasteCurlImport
                darkMode={darkMode}
                onConfigGenerated={(finalConfig) => {
                  if (finalConfig) {
                    try {
                      const cfg = typeof finalConfig === 'string' ? JSON.parse(finalConfig) : finalConfig;
                      if (cfg.ws_config) { Object.assign(wsConfig, cfg); }
                      else { Object.assign(wsConfig, cfg); }
                    } catch {}
                  }
                  setAppView('review');
                }}
              />
            )}

            {/* ── Guided Import Mode ──────────────────────────── */}
            {quickImportMode === 'guided' && (
            <div className="flex-1 flex flex-col">

            {/* ── Stepper Bar ─────────────────────────────────── */}
            <div className={`flex items-center rounded-xl p-2 mb-10 gap-1.5 overflow-x-auto ${darkMode ? 'bg-slate-800/20 border border-slate-700/25' : 'bg-slate-100/70 border border-slate-200/50'}`}>
              {[
                { id: 'url', label: 'Service URL', icon: Globe },
                { id: 'request', label: 'Request Body', icon: FileJson },
                { id: 'response', label: 'Response Body', icon: FileJson },
              ].map((t, idx, arr) => {
                const Icon = t.icon;
                const isActive = quickImportTab === t.id;
                const isDone = arr.findIndex(x => x.id === quickImportTab) > idx;
                const hasError = (t.id === 'url' && (quickImportErrors.url || quickImportErrors.serviceName))
                  || (t.id === 'request' && quickImportErrors.request)
                  || (t.id === 'response' && quickImportErrors.response);
                return (
                  <React.Fragment key={t.id}>
                    <button onClick={() => setQuickImportTab(t.id)}
                      className={`flex-1 flex items-center justify-center gap-3.5 px-5 py-3.5 rounded-lg transition-all whitespace-nowrap ${
                        isActive ? (darkMode ? 'bg-emerald-500/12 text-emerald-300 shadow-sm border border-emerald-500/25' : 'bg-white text-emerald-700 shadow-sm border border-emerald-300/40')
                          : isDone ? (darkMode ? 'text-emerald-400/80 hover:bg-slate-700/25' : 'text-emerald-600/80 hover:bg-white/60')
                          : (darkMode ? 'text-slate-400 hover:bg-slate-700/25' : 'text-slate-500 hover:bg-white/60')
                      }`}>
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isActive ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-md shadow-emerald-500/20'
                          : isDone ? (darkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-600')
                          : (darkMode ? 'bg-slate-700/50 text-slate-500' : 'bg-slate-200/80 text-slate-400')
                      }`}>
                        {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </span>
                      <span className="text-sm font-semibold hidden sm:inline">{t.label}</span>
                      {hasError && <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />}
                    </button>
                    {idx < arr.length - 1 && (
                      <div className={`w-8 lg:w-16 h-px flex-shrink-0 ${isDone ? 'bg-emerald-500/40' : 'bg-slate-700/40'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── Main Content ─────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-10 flex-1">

              {/* ─── Form Card (dominant) ──────────────────────── */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className={`glass-card rounded-2xl overflow-hidden flex flex-col flex-1 ${darkMode ? 'shadow-md shadow-black/15' : 'shadow-sm shadow-slate-200/40'}`}>
                  {/* Card header */}
                  <div className={`px-7 sm:px-9 py-6 border-b ${darkMode ? 'border-slate-700/20 bg-gradient-to-r from-emerald-600/4 to-transparent' : 'border-slate-100 bg-gradient-to-r from-emerald-50/40 to-transparent'}`}>
                    <h2 className={`text-lg font-bold flex items-center gap-3.5 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                      {quickImportTab === 'url' && <><Globe className="w-5 h-5 text-emerald-400" /> Service URL &amp; Identity</>}
                      {quickImportTab === 'request' && <><FileJson className="w-5 h-5 text-emerald-400" /> Sample Request Body</>}
                      {quickImportTab === 'response' && <><FileJson className="w-5 h-5 text-emerald-400" /> Sample Response Body</>}
                    </h2>
                    <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {quickImportTab === 'url' && 'Where does the service live, and what do you want to call it?'}
                      {quickImportTab === 'request' && 'Paste a real request payload. We\'ll convert it to a template with {{placeholders}}.'}
                      {quickImportTab === 'response' && 'Paste a real response. We\'ll detect the response-code path and extract all fields.'}
                    </p>
                  </div>

                  {/* Card body */}
                  <div className="p-8 sm:p-10 flex-1 flex flex-col">
                    {/* TAB 1: URL */}
                    {quickImportTab === 'url' && (
                      <div className="space-y-8">
                        <div>
                          <label className={`block text-xs font-semibold mb-2.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Service Name <span className="text-red-500">*</span></label>
                          <input type="text" value={quickImport.serviceName}
                            onChange={(e) => setQuickImport({ ...quickImport, serviceName: e.target.value })}
                            placeholder="e.g. Balance-Inquiry-Service"
                            className={`w-full rounded-xl px-4 py-3 text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${darkMode ? 'bg-slate-800/50 border-slate-700/40 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} />
                          {quickImportErrors.serviceName && <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{quickImportErrors.serviceName}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                          <div>
                            <label className={`block text-xs font-semibold mb-2.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Method</label>
                            <select value={quickImport.method}
                              onChange={(e) => setQuickImport({ ...quickImport, method: e.target.value })}
                              className={`w-full rounded-xl px-3 py-3 text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 cursor-pointer ${darkMode ? 'bg-slate-800/50 border-slate-700/40 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                              {['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                          <div className="sm:col-span-1 lg:col-span-3">
                            <label className={`block text-xs font-semibold mb-2.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Service Type</label>
                            <input type="text" value={quickImport.serviceType}
                              onChange={(e) => setQuickImport({ ...quickImport, serviceType: e.target.value })}
                              placeholder="REST, payment-gateway, cas-api, etc."
                              className={`w-full rounded-xl px-4 py-3 text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${darkMode ? 'bg-slate-800/50 border-slate-700/40 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} />
                          </div>
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold mb-2.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Full API URL <span className="text-red-500">*</span></label>
                          <input type="text" value={quickImport.url}
                            onChange={(e) => setQuickImport({ ...quickImport, url: e.target.value })}
                            placeholder="http://localhost:3010/api/v1/account/balance-inquiry"
                            className={`w-full rounded-xl px-4 py-3 text-sm border font-mono transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${darkMode ? 'bg-slate-800/50 border-slate-700/40 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} />
                          <p className={`text-xs mt-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>We'll split this into base URL + endpoint path automatically</p>
                          {quickImportErrors.url && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{quickImportErrors.url}</p>}
                        </div>
                      </div>
                    )}

                    {/* TAB 2: REQUEST BODY */}
                    {quickImportTab === 'request' && (
                      <div className="flex-1 flex flex-col">
                        <label className={`block text-xs font-semibold mb-2.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Sample Request Body (JSON) <span className="text-red-500">*</span></label>
                        <textarea value={quickImport.requestBody}
                          onChange={(e) => { setQuickImport({ ...quickImport, requestBody: e.target.value }); setQuickImportErrors(prev => ({ ...prev, request: undefined })); }}
                          rows={18}
                          placeholder={`{\n  "channelId": "MOBILE_APP",\n  "requestId": "TF001",\n  "bankCode": "01",\n  "accountNumber": "1234567890",\n  "rrn": "123456789015",\n  "stan": "123459"\n}`}
                          className={`w-full flex-1 rounded-xl px-4 py-3.5 text-sm font-mono resize-y transition border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${darkMode ? 'bg-slate-950/50 border-slate-700/40 text-emerald-300 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-emerald-700 placeholder-slate-400'}`} />
                        {quickImportErrors.request && <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{quickImportErrors.request}</p>}
                      </div>
                    )}

                    {/* TAB 3: RESPONSE BODY */}
                    {quickImportTab === 'response' && (
                      <div className="flex-1 flex flex-col">
                        <label className={`block text-xs font-semibold mb-2.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Sample Response Body (JSON) <span className="text-red-500">*</span></label>
                        <textarea value={quickImport.responseBody}
                          onChange={(e) => { setQuickImport({ ...quickImport, responseBody: e.target.value }); setQuickImportErrors(prev => ({ ...prev, response: undefined })); }}
                          rows={18}
                          placeholder={`{\n  "responseCode": "000",\n  "responseMessage": "Success",\n  "data": {\n    "accountTitle": "MUHAMMAD AHMED KHAN",\n    "availableBalance": "150,250.75",\n    "currency": "PKR",\n    "accountStatus": "ACTIVE"\n  }\n}`}
                          className={`w-full flex-1 rounded-xl px-4 py-3.5 text-sm font-mono resize-y transition border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${darkMode ? 'bg-slate-950/50 border-slate-700/40 text-emerald-300 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-emerald-700 placeholder-slate-400'}`} />
                        {quickImportErrors.response && <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{quickImportErrors.response}</p>}
                      </div>
                    )}
                  </div>

                  {/* Footer nav */}
                  <div className={`px-7 sm:px-9 py-5 border-t flex items-center justify-between ${darkMode ? 'border-slate-700/20 bg-slate-900/20' : 'border-slate-100 bg-slate-50/40'}`}>
                    <button onClick={() => {
                      if (quickImportTab === 'request') setQuickImportTab('url');
                      else if (quickImportTab === 'response') setQuickImportTab('request');
                    }}
                      disabled={quickImportTab === 'url'}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 rounded-lg ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                      <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Previous</span>
                    </button>
                    {quickImportTab !== 'response' ? (
                      <button onClick={() => setQuickImportTab(quickImportTab === 'url' ? 'request' : 'response')}
                        className={`flex items-center gap-3 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${darkMode ? 'bg-slate-700/90 hover:bg-slate-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
                        Next <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={generateFromImport}
                        className="flex items-center gap-3 px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-sm text-white font-semibold transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]">
                        <Zap className="w-4 h-4" />
                        <span className="hidden sm:inline">Generate &amp; Continue to Review</span>
                        <span className="sm:hidden">Generate</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── Sidebar (compact, sticky) ─────────────────── */}
              <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-8 lg:sticky lg:top-24 lg:self-start">

                {/* What happens next */}
                <div className={`rounded-2xl border p-6 ${darkMode ? 'border-slate-700/25 bg-slate-800/15' : 'border-slate-200/50 bg-slate-50/60'}`}>
                  <h3 className={`text-[11px] font-bold uppercase tracking-widest mb-5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>What happens next</h3>
                  <ol className="space-y-4">
                    {[
                      { num: 1, title: 'Parse & generate', desc: 'URL split, placeholders inserted, fields extracted.' },
                      { num: 2, title: 'Populate wizard', desc: 'All 6 steps filled automatically.' },
                      { num: 3, title: 'Review & Deploy', desc: 'SQL preview, DB execution, live API test.' },
                    ].map(s => (
                      <li key={s.num} className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{s.num}</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200 leading-tight">{s.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Auto-generated */}
                <div className={`rounded-2xl border p-6 ${darkMode ? 'border-slate-700/25 bg-slate-800/15' : 'border-slate-200/50 bg-slate-50/60'}`}>
                  <h3 className={`text-[11px] font-bold uppercase tracking-widest mb-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Auto-generated</h3>
                  <ul className="space-y-2.5 text-xs text-slate-400">
                    <li className="flex items-center gap-3"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />Base URL + endpoint path</li>
                    <li className="flex items-center gap-3"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />Data template with <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-1">{'{{placeholder}}'}</code></li>
                    <li className="flex items-center gap-3"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />Field mappings per primitive key</li>
                    <li className="flex items-center gap-3"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />Response code path auto-detected</li>
                    <li className="flex items-center gap-3"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />Response include paths (all leaves)</li>
                    <li className="flex items-center gap-3"><Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />Unique timestamp-based tran IDs</li>
                  </ul>
                </div>

                {/* Nothing is locked */}
                <div className={`rounded-2xl border p-5 ${darkMode ? 'border-amber-500/12 bg-amber-500/4' : 'border-amber-200/50 bg-amber-50/60'}`}>
                  <div className="flex items-start gap-3.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-400 mb-0.5">Nothing is locked</p>
                      <p className="text-[11px] text-amber-400/60 leading-relaxed">You can edit every step after generation. Quick Import is a head-start, not a cage.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
            )}
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════ */}
      {appView === 'review' && (
        <div className="flex-1 max-w-[1440px] w-full mx-auto px-5 sm:px-10 lg:px-14 py-10 sm:py-12 oc-view-enter">

          {/* ── Page Header ─────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5.5 h-5.5 text-emerald-400" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>Review &amp; Deploy</h1>
                <p className={`text-sm mt-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Inspect the generated SQL, run it against your database, then validate via the API layer.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={() => { setAppView('wizard'); setCurrentStep(0); }}
                className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-sm font-medium transition border ${darkMode ? 'bg-slate-800/50 border-slate-700/40 text-slate-300 hover:bg-slate-700/50' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <Settings className="w-3.5 h-3.5" /> Edit in wizard
              </button>
              <button onClick={() => { setAppView('import'); setQuickImportTab('url'); }}
                className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-sm text-emerald-300 transition font-medium ${darkMode ? 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/18' : 'bg-emerald-50 border border-emerald-200/50 text-emerald-700 hover:bg-emerald-100/80'}`}>
                <Zap className="w-3.5 h-3.5" /> New Import
              </button>
            </div>
          </div>

          {/* ── Progress Steps ──────────────────────────────── */}
          <div className={`flex items-center gap-3.5 overflow-x-auto p-3.5 rounded-xl border mb-10 ${darkMode ? 'bg-slate-800/15 border-slate-700/25' : 'bg-slate-50/80 border-slate-200/50'}`}>
            {[
              { label: '1. Configuration generated', done: true,                          icon: Check    },
              { label: '2. Review & execute SQL',     done: dbStatus === 'success',        icon: Database },
              { label: '3. Validate via API',         done: !!apiTestResult?.success,      icon: Zap      },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <div className={`flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  step.done
                    ? 'bg-emerald-500/12 border border-emerald-500/20 text-emerald-300'
                    : (darkMode ? 'text-slate-500' : 'text-slate-400')
                }`}>
                  <step.icon className="w-3 h-3" /> {step.label}
                </div>
                {i < arr.length - 1 && <div className={`h-px flex-1 min-w-[16px] ${step.done ? 'bg-emerald-500/25' : (darkMode ? 'bg-slate-700/40' : 'bg-slate-300/40')}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* ── Main content ────────────────────────────────── */}
          <div className="space-y-8">
            <StepReview />
          </div>

        </div>
      )}


      {/* Saved Configs Modal */}
      {showSavedConfigs && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`rounded-2xl w-full max-w-lg mx-3 sm:mx-0 shadow-2xl oc-modal-enter ${darkMode ? 'bg-slate-900 border border-slate-700/50' : 'bg-white border border-slate-200/80'}`}>
            <div className={`flex items-center justify-between px-7 py-5 border-b ${darkMode ? 'border-slate-700/30' : 'border-slate-100'}`}>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Saved Configurations</h3>
              <button onClick={() => setShowSavedConfigs(false)} className={`p-1.5 rounded-lg transition ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} /></button>
            </div>
            <div className="p-7 max-h-96 overflow-y-auto">
              {savedConfigs.length === 0 ? (
                <p className={`text-sm text-center py-8 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No saved configurations yet</p>
              ) : (
                <div className="space-y-3.5">
                  {savedConfigs.map((cfg) => (
                    <div key={cfg.id} className={`flex items-center justify-between p-5 rounded-xl border transition ${darkMode ? 'bg-slate-800/40 border-slate-700/40 hover:border-blue-500/30' : 'bg-slate-50/80 border-slate-200/50 hover:border-blue-300/50'}`}>
                      <div>
                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{cfg.name}</p>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{cfg.client} &middot; {new Date(cfg.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-3.5">
                        <button onClick={() => loadConfig(cfg.id)}
                          className="px-3.5 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition font-medium">Load</button>
                        <button onClick={() => deleteConfig(cfg.id)}
                          className="px-3.5 py-2 text-xs bg-red-600/50 text-red-300 rounded-lg hover:bg-red-600 hover:text-white transition font-medium">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Database Connection Modal */}
      {showDbConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className={`w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden oc-modal-enter ${darkMode ? 'bg-slate-900 border border-slate-700/60' : 'bg-white border border-slate-200'}`}>

            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-slate-700/50 bg-gradient-to-r from-blue-600/8 to-purple-600/8' : 'border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-blue-500/15 border border-blue-500/20' : 'bg-blue-100'}`}>
                  <Database className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Database Connection</h3>
                  <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Connect to SQL Server, PostgreSQL, or MySQL</p>
                </div>
              </div>
              <button onClick={() => setShowDbConnect(false)} className={`p-1.5 rounded-lg transition ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-72px)] space-y-5">

              {/* Saved Connections */}
              {savedConnections.length > 0 && (
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Saved Connections</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedConnections.map((conn) => (
                      <div key={conn.id} className={`group flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${darkMode ? 'bg-slate-800/40 border-slate-700/40 hover:border-blue-500/40' : 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'}`}
                        onClick={() => loadSavedConnection(conn.id)}>
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            conn.type === 'mssql' ? 'bg-blue-500/15' : conn.type === 'postgres' ? 'bg-cyan-500/15' : 'bg-orange-500/15'
                          }`}>
                            <Database className={`w-3.5 h-3.5 ${conn.type === 'mssql' ? 'text-blue-400' : conn.type === 'postgres' ? 'text-cyan-400' : 'text-orange-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{conn.name}</p>
                            <p className={`text-[10px] truncate font-mono ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{conn.host}:{conn.port}/{conn.database_name}</p>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteSavedConnection(conn.id); }}
                          className="p-1 text-transparent group-hover:text-red-400 transition flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-4 h-px ${darkMode ? 'bg-slate-700/50' : 'bg-slate-200'}`} />
                </div>
              )}

              {/* Form section label */}
              <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>New Connection</p>

              {/* Connection Name */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Connection Name</label>
                <input type="text" placeholder="e.g. Raast_Openconnect_uneeb" value={dbConnForm.name}
                  onChange={(e) => setDbConnForm({ ...dbConnForm, name: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${darkMode ? 'bg-slate-800/60 border-slate-700/50 text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} />
                <p className={`mt-1 text-[11px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Used to identify this connection when saving</p>
              </div>

              {/* Database Type */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Database Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'mssql',    label: 'SQL Server',  activeClass: 'bg-blue-500/10 border-blue-500/40 text-blue-300',   dotClass: 'bg-blue-500',  desc: 'Microsoft SQL Server' },
                    { value: 'postgres', label: 'PostgreSQL',  activeClass: 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300',   dotClass: 'bg-cyan-500',  desc: 'Open source RDBMS' },
                    { value: 'mysql',    label: 'MySQL',       activeClass: 'bg-orange-500/10 border-orange-500/40 text-orange-300', dotClass: 'bg-orange-500', desc: 'MySQL / MariaDB' },
                  ].map((opt) => {
                    const isActive = dbConnForm.type === opt.value;
                    return (
                      <button key={opt.value} onClick={() => setDbConnForm({ ...dbConnForm, type: opt.value, port: '' })}
                        className={`relative p-3 rounded-xl border text-left transition-all ${
                          isActive
                            ? (darkMode ? opt.activeClass : 'bg-blue-50 border-blue-400 text-blue-700')
                            : (darkMode ? 'bg-slate-800/30 border-slate-700/40 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300')
                        }`}>
                        {isActive && <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${opt.dotClass}`} />}
                        <p className={`text-sm font-semibold ${isActive ? '' : (darkMode ? 'text-slate-300' : 'text-slate-700')}`}>{opt.label}</p>
                        <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Host + Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Host</label>
                  <input type="text" placeholder="10.5.70.5 or localhost" value={dbConnForm.host}
                    onChange={(e) => setDbConnForm({ ...dbConnForm, host: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono ${darkMode ? 'bg-slate-800/60 border-slate-700/50 text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Port</label>
                  <input type="number" placeholder={String(defaultPorts[dbConnForm.type])} value={dbConnForm.port}
                    onChange={(e) => setDbConnForm({ ...dbConnForm, port: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono ${darkMode ? 'bg-slate-800/60 border-slate-700/50 text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} />
                </div>
              </div>

              {/* Database Name */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Database Name</label>
                <input type="text" placeholder="e.g. Raast_Openconnect_uneeb" value={dbConnForm.database}
                  onChange={(e) => setDbConnForm({ ...dbConnForm, database: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono ${darkMode ? 'bg-slate-800/60 border-slate-700/50 text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} />
              </div>

              {/* Username + Password */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Username</label>
                  <input type="text" placeholder="appuser_demo" value={dbConnForm.user}
                    onChange={(e) => setDbConnForm({ ...dbConnForm, user: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${darkMode ? 'bg-slate-800/60 border-slate-700/50 text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Password</label>
                  <div className="relative">
                    <input type={showDbPassword ? 'text' : 'password'} placeholder="••••••••"
                      value={dbConnForm.password}
                      onChange={(e) => setDbConnForm({ ...dbConnForm, password: e.target.value })}
                      className={`w-full px-3.5 py-2.5 pr-9 rounded-xl text-sm border transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${darkMode ? 'bg-slate-800/60 border-slate-700/50 text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`} />
                    <button type="button" onClick={() => setShowDbPassword(!showDbPassword)}
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                      {showDbPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Safety Notice */}
              <div className={`flex items-start gap-3.5 p-3 rounded-xl border ${darkMode ? 'bg-amber-500/8 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                <Shield className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-amber-400/80' : 'text-amber-700'}`}>
                  <strong>Safety:</strong> Only SELECT and INSERT are allowed on external databases. DELETE, UPDATE, DROP, and RESET are permanently blocked.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pb-1">
                <button onClick={connectToDatabase} disabled={dbConnecting || !dbConnForm.host || !dbConnForm.database || !dbConnForm.user}
                  className="flex-1 flex items-center justify-center gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl transition font-semibold text-sm shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                  {dbConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
                  {dbConnecting ? 'Connecting…' : 'Connect'}
                </button>
                <button onClick={saveConnection} disabled={!dbConnForm.name || !dbConnForm.host}
                  className={`flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl transition font-semibold text-sm border disabled:opacity-30 disabled:cursor-not-allowed ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}`}>
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT (wizard only) */}
      {appView === 'wizard' && (
      <div className="flex-1 flex flex-col max-w-[1440px] w-full mx-auto px-6 sm:px-12 py-10 sm:py-14 oc-view-enter">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12">
          {/* SIDEBAR */}
          <div className="lg:col-span-3">
            <div className={`glass-card rounded-2xl overflow-hidden lg:sticky lg:top-24 shadow-md ${darkMode ? 'shadow-violet-950/40' : 'shadow-slate-200/50'}`}>
              {/* Sidebar header */}
              <div className={`px-7 py-6 border-b ${darkMode ? 'border-violet-500/10 bg-gradient-to-br from-violet-600/8 to-transparent' : 'border-slate-100 bg-slate-50/40'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${darkMode ? 'text-violet-400/60' : 'text-slate-400'}`}>Configuration Steps</p>
              </div>
              <div className="p-5 space-y-2">
                {steps.map((step, idx) => {
                  const Icon = stepIcons[idx];
                  const isActive = idx === currentStep;
                  const isCompleted = validateStep(idx) && idx < currentStep;
                  return (
            <button key={idx} onClick={() => setCurrentStep(idx)}
                      className={`w-full text-left px-4 py-5 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
                        ? darkMode ? 'bg-violet-600/10 border border-violet-500/25 shadow-sm shadow-violet-900/20' : 'bg-violet-50/80 border border-violet-300/50'
                        : 'border border-transparent hover:bg-white/4'}` }>
                      {/* Active indicator bar */}
                      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full" style={{background: 'linear-gradient(180deg, #a78bfa, #22d3ee)'}} />}
                      <div className="flex items-center gap-3.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                          isActive ? 'shadow-lg shadow-violet-600/30'
                          : isCompleted ? 'shadow-sm shadow-emerald-500/15'
                          : darkMode ? 'bg-slate-700/50 group-hover:bg-slate-600/50' : 'bg-slate-200/70 group-hover:bg-slate-200'}`}
                          style={isActive ? {background: 'linear-gradient(135deg, #8b5cf6, #6366f1)'}
                            : isCompleted ? {background: 'linear-gradient(135deg, #10b981, #0d9488)'}
                            : {}}>
                          {isCompleted ? <Check className="w-4 h-4 text-white" /> : <Icon className="w-4 h-4 text-white/80" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[13px] font-semibold leading-snug truncate ${
                            isActive ? (darkMode ? 'text-violet-300' : 'text-violet-700')
                            : isCompleted ? (darkMode ? 'text-emerald-400' : 'text-emerald-600')
                            : darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{step.title}</p>
                          <p className={`text-[11px] truncate mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{step.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Progress */}
              <div className={`mx-5 my-8 p-6 rounded-xl border ${darkMode ? 'bg-slate-800/40 border-violet-500/12' : 'bg-slate-50/80 border-slate-200/50'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Progress</span>
                  <span className="text-xs font-bold tabular-nums oc-gradient-text">
                    {Math.round((steps.filter((_, idx) => validateStep(idx) && idx < currentStep).length / steps.length) * 100)}%
                  </span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700/40' : 'bg-slate-200/70'}`}>
                  <div className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(steps.filter((_, idx) => validateStep(idx) && idx < currentStep).length / steps.length) * 100}%`, background: 'linear-gradient(90deg, #8b5cf6, #6366f1, #22d3ee)' }} />
                </div>
                <p className={`text-[10px] mt-3 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  {steps.filter((_, idx) => validateStep(idx) && idx < currentStep).length} of {steps.length} steps complete
                </p>
              </div>
              {/* Pro tip */}
              <div className="mx-5 mb-6 p-5 rounded-xl border border-amber-500/15" style={{background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(251,191,36,0.03))'}}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-[0.1em]">Pro Tip</p>
                </div>
                <p className={`text-[11px] leading-relaxed ${darkMode ? 'text-amber-400/60' : 'text-amber-600/70'}`}>{proTips[currentStep]}</p>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="lg:col-span-9 flex flex-col">
            <div className={`glass-card rounded-2xl overflow-hidden flex flex-col flex-1 ${darkMode ? 'shadow-xl shadow-violet-950/30' : 'shadow-sm shadow-slate-200/40'}`}>
              {/* Step header */}
              <div className={`px-7 sm:px-14 py-7 sm:py-8 border-b ${darkMode ? 'border-violet-500/10 bg-gradient-to-r from-violet-600/8 via-indigo-600/4 to-transparent' : 'border-slate-100 bg-gradient-to-r from-violet-50/60 via-indigo-50/30 to-transparent'}`}>
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                    darkMode ? 'shadow-violet-900/30' : 'shadow-violet-200/50'}`}
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                    <StepIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className={`text-lg sm:text-xl font-bold leading-tight tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>{steps[currentStep].title}</h2>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0 ${darkMode ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'bg-violet-50 text-violet-600 border border-violet-200/60'}`}>
                        Step {currentStep + 1}/{steps.length}
                      </span>
                    </div>
                    <p className={`text-sm mt-2 leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{steps[currentStep].desc}</p>
                  </div>
                </div>
              </div>
              <div className="p-7 sm:p-14 oc-step-enter flex-1 overflow-y-auto" key={currentStep}>
                {currentStep === 0 && StepServiceConfig()}
                {currentStep === 1 && StepEndpointConfig()}
                {currentStep === 2 && StepTokenConfig()}
                {currentStep === 3 && StepFieldMapping()}
                {currentStep === 4 && StepResponseMapping()}
                {currentStep === 5 && StepReview()}
              </div>
              <div className={`px-7 sm:px-14 py-6 sm:py-7 border-t flex items-center ${darkMode ? 'border-violet-500/10 bg-slate-900/30' : 'border-slate-100 bg-slate-50/40'}`}>
                <button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}
                  className={`flex items-center gap-3 px-5 sm:px-6 py-3 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-semibold ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
                  <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
                </button>
                {/* Centered step dots */}
                <div className="flex-1 flex items-center justify-center gap-3">
                  {steps.map((_, idx) => (
                    <button key={idx} onClick={() => setCurrentStep(idx)}
                      className={`transition-all duration-300 rounded-full ${
                        idx === currentStep ? 'w-8 h-2 shadow-sm shadow-violet-500/40'
                        : validateStep(idx) && idx < currentStep ? 'w-2 h-2 bg-emerald-500/70'
                        : `w-2 h-2 ${darkMode ? 'bg-slate-600/50' : 'bg-slate-300'}`}`}
                      style={idx === currentStep ? {background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)'} : {}} />
                  ))}
                </div>
                <button onClick={() => {
                  if (currentStep === steps.length - 1) saveConfig();
                  else if (validateStep(currentStep)) setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
                  else showToast('Please fill in all required fields', 'warning');
                }}
                  className={`flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    currentStep === steps.length - 1
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/45 hover:scale-[1.02] active:scale-[0.98]'
                      : validateStep(currentStep)
                      ? 'text-white shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                      : darkMode ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed shadow-none' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                  style={currentStep !== steps.length - 1 && validateStep(currentStep) ? {background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', boxShadow: '0 4px 20px rgba(139,92,246,0.30)'} : {}}>
                  {currentStep === steps.length - 1 ? (<><Save className="w-4 h-4" /> <span className="hidden sm:inline">Save Configuration</span><span className="sm:hidden">Save</span></>) : (<>Next <ArrowRight className="w-4 h-4" /></>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* TRANSACTIONS LOG                            */}
      {/* ═══════════════════════════════════════════ */}
      {appView === 'logs' && <div className="flex-1 oc-view-enter flex flex-col"><TransactionsLogViewer darkMode={darkMode} /></div>}

      {/* ═══════════════════════════════════════════ */}
      {/* PRODUCTION READINESS CHECKER                */}
      {/* ═══════════════════════════════════════════ */}
      {appView === 'readiness' && <div className="flex-1 oc-view-enter flex flex-col"><ProductionReadinessChecker darkMode={darkMode} /></div>}

      </main>
      {/* FOOTER */}
      <footer className="border-t border-slate-800/50 mt-auto">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-10 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-violet-500/20">
                <img src="/src/img/favicon.png" alt="OpenConnect Logo" className="w-full h-full object-cover" />
              </div>
              <span className={`text-xs ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>OpenConnect Configuration &middot; Paysys Labs</span>
            </div>
            <div className={`text-xs ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Developed with precision by <span className={`font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Uneeb</span> &middot; &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OpenConnectConfigUI;
