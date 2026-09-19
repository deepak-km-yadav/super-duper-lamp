/**
 * Setup diagnostics.
 *
 * Without this, a misconfigured deploy is hard to tell apart from a broken one:
 * a missing env var, an unapplied migration and an anon key used in place of
 * the service role key all surface in the UI as an empty or failing dashboard.
 *
 * Unauthenticated, it reports only that the serverless runtime is alive -- which
 * is itself the answer when /api is returning HTML. With a valid admin token it
 * reports which variables are set (never their values) and whether the database
 * actually answers.
 */

import { applyCors, header, type ApiRequest, type ApiResponse } from "./_lib/http";
import { isAdminToken, isAdminConfigured, ADMIN_HEADER } from "./_lib/auth";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type TableCheck = { ok: boolean; detail: string };

async function checkTable(table: string): Promise<TableCheck> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=0`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (res.ok) return { ok: true, detail: "reachable" };

    const body = await res.text();
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        detail:
          "Supabase rejected the key. Check that SUPABASE_SERVICE_ROLE_KEY is the " +
          "service_role (secret) key, not the anon/publishable one.",
      };
    }
    if (/does not exist|PGRST205|PGRST202/i.test(body)) {
      return {
        ok: false,
        detail:
          `Table "${table}" is missing. Run supabase/migrations/0001_botforge.sql ` +
          "in the Supabase SQL editor.",
      };
    }
    return { ok: false, detail: `Supabase returned ${res.status}: ${body.slice(0, 200)}` };
  } catch (e) {
    return {
      ok: false,
      detail:
        "Could not reach Supabase. Check SUPABASE_URL — it should be the bare project " +
        `URL with no trailing slash and no /rest/v1 suffix. (${
          e instanceof Error ? e.message : "network error"
        })`,
    };
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, "GET");
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Reaching this at all proves the serverless runtime is serving /api.
  if (!isAdminToken(header(req, ADMIN_HEADER))) {
    return res.status(200).json({
      api: "ok",
      detail: "Serverless functions are running. Send x-admin-token for configuration detail.",
    });
  }

  const env = {
    SUPABASE_URL: Boolean(SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(SERVICE_KEY),
    BOTFORGE_ADMIN_TOKEN: isAdminConfigured(),
    DETECTION_API_KEY: Boolean(process.env.DETECTION_API_KEY),
    VISITOR_IP_SALT: Boolean(process.env.VISITOR_IP_SALT),
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
  };

  const warnings: string[] = [];
  if (SUPABASE_URL.endsWith("/")) {
    warnings.push("SUPABASE_URL has a trailing slash; remove it.");
  }
  if (/\/rest\/v1/.test(SUPABASE_URL)) {
    warnings.push("SUPABASE_URL should be the bare project URL, without /rest/v1.");
  }
  if (!env.DETECTION_API_KEY) {
    warnings.push(
      "DETECTION_API_KEY is unset: leads are still captured by the regex pass, but " +
        "names, intent and dates will not be filled in.",
    );
  }

  const tables =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? {
          bots: await checkTable("bots"),
          leads: await checkTable("leads"),
          provider_keys: await checkTable("provider_keys"),
        }
      : null;

  const ready =
    env.SUPABASE_URL &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    env.BOTFORGE_ADMIN_TOKEN &&
    Boolean(tables && Object.values(tables).every((t) => t.ok));

  return res.status(200).json({ api: "ok", ready, env, tables, warnings });
}
