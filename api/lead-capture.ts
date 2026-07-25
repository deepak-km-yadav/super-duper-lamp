type Req = {
  method?: string;
  body?: {
    ai?: string;
    aiName?: string;
    email?: string;
    summary?: string;
    capturedAt?: string;
  };
};

type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (payload: unknown) => void };
};

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export default async function handler(req: Req, res: Res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase env vars are missing" });
  }

  const email = String(req.body?.email || "").trim();
  const ai = String(req.body?.ai || "unknown").trim();
  const aiName = String(req.body?.aiName || ai || "unknown").trim();
  const summary = String(req.body?.summary || "").trim().slice(0, 2000);
  const capturedAt = String(req.body?.capturedAt || new Date().toISOString()).trim();

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/lead_captures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        ai,
        ai_name: aiName,
        email,
        summary,
        captured_at: capturedAt,
        source: "chat",
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: raw || "Failed to save lead" });
    }

    return res.status(200).json({ ok: true, saved: raw ? JSON.parse(raw) : true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to write lead" });
  }
}
