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

import { applyCors, header, type ApiRequest, type ApiResponse } from "./_lib/http.js";
import { readEnv, readEnvUrl, describeFetchFailure } from "./_lib/env.js";
import {
  isAdminToken,
  isAdminConfigured,
  adminTokenLength,
  ADMIN_HEADER,
  ADMIN_TOKEN_VARIABLE,
} from "./_lib/auth.js";

const SUPABASE_URL = readEnvUrl(process.env.SUPABASE_URL);
const SERVICE_KEY = readEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

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
    return { ok: false, detail: describeFetchFailure(e, SUPABASE_URL) };
  }
}

/** Plain-language cause for a rejected or absent token. */
function rejectionHint(
  configured: boolean,
  suppliedLength: number,
  configuredLength: number,
): string {
  if (!configured) {
    return (
      "BOTFORGE_ADMIN_TOKEN is not set on this deployment. Add it in the Vercel " +
      "project settings, then redeploy -- environment changes do not apply to " +
      "deployments that already exist."
    );
  }
  if (suppliedLength === 0) {
    return "Send the token as an x-admin-token header to see configuration detail.";
  }
  if (suppliedLength !== configuredLength) {
    return (
      `The token sent is ${suppliedLength} characters but the configured one is ` +
      `${configuredLength}. Check for a trailing newline, a stray space, or ` +
      "surrounding quotes on either side."
    );
  }
  return (
    "The token sent is the right length but does not match. Confirm you copied " +
    "the value now set in Vercel, and that the deployment was rebuilt after it " +
    "was last changed."
  );
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, "GET");
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supplied = header(req, ADMIN_HEADER);

  // Reaching this at all proves the serverless runtime is serving /api.
  if (!isAdminToken(supplied)) {
    // Enough to name why a token was rejected, without helping guess one: a
    // variable name and two lengths. The full env/table detail stays behind a
    // valid token.
    const configured = isAdminConfigured();
    const configuredLength = adminTokenLength();
    const suppliedLength = supplied.trim().length;

    return res.status(200).json({
      api: "ok",
      adminConfigured: configured,
      adminSource: configured ? ADMIN_TOKEN_VARIABLE : null,
      ...(suppliedLength > 0 ? { configuredLength, suppliedLength } : {}),
      hint: rejectionHint(configured, suppliedLength, configuredLength),
    });
  }

  const env = {
    BOTFORGE_ADMIN_TOKEN: isAdminConfigured(),
    SUPABASE_URL: Boolean(SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(SERVICE_KEY),
    DETECTION_API_KEY: Boolean(process.env.DETECTION_API_KEY),
    VISITOR_IP_SALT: Boolean(process.env.VISITOR_IP_SALT),
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
  };

  // Compare against the raw value: the normalised one has already had these
  // corrected, so checking it would never report anything.
  const rawUrl = process.env.SUPABASE_URL || "";
  const warnings: string[] = [];
  if (rawUrl.trim() !== rawUrl) {
    warnings.push("SUPABASE_URL has leading or trailing whitespace (corrected automatically).");
  }
  if (/^["']|["']$/.test(rawUrl.trim())) {
    warnings.push("SUPABASE_URL is wrapped in quotes (corrected automatically).");
  }
  if (/\/$/.test(rawUrl.trim())) {
    warnings.push("SUPABASE_URL has a trailing slash (corrected automatically).");
  }
  if (/\/rest\/v1\/?$/.test(rawUrl.trim())) {
    warnings.push("SUPABASE_URL includes /rest/v1 (corrected automatically).");
  }
  if (SUPABASE_URL && !/^https?:\/\//i.test(SUPABASE_URL)) {
    warnings.push("SUPABASE_URL is missing the https:// prefix — this will fail.");
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
