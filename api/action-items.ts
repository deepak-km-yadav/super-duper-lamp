/**
 * Leads and meeting requests captured by bots with "Act as an Agent" on.
 * Admin token required -- these rows hold real names, addresses and numbers.
 */

import { sbSelect, sbSelectOne, sbUpdate, SupabaseError } from "./_lib/supabase.js";
import { isAdminToken, isAdminConfigured, ADMIN_HEADER } from "./_lib/auth.js";
import {
  applyCors,
  header,
  jsonBody,
  queryParam,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http.js";

type LeadRow = {
  id: number;
  bot_id: string | null;
  session_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  intent: string | null;
  summary: string | null;
  context_snippet: string;
  status: string;
  detected_by: string;
  created_at: string;
};

type MeetingRow = {
  id: number;
  bot_id: string | null;
  session_id: string | null;
  name: string | null;
  email: string | null;
  requested_for_text: string | null;
  timezone: string | null;
  topic: string | null;
  context_snippet: string;
  status: string;
  created_at: string;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(res, "GET, PATCH");
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
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "PATCH") return await handlePatch(req, res);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const err = e as SupabaseError;
    return res
      .status(typeof err.status === "number" ? err.status : 500)
      .json({ error: err.message || "Request failed" });
  }
}

async function handleGet(req: ApiRequest, res: ApiResponse) {
  const limitRaw = Number(queryParam(req, "limit") || "200");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 200;
  const botId = queryParam(req, "botId");
  const sessionId = queryParam(req, "sessionId");

  // Full transcript for the "see the conversation" drawer.
  if (sessionId) {
    const messages = await sbSelect<{ role: string; content: string; created_at: string }>(
      "chat_messages",
      `select=role,content,created_at&session_id=eq.${sessionId}&order=created_at.asc&limit=200`,
    );
    return res.status(200).json({ messages });
  }

  const botFilter = botId ? `&bot_id=eq.${encodeURIComponent(botId)}` : "";

  const [leads, meetings, bots] = await Promise.all([
    sbSelect<LeadRow>(
      "leads",
      `select=*${botFilter}&order=created_at.desc&limit=${limit}`,
    ),
    sbSelect<MeetingRow>(
      "meeting_requests",
      `select=*${botFilter}&order=created_at.desc&limit=${limit}`,
    ),
    sbSelect<{ id: string; name: string }>("bots", "select=id,name"),
  ]);

  const botNames: Record<string, string> = {};
  for (const b of bots) botNames[b.id] = b.name;

  return res.status(200).json({
    leads: leads.map((l) => ({
      id: l.id,
      botId: l.bot_id,
      botName: l.bot_id ? (botNames[l.bot_id] ?? "Deleted bot") : "Unknown bot",
      sessionId: l.session_id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      company: l.company,
      intent: l.intent,
      summary: l.summary,
      contextSnippet: l.context_snippet,
      status: l.status,
      detectedBy: l.detected_by,
      createdAt: l.created_at,
    })),
    meetings: meetings.map((m) => ({
      id: m.id,
      botId: m.bot_id,
      botName: m.bot_id ? (botNames[m.bot_id] ?? "Deleted bot") : "Unknown bot",
      sessionId: m.session_id,
      name: m.name,
      email: m.email,
      requestedFor: m.requested_for_text,
      timezone: m.timezone,
      topic: m.topic,
      contextSnippet: m.context_snippet,
      status: m.status,
      createdAt: m.created_at,
    })),
  });
}

const LEAD_STATUSES = new Set(["NEW", "CONTACTED", "DONE", "SPAM"]);
const MEETING_STATUSES = new Set(["NEW", "SCHEDULED", "DECLINED", "DONE"]);

async function handlePatch(req: ApiRequest, res: ApiResponse) {
  const body = jsonBody(req);
  const kind = String(body.kind || "");
  const id = Number(body.id);
  const status = String(body.status || "");

  if (kind !== "lead" && kind !== "meeting") {
    return res.status(400).json({ error: "kind must be 'lead' or 'meeting'" });
  }
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id is required" });

  const allowed = kind === "lead" ? LEAD_STATUSES : MEETING_STATUSES;
  if (!allowed.has(status)) {
    return res
      .status(400)
      .json({ error: `status must be one of: ${[...allowed].join(", ")}` });
  }

  const table = kind === "lead" ? "leads" : "meeting_requests";
  const existing = await sbSelectOne<{ id: number }>(table, `select=id&id=eq.${id}`);
  if (!existing) return res.status(404).json({ error: "Not found" });

  await sbUpdate(table, `id=eq.${id}`, { status });
  return res.status(200).json({ ok: true });
}
