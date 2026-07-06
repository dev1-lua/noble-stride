# §10. Website intake and qualification agent

**Spec (Build Specification §10):** An agent embedded on the Noblestride website that collects structured information from **target companies** (the businesses raising capital), runs first-pass qualification, and routes qualified opportunities to a deal lead. §10.1 defines 24 intake fields (12 required: legal name, year founded, HQ city, sector, amount raising, instrument, contact details, NDA acceptance, etc.). §10.2 defines the screening rules (profitable, revenue ≥ USD 1M, raise ≥ USD 1M, audited accounts 3+ years, acceptable sector in Sub-Saharan Africa; restricted sectors and PEP-linked companies deprioritised) with every lead — Qualified or Rejected — visible to the team. §10.3: qualified leads sit in an open queue for manual assignment; nothing converts to an active deal automatically.

## Build status

**Not built for the actor the spec names — the analysis doc calls it "built for the wrong actor."** What exists is a polished public **investor** self-registration flow at `/register`, which actually implements §11.2 (investor access control), not §10 (company intake). Specifically:

- 0 of the 12 required §10.1 company-intake fields appear on any public surface.
- §10.2 qualification logic is entirely absent — no revenue/raise/audited-accounts/restricted-sector/SSA/PEP screens, no Qualified/Rejected label.
- §10.3's open-queue-plus-manual-assignment pattern *does* exist, but for investor registrations (PendingReview → admin approval), not company leads.

(Source: comparative analysis §10.) The company intake + qualification form is tracked in `memory/remaining-tasks.md` under larger builds.

## See it in the app

The spec's company intake does not exist. The structurally-nearest flow — inbound self-registration with qualification-by-human-review — is the investor one:

1. Go to `http://localhost:3000/register` (logged out).
2. Complete the 3 steps: firm + contact details (generic Gmail/Yahoo addresses are rejected for fund contacts), investment criteria, then OTP verification — enter the demo code `000000`.
3. You land on a "registration under review" state: the new investor is created as **PendingReview** and sees no deals.
4. Log in at `http://localhost:3000/login` as `jane@noblestride.co` (any password), go to `http://localhost:3000/investors`, open the new investor, and use the Onboarding panel's **Approve / Reject / Greylist** actions — this is the human gate, analogous to §10.3's manual routing, but for investors.
5. The `/dashboard` **Investor Onboarding** stat group shows the pending queue.

Note the mismatch plainly: the spec wants a company answering "how much are you raising?"; the build has an investor answering "what do you invest in?".

## Key source files

None implement §10 itself. The wrong-actor analogue:

- `src/app/register/page.tsx`, `src/app/register/actions.ts` — the 3-step public registration flow
- `src/server/onboarding/register-investor.ts` — creates the PendingReview investor
- `src/lib/corporate-email.ts` — generic-email gate (spec §3.5 note, applied here)
- `src/components/crm/onboarding-actions.tsx` — admin Approve/Reject/Greylist gate on `/investors/[id]`
