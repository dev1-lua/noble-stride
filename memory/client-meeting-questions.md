# Questions to clear with Noblestride (Evans/team) — next client meeting

Points we implemented with assumptions instead of guessing silently. Confirm each and adjust the build if the answer differs.

1. **Complete investor field set + which fields are mandatory.**
   SOW §10 flags this for discovery. Current assumption: **all** registration and fund-profile fields are mandatory. Confirm the final field list and which are truly required vs optional.

2. **Exact Open vs Closed NDA handling for visibility / VDR gating.**
   SOW §10 flags this for discovery. Current assumption: an investor with a signed **Open NDA** can be granted access to *every* target company's data room (each still behind internal approval); a **Closed NDA** covers exactly *one* target company's data room, and every additional data room needs a new NDA.

3. **Teaser anonymization pre-NDA.**
   The end-to-end workflow doc has teaser → NDA sequencing, and standard practice anonymizes teasers, so pre-NDA we mask the target company's name as a codename ("Project X — Sector, Country") and unmask after NDA. SOW §07 says "basic profile" is visible pre-interest, which could be read either way. Confirm whether company names should be visible in teasers before an NDA is signed.

4. **Registration form's "Fund type" (investor type) dropdown.**
   We added an `Investor type` selector (PrivateEquity/VentureCapital/DFI/…) to the public `/register` form, not explicitly specified in the SOW. Confirm this field — and its options — are acceptable for self-registration.

5. **Ticket-band boundaries for the deal-size dropdown.**
   `/register`'s deal-size selector uses assumed bands (`Under $100k`, `$100k–$250k`, `$250k–$500k`, `$500k–$1M`, `$1M–$5M`, `Over $5M`; see `src/lib/ticket-bands.ts`) built off the client's investor-preferences template, extended upward for a PE/DFI audience. Confirm these boundaries are final.

6. **Masking behavior for previously DECLINED deals in an investor's own pipeline history.**
   Current behavior: once an investor declines a deal, the visibility engine reverts it to teaser-level masking (codename) in that investor's own pipeline history, just like any other pre-interest deal — even though the investor already saw the real name during their prior engagement. Confirm whether a declined deal should remain masked as a codename going forward, or continue showing the real name the investor already knew (current behavior is safe but may read as confusing).

---

## Added 2026-07-06 — from the full comparison against the internal Build Specification PDF (v2.0, 1 Jun 2026)

7. **Deal pipeline vocabulary (spec §4.4 vs our two kanbans).**
   The spec fixes a document-driven deal-stage list (Indicative TS / Term Sheet / Due Diligence / IC / Loan Agreement / Shareholder Agreement / Share Purchase Agreement / TA / Closed). Our build splits the deal into a client-acquisition pipeline (`MandateStage`: New Lead → Signed/Lost) and an execution pipeline (`TransactionStage`: Deal Preparation → Closed Won/Lost). We are adding the spec's separate **Deal status** (§4.5) and **Deal milestone** (§4.3) fields either way; confirm whether the kanban *stage* lists themselves should be reworked to the §4.4 vocabulary or kept as the two-pipeline split with the milestone field carrying the spec semantics.

8. **Country-level vs region-level geography.**
   Spec §3.1 says "Countries of operations" and §3.4 "Geographic focus"; we use regional buckets (East Africa, West Africa, SSA, …). Confirm whether country-level granularity (e.g. Kenya, Uganda) is needed for matching and filters, or regions suffice for the PoC.

9. **Sector list cleanup for legacy values.**
   Spec §5's list has **Energy** (we built `RenewableEnergy`) and treats **Banks** as a Financial Services *sub-sector* (we have a top-level `Banking` sector). We are adding `Energy` and fixing the "Retail & FMCG" label now; confirm we should migrate existing `Banking` records into Financial Services and `RenewableEnergy` into Energy once sub-sectors land.

10. **Investor deployment status vocabulary conflict between two client documents.**
    Spec §4.13 fixes three values (Active/Deploying · Not deploying · On hold). The client's own "Data collected from potential investors" doc drove our richer fund-lifecycle set (Actively Deploying / Fundraising / Final Close / Fully Deployed / Dormant). Confirm which is authoritative — or whether deployment status (§4.13) and fund lifecycle should be two separate fields.

11. **Sector single-select vs multi-select on Company/Deal.**
    Spec §3.1/§3.2 type Sector as a single-select picklist; we implemented multi-select (several imported companies genuinely span sectors). Confirm multi-select is acceptable or whether a single "primary sector" must be designated.

12. **Enforcing spec-required fields against imported legacy records.**
    The spec marks many fields required (Company: sector, description, core product, primary contact, status; Deal: ticket size, deal lead, date onboarded, source; Investor: sector/geography/ticket/instruments/deployment). Imported tracker records are missing many of these. Our plan: enforce required-ness on **new records at entry** and show completeness warnings on legacy ones rather than blocking edits. Confirm.

13. **Teaser / IM / Model tracking: stored picklists vs derived checklist.**
    Spec §3.2 wants Not started / Draft / Done picklists per document on the deal. We derive the deal-prep checklist live from the Document register (a teaser exists in Draft → "Teaser: Draft"). Confirm the derived approach is acceptable — it avoids double data entry but means the status can't be set without creating a document record.

14. **Advisory Engagement (spec §3.3) in or out of PoC scope.**
    Spec §17 item 1 leaves it to discovery. It is currently not built (correctly, per spec). If in: it needs its own entity, KES valuation, §4.8/§4.9 picklists and the Advisory dashboard (§13).

*(Add future open questions here rather than assuming.)*
