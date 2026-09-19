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
import type { AgentAction, Bot, KnowledgeDoc } from "../../lib/types";
import { TEMPLATES } from "../../lib/templates";
import { capabilitiesFor } from "../../lib/llm-registry";
import { initialsFromName } from "../../lib/utils";
import { beaconSave, removeBot, setBotStatus, updateBot } from "../../lib/bot-store";

type Tab = "identity" | "brain" | "test";

/**
 * Only send what actually changed.
 *
 * The whole Bot is not a viable request body: avatarUrl is a base64 data URI
 * and knowledge documents run to hundreds of KB, so re-posting the object on
 * every 800ms debounce would push megabytes per keystroke burst.
 */
function diffBot(prev: Bot, next: Bot): Partial<Bot> {
  const patch: Partial<Bot> = {};
  for (const key of Object.keys(next) as (keyof Bot)[]) {
    const a = prev[key];
    const b = next[key];
    const changed =
      typeof b === "object" && b !== null ? JSON.stringify(a) !== JSON.stringify(b) : a !== b;
    if (changed) (patch as Record<string, unknown>)[key] = b;
  }
  return patch;
}

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

  // Saving is now a network round trip rather than a synchronous localStorage
  // write, which introduces three problems the old code did not have: saves can
  // land out of order, an unmount can drop the last edit, and a save can fail.
  const pendingRef = React.useRef<Bot | null>(null);
  const inFlightRef = React.useRef<Promise<unknown> | null>(null);
  const seqRef = React.useRef(0);
  const lastSavedRef = React.useRef<Bot>(initialBot);

  const flush = React.useCallback(async () => {
    const snapshot = pendingRef.current;
    if (!snapshot) return;

    // Serialise: never have two saves for the same bot in flight at once.
    if (inFlightRef.current) await inFlightRef.current.catch(() => {});
    if (pendingRef.current !== snapshot) return; // a newer edit owns the next flush

    const patch = diffBot(lastSavedRef.current, snapshot);
    if (Object.keys(patch).length === 0) {
      pendingRef.current = null;
      setSaved("idle");
      return;
    }

    const seq = ++seqRef.current;
    const p = updateBot(snapshot.id, patch)
      .then((savedBot) => {
        if (seq !== seqRef.current) return; // superseded by a later save
        pendingRef.current = null;
        lastSavedRef.current = savedBot;
        // Reconcile server-owned fields without stomping on in-flight typing.
        setBot((prev) =>
          prev === snapshot
            ? savedBot
            : { ...prev, slug: savedBot.slug, updatedAt: savedBot.updatedAt },
        );
        setSaved("saved");
        setTimeout(() => setSaved("idle"), 1200);
      })
      .catch((e: unknown) => {
        setSaved("error");
        toast.error(e instanceof Error ? e.message : "Save failed.");
      })
      .finally(() => {
        if (inFlightRef.current === p) inFlightRef.current = null;
      });

    inFlightRef.current = p;
    await p;
  }, []);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setSaved("saving");
    pendingRef.current = bot;
    const t = setTimeout(() => void flush(), 800);
    return () => clearTimeout(t);
  }, [bot, flush]);

  // A fetch started during unmount is cancelled by the browser on navigation,
  // so the last debounced edit goes out via sendBeacon instead.
  React.useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (!pending) return;
      const patch = diffBot(lastSavedRef.current, pending);
      if (Object.keys(patch).length > 0) beaconSave(pending.id, patch);
    };
  }, []);

  // Warn before a reload or tab close drops an unsaved edit.
  React.useEffect(() => {
    if (saved !== "saving" && saved !== "error") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saved]);

  const [publishing, setPublishing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const publish = async () => {
    if (publishing) return;
    const goingLive = bot.status !== "PUBLISHED";
    const previous = bot;
    const next: Bot = {
      ...bot,
      status: goingLive ? "PUBLISHED" : "UNPUBLISHED",
      publishedAt: goingLive ? new Date().toISOString() : bot.publishedAt,
    };

    setPublishing(true);
    setBot(next);
    try {
      // Flush any pending edits first, so publishing never races the autosave
      // and ships a stale prompt to the public page.
      await flush();
      const savedBot = await setBotStatus(bot.id, next.status, next.publishedAt);
      lastSavedRef.current = savedBot;
      setBot(savedBot);
      if (goingLive) {
        setShowShare(true);
        toast.success("Bot published! Share your link.");
      } else {
        toast.info("Bot unpublished.");
      }
    } catch (e) {
      setBot(previous); // roll back the optimistic status flip
      toast.error(e instanceof Error ? e.message : "Could not change publish status.");
    } finally {
      setPublishing(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    if (!confirm("Delete this bot? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await removeBot(bot.id);
      pendingRef.current = null; // nothing left to beacon on unmount
      navigate("/chatterbox/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete that bot.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-bg">
      <Header
        bot={bot}
        saved={saved}
        onPublish={() => void publish()}
        onShare={() => setShowShare(true)}
        onDelete={() => void remove()}
        onRetrySave={() => void flush()}
        publishing={publishing}
        deleting={deleting}
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
  onRetrySave,
  publishing,
  deleting,
  siteUrl,
}: {
  bot: Bot;
  saved: "idle" | "saving" | "saved" | "error";
  onPublish: () => void;
  onShare: () => void;
  onDelete: () => void;
  onRetrySave: () => void;
  publishing?: boolean;
  deleting?: boolean;
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
        <SavedIndicator state={saved} onRetry={onRetrySave} />
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
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Delete"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </Button>
        <Button variant="secondary" size="sm" onClick={onShare} aria-label="Share">
          <Share2 size={14} /> <span className="hidden sm:inline">Share</span>
        </Button>
        <Button size="sm" onClick={onPublish} disabled={publishing}>
          {publishing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : bot.status === "PUBLISHED" ? (
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

function SavedIndicator({
  state,
  onRetry,
}: {
  state: "idle" | "saving" | "saved" | "error";
  onRetry: () => void;
}) {
  if (state === "idle") return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted">
      {state === "saving" && (
        <><Loader2 size={11} className="animate-spin" /> Saving…</>
      )}
      {state === "saved" && (
        <><Check size={11} className="text-green-500" /> Saved</>
      )}
      {state === "error" && (
        <>
          <span className="text-red-500">Save failed</span>
          <button
            type="button"
            onClick={onRetry}
            className="underline underline-offset-2 hover:text-fg"
          >
            Retry
          </button>
        </>
      )}
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
            {bot.visibility === "private" && (
              <p className="mt-1 text-[11px] text-muted">
                The public link and any embed stop working. Only the Live test
                panel can reach it.
              </p>
            )}
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
  // Some models accept only fixed creativity settings, so the controls for them
  // would otherwise sit there looking adjustable while doing nothing.
  const samplingSupported = capabilitiesFor(bot.providerId, bot.modelId).sampling;

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

      <div className="mt-6">
        <AgentPanel bot={bot} update={update} />
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
        <>
        {!samplingSupported && (
          <p className="mt-3 rounded-md border border-border bg-bg/40 px-2.5 py-2 text-xs text-muted">
            {bot.modelId} uses fixed creativity settings, so Temperature and Top P
            don't apply. Max tokens still does.
          </p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={samplingSupported ? "" : "opacity-50"}>
            <Label>Temperature ({bot.temperature.toFixed(2)})</Label>
            <input
              type="range" min={0} max={2} step={0.05} value={bot.temperature}
              onChange={(e) => update("temperature", parseFloat(e.target.value))}
              disabled={!samplingSupported}
              title={samplingSupported ? undefined : `${bot.modelId} ignores this setting`}
              className="w-full disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <Label>Max tokens</Label>
            <Input
              type="number" value={bot.maxTokens}
              onChange={(e) => update("maxTokens", parseInt(e.target.value || "0", 10))}
              min={64} max={32000}
            />
            {!samplingSupported && (
              <p className="mt-1 text-[11px] text-muted">
                Includes the model's own reasoning, so it needs far more than a
                plain chat model — 4,000 or above.
              </p>
            )}
          </div>
          <div className={samplingSupported ? "" : "opacity-50"}>
            <Label>Top P ({bot.topP.toFixed(2)})</Label>
            <input
              type="range" min={0} max={1} step={0.05} value={bot.topP}
              onChange={(e) => update("topP", parseFloat(e.target.value))}
              disabled={!samplingSupported}
              title={samplingSupported ? undefined : `${bot.modelId} ignores this setting`}
              className="w-full disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <Label>Memory</Label>
            <Select value={bot.memory} onChange={(e) => update("memory", e.target.value as Bot["memory"])}>
              <option value="none">None — every message is fresh</option>
              <option value="session">Session — until tab closes</option>
              <option value="persistent">Persistent — remembers on return</option>
            </Select>
            {bot.memory === "none" && (
              <p className="mt-1 text-[11px] text-muted">
                No history is sent, so the bot cannot follow up on anything said
                earlier.
              </p>
            )}
          </div>
          <div>
            <Label>Content filter</Label>
            <Select value={bot.contentFilter} onChange={(e) => update("contentFilter", e.target.value as Bot["contentFilter"])}>
              <option value="strict">Strict</option>
              <option value="moderate">Moderate</option>
              <option value="off">Off</option>
            </Select>
            <p className="mt-1 text-[11px] text-muted">
              A safety instruction added to the prompt, not a separate
              classifier — a determined visitor may still get around it.
            </p>
          </div>
          <div>
            <Label>Language</Label>
            <Input value={bot.language} onChange={(e) => update("language", e.target.value)} />
          </div>
        </div>
        </>
      )}
    </>
  );
}

const AGENT_ACTIONS: {
  id: AgentAction;
  label: string;
  description: string;
}[] = [
  {
    id: "lead_magnet",
    label: "Lead Magnet",
    description:
      "Detects when a name, email or phone number comes up in chat and saves it as a lead.",
  },
  {
    id: "scheduler",
    label: "Scheduler",
    description:
      "Detects a requested date and time and saves it as a meeting request.",
  },
];

/**
 * "Act as an Agent" -- lets the bot do something with a conversation beyond
 * replying to it. Everything captured shows up on the Action Items page.
 */
function AgentPanel({
  bot,
  update,
}: {
  bot: Bot;
  update: <K extends keyof Bot>(key: K, value: Bot[K]) => void;
}) {
  const enabled = bot.agentEnabled ?? false;
  const actions = bot.agentActions ?? [];

  const toggleAction = (id: AgentAction, on: boolean) => {
    const next = on ? [...new Set([...actions, id])] : actions.filter((a) => a !== id);
    update("agentActions", next);
  };

  return (
    <div className="rounded-lg border border-border bg-bg/40 p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => update("agentEnabled", e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles size={13} className="text-accent" /> Act as an Agent
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            Let this bot act on the conversation, not just reply to it.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted">What should it do?</p>
          {AGENT_ACTIONS.map((action) => (
            <label
              key={action.id}
              className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-border/30"
            >
              <input
                type="checkbox"
                checked={actions.includes(action.id)}
                onChange={(e) => toggleAction(action.id, e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{action.label}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {action.description}
                </span>
              </span>
            </label>
          ))}

          {actions.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted">
                Tell me when something is captured
              </p>
              <div>
                <Label htmlFor="notify-email">Email</Label>
                <Input
                  id="notify-email"
                  type="email"
                  value={bot.notifyEmail ?? ""}
                  onChange={(e) => update("notifyEmail", e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="notify-webhook">Webhook URL</Label>
                <Input
                  id="notify-webhook"
                  type="url"
                  value={bot.notifyWebhookUrl ?? ""}
                  onChange={(e) => update("notifyWebhookUrl", e.target.value)}
                  placeholder="https://hooks.zapier.com/…"
                  autoComplete="off"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Posts the capture as JSON — works with Zapier, Make, n8n or a
                  Slack incoming webhook. Test captures never notify.
                </p>
              </div>
            </div>
          )}

          {actions.length === 0 ? (
            <p className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-2 py-1.5 text-xs text-yellow-600">
              Pick at least one action, or the bot will behave exactly as before.
            </p>
          ) : (
            <p className="text-xs text-muted">
              Captured items appear under{" "}
              <Link to="/chatterbox/action-items" className="text-accent hover:underline">
                Action Items
              </Link>
              . The bot will also be nudged to ask for these details naturally
              rather than only listening for them.
            </p>
          )}
        </div>
      )}
    </div>
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
