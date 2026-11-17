let quotaCooldownUntil = 0;

export function isGeminiQuotaCoolingDown(): boolean {
  return Date.now() < quotaCooldownUntil;
}

export function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err || '');
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : undefined;

  return (
    status === 429 ||
    /429|RESOURCE_EXHAUSTED|quota|rate[- ]?limit/i.test(msg)
  );
}

export function markGeminiQuotaCooldownIfNeeded(err: unknown, cooldownMs = 5 * 60 * 1000): boolean {
  if (isQuotaOrRateLimitError(err)) {
    quotaCooldownUntil = Math.max(quotaCooldownUntil, Date.now() + cooldownMs);
    return true;
  }
  return false;
}

export function formatGeminiFallbackReason(err: unknown): string {
  if (isQuotaOrRateLimitError(err)) {
    return 'Gemini API quota exceeded (429 RESOURCE_EXHAUSTED); using curated fallback temporarily.';
  }
  if (err instanceof Error && err.message) {
    return err.message.slice(0, 140);
  }
  return 'Gemini API temporarily unavailable; using deterministic fallback.';
}
