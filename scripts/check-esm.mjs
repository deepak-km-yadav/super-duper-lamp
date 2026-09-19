/**
 * Verifies every serverless function actually loads under Node ESM.
 *
 * package.json sets "type": "module", so Node refuses extensionless relative
 * imports at runtime. TypeScript and esbuild both resolve them happily, and the
 * Vite build never touches api/, so an import written as "./_lib/supabase"
 * passes every other check here and then fails in production as
 * FUNCTION_INVOCATION_FAILED. This compiles api/ and imports each handler the
 * way the deployed runtime does.
 *
 * Run with: npm run check:esm
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = mkdtempSync(join(tmpdir(), "botforge-esm-"));

try {
  execFileSync(
    "npx",
    ["tsc", "-p", "tsconfig.api.json", "--noEmit", "false", "--outDir", out],
    { stdio: "inherit" },
  );

  // Force Node to treat the emitted files as ES modules, as Vercel will.
  writeFileSync(join(out, "package.json"), '{"type":"module"}');

  const handlers = readdirSync(out).filter(
    (f) => f.endsWith(".js") && !f.startsWith("_"),
  );

  if (handlers.length === 0) {
    console.error("No handlers were emitted — nothing was checked.");
    process.exit(1);
  }

  let failed = 0;
  for (const file of handlers.sort()) {
    const name = file.replace(/\.js$/, "");
    try {
      const mod = await import(pathToFileURL(join(out, file)).href);
      if (typeof mod.default !== "function") {
        console.log(`  FAIL ${name} — no default export`);
        failed++;
      } else {
        console.log(`  ok   ${name}`);
      }
    } catch (e) {
      console.log(`  FAIL ${name} — ${e.code ?? "Error"}: ${String(e.message).split("\n")[0]}`);
      failed++;
    }
  }

  console.log(
    failed
      ? `\n${failed} function(s) would crash on Vercel.\n`
      : `\nAll ${handlers.length} functions load under Node ESM.\n`,
  );
  process.exit(failed ? 1 : 0);
} finally {
  rmSync(out, { recursive: true, force: true });
}
