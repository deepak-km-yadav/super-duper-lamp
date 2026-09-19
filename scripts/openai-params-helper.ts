/**
 * Exercises streamOpenAICompat's request shaping through the public streamLLM
 * entry point, capturing the body each provider actually receives.
 */
import { streamLLM, capabilitiesFor, repairBody } from "../api/_lib/llm-stream";
import { capabilitiesFor as clientCapabilitiesFor } from "../src/chatterbox/lib/llm-registry";

export { capabilitiesFor, clientCapabilitiesFor, repairBody };

export type Sent = { body: Record<string, unknown> };

/** Runs one streamed request against a stubbed provider, returning every body sent. */
export async function captureRequests(
  providerId: string,
  modelId: string,
  responses: { status: number; body: string }[],
): Promise<{ sent: Sent[]; text: string; error: string | null }> {
  const sent: Sent[] = [];
  let call = 0;

  const original = globalThis.fetch;
  (globalThis as unknown as { fetch: unknown }).fetch = async (_url: string, init: RequestInit) => {
    sent.push({ body: JSON.parse(String(init.body)) });
    const r = responses[Math.min(call++, responses.length - 1)];
    const ok = r.status < 400;
    return {
      ok,
      status: r.status,
      text: async () => r.body,
      json: async () => JSON.parse(r.body),
      body: ok
        ? {
            getReader() {
              let done = false;
              return {
                async read() {
                  if (done) return { done: true, value: undefined };
                  done = true;
                  return { done: false, value: new TextEncoder().encode(r.body) };
                },
                releaseLock() {},
              };
            },
          }
        : null,
    } as unknown as Response;
  };

  let text = "";
  let error: string | null = null;
  try {
    const cfg = {
      providerId,
      modelId,
      apiKey: "k",
      systemPrompt: "sys",
      temperature: 0.4,
      maxTokens: 512,
      topP: 0.9,
    };
    for await (const ev of streamLLM(cfg, [{ role: "user", content: "hi" }], new AbortController().signal)) {
      if (ev.t === "delta") text += ev.v;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = original;
  }

  return { sent, text, error };
}

/** An SSE frame carrying one token, in OpenAI-compatible shape. */
export function sseChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
}
