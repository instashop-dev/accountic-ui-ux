// Redaction patterns for known credential formats
const CREDENTIAL_PATTERNS: RegExp[] = [
  /Bearer\s+\S+/gi,                  // Authorization: Bearer <token>
  /sk-ant-[A-Za-z0-9_\-]+/g,        // Anthropic API keys
  /ghp_[A-Za-z0-9]+/g,              // GitHub classic PATs
  /github_pat_[A-Za-z0-9_]+/g,      // GitHub fine-grained PATs
];

// Strip known credential patterns from a string before logging.
export function redactSecrets(s: string): string {
  let out = s;
  for (const pattern of CREDENTIAL_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

// Extract a safe, truncated error message from a caught exception.
// Never returns stack traces or raw Error objects.
export function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return redactSecrets(msg).slice(0, 500);
}
