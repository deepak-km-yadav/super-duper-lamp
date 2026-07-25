import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PublicChat } from "../components/PublicChat";
import { decodeBotFromShare } from "../lib/share-encode";
import { listLocal } from "../lib/local-store";
import type { Bot } from "../lib/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; bot: Bot }
  | { kind: "paused"; name: string }
  | { kind: "missing" };

export function PublicBotPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });

  React.useEffect(() => {
    const hash = window.location.hash ? window.location.hash.slice(1) : "";
    if (hash) {
      const decoded = decodeBotFromShare(hash);
      if (decoded) {
        setState({ kind: "ready", bot: decoded as Bot });
        return;
      }
    }

    if (!slug) {
      setState({ kind: "missing" });
      return;
    }

    const local = listLocal().find((b) => b.slug === slug);
    if (local) {
      if (local.status !== "PUBLISHED" && local.status !== "DRAFT") {
        setState({ kind: "paused", name: local.name });
      } else {
        setState({ kind: "ready", bot: local });
      }
      return;
    }

    setState({ kind: "missing" });
  }, [slug]);

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

  if (state.kind === "missing") {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <div className="text-5xl">🤖</div>
          <h1 className="mt-4 text-2xl font-semibold">Bot not found</h1>
          <p className="mt-2 text-sm text-muted">
            This share link doesn't include the bot's data. Ask the creator to send
            you their share URL — it carries the full config in the URL itself.
          </p>
          <Link
            to="/chatterbox/dashboard"
            className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen" style={{ height: "100dvh" }}>
      <PublicChat bot={state.bot} />
    </div>
  );
}
