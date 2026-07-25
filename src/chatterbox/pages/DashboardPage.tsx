import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Download, MessageSquare, Pencil, Plus, Search, Share2, Trash2, Upload, X } from "lucide-react";
import { Avatar } from "../components/ui/Avatar";
import { toast } from "../components/ui/Toast";
import { fmtDate } from "../lib/utils";
import type { Bot } from "../lib/types";
import { listLocal, removeLocal, createLocal } from "../lib/local-store";
import { exportBots, importBots } from "../lib/bot-io";
import { encodeBotForShare } from "../lib/share-encode";

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  mistral: "Mistral",
  groq: "Groq",
  xai: "xAI",
  cohere: "Cohere",
  perplexity: "Perplexity",
  deepseek: "DeepSeek",
  together: "Together AI",
  openrouter: "OpenRouter",
  ollama: "Ollama",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [bots, setBots] = React.useState<Bot[] | null>(null);
  const [tick, setTick] = React.useState(0);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    setBots(listLocal());
  }, [tick]);

  const filteredBots = React.useMemo(() => {
    if (!bots) return null;
    const q = query.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter((b) => {
      const hay = `${b.name} ${b.bio} ${b.description} ${b.tags.join(" ")} ${b.modelId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bots, query]);

  const refresh = () => setTick((t) => t + 1);

  const onDelete = (b: Bot) => {
    if (!confirm(`Delete "${b.name}"? This cannot be undone.`)) return;
    removeLocal(b.id);
    refresh();
  };

  const onDuplicate = (b: Bot) => {
    const copy = createLocal({ ...b, name: `${b.name} (copy)`, status: "DRAFT" });
    refresh();
    navigate(`/chatterbox/bots/${copy.id}/edit`);
  };

  const onShare = (b: Bot) => {
    const fragment = encodeBotForShare(b);
    const url = `${window.location.origin}/chatterbox/chat/${b.slug}#${fragment}`;
    if (navigator.share) {
      navigator.share({ title: b.name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Share link copied to clipboard.");
      });
    }
  };

  return (
    <div className="bg-orbs" style={{ minHeight: "100%" }}>
      <main className="relative mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
        <div className="mb-5 flex animate-slide-down flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your Bots</h1>
            <p className="text-sm text-muted">
              {bots === null
                ? "Loading…"
                : `${bots.length} ${bots.length === 1 ? "bot" : "bots"}`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
            <ImportButton onImported={refresh} />
            <button
              type="button"
              onClick={() => {
                if (!bots || bots.length === 0) {
                  toast.info("Nothing to export yet.");
                  return;
                }
                exportBots(bots);
                toast.success(`Exported ${bots.length} bot${bots.length === 1 ? "" : "s"}.`);
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:bg-border/40 hover:text-fg"
              title="Download a JSON backup of all bots"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
            <Link
              to="/chatterbox/bots/new"
              className="btn-shine inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg shadow-md shadow-accent/30 transition-all hover:scale-105 active:scale-[0.98] sm:px-4"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New Bot</span>
              <span className="sm:hidden">New</span>
            </Link>
          </div>
        </div>

        {bots !== null && bots.length > 0 && (
          <div className="mb-5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, bio, tag, model…"
                className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-border/40 hover:text-fg"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span className="hidden text-xs text-muted sm:inline">
              {filteredBots?.length} of {bots.length}
            </span>
          </div>
        )}

        {bots === null && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <BotCardSkeleton key={i} index={i} />
            ))}
          </div>
        )}

        {bots !== null && bots.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <MessageSquare className="mx-auto mb-3 text-muted" size={28} />
            <h2 className="font-semibold">No bots yet</h2>
            <p className="mt-1 text-sm text-muted">
              Get started by creating your first one. Takes about 30 seconds.
            </p>
            <Link
              to="/chatterbox/bots/new"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              <Plus size={16} /> Create a Bot
            </Link>
          </div>
        )}

        {bots && bots.length > 0 && filteredBots && filteredBots.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <Search className="mx-auto mb-3 text-muted" size={24} />
            <h2 className="font-semibold">No matches for "{query}"</h2>
            <p className="mt-1 text-sm text-muted">
              Try a different word, or{" "}
              <button onClick={() => setQuery("")} className="underline hover:text-fg">
                clear the search
              </button>
              .
            </p>
          </div>
        )}

        {filteredBots && filteredBots.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBots.map((b, i) => (
              <BotCard
                key={b.id}
                bot={b}
                index={i}
                onDelete={() => onDelete(b)}
                onDuplicate={() => onDuplicate(b)}
                onShare={() => onShare(b)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function BotCard({
  bot,
  index,
  onDelete,
  onDuplicate,
  onShare,
}: {
  bot: Bot;
  index: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onShare: () => void;
}) {
  return (
    <div
      className="card-lift group relative flex animate-slide-up flex-col rounded-xl border border-border bg-surface/70 p-5 backdrop-blur transition-colors hover:border-accent"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
    >
      <Link
        to={`/chatterbox/bots/${bot.id}/edit`}
        className="flex flex-1 flex-col"
        aria-label={`Edit ${bot.name}`}
      >
        <div className="flex items-start gap-3">
          <Avatar
            name={bot.name}
            initials={bot.avatarInitials}
            url={bot.avatarUrl}
            color={bot.themeColor}
            size={44}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{bot.name}</h3>
              <StatusPill status={bot.status} />
            </div>
            <p className="line-clamp-2 text-sm text-muted">
              {bot.bio || "No bio yet."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span className="truncate">
            {PROVIDER_NAMES[bot.providerId] ?? bot.providerId} · {bot.modelId}
          </span>
          <span>{fmtDate(bot.updatedAt)}</span>
        </div>
      </Link>

      <div
        className="pointer-events-none absolute right-3 top-3 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        onClick={(e) => e.preventDefault()}
      >
        {bot.status === "PUBLISHED" && (
          <CardAction title="Open chat" to={`/chatterbox/chat/${bot.slug}`} newTab>
            <MessageSquare size={13} />
          </CardAction>
        )}
        <CardAction title="Edit" to={`/chatterbox/bots/${bot.id}/edit`}>
          <Pencil size={13} />
        </CardAction>
        <CardAction title="Share" onClick={onShare}>
          <Share2 size={13} />
        </CardAction>
        <CardAction title="Duplicate" onClick={onDuplicate}>
          <Copy size={13} />
        </CardAction>
        <CardAction title="Delete" onClick={onDelete} danger>
          <Trash2 size={13} />
        </CardAction>
      </div>
    </div>
  );
}

function CardAction({
  children,
  title,
  to,
  onClick,
  danger,
  newTab,
}: {
  children: React.ReactNode;
  title: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  newTab?: boolean;
}) {
  const cls = `pointer-events-auto grid h-7 w-7 place-items-center rounded-md border border-border bg-surface shadow-sm hover:bg-border/40 ${
    danger ? "hover:text-red-500" : ""
  }`;
  if (to) {
    return (
      <Link
        to={to}
        title={title}
        aria-label={title}
        className={cls}
        {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cls}
    >
      {children}
    </button>
  );
}

function BotCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="animate-pulse rounded-xl border border-border bg-surface/70 p-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-full bg-border/40" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-border/40" />
          <div className="h-3 w-full rounded bg-border/30" />
          <div className="h-3 w-1/2 rounded bg-border/30" />
        </div>
      </div>
      <div className="mt-4 flex justify-between">
        <div className="h-3 w-1/3 rounded bg-border/30" />
        <div className="h-3 w-1/4 rounded bg-border/30" />
      </div>
    </div>
  );
}

function ImportButton({ onImported }: { onImported: () => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    try {
      const bots = await importBots(file);
      onImported();
      toast.success(`Imported ${bots.length} bot${bots.length === 1 ? "" : "s"}.`);
    } catch (e: unknown) {
      toast.error("Import failed: " + ((e as Error)?.message ?? "unknown error"));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:bg-border/40 hover:text-fg"
        title="Import from a JSON export file"
      >
        <Upload size={14} /> Import
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-yellow-500/15 text-yellow-500",
    PUBLISHED: "bg-green-500/15 text-green-500",
    UNPUBLISHED: "bg-muted/15 text-muted",
    ARCHIVED: "bg-red-500/15 text-red-500",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        map[status] || ""
      }`}
    >
      {status.toLowerCase()}
    </span>
  );
}
