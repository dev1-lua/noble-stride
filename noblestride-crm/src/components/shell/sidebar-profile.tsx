"use client";

// sidebar-profile.tsx — pinned sidebar-footer profile row (Task 7). Replaces
// the old standalone "Sign out" button: avatar + display name (falling back
// to email), click opens an upward-facing dropdown with the single Log out
// action. Shared by the internal shell sidebar and the investor portal
// sidebar. Outside-click and Escape both close it, mirroring the
// NotificationBell popover pattern.

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui";
import { logoutAction } from "@/app/logout/actions";

export function SidebarProfile({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = name || email;
  const showEmailLine = Boolean(name) && Boolean(email);

  // Close on outside click and Escape.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-shrink-0 border-t border-[var(--border-subtle)] px-3 py-3">
      {/* Upward-facing dropdown — positioned above the trigger row */}
      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute bottom-full left-3 right-3 mb-2 z-50 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-lg"
        >
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              <LogOut className="h-4 w-4 flex-shrink-0 text-[var(--t-tag-text-rose)]" />
              Log out
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
      >
        <Avatar name={displayName} size="sm" color="bg-emerald-600" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-[var(--text-primary)]">{displayName}</span>
          {showEmailLine && (
            <span className="truncate text-[11px] text-[var(--text-tertiary)]">{email}</span>
          )}
        </span>
      </button>
    </div>
  );
}
