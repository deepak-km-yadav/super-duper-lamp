/**
 * Drives api/bot-chat.ts against a stubbed Supabase and provider, so the
 * capture path can be asserted without a live project.
 */
import handler from "../api/bot-chat";

type Options = {
  admin: boolean;
  message: string;
  /** When set, the leads insert responds with this error. */
  failLeads?: string;
  agentActions?: string[];
};

export type CaptureResult = {
  calls: { method: string; url: string; body: Record<string, unknown> | undefined }[];
  sessionCreated: boolean;
  sessionRow?: Record<string, unknown>;
  leadRow?: Record<string, unknown>;
  captureError?: string;
  streamed: string;
};

export async function captureTurn(opts: Options): Promise<CaptureResult> {
  const calls: CaptureResult["calls"] = [];
  const original = globalThis.fetch;

  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    // The provider call, not Supabase.
    if (u.includes("/chat/completions") || u.includes("api.anthropic.com")) {
      const frame = `data: ${JSON.stringify({ choices: [{ delta: { content: "hi" } }] })}\n\ndata: [DONE]\n\n`;
      return {
        ok: true,
        status: 200,
        body: {
          getReader() {
            let done = false;
            return {
              async read() {
                if (done) return { done: true, value: undefined };
                done = true;
                return { done: false, value: new TextEncoder().encode(frame) };
              },
              releaseLock() {},
            };
          },
        },
      } as unknown as Response;
    }

    const path = u.replace(/^.*\/rest\/v1\//, "");
    calls.push({ method, url: path, body });

    const json = (payload: unknown, status = 200) =>
      ({
        ok: status < 400,
        status,
        text: async () => JSON.stringify(payload),
        headers: { get: () => null },
      }) as unknown as Response;

    if (path.startsWith("bots")) {
      return json([
        {
          id: "b1", slug: "s", name: "B", status: "PUBLISHED", system_prompt: "sys",
          provider_id: "openai", model_id: "gpt-4o", temperature: 0.7, max_tokens: 100,
          top_p: 1, allowed_domains: [], agent_enabled: true,
          agent_actions: opts.agentActions ?? ["lead_magnet", "scheduler"],
          daily_message_cap: 0,
        },
      ]);
    }
    if (path.startsWith("provider_keys")) return json([{ api_key: "sk-test" }]);
    if (path.startsWith("knowledge_docs")) return json([]);
    if (path.startsWith("chat_sessions")) {
      if (method === "POST") return json([{ id: "sess-1" }]);
      return json([]);
    }
    if (path.startsWith("leads") && method === "POST" && opts.failLeads) {
      return json({ code: "42501", message: opts.failLeads }, 401);
    }
    return json([]);
  };

  let streamed = "";
  let captureError: string | undefined;
  try {
    const res = await handler(
      new Request("https://app.test/api/bot-chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(opts.admin ? { "x-admin-token": "admin-secret-token" } : {}),
        },
        body: JSON.stringify({ slug: "s", messages: [{ role: "user", content: opts.message }] }),
      }),
    );
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      const ev = JSON.parse(raw);
      if (ev.t === "delta") streamed += ev.v;
      if (ev.t === "meta" && ev.captureError) captureError = ev.captureError;
    }
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = original;
  }

  const sessionInsert = calls.find((c) => c.url.startsWith("chat_sessions") && c.method === "POST");
  const leadInsert = calls.find((c) => c.url.startsWith("leads") && c.method === "POST");

  return {
    calls,
    sessionCreated: Boolean(sessionInsert),
    sessionRow: sessionInsert?.body,
    leadRow: leadInsert?.body,
    captureError,
    streamed,
  };
}
