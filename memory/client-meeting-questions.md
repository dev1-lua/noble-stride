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

*(Add future open questions here rather than assuming.)*
