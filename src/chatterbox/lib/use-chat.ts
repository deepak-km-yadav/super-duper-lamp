import * as React from "react";
import type { ChatMessage, MemoryMode } from "./types";

/**
 * Unsaved editor edits, sent so the Test panel can exercise a draft. Accepted
 * by the server only with a valid admin token, and it deliberately carries no
 * knowledge documents -- those are already stored server-side.
 */
export type DraftOverride = {
  providerId?: string;
  modelId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
};

export type UsageStats = {
  latencyMs: number;
  chars: number;
  promptTokens?: number;
  completionTokens?: number;
};

export type UseChatOptions = {
  /** Which published bot to talk to. */
  slug: string;
  /** Editor Test panel only: unsaved edits plus the admin token to authorize them. */
  draft?: DraftOverride;
  adminToken?: string;
  botId?: string;
  /** Decides whether a session id is remembered, and for how long. */
  memory?: MemoryMode;
  initialMessages?: ChatMessage[];
};

/**
 * Chat now goes through /api/bot-chat rather than straight to the provider.
 *
 * The old path read a provider key out of localStorage and called
 * api.anthropic.com from the browser, which is why a published bot never
 * replied for anyone but its author. The server holds the key and the prompt;
 * the browser only ever sees normalized events.
 */

type ProxyEvent =
  | { t: "meta"; sessionId: string | null; providerId?: string; modelId?: string; captureError?: string }
  | { t: "delta"; v: string }
  | { t: "usage"; in?: number; out?: number }
  | { t: "error"; message: string }
  | { t: "done"; sessionId: string | null };

type StreamResult = {
  promptTokens?: number;
  completionTokens?: number;
  sessionId?: string | null;
  providerId?: string;
  modelId?: string;
  /** Only sent to admin requests: why a lead/meeting could not be saved. */
  captureError?: string;
};

async function streamViaProxy(
  slug: string,
  messages: ChatMessage[],
  opts: { draft?: DraftOverride; adminToken?: string; sessionId?: string | null },
  signal: AbortSignal,
  onChunk: (text: string) => void,
): Promise<StreamResult> {
  const res = await fetch("/api/bot-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.adminToken ? { "x-admin-token": opts.adminToken } : {}),
    },
    body: JSON.stringify({
      slug,
      sessionId: opts.sessionId ?? undefined,
      draft: opts.draft,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
    signal,
  });

  if (!res.ok) {
    let message = `Chat failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // keep the status message
    }
    throw new Error(message);
  }

  let streamError: string | null = null;
  const result = await parseSseStream(res, signal, onChunk, (raw) => {
    const ev = raw as ProxyEvent;
    if (ev.t === "delta") return { text: ev.v };
    if (ev.t === "usage") return { promptTokens: ev.in, completionTokens: ev.out };
    if (ev.t === "error") {
      streamError = ev.message;
      return {};
    }
    if (ev.t === "meta") {
      return {
        sessionId: ev.sessionId,
        providerId: ev.providerId,
        modelId: ev.modelId,
        captureError: ev.captureError,
      };
    }
    if (ev.t === "done") return { sessionId: ev.sessionId };
    return {};
  });

  // An error raised mid-stream arrives as an event, not an HTTP status.
  if (streamError) throw new Error(streamError);
  return result;
}

async function parseSseStream(
  res: Response,
  signal: AbortSignal,
  onChunk: (text: string) => void,
  parse: (data: Record<string, unknown>) => {
    text?: string;
    promptTokens?: number;
    completionTokens?: number;
    sessionId?: string | null;
    providerId?: string;
    modelId?: string;
    captureError?: string;
  },
): Promise<StreamResult> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let sessionId: string | null | undefined;
  let providerId: string | undefined;
  let modelId: string | undefined;
  let captureError: string | undefined;

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
          if (parsed.promptTokens !== undefined) promptTokens = parsed.promptTokens;
          if (parsed.completionTokens !== undefined) completionTokens = parsed.completionTokens;
          if (parsed.sessionId !== undefined && parsed.sessionId !== null) {
            sessionId = parsed.sessionId;
          }
          if (parsed.providerId) providerId = parsed.providerId;
          if (parsed.modelId) modelId = parsed.modelId;
          if (parsed.captureError) captureError = parsed.captureError;
        } catch {
          // skip malformed SSE frames
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { promptTokens, completionTokens, sessionId, providerId, modelId, captureError };
}

/**
 * Remembers the conversation across a refresh, so `memory: "session"` means
 * something.
 *
 * Keyed by mode as well as slug: the editor and the public page share an
 * origin, so a single key would let an editor test continue a visitor's
 * session, or the reverse. The server checks this too.
 */
function sessionKey(slug: string, isTest: boolean): string {
  return `botforge:session:${slug}:${isTest ? "test" : "live"}`;
}

/**
 * "session" ends with the tab; "persistent" survives it, so a returning
 * visitor carries on where they left off. "none" stores nothing at all.
 */
function storeFor(memory: MemoryMode): Storage | null {
  if (typeof window === "undefined" || memory === "none") return null;
  try {
    return memory === "persistent" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function loadSessionId(slug: string, isTest: boolean, memory: MemoryMode): string | null {
  try {
    return storeFor(memory)?.getItem(sessionKey(slug, isTest)) ?? null;
  } catch {
    return null;
  }
}

function saveSessionId(
  slug: string,
  isTest: boolean,
  memory: MemoryMode,
  id: string,
): void {
  try {
    storeFor(memory)?.setItem(sessionKey(slug, isTest), id);
  } catch {
    // Non-fatal: the server just starts a new session next time.
  }
}

export function useChat(opts: UseChatOptions) {
  const { initialMessages = [], botId, slug, draft, adminToken, memory = "session" } = opts;
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<UsageStats | null>(null);
  const [captureError, setCaptureError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const sessionIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    sessionIdRef.current = loadSessionId(slug, Boolean(adminToken), memory);
  }, [slug, adminToken, memory]);

  const optsRef = React.useRef({ botId, slug, draft, adminToken, memory });
  React.useEffect(() => {
    optsRef.current = { botId, slug, draft, adminToken, memory };
  }, [botId, slug, draft, adminToken, memory]);

  const send = React.useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      const next = [...messages, userMsg];
      setMessages([...next, { role: "assistant", content: "" }]);
      setIsStreaming(true);
      setError(null);
      setStats(null);
      setCaptureError(null);

      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = performance.now();

      let acc = "";
      let promptTokens: number | undefined;
      let completionTokens: number | undefined;

      try {
        const current = optsRef.current;

        const result = await streamViaProxy(
          current.slug,
          next,
          {
            draft: current.draft,
            adminToken: current.adminToken,
            sessionId: sessionIdRef.current,
          },
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
        if (result.captureError) setCaptureError(result.captureError);

        if (result.sessionId) {
          sessionIdRef.current = result.sessionId;
          saveSessionId(current.slug, Boolean(current.adminToken), current.memory, result.sessionId);
        }

        const latencyMs = Math.round(performance.now() - startedAt);
        setStats({ latencyMs, chars: acc.length, promptTokens, completionTokens });

        // Persist the completed turn and enrich any captured lead out of band,
        // so none of it sits on the response path the visitor is waiting for.
        if (result.sessionId && acc) {
          void fetch("/api/chat-turn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: result.sessionId,
              slug: current.slug,
              assistant: acc,
              promptTokens,
              completionTokens,
              providerId: result.providerId,
              modelId: result.modelId,
              latencyMs,
            }),
            keepalive: true,
          }).catch(() => {
            // The hourly sweeper picks up anything this misses.
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

  return { messages, send, stop, regenerate, reset, isStreaming, error, stats, captureError };
}
