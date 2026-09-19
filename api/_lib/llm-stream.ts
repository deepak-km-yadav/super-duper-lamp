/**
 * Provider streaming, moved server-side from src/chatterbox/lib/use-chat.ts.
 *
 * The browser used to call api.anthropic.com and friends directly with a key
 * out of localStorage. That is why embeds never worked: a visitor to someone
 * else's iframe has no key. Now the request is made here and only normalized
 * events reach the client.
 */

export type ChatRole = "user" | "assistant";
export type ChatTurn = { role: ChatRole; content: string };

export type ProviderConfig = {
  providerId: string;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
};

export type StreamEvent =
  | { t: "delta"; v: string }
  | { t: "usage"; in?: number; out?: number };

/** Providers exposing an OpenAI-compatible /chat/completions endpoint. */
const OPENAI_COMPAT: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  mistral: "https://api.mistral.ai/v1",
  groq: "https://api.groq.com/openai/v1",
  xai: "https://api.x.ai/v1",
  cohere: "https://api.cohere.com/compatibility/v1",
  perplexity: "https://api.perplexity.ai",
  deepseek: "https://api.deepseek.com/v1",
  together: "https://api.together.xyz/v1",
  openrouter: "https://openrouter.ai/api/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
};

export function knownProvider(providerId: string): boolean {
  return providerId === "anthropic" || providerId in OPENAI_COMPAT || providerId === "ollama";
}

function baseUrlFor(providerId: string): string | null {
  if (providerId === "ollama") {
    // Ollama runs on the user's own machine; a serverless function can only
    // reach it through a publicly routable URL the operator supplies.
    const base = (process.env.OLLAMA_BASE_URL || "").replace(/\/+$/, "");
    return base ? `${base}/v1` : null;
  }
  return OPENAI_COMPAT[providerId] ?? null;
}

export function buildSystemPrompt(
  systemPrompt: string,
  knowledge: { fileName: string; content: string }[],
): string {
  if (!knowledge.length) return systemPrompt;
  const docs = knowledge.map((k) => `--- ${k.fileName} ---\n${k.content}`).join("\n\n");
  return `${systemPrompt}\n\n<knowledge>\n${docs}\n</knowledge>`;
}

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

export async function* streamLLM(
  cfg: ProviderConfig,
  messages: ChatTurn[],
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  if (cfg.providerId === "anthropic") {
    yield* streamAnthropic(cfg, messages, signal);
    return;
  }

  const baseUrl = baseUrlFor(cfg.providerId);
  if (!baseUrl) {
    throw new ProviderError(
      cfg.providerId === "ollama"
        ? "Ollama is not reachable from the server. Set OLLAMA_BASE_URL to a public URL."
        : `Unsupported provider: ${cfg.providerId}`,
      400,
    );
  }
  yield* streamOpenAICompat(cfg, baseUrl, messages, signal);
}

async function* streamAnthropic(
  cfg: ProviderConfig,
  messages: ChatTurn[],
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.modelId,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(cfg.systemPrompt ? { system: cfg.systemPrompt } : {}),
      max_tokens: cfg.maxTokens ?? 1024,
      temperature: cfg.temperature ?? 0.7,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) throw await providerError(res, "Anthropic");

  yield* parseSse(res, signal, (ev) => {
    if (ev.type === "content_block_delta") {
      const delta = ev.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        return { t: "delta", v: delta.text };
      }
    }
    if (ev.type === "message_start") {
      const usage = (ev.message as { usage?: { input_tokens?: number } } | undefined)?.usage;
      if (usage?.input_tokens !== undefined) return { t: "usage", in: usage.input_tokens };
    }
    if (ev.type === "message_delta") {
      const usage = ev.usage as { output_tokens?: number } | undefined;
      if (usage?.output_tokens !== undefined) return { t: "usage", out: usage.output_tokens };
    }
    return null;
  });
}

async function* streamOpenAICompat(
  cfg: ProviderConfig,
  baseUrl: string,
  messages: ChatTurn[],
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const allMessages = [
    ...(cfg.systemPrompt ? [{ role: "system", content: cfg.systemPrompt }] : []),
    ...messages,
  ];

  const extraHeaders: Record<string, string> = {};
  if (cfg.providerId === "openrouter") {
    extraHeaders["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL || "";
    extraHeaders["X-Title"] = "BotForge";
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.providerId === "ollama" ? "ollama" : cfg.apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: cfg.modelId,
      messages: allMessages,
      stream: true,
      max_tokens: cfg.maxTokens ?? 1024,
      temperature: cfg.temperature ?? 0.7,
      top_p: cfg.topP ?? 1,
    }),
    signal,
  });

  if (!res.ok) throw await providerError(res, cfg.providerId);

  yield* parseSse(res, signal, (chunk) => {
    const choices = chunk.choices as { delta?: { content?: string } }[] | undefined;
    const text = choices?.[0]?.delta?.content;
    if (typeof text === "string" && text) return { t: "delta", v: text };
    const usage = chunk.usage as
      | { prompt_tokens?: number; completion_tokens?: number }
      | undefined;
    if (usage) return { t: "usage", in: usage.prompt_tokens, out: usage.completion_tokens };
    return null;
  });
}

async function providerError(res: Response, label: string): Promise<ProviderError> {
  let message = `${label} error (${res.status})`;
  try {
    const body = (await res.json()) as { error?: { message?: string } | string };
    if (typeof body.error === "string") message = body.error;
    else if (body.error?.message) message = body.error.message;
  } catch {
    // Keep the status-code message.
  }
  // Never surface a provider auth failure as the visitor's problem.
  if (res.status === 401 || res.status === 403) {
    return new ProviderError(
      "This bot's API key was rejected by the provider. The bot owner needs to update it.",
      502,
    );
  }
  if (res.status === 429) {
    return new ProviderError("This bot is being rate limited. Try again shortly.", 429);
  }
  return new ProviderError(message, 502);
}

async function* parseSse(
  res: Response,
  signal: AbortSignal,
  parse: (data: Record<string, unknown>) => StreamEvent | null,
): AsyncGenerator<StreamEvent> {
  const reader = res.body?.getReader();
  if (!reader) throw new ProviderError("Provider returned an empty response.", 502);

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        let parsed: StreamEvent | null = null;
        try {
          parsed = parse(JSON.parse(raw) as Record<string, unknown>);
        } catch {
          continue; // skip malformed frames
        }
        if (parsed) yield parsed;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
