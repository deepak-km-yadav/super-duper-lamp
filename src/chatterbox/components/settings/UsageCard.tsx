import * as React from "react";
import { Activity, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import {
  clearUsage,
  filterUsageByWindow,
  loadUsage,
  totals,
  type UsageWindow,
} from "../../lib/usage-store";
import { listLocal } from "../../lib/local-store";
import { getModel, getProvider } from "../../lib/llm-registry";
import { cn } from "../../lib/utils";

export function UsageCard() {
  const [tick, setTick] = React.useState(0);
  const [windowSel, setWindowSel] = React.useState<UsageWindow>("30d");

  React.useEffect(() => {
    const onStorage = () => setTick((t) => t + 1);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const records = React.useMemo(
    () => filterUsageByWindow(loadUsage(), windowSel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, windowSel],
  );
  const t = totals(records);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bots = React.useMemo(() => listLocal(), [tick]);

  const cost = computeCost(records);

  const byBot = aggregate(records, (r) => r.botId || "unknown");
  const byModel = aggregate(records, (r) => `${r.providerId}/${r.modelId}`);

  const onClear = () => {
    if (!confirm("Clear all local usage history? This cannot be undone.")) return;
    clearUsage();
    setTick((t) => t + 1);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur sm:p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
            <Activity size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Usage &amp; tokens</h2>
            <p className="mt-0.5 text-sm text-muted">
              Cumulative tokens consumed by your bots, tracked locally in this browser.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 self-start rounded-md border border-border bg-bg p-0.5 text-xs">
          {(["7d", "30d", "all"] as UsageWindow[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindowSel(w)}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                windowSel === w ? "bg-surface shadow-sm" : "text-muted hover:text-fg",
              )}
            >
              {w === "7d" ? "Last 7d" : w === "30d" ? "Last 30d" : "All time"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Conversations" value={t.count.toLocaleString()} />
        <Stat label="Prompt tokens" value={t.prompt.toLocaleString()} arrow="↑" />
        <Stat label="Completion tokens" value={t.completion.toLocaleString()} arrow="↓" />
        <Stat
          label="Est. cost"
          value={cost > 0 ? `$${cost.toFixed(4)}` : "—"}
          hint={cost > 0 ? "approx, list price" : "no priced models used"}
        />
      </div>

      {records.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-bg/40 p-8 text-center text-sm text-muted">
          No usage yet. Chat with one of your bots to see token counts here.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="By bot">
            <Table
              rows={byBot.map(([k, sum]) => ({
                key: k,
                label: bots.find((b) => b.id === k)?.name ?? k,
                prompt: sum.prompt,
                completion: sum.completion,
                count: sum.count,
              }))}
            />
          </Section>
          <Section title="By model">
            <Table
              rows={byModel.map(([k, sum]) => {
                const [p, m] = k.split("/");
                const provider = getProvider(p);
                const model = getModel(p, m);
                return {
                  key: k,
                  label: `${provider?.name ?? p} · ${model?.name ?? m}`,
                  prompt: sum.prompt,
                  completion: sum.completion,
                  count: sum.count,
                };
              })}
            />
          </Section>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClear} disabled={records.length === 0}>
          <Trash2 size={12} /> Clear local history
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  arrow,
  hint,
}: {
  label: string;
  value: string;
  arrow?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {arrow && <span className="text-accent">{arrow}</span>}
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg/40 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

function Table({
  rows,
}: {
  rows: { key: string; label: string; prompt: number; completion: number; count: number }[];
}) {
  if (rows.length === 0) return <div className="text-sm text-muted">No data.</div>;
  const total = rows.reduce((a, r) => a + r.prompt + r.completion, 0);
  return (
    <div className="space-y-1.5 text-sm">
      {rows
        .slice()
        .sort((a, b) => b.prompt + b.completion - (a.prompt + a.completion))
        .slice(0, 8)
        .map((r) => {
          const pct = Math.round(((r.prompt + r.completion) / total) * 100);
          return (
            <div key={r.key} className="flex flex-wrap items-center gap-2 text-xs sm:flex-nowrap sm:text-sm">
              <div className="min-w-0 flex-1 truncate sm:w-32 sm:flex-none" title={r.label}>
                {r.label}
              </div>
              <div className="relative order-3 h-2 w-full flex-1 overflow-hidden rounded-full bg-border/40 sm:order-2 sm:w-auto">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="order-2 shrink-0 tabular-nums text-[11px] text-muted sm:order-3 sm:w-28 sm:text-right sm:text-xs">
                ↑{r.prompt.toLocaleString()} ↓{r.completion.toLocaleString()}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function aggregate(
  records: { promptTokens: number; completionTokens: number; [key: string]: any }[],
  keyFn: (r: any) => string,
) {
  const map = new Map<string, { prompt: number; completion: number; count: number }>();
  for (const r of records) {
    const k = keyFn(r);
    const cur = map.get(k) ?? { prompt: 0, completion: 0, count: 0 };
    cur.prompt += r.promptTokens || 0;
    cur.completion += r.completionTokens || 0;
    cur.count += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries());
}

function computeCost(
  records: {
    providerId: string;
    modelId: string;
    promptTokens: number;
    completionTokens: number;
  }[],
): number {
  let total = 0;
  for (const r of records) {
    const m = getModel(r.providerId, r.modelId);
    if (!m) continue;
    if (m.pricePerMTokIn) total += (r.promptTokens / 1_000_000) * m.pricePerMTokIn;
    if (m.pricePerMTokOut) total += (r.completionTokens / 1_000_000) * m.pricePerMTokOut;
  }
  return total;
}
