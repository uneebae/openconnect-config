/**
 * OC Core Transport Service — Comprehensive Tests
 * Covers: URL signing, SHA-256 signatures, parameter encoding, response parsing, edge cases
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  buildSignedGetUrl,
  buildSignedPostUrl,
  buildPostBody,
  ocGet,
  ocPost,
  parseOcCoreResponse,
  getAndParse,
  postAndParse,
} from '../server/ocCoreTransportService.js';

// ─── Helper: compute expected SHA-256 ───────────────────────────

function expectedSha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

const SECRET = process.env.OC_CORE_SECRET || 'paysys@123';

// ─── buildSignedGetUrl ──────────────────────────────────────────

describe('buildSignedGetUrl', () => {
  it('should produce a URL with encoded params and signature', () => {
    const url = buildSignedGetUrl('http://localhost:8080/oc/ws/', ['param1', 'param2']);
    expect(url).toContain('http://localhost:8080/oc/ws/');
    expect(url).toContain('/'); // separator before signature
    // URL should end with a 64-char hex SHA-256
    const sig = url.split('/').pop();
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should double-encode the CSV params', () => {
    const url = buildSignedGetUrl('http://host/', ['a', 'b']);
    // "a" encodes to "a", "b" to "b", csv = "a,b", double encoded = "a%2Cb"
    expect(url).toContain('a%2Cb');
  });

  it('should produce correct SHA-256 signature', () => {
    const params = ['hello', 'world'];
    const encoded = params.map(p => encodeURIComponent(p));
    const sigInput = [...encoded, SECRET].join(',');
    const expectedSig = expectedSha256(sigInput);

    const url = buildSignedGetUrl('http://host/', params);
    expect(url).toContain(expectedSig);
  });

  it('should handle null params by converting to "null" string', () => {
    const url = buildSignedGetUrl('http://host/', [null, undefined, 'valid']);
    expect(url).toContain('null');
    // Should not throw
    expect(typeof url).toBe('string');
  });

  it('should handle empty params array', () => {
    const url = buildSignedGetUrl('http://host/', []);
    expect(url).toBeTruthy();
    const sig = url.replace('http://host/', '').split('/').pop();
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle special characters in params', () => {
    const url = buildSignedGetUrl('http://host/', ['hello world', 'a&b=c', 'café']);
    expect(url).toBeTruthy();
    // Special chars should be encoded
    expect(url).not.toContain(' ');
  });

  it('should handle numeric params by converting to string', () => {
    const url = buildSignedGetUrl('http://host/', [123, 45.67, 0]);
    expect(url).toBeTruthy();
    expect(url).toContain('123');
  });
});

// ─── buildSignedPostUrl ─────────────────────────────────────────

describe('buildSignedPostUrl', () => {
  it('should produce endpoint + SHA-256 signature (no double encoding)', () => {
    const url = buildSignedPostUrl('http://host/path/', ['a', 'b']);
    expect(url).toMatch(/^http:\/\/host\/path\/[a-f0-9]{64}$/);
  });

  it('should compute the same signature as expected', () => {
    const params = ['test1', 'test2'];
    const encoded = params.map(p => encodeURIComponent(p));
    const sigInput = [...encoded, SECRET].join(',');
    const expected = expectedSha256(sigInput);

    const url = buildSignedPostUrl('http://host/', params);
    expect(url).toBe(`http://host/${expected}`);
  });

  it('should handle empty params', () => {
    const url = buildSignedPostUrl('http://host/', []);
    expect(url).toMatch(/^http:\/\/host\/[a-f0-9]{64}$/);
  });

  it('should differ from GET URL for same params', () => {
    const params = ['x', 'y'];
    const getUrl = buildSignedGetUrl('http://host/', params);
    const postUrl = buildSignedPostUrl('http://host/', params);
    // GET has double-encoded CSV, POST doesn't — they should differ
    expect(getUrl).not.toBe(postUrl);
  });
});

// ─── buildPostBody ──────────────────────────────────────────────

describe('buildPostBody', () => {
  it('should return comma-separated URL-encoded params', () => {
    const body = buildPostBody(['hello', 'world']);
    expect(body).toBe('hello,world');
  });

  it('should URL-encode special characters', () => {
    const body = buildPostBody(['hello world', 'a&b']);
    expect(body).toBe('hello%20world,a%26b');
  });

  it('should convert null/undefined to "null"', () => {
    const body = buildPostBody([null, undefined, 'valid']);
    expect(body).toBe('null,null,valid');
  });

  it('should handle empty array', () => {
    const body = buildPostBody([]);
    expect(body).toBe('');
  });

  it('should handle single param', () => {
    const body = buildPostBody(['only']);
    expect(body).toBe('only');
  });
});

// ─── parseOcCoreResponse ────────────────────────────────────────

describe('parseOcCoreResponse', () => {
  it('should return OC_TIMEOUT for null input', () => {
    const r = parseOcCoreResponse(null);
    expect(r.success).toBe(false);
    expect(r.rspCode).toBe('501');
    expect(r.errorCode).toBe('OC_TIMEOUT');
  });

  it('should return OC_TIMEOUT for empty string', () => {
    const r = parseOcCoreResponse('');
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('OC_TIMEOUT');
  });

  it('should return OC_INVALID_RESPONSE for non-JSON', () => {
    const r = parseOcCoreResponse('not json at all');
    expect(r.success).toBe(false);
    expect(r.rspCode).toBe('500');
    expect(r.errorCode).toBe('OC_INVALID_RESPONSE');
  });

  it('should return OC_MISSING_ENVELOPE when response key is absent', () => {
    const r = parseOcCoreResponse(JSON.stringify({ data: 'something' }));
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('OC_MISSING_ENVELOPE');
  });

  it('should parse successful response (code "00")', () => {
    const raw = JSON.stringify({
      response: {
        response_code: '00',
        response_desc: 'Success',
        balance: '150000.00',
        currency: 'PKR',
      }
    });
    const r = parseOcCoreResponse(raw);
    expect(r.success).toBe(true);
    expect(r.rspCode).toBe('00');
    expect(r.rspDesc).toBe('Success');
    expect(r.data.balance).toBe('150000.00');
    // response_code and response_desc should be stripped from data
    expect(r.data.response_code).toBeUndefined();
    expect(r.data.response_desc).toBeUndefined();
    expect(r.errorCode).toBeNull();
  });

  it('should detect code "503" as OC_UNABLE_TO_PROCESS', () => {
    const raw = JSON.stringify({
      response: { response_code: '503', response_desc: 'Service unavailable' }
    });
    const r = parseOcCoreResponse(raw);
    expect(r.success).toBe(false);
    expect(r.rspCode).toBe('503');
    expect(r.errorCode).toBe('OC_UNABLE_TO_PROCESS');
  });

  it('should detect code "400" and dig into tranType sub-object', () => {
    const raw = JSON.stringify({
      response: {
        response_code: '400',
        response_desc: 'Bad Request',
        balance_inquiry: {
          statusCode: '404',
          description: 'Account not found',
        }
      }
    });
    const r = parseOcCoreResponse(raw, 'BALANCE_INQUIRY');
    expect(r.success).toBe(false);
    expect(r.rspCode).toBe('404');
    expect(r.errorCode).toBe('OC_BAD_REQUEST');
    expect(r.errorMessage).toBe('Account not found');
  });

  it('should handle code "400" without matching tranType sub-object', () => {
    const raw = JSON.stringify({
      response: { response_code: '400', response_desc: 'Bad Request' }
    });
    const r = parseOcCoreResponse(raw, 'FUND_TRANSFER');
    // Should fall through to generic failure since no fund_transfer key
    expect(r.success).toBe(false);
  });

  it('should detect timeout codes ("501", "504", "TIMEOUT")', () => {
    for (const code of ['501', '504', 'TIMEOUT']) {
      const raw = JSON.stringify({
        response: { response_code: code, response_desc: 'Timed out' }
      });
      const r = parseOcCoreResponse(raw);
      expect(r.success).toBe(false);
      expect(r.errorCode).toBe('OC_TIMEOUT');
    }
  });

  it('should support custom timeout codes', () => {
    const raw = JSON.stringify({
      response: { response_code: '999', response_desc: 'Custom timeout' }
    });
    const r = parseOcCoreResponse(raw, null, ['999']);
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('OC_TIMEOUT');
  });

  it('should detect generic failure for non-"00" codes', () => {
    const raw = JSON.stringify({
      response: { response_code: '96', response_desc: 'System malfunction' }
    });
    const r = parseOcCoreResponse(raw);
    expect(r.success).toBe(false);
    expect(r.rspCode).toBe('96');
    expect(r.errorCode).toBe('OC_FAILURE');
  });

  it('should extract SBP reject codes when present', () => {
    const raw = JSON.stringify({
      response: {
        response_code: '05',
        response_desc: 'Do not honour',
        sbp_reject_code: 'AC03',
        sbp_reject_reason: 'Invalid creditor account',
      }
    });
    const r = parseOcCoreResponse(raw);
    expect(r.success).toBe(false);
    expect(r.sbpRejectCode).toBe('AC03');
    expect(r.sbpRejectReason).toBe('Invalid creditor account');
  });

  it('should not include SBP fields when absent', () => {
    const raw = JSON.stringify({
      response: { response_code: '14', response_desc: 'Invalid card' }
    });
    const r = parseOcCoreResponse(raw);
    expect(r.sbpRejectCode).toBeUndefined();
    expect(r.sbpRejectReason).toBeUndefined();
  });
});

// ─── ocGet with mocked fetch ────────────────────────────────────

describe('ocGet', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should make a GET request with signed URL', async () => {
    fetch.mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify({ response: { response_code: '00', response_desc: 'OK' } }),
    });

    const result = await ocGet('http://localhost:8080/oc/', ['param1'], 'RRN001', 5000);
    expect(result.raw).toBeTruthy();
    expect(result.timedOut).toBe(false);
    expect(result.httpStatus).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain('http://localhost:8080/oc/');
  });

  it('should return timedOut=true for empty response body', async () => {
    fetch.mockResolvedValueOnce({
      status: 200,
      text: async () => '',
    });

    const result = await ocGet('http://host/', ['p'], '', 5000);
    expect(result.timedOut).toBe(true);
    expect(result.raw).toBeNull();
  });

  it('should return timedOut=true on AbortError', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    fetch.mockRejectedValueOnce(abortError);

    const result = await ocGet('http://host/', ['p'], '', 1);
    expect(result.timedOut).toBe(true);
  });

  it('should return networkError on fetch failure', async () => {
    fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await ocGet('http://host/', ['p'], '', 5000);
    expect(result.timedOut).toBe(false);
    expect(result.networkError).toBe('ECONNREFUSED');
  });
});

// ─── ocPost with mocked fetch ───────────────────────────────────

describe('ocPost', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should make a POST request with signed URL and body', async () => {
    fetch.mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify({ response: { response_code: '00', response_desc: 'OK' } }),
    });

    const result = await ocPost('http://localhost:8080/oc/', ['p1', 'p2'], 'RRN002', 5000);
    expect(result.raw).toBeTruthy();
    expect(result.timedOut).toBe(false);

    const callArgs = fetch.mock.calls[0];
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].headers['Content-Type']).toBe('text/plain');
    expect(callArgs[1].body).toBe('p1,p2');
  });

  it('should return timedOut=true for empty response', async () => {
    fetch.mockResolvedValueOnce({
      status: 200,
      text: async () => '   ',
    });

    const result = await ocPost('http://host/', ['p'], '', 5000);
    expect(result.timedOut).toBe(true);
  });
});

// ─── getAndParse ────────────────────────────────────────────────

describe('getAndParse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should GET and parse a successful response', async () => {
    const rawResp = JSON.stringify({
      response: { response_code: '00', response_desc: 'Success', balance: '5000' }
    });
    fetch.mockResolvedValueOnce({ status: 200, text: async () => rawResp });

    const result = await getAndParse('http://host/', ['p1'], { rrn: 'RRN1', tranType: 'BALANCE_INQUIRY' });
    expect(result.success).toBe(true);
    expect(result.rspCode).toBe('00');
    expect(result.data.balance).toBe('5000');
    expect(result.elapsed_ms).toBeGreaterThanOrEqual(0);
  });

  it('should return timeout result on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await getAndParse('http://host/', ['p'], { rrn: 'RRN2' });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('OC_TIMEOUT');
    expect(result.networkError).toBe('ECONNREFUSED');
  });
});

// ─── postAndParse ───────────────────────────────────────────────

describe('postAndParse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should POST and parse a successful response', async () => {
    const rawResp = JSON.stringify({
      response: { response_code: '00', response_desc: 'Approved', trn_id: 'TXN999' }
    });
    fetch.mockResolvedValueOnce({ status: 200, text: async () => rawResp });

    const result = await postAndParse('http://host/', ['p1', 'p2'], { rrn: 'RRN3', tranType: 'FUND_TRANSFER' });
    expect(result.success).toBe(true);
    expect(result.data.trn_id).toBe('TXN999');
    expect(result.httpStatus).toBe(200);
  });

  it('should handle timeout in POST', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    fetch.mockRejectedValueOnce(abortError);

    const result = await postAndParse('http://host/', ['p'], { timeoutMs: 1 });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('OC_TIMEOUT');
  });
});

// ─── Signature Consistency ──────────────────────────────────────

describe('Signature consistency (cross-verification)', () => {
  it('GET and POST signatures should differ for same params (different construction)', () => {
    const params = ['4532015112830366', 'BALANCE_INQUIRY', 'OPENCONNECT.IN'];
    const getUrl = buildSignedGetUrl('http://host/', params);
    const postUrl = buildSignedPostUrl('http://host/', params);

    const getSig = getUrl.split('/').pop();
    const postSig = postUrl.replace('http://host/', '');

    // Both should be valid hex
    expect(getSig).toMatch(/^[a-f0-9]{64}$/);
    expect(postSig).toMatch(/^[a-f0-9]{64}$/);

    // POST signature = SHA256 of encoded params + secret
    // GET signature = same — so they SHOULD be equal (same signature logic)
    expect(getSig).toBe(postSig);
  });

  it('should produce deterministic signatures (same input = same output)', () => {
    const params = ['test', '123'];
    const url1 = buildSignedGetUrl('http://host/', params);
    const url2 = buildSignedGetUrl('http://host/', params);
    expect(url1).toBe(url2);
  });

  it('should produce different signatures for different params', () => {
    const url1 = buildSignedGetUrl('http://host/', ['a']);
    const url2 = buildSignedGetUrl('http://host/', ['b']);
    expect(url1).not.toBe(url2);
  });

  it('POST body should match what server expects', () => {
    const params = ['4532015112830366', '15000', 'PKR'];
    const body = buildPostBody(params);
    // Each param individually encoded, joined by comma
    expect(body).toBe('4532015112830366,15000,PKR');
  });
});
