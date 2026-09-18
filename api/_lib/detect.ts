/**
 * Cheap signal detection for the agent actions.
 *
 * This runs on the visitor's message before the reply starts streaming, so a
 * lead is durable in the database before the first token is produced and
 * detection can never add latency to the response.
 */

// Same pattern already used by api/lead-capture.ts.
export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

// Deliberately conservative: 7+ digits with common separators, so it does not
// fire on prices, years or order numbers.
export const PHONE_RE =
  /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?/;

const BOOKING_WORDS = [
  "meeting", "meet", "call", "schedule", "scheduling", "book", "booking",
  "appointment", "demo", "consultation", "calendar", "availability",
  "available", "slot", "catch up", "sync",
];

const TIME_WORDS = [
  "today", "tomorrow", "tonight", "morning", "afternoon", "evening",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "next week", "this week", "am", "pm", "o'clock",
];

const DATE_RE = /\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/i;

export type Signals = {
  email: string | null;
  phone: string | null;
  booking: boolean;
};

function looksLikePhone(text: string): string | null {
  const match = text.match(PHONE_RE);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return match[0].trim();
}

export function detectSignals(text: string): Signals {
  const lower = text.toLowerCase();
  const email = text.match(EMAIL_RE)?.[0] ?? null;

  // Strip the email before looking for a phone number, so the digits inside an
  // address like "dana2024@example.com" are not read as one.
  const withoutEmail = email ? text.replace(email, " ") : text;

  const hasBookingWord = BOOKING_WORDS.some((w) => lower.includes(w));
  const hasTimeWord = TIME_WORDS.some((w) => lower.includes(w)) || DATE_RE.test(text);

  return {
    email,
    phone: looksLikePhone(withoutEmail),
    // A bare "tomorrow" is not a booking; it needs intent as well as a time.
    booking: hasBookingWord && hasTimeWord,
  };
}

export function hasLeadSignal(s: Signals): boolean {
  return Boolean(s.email || s.phone);
}

/** The last user turn plus the preceding assistant turn, for context display. */
export function buildContextSnippet(
  messages: { role: string; content: string }[],
  limit = 600,
): string {
  const tail = messages.slice(-3);
  const text = tail
    .map((m) => `${m.role === "user" ? "Visitor" : "Bot"}: ${m.content.trim()}`)
    .join("\n");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
