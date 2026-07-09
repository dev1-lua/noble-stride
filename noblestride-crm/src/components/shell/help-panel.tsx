"use client";

// help-panel.tsx — Task 18: topbar "?" help panel. Self-contained button +
// slide-over Drawer (the same Drawer component the CRM form drawers use — see
// src/components/ui/drawer.tsx / engagement-form-drawer.tsx), so Topbar only
// needs to render <HelpPanel/>. Three sections:
//   1. "How a deal flows" — the 17-step journey (JOURNEY_STEP_HELP), whose
//      titles are kept in lockstep with journey.ts's JOURNEY_TITLES (see
//      src/lib/glossary.ts and src/lib/__tests__/journey-step-help.test.ts).
//   2. "Glossary" — every GLOSSARY entry.
//   3. "More" — a link to the access matrix and a note about the full
//      walkthrough (no external link needed).
//
// Deep link: `?help=journey` opens the drawer on mount with "How a deal
// flows" scrolled into view. useSearchParams requires a Suspense boundary,
// so the actual button+drawer live in an inner component wrapped here.

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { GLOSSARY, JOURNEY_STEP_HELP } from "@/lib/glossary";

function HelpPanelInner() {
  const searchParams = useSearchParams();
  const deepLinkedToJourney = searchParams.get("help") === "journey";
  // Deep-link open: lazy-init from the URL the panel mounted with, AND react to
  // the `?help=journey` param appearing on a client-side nav. HelpPanel lives in
  // the persistent (crm) topbar/layout, so it does NOT remount when the param
  // changes — the lazy init alone would miss a soft-nav to ?help=journey.
  // Tracking the previous value and adjusting state during render is React's
  // canonical pattern here (a render-phase setState, not an effect, so it
  // doesn't trip react-hooks/set-state-in-effect).
  const [open, setOpen] = useState(deepLinkedToJourney);
  const [prevDeepLink, setPrevDeepLink] = useState(deepLinkedToJourney);
  if (deepLinkedToJourney !== prevDeepLink) {
    setPrevDeepLink(deepLinkedToJourney);
    if (deepLinkedToJourney) setOpen(true);
  }
  const journeySectionRef = useRef<HTMLElement>(null);

  // Once open via the deep link, scroll "How a deal flows" into view (after
  // the Drawer's slide-in has mounted the content).
  useEffect(() => {
    if (!open || !deepLinkedToJourney) return;
    const id = window.setTimeout(() => {
      journeySectionRef.current?.scrollIntoView({ block: "start" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [open, deepLinkedToJourney]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-tertiary)]"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="Help">
        <div className="flex flex-col gap-8">
          <section ref={journeySectionRef}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              How a deal flows
            </h3>
            <ol className="flex flex-col gap-3">
              {JOURNEY_STEP_HELP.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[10px] font-semibold text-[var(--text-secondary)]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{step.title}</p>
                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Glossary
            </h3>
            <dl className="flex flex-col gap-3">
              {GLOSSARY.map((entry) => (
                <div key={entry.term}>
                  <dt className="text-xs font-semibold text-[var(--text-primary)]">{entry.term}</dt>
                  <dd className="text-xs leading-relaxed text-[var(--text-secondary)]">{entry.definition}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">More</h3>
            <div className="flex flex-col gap-2">
              <Link href="/access-matrix" className="text-xs font-medium text-[var(--accent)] hover:underline">
                Who can see and edit what
              </Link>
              <p className="text-xs text-[var(--text-tertiary)]">Ask the team for the full CRM walkthrough.</p>
            </div>
          </section>
        </div>
      </Drawer>
    </>
  );
}

export function HelpPanel() {
  return (
    <Suspense fallback={null}>
      <HelpPanelInner />
    </Suspense>
  );
}
