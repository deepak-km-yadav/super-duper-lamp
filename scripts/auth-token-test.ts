/**
 * Admin-token regression tests.
 *
 * A correct token was being rejected because the configured value was compared
 * raw while the incoming one was trimmed, so a trailing newline or a wrapping
 * pair of quotes in the Vercel variable never matched. These load the auth
 * module under each env shape, which needs a fresh module registry per case.
 *
 * Run with: npm run test:auth
 */

const TOKEN = "hukdt2snNo-E-AGLApZYMX9GWIMvqUVVZJxKjmEihl0";

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log("  ok   " + name);
  } else {
    fail++;
    console.log("  FAIL " + name, extra !== undefined ? JSON.stringify(extra) : "");
  }
}

/** Re-imports the auth module with a given environment. */
async function withEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Cache-bust so module-level env reads re-run.
  return import(`../api/_lib/auth.js?v=${Math.random()}`);
}

async function run() {
  console.log("\n-- the configured value is normalised --");
  for (const [label, raw] of [
    ["clean value", TOKEN],
    ["trailing newline", TOKEN + "\n"],
    ["trailing space", TOKEN + " "],
    ["leading space", " " + TOKEN],
    ['wrapped in "double quotes"', `"${TOKEN}"`],
    ["wrapped in 'single quotes'", `'${TOKEN}'`],
    ["quoted with a newline", `"${TOKEN}"\n`],
  ] as [string, string][]) {
    const auth = await withEnv({ BOTFORGE_ADMIN_TOKEN: raw, LEADS_DASHBOARD_TOKEN: undefined });
    check(`accepts a correct token when the env value has a ${label}`, auth.isAdminToken(TOKEN));
  }

  console.log("\n-- the supplied value is normalised too --");
  {
    const auth = await withEnv({ BOTFORGE_ADMIN_TOKEN: TOKEN, LEADS_DASHBOARD_TOKEN: undefined });
    check("accepts a supplied token with a trailing newline", auth.isAdminToken(TOKEN + "\n"));
    check("accepts a supplied token wrapped in quotes", auth.isAdminToken(`"${TOKEN}"`));
  }

  console.log("\n-- wrong tokens are still rejected --");
  {
    const auth = await withEnv({ BOTFORGE_ADMIN_TOKEN: TOKEN, LEADS_DASHBOARD_TOKEN: undefined });
    check("rejects a different token", !auth.isAdminToken("not-the-token"));
    check("rejects an empty token", !auth.isAdminToken(""));
    check("rejects whitespace only", !auth.isAdminToken("   "));
    check("rejects null", !auth.isAdminToken(null));
    check("rejects a token off by one character", !auth.isAdminToken(TOKEN.slice(0, -1) + "X"));
    check("rejects a prefix of the token", !auth.isAdminToken(TOKEN.slice(0, -1)));
  }

  console.log("\n-- the legacy leads token no longer grants admin access --");
  {
    const auth = await withEnv({
      BOTFORGE_ADMIN_TOKEN: undefined,
      LEADS_DASHBOARD_TOKEN: "old-leads-password",
    });
    check("legacy token is rejected", !auth.isAdminToken("old-leads-password"));
    check(
      "and auth reports itself unconfigured, so endpoints 503 rather than 401",
      !auth.isAdminConfigured(),
    );
  }

  console.log("\n-- unset means closed, not open --");
  {
    const auth = await withEnv({ BOTFORGE_ADMIN_TOKEN: undefined, LEADS_DASHBOARD_TOKEN: undefined });
    check("no token configured -> not configured", !auth.isAdminConfigured());
    check("no token configured -> nothing is accepted", !auth.isAdminToken(TOKEN));
    check("no token configured -> empty is not accepted", !auth.isAdminToken(""));
    check("length reports zero", auth.adminTokenLength() === 0);
  }

  console.log("\n-- length is exposed for diagnostics, value never is --");
  {
    const auth = await withEnv({ BOTFORGE_ADMIN_TOKEN: `"${TOKEN}"\n`, LEADS_DASHBOARD_TOKEN: undefined });
    check("length is of the normalised value", auth.adminTokenLength() === TOKEN.length, auth.adminTokenLength());
    check("variable name is reported", auth.ADMIN_TOKEN_VARIABLE === "BOTFORGE_ADMIN_TOKEN");
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

run();
