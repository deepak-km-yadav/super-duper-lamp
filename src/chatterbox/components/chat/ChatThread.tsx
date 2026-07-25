import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { cn } from "../../lib/utils";
import type { ChatMessage, ChatTheme } from "../../lib/types";
import { getChatTheme } from "../../lib/chat-themes";

export function ChatThread({
  messages,
  isStreaming,
  botName,
  botInitials,
  botAvatarUrl,
  themeColor,
  chatTheme,
  onRegenerate,
  showActions = true,
  emptyState,
}: {
  messages: ChatMessage[];
  isStreaming?: boolean;
  botName: string;
  botInitials?: string;
  botAvatarUrl?: string;
  themeColor: string;
  chatTheme?: ChatTheme;
  onRegenerate?: () => void;
  showActions?: boolean;
  emptyState?: React.ReactNode;
}) {
  const theme = getChatTheme(chatTheme);
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  if (messages.length === 0 && emptyState) {
    return <div className="flex-1 overflow-y-auto p-4">{emptyState}</div>;
  }

  return (
    <div className={cn("flex-1 overflow-y-auto", theme.thread)}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            message={m}
            botName={botName}
            botInitials={botInitials}
            botAvatarUrl={botAvatarUrl}
            themeColor={themeColor}
            chatTheme={chatTheme}
            isLast={i === messages.length - 1}
            isStreaming={Boolean(isStreaming) && i === messages.length - 1 && m.role === "assistant"}
            onRegenerate={onRegenerate}
            showActions={showActions}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  botName,
  botInitials,
  botAvatarUrl,
  themeColor,
  chatTheme,
  isLast,
  isStreaming,
  onRegenerate,
  showActions,
}: {
  message: ChatMessage;
  botName: string;
  botInitials?: string;
  botAvatarUrl?: string;
  themeColor: string;
  chatTheme?: ChatTheme;
  isLast: boolean;
  isStreaming: boolean;
  onRegenerate?: () => void;
  showActions: boolean;
}) {
  const theme = getChatTheme(chatTheme);
  const isUser = message.role === "user";
  const [copied, setCopied] = React.useState(false);

  const onCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("group flex gap-3 animate-slide-up", isUser && "flex-row-reverse")}>
      {!isUser && theme.showAvatars && (
        <Avatar
          name={botName}
          initials={botInitials}
          url={botAvatarUrl}
          color={themeColor}
          size={32}
        />
      )}
      <div className={cn("flex max-w-[88%] flex-col sm:max-w-[85%]", isUser && "items-end")}>
        <div
          className={cn(
            "prose-chat px-4 py-2.5 text-sm leading-relaxed transition-shadow",
            isUser ? theme.userBubble : theme.botBubble,
          )}
          style={
            isUser ? theme.userBubbleStyle(themeColor) : theme.botBubbleStyle(themeColor)
          }
        >
          {message.content === "" && isStreaming ? (
            <span className="typing-dots text-muted">
              <span /> <span /> <span />
            </span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          )}
        </div>
        {showActions && !isUser && message.content && !isStreaming && (
          <div className="mt-1 flex gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100">
            <IconButton onClick={onCopy} title={copied ? "Copied!" : "Copy"}>
              <Copy size={12} />
            </IconButton>
            {isLast && onRegenerate && (
              <IconButton onClick={onRegenerate} title="Regenerate">
                <RefreshCw size={12} />
              </IconButton>
            )}
            <IconButton title="Helpful">
              <ThumbsUp size={12} />
            </IconButton>
            <IconButton title="Not helpful">
              <ThumbsDown size={12} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded p-1 text-muted hover:bg-border/40 hover:text-fg"
    >
      {children}
    </button>
  );
}
