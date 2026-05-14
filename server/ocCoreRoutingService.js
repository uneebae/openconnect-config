/**
 * OC Core Routing Service
 *
 * Resolves OpenConnect Core endpoints for different environments.
 * Supports MOCK, OC_CORE_LOCAL, OC_CORE_UAT, OC_CORE_PROD.
 *
 * Each environment has:
 *  - base URL
 *  - endpoint paths for validation, request building, transaction submission
 *  - default headers and routing metadata
 */

import { getDb } from './db.js';

// ─── Environment Definitions ────────────────────────────────────────

const ENVIRONMENTS = {
  MOCK: {
    id: 'MOCK',
    label: 'Mock API',
    description: 'Local Mockoon / test-api for development',
    baseUrl: 'http://localhost:3010',
    color: 'slate',
    endpoints: {
      validate:    '/api/v1/validate',
      buildReq:    '/api/v1/build-request',
      submit:      '/api/v1/transaction',
      healthCheck: '/health',
    },
    headers: { 'Content-Type': 'application/json' },
    ocCoreMode: false,
  },

  MPAY: {
    id: 'MPAY',
    label: 'MPAY Gateway',
    description: 'MPay queue-forwarding gateway — CAS signed transport',
    baseUrl: 'http://10.0.142.4:7033',
    color: 'violet',
    endpoints: {
      queueForwarding: '/mpg/queueforwarding/',
      healthCheck:     '/health',
    },
    headers: { 'Content-Type': 'text/plain' },
    ocCoreMode: true,
    casTransport: true,   // uses SHA-256 signed positional params
  },

  OC_CORE_LOCAL: {
    id: 'OC_CORE_LOCAL',
    label: 'OC Core — Local',
    description: 'Local OpenConnect Core instance (dev)',
    baseUrl: 'http://localhost:8080',
    color: 'blue',
    endpoints: {
      validate:    '/oc/ws/validate',
      buildReq:    '/oc/rest/handler/build',
      submit:      '/oc/transaction/submit',
      healthCheck: '/oc/health',
      tokenRefresh:'/oc/token/refresh',
    },
    headers: {
      'Content-Type': 'application/json',
      'X-OC-Source': 'config-platform',
    },
    ocCoreMode: true,
  },

  OC_CORE_UAT: {
    id: 'OC_CORE_UAT',
    label: 'OC Core — UAT',
    description: 'UAT / pre-production OpenConnect Core',
    baseUrl: 'https://oc-uat.internal.bank',
    color: 'amber',
    endpoints: {
      validate:    '/oc/ws/validate',
      buildReq:    '/oc/rest/handler/build',
      submit:      '/oc/transaction/submit',
      healthCheck: '/oc/health',
      tokenRefresh:'/oc/token/refresh',
    },
    headers: {
      'Content-Type': 'application/json',
      'X-OC-Source': 'config-platform',
      'X-OC-Env': 'uat',
    },
    ocCoreMode: true,
    requiresHttps: false, // internal network
  },

  OC_CORE_PROD: {
    id: 'OC_CORE_PROD',
    label: 'OC Core — Production',
    description: 'Live production OpenConnect Core',
    baseUrl: 'https://oc.internal.bank',
    color: 'red',
    endpoints: {
      validate:    '/oc/ws/validate',
      buildReq:    '/oc/rest/handler/build',
      submit:      '/oc/transaction/submit',
      healthCheck: '/oc/health',
      tokenRefresh:'/oc/token/refresh',
    },
    headers: {
      'Content-Type': 'application/json',
      'X-OC-Source': 'config-platform',
      'X-OC-Env': 'production',
    },
    ocCoreMode: true,
    requiresHttps: true,
    readOnly: true, // discourage writes from config platform
  },
};

// Allow custom base URLs (set via PUT /api/oc-core/environment/:envId)
const customOverrides = {};

// ─── Public API ─────────────────────────────────────────────────────

/**
 * List all available environments.
 */
export function getEnvironments() {
  return Object.values(ENVIRONMENTS).map(env => ({
    id: env.id,
    label: env.label,
    description: env.description,
    baseUrl: customOverrides[env.id]?.baseUrl || env.baseUrl,
    color: env.color,
    ocCoreMode: env.ocCoreMode,
    requiresHttps: env.requiresHttps || false,
    readOnly: env.readOnly || false,
    endpoints: Object.keys(env.endpoints),
  }));
}

/**
 * Get full environment config by ID.
 */
export function getEnvironment(envId) {
  const env = ENVIRONMENTS[envId];
  if (!env) return null;
  const override = customOverrides[envId] || {};
  return {
    ...env,
    baseUrl: override.baseUrl || env.baseUrl,
    endpoints: {
      ...env.endpoints,
      ...(override.endpoints || {}),
    },
  };
}

/**
 * Override the base URL for an environment (runtime only).
 */
export function setEnvironmentOverride(envId, overrides) {
  if (!ENVIRONMENTS[envId]) return false;
  const allowed = ['baseUrl', 'endpoints'];
  const safe = {};
  for (const key of allowed) {
    if (overrides[key] !== undefined) safe[key] = overrides[key];
  }
  customOverrides[envId] = { ...(customOverrides[envId] || {}), ...safe };
  return true;
}

/**
 * Resolve the full URL for a given environment + endpoint type.
 */
export function resolveEndpoint(envId, endpointType) {
  const env = getEnvironment(envId);
  if (!env) return null;
  const path = env.endpoints[endpointType];
  if (!path) return null;
  return {
    url: `${env.baseUrl}${path}`,
    method: endpointType === 'healthCheck' ? 'GET' : 'POST',
    headers: { ...env.headers },
    envId: env.id,
    envLabel: env.label,
    ocCoreMode: env.ocCoreMode,
  };
}

/**
 * Build an OC Core–format request payload.
 * Wraps standard request params in the OC Core routing envelope.
 */
export function buildOcCoreRequest({ configId, tranType, queueIn, queueType, hostId, fromIp, params }) {
  return {
    header: {
      tran_type:  tranType  || 'BALANCE_INQUIRY',
      queue_in:   queueIn   || 'WS_QUEUE',
      queue_type: queueType || 'REST',
      host_id:    hostId    || String(configId || 1),
      from_ip:    fromIp    || '127.0.0.1',
      timestamp:  new Date().toISOString(),
    },
    body: {
      config_id: configId,
      ...params,
    },
  };
}

/**
 * Run OC Core health check for an environment.
 */
export async function checkHealth(envId) {
  const resolved = resolveEndpoint(envId, 'healthCheck');
  if (!resolved) return { reachable: false, error: 'Unknown environment' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const start = Date.now();
    const resp = await fetch(resolved.url, {
      method: 'GET',
      headers: resolved.headers,
      signal: controller.signal,
    });
    const elapsed = Date.now() - start;
    clearTimeout(timer);

    let body = null;
    try { body = await resp.json(); } catch { /* non-JSON health */ }

    return {
      reachable: true,
      httpStatus: resp.status,
      elapsed_ms: elapsed,
      envId,
      envLabel: resolved.envLabel,
      url: resolved.url,
      body,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      reachable: false,
      envId,
      envLabel: resolved.envLabel,
      url: resolved.url,
      error: err.name === 'AbortError' ? 'Health check timed out (5s)' : err.message,
    };
  }
}

/**
 * Generate a cURL command for an OC Core endpoint.
 */
export function generateOcCoreCurl(envId, endpointType, payload) {
  const resolved = resolveEndpoint(envId, endpointType);
  if (!resolved) return null;

  const headerFlags = Object.entries(resolved.headers)
    .map(([k, v]) => `-H "${k}: ${v}"`)
    .join(' \\\n  ');

  const body = payload ? `-d '${JSON.stringify(payload, null, 2)}'` : '';

  return [
    `curl -X ${resolved.method} "${resolved.url}" \\`,
    `  ${headerFlags}`,
    body ? `  ${body}` : '',
  ].filter(Boolean).join(' \\\n');
}
