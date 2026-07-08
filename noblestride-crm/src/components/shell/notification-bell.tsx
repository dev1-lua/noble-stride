"use client";

// notification-bell.tsx — in-app notification bell (Task 14). Server-rendered
// initial unread list/count (no polling, no websockets); the dropdown is a
// client popover mirroring AskBar's outside-click pattern. Marking a
// notification read is optimistic (local state), then navigates to its href.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useMutation } from "urql";
import { cn } from "@/lib/cn";
import { daysAgoLabel } from "@/lib/format";

const MARK_READ = `
  mutation MarkNotificationsRead($ids: [ID!]!) {
    markNotificationsRead(ids: $ids)
  }
`;

const MARK_ALL_READ = `
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  href: string | null;
  createdAt: string;
}

export function NotificationBell({
  initialItems,
  initialCount,
}: {
  initialItems: NotificationItem[];
  initialCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [count, setCount] = useState(initialCount);
  const containerRef = useRef<HTMLDivElement>(null);

  const [, markRead] = useMutation(MARK_READ);
  const [, markAllRead] = useMutation(MARK_ALL_READ);

  // Close popover on outside click (mirrors AskBar).
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleItemClick(item: NotificationItem) {
    // Optimistic: drop it from the list immediately, then fire the mutation.
    setItems((prev) => prev.filter((n) => n.id !== item.id));
    setCount((prev) => Math.max(0, prev - 1));
    setOpen(false);
    await markRead({ ids: [item.id] });
    if (item.href) router.push(item.href);
    router.refresh();
  }

  async function handleMarkAllRead() {
    setItems([]);
    setCount(0);
    await markAllRead({});
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <Bell className="h-3.5 w-3.5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Notifications</span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">You&apos;re all caught up.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors",
                        "hover:bg-[var(--bg-tertiary)]"
                      )}
                    >
                      <span className="text-xs font-medium text-[var(--text-primary)]">{item.title}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">{daysAgoLabel(item.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
