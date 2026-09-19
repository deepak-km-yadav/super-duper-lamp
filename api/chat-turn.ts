/**
 * Records a completed assistant turn and enriches anything the regex pass
 * captured while the reply was streaming.
 *
 * Called by the browser after the stream finishes, so none of this work sits on
 * the response path. Anything it misses -- a visitor who closed the tab mid
 * reply -- is picked up by api/detect-sweep.ts.
 */

import { sbSelect, sbSelectOne, sbInsert, sbUpdate, SupabaseError } from "./_lib/supabase.js";
import { applyCors, jsonBody, type ApiRequest, type ApiResponse } from "./_lib/http.js";
import { buildContextSnippet } from "./_lib/detect.js";
import {
  notifyCapture,
  shouldNotify,
  type CaptureNotification,
  type NotifyTargets,
} from "./_lib/notify.js";
import {
  extractLead,
  extractMeeting,
  buildTranscript,
  summariseConversation,
  extractionModelFor,
  type ExtractionModel,
} from "./_lib/extract.js";

type SessionRow = { id: string; bot_id: string; analyzed_at: string | null; is_test: boolean };
type BotRow = {
  id: string;
  name: string;
  agent_enabled: boolean;
  agent_actions: string[];
  provider_id: string;
  model_id: string;
  notify_email: string | null;
  notify_webhook_url: string | null;
};
type MessageRow = { id: number; role: string; content: string };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, "POST");
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = jsonBody(req);
  const sessionId = String(body.sessionId || "").trim();
  const assistant = String(body.assistant || "").trim();
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

  try {
    const session = await sbSelectOne<SessionRow>(
      "chat_sessions",
      `select=id,bot_id,analyzed_at,is_test&id=eq.${sessionId}`,
    );
    // An unknown session is not an error worth surfacing to a visitor.
    if (!session) return res.status(200).json({ ok: true });

    if (assistant) {
      await sbInsert("chat_messages", {
        session_id: session.id,
        bot_id: session.bot_id,
        role: "assistant",
        content: assistant.slice(0, 20000),
        // Usage is recorded here rather than only in the browser, so the
        // numbers survive a cleared cache and cover every visitor, not just
        // whoever happened to be at this device.
        prompt_tokens: num(body.promptTokens),
        completion_tokens: num(body.completionTokens),
        provider_id: body.providerId ? String(body.providerId) : null,
        model_id: body.modelId ? String(body.modelId) : null,
        latency_ms: num(body.latencyMs),
      });
    }

    await analyzeSession(session.id, session.bot_id, session.is_test);
    return res.status(200).json({ ok: true });
  } catch (e) {
    const err = e as SupabaseError;
    return res
      .status(typeof err.status === "number" ? err.status : 500)
      .json({ error: err.message || "Could not record that turn" });
  }
}

/**
 * Fills in what the regex pass could not read. Exported so the hourly sweeper
 * can run exactly the same logic over abandoned sessions.
 */
export async function analyzeSession(
  sessionId: string,
  botId: string,
  isTest = false,
): Promise<void> {
  const bot = await sbSelectOne<BotRow>(
    "bots",
    `select=id,name,agent_enabled,agent_actions,provider_id,model_id,notify_email,notify_webhook_url&id=eq.${botId}`,
  );
  if (!bot) return;

  // Resolve which model does the background work. A dedicated DETECTION_API_KEY
  // is preferred; without one, reuse the bot's own provider and stored key,
  // because requiring a second key meant no summaries at all.
  const model = extractionModelFor(await botOwnModel(bot));

  // The rolling summary runs for every bot, agent or not: it is what keeps the
  // live context small.
  await refreshSummary(sessionId, model);

  if (!bot.agent_enabled) return;
  const actions = Array.isArray(bot.agent_actions) ? bot.agent_actions : [];
  if (actions.length === 0) return;

  await sbUpdate("chat_sessions", `id=eq.${sessionId}`, {
    analyzed_at: new Date().toISOString(),
  });

  if (!model) return;

  const messages = await sbSelect<MessageRow>(
    "chat_messages",
    `select=id,role,content&session_id=eq.${sessionId}&order=created_at.asc&limit=40`,
  );
  if (messages.length === 0) return;

  const transcript = buildTranscript(messages);
  const snippet = buildContextSnippet(messages);

  if (actions.includes("lead_magnet")) {
    await enrichLead(model, sessionId, botId, transcript, snippet, isTest);
  }
  if (actions.includes("scheduler")) {
    await enrichMeeting(model, sessionId, botId, transcript, snippet, isTest);
  }

  // After enrichment, so the message carries a name and a summary rather than
  // a bare email address.
  await notifyPending(bot, isTest);
}

/**
 * Announces captures for this bot that have not been announced yet.
 *
 * Reached from both the post-reply pass and the hourly sweeper, so notified_at
 * is what guarantees exactly one notification per capture.
 */
export async function notifyPending(bot: BotRow, isTest: boolean): Promise<void> {
  const targets: NotifyTargets = {
    email: bot.notify_email?.trim() || null,
    webhookUrl: bot.notify_webhook_url?.trim() || null,
  };
  if (!targets.email && !targets.webhookUrl) return;

  try {
    const [leads, meetings] = await Promise.all([
      sbSelect<Record<string, unknown>>(
        "leads",
        `select=*&bot_id=eq.${bot.id}&notified_at=is.null&order=created_at.asc&limit=20`,
      ),
      sbSelect<Record<string, unknown>>(
        "meeting_requests",
        `select=*&bot_id=eq.${bot.id}&notified_at=is.null&order=created_at.asc&limit=20`,
      ),
    ]);

    for (const row of leads) await announce("lead", row, bot, targets, isTest);
    for (const row of meetings) await announce("meeting", row, bot, targets, isTest);
  } catch {
    // The capture itself is already saved; the sweeper retries the notice.
  }
}

async function announce(
  kind: "lead" | "meeting",
  row: Record<string, unknown>,
  bot: BotRow,
  targets: NotifyTargets,
  isTestFallback: boolean,
): Promise<void> {
  const table = kind === "lead" ? "leads" : "meeting_requests";
  const isTest = Boolean(row.is_test ?? isTestFallback);

  const notification: CaptureNotification = {
    kind,
    botId: bot.id,
    botName: bot.name,
    name: (row.name as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    requestedFor: kind === "meeting" ? ((row.requested_for_text as string) ?? null) : undefined,
    summary: (row.summary as string) ?? null,
    contextSnippet: (row.context_snippet as string) ?? "",
    sessionId: (row.session_id as string) ?? null,
    capturedAt: (row.created_at as string) ?? new Date().toISOString(),
  };

  // A test capture, or one with no way to reach the person, is marked as
  // handled so it is not reconsidered on every sweep.
  if (!shouldNotify(notification, isTest)) {
    await sbUpdate(table, `id=eq.${row.id}`, { notified_at: new Date().toISOString() });
    return;
  }

  const result = await notifyCapture(notification, targets);
  if (result.errors.length > 0) {
    console.error(`[notify] ${kind} ${row.id}: ${result.errors.join("; ")}`);
  }
  // Marked even on failure: a retry loop that mails on every sweep would be
  // worse than a missed notice, and the row is still in Action Items.
  await sbUpdate(table, `id=eq.${row.id}`, { notified_at: new Date().toISOString() });
}

/** The bot's own provider and stored key, for use when no dedicated key is set. */
async function botOwnModel(bot: BotRow): Promise<ExtractionModel | null> {
  try {
    const rows = await sbSelect<{ api_key: string }>(
      "provider_keys",
      `select=api_key&provider_id=eq.${encodeURIComponent(bot.provider_id)}&limit=1`,
    );
    const apiKey = rows[0]?.api_key;
    if (!apiKey) return null;
    return { providerId: bot.provider_id, modelId: bot.model_id, apiKey };
  } catch {
    return null;
  }
}

/**
 * Folds turns that have scrolled out of the live window into the session's
 * running summary.
 *
 * Runs after the reply has already streamed, so the visitor never waits on it.
 * LIVE_TURNS here must stay in step with api/bot-chat.ts.
 */
const LIVE_TURNS = 8;
const SUMMARY_TRIGGER = LIVE_TURNS + 4;

async function refreshSummary(sessionId: string, model: ExtractionModel | null): Promise<void> {
  if (!model) return;
  try {
    const session = await sbSelectOne<{
      summary: string | null;
      summary_through_message_id: number | null;
    }>("chat_sessions", `select=summary,summary_through_message_id&id=eq.${sessionId}`);
    if (!session) return;

    const all = await sbSelect<MessageRow>(
      "chat_messages",
      `select=id,role,content&session_id=eq.${sessionId}&order=id.asc&limit=200`,
    );
    // Nothing has scrolled out of the live window yet.
    if (all.length < SUMMARY_TRIGGER) return;

    const older = all.slice(0, -LIVE_TURNS);
    const through = session.summary_through_message_id ?? 0;
    const unseen = older.filter((m) => m.id > through);
    if (unseen.length === 0) return;

    const summary = await summariseConversation(
      model,
      buildTranscript(unseen),
      session.summary,
    );
    if (!summary) return;

    await sbUpdate("chat_sessions", `id=eq.${sessionId}`, {
      summary,
      summary_through_message_id: older[older.length - 1].id,
      summary_updated_at: new Date().toISOString(),
    });
  } catch {
    // The conversation still works with a stale or absent summary.
  }
}

async function enrichLead(
  model: ExtractionModel,
  sessionId: string,
  botId: string,
  transcript: string,
  snippet: string,
  isTest: boolean,
): Promise<void> {
  const extracted = await extractLead(model, transcript);
  if (!extracted) return;

  // A lead needs a way to reach the person; a name alone is not a lead.
  if (!extracted.email && !extracted.phone) return;

  const existing = await sbSelect<{ id: number; email: string | null }>(
    "leads",
    `select=id,email&session_id=eq.${sessionId}`,
  );

  // Prefer the row for the same address; otherwise adopt the single
  // provisional row the regex pass wrote before the reply streamed. If there
  // are several rows with different addresses, this is a genuinely new person.
  const wanted = (extracted.email ?? "").toLowerCase();
  const match =
    existing.find((l) => wanted && (l.email ?? "").toLowerCase() === wanted) ??
    (existing.length === 1 && !existing[0].email ? existing[0] : undefined);

  const payload = {
    name: extracted.name,
    email: extracted.email,
    phone: extracted.phone,
    company: extracted.company,
    intent: extracted.intent,
    summary: extracted.summary,
    context_snippet: snippet,
    detected_by: "hybrid",
  };

  if (match) {
    await sbUpdate("leads", `id=eq.${match.id}`, payload);
  } else {
    await sbInsert("leads", { bot_id: botId, session_id: sessionId, is_test: isTest, ...payload });
  }
}

async function enrichMeeting(
  model: ExtractionModel,
  sessionId: string,
  botId: string,
  transcript: string,
  snippet: string,
  isTest: boolean,
): Promise<void> {
  const extracted = await extractMeeting(model, transcript);
  if (!extracted?.isMeetingRequest) return;

  const existing = await sbSelectOne<{ id: number }>(
    "meeting_requests",
    `select=id&session_id=eq.${sessionId}&order=created_at.desc`,
  );

  const payload = {
    name: extracted.name,
    email: extracted.email,
    requested_for_text: extracted.requestedForText,
    timezone: extracted.timezone,
    topic: extracted.topic,
    summary: extracted.summary,
    context_snippet: snippet,
  };

  if (existing) {
    await sbUpdate("meeting_requests", `id=eq.${existing.id}`, payload);
  } else {
    await sbInsert("meeting_requests", { bot_id: botId, session_id: sessionId, is_test: isTest, ...payload });
  }
}
