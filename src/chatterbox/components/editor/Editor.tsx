import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  Home,
  KeyRound,
  Loader2,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Input, Label, Select, Textarea } from "../ui/Input";
import { toast } from "../ui/Toast";
import { AvatarUpload } from "./AvatarUpload";
import { ChatThemePicker } from "./ChatThemePicker";
import { KnowledgeUpload } from "./KnowledgeUpload";
import { ProviderSelect } from "./ProviderSelect";
import { ShareModal } from "./ShareModal";
import { TestPanel } from "./TestPanel";
import type { Bot, KnowledgeDoc } from "../../lib/types";
import { TEMPLATES } from "../../lib/templates";
import { initialsFromName } from "../../lib/utils";
import { removeLocal, setLocalStatus, updateLocal } from "../../lib/local-store";

type Tab = "identity" | "brain" | "test";

export function Editor({ initialBot, siteUrl }: { initialBot: Bot; siteUrl: string }) {
  const navigate = useNavigate();
  const [bot, setBot] = React.useState<Bot>(initialBot);
  const [saved, setSaved] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showShare, setShowShare] = React.useState(false);
  const [showOnlyAvailable, setShowOnlyAvailable] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<Tab>("identity");
  const isInitialMount = React.useRef(true);

  const update = React.useCallback(<K extends keyof Bot>(key: K, value: Bot[K]) => {
    setBot((prev) => ({ ...prev, [key]: value }));
  }, []);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setSaved("saving");
    const t = setTimeout(() => {
      updateLocal(bot.id, bot);
      setSaved("saved");
      setTimeout(() => setSaved("idle"), 1200);
    }, 800);
    return () => clearTimeout(t);
  }, [bot]);

  const publish = () => {
    const goingLive = bot.status !== "PUBLISHED";
    const next: Bot = {
      ...bot,
      status: goingLive ? "PUBLISHED" : "UNPUBLISHED",
      publishedAt: goingLive ? new Date().toISOString() : bot.publishedAt,
    };
    setLocalStatus(bot.id, next.status);
    updateLocal(bot.id, next);
    setBot(next);
    if (goingLive) {
      setShowShare(true);
      toast.success("Bot published! Share your link.");
    } else {
      toast.info("Bot unpublished.");
    }
  };

  const remove = () => {
    if (!confirm("Delete this bot? This cannot be undone.")) return;
    removeLocal(bot.id);
    navigate("/chatterbox/dashboard");
  };

  return (
    <div className="flex h-screen flex-col bg-bg">
      <Header
        bot={bot}
        saved={saved}
        onPublish={publish}
        onShare={() => setShowShare(true)}
        onDelete={remove}
        siteUrl={siteUrl}
      />

      <div className="flex border-b border-border md:hidden">
        {(["identity", "brain", "test"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-2.5 text-sm capitalize transition-colors ${
              mobileTab === t ? "border-b-2 border-accent text-fg" : "text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <section
          className={`w-full overflow-y-auto border-r border-border p-5 md:w-80 md:max-w-xs ${
            mobileTab !== "identity" ? "hidden md:block" : ""
          }`}
        >
          <IdentityPanel bot={bot} update={update} />
          <div className="my-6 border-t border-border" />
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Brain</h3>
            <Link
              to="/chatterbox/settings"
              target="_blank"
              rel="noreferrer"
              title="Manage API keys"
              aria-label="Manage API keys"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted hover:bg-border/40 hover:text-fg"
            >
              <KeyRound size={11} /> Keys
            </Link>
          </div>
          <ProviderSelect
            providerId={bot.providerId}
            modelId={bot.modelId}
            onChange={(p, m) => {
              update("providerId", p);
              update("modelId", m);
            }}
            showOnlyAvailable={showOnlyAvailable}
            onToggleAvailable={setShowOnlyAvailable}
          />
        </section>

        <section
          className={`flex-1 overflow-y-auto p-5 ${
            mobileTab !== "brain" ? "hidden md:block" : ""
          }`}
        >
          <PromptPanel bot={bot} update={update} />
        </section>

        <section
          className={`w-full border-l border-border md:w-[420px] md:max-w-md ${
            mobileTab !== "test" ? "hidden md:block" : ""
          }`}
        >
          <TestPanel draft={bot} />
        </section>
      </div>

      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        bot={bot}
        siteUrl={siteUrl}
      />
    </div>
  );
}

function Header({
  bot,
  saved,
  onPublish,
  onShare,
  onDelete,
  siteUrl,
}: {
  bot: Bot;
  saved: "idle" | "saving" | "saved" | "error";
  onPublish: () => void;
  onShare: () => void;
  onDelete: () => void;
  siteUrl: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2 sm:px-4 sm:py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Link
          to="/chatterbox/dashboard"
          aria-label="Home"
          title="Home"
          className="rounded-md p-1.5 text-muted hover:bg-border/40 hover:text-fg"
        >
          <Home size={14} />
        </Link>
        <span aria-hidden="true" className="text-muted/50">/</span>
        <Link
          to="/chatterbox/dashboard"
          className="hidden rounded-md px-1.5 py-1 text-xs text-muted hover:bg-border/40 hover:text-fg sm:inline-flex"
        >
          Dashboard
        </Link>
        <Link
          to="/chatterbox/dashboard"
          aria-label="Back to dashboard"
          className="rounded-md p-1.5 text-muted hover:bg-border/40 hover:text-fg sm:hidden"
        >
          <ArrowLeft size={14} />
        </Link>
        <span aria-hidden="true" className="hidden text-muted/50 sm:inline">/</span>
        <Avatar
          name={bot.name}
          initials={bot.avatarInitials}
          url={bot.avatarUrl}
          color={bot.themeColor}
          size={24}
          className="ml-0.5"
        />
        <span className="truncate font-medium">{bot.name}</span>
        <SavedIndicator state={saved} />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {bot.status === "PUBLISHED" && (
          <a
            href={`${siteUrl}/chatterbox/chat/${bot.slug}`}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-border/40 hover:text-fg lg:inline-flex"
          >
            View live <ExternalLink size={11} />
          </a>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete">
          <Trash2 size={14} />
        </Button>
        <Button variant="secondary" size="sm" onClick={onShare} aria-label="Share">
          <Share2 size={14} /> <span className="hidden sm:inline">Share</span>
        </Button>
        <Button size="sm" onClick={onPublish}>
          {bot.status === "PUBLISHED" ? (
            <>
              <span className="hidden sm:inline">Unpublish</span>
              <span className="sm:hidden">Live</span>
            </>
          ) : (
            "Publish"
          )}
        </Button>
      </div>
    </header>
  );
}

function SavedIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted">
      {state === "saving" && (
        <><Loader2 size={11} className="animate-spin" /> Saving…</>
      )}
      {state === "saved" && (
        <><Check size={11} className="text-green-500" /> Saved</>
      )}
      {state === "error" && <span className="text-red-500">Save failed</span>}
    </span>
  );
}

function IdentityPanel({
  bot,
  update,
}: {
  bot: Bot;
  update: <K extends keyof Bot>(k: K, v: Bot[K]) => void;
}) {
  const [showMore, setShowMore] = React.useState(false);

  return (
    <>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Identity</h3>
      <div className="mb-4 flex items-start gap-3">
        <AvatarUpload
          name={bot.name}
          initials={bot.avatarInitials}
          url={bot.avatarUrl}
          color={bot.themeColor}
          onChange={(dataUrl) => update("avatarUrl", dataUrl)}
        />
        <div className="flex-1">
          <Label>Initials &amp; accent</Label>
          <div className="flex items-center gap-1.5">
            <Input
              value={bot.avatarInitials ?? ""}
              onChange={(e) => update("avatarInitials", e.target.value.slice(0, 2).toUpperCase())}
              placeholder="AB"
              maxLength={2}
              className="h-8 max-w-[5rem] text-center text-xs uppercase tracking-wider"
            />
            <ColorSwatch value={bot.themeColor} onChange={(c) => update("themeColor", c)} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input
            value={bot.name}
            onChange={(e) => {
              update("name", e.target.value);
              if (!bot.avatarUrl) update("avatarInitials", initialsFromName(e.target.value));
            }}
            maxLength={50}
          />
        </div>
        <div>
          <Label>Tagline / bio (200 chars)</Label>
          <Input
            value={bot.bio}
            onChange={(e) => update("bio", e.target.value)}
            maxLength={200}
          />
        </div>
        <TagsField values={bot.tags} onChange={(v) => update("tags", v)} placeholder="Add tag…" />
      </div>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
        aria-expanded={showMore}
      >
        <ChevronDown size={12} className={`transition-transform ${showMore ? "rotate-180" : ""}`} />
        {showMore ? "Hide" : "Show"} more details
      </button>

      {showMore && (
        <div className="mt-3 space-y-3 animate-slide-up">
          <div>
            <Label>Description (markdown, 2000 chars)</Label>
            <Textarea
              value={bot.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>
          <div>
            <Label>Visibility</Label>
            <Select
              value={bot.visibility}
              onChange={(e) => update("visibility", e.target.value as Bot["visibility"])}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted — link only</option>
              <option value="private">Private — only you</option>
            </Select>
          </div>
          <div>
            <Label>Language</Label>
            <Input value={bot.language} onChange={(e) => update("language", e.target.value)} />
          </div>
          <ChatThemePicker
            value={bot.chatTheme ?? "default"}
            onChange={(t) => update("chatTheme", t)}
            accent={bot.themeColor}
          />
        </div>
      )}
    </>
  );
}

function PromptPanel({
  bot,
  update,
}: {
  bot: Bot;
  update: <K extends keyof Bot>(k: K, v: Bot[K]) => void;
}) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">System prompt</h3>
        <TemplatePicker
          onPick={(t) => {
            update("systemPrompt", t.systemPrompt);
            update("greeting", t.greeting);
            update("starterPrompts", t.starterPrompts);
            update("themeColor", t.themeColor);
          }}
        />
      </div>
      <Textarea
        value={bot.systemPrompt}
        onChange={(e) => update("systemPrompt", e.target.value)}
        rows={10}
        maxLength={8000}
        placeholder="You are…"
        className="font-mono text-[13px] leading-relaxed"
      />
      <p className="mt-1 text-right text-[10px] text-muted">{bot.systemPrompt.length} / 8000</p>

      <div className="mt-6">
        <Label>Welcome message</Label>
        <Textarea
          value={bot.greeting}
          onChange={(e) => update("greeting", e.target.value)}
          rows={2}
          placeholder="The first message your bot sends when chat opens"
        />
      </div>

      <div className="mt-4">
        <Label>Starter prompts (clickable suggestions)</Label>
        <StarterPromptsField values={bot.starterPrompts} onChange={(v) => update("starterPrompts", v)} />
      </div>

      <div className="mt-6">
        <KnowledgeUpload
          docs={bot.knowledge ?? []}
          onChange={(docs: KnowledgeDoc[]) => update("knowledge", docs)}
        />
      </div>

      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
        aria-expanded={showAdvanced}
      >
        <ChevronDown size={12} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        Advanced sampling
      </button>

      {showAdvanced && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Temperature ({bot.temperature.toFixed(2)})</Label>
            <input
              type="range" min={0} max={2} step={0.05} value={bot.temperature}
              onChange={(e) => update("temperature", parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <Label>Max tokens</Label>
            <Input
              type="number" value={bot.maxTokens}
              onChange={(e) => update("maxTokens", parseInt(e.target.value || "0", 10))}
              min={64} max={8192}
            />
          </div>
          <div>
            <Label>Top P ({bot.topP.toFixed(2)})</Label>
            <input
              type="range" min={0} max={1} step={0.05} value={bot.topP}
              onChange={(e) => update("topP", parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <Label>Memory</Label>
            <Select value={bot.memory} onChange={(e) => update("memory", e.target.value as Bot["memory"])}>
              <option value="none">None — every message is fresh</option>
              <option value="session">Session — until tab closes</option>
              <option value="persistent">Persistent (coming soon)</option>
            </Select>
          </div>
          <div>
            <Label>Content filter</Label>
            <Select value={bot.contentFilter} onChange={(e) => update("contentFilter", e.target.value as Bot["contentFilter"])}>
              <option value="strict">Strict</option>
              <option value="moderate">Moderate</option>
              <option value="off">Off</option>
            </Select>
          </div>
          <div>
            <Label>Language</Label>
            <Input value={bot.language} onChange={(e) => update("language", e.target.value)} />
          </div>
        </div>
      )}
    </>
  );
}

function TemplatePicker({ onPick }: { onPick: (t: typeof TEMPLATES[number]) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-border/40"
      >
        <Sparkles size={11} className="text-accent" /> Templates ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-surface shadow-xl">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => { onPick(t); setOpen(false); }}
              className="block w-full border-b border-border px-3 py-2 text-left text-xs last:border-0 hover:bg-border/40"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: t.themeColor }} />
                <span className="font-medium">{t.name}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-muted">{t.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StarterPromptsField({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.length >= 6) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={v}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="flex-1"
          />
          <button
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="rounded-md p-1.5 text-muted hover:bg-border/40 hover:text-red-500"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {values.length < 6 && (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); add(); }
            }}
            placeholder="Add a starter prompt…"
            className="flex-1"
          />
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="grid h-10 w-10 place-items-center rounded-md border border-border hover:bg-border/40 disabled:opacity-40"
          >
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function TagsField({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const v = draft.trim().toLowerCase();
    if (!v || values.includes(v) || values.length >= 8) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <Label>Tags</Label>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface p-2">
        {values.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
            {t}
            <button onClick={() => onChange(values.filter((x) => x !== t))} className="opacity-70 hover:opacity-100">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-[80px] bg-transparent text-xs outline-none"
        />
      </div>
    </div>
  );
}

const SWATCH_PRESETS = [
  "#0ea5e9", // sky blue (main)
  "#3b82f6", // blue
  "#7c3aed", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#64748b", // slate
];

function ColorSwatch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Accent color"
        aria-label="Pick accent color"
        className="h-8 w-8 shrink-0 rounded-md border border-border ring-1 ring-inset ring-black/10 transition-transform hover:scale-105"
        style={{ background: value }}
      />
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 animate-slide-up rounded-lg border border-border bg-surface p-2 shadow-lg">
          <div className="grid grid-cols-4 gap-1.5">
            {SWATCH_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                title={c}
                className={`h-7 w-7 rounded-md border transition-transform hover:scale-110 ${
                  value.toLowerCase() === c.toLowerCase() ? "border-fg ring-2 ring-fg/40" : "border-border"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-md border border-border bg-bg/40 px-2 py-1 text-[11px] text-muted">
            Custom
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="ml-auto font-mono text-[10px]">{value.toUpperCase()}</span>
          </label>
        </div>
      )}
    </div>
  );
}
