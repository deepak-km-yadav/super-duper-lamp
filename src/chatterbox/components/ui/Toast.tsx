import * as React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

type ToastKind = "success" | "error" | "info";
type ToastEntry = { id: number; kind: ToastKind; message: string };

const listeners = new Set<(t: ToastEntry) => void>();
let nextId = 1;

function emit(kind: ToastKind, message: string) {
  const entry: ToastEntry = { id: nextId++, kind, message };
  listeners.forEach((fn) => fn(entry));
}

export const toast = {
  success: (m: string) => emit("success", m),
  error: (m: string) => emit("error", m),
  info: (m: string) => emit("info", m),
};

const ICONS: Record<ToastKind, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastKind, string> = {
  success: "border-green-500/30 bg-green-500/10 text-green-500",
  error: "border-red-500/30 bg-red-500/10 text-red-500",
  info: "border-accent/30 bg-accent/10 text-accent",
};

export function Toaster() {
  const [items, setItems] = React.useState<ToastEntry[]>([]);

  React.useEffect(() => {
    const onToast = (t: ToastEntry) => {
      setItems((cur) => [...cur, t]);
      setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== t.id));
      }, 3500);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  const dismiss = (id: number) => {
    setItems((cur) => cur.filter((x) => x.id !== id));
  };

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:right-4 sm:top-4 sm:items-end sm:px-0">
      {items.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border bg-surface px-3 py-2 text-sm shadow-lg backdrop-blur",
              "animate-slide-up",
              STYLES[t.kind],
            )}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1 text-fg">{t.message}</div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-muted hover:bg-border/40 hover:text-fg"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
