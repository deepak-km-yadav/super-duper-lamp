import * as React from "react";
import type { ChatTheme } from "./types";

export type ChatThemeStyles = {
  surface: string;
  background: string;
  header: string;
  thread: string;
  botBubble: string;
  userBubble: string;
  userBubbleStyle: (accent: string) => React.CSSProperties;
  botBubbleStyle: (accent: string) => React.CSSProperties;
  inputBar: string;
  showAvatars: boolean;
  fontFamily?: string;
  textColor?: string;
};

export const CHAT_THEMES: Record<ChatTheme, ChatThemeStyles> = {
  default: {
    surface: "",
    background: "bg-bg",
    header: "bg-surface border-b border-border",
    thread: "",
    botBubble: "bg-surface border border-border rounded-2xl",
    userBubble: "rounded-2xl text-white",
    userBubbleStyle: (accent) => ({ background: accent }),
    botBubbleStyle: () => ({}),
    inputBar: "border-t border-border bg-surface",
    showAvatars: true,
  },
  bubble: {
    surface: "",
    background:
      "bg-gradient-to-br from-fuchsia-500/10 via-bg to-cyan-500/10 dark:from-fuchsia-500/15 dark:via-bg dark:to-cyan-500/15",
    header: "bg-surface/80 backdrop-blur-md border-b border-white/5",
    thread: "",
    botBubble:
      "rounded-3xl rounded-tl-md border border-border/60 shadow-lg shadow-black/5",
    userBubble: "rounded-3xl rounded-tr-md text-white shadow-lg",
    userBubbleStyle: (accent) => ({
      background: `linear-gradient(135deg, ${accent}, ${shade(accent, -25)})`,
      boxShadow: `0 8px 24px -8px ${accent}80`,
    }),
    botBubbleStyle: () => ({
      background: "hsl(var(--surface))",
    }),
    inputBar: "bg-surface/80 backdrop-blur-md border-t border-white/5",
    showAvatars: true,
  },
  glass: {
    surface: "",
    background: "relative",
    header: "bg-white/5 backdrop-blur-xl border-b border-white/10",
    thread: "",
    botBubble:
      "rounded-2xl border border-white/10 backdrop-blur-md bg-white/5 shadow-xl",
    userBubble:
      "rounded-2xl text-white border border-white/20 backdrop-blur-md shadow-xl",
    userBubbleStyle: (accent) => ({
      background: `linear-gradient(135deg, ${accent}cc, ${shade(accent, -30)}cc)`,
    }),
    botBubbleStyle: () => ({}),
    inputBar: "bg-white/5 backdrop-blur-xl border-t border-white/10",
    showAvatars: true,
  },
  terminal: {
    surface: "font-mono",
    background: "bg-black",
    header: "bg-black border-b border-emerald-500/30 text-emerald-400",
    thread: "",
    botBubble:
      "rounded-md border border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    userBubble: "rounded-md border border-amber-400/40 bg-amber-400/5",
    userBubbleStyle: () => ({ color: "#fcd34d" }),
    botBubbleStyle: () => ({}),
    inputBar:
      "bg-black border-t border-emerald-500/30 [&_input]:text-emerald-300 [&_textarea]:text-emerald-300",
    showAvatars: false,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    textColor: "#a7f3d0",
  },
  minimal: {
    surface: "",
    background: "bg-bg",
    header: "border-b border-border",
    thread: "",
    botBubble: "border-l-2 pl-3 rounded-none",
    userBubble: "border-l-2 pl-3 rounded-none text-fg",
    userBubbleStyle: (accent) => ({
      borderLeftColor: accent,
      background: "transparent",
      color: "hsl(var(--fg))",
    }),
    botBubbleStyle: () => ({
      borderLeftColor: "hsl(var(--muted))",
      background: "transparent",
    }),
    inputBar: "border-t border-border",
    showAvatars: false,
  },
  neon: {
    surface: "",
    background:
      "bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.18),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(34,211,238,0.18),transparent_60%)] bg-[#0a0a14]",
    header: "bg-black/40 backdrop-blur-md border-b border-fuchsia-500/30",
    thread: "",
    botBubble:
      "rounded-2xl border border-cyan-400/40 bg-cyan-400/5 shadow-[0_0_20px_rgba(34,211,238,0.15)]",
    userBubble:
      "rounded-2xl text-white border border-fuchsia-400/50 shadow-[0_0_20px_rgba(232,121,249,0.25)]",
    userBubbleStyle: (accent) => ({
      background: `linear-gradient(135deg, ${accent}, ${shade(accent, -20)})`,
    }),
    botBubbleStyle: () => ({}),
    inputBar: "bg-black/40 backdrop-blur-md border-t border-fuchsia-500/30",
    showAvatars: true,
  },
};

export const CHAT_THEME_OPTIONS: {
  id: ChatTheme;
  name: string;
  description: string;
  preview: string;
}[] = [
  {
    id: "default",
    name: "Default",
    description: "Clean rounded bubbles. Works everywhere.",
    preview: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  },
  {
    id: "bubble",
    name: "Soft Bubble",
    description: "Pillow-rounded with gentle gradient backdrop.",
    preview: "linear-gradient(135deg, #ec4899, #06b6d4)",
  },
  {
    id: "glass",
    name: "Glass",
    description: "Frosted glassmorphism over a translucent surface.",
    preview: "linear-gradient(135deg, #a78bfa, #38bdf8)",
  },
  {
    id: "neon",
    name: "Neon",
    description: "Cyberpunk glow on a dark canvas.",
    preview: "linear-gradient(135deg, #d946ef, #06b6d4)",
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Monospace green-on-black. Hacker chic.",
    preview: "linear-gradient(135deg, #10b981, #022c22)",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "No bubbles. Quiet, document-like.",
    preview: "linear-gradient(135deg, #94a3b8, #475569)",
  },
];

export function getChatTheme(id?: ChatTheme): ChatThemeStyles {
  return CHAT_THEMES[id ?? "default"] ?? CHAT_THEMES.default;
}

function shade(hex: string, percent: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const out = [r, g, b].map((c) => Math.round((t - c) * p + c));
  return "#" + out.map((c) => c.toString(16).padStart(2, "0")).join("");
}
