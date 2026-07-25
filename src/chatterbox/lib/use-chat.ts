import * as React from "react";
import type { ChatMessage, KnowledgeDoc } from "./types";
import { loadApiKeys } from "./api-keys";
import { recordUsage } from "./usage-store";
import { getLocal } from "./local-store";

type OverrideConfig = {
  providerId: string;
  modelId: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  knowledge?: KnowledgeDoc[];
};

export type UsageStats = {
  latencyMs: number;
  chars: number;
  promptTokens?: number;
  completionTokens?: number;
};

export type UseChatOptions = {
  botId?: string;
  override?: OverrideConfig;
  initialMessages?: ChatMessage[];
};

// Providers using OpenAI-compatible /chat/completions SSE
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
  ollama: "http://localhost:11434/v1",
};

function buildSystemPrompt(systemPrompt: string, knowledge?: KnowledgeDoc[]): string {
  if (!knowledge?.length) return systemPrompt;
  const docs = knowledge.map((k) => `--- ${k.fileName} ---\n${k.content}`).join("\n\n");
  return systemPrompt + "\n\n<knowledge>\n" + docs + "\n</knowledge>";
}

async function streamLLM(
  config: OverrideConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
  onChunk: (text: string) => void,
): Promise<{ promptTokens?: number; completionTokens?: number }> {
  const { providerId, modelId, systemPrompt, temperature, maxTokens, topP, knowledge } = config;
  const apiKeys = loadApiKeys();
  const apiKey = apiKeys[providerId] ?? "";
  const fullSystem = buildSystemPrompt(systemPrompt, knowledge);

  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  if (providerId === "anthropic") {
    return streamAnthropic(apiKey, modelId, nonSystemMessages, fullSystem, { temperature, maxTokens }, signal, onChunk);
  }

  const baseUrl = OPENAI_COMPAT[providerId];
  if (baseUrl) {
    return streamOpenAICompat(baseUrl, apiKey, modelId, nonSystemMessages, fullSystem, { temperature, maxTokens, topP }, signal, onChunk, providerId);
  }

  throw new Error(`Unsupported provider: ${providerId}`);
}

async function streamAnthropic(
  apiKey: string,
  modelId: string,
  messages: ChatMessage[],
  systemPrompt: string,
  opts: { temperature?: number; maxTokens?: number },
  signal: AbortSignal,
  onChunk: (text: string) => void,
): Promise<{ promptTokens?: number; completionTokens?: number }> {
  if (!apiKey) throw new Error("Missing Anthropic API key. Add one in Settings.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: modelId,
      messages: messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ...(systemPrompt ? { system: systemPrompt } : {}),
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic error (${res.status})`);
  }

  return parseSseStream(res, signal, onChunk, (ev) => {
    if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
      return { text: ev.delta.text as string };
    }
    if (ev.type === "message_start" && ev.message?.usage) {
      return { promptTokens: ev.message.usage.input_tokens as number };
    }
    if (ev.type === "message_delta" && ev.usage) {
      return { completionTokens: ev.usage.output_tokens as number };
    }
    return {};
  });
}

async function streamOpenAICompat(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  messages: ChatMessage[],
  systemPrompt: string,
  opts: { temperature?: number; maxTokens?: number; topP?: number },
  signal: AbortSignal,
  onChunk: (text: string) => void,
  providerId?: string,
): Promise<{ promptTokens?: number; completionTokens?: number }> {
  const isOllama = providerId === "ollama";
  if (!apiKey && !isOllama) throw new Error(`Missing API key for ${providerId ?? "provider"}. Add one in Settings.`);

  const allMessages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...messages,
  ];

  const extraHeaders: Record<string, string> = {};
  if (providerId === "openrouter") {
    extraHeaders["HTTP-Referer"] = typeof window !== "undefined" ? window.location.origin : "";
    extraHeaders["X-Title"] = "UCB Chatterbox";
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${isOllama ? "ollama" : apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: modelId,
      messages: allMessages,
      stream: true,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      top_p: opts.topP ?? 1,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.error || `${providerId} error (${res.status})`);
  }

  return parseSseStream(res, signal, onChunk, (chunk) => {
    const text = chunk.choices?.[0]?.delta?.content;
    const usage = chunk.usage;
    return {
      text: typeof text === "string" ? text : undefined,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
    };
  });
}

async function parseSseStream(
  res: Response,
  signal: AbortSignal,
  onChunk: (text: string) => void,
  parse: (data: Record<string, unknown>) => { text?: string; promptTokens?: number; completionTokens?: number },
): Promise<{ promptTokens?: number; completionTokens?: number }> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;

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
        try {
          const parsed = parse(JSON.parse(raw) as Record<string, unknown>);
          if (parsed.text) onChunk(parsed.text);
          if (parsed.promptTokens !== undefined) promptTokens = (promptTokens ?? 0) + parsed.promptTokens;
          if (parsed.completionTokens !== undefined) completionTokens = (completionTokens ?? 0) + parsed.completionTokens;
        } catch {
          // skip malformed SSE frames
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { promptTokens, completionTokens };
}

export function useChat(opts: UseChatOptions) {
  const { initialMessages = [], botId, override } = opts;
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<UsageStats | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const optsRef = React.useRef({ botId, override });
  React.useEffect(() => {
    optsRef.current = { botId, override };
  }, [botId, override]);

  const send = React.useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      const next = [...messages, userMsg];
      setMessages([...next, { role: "assistant", content: "" }]);
      setIsStreaming(true);
      setError(null);
      setStats(null);

      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = performance.now();

      let acc = "";
      let promptTokens: number | undefined;
      let completionTokens: number | undefined;

      try {
        const { botId: currentBotId, override: currentOverride } = optsRef.current;

        let config: OverrideConfig;
        if (currentOverride) {
          config = currentOverride;
        } else if (currentBotId) {
          const bot = getLocal(currentBotId);
          if (!bot) throw new Error("Bot not found in local storage.");
          config = {
            providerId: bot.providerId,
            modelId: bot.modelId,
            systemPrompt: bot.systemPrompt,
            temperature: bot.temperature,
            maxTokens: bot.maxTokens,
            topP: bot.topP,
            knowledge: bot.knowledge,
          };
        } else {
          throw new Error("No bot config provided.");
        }

        const result = await streamLLM(
          config,
          next,
          controller.signal,
          (chunk) => {
            if (controller.signal.aborted) return;
            acc += chunk;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: acc };
              }
              return copy;
            });
          },
        );

        promptTokens = result.promptTokens;
        completionTokens = result.completionTokens;

        const latencyMs = Math.round(performance.now() - startedAt);
        setStats({ latencyMs, chars: acc.length, promptTokens, completionTokens });

        if ((promptTokens || completionTokens) && currentBotId) {
          const cfg = currentOverride ?? config;
          recordUsage({
            botId: currentBotId,
            providerId: cfg.providerId,
            modelId: cfg.modelId,
            promptTokens: promptTokens ?? 0,
            completionTokens: completionTokens ?? 0,
          });
        }
      } catch (e: unknown) {
        if ((e as Error)?.name === "AbortError") return;
        setError((e as Error)?.message ?? "Request failed");
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && !last.content) copy.pop();
          return copy;
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const regenerate = React.useCallback(() => {
    if (messages.length < 2) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = messages.lastIndexOf(lastUser);
    const trimmed = messages.slice(0, idx);
    setMessages(trimmed);
    setTimeout(() => send(lastUser.content), 0);
  }, [messages, send]);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    setMessages(initialMessages);
    setError(null);
    setStats(null);
  }, [initialMessages]);

  return { messages, send, stop, regenerate, reset, isStreaming, error, stats };
}
