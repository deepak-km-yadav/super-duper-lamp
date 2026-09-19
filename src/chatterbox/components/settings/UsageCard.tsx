import * as React from "react";
import { Activity, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { Select } from "../ui/Input";
import { getModel } from "../../lib/llm-registry";
import { fetchUsage, type UsageBucket, type UsageReport } from "../../lib/usage";

const WINDOWS = [
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Priced from the registry, so it only covers models with known rates. */
function costOf(buckets: UsageBucket[]): number {
  let total = 0;
  for (const b of buckets) {
    const meta = b.providerId && b.modelId ? getModel(b.providerId, b.modelId) : undefined;
    if (!meta) continue;
    if (meta.pricePerMTokIn) total += (b.promptTokens / 1_000_000) * meta.pricePerMTokIn;
    if (meta.pricePerMTokOut) total += (b.completionTokens / 1_000_000) * meta.pricePerMTokOut;
  }
  return total;
}

export function UsageCard() {
  const [windowSel, setWindowSel] = React.useState("30d");
  const [report, setReport] = React.useState<UsageReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchUsage(windowSel));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load usage.");
    } finally {
      setLoading(false);
    }
  }, [windowSel]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const totals = report?.totals;
  const cost = report ? costOf(report.byModel) : 0;
  // Older messages predate token reporting, and some providers never send it.
  const partial =
    totals && totals.messages > 0 && totals.messagesWithUsage < totals.messages;

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur sm:p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
            <Activity size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Token usage</h2>
            <p className="mt-0.5 text-sm text-muted">
              Input and output tokens reported by the providers, across every
              conversation your bots have held — not just this browser.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Select
            value={windowSel}
            onChange={(e) => setWindowSel(e.target.value)}
            className="h-8 w-auto text-xs"
            aria-label="Time window"
          >
            {WINDOWS.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">
          {error}{" "}
          <button onClick={() => void load()} className="underline hover:text-fg">Retry</button>
        </div>
      )}

      {!error && totals && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Input tokens" value={fmt(totals.promptTokens)} />
            <Stat label="Output tokens" value={fmt(totals.completionTokens)} />
            <Stat label="Messages" value={fmt(totals.messages)} />
            <Stat label="Est. cost" value={cost > 0 ? `$${cost.toFixed(2)}` : "—"} />
          </div>

          {partial && (
            <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-muted">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-yellow-500" />
              {totals.messages - totals.messagesWithUsage} of {totals.messages} messages
              carry no token counts — they predate usage reporting, or their
              provider does not return it.
            </p>
          )}

          <Breakdown
            title="By bot"
            rows={report.byBot}
            nameOf={(b) => b.botName ?? b.botId ?? "Unknown"}
          />
          <Breakdown
            title="By model"
            rows={report.byModel}
            nameOf={(b) => `${b.providerId} · ${b.modelId}`}
          />

          {totals.messages === 0 && (
            <p className="mt-4 text-sm text-muted">
              No conversations in this window yet.
            </p>
          )}
        </>
      )}

      {!error && !report && loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-bg/40" />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg/40 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  nameOf,
}: {
  title: string;
  rows: UsageBucket[];
  nameOf: (b: UsageBucket) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg/40 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium">In</th>
              <th className="px-3 py-2 text-right font-medium">Out</th>
              <th className="px-3 py-2 text-right font-medium">Messages</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((b) => (
              <tr key={b.key} className="border-t border-border">
                <td className="truncate px-3 py-2">{nameOf(b)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(b.promptTokens)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(b.completionTokens)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt(b.messages)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
