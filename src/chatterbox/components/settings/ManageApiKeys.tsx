import * as React from "react";
import { Check, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { loadApiKeys, saveApiKey, clearApiKey } from "../../lib/api-keys";
import { PROVIDERS } from "../../lib/llm-registry";
import { cn } from "../../lib/utils";

type ProviderRow = {
  id: string;
  name: string;
  envKey: string;
  userKeyed: boolean;
};

export function ManageApiKeys() {
  const [providers, setProviders] = React.useState<ProviderRow[]>([]);
  const [keys, setKeys] = React.useState<Record<string, string>>({});
  const [reveal, setReveal] = React.useState<Record<string, boolean>>({});
  const [savedTick, setSavedTick] = React.useState<Record<string, number>>({});

  const load = () => {
    const stored = loadApiKeys() as Record<string, string>;
    const rows: ProviderRow[] = PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      envKey: p.envKey,
      userKeyed: !!stored[p.id],
    }));
    setProviders(rows);
    setKeys(stored);
  };

  React.useEffect(() => {
    load();
  }, []);

  const update = (providerId: string, value: string) => {
    setKeys((prev) => ({ ...prev, [providerId]: value }));
  };

  const onSave = (providerId: string) => {
    const v = (keys[providerId] || "").trim();
    saveApiKey(providerId, v);
    setSavedTick((p) => ({ ...p, [providerId]: Date.now() }));
    setTimeout(() => setSavedTick((p) => ({ ...p, [providerId]: 0 })), 1500);
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, userKeyed: !!v } : p)),
    );
  };

  const onClear = (providerId: string) => {
    clearApiKey(providerId);
    setKeys((prev) => ({ ...prev, [providerId]: "" }));
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, userKeyed: false } : p)),
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur sm:p-5 md:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
          <KeyRound size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Manage API keys</h2>
          <p className="mt-0.5 text-sm text-muted">
            Bring your own keys. Stored in <strong>this browser only</strong>, sent
            per-request directly to the AI provider. Keys never leave your browser
            except as part of a direct chat request.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {providers.map((p) => {
          const v = keys[p.id] || "";
          const isRevealed = reveal[p.id];
          return (
            <div
              key={p.id}
              className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border bg-bg/40 p-3 sm:grid-cols-[180px_1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      p.userKeyed ? "bg-accent" : "bg-red-500",
                    )}
                  />
                  {p.name}
                </div>
                <div className="font-mono text-[10px] text-muted">{p.envKey}</div>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type={isRevealed ? "text" : "password"}
                  value={v}
                  onChange={(e) => update(p.id, e.target.value)}
                  placeholder="Paste key…"
                  className="font-mono text-[16px] sm:text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setReveal((r) => ({ ...r, [p.id]: !isRevealed }))}
                  className="grid h-10 w-9 place-items-center rounded-md text-muted hover:bg-border/40 hover:text-fg"
                  title={isRevealed ? "Hide" : "Reveal"}
                  aria-label={isRevealed ? "Hide key" : "Reveal key"}
                >
                  {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onClear(p.id)}
                  disabled={!v && !p.userKeyed}
                  aria-label="Clear key"
                >
                  <X size={14} />
                </Button>
                <Button size="sm" onClick={() => onSave(p.id)} disabled={!v}>
                  {savedTick[p.id] ? (
                    <>
                      <Check size={12} /> Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted">
        Keys are stored only in your browser's localStorage. Clear the field and click
        Save (or the ✕ button) to remove a key.
      </p>
    </div>
  );
}
