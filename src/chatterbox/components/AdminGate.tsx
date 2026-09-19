import * as React from "react";
import { AlertTriangle, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";
import { Input, Label } from "./ui/Input";
import { setAdminToken } from "../lib/admin-token";

/**
 * Prompt for the shared admin token.
 *
 * Bots, provider keys and captured contact details all sit behind this one
 * token, so every dashboard surface that reads them shows this when it is
 * missing or rejected.
 */
export function AdminTokenPrompt({
  onSaved,
  rejected = false,
}: {
  onSaved: () => void;
  rejected?: boolean;
}) {
  const [value, setValue] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = value.trim();
    if (!token) return;
    setAdminToken(token);
    onSaved();
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-md rounded-xl border border-border bg-surface p-6 text-center"
    >
      <KeyRound className="mx-auto mb-3 text-accent" size={26} />
      <h2 className="font-semibold">
        {rejected ? "That admin token was rejected" : "Admin token required"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Your bots and captured leads are stored on the server. Enter the admin
        token set as <code className="text-xs">BOTFORGE_ADMIN_TOKEN</code> to
        continue.
      </p>
      {rejected && (
        <p className="mt-2 text-xs text-muted">
          Still rejected?{" "}
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Open /api/health
          </a>{" "}
          — it reports whether the variable is set on this deployment and
          whether the lengths match. Note that changing it in Vercel needs a
          redeploy before it takes effect.
        </p>
      )}
      <div className="mt-4 text-left">
        <Label htmlFor="admin-token">Admin token</Label>
        <Input
          id="admin-token"
          type="password"
          value={value}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your admin token"
        />
      </div>
      <Button type="submit" className="mt-4 w-full" disabled={!value.trim()}>
        Unlock dashboard
      </Button>
    </form>
  );
}

/** Failed load, with a way back. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 text-red-500" size={24} />
      <h2 className="font-semibold">Couldn't load that</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          <RefreshCw size={14} /> Try again
        </Button>
      )}
    </div>
  );
}
