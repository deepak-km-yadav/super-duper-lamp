/**
 * Structured extraction for the agent actions.
 *
 * The regex pass in _lib/detect.ts is what guarantees a lead is captured; this
 * is the enrichment layer that fills in the parts a regex cannot read -- a
 * person's name, what they actually want, and a date phrased as "next Tuesday
 * afternoon". It runs after the reply has already been streamed, so it is never
 * on the path the visitor is waiting on.
 *
 * Deliberately uses its own small model rather than the bot's configured
 * provider: extraction quality should not depend on which provider a given bot
 * happens to use, and nobody should pay Opus rates for a classification task.
 */

import { completeOnce, type ProviderConfig } from "./llm-stream.js";
import { readEnv } from "./env.js";

const DETECTION_MODEL = readEnv(process.env.DETECTION_MODEL) || "claude-haiku-4-5";
const DETECTION_API_KEY = readEnv(process.env.DETECTION_API_KEY);

/**
 * Which model does the background extraction and summarising.
 *
 * A dedicated key is preferred: quality then does not depend on whichever
 * provider a given bot happens to use. But requiring one meant that without it
 * nothing was extracted at all and every lead arrived with no name and no
 * summary, so fall back to the bot's own provider and key.
 */
export type ExtractionModel = { providerId: string; modelId: string; apiKey: string };

export function extractionModelFor(fallback: ExtractionModel | null): ExtractionModel | null {
  if (DETECTION_API_KEY) {
    return { providerId: "anthropic", modelId: DETECTION_MODEL, apiKey: DETECTION_API_KEY };
  }
  return fallback?.apiKey ? fallback : null;
}

export function usingDedicatedKey(): boolean {
  return Boolean(DETECTION_API_KEY);
}

export type ExtractedLead = {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  intent: string | null;
  summary: string | null;
};

export type ExtractedMeeting = {
  name: string | null;
  email: string | null;
  requestedForText: string | null;
  timezone: string | null;
  topic: string | null;
  summary: string | null;
  isMeetingRequest: boolean;
};

const LEAD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "email", "phone", "company", "intent", "summary"],
  properties: {
    name: { type: ["string", "null"], description: "The visitor's own name, if they gave it." },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    company: { type: ["string", "null"] },
    intent: {
      type: ["string", "null"],
      enum: ["pricing", "demo", "support", "partnership", "hiring", "other", null],
    },
    summary: {
      type: ["string", "null"],
      description: "One sentence on what this person wants. No more.",
    },
  },
} as const;

const MEETING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isMeetingRequest", "name", "email", "requestedForText", "timezone", "topic", "summary"],
  properties: {
    isMeetingRequest: {
      type: "boolean",
      description: "True only if the visitor actually asked to meet, call or book.",
    },
    name: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    requestedForText: {
      type: ["string", "null"],
      description: "The day/time in the visitor's own words, e.g. 'next Tuesday afternoon'.",
    },
    timezone: { type: ["string", "null"] },
    topic: { type: ["string", "null"], description: "What the meeting is about, in a few words." },
    summary: {
      type: ["string", "null"],
      description: "One or two sentences an admin can read at a glance: who, what they want, when.",
    },
  },
} as const;

/** A short rollup of older turns, so the live context can stay small. */
export async function summariseConversation(
  model: ExtractionModel | null,
  transcript: string,
  previous: string | null,
): Promise<string | null> {
  if (!model) return null;
  const cfg: ProviderConfig = {
    providerId: model.providerId,
    modelId: model.modelId,
    apiKey: model.apiKey,
    systemPrompt:
      "You maintain a running summary of a customer conversation so the " +
      "assistant can stay brief without losing what matters. Keep every " +
      "concrete detail the visitor gave -- names, contact details, dates, " +
      "times, timezones, what they asked for and what was promised. Drop " +
      "pleasantries. Write plain prose under 200 words, no preamble.",
  };
  const prompt = previous
    ? `Existing summary:\n${previous}\n\nNewer turns to fold in:\n${transcript}\n\n` +
      "Return the updated summary."
    : `Conversation so far:\n${transcript}\n\nReturn the summary.`;

  const out = await completeOnce(cfg, prompt, 600);
  return out?.trim() || null;
}

const GROUND_RULES =
  "Only report what the visitor actually said. Never invent a name, an address " +
  "or a time. Use null for anything not clearly stated.";

async function extract<T>(
  model: ExtractionModel | null,
  transcript: string,
  instruction: string,
  schema: unknown,
): Promise<T | null> {
  if (!model) return null;

  // Structured outputs are provider-specific, so the dedicated Anthropic path
  // constrains the response by schema and the fallback asks for JSON in the
  // prompt and parses leniently.
  if (model.providerId === "anthropic" && usingDedicatedKey()) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": model.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: model.modelId,
          max_tokens: 1024,
          system: `${instruction}\n\n${GROUND_RULES}`,
          messages: [
            { role: "user", content: `<conversation>\n${transcript}\n</conversation>` },
          ],
          output_config: { format: { type: "json_schema", schema } },
        }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = body.content?.find((b) => b.type === "text")?.text;
      return text ? (JSON.parse(text) as T) : null;
    } catch {
      return null;
    }
  }

  const cfg: ProviderConfig = {
    providerId: model.providerId,
    modelId: model.modelId,
    apiKey: model.apiKey,
    systemPrompt: `${instruction}\n\n${GROUND_RULES}`,
  };
  const raw = await completeOnce(
    cfg,
    `<conversation>\n${transcript}\n</conversation>\n\n` +
      "Reply with JSON only, matching this schema. No prose, no code fences.\n" +
      JSON.stringify(schema),
  );
  return parseLenientJson<T>(raw);
}

/** A model asked for JSON may still wrap it in prose or a code fence. */
export function parseLenientJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  const withoutFence = raw.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(withoutFence.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export function extractLead(
  model: ExtractionModel | null,
  transcript: string,
): Promise<ExtractedLead | null> {
  return extract<ExtractedLead>(
    model,
    transcript,
    "Extract the visitor's contact details from this chat so a human can follow up.",
    LEAD_SCHEMA,
  );
}

export function extractMeeting(
  model: ExtractionModel | null,
  transcript: string,
): Promise<ExtractedMeeting | null> {
  return extract<ExtractedMeeting>(
    model,
    transcript,
    "Work out whether the visitor asked to schedule a meeting, call or demo, and when.",
    MEETING_SCHEMA,
  );
}

/** Renders recent turns for the extraction prompt. */
export function buildTranscript(
  messages: { role: string; content: string }[],
  maxChars = 4000,
): string {
  const text = messages
    .map((m) => `${m.role === "user" ? "Visitor" : "Bot"}: ${m.content.trim()}`)
    .join("\n");
  return text.length > maxChars ? text.slice(-maxChars) : text;
}
