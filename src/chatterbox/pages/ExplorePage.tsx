import * as React from "react";
import { Link } from "react-router-dom";
import { Compass, Plus } from "lucide-react";
import { Avatar } from "../components/ui/Avatar";
import { listLocal } from "../lib/local-store";
import type { Bot } from "../lib/types";

export function ExplorePage() {
  const published = React.useMemo(
    () => listLocal().filter((b) => b.status === "PUBLISHED"),
    [],
  );

  return (
    <div className="bg-orbs" style={{ minHeight: "100%" }}>
      <main className="relative mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
        <div className="mb-6 flex animate-slide-down items-center gap-2 sm:mb-8">
          <Compass size={20} className="text-accent" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Explore</h1>
            <p className="text-sm text-muted">Your published bots</p>
          </div>
        </div>

        {published.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <Compass className="mx-auto mb-3 text-muted" size={28} />
            <h2 className="font-semibold">No published bots yet</h2>
            <p className="mt-1 text-sm text-muted">
              Publish a bot from the editor to make it shareable.
            </p>
            <Link
              to="/chatterbox/bots/new"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              <Plus size={16} /> Create a Bot
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {published.map((bot, i) => (
              <PublishedBotCard key={bot.id} bot={bot} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function PublishedBotCard({ bot, index }: { bot: Bot; index: number }) {
  return (
    <Link
      to={`/chatterbox/chat/${bot.slug}`}
      className="card-lift group flex animate-slide-up flex-col rounded-xl border border-border bg-surface/70 p-5 backdrop-blur transition-colors hover:border-accent"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start gap-3">
        <Avatar
          name={bot.name}
          initials={bot.avatarInitials}
          url={bot.avatarUrl}
          color={bot.themeColor}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{bot.name}</h3>
          <p className="line-clamp-2 text-sm text-muted">{bot.bio || "No bio yet."}</p>
        </div>
      </div>
      {bot.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {bot.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
