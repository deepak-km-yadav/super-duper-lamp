import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/Toast";
import { DashboardPage } from "./pages/DashboardPage";
import { NewBotPage } from "./pages/NewBotPage";
import { EditBotPage } from "./pages/EditBotPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PublicBotPage } from "./pages/PublicBotPage";
import { ExplorePage } from "./pages/ExplorePage";

export function ChatterboxApp() {
  return (
    <div id="chatterbox-root" className="min-h-full">
      <Toaster />
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="bots/new" element={<NewBotPage />} />
        <Route path="bots/:id/edit" element={<EditBotPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="chat/:slug" element={<PublicBotPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  );
}
