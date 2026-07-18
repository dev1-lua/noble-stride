"use client";

// workspace-tabs.tsx — tab chrome for the staff investor workspace. The tab
// CONTENTS are server-rendered ReactNodes passed in as props (RSC composition);
// this island only holds which tab is visible. All panels mount hidden rather
// than conditionally, so server-rendered content isn't lost on switch.

import { useState } from "react";

export interface WorkspaceTab {
  key: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

export function WorkspaceTabs({ tabs }: { tabs: WorkspaceTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div>
      <div role="tablist" className="flex flex-wrap items-center gap-1 border-b border-[var(--border-subtle)]">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className={
                "-mb-px flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (isActive
                  ? "border-[var(--accent)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]")
              }
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="rounded-full bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={t.key !== active} className="pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}
