import { customAlphabet } from "nanoid";
import type { UsageRecord } from "./types";

const KEY = "botforge:usage:v1";
const genId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export function loadUsage(): UsageRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as UsageRecord[]) : [];
  } catch {
    return [];
  }
}

export function recordUsage(input: Omit<UsageRecord, "id" | "ts">) {
  if (typeof window === "undefined") return;
  const all = loadUsage();
  all.push({ ...input, id: genId(), ts: new Date().toISOString() });
  const trimmed = all.length > 5000 ? all.slice(all.length - 5000) : all;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("[usage-store] save failed", e);
  }
}

export function clearUsage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export type UsageWindow = "7d" | "30d" | "all";

export function filterUsageByWindow(
  records: UsageRecord[],
  window: UsageWindow,
): UsageRecord[] {
  if (window === "all") return records;
  const days = window === "7d" ? 7 : 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return records.filter((r) => new Date(r.ts).getTime() >= cutoff);
}

export function totals(records: UsageRecord[]) {
  return records.reduce(
    (acc, r) => ({
      prompt: acc.prompt + (r.promptTokens || 0),
      completion: acc.completion + (r.completionTokens || 0),
      count: acc.count + 1,
    }),
    { prompt: 0, completion: 0, count: 0 },
  );
}

export function groupBy<T extends string>(
  records: UsageRecord[],
  keyFn: (r: UsageRecord) => T,
) {
  const groups = new Map<T, UsageRecord[]>();
  for (const r of records) {
    const k = keyFn(r);
    const arr = groups.get(k);
    if (arr) arr.push(r);
    else groups.set(k, [r]);
  }
  return groups;
}
