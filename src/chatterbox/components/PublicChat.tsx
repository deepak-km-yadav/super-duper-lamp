import * as React from "react";
import { RotateCcw, Share2 } from "lucide-react";
import { Avatar } from "./ui/Avatar";
import { ChatThread } from "./chat/ChatThread";
import { MessageInput } from "./chat/MessageInput";
import { StarterPrompts } from "./chat/StarterPrompts";
import { toast } from "./ui/Toast";
import { useChat } from "../lib/use-chat";
import { getChatTheme } from "../lib/chat-themes";
import { cn } from "../lib/utils";
import type { Bot } from "../lib/types";

export function PublicChat({
  bot,
  embedded = false,
}: {
  bot: Bot;
  embedded?: boolean;
}) {
  const initial = React.useMemo(
    () =>
      bot.greeting
        ? [{ role: "assistant" as const, content: bot.greeting }]
        : [],
    [bot.greeting],
  );

  const { messages, send, stop, regenerate, reset, isStreaming, error } = useChat({
    botId: bot.id,
    override: {
      providerId: bot.providerId,
      modelId: bot.modelId,
      systemPrompt: bot.systemPrompt,
      temperature: bot.temperature,
      maxTokens: bot.maxTokens,
      topP: bot.topP,
      knowledge: bot.knowledge,
    },
    initialMessages: initial,
  });

  const theme = getChatTheme(bot.chatTheme);
  const showStarters = messages.length <= 1 && bot.starterPrompts.length > 0;

  return (
    <div
      className={cn(
        "flex h-full flex-col",
        theme.surface,
        theme.background,
        "[padding-bottom:env(safe-area-inset-bottom)]",
      )}
      style={{
        ...(theme.fontFamily ? { fontFamily: theme.fontFamily } : {}),
        ...(theme.textColor ? { color: theme.textColor } : {}),
      }}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5",
          theme.header,
        )}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Avatar
            name={bot.name}
            initials={bot.avatarInitials}
            url={bot.avatarUrl}
            color={bot.themeColor}
            size={36}
            className="shrink-0"
          />
          <div className="min-w-0">
            <div className="truncate font-semibold leading-tight">{bot.name}</div>
            {bot.bio && <div className="truncate text-xs opacity-70">{bot.bio}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-70">
          <button
            onClick={reset}
            title="New conversation"
            className="rounded-md p-1.5 hover:bg-white/10 hover:opacity-100"
          >
            <RotateCcw size={14} />
          </button>
          {!embedded && (
            <button
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.share) {
                  navigator
                    .share({ title: bot.name, url: window.location.href })
                    .catch(() => {});
                } else if (typeof navigator !== "undefined") {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied to clipboard.");
                }
              }}
              title="Share"
              className="rounded-md p-1.5 hover:bg-white/10 hover:opacity-100"
            >
              <Share2 size={14} />
            </button>
          )}
        </div>
      </header>

      <ChatThread
        messages={messages}
        isStreaming={isStreaming}
        botName={bot.name}
        botInitials={bot.avatarInitials}
        botAvatarUrl={bot.avatarUrl}
        themeColor={bot.themeColor}
        chatTheme={bot.chatTheme}
        onRegenerate={regenerate}
      />

      {error && (
        <div className="mx-3 mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      )}

      {showStarters && <StarterPrompts prompts={bot.starterPrompts} onSelect={send} />}

      <MessageInput
        onSend={send}
        onStop={stop}
        isStreaming={isStreaming}
        className={theme.inputBar}
      />
    </div>
  );
}
