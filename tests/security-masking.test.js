/**
 * Security Masking Service — Comprehensive Tests
 * Covers: maskValue, maskSensitiveFields, maskHeaders, edge cases, nested objects
 */
import { describe, it, expect } from 'vitest';
import { maskValue, maskSensitiveFields, maskHeaders } from '../server/securityMaskingService.js';

// ─── maskValue ──────────────────────────────────────────────────

describe('maskValue', () => {
  it('should return null for null input', () => {
    expect(maskValue(null)).toBeNull();
  });

  it('should return undefined for undefined input', () => {
    expect(maskValue(undefined)).toBeUndefined();
  });

  it('should fully mask short strings (<=8 chars)', () => {
    expect(maskValue('secret')).toBe('••••••••');
    expect(maskValue('12345678')).toBe('••••••••');
    expect(maskValue('')).toBe('••••••••');
  });

  it('should keep first 4 chars for longer strings', () => {
    expect(maskValue('SuperSecret123')).toBe('Supe••••••••');
    expect(maskValue('mypassword99')).toBe('mypa••••••••');
  });

  it('should handle numeric input by converting to string', () => {
    const result = maskValue(123456789);
    expect(typeof result).toBe('string');
    expect(result).toContain('••••••••');
  });
});

// ─── maskSensitiveFields ────────────────────────────────────────

describe('maskSensitiveFields', () => {
  it('should return null for null input', () => {
    expect(maskSensitiveFields(null)).toBeNull();
  });

  it('should return non-object input as-is', () => {
    expect(maskSensitiveFields('string')).toBe('string');
    expect(maskSensitiveFields(123)).toBe(123);
  });

  it('should mask password field', () => {
    const result = maskSensitiveFields({ username: 'admin', password: 'SuperSecret123' });
    expect(result.username).toBe('admin');
    expect(result.password).toBe('Supe••••••••');
  });

  it('should mask client_secret', () => {
    const result = maskSensitiveFields({ client_secret: 'abc-def-ghi-jkl-mno' });
    expect(result.client_secret).toContain('••••••••');
    expect(result.client_secret).not.toBe('abc-def-ghi-jkl-mno');
  });

  it('should mask access_token', () => {
    const result = maskSensitiveFields({ access_token: 'eyJhbGciOiJSUzI1NiJ9.longtoken' });
    expect(result.access_token).toContain('••••••••');
  });

  it('should mask authorization', () => {
    const result = maskSensitiveFields({ authorization: 'Bearer xyz123' });
    expect(result.authorization).toContain('••••••••');
  });

  it('should mask api_key / apiKey variants', () => {
    const r1 = maskSensitiveFields({ api_key: 'sk_live_abcdef123456' });
    expect(r1.api_key).toContain('••••••••');

    const r2 = maskSensitiveFields({ apiKey: 'sk_live_abcdef123456' });
    expect(r2.apiKey).toContain('••••••••');
  });

  it('should NOT mask non-sensitive fields', () => {
    const result = maskSensitiveFields({
      username: 'john',
      email: 'john@test.com',
      status: 'active',
    });
    expect(result.username).toBe('john');
    expect(result.email).toBe('john@test.com');
    expect(result.status).toBe('active');
  });

  it('should recursively mask nested objects', () => {
    const result = maskSensitiveFields({
      user: {
        name: 'Alice',
        settings: {
          password: 'deep-secret-value',
          api_key: 'nested-key-value99',
        },
      },
    });
    expect(result.user.name).toBe('Alice');
    expect(result.user.settings.password).toContain('••••••••');
    expect(result.user.settings.api_key).toContain('••••••••');
  });

  it('should handle arrays', () => {
    const result = maskSensitiveFields([
      { password: 'secret1' },
      { password: 'secret2' },
    ]);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].password).toBe('••••••••');
    expect(result[1].password).toBe('••••••••');
  });

  it('should not modify the original object (deep clone)', () => {
    const original = { password: 'MyPassword123', name: 'test' };
    maskSensitiveFields(original);
    expect(original.password).toBe('MyPassword123');
  });

  it('should mask refresh_token', () => {
    const result = maskSensitiveFields({ refresh_token: 'rt_1234567890abcdef' });
    expect(result.refresh_token).toContain('••••••••');
  });

  it('should mask private_key / privateKey', () => {
    const result = maskSensitiveFields({ privateKey: '-----BEGIN RSA PRIVATE KEY-----...' });
    expect(result.privateKey).toContain('••••••••');
  });
});

// ─── maskHeaders ────────────────────────────────────────────────

describe('maskHeaders', () => {
  it('should return null/undefined as-is', () => {
    expect(maskHeaders(null)).toBeNull();
    expect(maskHeaders(undefined)).toBeUndefined();
  });

  it('should mask authorization header', () => {
    const result = maskHeaders({ authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9' });
    expect(result.authorization).toContain('••••••••');
  });

  it('should mask x-api-key header', () => {
    const result = maskHeaders({ 'x-api-key': 'sk_live_12345678901234' });
    expect(result['x-api-key']).toContain('••••••••');
  });

  it('should mask cookie header', () => {
    const result = maskHeaders({ cookie: 'session=abc123def456ghi789' });
    expect(result.cookie).toContain('••••••••');
  });

  it('should mask set-cookie header', () => {
    const result = maskHeaders({ 'set-cookie': 'session=abc123; Path=/' });
    expect(result['set-cookie']).toContain('••••••••');
  });

  it('should NOT mask non-sensitive headers', () => {
    const result = maskHeaders({
      'Content-Type': 'application/json',
      'Accept': 'text/html',
      'X-Custom-Header': 'visible',
    });
    expect(result['Content-Type']).toBe('application/json');
    expect(result['Accept']).toBe('text/html');
    expect(result['X-Custom-Header']).toBe('visible');
  });

  it('should handle case-insensitive header matching', () => {
    const result = maskHeaders({ 'Authorization': 'Bearer token1234567890' });
    expect(result['Authorization']).toContain('••••••••');
  });

  it('should handle mixed sensitive and non-sensitive headers', () => {
    const result = maskHeaders({
      'Content-Type': 'application/json',
      'authorization': 'Bearer secret-token-12345',
      'x-api-key': 'key-value-123456789',
      'Accept': '*/*',
    });
    expect(result['Content-Type']).toBe('application/json');
    expect(result['Accept']).toBe('*/*');
    expect(result['authorization']).toContain('••••••••');
    expect(result['x-api-key']).toContain('••••••••');
  });
});
