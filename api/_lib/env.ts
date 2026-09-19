/**
 * Normalisation for environment values.
 *
 * These arrive by copy and paste into a dashboard, so they routinely carry a
 * trailing newline, a wrapping pair of quotes, or a trailing slash. Comparing
 * or concatenating them raw turns an essentially correct value into a failure
 * with no explanation, so every read goes through here.
 */

/** Trim, then strip one wrapping pair of quotes, then trim again. */
export function readEnv(raw: string | undefined): string {
  const trimmed = (raw || "").trim();
  const unquoted = /^(["']).*\1$/s.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
  return unquoted.trim();
}

/**
 * Normalises a base URL: drops trailing slashes, and drops a `/rest/v1`
 * suffix, which is easy to include by mistake because it is what the REST
 * examples in the Supabase docs show.
 */
export function readEnvUrl(raw: string | undefined): string {
  return readEnv(raw)
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "")
    .replace(/\/+$/, "");
}

/** Human-readable reason a fetch to `url` failed, for surfacing to the caller. */
export function describeFetchFailure(error: unknown, url: string): string {
  const host = hostOf(url);
  const cause = (error as { cause?: { code?: string } })?.cause;
  const code = cause?.code ?? "";
  const message = error instanceof Error ? error.message : String(error);

  if (code === "ERR_INVALID_URL" || /Failed to parse URL/i.test(message)) {
    return (
      `SUPABASE_URL is not a valid URL (${JSON.stringify(url)}). It should look ` +
      "like https://your-project.supabase.co — including https://, with no quotes."
    );
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return (
      `Could not resolve ${host || "the Supabase host"}. Check SUPABASE_URL for a ` +
      "typo, and check in the Supabase dashboard that the project still exists " +
      "and is not paused — free projects pause after a period of inactivity."
    );
  }
  if (code === "ECONNREFUSED") return `${host} refused the connection.`;
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return `Timed out connecting to ${host}.`;
  }
  if (code === "CERT_HAS_EXPIRED" || /certificate/i.test(message)) {
    return `TLS problem connecting to ${host}: ${message}`;
  }
  return `Could not reach ${host || "Supabase"}: ${message}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
