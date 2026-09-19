import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Editor } from "../components/editor/Editor";
import { useBot } from "../lib/use-bot-store";
import { getSiteUrl } from "../lib/utils";
import { isAuthError } from "../lib/admin-token";
import { AdminTokenPrompt, ErrorState } from "../components/AdminGate";

export function EditBotPage() {
  const { id } = useParams<{ id: string }>();
  const state = useBot(id);
  const siteUrl = getSiteUrl();
  const bot = state.status === "ready" ? state.data : undefined;

  if (state.status === "error") {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="w-full max-w-md">
          {isAuthError(state.message) ? (
            <AdminTokenPrompt rejected onSaved={state.reload} />
          ) : (
            <ErrorState message={state.message} onRetry={state.reload} />
          )}
        </div>
      </main>
    );
  }

  if (state.status === "loading") {
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
            This bot no longer exists. It may have been deleted from another
            browser or device.
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
