/**
 * The single shared admin token that gates the BotForge dashboard APIs.
 *
 * Mirrors the pattern already used by src/pages/LeadsDashboard.tsx for the
 * legacy leads dashboard: kept in localStorage, prompted for when missing.
 * Sent as an x-admin-token header rather than a query parameter, so it does
 * not end up in server access logs.
 */

const KEY = "botforge:admin:v1";

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAdminToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch (e) {
    console.warn("[admin-token] save failed", e);
  }
}

export function hasAdminToken(): boolean {
  return getAdminToken().length > 0;
}

/** True when a store error message means the admin token is missing or wrong. */
export function isAuthError(message: string): boolean {
  return /unauthor/i.test(message);
}
