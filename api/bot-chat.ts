/**
 * The chat proxy. This is what makes publishing, iframes and share links
 * actually work.
 *
 * Previously the browser called the provider directly with a key from
 * localStorage, so an embedded bot only ever replied for its own author.
 * Here the bot config and the provider key are resolved server-side and only
 * normalized SSE events go back to the visitor.
 *
 * Runs on the Edge runtime: the project's hand-rolled Res type (status().json())
 * cannot stream, and Edge is the reliable streaming path on Vercel. It must
 * therefore share no code with api/chat.ts, which reads files via node:fs.
 */

import {
  streamLLM,
  buildSystemPrompt,
  knownProvider,
  ProviderError,
  type ChatTurn,
  type ProviderConfig,
} from "./_lib/llm-stream";
import { detectSignals, hasLeadSignal, buildContextSnippet } from "./_lib/detect";
import { isAdminToken } from "./_lib/auth";

export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const IP_SALT = process.env.VISITOR_IP_SALT || "botforge";

const MAX_MESSAGES = 60;
const MAX_CHARS = 8000;

type BotRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  system_prompt: string;
  provider_id: string;
  model_id: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  allowed_domains: string[];
  agent_enabled: boolean;
  agent_actions: string[];
  daily_message_cap: number;
};

function sb(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

async function sbJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await sb(path, init);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Supabase error ${res.status}`);
  return (text ? JSON.parse(text) : null) as T;
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  // Echo the matched origin when the bot restricts domains; otherwise allow any
  // site to embed, which is the default for a public bot.
  const value = allowed.length === 0 ? "*" : (origin ?? "");
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
    Vary: "Origin",
  };
}

function hostOf(value: string | null): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function domainAllowed(origin: string | null, referer: string | null, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const host = hostOf(origin) || hostOf(referer);
  if (!host) return false;
  return allowed.some((raw) => {
    const d = raw.trim().toLowerCase().replace(/^\*\./, "");
    if (!d) return false;
    return host === d || host.endsWith(`.${d}`);
  });
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}${IP_SALT}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin, []) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders(origin, []));
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Server is not configured" }, 503, corsHeaders(origin, []));
  }

  let body: {
    slug?: string;
    messages?: ChatTurn[];
    sessionId?: string;
    draft?: Partial<ProviderConfig>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, corsHeaders(origin, []));
  }

  const slug = String(body.slug || "").trim();
  if (!slug) return json({ error: "slug is required" }, 400, corsHeaders(origin, []));

  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0) {
    return json({ error: "messages is required" }, 400, corsHeaders(origin, []));
  }

  const isAdmin = isAdminToken(req.headers.get("x-admin-token"));

  let bot: BotRow | null;
  try {
    const rows = await sbJson<BotRow[]>(
      `bots?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    );
    bot = rows?.[0] ?? null;
  } catch {
    return json({ error: "Could not load this bot" }, 502, corsHeaders(origin, []));
  }
  if (!bot) return json({ error: "Bot not found" }, 404, corsHeaders(origin, []));

  const allowed = Array.isArray(bot.allowed_domains) ? bot.allowed_domains : [];
  const cors = corsHeaders(origin, allowed);

  // An unpublished bot is still testable by its owner, never by a visitor.
  if (!isAdmin && bot.status !== "PUBLISHED") {
    return json({ error: "This bot is not published", reason: "unpublished" }, 409, cors);
  }
  if (!isAdmin && !domainAllowed(origin, req.headers.get("referer"), allowed)) {
    return json({ error: "This bot is not embeddable on this domain" }, 403, cors);
  }

  // Draft overrides let the editor's Test panel exercise unsaved edits without
  // any provider key reaching the browser. Admin only.
  const draft = isAdmin && body.draft ? body.draft : undefined;
  const providerId = String(draft?.providerId || bot.provider_id);
  const modelId = String(draft?.modelId || bot.model_id);

  if (!knownProvider(providerId)) {
    return json({ error: `Unsupported provider: ${providerId}` }, 400, cors);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = await hashIp(ip);

  // This endpoint spends the bot owner's money, so cap it before calling out.
  if (!isAdmin) {
    const overCap = await overDailyCap(bot.id, bot.daily_message_cap);
    if (overCap) {
      return json(
        { error: "This bot has reached its daily message limit. Try again tomorrow." },
        429,
        cors,
      );
    }
  }

  let apiKey = "";
  if (providerId !== "ollama") {
    try {
      const keys = await sbJson<{ api_key: string }[]>(
        `provider_keys?select=api_key&provider_id=eq.${encodeURIComponent(providerId)}&limit=1`,
      );
      apiKey = keys?.[0]?.api_key ?? "";
    } catch {
      return json({ error: "Could not resolve the provider key" }, 502, cors);
    }
    if (!apiKey) {
      return json(
        {
          error: `This bot has no ${providerId} API key configured. Its owner needs to add one in Settings.`,
        },
        503,
        cors,
      );
    }
  }

  const knowledge = await loadKnowledge(bot.id);
  const systemPrompt = buildSystemPrompt(
    agentInstructions(
      String(draft?.systemPrompt ?? bot.system_prompt),
      bot.agent_enabled,
      bot.agent_actions,
    ),
    knowledge,
  );

  const cfg: ProviderConfig = {
    providerId,
    modelId,
    apiKey,
    systemPrompt,
    temperature: draft?.temperature ?? bot.temperature,
    maxTokens: draft?.maxTokens ?? bot.max_tokens,
    topP: draft?.topP ?? bot.top_p,
  };

  // Session + the visitor's turn are recorded before streaming, so a lead
  // survives even if the visitor closes the tab mid-reply.
  const sessionId = isAdmin ? null : await ensureSession(bot.id, body.sessionId, req, ipHash);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const signals = lastUser ? detectSignals(lastUser.content) : null;

  if (sessionId && lastUser) {
    await recordUserTurn(bot, sessionId, lastUser.content, signals, messages);
  }

  return streamResponse(cfg, messages, sessionId, cors);
}

function sanitizeMessages(input: unknown): ChatTurn[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m): m is ChatTurn =>
        Boolean(m) &&
        typeof (m as ChatTurn).content === "string" &&
        ((m as ChatTurn).role === "user" || (m as ChatTurn).role === "assistant"),
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .filter((m) => m.content.trim().length > 0)
    .slice(-MAX_MESSAGES);
}

/**
 * When "Act as an Agent" is on, nudge the bot to actually ask for the details
 * the enabled actions are meant to capture -- otherwise it only ever listens.
 */
function agentInstructions(
  systemPrompt: string,
  enabled: boolean,
  actions: string[],
): string {
  if (!enabled || !Array.isArray(actions) || actions.length === 0) return systemPrompt;

  const lines: string[] = [];
  if (actions.includes("lead_magnet")) {
    lines.push(
      "- When the conversation shows genuine interest, invite the person to leave " +
        "their name and email so someone can follow up. Ask once, naturally, and " +
        "never demand it or repeat the request if they decline.",
    );
  }
  if (actions.includes("scheduler")) {
    lines.push(
      "- If they want to meet, talk to someone, or see a demo, offer to note down " +
        "a meeting and ask which day and time suits them, plus an email to confirm to. " +
        "Never claim a meeting is confirmed or booked; say it has been passed on.",
    );
  }
  if (lines.length === 0) return systemPrompt;

  return `${systemPrompt}\n\n<agent_behaviour>\n${lines.join("\n")}\n</agent_behaviour>`;
}

async function loadKnowledge(botId: string): Promise<{ fileName: string; content: string }[]> {
  try {
    const rows = await sbJson<{ file_name: string; content: string }[]>(
      `knowledge_docs?select=file_name,content&bot_id=eq.${botId}&order=added_at.asc`,
    );
    return (rows ?? []).map((r) => ({ fileName: r.file_name, content: r.content }));
  } catch {
    return []; // knowledge is an enhancement; never fail the chat over it
  }
}

async function overDailyCap(botId: string, cap: number): Promise<boolean> {
  if (!cap || cap <= 0) return false;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await sb(
      `chat_messages?select=id&bot_id=eq.${botId}&role=eq.user&created_at=gte.${since}`,
      { headers: { Prefer: "count=exact", Range: "0-0" } },
    );
    const range = res.headers.get("content-range") || "";
    const total = Number(range.split("/")[1]);
    return Number.isFinite(total) && total >= cap;
  } catch {
    return false; // never block a legitimate chat because counting failed
  }
}

async function ensureSession(
  botId: string,
  sessionId: string | undefined,
  req: Request,
  ipHash: string,
): Promise<string | null> {
  try {
    if (sessionId) {
      const rows = await sbJson<{ id: string }[]>(
        `chat_sessions?select=id&id=eq.${sessionId}&bot_id=eq.${botId}&limit=1`,
      );
      if (rows?.[0]) return rows[0].id;
    }
    const created = await sbJson<{ id: string }[]>("chat_sessions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        bot_id: botId,
        visitor_ip_hash: ipHash,
        user_agent: (req.headers.get("user-agent") || "").slice(0, 400),
        referrer: (req.headers.get("referer") || "").slice(0, 400),
        origin: (req.headers.get("origin") || "").slice(0, 200),
      }),
    });
    return created?.[0]?.id ?? null;
  } catch {
    return null; // chat still works even if transcripts cannot be written
  }
}

async function recordUserTurn(
  bot: BotRow,
  sessionId: string,
  content: string,
  signals: ReturnType<typeof detectSignals> | null,
  messages: ChatTurn[],
): Promise<void> {
  try {
    await sb("chat_messages", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        bot_id: bot.id,
        role: "user",
        content,
        signals: signals
          ? { email: Boolean(signals.email), phone: Boolean(signals.phone), booking: signals.booking }
          : null,
      }),
    });

    await sb(`chat_sessions?id=eq.${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({ last_message_at: new Date().toISOString() }),
    });

    if (!bot.agent_enabled || !signals) return;
    const actions = Array.isArray(bot.agent_actions) ? bot.agent_actions : [];
    const snippet = buildContextSnippet(messages);

    // Provisional rows, written before the reply streams. The enrichment pass
    // in api/chat-turn.ts fills in the name and summary afterwards.
    if (actions.includes("lead_magnet") && hasLeadSignal(signals)) {
      await sb("leads", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          bot_id: bot.id,
          session_id: sessionId,
          email: signals.email,
          phone: signals.phone,
          context_snippet: snippet,
          detected_by: "regex",
        }),
      });
    }

    if (actions.includes("scheduler") && signals.booking) {
      await sb("meeting_requests", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          bot_id: bot.id,
          session_id: sessionId,
          email: signals.email,
          requested_for_text: content.slice(0, 200),
          context_snippet: snippet,
        }),
      });
    }
  } catch {
    // Capture is best effort -- it must never break the conversation.
  }
}

function streamResponse(
  cfg: ProviderConfig,
  messages: ChatTurn[],
  sessionId: string | null,
  cors: Record<string, string>,
): Response {
  const encoder = new TextEncoder();
  const controllerAbort = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        send({
          t: "meta",
          sessionId,
          providerId: cfg.providerId,
          modelId: cfg.modelId,
        });
        for await (const ev of streamLLM(cfg, messages, controllerAbort.signal)) {
          send(ev);
        }
      } catch (e) {
        const message =
          e instanceof ProviderError
            ? e.message
            : e instanceof Error
              ? e.message
              : "The bot could not reply.";
        send({ t: "error", message });
      } finally {
        send({ t: "done", sessionId });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
    cancel() {
      // Visitor hit stop or navigated away: stop paying the provider.
      controllerAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      ...cors,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Defeats intermediary buffering, the usual cause of a stream that
      // arrives all at once at the end.
      "X-Accel-Buffering": "no",
    },
  });
}
