import { Sparkles } from "lucide-react";

export function StarterPrompts({
  prompts,
  onSelect,
}: {
  prompts: string[];
  onSelect: (text: string) => void;
}) {
  if (!prompts.length) return null;
  return (
    <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
      {prompts.map((p, i) => (
        <button
          key={i}
          onClick={() => onSelect(p)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-fg sm:shrink"
        >
          <Sparkles size={11} className="text-accent" />
          <span className="truncate max-w-[200px] sm:max-w-none">{p}</span>
        </button>
      ))}
    </div>
  );
}
