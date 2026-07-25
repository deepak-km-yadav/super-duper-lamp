import * as React from "react";
import { Check } from "lucide-react";
import { CHAT_THEME_OPTIONS } from "../../lib/chat-themes";
import { Label } from "../ui/Input";
import type { ChatTheme } from "../../lib/types";
import { cn } from "../../lib/utils";

export function ChatThemePicker({
  value,
  onChange,
  accent,
}: {
  value: ChatTheme;
  onChange: (id: ChatTheme) => void;
  accent: string;
}) {
  return (
    <div>
      <Label>Chat window theme</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CHAT_THEME_OPTIONS.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-surface p-2 text-left transition-all hover:scale-[1.02]",
                active
                  ? "border-accent ring-2 ring-accent/40"
                  : "border-border hover:border-muted",
              )}
            >
              <ThemePreview themeId={opt.id} accent={accent} />
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="text-xs font-medium">{opt.name}</span>
                {active && <Check size={12} className="text-accent" />}
              </div>
              <p className="line-clamp-1 text-[10px] text-muted">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemePreview({ themeId, accent }: { themeId: ChatTheme; accent: string }) {
  const common = "h-16 w-full overflow-hidden rounded-md flex flex-col justify-end gap-1 p-1.5";

  if (themeId === "default") {
    return (
      <div className={cn(common, "bg-bg border border-border")}>
        <Bubble side="left" className="bg-surface border border-border">A</Bubble>
        <Bubble side="right" style={{ background: accent, color: "#fff" }}>B</Bubble>
      </div>
    );
  }
  if (themeId === "bubble") {
    return (
      <div
        className={cn(common, "border border-border")}
        style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(6,182,212,0.15))" }}
      >
        <Bubble side="left" className="rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur">A</Bubble>
        <Bubble
          side="right"
          className="rounded-2xl text-white"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)`, boxShadow: `0 4px 12px -4px ${accent}80` }}
        >B</Bubble>
      </div>
    );
  }
  if (themeId === "glass") {
    return (
      <div
        className={cn(common, "border border-white/10")}
        style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(56,189,248,0.25))", backdropFilter: "blur(8px)" }}
      >
        <Bubble side="left" className="rounded-xl border border-white/15 bg-white/10 backdrop-blur">A</Bubble>
        <Bubble side="right" className="rounded-xl text-white border border-white/20" style={{ background: `${accent}cc` }}>B</Bubble>
      </div>
    );
  }
  if (themeId === "neon") {
    return (
      <div
        className={cn(common, "border border-fuchsia-500/30")}
        style={{ background: "radial-gradient(ellipse at top, rgba(168,85,247,0.35), transparent 60%), radial-gradient(ellipse at bottom, rgba(34,211,238,0.35), transparent 60%), #0a0a14" }}
      >
        <Bubble side="left" className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-200" style={{ boxShadow: "0 0 8px rgba(34,211,238,0.4)" }}>A</Bubble>
        <Bubble side="right" className="rounded-xl text-white border border-fuchsia-400/50" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)`, boxShadow: "0 0 8px rgba(232,121,249,0.5)" }}>B</Bubble>
      </div>
    );
  }
  if (themeId === "terminal") {
    return (
      <div className={cn(common, "border border-emerald-500/30 bg-black font-mono")} style={{ color: "#a7f3d0" }}>
        <Bubble side="left" className="rounded border border-emerald-500/30 bg-emerald-500/10">$A</Bubble>
        <Bubble side="right" className="rounded border border-amber-400/40 bg-amber-400/10" style={{ color: "#fcd34d" }}>$B</Bubble>
      </div>
    );
  }
  // minimal
  return (
    <div className={cn(common, "bg-bg border border-border")}>
      <Bubble side="left" className="rounded-none border-l-2 border-muted/60 bg-transparent !pl-2">A</Bubble>
      <Bubble side="right" className="rounded-none border-l-2 bg-transparent !pl-2" style={{ borderLeftColor: accent }}>B</Bubble>
    </div>
  );
}

function Bubble({
  children,
  side,
  className,
  style,
}: {
  children: React.ReactNode;
  side: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("flex", side === "right" && "justify-end")}>
      <span className={cn("inline-block max-w-[60%] truncate px-2 py-0.5 text-[9px] leading-tight", className)} style={style}>
        {children}
      </span>
    </div>
  );
}
