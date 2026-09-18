/**
 * React bindings for bot-store.ts.
 *
 * Uses the effect + tick-counter pattern DashboardPage already used for its
 * localStorage reads, so the call sites keep their existing shape.
 */

import * as React from "react";
import type { Bot } from "./types";
import {
  listBots,
  getBot,
  getPublicBot,
  StoreError,
  type PublicBotResult,
} from "./bot-store";

export type Async<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

function messageOf(e: unknown): string {
  if (e instanceof StoreError) return e.message;
  return e instanceof Error ? e.message : "Something went wrong.";
}

function useAsync<T>(
  load: () => Promise<T>,
  deps: React.DependencyList,
): Async<T> & { reload: () => void } {
  const [state, setState] = React.useState<Async<T>>({ status: "loading" });
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    load()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: "error", message: messageOf(e) });
      });
    return () => {
      cancelled = true;
    };
    // `load` is intentionally not a dependency: callers pass an inline closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useBots(before?: () => Promise<unknown>) {
  return useAsync<Bot[]>(async () => {
    if (before) await before();
    return listBots();
  }, []);
}

export function useBot(id: string | undefined) {
  return useAsync<Bot | null>(async () => (id ? getBot(id) : null), [id]);
}

export function usePublicBot(slug: string | undefined) {
  return useAsync<PublicBotResult>(
    async () => (slug ? getPublicBot(slug) : { kind: "missing" as const }),
    [slug],
  );
}
