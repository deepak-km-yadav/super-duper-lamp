/**
 * Provider API key management. Admin token required.
 *
 * Keys are written here and read only by the chat proxy. A GET never returns a
 * key -- just which providers are configured and a masked hint -- so the value
 * cannot be recovered through the dashboard once saved.
 */

import { sbSelect, sbUpsert, sbDelete, SupabaseError } from "./_lib/supabase";
import { isAdminToken, isAdminConfigured, ADMIN_HEADER } from "./_lib/auth";
import {
  applyCors,
  header,
  jsonBody,
  queryParam,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http";

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, "GET, PUT, DELETE");
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });

  if (!isAdminConfigured()) {
    return res
      .status(503)
      .json({ error: "BOTFORGE_ADMIN_TOKEN is not configured on the server" });
  }
  if (!isAdminToken(header(req, ADMIN_HEADER))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const rows = await sbSelect<{ provider_id: string; key_hint: string }>(
        "provider_keys",
        "select=provider_id,key_hint&order=provider_id.asc",
      );
      return res.status(200).json({
        keys: rows.map((r) => ({ providerId: r.provider_id, hint: r.key_hint })),
      });
    }

    if (req.method === "PUT") {
      const body = jsonBody(req);
      const providerId = String(body.providerId || "").trim();
      const apiKey = String(body.apiKey || "").trim();
      if (!providerId) return res.status(400).json({ error: "providerId is required" });
      if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

      await sbUpsert(
        "provider_keys",
        { provider_id: providerId, api_key: apiKey, key_hint: maskKey(apiKey) },
        "provider_id",
      );
      return res.status(200).json({ providerId, hint: maskKey(apiKey) });
    }

    if (req.method === "DELETE") {
      const providerId = queryParam(req, "providerId");
      if (!providerId) return res.status(400).json({ error: "providerId is required" });
      await sbDelete("provider_keys", `provider_id=eq.${encodeURIComponent(providerId)}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const err = e as SupabaseError;
    return res
      .status(typeof err.status === "number" ? err.status : 500)
      .json({ error: err.message || "Request failed" });
  }
}
