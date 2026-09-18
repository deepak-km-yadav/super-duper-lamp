import { NavLink } from "react-router-dom";
import { Compass, Inbox, LayoutGrid, Settings } from "lucide-react";

/**
 * Dashboard navigation.
 *
 * Action Items, Explore and Settings previously had no link anywhere in the UI
 * -- Settings was only reachable from a "Keys" link inside the editor.
 */
const LINKS = [
  { to: "/chatterbox/dashboard", label: "Bots", icon: LayoutGrid },
  { to: "/chatterbox/action-items", label: "Action Items", icon: Inbox },
  { to: "/chatterbox/explore", label: "Explore", icon: Compass },
  { to: "/chatterbox/settings", label: "Settings", icon: Settings },
];

export function ChatterboxNav() {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1 text-sm">
      {LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
              isActive ? "bg-bg shadow-sm" : "text-muted hover:text-fg"
            }`
          }
        >
          <Icon size={14} /> {label}
        </NavLink>
      ))}
    </nav>
  );
}
