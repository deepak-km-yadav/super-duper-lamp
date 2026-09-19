import * as React from "react";
import { Check, KeyRound, Loader2, Upload, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { toast } from "../ui/Toast";
import {
  listProviderKeys,
  saveProviderKey,
  deleteProviderKey,
  loadLegacyApiKeys,
  clearLegacyApiKeys,
} from "../../lib/api-keys";
import { PROVIDERS, setAvailableProviders } from "../../lib/llm-registry";
import { cn } from "../../lib/utils";

export function ManageApiKeys() {
  const [hints, setHints] = React.useState<Record<string, string>>({});
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<Record<string, boolean>>({});
  const [savedTick, setSavedTick] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [legacyCount, setLegacyCount] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const keys = await listProviderKeys();
      const next: Record<string, string> = {};
      for (const k of keys) next[k.providerId] = k.hint;
      setHints(next);
      // Let the rest of the app show which providers are actually usable.
      setAvailableProviders(Object.keys(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    setLegacyCount(Object.keys(loadLegacyApiKeys()).length);
  }, [load]);

  const onSave = async (providerId: string) => {
    const value = (drafts[providerId] || "").trim();
    if (!value) return;
    setBusy((b) => ({ ...b, [providerId]: true }));
    try {
      await saveProviderKey(providerId, value);
      setDrafts((d) => ({ ...d, [providerId]: "" }));
      setSavedTick((p) => ({ ...p, [providerId]: Date.now() }));
      setTimeout(() => setSavedTick((p) => ({ ...p, [providerId]: 0 })), 1500);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that key.");
    } finally {
      setBusy((b) => ({ ...b, [providerId]: false }));
    }
  };

  const onClear = async (providerId: string) => {
    setBusy((b) => ({ ...b, [providerId]: true }));
    try {
      await deleteProviderKey(providerId);
      setDrafts((d) => ({ ...d, [providerId]: "" }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that key.");
    } finally {
      setBusy((b) => ({ ...b, [providerId]: false }));
    }
  };

  /** Offered, never automatic: uploading a key is the user's decision. */
  const uploadLegacy = async () => {
    const legacy = loadLegacyApiKeys();
    const entries = Object.entries(legacy).filter(([, v]) => Boolean(v));
    if (entries.length === 0) return;
    setUploading(true);
    let moved = 0;
    try {
      for (const [providerId, value] of entries) {
        try {
          await saveProviderKey(providerId, String(value));
          moved++;
        } catch {
          // Keep going; report the total at the end.
        }
      }
      if (moved > 0) {
        clearLegacyApiKeys();
        setLegacyCount(0);
        toast.success(`Moved ${moved} key${moved === 1 ? "" : "s"} to the server.`);
        await load();
      } else {
        toast.error("Could not move those keys.");
      }
    } finally {
      setUploading(false);
    }
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
            Bring your own keys. Stored on the server and used to answer chats on
            your behalf, so people who open your published bot or your embed
            don't need a key of their own. A saved key is never sent back to the
            browser — you'll only see the last few characters.
          </p>
        </div>
      </div>

      {legacyCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
          <span>
            You have {legacyCount} key{legacyCount === 1 ? "" : "s"} saved in this
            browser from before. Move {legacyCount === 1 ? "it" : "them"} to the
            server so your published bots can use {legacyCount === 1 ? "it" : "them"}.
          </span>
          <Button size="sm" onClick={() => void uploadLegacy()} disabled={uploading}>
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Move to server
          </Button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">
          {error}{" "}
          <button onClick={() => void load()} className="underline hover:text-fg">
            Retry
          </button>
        </div>
      )}

      <div className="space-y-2">
        {PROVIDERS.map((p) => {
          const hint = hints[p.id];
          const draft = drafts[p.id] || "";
          const isBusy = busy[p.id];
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
                      hint ? "bg-accent" : "bg-red-500",
                    )}
                  />
                  {p.name}
                </div>
                <div className="font-mono text-[10px] text-muted">
                  {hint ? `Saved · ${hint}` : p.envKey}
                </div>
              </div>
              <Input
                type="password"
                value={draft}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                placeholder={hint ? "Paste a new key to replace…" : "Paste key…"}
                className="font-mono text-[16px] sm:text-xs"
                autoComplete="off"
                spellCheck={false}
                disabled={loading}
              />
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void onClear(p.id)}
                  disabled={!hint || isBusy}
                  aria-label={`Remove ${p.name} key`}
                >
                  <X size={14} />
                </Button>
                <Button
                  size="sm"
                  onClick={() => void onSave(p.id)}
                  disabled={!draft.trim() || isBusy}
                >
                  {isBusy ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : savedTick[p.id] ? (
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
        Use the ✕ button to remove a key. Removing the key for a provider stops
        every published bot using that provider from replying.
      </p>
    </div>
  );
}
