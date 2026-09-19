/**
 * Hourly sweeper for sessions that were never enriched.
 *
 * api/chat-turn.ts is fired by the browser once a reply finishes. A visitor who
 * closes the tab mid-reply never sends it, so their captured lead would keep
 * whatever the regex pass managed on its own. This picks those up.
 *
 * Guarded by CRON_SECRET; Vercel sends it as a bearer token on scheduled runs.
 */

import { sbSelect, sbSelectOne, SupabaseError } from "./_lib/supabase.js";
import { applyCors, header, queryParam, type ApiRequest, type ApiResponse } from "./_lib/http.js";
import { analyzeSession, notifyPending } from "./chat-turn.js";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BATCH = 25;

type SessionRow = { id: string; bot_id: string; is_test: boolean };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, "GET, POST");
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });

  if (!CRON_SECRET) {
    return res.status(503).json({ error: "CRON_SECRET is not configured" });
  }
  const bearer = header(req, "authorization").replace(/^Bearer\s+/i, "");
  if (bearer !== CRON_SECRET && queryParam(req, "secret") !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Five minutes of grace, so a conversation still in progress is left alone.
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const sessions = await sbSelect<SessionRow>(
      "chat_sessions",
      `select=id,bot_id,is_test&analyzed_at=is.null&last_message_at=lt.${cutoff}` +
        `&order=last_message_at.asc&limit=${BATCH}`,
    );

    let analyzed = 0;
    for (const s of sessions) {
      try {
        await analyzeSession(s.id, s.bot_id, s.is_test);
        analyzed++;
      } catch {
        // One bad session must not stop the batch.
      }
    }

    // Captures whose notice never went out -- the visitor closed the tab
    // before /api/chat-turn fired, or a webhook was down at the time.
    let notified = 0;
    try {
      const pending = await sbSelect<{ bot_id: string }>(
        "leads",
        "select=bot_id&notified_at=is.null&limit=50",
      );
      const meetings = await sbSelect<{ bot_id: string }>(
        "meeting_requests",
        "select=bot_id&notified_at=is.null&limit=50",
      );
      const botIds = [...new Set([...pending, ...meetings].map((r) => r.bot_id))].filter(Boolean);

      for (const botId of botIds) {
        const bot = await sbSelectOne<Parameters<typeof notifyPending>[0]>(
          "bots",
          "select=id,name,agent_enabled,agent_actions,provider_id,model_id," +
            `notify_email,notify_webhook_url&id=eq.${botId}`,
        );
        if (!bot) continue;
        await notifyPending(bot, false);
        notified++;
      }
    } catch {
      // Reported as zero; the next sweep tries again.
    }

    return res.status(200).json({ scanned: sessions.length, analyzed, notified });
  } catch (e) {
    const err = e as SupabaseError;
    return res
      .status(typeof err.status === "number" ? err.status : 500)
      .json({ error: err.message || "Sweep failed" });
  }
}
