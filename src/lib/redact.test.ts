import { describe, it, expect } from 'vitest';
import { redactSecrets, safeErrorMessage } from './redact';

describe('redactSecrets', () => {
  it('redacts Anthropic API key pattern', () => {
    const out = redactSecrets('Error calling sk-ant-api03-supersecretkey12345 endpoint');
    expect(out).not.toContain('sk-ant-api03-supersecretkey12345');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts GitHub classic PAT pattern', () => {
    const out = redactSecrets('token ghp_ABCDEF1234567890abcdef123456');
    expect(out).not.toContain('ghp_ABCDEF1234567890abcdef123456');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts GitHub fine-grained PAT pattern', () => {
    const out = redactSecrets('Authorization: Bearer github_pat_11ABCDEF00xyz_longtoken');
    expect(out).not.toContain('github_pat_11ABCDEF00xyz_longtoken');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts Bearer token in Authorization header value', () => {
    const out = redactSecrets('Authorization: Bearer mysecrettoken12345');
    expect(out).not.toContain('mysecrettoken12345');
    expect(out).toContain('[REDACTED]');
  });

  it('leaves non-sensitive strings unchanged', () => {
    const msg = 'Rate limit exceeded for outline-generation stage';
    expect(redactSecrets(msg)).toBe(msg);
  });

  it('handles empty string', () => {
    expect(redactSecrets('')).toBe('');
  });
});

describe('safeErrorMessage', () => {
  it('returns the error message for Error instances', () => {
    const err = new Error('Rate limit exceeded');
    expect(safeErrorMessage(err)).toBe('Rate limit exceeded');
  });

  it('converts non-Error values to string', () => {
    expect(safeErrorMessage('string error')).toBe('string error');
    expect(safeErrorMessage(42)).toBe('42');
  });

  it('truncates long messages to 500 characters', () => {
    const longMsg = 'x'.repeat(600);
    expect(safeErrorMessage(new Error(longMsg)).length).toBe(500);
  });

  it('redacts credential patterns from error messages', () => {
    const err = new Error('Failed with sk-ant-api03-leakedsecret in response');
    const safe = safeErrorMessage(err);
    expect(safe).not.toContain('sk-ant-api03-leakedsecret');
    expect(safe).toContain('[REDACTED]');
  });
});
