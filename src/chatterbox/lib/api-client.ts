/**
 * Shared fetch wrapper for the BotForge admin APIs.
 *
 * Exists mainly to turn the two failures that actually happen during setup into
 * messages that name the cause. The common one by far is the API route not
 * running at all -- `npm run dev` starts Vite, which does not serve /api, so
 * every call falls through to the SPA and returns index.html. Parsing that as
 * JSON used to produce "The server returned an unexpected response", which
 * pointed at nothing.
 */

import { getAdminToken } from "./admin-token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** A body starting with '<' is an HTML page, not an API response. */
function looksLikeHtml(text: string): boolean {
  return /^\s*(<!doctype|<html|<\?xml)/i.test(text);
}

function htmlResponseMessage(path: string, status: number): string {
  const where = `${path} returned a web page instead of data`;
  if (status === 404) {
    return (
      `${where} (404). The API route isn't deployed. ` +
      "Running locally? `npm run dev` starts Vite only, which doesn't serve /api — " +
      "use `npx vercel dev` instead."
    );
  }
  return (
    `${where} (HTTP ${status}). The serverless function isn't running or crashed before it ` +
    "could reply. Locally, use `npx vercel dev` rather than `npm run dev`; on Vercel, check " +
    "the function logs for this route."
  );
}

export type ApiInit = {
  method?: string;
  body?: unknown;
  /** Admin endpoints send the shared token; public ones must not. */
  auth?: boolean;
};

export async function apiFetch<T>(path: string, init?: ApiInit): Promise<T> {
  const auth = init?.auth ?? true;

  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { "x-admin-token": getAdminToken() } : {}),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection.", 0);
  }

  const text = await res.text();

  if (looksLikeHtml(text)) {
    throw new ApiError(htmlResponseMessage(path, res.status), res.status);
  }

  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      const preview = text.slice(0, 120).replace(/\s+/g, " ").trim();
      throw new ApiError(
        `${path} returned a response that isn't JSON (HTTP ${res.status}): ${preview}`,
        res.status,
      );
    }
  }

  if (!res.ok) {
    throw new ApiError(
      typeof payload.error === "string" && payload.error
        ? payload.error
        : res.status === 401
          ? "Unauthorized. Check your admin token in Settings."
          : res.status === 503
            ? "The server is missing configuration. Check the environment variables."
            : `Request failed (${res.status}).`,
      res.status,
    );
  }

  return payload as T;
}
