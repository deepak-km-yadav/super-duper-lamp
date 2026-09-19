/**
 * Token usage, aggregated from what the providers actually reported.
 *
 * The Settings card used to read the browser's localStorage, so it only ever
 * covered chats from the device you happened to be sitting at and showed
 * nothing at all for real visitors. These numbers come from chat_messages,
 * which every conversation writes to regardless of who held it.
 */

import { sbSelect, SupabaseError } from "./_lib/supabase.js";
import { isAdminToken, isAdminConfigured, ADMIN_HEADER } from "./_lib/auth.js";
import {
  applyCors,
  header,
  queryParam,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http.js";

type Row = {
  bot_id: string;
  provider_id: string | null;
  model_id: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
};

type Bucket = {
  key: string;
  botId?: string;
  botName?: string;
  providerId?: string;
  modelId?: string;
  day?: string;
  promptTokens: number;
  completionTokens: number;
  messages: number;
};

const WINDOW_DAYS: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, all: 3650 };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, "GET");
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!isAdminConfigured()) {
    return res
      .status(503)
      .json({ error: "BOTFORGE_ADMIN_TOKEN is not configured on the server" });
  }
  if (!isAdminToken(header(req, ADMIN_HEADER))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const windowKey = queryParam(req, "window") || "30d";
    const days = WINDOW_DAYS[windowKey] ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [rows, bots] = await Promise.all([
      sbSelect<Row>(
        "chat_messages",
        "select=bot_id,provider_id,model_id,prompt_tokens,completion_tokens,created_at" +
          `&created_at=gte.${since}&order=created_at.desc&limit=10000`,
      ),
      sbSelect<{ id: string; name: string }>("bots", "select=id,name"),
    ]);

    const botNames: Record<string, string> = {};
    for (const b of bots) botNames[b.id] = b.name;

    const byBot = new Map<string, Bucket>();
    const byModel = new Map<string, Bucket>();
    const byDay = new Map<string, Bucket>();

    const add = (map: Map<string, Bucket>, key: string, seed: Partial<Bucket>, r: Row) => {
      const b =
        map.get(key) ??
        ({ key, promptTokens: 0, completionTokens: 0, messages: 0, ...seed } as Bucket);
      b.promptTokens += r.prompt_tokens ?? 0;
      b.completionTokens += r.completion_tokens ?? 0;
      b.messages += 1;
      map.set(key, b);
    };

    let promptTokens = 0;
    let completionTokens = 0;
    let reported = 0;

    for (const r of rows) {
      promptTokens += r.prompt_tokens ?? 0;
      completionTokens += r.completion_tokens ?? 0;
      if (r.prompt_tokens !== null || r.completion_tokens !== null) reported += 1;

      add(byBot, r.bot_id, { botId: r.bot_id, botName: botNames[r.bot_id] ?? "Deleted bot" }, r);

      const modelKey = `${r.provider_id ?? "unknown"}/${r.model_id ?? "unknown"}`;
      add(byModel, modelKey, {
        providerId: r.provider_id ?? "unknown",
        modelId: r.model_id ?? "unknown",
      }, r);

      const day = r.created_at.slice(0, 10);
      add(byDay, day, { day }, r);
    }

    const sortByTokens = (a: Bucket, b: Bucket) =>
      b.promptTokens + b.completionTokens - (a.promptTokens + a.completionTokens);

    return res.status(200).json({
      window: windowKey,
      totals: {
        promptTokens,
        completionTokens,
        messages: rows.length,
        // Providers only report usage when asked, and older rows predate that,
        // so say how much of this window actually carries numbers.
        messagesWithUsage: reported,
      },
      byBot: [...byBot.values()].sort(sortByTokens),
      byModel: [...byModel.values()].sort(sortByTokens),
      byDay: [...byDay.values()].sort((a, b) => (a.day ?? "").localeCompare(b.day ?? "")),
    });
  } catch (e) {
    const err = e as SupabaseError;
    return res
      .status(typeof err.status === "number" ? err.status : 500)
      .json({ error: err.message || "Could not load usage" });
  }
}
