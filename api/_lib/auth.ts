/**
 * Admin authentication for the BotForge dashboard APIs.
 *
 * A single shared token, no user accounts. Only BOTFORGE_ADMIN_TOKEN grants
 * access: LEADS_DASHBOARD_TOKEN used to be accepted as a transitional fallback,
 * which was wrong twice over. It let the old read-only leads password reach
 * /api/provider-keys and read the stored provider API keys, and because it made
 * isAdminConfigured() true it suppressed the 503 that would otherwise have said
 * BOTFORGE_ADMIN_TOKEN was never set -- turning a clear misconfiguration into an
 * unexplained "token rejected". api/leads.ts still uses it for /leads.
 *
 * Note the difference from api/leads.ts, which skips its check entirely when
 * the env var is unset. These endpoints expose bot configuration, provider API
 * keys and captured contact details, so a missing token denies access rather
 * than granting it -- a misconfigured deploy must fail closed.
 */

/**
 * Environment values arrive by copy and paste, so they routinely carry a
 * trailing newline or a wrapping pair of quotes. Comparing those raw made a
 * correct token fail with no way to see why.
 */
function readToken(raw: string | undefined): string {
  const trimmed = (raw || "").trim();
  const unquoted = /^(["']).*\1$/s.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
  return unquoted.trim();
}

const ADMIN_TOKEN = readToken(process.env.BOTFORGE_ADMIN_TOKEN);

/** Constant-time string compare, to avoid leaking the token via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdminToken(token: string | null | undefined): boolean {
  const t = readToken(token ?? undefined);
  if (!t || !ADMIN_TOKEN) return false;
  return safeEqual(t, ADMIN_TOKEN);
}

/** True when no admin token is configured at all -- every request must 503. */
export function isAdminConfigured(): boolean {
  return Boolean(ADMIN_TOKEN);
}

/** Which variable supplies the token, for /api/health. Never the value. */
export const ADMIN_TOKEN_VARIABLE = "BOTFORGE_ADMIN_TOKEN";

/** Length only -- enough to spot a stray newline or quote, useless otherwise. */
export function adminTokenLength(): number {
  return ADMIN_TOKEN.length;
}

export const ADMIN_HEADER = "x-admin-token";
