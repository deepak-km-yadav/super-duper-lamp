/** Client for /api/action-items. */

import { getAdminToken } from "./admin-token";

export type Lead = {
  id: number;
  botId: string | null;
  botName: string;
  sessionId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  intent: string | null;
  summary: string | null;
  contextSnippet: string;
  status: string;
  detectedBy: string;
  createdAt: string;
};

export type Meeting = {
  id: number;
  botId: string | null;
  botName: string;
  sessionId: string | null;
  name: string | null;
  email: string | null;
  requestedFor: string | null;
  timezone: string | null;
  topic: string | null;
  contextSnippet: string;
  status: string;
  createdAt: string;
};

export type ActionItems = { leads: Lead[]; meetings: Meeting[] };
export type TranscriptMessage = { role: string; content: string; created_at: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getAdminToken(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : res.status === 401
          ? "Unauthorized. Check your admin token."
          : `Request failed (${res.status})`,
    );
  }
  return body as T;
}

export function fetchActionItems(): Promise<ActionItems> {
  return request<ActionItems>("/api/action-items");
}

export function fetchTranscript(sessionId: string): Promise<{ messages: TranscriptMessage[] }> {
  return request(`/api/action-items?sessionId=${encodeURIComponent(sessionId)}`);
}

export function setItemStatus(
  kind: "lead" | "meeting",
  id: number,
  status: string,
): Promise<unknown> {
  return request("/api/action-items", {
    method: "PATCH",
    body: JSON.stringify({ kind, id, status }),
  });
}

/** Quotes a CSV field per RFC 4180. */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const head = columns.map(csvCell).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(","));
  return [head, ...body].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // The BOM keeps Excel from mangling non-ASCII names.
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
