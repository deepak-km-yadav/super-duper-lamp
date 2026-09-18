/**
 * Admin authentication for the BotForge dashboard APIs.
 *
 * Single shared token, no user accounts. BOTFORGE_ADMIN_TOKEN is the real one;
 * LEADS_DASHBOARD_TOKEN is accepted as a transitional fallback so an existing
 * deployment keeps working before the new variable is set.
 *
 * Note the difference from api/leads.ts, which skips its check entirely when
 * the env var is unset. These endpoints expose bot configuration, provider API
 * keys and captured contact details, so a missing token denies access rather
 * than granting it -- a misconfigured deploy must fail closed.
 */

const ADMIN_TOKEN = process.env.BOTFORGE_ADMIN_TOKEN || "";
const LEGACY_TOKEN = process.env.LEADS_DASHBOARD_TOKEN || "";

/** Constant-time string compare, to avoid leaking the token via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdminToken(token: string | null | undefined): boolean {
  const t = (token || "").trim();
  if (!t) return false;
  if (ADMIN_TOKEN && safeEqual(t, ADMIN_TOKEN)) return true;
  if (LEGACY_TOKEN && safeEqual(t, LEGACY_TOKEN)) return true;
  return false;
}

/** True when no admin token is configured at all -- every request must 503. */
export function isAdminConfigured(): boolean {
  return Boolean(ADMIN_TOKEN || LEGACY_TOKEN);
}

export const ADMIN_HEADER = "x-admin-token";
