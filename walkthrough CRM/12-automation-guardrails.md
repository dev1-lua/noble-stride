# §12. Automation guardrails and escalation

**Spec (Build Specification §12):** Human-in-the-loop control as a binding part of the build. §12.1 lists ten actions that must never happen automatically — signing NDAs, onboarding clients, converting leads, granting VDR access without approval + signed NDA, sharing deals with excluded investors, sending external communications, committing the firm to terms. §12.2 lists escalation triggers: overdue deadlines, any deal status change, WhatsApp task assignments auto-creating to-dos, client/investor requests opening tracked workflows, and internal review requests.

## Build status

**Partially built.** (Source: comparative analysis §12.)

- **§12.1:** structural guards exist wherever the corresponding feature exists — NDA-dependent stage moves are blocked server-side without the right NDA, excluded/greylisted investors can never be shown a deal, investor onboarding is human-clicked, and nothing in the app auto-sends anything. Rules 2, 3, 5, 8, 9, 10 are N/A today because the agents that could violate them (§8) are unbuilt. The human gates are enforced by code paths, not yet by roles (real RBAC is pending).
- **§12.2:** overdue-task escalation is built (auto-flag + sweep, self-clearing). Still missing: deal-status-change notifications, WhatsApp task auto-creation (needs §9), tracked request workflows, and review-request workflows.

Remaining items tracked in `memory/remaining-tasks.md`.

## See it in the app

1. Log in at `http://localhost:3000/login` as `jane@noblestride.co` (any password).
2. **NDA gate (rule 6):** go to `http://localhost:3000/engagement`, open an engagement whose investor has **no NDA**, and try to restage it to an NDA-dependent stage (VDR access, DD, etc.) — the restage control blocks the move with an explanation. Record an NDA on the investor's page and the same move succeeds.
3. **Human onboarding gate (rules 2–4):** register a new investor via `http://localhost:3000/register` (OTP `000000`); it lands PendingReview and sees nothing until an admin clicks **Approve** on `http://localhost:3000/investors/[id]`. Approve, Reject and Greylist are explicit human actions.
4. **Excluded-investor rule (rule 7):** greylist an investor, switch to their lens via the topbar **Viewing as** switcher — every portal page is a "Portal access restricted" screen.
5. **No auto-send (rule 9):** there is deliberately no outbound email/message capability anywhere in the app.
6. **Overdue escalation (§12.2):** go to `http://localhost:3000/tasks` — tasks past deadline carry an auto-set escalation flag; `http://localhost:3000/dashboard` surfaces overdue actions in the Team & Tasks panel. Mark one Done or move its deadline and the flag clears itself.

## Key source files

- `src/server/domain/nda-guard.ts` — pure NDA gating rules (which stages presuppose which NDA)
- `src/server/services/engagements-crud.ts` — server-side enforcement of the restage guard
- `src/components/crm/engagement-restage-select.tsx`, `src/components/crm/restage-select.tsx` — guarded stage controls
- `src/components/crm/onboarding-actions.tsx` — Approve/Reject/Greylist human gate
- `src/server/visibility/tiers.ts` — excluded/greylisted investors resolve to tier NONE
- `src/server/services/tasks.ts` — `flagOverdueTasks()` escalation sweep (auto-set, auto-clear, not caller-writable)
