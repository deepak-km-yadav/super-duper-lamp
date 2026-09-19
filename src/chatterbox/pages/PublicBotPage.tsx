import * as React from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import NavBar from "@/components/NavBar";
import { PublicChat } from "../components/PublicChat";
import { decodeBotFromShare } from "../lib/share-encode";
import { getPublicBot } from "../lib/bot-store";
import type { Bot, PublicBot } from "../lib/types";

type LoadState =
  | { kind: "loading" }
  /** Server-backed: chat runs through /api/bot-chat, keys stay on the server. */
  | { kind: "ready"; bot: PublicBot }
  /**
   * A pre-server share link that carries the whole config in its URL fragment.
   * Kept working so links already in the wild do not break, but it can only
   * chat using a provider key in the visitor's own browser.
   */
  | { kind: "legacy"; bot: Bot }
  | { kind: "paused"; name: string }
  | { kind: "error"; message: string }
  | { kind: "missing" };

export function PublicBotPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;

    const hash = window.location.hash ? window.location.hash.slice(1) : "";
    if (hash) {
      const decoded = decodeBotFromShare(hash);
      if (decoded) {
        setState({ kind: "legacy", bot: decoded as Bot });
        return;
      }
    }

    if (!slug) {
      setState({ kind: "missing" });
      return;
    }

    setState({ kind: "loading" });
    getPublicBot(slug)
      .then((result) => {
        if (cancelled) return;
        if (result.kind === "ready") setState({ kind: "ready", bot: result.bot });
        else if (result.kind === "unpublished")
          setState({ kind: "paused", name: result.name });
        else setState({ kind: "missing" });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Something went wrong.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  React.useEffect(() => {
    const previous = document.title;
    document.title = documentTitleFor(state) ?? previous;
    return () => {
      document.title = previous;
    };
  }, [state]);

  if (state.kind === "loading") {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted">
        <div className="inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading bot…
        </div>
      </main>
    );
  }

  if (state.kind === "paused") {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <div className="text-3xl">⏸</div>
          <h1 className="mt-4 text-xl font-semibold">{state.name} is paused</h1>
          <p className="mt-2 text-sm text-muted">
            The owner has temporarily unpublished this bot. Check back later.
          </p>
        </div>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <div className="text-3xl">⚠</div>
          <h1 className="mt-4 text-xl font-semibold">Couldn't load this bot</h1>
          <p className="mt-2 text-sm text-muted">{state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (state.kind === "missing") {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <div className="text-5xl">🤖</div>
          <h1 className="mt-4 text-2xl font-semibold">Bot not found</h1>
          <p className="mt-2 text-sm text-muted">
            This bot doesn't exist, or it has been deleted. Check the link with
            whoever shared it.
          </p>
        </div>
      </main>
    );
  }

  const embedded = new URLSearchParams(window.location.search).get("embed") === "1";
  // The nav is the owner's choice and only ever on the bot's own link: inside
  // an iframe or the widget the page belongs to whoever embedded it.
  const showNav = !embedded && state.bot.showNav === true;

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {showNav && <NavBar />}
      <div className="min-h-0 flex-1">
        {state.kind === "legacy" ? (
          <PublicChat bot={state.bot} legacy embedded={embedded} />
        ) : (
          <PublicChat bot={state.bot} embedded={embedded} />
        )}
      </div>
    </div>
  );
}

/**
 * A shared link should be identifiable in a visitor's tab strip, so the bot
 * names its own page rather than inheriting the site title.
 */
function documentTitleFor(state: LoadState): string | null {
  switch (state.kind) {
    case "ready":
    case "legacy":
      return state.bot.name || "Chat";
    case "paused":
      return `${state.name} is paused`;
    case "missing":
      return "Bot not found";
    default:
      return null;
  }
}
