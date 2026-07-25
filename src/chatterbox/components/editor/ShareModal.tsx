import * as React from "react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { encodeBotForShare } from "../../lib/share-encode";
import type { Bot } from "../../lib/types";

type Tab = "link" | "iframe" | "widget" | "qr";

export function ShareModal({
  open,
  onClose,
  bot,
  siteUrl,
}: {
  open: boolean;
  onClose: () => void;
  bot: Bot;
  siteUrl: string;
}) {
  const [tab, setTab] = React.useState<Tab>("link");

  const fragment = React.useMemo(() => encodeBotForShare(bot), [bot]);
  const publicUrl = `${siteUrl}/chatterbox/chat/${bot.slug}#${fragment}`;
  const embedUrl = `${siteUrl}/chatterbox/chat/${bot.slug}#${fragment}`;
  const iframeSnippet = `<iframe
  src="${embedUrl}"
  width="400"
  height="600"
  style="border:1px solid #e2e8f0;border-radius:12px"
  title="${bot.name}"
></iframe>`;
  const widgetSnippet = `<script src="${siteUrl}/embed.js" data-bot-slug="${bot.slug}" data-bot-data="${fragment}" data-color="${bot.themeColor}" defer></script>`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(publicUrl)}`;

  return (
    <Modal open={open} onClose={onClose} title="Share your bot" maxWidth="max-w-2xl">
      {bot.status !== "PUBLISHED" && (
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-500">
          ⚠ This bot is currently <strong>{bot.status.toLowerCase()}</strong>. The share link still works — it carries the full config in the URL fragment.
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-bg p-1 text-sm">
        {(["link", "iframe", "widget", "qr"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 capitalize transition-colors ${
              tab === t ? "bg-surface shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            {t === "qr" ? "QR Code" : t}
          </button>
        ))}
      </div>

      {tab === "link" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Share this link anywhere. The full bot config is encoded in the URL so it works without a server.
          </p>
          <CopyBox value={publicUrl} />
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            Open in new tab <ExternalLink size={12} />
          </a>
        </div>
      )}

      {tab === "iframe" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Drop this iframe into any website to embed your bot as a fixed-size chat panel.
          </p>
          <CopyBox value={iframeSnippet} multiline />
        </div>
      )}

      {tab === "widget" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Add this script tag and a floating chat bubble appears on the bottom-right of your site.
          </p>
          <CopyBox value={widgetSnippet} multiline />
        </div>
      )}

      {tab === "qr" && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted">
            Print on flyers or business cards for quick mobile access.
          </p>
          <img
            src={qrUrl}
            alt="QR code"
            className="mx-auto h-56 w-56 rounded-lg border border-border bg-white p-3"
          />
          <a
            href={qrUrl}
            download={`${bot.slug}-qr.png`}
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            Download PNG <Download size={12} />
          </a>
        </div>
      )}
    </Modal>
  );
}

function CopyBox({ value, multiline }: { value: string; multiline?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative">
      {multiline ? (
        <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-bg p-3 pr-12 text-xs leading-relaxed">
          {value}
        </pre>
      ) : (
        <input
          readOnly
          value={value}
          className="h-10 w-full rounded-lg border border-border bg-bg px-3 pr-12 text-sm"
        />
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopy}
        className="absolute right-1.5 top-1.5"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
