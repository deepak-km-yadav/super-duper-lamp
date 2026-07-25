import { createLocal } from "./local-store";
import type { Bot } from "./types";

const EXPORT_VERSION = 1;

type ExportFile = {
  format: "botforge-export";
  version: number;
  exportedAt: string;
  bots: Bot[];
};

export function exportBots(bots: Bot[]): void {
  const payload: ExportFile = {
    format: "botforge-export",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    bots,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `botforge-export-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importBots(file: File): Promise<Bot[]> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Couldn't parse JSON.");
  }

  let candidates: unknown[];
  if (Array.isArray(parsed)) {
    candidates = parsed;
  } else if (
    parsed &&
    typeof parsed === "object" &&
    "bots" in parsed &&
    Array.isArray((parsed as ExportFile).bots)
  ) {
    candidates = (parsed as ExportFile).bots;
  } else {
    throw new Error("Unrecognized file format.");
  }

  const created: Bot[] = [];
  for (const c of candidates) {
    if (!isBotShape(c)) continue;
    const { id: _id, slug: _slug, createdAt: _ca, updatedAt: _ua, status: _st, ...rest } = c as Bot;
    const bot = createLocal({ ...rest, status: "DRAFT" });
    created.push(bot);
  }
  if (created.length === 0) {
    throw new Error("No valid bots found in this file.");
  }
  return created;
}

function isBotShape(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    typeof o.systemPrompt === "string" &&
    typeof o.providerId === "string" &&
    typeof o.modelId === "string"
  );
}
