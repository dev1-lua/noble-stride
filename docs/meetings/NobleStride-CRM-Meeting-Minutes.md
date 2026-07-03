# NobleStride CRM — Meeting Minutes

**Date:** 23 June 2026
**Recording:** `nobel-stride.aac` (~42 min)
**Topic:** Walkthrough of the first build of the NobleStride Capital CRM, feedback, and clarifying questions
**Prepared from:** audio transcription + voice-based speaker diarization (see note at end)

---

## Participants

> Names were inferred from voice separation + conversation context — please correct any that are off.

| Speaker | Side | Role in the call |
|---|---|---|
| **Dave** | Lua (vendor) | Built the CRM; shared screen and ran the walkthrough; asked the prospecting & data-hygiene questions |
| **Lua lead / host** (likely *Anissa*) | Lua (vendor) | Facilitated the meeting, framed the build, captured feedback, owns the follow-up email & next steps |
| **Solomon** (a.k.a. Suleman) | NobleStride | Deal & partner domain expert; explained partners, fee-share, prospecting, and data migration |
| **Evans** | NobleStride (senior) | Joined remotely ("on the road"); gave the branding correction and drove the partner/access questions |
| *Marco / Mark* | Lua | Original point of contact who received the source docs — **not** clearly speaking on this call; referenced repeatedly |

---

## Overview

Lua presented a first working version of the NobleStride Capital CRM — a front-end + back-end wireframe built to validate the data model and structure from the documents NobleStride had shared. Dave walked through each module; the Lua lead framed the "layer-by-layer" intent (Dashboard → Mandates → Transactions → Investors → Engagement → Partners). NobleStride (Evans & Solomon) gave feedback, and Lua asked a set of clarifying questions about prospecting, user roles, and how the partner/investor relationships should work. The CRM link will be shared so NobleStride can test it hands-on.

### What was demoed
- **Dashboard** — summary insights & metrics (active mandates, transactions, investors engaged, pipeline view); visuals can be tailored.
- **Mandates** — full deal lifecycle by stage (lead → qualification → pitch/presentation → … → closed), with free movement between stages.
- **Transactions** — one level deeper: activity happening inside each deal/stage.
- **Investors** — investor records with sectors, geography, type (e.g. PE), contacts, and recent activity.
- **Engagement** — all communications per project, with an activity timeline (who/what/when). AI query over this data is *planned, not yet built*.
- **Partners** — directory of partners already in the database (built from the files NobleStride sent; not dummy data). This is the **internal/admin view only**.

---

## Proposed Changes & Feature Requests

1. **Surface the project unique identifier in the front-end.** *(Evans)* Every deal/company should be keyed by a **project codename** (e.g. "Project Ion") rather than just the company name — the identifier that links everything related to that company. *Dave:* this already exists in the backend (project ID used by the AI agents) and will be exposed in the front-end too.

2. **Engagement filters.** *(Lua lead)* Add top-level filters to the Engagement view — by **project**, by **team member**, and by **stage**.

3. **Engagement drill-down + source mapping.** *(Evans)* Clicking an engagement item (e.g. "Incofin passed") should expand to show the details — what was said, who communicated — and **link back to the specific deal/transaction** it originated from. Agreed to include.

4. **Branding fix.** *(Evans → Solomon to action)* The name must read **"NobleStride Capital"** — *"NobleStride"* as one word, with correct capitalization. An error carried over from the contracting stage; important because other "NobleStride" entities exist. Solomon to correct it across the system.

5. **Roles & access control / user administration.** *(Evans, Solomon, Lua lead)* Introduce an **admin role + standard users**, with granular permissions reflecting the org (senior management / associates / interns). Needs: activate/deactivate users, limit approvals, and users who can **only see their own leads/data/engagements**. NobleStride to guide on the exact access levels; Lua to implement.

6. **Multi-portal architecture (three views).** *(Solomon)* Beyond the internal/admin view (the one built), design:
   - an **investor portal** — investors log in to view opportunities / shared info;
   - a **partner portal** — partners log in to see the status of deals they referred and to **submit new opportunities**.
   Requires careful control so **no internal information leaks** to external parties.

7. **Partner workflow & fee-share tracking.** *(Solomon)* The system must track the full partner lifecycle and make it visible internally **and** to the partner:
   - opportunity introduced by a partner → **evaluate** (sign NDA, review financials) → **qualify** → sign **engagement contract** (with the target company; defines fees) → sign **fee-share agreement** with the partner (revenue split);
   - track **disbursements in phases** (e.g. $1M raised as $500k now + $500k later) and the **payment owed to the partner** at each disbursement;
   - partner-side: notifications/visibility that their referred deal was evaluated, onboarded, and successfully raised.

8. **AI agent capabilities (to build).** *(Dave / Solomon)*
   - **Prospecting** — clarified as two things: (a) sourcing **deals/companies** (a company looking to fundraise via equity/debt, or needing a short-term assignment), and (b) **investor matching** — matching an opportunity to investors, checking the **internal database** first and using an agent to **pull external investor info** if needed.
   - **AI query** over engagement/activity data — planned, not yet built.

9. **Data hygiene during migration.** *(Solomon)* When migrating, Lua should **flag missing or mandatory fields**; NobleStride will evaluate the data, fill gaps, or drop records that don't need to migrate. Treated as a joint, ongoing process.

10. **Review the deal pipeline stages.** *(Lua lead)* NobleStride to confirm whether the current pipeline stages match how they actually work, or should be changed.

---

## Open Questions (for NobleStride to answer, mainly while testing)

- How is **investor data** used beyond investor matching? What extra columns/features would help the investor database (which Lua flagged as the most improvable area)?
- How many **internal users**, and what **role/permission levels** are needed?
- What should **investors vs. partners** each be able to see (data-access boundaries)?

---

## Process / Communication Issue

- **"Broken telephone".** *(Evans)* NobleStride explained their intent to Marco and colleagues at Lua, but the build team may not have received the full context — leading to assumptions. Suggestion: **direct discussions** between NobleStride and the team actually building the system.
- **Missing scope document.** There is a detailed, **password-protected ~10–20 page Word document** describing the thought process / how the CRM should look. It may not have reached the build team. Lua has been working from the **Scope of Work** plus the shared Excel/PDF files (e.g. "NobleStride Lua Phase One Context", "Lua × NobleStride Build Specifications", "Phase One Client SOW", CRM data / active deals / CRM tracker sheets). NobleStride to locate and forward the Word doc.

---

## Next Steps

**Lua:**
1. **Share the demo CRM link** with NobleStride for hands-on testing. Asked them to evaluate on two axes: *(a)* does it solve their current queries / drill-downs, and *(b)* how easy is it to add data.
2. **Send a follow-up email** summarizing all changes proposed in this meeting (so nothing gets re-proposed).
3. **Design the architecture** for the partner + investor third-party portals — both the technical/back-end side (incl. third-party systems) and the experience/information-access model.
4. **Design the AI-agent infrastructure** for **prospecting** and **investor matching** (noted as the interesting, data-heavy piece).
5. Continue improving the wireframe/build day-to-day; check with Marco for the missing scope document.

**NobleStride:**
6. **Test the CRM** once the link arrives and send consolidated feedback (investor table fields, pipeline stages, drill-downs, ease of data entry).
7. **Locate and forward the ~20-page Word scope/thought-process document** (and any additional description/scope files) — via Marco if needed.
8. **Define user roles/access levels** and the data-access boundaries for investors and partners.
9. **Get access to the demo database** and reconcile ("tie up") the gaps between the defined scope and what was built — Solomon to follow up on documents & scope so the team can move faster toward the final product.
10. **Fix the "NobleStride Capital" naming** in source/contract material (Solomon).

---

*Note on method: the recording was transcribed locally with Whisper (large-v3-turbo) and speakers were separated using voice diarization (sherpa-onnx, pyannote segmentation + speaker embeddings). Speaker names are inferred from voice clusters plus what each person said, so attributions are approximate — especially for short interjections and moments with mic echo. Numbers, names, and the "who said what" should be sanity-checked against your own memory of the call.*
