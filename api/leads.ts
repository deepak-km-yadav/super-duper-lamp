type Req = {
  method?: string;
  query?: { token?: string; limit?: string; ai?: string };
};

type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (payload: unknown) => void };
};

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const LEADS_DASHBOARD_TOKEN = process.env.LEADS_DASHBOARD_TOKEN || "";

export default async function handler(req: Req, res: Res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase env vars are missing" });
  }

  if (LEADS_DASHBOARD_TOKEN) {
    const token = (req.query?.token || "").trim();
    if (token !== LEADS_DASHBOARD_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const limitRaw = Number(req.query?.limit || "100");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
  const aiFilter = (req.query?.ai || "").trim();

  const params = new URLSearchParams({
    select: "id,ai,ai_name,email,summary,captured_at,created_at,source",
    order: "captured_at.desc.nullslast",
    limit: String(limit),
  });

  if (aiFilter) {
    params.set("ai", `ilike.*${aiFilter}*`);
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/lead_captures?${params.toString()}`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    const raw = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: raw || "Failed to load leads" });
    }

    return res.status(200).json({ leads: raw ? JSON.parse(raw) : [] });
  } catch {
    return res.status(500).json({ error: "Failed to query leads" });
  }
}
