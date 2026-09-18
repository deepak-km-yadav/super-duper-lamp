/**
 * Minimal Vercel Node-handler types, matching the hand-rolled style already
 * used by api/leads.ts and api/lead-capture.ts (the project has no
 * @vercel/node dependency).
 */

export type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (payload: unknown) => void; end?: () => void };
};

export function queryParam(req: ApiRequest, name: string): string {
  const v = req.query?.[name];
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return (v ?? "").trim();
}

export function header(req: ApiRequest, name: string): string {
  const v = req.headers?.[name.toLowerCase()];
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return (v ?? "").trim();
}

/** Vercel parses JSON bodies, but a sendBeacon body can arrive as a string. */
export function jsonBody(req: ApiRequest): Record<string, unknown> {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return typeof b === "object" ? (b as Record<string, unknown>) : {};
}

export function applyCors(res: ApiResponse, methods: string): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", `${methods}, OPTIONS`);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
}
