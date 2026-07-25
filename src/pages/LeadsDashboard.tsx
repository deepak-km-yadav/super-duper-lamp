import { useCallback, useEffect, useMemo, useState } from "react";

type Lead = {
  id: number;
  ai?: string;
  ai_name?: string;
  email?: string;
  summary?: string;
  captured_at?: string;
  created_at?: string;
  source?: string;
};

const DEFAULT_API = "/api/leads";

export default function LeadsDashboard() {
  const [token, setToken] = useState("");
  const [ai, setAi] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("leads_dashboard_token");
    if (saved) setToken(saved);
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (token.trim()) params.set("token", token.trim());
    if (ai.trim()) params.set("ai", ai.trim());
    params.set("limit", "200");
    return params.toString();
  }, [token, ai]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = `${DEFAULT_API}?${queryString}`;
      const res = await fetch(url);
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) {
        setError(data?.error || `Failed (${res.status})`);
        setLeads([]);
      } else {
        setLeads(Array.isArray(data?.leads) ? data.leads : []);
      }
    } catch {
      setError("Failed to load leads");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const saveToken = () => {
    window.localStorage.setItem("leads_dashboard_token", token.trim());
  };

  useEffect(() => {
    if (!token.trim()) return;
    void load();
  }, [token, load]);

  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Lead Dashboard</h1>
        <p className="text-sm text-muted-foreground mb-6">Maverick and Niyati captures (email + short summary).</p>

        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <input
            className="border rounded-md px-3 py-2 bg-background"
            placeholder="Dashboard token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <input
            className="border rounded-md px-3 py-2 bg-background"
            placeholder="Filter by AI (optional)"
            value={ai}
            onChange={(e) => setAi(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="border rounded-md px-4 py-2" onClick={saveToken}>Save Token</button>
            <button className="border rounded-md px-4 py-2" onClick={load}>Refresh</button>
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground mb-3">Loading...</p>}
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left bg-muted/30">
                <th className="p-2">Time</th>
                <th className="p-2">AI</th>
                <th className="p-2">Email</th>
                <th className="p-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td className="p-3" colSpan={4}>No leads yet.</td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b align-top">
                    <td className="p-2 whitespace-nowrap">{lead.captured_at || lead.created_at || "-"}</td>
                    <td className="p-2">{lead.ai_name || lead.ai || "-"}</td>
                    <td className="p-2">{lead.email || "-"}</td>
                    <td className="p-2 whitespace-pre-wrap break-words max-w-[700px]">{lead.summary || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
