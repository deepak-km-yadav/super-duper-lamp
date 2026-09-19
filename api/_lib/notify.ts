/**
 * Announces a capture, so a lead does not sit in the dashboard unseen.
 *
 * Two channels, both raw fetch and no new dependency. The webhook is the
 * universal one -- Zapier, Make, n8n and Slack incoming webhooks all accept a
 * JSON POST -- so anyone whose email provider is not the one below still has a
 * route. Email goes through Resend, chosen because it is a single
 * authenticated POST with no SDK.
 *
 * Nothing here throws. A notification is a side effect of a conversation and
 * must never affect one.
 */

import { readEnv } from "./env.js";

const RESEND_API_KEY = readEnv(process.env.RESEND_API_KEY);
const NOTIFY_EMAIL_FROM = readEnv(process.env.NOTIFY_EMAIL_FROM);
const SITE_URL = readEnv(process.env.VITE_SITE_URL) || readEnv(process.env.SITE_URL);

export type CaptureKind = "lead" | "meeting";

export type CaptureNotification = {
  kind: CaptureKind;
  botId: string;
  botName: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Meeting requests only. */
  requestedFor?: string | null;
  summary: string | null;
  contextSnippet: string;
  sessionId: string | null;
  capturedAt: string;
};

export type NotifyTargets = {
  email: string | null;
  webhookUrl: string | null;
};

export type NotifyResult = { sent: string[]; errors: string[] };

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY && NOTIFY_EMAIL_FROM);
}

/**
 * Worth notifying about?
 *
 * A capture with no way to reach the person is not actionable, and a test
 * capture from the editor's Live panel must never send mail -- otherwise
 * checking that the feature works spams you every time.
 */
export function shouldNotify(n: CaptureNotification, isTest: boolean): boolean {
  if (isTest) return false;
  if (n.kind === "lead") return Boolean(n.email || n.phone);
  return true;
}

export async function notifyCapture(
  n: CaptureNotification,
  targets: NotifyTargets,
): Promise<NotifyResult> {
  const sent: string[] = [];
  const errors: string[] = [];

  if (targets.webhookUrl) {
    const err = await postWebhook(targets.webhookUrl, n);
    if (err) errors.push(`webhook: ${err}`);
    else sent.push("webhook");
  }

  if (targets.email) {
    const err = await sendEmail(targets.email, n);
    if (err) errors.push(`email: ${err}`);
    else sent.push("email");
  }

  return { sent, errors };
}

async function postWebhook(url: string, n: CaptureNotification): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: `botforge.${n.kind}.captured`, ...n }),
    });
    if (!res.ok) return `${res.status} ${(await res.text()).slice(0, 200)}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "request failed";
  }
}

async function sendEmail(to: string, n: CaptureNotification): Promise<string | null> {
  if (!isEmailConfigured()) {
    return "RESEND_API_KEY or NOTIFY_EMAIL_FROM is not configured";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_EMAIL_FROM,
        to: [to],
        subject: subjectFor(n),
        text: bodyFor(n),
      }),
    });
    if (!res.ok) return `${res.status} ${(await res.text()).slice(0, 200)}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "request failed";
  }
}

function who(n: CaptureNotification): string {
  return n.name || n.email || n.phone || "Someone";
}

function subjectFor(n: CaptureNotification): string {
  return n.kind === "lead"
    ? `New lead from ${n.botName}: ${who(n)}`
    : `Meeting requested via ${n.botName}: ${who(n)}`;
}

function bodyFor(n: CaptureNotification): string {
  const lines: string[] = [];

  lines.push(
    n.kind === "lead"
      ? `${who(n)} left their details in a chat with ${n.botName}.`
      : `${who(n)} asked to book a meeting via ${n.botName}.`,
  );
  lines.push("");

  if (n.name) lines.push(`Name:    ${n.name}`);
  if (n.email) lines.push(`Email:   ${n.email}`);
  if (n.phone) lines.push(`Phone:   ${n.phone}`);
  if (n.requestedFor) lines.push(`When:    ${n.requestedFor}`);
  lines.push(`Time:    ${n.capturedAt}`);

  if (n.summary) {
    lines.push("", "Summary", "-------", n.summary);
  }
  if (n.contextSnippet) {
    lines.push("", "From the conversation", "---------------------", n.contextSnippet);
  }

  if (SITE_URL) {
    lines.push("", `All action items: ${SITE_URL.replace(/\/+$/, "")}/chatterbox/action-items`);
  }

  return lines.join("\n");
}
