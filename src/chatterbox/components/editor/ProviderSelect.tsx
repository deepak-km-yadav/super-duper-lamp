import * as React from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { Select, Label, Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { PROVIDERS } from "../../lib/llm-registry";
import type { ProviderMeta } from "../../lib/llm-registry";
import { loadApiKeys, saveApiKey } from "../../lib/api-keys";

type ProviderStatus = ProviderMeta & {
  serverAvailable: boolean;
  userKeyed: boolean;
  available: boolean;
};

const KEY_CONSOLE: Record<string, { href: string; label: string }> = {
  anthropic: { href: "https://console.anthropic.com/settings/keys", label: "Anthropic Console" },
  openai: { href: "https://platform.openai.com/api-keys", label: "OpenAI Platform" },
  google: { href: "https://aistudio.google.com/app/apikey", label: "Google AI Studio" },
  mistral: { href: "https://console.mistral.ai/api-keys/", label: "Mistral Console" },
  groq: { href: "https://console.groq.com/keys", label: "Groq Console" },
  xai: { href: "https://console.x.ai/", label: "xAI Console" },
  cohere: { href: "https://dashboard.cohere.com/api-keys", label: "Cohere Dashboard" },
  perplexity: { href: "https://www.perplexity.ai/settings/api", label: "Perplexity Settings" },
  deepseek: { href: "https://platform.deepseek.com/api_keys", label: "DeepSeek Platform" },
  together: { href: "https://api.together.ai/settings/api-keys", label: "Together AI" },
  openrouter: { href: "https://openrouter.ai/keys", label: "OpenRouter Keys" },
  ollama: { href: "https://ollama.com/", label: "Ollama (local)" },
};

export function ProviderSelect({
  providerId,
  modelId,
  onChange,
  showOnlyAvailable,
  onToggleAvailable,
}: {
  providerId: string;
  modelId: string;
  onChange: (providerId: string, modelId: string) => void;
  showOnlyAvailable: boolean;
  onToggleAvailable: (v: boolean) => void;
}) {
  const [providers, setProviders] = React.useState<ProviderStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [keysTick, setKeysTick] = React.useState(0);

  React.useEffect(() => {
    const userKeys = loadApiKeys();
    const merged: ProviderStatus[] = PROVIDERS.map((p) => ({
      ...p,
      serverAvailable: false,
      userKeyed: !!userKeys[p.id],
      available: !!userKeys[p.id],
    }));
    setProviders(merged);
    setLoading(false);
  }, [keysTick]);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "botforge:apikeys:v1") {
        setKeysTick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => setKeysTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const filtered = showOnlyAvailable
    ? providers.filter((p) => p.available)
    : providers;

  const currentProvider = providers.find((p) => p.id === providerId);
  const currentModel = currentProvider?.models.find((m) => m.id === modelId);

  return (
    <div className="space-y-3">
      <div>
        <Label>Provider</Label>
        <Select
          value={providerId}
          onChange={(e) => {
            const p = providers.find((x) => x.id === e.target.value);
            const firstModel = p?.models[0]?.id ?? "";
            onChange(e.target.value, firstModel);
          }}
          disabled={loading}
        >
          {filtered.map((p) => (
            <option key={p.id} value={p.id}>
              {availabilityIcon(p)} {p.name}
              {p.userKeyed ? " (your key)" : ""}
            </option>
          ))}
        </Select>
        {currentProvider?.userKeyed && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-accent">
            <Check size={11} /> Using your saved API key for {currentProvider.name}.
          </p>
        )}
      </div>

      <div>
        <Label>Model</Label>
        {currentProvider ? (
          <Select
            value={modelId}
            onChange={(e) => onChange(providerId, e.target.value)}
            disabled={loading}
          >
            {(() => {
              const current = currentProvider.models.filter((m) => !m.legacy);
              const legacy = currentProvider.models.filter((m) => m.legacy);
              return (
                <>
                  {current.length > 0 && (
                    <optgroup label="Current">
                      {current.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {legacy.length > 0 && (
                    <optgroup label="Legacy">
                      {legacy.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </optgroup>
                  )}
                </>
              );
            })()}
          </Select>
        ) : (
          <Select value={modelId} onChange={() => {}} disabled>
            <option value="">Pick a provider first</option>
          </Select>
        )}
        {currentModel && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <Badge>ctx {(currentModel.contextWindow / 1000).toFixed(0)}k</Badge>
            {currentModel.supportsVision && <Badge>vision</Badge>}
            {currentModel.supportsTools && <Badge>tools</Badge>}
            {currentModel.pricePerMTokIn !== undefined && (
              <Badge>${currentModel.pricePerMTokIn}/M in</Badge>
            )}
            {currentModel.pricePerMTokOut !== undefined && (
              <Badge>${currentModel.pricePerMTokOut}/M out</Badge>
            )}
            {currentModel.legacy && (
              <Badge className="border-yellow-500/40 bg-yellow-500/10 text-yellow-500">legacy</Badge>
            )}
          </div>
        )}
      </div>

      {currentProvider && !currentProvider.userKeyed && providerId !== "ollama" && (
        <InlineKeyForm
          provider={currentProvider}
          onSaved={() => setKeysTick((t) => t + 1)}
        />
      )}

      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={showOnlyAvailable}
          onChange={(e) => onToggleAvailable(e.target.checked)}
          className="h-3.5 w-3.5 rounded"
        />
        Show only providers with a key configured
      </label>
    </div>
  );
}

function InlineKeyForm({
  provider,
  onSaved,
}: {
  provider: ProviderStatus;
  onSaved: () => void;
}) {
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const link = KEY_CONSOLE[provider.id];

  const save = async () => {
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    try {
      saveApiKey(provider.id, v);
      setValue("");
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <KeyRound size={12} className="text-yellow-500" />
          Add your {provider.name} key
        </div>
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg"
          >
            Get a key <ExternalLink size={10} />
          </a>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          placeholder={`Paste ${provider.envKey}…`}
          className="h-9 font-mono text-[16px] sm:h-8 sm:text-[11px]"
          autoComplete="off"
          spellCheck={false}
        />
        <Button size="sm" onClick={save} disabled={!value.trim() || busy}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : "Save"}
        </Button>
      </div>
      <p className="mt-1.5 text-[10px] text-muted">
        Stored only in your browser. Or manage all keys in{" "}
        <Link
          to="/chatterbox/settings"
          target="_blank"
          className="underline hover:text-fg"
        >
          Settings
        </Link>
        .
      </p>
    </div>
  );
}

function availabilityIcon(p: ProviderStatus): string {
  if (p.userKeyed) return "🔑";
  return "🔴";
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={
        "rounded-full border px-1.5 py-0.5 " +
        (className ?? "border-border bg-bg text-muted")
      }
    >
      {children}
    </span>
  );
}
