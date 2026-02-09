"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Music, History, User, Menu, X, Heart } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: "/generate", label: "Generate", icon: Music },
    { href: "/history", label: "History", icon: History },
  ];

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-rose-500/10 bg-[rgba(12,0,16,0.8)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-rose-500/20 transition-all">
              <Heart className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-rose-300 to-pink-300 bg-clip-text text-transparent">
              Valentine Music
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-rose-500/15 text-rose-300"
                      : "text-pink-100/60 hover:text-pink-100 hover:bg-rose-500/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/profile"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  pathname === "/profile"
                    ? "bg-rose-500/15 text-rose-300"
                    : "text-pink-100/60 hover:text-pink-100 hover:bg-rose-500/5"
                }`}
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
            </div>
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-pink-100/60 hover:text-pink-100"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-rose-500/10 bg-[rgba(12,0,16,0.95)] backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-rose-500/15 text-rose-300"
                      : "text-pink-100/60 hover:text-pink-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-pink-100/60 hover:text-pink-100"
            >
              <User className="w-4 h-4" />
              Profile
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
