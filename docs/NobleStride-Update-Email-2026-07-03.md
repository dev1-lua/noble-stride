# Noblestride × Lua — Build Update

**To:** Noblestride Capital team
**From:** Lua
**Date:** 3 July 2026
**Re:** Portals live with your real data; full deal-lifecycle tracking in place

---

**Subject line:** Noblestride × Lua — daily update: portals running on your real trackers + full milestone tracking

---

Hi team,

Daily update — a lot landed since the last note. Everything we listed as "in build" on 26 June is now done, and the system is running on **your real data**, not sample records.

## Delivered since the last update

- **Your trackers are in.** We imported the Engagement Contract tracker and the WhatsApp Tasks tracker directly: **106 mandates with real NDA/engagement dates, 104 clients, and 387 tasks** now live in the CRM. The pipeline you'll see is your actual pipeline.
- **Full investor process tracking.** Every investor-deal relationship now carries the complete 15-step cycle you work to — teaser review → NDA → EOI → data room → preliminary DD → IC paper → first IC → non-binding term sheet → executed term sheet → onsite DD → second IC → binding offer → loan/SPA → CAK/COMESA → success fee — with a visual stepper per investor per deal, plus disbursement tracking (total / disbursed / pending).
- **Investor portal is now a working CRM, not just a view.** Investors see only opportunities matching their mandate, gated by stage. They can maintain their own fund profile (built field-for-field from your "Data collected from potential investors" document), track their own pipeline, and **express interest on a deal** — which writes straight back into your internal view with an activity your team sees immediately.
- **Partner portal with live referral submission.** A partner (e.g. DLA Piper) can submit a referral and it lands in your mandates as a New Lead instantly, with the referral funnel and expected-fee view alongside. Fee-sharing terms and advisor type are tracked internally.
- **Confidentiality gates, tested.** Other investors' identities, partner identities, internal notes and engagement contracts are never exposed to any external viewer — this is enforced in code and covered by a dedicated test suite (the full build is at **270/270 tests passing**). Greylisted or excluded funds see nothing, by design.
- **Deal preparation checklist** on each transaction — teaser, financial model, IM, valuation, business plan — driven by the document register with its review chain (reviewer → MD approval → client review).

## Scope check

We've also completed a line-by-line reconciliation of the build against the signed Phase 1 SOW and your original concept note, so we can walk you through exactly what's delivered, what's next, and what sits outside Phase 1 (e-signatures, hosted data room with watermarking, automated invoicing) whenever useful.

## What we need from you

- **Hands-on feedback** from the refreshed demo — especially the investor and partner portal flows.
- **Access coordinator confirmation** (Evans / Solomon) so we can line up Microsoft 365, WhatsApp and website access for the agents phase, which sits on top of this layer.
- **Picklist and team-member list sign-off** — stages, sources and users are loaded from your trackers; a quick confirmation locks them.
- **Open vs Closed NDA handling** — how each should map to data-room access scope.

We'll share the refreshed demo link shortly. Happy to do a walkthrough call this week.

Best,
[Your name]
Lua

---

*Internal note (not for sending): full detail in `docs/BUILD-STATUS-2026-07-03.md`; scope reconciliation in `docs/CRM-COMPARATIVE-ANALYSIS-2026-07-03.md` (§10 master table, §11 demo walkthrough). Demo deploy requires pushing local `main` to origin (Vercel).*
