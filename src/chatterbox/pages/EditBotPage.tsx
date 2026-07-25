import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Editor } from "../components/editor/Editor";
import { getLocal } from "../lib/local-store";
import type { Bot } from "../lib/types";

export function EditBotPage() {
  const { id } = useParams<{ id: string }>();
  const [bot, setBot] = React.useState<Bot | null | undefined>(undefined);
  const [siteUrl, setSiteUrl] = React.useState<string>("");

  React.useEffect(() => {
    setSiteUrl(window.location.origin);
    if (!id) {
      setBot(null);
      return;
    }
    const local = getLocal(id);
    setBot(local ?? null);
  }, [id]);

  if (bot === undefined) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted">
        <div className="inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading bot…
        </div>
      </main>
    );
  }

  if (bot === null) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <div className="text-5xl">🤖</div>
          <h1 className="mt-4 text-2xl font-semibold">Bot not found</h1>
          <p className="mt-2 text-sm text-muted">
            This bot doesn't exist in your local browser storage. Drafts are stored
            client-side only.
          </p>
          <Link
            to="/chatterbox/dashboard"
            className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <Editor initialBot={bot} siteUrl={siteUrl} />;
}
