/**
 * Drives the browser API client against a stubbed Response, so its error
 * messages can be asserted from the smoke test.
 */
import { apiFetch } from "../src/chatterbox/lib/api-client";

export async function apiFetchForTest(
  path: string,
  body: string,
  status: number,
): Promise<string> {
  const original = globalThis.fetch;
  (globalThis as unknown as { fetch: unknown }).fetch = async () =>
    ({ ok: status < 400, status, text: async () => body }) as Response;
  try {
    await apiFetch(path);
    return "<no error thrown>";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = original;
  }
}
