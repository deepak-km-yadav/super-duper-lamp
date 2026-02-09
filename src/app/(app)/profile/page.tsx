"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Save,
  Music,
  Palette,
  Settings,
  Heart,
} from "lucide-react";
import { MODELS, MOODS } from "@/types";
import toast from "react-hot-toast";

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  themePreference: string;
  defaultModel: string;
  defaultMood: string;
  defaultVocal: string;
  createdAt: string;
  _count: { generations: number };
}

export default function ProfilePage() {
  const { status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [themePreference, setThemePreference] = useState("dark");
  const [defaultModel, setDefaultModel] = useState("V4");
  const [defaultMood, setDefaultMood] = useState("Romantic");
  const [defaultVocal, setDefaultVocal] = useState("Auto");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setName(data.name || "");
          setThemePreference(data.themePreference);
          setDefaultModel(data.defaultModel);
          setDefaultMood(data.defaultMood);
          setDefaultVocal(data.defaultVocal);
        }
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const body: Record<string, string> = {
        name,
        themePreference,
        defaultModel,
        defaultMood,
        defaultVocal,
      };

      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }

      toast.success("Profile updated!");
      setCurrentPassword("");
      setNewPassword("");
      setShowPasswordSection(false);
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-pink-50 flex items-center gap-3">
          <User className="w-7 h-7 text-rose-400" />
          Profile Settings
        </h1>
        <p className="text-pink-100/40 mt-1 text-sm">
          Manage your account and preferences
        </p>
      </div>

      {/* Stats Card */}
      <div className="glass-card p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-2xl font-bold text-white">
            {name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-pink-50">{name || "User"}</h2>
            <p className="text-sm text-pink-100/40">{profile?.email}</p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-pink-100/35">
                <Music className="w-3 h-3" />
                {profile?._count?.generations || 0} songs generated
              </div>
              <div className="flex items-center gap-1.5 text-xs text-pink-100/35">
                <Heart className="w-3 h-3" />
                Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal Info */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-pink-50 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-rose-400" />
            Personal Info
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="valentine-input"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-100/20" />
                <input
                  type="email"
                  value={profile?.email || ""}
                  className="valentine-input !pl-10 opacity-60"
                  disabled
                />
              </div>
              <p className="text-xs text-pink-100/25 mt-1">Email cannot be changed</p>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-pink-50 mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4 text-rose-400" />
            Appearance
          </h3>
          <div>
            <label className="block text-sm text-pink-100/50 mb-2">Theme</label>
            <div className="toggle-group">
              <button
                type="button"
                onClick={() => setThemePreference("dark")}
                className={`toggle-option ${themePreference === "dark" ? "toggle-option-active" : ""}`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setThemePreference("light")}
                className={`toggle-option ${themePreference === "light" ? "toggle-option-active" : ""}`}
              >
                Light
              </button>
            </div>
          </div>
        </div>

        {/* Default Generation Settings */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-pink-50 mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-rose-400" />
            Default Generation Settings
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">Model</label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="valentine-input"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">Default Mood</label>
              <select
                value={defaultMood}
                onChange={(e) => setDefaultMood(e.target.value)}
                className="valentine-input"
              >
                {MOODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-pink-100/50 mb-2">Vocal Preference</label>
              <select
                value={defaultVocal}
                onChange={(e) => setDefaultVocal(e.target.value)}
                className="valentine-input"
              >
                <option value="Auto">Auto</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="glass-card p-6">
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="font-semibold text-pink-50 flex items-center gap-2 w-full text-left"
          >
            <Lock className="w-4 h-4 text-rose-400" />
            Change Password
          </button>

          {showPasswordSection && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm text-pink-100/50 mb-2">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="valentine-input"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm text-pink-100/50 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="valentine-input"
                  placeholder="Enter new password (min 6 chars)"
                  minLength={6}
                />
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </form>
    </div>
  );
}
