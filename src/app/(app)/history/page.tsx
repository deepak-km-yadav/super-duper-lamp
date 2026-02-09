"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import {
  History,
  Search,
  Filter,
  SortAsc,
  Trash2,
  RefreshCw,
  ChevronDown,
  Music,
  AlertCircle,
} from "lucide-react";
import AudioPlayer from "@/components/audio/AudioPlayer";
import type { Generation } from "@/types";
import toast from "react-hot-toast";

export default function HistoryPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      redirect("/login");
    }
  }, [authStatus]);

  const fetchHistory = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        sort,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(search && { search }),
      });

      const res = await fetch(`/api/generations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGenerations(data.generations);
        setTotalPages(data.totalPages);
      }
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [session, page, sort, statusFilter, search]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this generation? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/generations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setGenerations((prev) => prev.filter((g) => g.id !== id));
        toast.success("Generation deleted");
      }
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRemix = (gen: Generation) => {
    // Store generation data in sessionStorage for the generate page to pick up
    sessionStorage.setItem("remix", JSON.stringify(gen));
    router.push("/generate");
    toast.success("Settings loaded! Tweak and regenerate.");
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      processing: "bg-amber-500/15 text-amber-400 border-amber-500/20",
      queued: "bg-blue-500/15 text-blue-400 border-blue-500/20",
      failed: "bg-red-500/15 text-red-400 border-red-500/20",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status] || styles.queued}`}>
        {status}
      </span>
    );
  };

  if (authStatus === "loading") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-pink-50 flex items-center gap-3">
            <History className="w-7 h-7 text-rose-400" />
            Generation History
          </h1>
          <p className="text-pink-100/40 mt-1 text-sm">
            All your generated songs in one place
          </p>
        </div>
        <button onClick={fetchHistory} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Search & Filters */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-100/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="valentine-input !pl-10"
              placeholder="Search by title, prompt, or dedication..."
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2 text-sm sm:w-auto"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-rose-500/10">
            <div>
              <label className="block text-xs text-pink-100/40 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="valentine-input text-sm !py-1.5"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="queued">Queued</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-pink-100/40 mb-1">Sort</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSort("newest")}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    sort === "newest"
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                      : "border-rose-500/10 text-pink-100/40"
                  }`}
                >
                  Newest
                </button>
                <button
                  onClick={() => setSort("oldest")}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    sort === "oldest"
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                      : "border-rose-500/10 text-pink-100/40"
                  }`}
                >
                  <SortAsc className="w-3 h-3 inline mr-1" />
                  Oldest
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-28 w-full" />
          ))}
        </div>
      ) : generations.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Music className="w-12 h-12 text-rose-500/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-pink-50 mb-2">No generations yet</h3>
          <p className="text-sm text-pink-100/40 mb-6">
            Start creating love songs and they&apos;ll appear here
          </p>
          <a href="/generate" className="btn-primary inline-flex items-center gap-2">
            Create your first song
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {generations.map((gen) => (
            <div key={gen.id} className="glass-card glass-card-hover p-5 transition-all">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-pink-50 truncate">
                      {gen.title || gen.prompt?.slice(0, 60) || "Untitled"}
                    </h3>
                    {getStatusBadge(gen.status)}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-pink-100/30">
                    <span>{new Date(gen.createdAt).toLocaleDateString()}</span>
                    {gen.mode && <span className="capitalize">{gen.mode} mode</span>}
                    {gen.genre && <span>{gen.genre}</span>}
                    {gen.mood && <span>{gen.mood}</span>}
                  </div>
                  {gen.dedicationTo && (
                    <p className="text-xs text-rose-400/60 mt-1">
                      To: {gen.dedicationTo}
                      {gen.dedicationFrom ? ` from ${gen.dedicationFrom}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleRemix(gen)}
                    className="p-2 text-pink-100/30 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/5"
                    title="Remix with same settings"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(gen.id)}
                    disabled={deletingId === gen.id}
                    className="p-2 text-pink-100/30 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5"
                    title="Delete"
                  >
                    {deletingId === gen.id ? (
                      <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Inline audio playback for completed generations */}
              {gen.status === "completed" && gen.tracks && gen.tracks.length > 0 && (
                <div className="space-y-2 mt-3">
                  {gen.tracks.map((track) => (
                    <div key={track.id}>
                      {track.audioUrl && (
                        <AudioPlayer
                          src={track.audioUrl}
                          title={track.title || "Untitled Track"}
                          styleTags={track.styleTags || undefined}
                          duration={track.duration || undefined}
                          compact
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {gen.status === "failed" && gen.errorMessage && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-400/80">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {gen.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn-secondary text-sm !py-1.5 !px-4 disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-pink-100/40">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="btn-secondary text-sm !py-1.5 !px-4 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
