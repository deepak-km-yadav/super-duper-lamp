/**
 * Public read of a single bot by slug, for the visitor-facing chat page.
 *
 * Returns only presentation fields. systemPrompt, knowledge, providerId,
 * modelId and the sampling settings are deliberately absent: the whole point
 * of routing chat through api/bot-chat.ts is that the browser never sees them.
 */

import { sbSelectOne, SupabaseError } from "./_lib/supabase.js";
import { rowToBot, PUBLIC_BOT_COLUMNS } from "./_lib/bot.js";
import { applyCors, queryParam, type ApiRequest, type ApiResponse } from "./_lib/http.js";

type PublicRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  [k: string]: unknown;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, "GET");
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const slug = queryParam(req, "slug");
  if (!slug) return res.status(400).json({ error: "slug is required" });

  try {
    const row = await sbSelectOne<PublicRow>(
      "bots",
      `select=${PUBLIC_BOT_COLUMNS}&slug=eq.${encodeURIComponent(slug)}`,
    );

    if (!row) return res.status(404).json({ unavailable: "missing" });

    if (row.status !== "PUBLISHED") {
      // Name only, so the paused screen can say which bot it was.
      return res.status(200).json({ unavailable: "unpublished", name: row.name });
    }

    const bot = rowToBot(row) as Record<string, unknown>;
    delete bot.status;
    return res.status(200).json({ bot });
  } catch (e) {
    const err = e as SupabaseError;
    return res
      .status(typeof err.status === "number" ? err.status : 500)
      .json({ error: err.message || "Failed to load bot" });
  }
}
