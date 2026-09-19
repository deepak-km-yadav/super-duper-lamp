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
  extractLead,
  extractMeeting,
  buildTranscript,
  isExtractionConfigured,
} from "./_lib/extract.js";

type SessionRow = { id: string; bot_id: string; analyzed_at: string | null; is_test: boolean };
type BotRow = { id: string; agent_enabled: boolean; agent_actions: string[] };
type MessageRow = { role: string; content: string };

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
    `select=id,agent_enabled,agent_actions&id=eq.${botId}`,
  );
  if (!bot?.agent_enabled) return;

  const actions = Array.isArray(bot.agent_actions) ? bot.agent_actions : [];
  if (actions.length === 0) return;

  await sbUpdate("chat_sessions", `id=eq.${sessionId}`, {
    analyzed_at: new Date().toISOString(),
  });

  if (!isExtractionConfigured()) return;

  const messages = await sbSelect<MessageRow>(
    "chat_messages",
    `select=role,content&session_id=eq.${sessionId}&order=created_at.asc&limit=40`,
  );
  if (messages.length === 0) return;

  const transcript = buildTranscript(messages);
  const snippet = buildContextSnippet(messages);

  if (actions.includes("lead_magnet")) {
    await enrichLead(sessionId, botId, transcript, snippet, isTest);
  }
  if (actions.includes("scheduler")) {
    await enrichMeeting(sessionId, botId, transcript, snippet, isTest);
  }
}

async function enrichLead(
  sessionId: string,
  botId: string,
  transcript: string,
  snippet: string,
  isTest: boolean,
): Promise<void> {
  const extracted = await extractLead(transcript);
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
  sessionId: string,
  botId: string,
  transcript: string,
  snippet: string,
  isTest: boolean,
): Promise<void> {
  const extracted = await extractMeeting(transcript);
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
    context_snippet: snippet,
  };

  if (existing) {
    await sbUpdate("meeting_requests", `id=eq.${existing.id}`, payload);
  } else {
    await sbInsert("meeting_requests", { bot_id: botId, session_id: sessionId, is_test: isTest, ...payload });
  }
}
