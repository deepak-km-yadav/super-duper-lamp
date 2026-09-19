/**
 * Bot persistence, backed by Supabase through the /api/bots serverless routes.
 *
 * This replaces local-store.ts as the source of truth. Everything here is
 * async: a synchronous facade was considered and rejected, because the case
 * that matters most -- a visitor loading a public bot by slug, with no cache to
 * read from -- is unavoidably async. An API that is honest on one page and
 * lying on another is worse than one that is async everywhere.
 *
 * local-store.ts survives as the migration source and as a rollback path.
 */

import type { Bot, PublicBot } from "./types";
import { apiFetch, ApiError } from "./api-client";
import { getAdminToken } from "./admin-token";
import { loadAll as loadLocalBots } from "./local-store";

const MIGRATED_KEY = "botforge:migrated:v1";

/** Kept as an alias so existing `instanceof StoreError` checks still hold. */
export { ApiError as StoreError };

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

export async function listBots(opts?: { includeArchived?: boolean }): Promise<Bot[]> {
  const q = opts?.includeArchived ? "?includeArchived=1" : "";
  const { bots } = await apiFetch<{ bots: Bot[] }>(`/api/bots${q}`);
  return bots ?? [];
}

export async function getBot(id: string): Promise<Bot | null> {
  try {
    const { bot } = await apiFetch<{ bot: Bot }>(`/api/bots?id=${encodeURIComponent(id)}`);
    return bot ?? null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function createBot(input: Partial<Bot>): Promise<Bot> {
  const { bot } = await apiFetch<{ bot: Bot }>("/api/bots", { method: "POST", body: input });
  return bot;
}

export async function updateBot(id: string, patch: Partial<Bot>): Promise<Bot> {
  const { bot } = await apiFetch<{ bot: Bot }>(`/api/bots?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { patch },
  });
  return bot;
}

export async function removeBot(id: string): Promise<void> {
  await apiFetch(`/api/bots?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function setBotStatus(
  id: string,
  status: Bot["status"],
  publishedAt?: string,
): Promise<Bot> {
  return updateBot(id, { status, ...(publishedAt ? { publishedAt } : {}) });
}

/**
 * Last-ditch save when the editor unmounts.
 *
 * A fetch issued during unmount is cancelled by the browser on navigation, so
 * this uses sendBeacon, which the browser completes regardless. sendBeacon is
 * POST-only and cannot set headers, which is why /api/bots accepts an `op`
 * field and an in-body token on this one path.
 */
export function beaconSave(id: string, patch: Partial<Bot>): void {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) return;
  try {
    const body = JSON.stringify({ op: "update", id, patch, token: getAdminToken() });
    navigator.sendBeacon("/api/bots", new Blob([body], { type: "application/json" }));
  } catch {
    // Best effort only -- the debounced save is the primary path.
  }
}

// ---------------------------------------------------------------------------
// Public read (no admin token)
// ---------------------------------------------------------------------------

export type PublicBotResult =
  | { kind: "ready"; bot: PublicBot }
  | { kind: "unpublished"; name: string }
  | { kind: "missing" };

export async function getPublicBot(slug: string): Promise<PublicBotResult> {
  let payload: Record<string, unknown>;
  try {
    payload = await apiFetch<Record<string, unknown>>(
      `/api/bot-public?slug=${encodeURIComponent(slug)}`,
      { auth: false },
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { kind: "missing" };
    throw e;
  }

  if (payload.unavailable === "unpublished") {
    return { kind: "unpublished", name: String(payload.name ?? "This bot") };
  }
  if (payload.unavailable === "missing" || !payload.bot) return { kind: "missing" };

  return { kind: "ready", bot: payload.bot as PublicBot };
}

// ---------------------------------------------------------------------------
// One-time migration out of localStorage
// ---------------------------------------------------------------------------

export type MigrationResult = { imported: number; skipped: number };

export function hasMigrated(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MIGRATED_KEY) !== null;
  } catch {
    return true;
  }
}

/**
 * Copies any bots still in localStorage up to the server, once.
 *
 * Deliberately does not clear localStorage afterwards: the original data stays
 * as a permanent backup, and the server-side import ignores ids it already has,
 * so running this twice (two tabs, a reload mid-flight) cannot duplicate bots.
 */
export async function migrateLocalBotsOnce(): Promise<MigrationResult | null> {
  if (hasMigrated()) return null;

  const local = loadLocalBots();
  if (local.length === 0) {
    markMigrated(0);
    return null;
  }

  const result = await apiFetch<MigrationResult>("/api/bots", {
    method: "POST",
    body: { op: "import", bots: local },
  });

  markMigrated(result.imported ?? 0);
  return result;
}

function markMigrated(count: number): void {
  try {
    window.localStorage.setItem(
      MIGRATED_KEY,
      JSON.stringify({ at: new Date().toISOString(), count }),
    );
  } catch {
    // If we cannot record it, the id-based import guard still prevents dupes.
  }
}
