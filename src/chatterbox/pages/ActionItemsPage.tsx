import * as React from "react";
import {
  CalendarClock,
  ChevronDown,
  Download,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Input";
import { toast } from "../components/ui/Toast";
import { AdminTokenPrompt, ErrorState } from "../components/AdminGate";
import { ChatterboxNav } from "../components/ChatterboxNav";
import { hasAdminToken, isAuthError } from "../lib/admin-token";
import { fmtDate } from "../lib/utils";
import {
  fetchActionItems,
  fetchTranscript,
  setItemStatus,
  toCsv,
  downloadCsv,
  type ActionItems,
  type Lead,
  type Meeting,
  type TranscriptMessage,
} from "../lib/action-items";

type Tab = "leads" | "meetings";

const LEAD_STATUSES = ["NEW", "CONTACTED", "DONE", "SPAM"];
const MEETING_STATUSES = ["NEW", "SCHEDULED", "DECLINED", "DONE"];

export function ActionItemsPage() {
  const [hasToken, setHasToken] = React.useState(hasAdminToken);
  const [tab, setTab] = React.useState<Tab>("leads");
  const [data, setData] = React.useState<ActionItems | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [includeTest, setIncludeTest] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchActionItems(includeTest));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load action items.");
    } finally {
      setLoading(false);
    }
  }, [includeTest]);

  React.useEffect(() => {
    if (hasToken) void load();
  }, [hasToken, load]);

  if (!hasToken) {
    return (
      <Shell>
        <AdminTokenPrompt onSaved={() => setHasToken(true)} />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        {isAuthError(error) ? (
          <AdminTokenPrompt rejected onSaved={() => void load()} />
        ) : (
          <ErrorState message={error} onRetry={() => void load()} />
        )}
      </Shell>
    );
  }

  const leads = data?.leads ?? [];
  const meetings = data?.meetings ?? [];

  const exportCsv = () => {
    if (tab === "leads") {
      downloadCsv(
        `leads-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(leads as unknown as Record<string, unknown>[], [
          "createdAt", "botName", "name", "email", "phone", "company",
          "intent", "summary", "status", "contextSnippet",
        ]),
      );
    } else {
      downloadCsv(
        `meetings-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(meetings as unknown as Record<string, unknown>[], [
          "createdAt", "botName", "name", "email", "requestedFor",
          "timezone", "topic", "status", "contextSnippet",
        ]),
      );
    }
  };

  const rows = tab === "leads" ? leads.length : meetings.length;

  return (
    <Shell>
      <div className="mb-5 flex animate-slide-down flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Action Items</h1>
          <p className="text-sm text-muted">
            What your agent bots picked up from conversations.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="mr-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
            />
            Show test captures
          </label>
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={rows === 0}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-surface p-1 text-sm">
        <TabButton active={tab === "leads"} onClick={() => setTab("leads")}>
          <UserRound size={14} /> Leads collected ({leads.length})
        </TabButton>
        <TabButton active={tab === "meetings"} onClick={() => setTab("meetings")}>
          <CalendarClock size={14} /> Meetings requested ({meetings.length})
        </TabButton>
      </div>

      {loading && !data && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface/70" />
          ))}
        </div>
      )}

      {!loading && rows === 0 && (
        <EmptyState tab={tab} />
      )}

      <div className="space-y-2">
        {tab === "leads"
          ? leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onChanged={() => void load()} />
            ))
          : meetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} onChanged={() => void load()} />
            ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-orbs" style={{ minHeight: "100%" }}>
      <main className="relative mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
        <ChatterboxNav />
        {children}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 transition-colors ${
        active ? "bg-bg shadow-sm" : "text-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
      <Inbox className="mx-auto mb-3 text-muted" size={28} />
      <h2 className="font-semibold">
        {tab === "leads" ? "No leads yet" : "No meeting requests yet"}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Turn on <strong>Act as an Agent</strong> in a bot's settings and enable{" "}
        {tab === "leads" ? "Lead Magnet" : "Scheduler"}. Anything it picks up in a
        conversation shows up here.
      </p>
    </div>
  );
}

function Card({
  title,
  isTest,
  subtitle,
  meta,
  status,
  statuses,
  onStatus,
  snippet,
  sessionId,
  children,
}: {
  title: string;
  isTest?: boolean;
  subtitle?: React.ReactNode;
  meta: string;
  status: string;
  statuses: string[];
  onStatus: (s: string) => void;
  snippet: string;
  sessionId: string | null;
  children?: React.ReactNode;
}) {
  const [showChat, setShowChat] = React.useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 truncate font-semibold">
            {title}
            {isTest && (
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                Test
              </span>
            )}
          </h3>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
          {children}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={status}
            onChange={(e) => onStatus(e.target.value)}
            className="h-8 w-auto text-xs"
            aria-label="Status"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
          From the conversation
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">
          {snippet || "No context was captured."}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{meta}</span>
        {sessionId && (
          <button
            type="button"
            onClick={() => setShowChat((v) => !v)}
            className="inline-flex items-center gap-1 hover:text-fg"
            aria-expanded={showChat}
          >
            <MessageSquare size={11} />
            {showChat ? "Hide" : "View"} full conversation
            <ChevronDown
              size={11}
              className={`transition-transform ${showChat ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {showChat && sessionId && <Transcript sessionId={sessionId} />}
    </div>
  );
}

function Transcript({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = React.useState<TranscriptMessage[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchTranscript(sessionId)
      .then((r) => !cancelled && setMessages(r.messages))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load."));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) return <p className="mt-2 text-xs text-red-500">{error}</p>;
  if (!messages) {
    return (
      <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
        <Loader2 size={11} className="animate-spin" /> Loading conversation…
      </p>
    );
  }
  if (messages.length === 0) {
    return <p className="mt-2 text-xs text-muted">No messages were recorded.</p>;
  }

  return (
    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-bg/40 p-3">
      {messages.map((m, i) => (
        <div key={i} className="text-xs">
          <span className="font-medium">{m.role === "user" ? "Visitor" : "Bot"}: </span>
          <span className="whitespace-pre-wrap text-muted">{m.content}</span>
        </div>
      ))}
    </div>
  );
}

function LeadCard({ lead, onChanged }: { lead: Lead; onChanged: () => void }) {
  const update = async (status: string) => {
    try {
      await setItemStatus("lead", lead.id, status);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status.");
    }
  };

  return (
    <Card
      title={lead.name || lead.email || lead.phone || "Unnamed lead"}
      isTest={lead.isTest}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-fg">
              <Mail size={12} /> {lead.email}
            </a>
          )}
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-fg">
              <Phone size={12} /> {lead.phone}
            </a>
          )}
          {lead.company && <span>{lead.company}</span>}
        </span>
      }
      meta={`${lead.botName} · ${fmtDate(lead.createdAt)}${
        lead.intent ? ` · ${lead.intent}` : ""
      }`}
      status={lead.status}
      statuses={LEAD_STATUSES}
      onStatus={(s) => void update(s)}
      snippet={lead.contextSnippet}
      sessionId={lead.sessionId}
    >
      {lead.summary && <p className="mt-1.5 text-sm">{lead.summary}</p>}
    </Card>
  );
}

function MeetingCard({ meeting, onChanged }: { meeting: Meeting; onChanged: () => void }) {
  const update = async (status: string) => {
    try {
      await setItemStatus("meeting", meeting.id, status);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status.");
    }
  };

  return (
    <Card
      title={meeting.requestedFor || "Meeting requested"}
      isTest={meeting.isTest}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {meeting.name && (
            <span className="inline-flex items-center gap-1">
              <UserRound size={12} /> {meeting.name}
            </span>
          )}
          {meeting.email && (
            <a href={`mailto:${meeting.email}`} className="inline-flex items-center gap-1 hover:text-fg">
              <Mail size={12} /> {meeting.email}
            </a>
          )}
          {meeting.timezone && <span>{meeting.timezone}</span>}
        </span>
      }
      meta={`${meeting.botName} · requested ${fmtDate(meeting.createdAt)}`}
      status={meeting.status}
      statuses={MEETING_STATUSES}
      onStatus={(s) => void update(s)}
      snippet={meeting.contextSnippet}
      sessionId={meeting.sessionId}
    >
      {meeting.topic && <p className="mt-1.5 text-sm">{meeting.topic}</p>}
    </Card>
  );
}
