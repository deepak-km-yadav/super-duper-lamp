import * as React from "react";
import { Send, StopCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export function MessageInput({
  onSend,
  onStop,
  isStreaming,
  placeholder = "Send a message…",
  disabled,
  className,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [value, setValue] = React.useState("");
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className={cn("p-3", className ?? "border-t border-border bg-surface")}>
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border bg-bg/60 px-3 py-2 transition-shadow focus-within:ring-2 focus-within:ring-accent">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[24px] w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted/70 sm:text-sm"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="grid h-8 w-8 place-items-center rounded-md bg-red-500/15 text-red-500 hover:bg-red-500/25"
            title="Stop"
          >
            <StopCircle size={16} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-fg transition-opacity",
              (!value.trim() || disabled) && "opacity-40",
            )}
            title="Send"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
