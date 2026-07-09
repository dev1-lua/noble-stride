# §6. Milestone framework

**Spec (Build Specification §6):** Milestones drive deal progression, the visibility gates and the dashboards, in three groups. §6.1 client-side document preparation: Teaser, Financial model and IM for all deals, Valuation report for equity transactions only, Business plan optional. §6.2: fourteen investor-side process milestones, from receipt of the teaser through NDA, data-room access, due diligence, IC approvals, term sheet, binding offer, agreements, to competition-authority approval. §6.3 post-deal: disbursement/completion, success-fee invoicing and payment, and post-transaction monitoring.

## Build status

Mostly built. §6.1 is complete: the document-preparation checklist is derived live from the Document register, and the Valuation row is correctly hidden for debt-only deals. §6.2 is complete: all fourteen investor-side milestones are encoded and individually recordable, re-datable and un-recordable, with an internal checklist distinguishing recorded, implied-by-stage and open states; the portal steppers read the same merged data. §6.3 is partial: disbursement tracking (total/disbursed/pending with year/quarter summaries) is built; success-fee fields exist on Transaction but there is no invoice generation; **post-transaction monitoring is not built — tracked in memory/remaining-tasks.md.** Source: comparative analysis §6.

## See it in the app

### Flow 1 — Client-side document preparation (§6.1)
1. Sign in at `/login` as `jane@noblestride.co` (any password).
2. Go to `/mandates` or `/transactions` and open a deal. Find the **Deal Preparation** checklist — Teaser, Financial model, IM (and Business plan, labelled optional) with Not started / Draft / Done states derived from the Document register.
3. Compare an equity deal with a debt deal: the **Valuation report** row appears only on equity transactions, per spec.
4. Upload path: add a Teaser-type document via `/documents` (or the deal's Documents card) and watch the checklist state change.

### Flow 2 — The 14 investor-side milestones (§6.2)
1. Go to `/engagement` and open an engagement (one investor on one deal).
2. Find the **Milestone checklist** — all fourteen §6.2 milestones, each showing recorded (with date), implied-by-stage, or open. Click one to record it or re-date it; recording is reversible.
3. Note the interaction with the engagement stage control: advancing the stage implies earlier milestones; NDA-gated stages are guarded.
4. Investor's view of the same data: switch "Viewing as" to the investor on that engagement, open `/portal/investor/deals/[id]` and see the milestone **stepper** reflecting exactly what you recorded internally. `/portal/investor/pipeline` shows the same progression across all their deals.

### Flow 3 — Post-deal (§6.3)
1. Back in the admin lens, go to `/engagement` — the **disbursement table** shows total, disbursed and pending amounts per investor per deal, editable per row.
2. Open `/dashboard` for disbursement grouped by year and quarter.
3. Success-fee fields are visible on a transaction's detail/edit drawer, but note honestly: no invoicing flow, and no post-transaction monitoring surface exists.

## Key source files

- `src/lib/milestones.ts` — the milestone framework definitions (the 14 investor-side milestones, prep milestones and stage implications).
- `src/server/services/milestones-crud.ts` — the record/re-date/unrecord write path (upsert per engagement+key).
- `src/components/crm/milestone-checklist.tsx` — the internal checklist on engagement detail.
- `src/components/crm/prep-milestones.tsx` — the §6.1 document-preparation checklist, derived from the Document register.
- `src/server/domain/disbursement.ts` and `src/components/crm/disbursement-table.tsx`, `disbursement-period-summary.tsx` — §6.3 disbursement tracking.
- `src/app/portal/investor/deals/` — the investor-facing milestone steppers.
