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
  | { t: "usage"; in?: number; out?: number }
  | { t: "stop"; reason: string };

/**
 * Reasoning models spend part of their token budget thinking, and that
 * thinking counts against max_completion_tokens. At the old 1024 default a
 * single reasoning-heavy turn could consume the whole allowance and return no
 * visible text at all, which surfaced as an empty chat bubble with no error.
 */
export const REASONING_TOKEN_FLOOR = 4096;

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

/**
 * Which request shape a model accepts.
 *
 * OpenAI's reasoning-era families reject `max_tokens` in favour of
 * `max_completion_tokens`, and accept only the default `temperature` and
 * `top_p`. That split is specific to OpenAI: sending `max_completion_tokens`
 * to Groq, Mistral, DeepSeek or Together would break those instead, so the
 * rule is scoped to that one provider.
 *
 * Matching on the family prefix rather than a list of exact ids means new
 * members of the o-series and gpt-5 line keep working without an edit here.
 * Anything this does not know about is caught by the retry in
 * `streamOpenAICompat`.
 */
export type ChatCapabilities = {
  tokenParam: "max_tokens" | "max_completion_tokens";
  sampling: boolean;
};

export function capabilitiesFor(providerId: string, modelId: string): ChatCapabilities {
  if (providerId !== "openai") {
    return { tokenParam: "max_tokens", sampling: true };
  }
  const id = modelId.toLowerCase();
  const reasoning = /^o\d/.test(id) || /^gpt-5/.test(id);
  return reasoning
    ? { tokenParam: "max_completion_tokens", sampling: false }
    : { tokenParam: "max_tokens", sampling: true };
}

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

/**
 * One non-streaming completion, for the background work: extraction and the
 * rolling conversation summary.
 *
 * Shares capabilitiesFor() with the streaming path, so it inherits the
 * reasoning-model token parameter and floor rather than repeating them.
 * Returns null instead of throwing -- every caller is a background improvement
 * that must not break a conversation.
 */
export async function completeOnce(
  cfg: ProviderConfig,
  prompt: string,
  maxTokens = 1024,
): Promise<string | null> {
  try {
    if (cfg.providerId === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: cfg.modelId,
          max_tokens: maxTokens,
          ...(cfg.systemPrompt ? { system: cfg.systemPrompt } : {}),
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { content?: { type: string; text?: string }[] };
      return body.content?.find((b) => b.type === "text")?.text ?? null;
    }

    const baseUrl = baseUrlFor(cfg.providerId);
    if (!baseUrl) return null;

    const caps = capabilitiesFor(cfg.providerId, cfg.modelId);
    const budget = caps.sampling ? maxTokens : Math.max(maxTokens, REASONING_TOKEN_FLOOR);

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.providerId === "ollama" ? "ollama" : cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.modelId,
        messages: [
          ...(cfg.systemPrompt ? [{ role: "system", content: cfg.systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        [caps.tokenParam]: budget,
        ...(caps.sampling ? { temperature: 0 } : {}),
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
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
      const delta = ev.delta as { stop_reason?: string } | undefined;
      if (delta?.stop_reason) return { t: "stop", reason: delta.stop_reason };
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

  const caps = capabilitiesFor(cfg.providerId, cfg.modelId);
  const requested = cfg.maxTokens ?? 1024;
  // A reasoning model needs headroom for its own thinking before it can emit
  // anything at all, so never send it less than the floor.
  const tokenBudget = caps.sampling ? requested : Math.max(requested, REASONING_TOKEN_FLOOR);

  const body: Record<string, unknown> = {
    model: cfg.modelId,
    messages: allMessages,
    stream: true,
    [caps.tokenParam]: tokenBudget,
    // OpenAI-compatible providers omit usage from a stream unless asked, which
    // is why token counts were empty for every provider except Anthropic.
    stream_options: { include_usage: true },
    ...(caps.sampling
      ? { temperature: cfg.temperature ?? 0.7, top_p: cfg.topP ?? 1 }
      : {}),
  };

  const send = (payload: Record<string, unknown>) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.providerId === "ollama" ? "ollama" : cfg.apiKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
      signal,
    });

  let res = await send(body);

  // The capability table above cannot stay ahead of every provider. When one
  // rejects a parameter it names the parameter, and often the replacement, so
  // take it at its word and try once more. This happens before any bytes are
  // yielded, so the stream is unaffected.
  if (res.status === 400) {
    const raw = await res.text();
    const repaired = repairBody(body, raw);
    if (repaired) {
      res = await send(repaired);
    } else {
      throw providerErrorFromBody(raw, res.status, cfg.providerId);
    }
  }

  if (!res.ok) throw await providerError(res, cfg.providerId);

  yield* parseSse(res, signal, (chunk) => {
    const choices = chunk.choices as
      | { delta?: { content?: string }; finish_reason?: string | null }[]
      | undefined;
    const text = choices?.[0]?.delta?.content;
    if (typeof text === "string" && text) return { t: "delta", v: text };

    const finish = choices?.[0]?.finish_reason;
    if (finish) return { t: "stop", reason: finish };

    const usage = chunk.usage as
      | { prompt_tokens?: number; completion_tokens?: number }
      | undefined;
    if (usage) return { t: "usage", in: usage.prompt_tokens, out: usage.completion_tokens };
    return null;
  });
}

/**
 * Rewrites a request body from a provider's own complaint about it.
 *
 * Returns null when the error names no parameter we can act on, so a genuine
 * failure is never retried or masked.
 */
export function repairBody(
  body: Record<string, unknown>,
  errorText: string,
): Record<string, unknown> | null {
  const named = /(?:unsupported|unknown|unrecognized|invalid)[^'"`]*['"`]([a-z0-9_.]+)['"`]/i.exec(
    errorText,
  );
  const offending = named?.[1];
  if (!offending || !(offending in body)) return null;

  // "Use 'max_completion_tokens' instead" -- prefer the replacement it names.
  const suggested = /use\s+['"`]([a-z0-9_.]+)['"`]\s+instead/i.exec(errorText)?.[1];

  const next = { ...body };
  const value = next[offending];
  delete next[offending];
  if (suggested && !(suggested in next)) next[suggested] = value;

  return next;
}

function providerErrorFromBody(raw: string, status: number, label: string): ProviderError {
  let message = `${label} error (${status})`;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string };
    if (typeof parsed.error === "string") message = parsed.error;
    else if (parsed.error?.message) message = parsed.error.message;
  } catch {
    if (raw) message = raw.slice(0, 300);
  }
  return new ProviderError(message, 502);
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
