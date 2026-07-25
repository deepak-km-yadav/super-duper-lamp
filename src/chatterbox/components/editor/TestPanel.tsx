import * as React from "react";
import { Eraser, Zap } from "lucide-react";
import { ChatThread } from "../chat/ChatThread";
import { MessageInput } from "../chat/MessageInput";
import { useChat } from "../../lib/use-chat";
import { getChatTheme } from "../../lib/chat-themes";
import { cn } from "../../lib/utils";
import type { Bot } from "../../lib/types";

export function TestPanel({ draft }: { draft: Bot }) {
  const initial = React.useMemo(
    () =>
      draft.greeting
        ? [{ role: "assistant" as const, content: draft.greeting }]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { messages, send, stop, regenerate, reset, isStreaming, error, stats } = useChat({
    botId: draft.id,
    override: {
      providerId: draft.providerId,
      modelId: draft.modelId,
      systemPrompt: draft.systemPrompt,
      temperature: draft.temperature,
      maxTokens: draft.maxTokens,
      topP: draft.topP,
      knowledge: draft.knowledge,
    },
    initialMessages: initial,
  });

  const theme = getChatTheme(draft.chatTheme);

  return (
    <div
      className={cn("flex h-full flex-col", theme.surface, theme.background)}
      style={{
        ...(theme.fontFamily ? { fontFamily: theme.fontFamily } : {}),
        ...(theme.textColor ? { color: theme.textColor } : {}),
      }}
    >
      <div className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-accent" />
          <span className="text-sm font-medium">Live test</span>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-border/40 hover:text-fg"
        >
          <Eraser size={12} /> Reset
        </button>
      </div>

      <ChatThread
        messages={messages}
        isStreaming={isStreaming}
        botName={draft.name}
        botInitials={draft.avatarInitials}
        botAvatarUrl={draft.avatarUrl}
        themeColor={draft.themeColor}
        chatTheme={draft.chatTheme}
        onRegenerate={regenerate}
        emptyState={
          <div className="grid h-full place-items-center text-center text-sm text-muted">
            <div>
              <p>Send a message to test your bot.</p>
              <p className="mt-1 text-xs">
                Edits to the system prompt take effect on the next message.
              </p>
            </div>
          </div>
        }
      />

      {error && (
        <div className="mx-3 mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      )}

      {stats && !isStreaming && (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
          <Stat label={`${stats.latencyMs}ms`} />
          <Stat label={`${stats.chars.toLocaleString()} chars`} />
          {(stats.promptTokens ?? 0) > 0 && (
            <Stat label={`↑${stats.promptTokens!.toLocaleString()} tokens`} />
          )}
          {(stats.completionTokens ?? 0) > 0 && (
            <Stat label={`↓${stats.completionTokens!.toLocaleString()} tokens`} />
          )}
          {(stats.completionTokens ?? 0) > 0 && stats.latencyMs > 0 && (
            <Stat
              label={`${((stats.completionTokens! / stats.latencyMs) * 1000).toFixed(1)} tok/s`}
              accent
            />
          )}
        </div>
      )}

      <MessageInput
        onSend={send}
        onStop={stop}
        isStreaming={isStreaming}
        placeholder="Test a message…"
        className={theme.inputBar}
      />
    </div>
  );
}

function Stat({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 tabular-nums",
        accent
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border/60 bg-bg/50",
      )}
    >
      {label}
    </span>
  );
}
