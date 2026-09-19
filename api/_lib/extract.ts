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

const DETECTION_MODEL = process.env.DETECTION_MODEL || "claude-haiku-4-5";
const DETECTION_API_KEY = process.env.DETECTION_API_KEY || "";

export function isExtractionConfigured(): boolean {
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
  required: ["isMeetingRequest", "name", "email", "requestedForText", "timezone", "topic"],
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
  },
} as const;

async function extract<T>(
  transcript: string,
  instruction: string,
  schema: unknown,
): Promise<T | null> {
  if (!DETECTION_API_KEY) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": DETECTION_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: DETECTION_MODEL,
        max_tokens: 1024,
        system:
          `${instruction}\n\n` +
          "Only report what the visitor actually said. Never invent a name, " +
          "an address or a time. Use null for anything not clearly stated.",
        messages: [
          { role: "user", content: `<conversation>\n${transcript}\n</conversation>` },
        ],
        output_config: { format: { type: "json_schema", schema } },
      }),
    });

    if (!res.ok) return null;

    const body = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = body.content?.find((b) => b.type === "text")?.text;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    // Enrichment is an improvement on the regex result, never a requirement.
    return null;
  }
}

export function extractLead(transcript: string): Promise<ExtractedLead | null> {
  return extract<ExtractedLead>(
    transcript,
    "Extract the visitor's contact details from this chat so a human can follow up.",
    LEAD_SCHEMA,
  );
}

export function extractMeeting(transcript: string): Promise<ExtractedMeeting | null> {
  return extract<ExtractedMeeting>(
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
