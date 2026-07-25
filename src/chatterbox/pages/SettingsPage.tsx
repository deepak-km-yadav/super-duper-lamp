import * as React from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { ManageApiKeys } from "../components/settings/ManageApiKeys";
import { UsageCard } from "../components/settings/UsageCard";

export function SettingsPage() {
  return (
    <div className="bg-orbs" style={{ minHeight: "100%" }}>
      <main className="relative mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
        <div className="mb-6 flex animate-slide-down items-center gap-2 sm:mb-8">
          <SettingsIcon size={20} className="text-accent" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        </div>

        <div className="space-y-5">
          <div
            className="animate-slide-up"
            style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
          >
            <ManageApiKeys />
          </div>
          <div
            className="animate-slide-up"
            style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
          >
            <UsageCard />
          </div>
        </div>
      </main>
    </div>
  );
}
