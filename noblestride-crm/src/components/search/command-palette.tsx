"use client";

// Global command palette (Task D) — Cmd/Ctrl-K search across the CRM.
// Backed by the `globalSearch` GraphQL query (Task C); the server does ALL
// the viewer-scoping (see server/search/global-search.ts) — this component
// never filters or trusts anything about "who can see what" itself, it only
// renders whatever the server returned.
//
// No new dependency (no cmdk) — built entirely on existing primitives
// (`Card`, lucide icons, the `cn` helper) plus a hand-rolled fixed-overlay,
// the same "fixed inset-0 flex items-center justify-center bg-black/40"
// pattern already used by `log-engagement-dialog.tsx` / `delete-confirm.tsx`.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClient, gql } from "@urql/next";
import {
  Search,
  Loader2,
  Users,
  Building,
  Building2,
  Briefcase,
  Handshake,
  FileText,
  ListChecks,
  User,
  MessageSquare,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const GLOBAL_SEARCH = gql`
  query GlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) {
      id
      type
      title
      subtitle
      href
    }
  }
`;

export interface SearchResultItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  href: string;
}

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 8;

// ─── Entity type → icon/color/group-label ────────────────────────────────────
// Mirrors the tag-palette convention used by the admin sidebar's MAIN_NAV
// (src/components/shell/sidebar.tsx).

interface TypeMeta {
  icon: LucideIcon;
  color: string;
  label: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  Investor: { icon: Users, color: "text-[var(--t-tag-text-sky)]", label: "Investors" },
  Client: { icon: Building, color: "text-[var(--t-tag-text-blue)]", label: "Clients" },
  Mandate: { icon: Handshake, color: "text-[var(--t-tag-text-amber)]", label: "Mandates" },
  Transaction: { icon: Briefcase, color: "text-[var(--t-tag-text-amber)]", label: "Deals" },
  Partner: { icon: Building2, color: "text-[var(--t-tag-text-violet)]", label: "Partners" },
  ServiceProvider: { icon: Scale, color: "text-[var(--t-tag-text-gray)]", label: "Service Providers" },
  Document: { icon: FileText, color: "text-[var(--t-tag-text-orange)]", label: "Documents" },
  Task: { icon: ListChecks, color: "text-[var(--t-tag-text-blue)]", label: "Tasks" },
  Person: { icon: User, color: "text-[var(--t-tag-text-gray)]", label: "Contacts" },
  Engagement: { icon: MessageSquare, color: "text-[var(--t-tag-text-violet)]", label: "Engagements" },
};

const DEFAULT_TYPE_META: TypeMeta = { icon: Search, color: "text-[var(--text-tertiary)]", label: "Results" };

function metaFor(type: string): TypeMeta {
  return TYPE_META[type] ?? { ...DEFAULT_TYPE_META, label: type };
}

// ─── SearchTrigger — the visible topbar box (replaces the old decorative input) ─

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open global search"
      className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-left transition-colors hover:border-[var(--border-strong)]"
    >
      <Search className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-tertiary)]" />
      <span className="w-28 truncate text-xs text-[var(--text-tertiary)]">Search…</span>
      <kbd className="hidden flex-shrink-0 rounded border border-[var(--border-subtle)] px-1 text-[10px] text-[var(--text-tertiary)] sm:inline-block">
        ⌘K
      </kbd>
    </button>
  );
}

// ─── CommandPalette ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const client = useClient();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);
  // Hold the urql client in a ref so the debounce effect below depends only on
  // `query` — `useClient()` can return a fresh object reference each render,
  // and including it in the effect deps would re-arm the debounce on every
  // state update (and pile up timers under test).
  const clientRef = useRef(client);
  clientRef.current = client;

  const close = useCallback(() => setOpen(false), []);

  // Global Cmd/Ctrl-K toggle — active whether the palette is open or closed.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Reset/focus on open, clear state on close.
  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    setQuery("");
    setResults([]);
    setLoading(false);
  }, [open]);

  // Debounced search — a stale-response guard (requestSeq) ensures a slow
  // earlier request can never overwrite the result of a later one.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++requestSeq.current;
    const timer = setTimeout(() => {
      clientRef.current
        .query(GLOBAL_SEARCH, { query: q, limit: RESULT_LIMIT })
        .toPromise()
        .then((res) => {
          if (seq !== requestSeq.current) return;
          setResults(res.data?.globalSearch ?? []);
          setLoading(false);
        })
        .catch(() => {
          // Network/GraphQL failure — clear the spinner (don't leave it stuck)
          // and show the empty/no-results state rather than a hang.
          if (seq !== requestSeq.current) return;
          setResults([]);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  function navigateTo(result: SearchResultItem) {
    close();
    router.push(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const result = results[activeIndex];
      if (result) navigateTo(result);
    }
  }

  // Group results by type, preserving first-appearance order — the server
  // already returns them grouped per-entity, this just partitions for display.
  const groups: { type: string; items: SearchResultItem[] }[] = [];
  for (const r of results) {
    let group = groups.find((g) => g.type === r.type);
    if (!group) {
      group = { type: r.type, items: [] };
      groups.push(group);
    }
    group.items.push(r);
  }

  const trimmed = query.trim();

  return (
    <>
      <SearchTrigger onClick={() => setOpen(true)} />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <Card
            className="mx-4 w-full max-w-lg overflow-hidden shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
              <Search className="h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search investors, deals, documents…"
                aria-label="Global search input"
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
              />
              {loading && <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[var(--accent)]" />}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {!trimmed && (
                <p className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                  Start typing to search across the CRM…
                </p>
              )}
              {trimmed && !loading && results.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                  No results for &ldquo;{trimmed}&rdquo;.
                </p>
              )}
              {groups.map((group) => {
                const meta = metaFor(group.type);
                const Icon = meta.icon;
                return (
                  <div key={group.type} className="py-1.5">
                    <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                      {meta.label}
                    </p>
                    {group.items.map((item) => {
                      const flatIndex = results.indexOf(item);
                      const active = flatIndex === activeIndex;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          onClick={() => navigateTo(item)}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                            active ? "bg-[var(--bg-secondary)]" : "hover:bg-[var(--bg-secondary)]"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 flex-shrink-0", meta.color)} />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium text-[var(--text-primary)]">{item.title}</span>
                            {item.subtitle && (
                              <span className="ml-2 text-[var(--text-tertiary)]">{item.subtitle}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
