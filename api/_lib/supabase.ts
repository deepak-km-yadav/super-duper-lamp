/**
 * Thin PostgREST client shared by the serverless functions.
 *
 * Deliberately raw `fetch` rather than @supabase/supabase-js: it is the house
 * style already used by api/leads.ts and api/lead-capture.ts, it adds no
 * dependency, and it works unchanged on both the Node and Edge runtimes.
 */

import { readEnv, readEnvUrl, describeFetchFailure } from "./env.js";

export const SUPABASE_URL = readEnvUrl(process.env.SUPABASE_URL);
export const SUPABASE_SERVICE_ROLE_KEY = readEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export class SupabaseError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SupabaseError";
    this.status = status;
  }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function request<T>(
  path: string,
  init: { method: string; body?: unknown; prefer?: string },
): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseError("Supabase env vars are missing", 500);
  }

  const url = `${SUPABASE_URL}/rest/v1/${path}`;

  // A connection failure has to be caught here. Without this, undici's bare
  // "fetch failed" propagated all the way to the browser, which said nothing
  // about which host could not be reached or why.
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: headers(init.prefer ? { Prefer: init.prefer } : undefined),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (e) {
    throw new SupabaseError(describeFetchFailure(e, SUPABASE_URL), 502);
  }

  const raw = await res.text();
  if (!res.ok) {
    throw new SupabaseError(raw || `Supabase ${init.method} failed`, res.status);
  }
  if (!raw) return undefined as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SupabaseError("Supabase returned malformed JSON", 502);
  }
}

/** SELECT. `query` is a PostgREST query string, e.g. `select=*&slug=eq.foo`. */
export function sbSelect<T>(table: string, query: string): Promise<T[]> {
  return request<T[]>(`${table}?${query}`, { method: "GET" });
}

/** SELECT returning at most one row. */
export async function sbSelectOne<T>(table: string, query: string): Promise<T | null> {
  const rows = await sbSelect<T>(table, `${query}&limit=1`);
  return rows[0] ?? null;
}

/** INSERT, returning the created row(s). */
export function sbInsert<T>(
  table: string,
  rows: unknown,
  opts?: { onConflict?: string; ignoreDuplicates?: boolean },
): Promise<T[]> {
  const prefer = [
    "return=representation",
    opts?.ignoreDuplicates ? "resolution=ignore-duplicates" : null,
  ]
    .filter(Boolean)
    .join(",");
  const q = opts?.onConflict ? `?on_conflict=${encodeURIComponent(opts.onConflict)}` : "";
  return request<T[]>(`${table}${q}`, { method: "POST", body: rows, prefer });
}

/** UPSERT on a conflict target, returning the resulting row(s). */
export function sbUpsert<T>(table: string, rows: unknown, onConflict: string): Promise<T[]> {
  return request<T[]>(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    body: rows,
    prefer: "return=representation,resolution=merge-duplicates",
  });
}

/** UPDATE rows matching `query`, returning the updated row(s). */
export function sbUpdate<T>(table: string, query: string, patch: unknown): Promise<T[]> {
  return request<T[]>(`${table}?${query}`, {
    method: "PATCH",
    body: patch,
    prefer: "return=representation",
  });
}

/** DELETE rows matching `query`. */
export async function sbDelete(table: string, query: string): Promise<void> {
  await request<unknown>(`${table}?${query}`, { method: "DELETE" });
}
