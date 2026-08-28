# Verification guide — "Additional Feedback_Input Lua System August 2026"

Every item from the client's feedback document, with the exact steps to check it. Written for a
non-technical reviewer: each row says where to go, what to do, and what you should see.

Nothing in here needs a terminal **except** section 0 (getting the CRM running) and section 9 (the agents).

---

## 0. Getting set up

### The database

The local CRM runs against a restored copy of production data in Docker.

```bash
cd noblestride-crm
docker compose up -d --wait                    # Postgres on port 5544
npm install
npm run dev                                    # http://localhost:3000
```

**The database is `noblestride_dump2`.** `noblestride-crm/.env` already points at it:

```
DATABASE_URL=postgresql://noblestride:noblestride@localhost:5544/noblestride_dump2
```

Two earlier copies are still on the server and both are unusable — `noblestride` (emptied by a Prisma
accident) and `noblestride_restored` (which silently lost its transactions, engagements, people and every
investor/partner login). Do not point anything at them.

**What the database should contain.** Check this before you trust anything else; the previous copy looked
fine on a shallow count and was not.

| | expected |
|---|---|
| Clients | 104 |
| Mandates | 106 |
| Transactions | 13 (8 live) |
| Advisory engagements | 5 |
| Users (staff) | 14 |
| Investors | 93 |
| **People (contacts)** | **788** |
| **Engagements** | **63** |
| Login accounts | 22 (14 staff, 6 investor, 2 partner) |
| Migrations | 42, "up to date" |

People and Engagements are the canaries: they are large, and nothing in normal use should move them.

```bash
npx prisma migrate status        # expect: 42 migrations, "Database schema is up to date!"
npm run db:verify-parity         # expect: both checks pass
```

`db:verify-parity` reports a drift of exactly nine `DROP INDEX "*_trgm_idx"` lines. That is expected and
**must never be applied** — those are the search indexes, which Prisma cannot express in its schema.

> **Never** pass a real database as `--shadow-database-url`. Prisma wipes whatever it is handed as a shadow.
> That is how the original database was lost. Use `npm run db:verify-parity`, which creates and drops its own
> throwaway shadow.

### Rebuilding the database from scratch

If you need a clean copy:

```bash
# 1. Extract the noblestride slice of the dump (lines 105-8880).
sed -n '105,8880p' ~/Downloads/noblestride_pg_dumpall.sql > /tmp/slice.sql
#    Sanity: 8776 lines, 48 COPY blocks, and NO \connect / CREATE DATABASE / DROP DATABASE.
grep -c '^COPY public' /tmp/slice.sql
grep -c '^\\connect\|^CREATE DATABASE\|^DROP DATABASE' /tmp/slice.sql   # must be 0

# 2. New database, load it, bring it up to date.
docker exec noblestride-postgres psql -U noblestride -d postgres \
  -c "CREATE DATABASE noblestride_fresh TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'en_US.utf8' LC_CTYPE 'en_US.utf8';"
docker cp /tmp/slice.sql noblestride-postgres:/tmp/slice.sql
docker exec noblestride-postgres psql -U noblestride -d noblestride_fresh -f /tmp/slice.sql

# 3. Point .env at it, then:
npx prisma migrate deploy                        # applies migration 42
npm run db:fix-checksums -- --execute            # 24 rows re-stamped; deploy must come first
npm run seed:workflow                            # 1 template, 13 steps, 3 AppSettings
npm run db:cleanup-prefixed -- --prefix ZZTest --execute
npm run db:verify-parity
```

Restore into a **new** database rather than reloading in place, so the old one stays inspectable. Restart
`npm run dev` afterwards — the connection pool holds the old URL.

**Before any production `prisma migrate deploy`**, run the checksum fixer against production first, dry-run
then execute, or the deploy fails with P3018:

```bash
npm run db:fix-checksums -- --allow-remote          # dry run, read the output
npm run db:fix-checksums -- --allow-remote --execute
```

### Logins

Staff logins are the real ones from the restored data (`evans@noblestride.capital`,
`solomon@noblestride.capital`, …). For the portal-side checks the automated suite seeds temporary accounts;
create them with:

```bash
npm run e2e:seed        # adds the zz- fixtures
npm run e2e:cleanup     # removes them again — do this when you are done
```

| Role | Email | Password |
|---|---|---|
| Staff admin | `zz-e2e-admin@e2e.noblestride.test` | `E2e!Passw0rd-2026` |
| Staff (non-admin) | `zz-e2e-member@e2e.noblestride.test` | `E2e!Passw0rd-2026` |
| Investor (Editor) | `zz-e2e-investor@e2e.noblestride.test` | `E2e!Passw0rd-2026` |
| Investor (Viewer) | `zz-e2e-colleague@e2e.noblestride.test` | `E2e!Passw0rd-2026` |
| Referral partner | `zz-e2e-partner@e2e.noblestride.test` | `E2e!Passw0rd-2026` |
| Applicant (no login) | `zz-solomon@e2e-applicant.test` | uses an emailed code |

### Watch the whole thing verify itself

```bash
npm run test:e2e          # headless, ~1 minute, 65 checks
npm run test:e2e:watch    # the same 65 in a visible browser, slowed down so you can follow
```

Every check is named after the feedback item it proves (F1.1, F2.1 … G3), and each narrates its own steps.
`E2E_SLOWMO=800 npm run test:e2e:watch` slows it further.

Teardown leaves the data exactly as it found it: no `zz-` rows, one default workflow template, and the app
settings back at their defaults. Worth confirming afterwards if you ran it against data you care about.

---

## 1. Sign-up and sign-in, separated by role (§1, image1)

| Step | Expected |
|---|---|
| Open `/login` | A split page: brand on the left, sign-in card on the right, and four tabs — Client, Investor, Partner, **Noblestride staff** |
| Read the line under the tabs | "Tabs only change the help text — sign in with your email and password from any tab" |
| Click **Client** | Subtitle mentions applications; a link **Track your application →** pointing at `/apply/status` |
| Click **Investor** | A link to register a fund |
| Click **Partner** | A link to claim an invitation |
| Sign in as the investor **from the Noblestride staff tab** | You still land in the investor portal |
| Open `/register` | Four cards: company raising capital, investor or fund, referral partner, Noblestride staff |
| Click each card | `/intake`, `/register?path=fund`, `/register?path=partner`, `/register?path=internal` |

**Why the tabs do not gate anything:** blocking a login by tab would tell a visitor which kind of account an
email belongs to, and would lock out anyone who is both a partner contact and a fund contact.

---

## 2. Website applications, and the applicant's details (§2 texts 1 and 3, image2, image4)

Run `npm run e2e:seed` first so there is an application to look at.

| Step | Expected |
|---|---|
| Sign in as staff admin, look at the left sidebar | An **Applications** item with a count badge |
| Click it | Three tabs: Awaiting, Accepted, Not taken forward |
| Find "zz-E2E Applicant (Website)" | The row shows the applicant's **name, job title, email and phone** |
| Search "Oulula" | The list narrows to that one application |
| Click the company name | The mandate page opens with an **Applicant** block repeating the same four fields |
| Back on Applications, pick a deal lead and click **Accept** | The row moves to the Accepted tab and the Awaiting count drops |

The contact details were always being saved; nothing displayed them. That is what changed.

---

## 3. The applicant's own status page (§5 intake agent, image25)

No login. Use a private window.

| Step | Expected |
|---|---|
| Open `/apply/status` | One field: the email you applied with |
| Enter `zz-solomon@e2e-applicant.test` | A neutral "we have sent a code" screen |
| Get the code | Development mode writes it to a temp file rather than sending mail; the automated check reads it for you. With `RESEND_API_KEY` set it is emailed. |
| Enter the code | Your application: company, date submitted, **status**, the contact we hold, and the documents on file by name only |
| Look for investor names | There are none — interest appears as a **count**, never a name |
| Try **Upload document** | A PDF, Word or Excel file up to 16 MB is accepted and filed for review |
| Start again with an email that never applied | **The same** "we have sent a code" screen |

That last row is the point: the page must never reveal whether an email is on file, or anyone could
enumerate Noblestride's pipeline.

---

## 4. Investors: onboarding, NDA, dates and people (§3, images 5-12)

### 4.1 Investment criteria at registration (image5, image6)

| Step | Expected |
|---|---|
| In a private window, `/register?path=fund` | The fund wizard, seven steps |
| Complete it (any details; set a password at the review step) | You land on an **upload your investment criteria** step |
| Look for a way past it | A **Skip** button, as prominent as the upload — the client asked for optional |
| Upload a PDF | Confirmation that it is attached |
| As staff, open the dashboard | The registration in the review queue carries a **Criteria attached** badge |
| Open the fund's page | A **Criteria on file** chip in the header, and the document pinned at the top of Documents |

### 4.2 The NDA (image7)

| Step | Expected |
|---|---|
| Sign in as the investor, click **NDA** in the portal sidebar | The Noblestride NDA on letterhead, eight clauses, Noblestride's countersignature already applied |
| Look at the signature area | Three tabs: **Draw**, **Type**, **Upload** |
| Draw a signature, type the signatory's name, tick "I am an authorised signatory", click **Sign NDA** | "Your NDA is signed and on file", and the card collapses to Signed + Re-sign |
| As staff, open that investor | NDA status **Open NDA**, and one **Executed** NDA document |
| Back in the portal, use **Or upload your own NDA** with a PDF | It appears as **Under review** |
| As staff on the investor page | An **Uploaded NDAs awaiting sign-off** list with **Mark countersigned** |
| Click it | The document becomes Executed and the investor's Open NDA applies |
| As staff, click **Send standard NDA** | The button reads "NDA requested"; the fund gets a notification. It does **not** change any NDA status |

### 4.3 Date onboarded, and finding a person (image8, image9)

| Step | Expected |
|---|---|
| Open `/investors` | An **Onboarded** column |
| Click the column header | The list sorts by it, newest first; click again to reverse |
| Set **Onboarded from** to tomorrow | The list empties |
| Search a contact's surname, not a fund name | A **People matching "…"** card appears above the table with the person, their fund, role, email and phone |
| Click the person's name | The fund page opens scrolled to that contact's row |

**Note on blank dates.** 93 of the 94 approved investors have no real approval date on record — they were
bulk-imported on the same day. Writing that timestamp in as a "date onboarded" would invent history, so
those show a dash. From now on the date is stamped when an investor is approved. For a demo you can
backfill from creation dates with `npm run db:backfill-approved-at -- --sources=activity,registeredAt,createdAt`.

### 4.4 Team invitations and reset links (image10)

| Step | Expected |
|---|---|
| As the investor Editor, open **Team**, invite a colleague | "Invitation emailed to …", with the link one click away behind "Didn't arrive?" |
| If mail is not configured | The copy-link panel stays fully prominent instead — it is then the only way in |
| Open the invitation link in a private window | It greets you with the fund's name |
| Enter the **wrong** email | Refused, without saying whose invitation it is |
| Enter the right email and a password | You land on `/login`, and can sign in as the new member |
| Use the link a second time | It no longer works |
| As staff on an investor, click **Email reset link** | It says whether the mail went out, and shows the link either way |

### 4.5 Changing a contact's email (image11, image12)

| Step | Expected |
|---|---|
| As staff, open an investor's **Account access** panel | A **Change email** field per login |
| Change one | Confirmation appears |
| Check the contact card | The contact's email changed too |
| Check **Change History** | An `email` row with the old and new values |
| Try the **old** address at `/login` | "Incorrect email or password" |
| Try the **new** address | Signs in |

The person is also signed out everywhere, and both addresses are notified.

---

## 5. Deals: workflow, filters, advisory, retainer (§4, images 13-18)

| Item | Step | Expected |
|---|---|---|
| Workflow defined (image13, image15, image32) | Open any mandate or transaction | A **Deal Workflow** card: three phases (Qualify, Prepare, Execute), the template's name, and the 12/13 steps from the client's diagram |
| Steps driven by evidence | Look at a completed step | It says what completed it, and links to the record that proves it (VDR, documents) |
| "How do I move this to investor shortlisting?" (image13) | Click **Move deal here** on a later step | Every earlier open step is completed with a note, and the target becomes current |
| "Stage" was ambiguous (image13) | Look at the enum control | It is labelled **Pipeline status**, with help text distinguishing it from the workflow |
| "A deal after it is signed" (image13) | Read the Signed help text | It says the opportunity becomes a deal at signature |
| Customisable stages (§4.1 text 3, image14) | Open `/settings/workflows` | Create a template, edit its steps, assign it to one deal; the default is badged and cannot be deleted |
| Filters were crowded (image16) | Open `/deals` | A small bar: type, stage, search, and **More filters** for the rest. Applied filters show as removable chips |
| Advisory classification (§4.2, image17) | Open an advisory engagement | A **Classification** field (Valuation, Due Diligence, Business Plan / Pitch Deck, Financial Model, Advisory Support, Other), plus fee paid and balance |
| Retainer (§4.3, image18) | Open a mandate | Retainer **amount**, **paid** and **balance due**; paying in full takes the balance to zero |

---

## 6. Clients list (§2 text 2, §6, images 3, 26)

| Step | Expected |
|---|---|
| Open `/clients` | Newest first, with **Created** and **Country** columns |
| Use the filters | Country, sector and revenue band, combinable with the search |

---

## 7. The investor portal (§6b, images 27-31)

Sign in as `zz-e2e-investor@e2e.noblestride.test`.

### 7.1 See every deal, and register interest anywhere (image27)

| Step | Expected |
|---|---|
| Open the portal home | **Investment Opportunities**, with two tabs: **Browse all (n)** and **Matches my mandate (n)** |
| Compare the counts | Browse all is larger — that gap is the change. Previously only mandate matches were visible |
| Look at the cards | Matches carry a **Matches your mandate** chip |
| Click **Express interest** on a card that is *not* a match, add a note, send | You return to the grid, the card says "Interest registered", and the deal appears in My Pipeline |
| As staff | The deal lead, assists, owner and admins all get a notification with the note |

### 7.2 Detail stays restricted until access is granted (image28)

| Step | Expected |
|---|---|
| As the investor, open that deal | A banner: **Interest received** — the team is reviewing your request |
| Look at the figures | Ranges, not exact numbers |
| Check My Pipeline | The row reads **Awaiting access** (the row's wording only ever moves forward: Shared with you → Awaiting access → Access granted → Information shared → In discussion → Closed) |
| As staff, open the engagement | A **Deal access** field showing "Awaiting access grant", and a **Grant deal access** button |
| Click it while the fund has no NDA | **Refused**, with copy telling you to ask them to sign the NDA in their portal |
| Try it on a deal the fund **withdrew** from | No button at all — an explanation that they withdrew, and that the engagement must be moved off Declined first. Granting access must never quietly un-decline somebody |
| Have the fund sign the NDA (4.2), then click again | Access granted; the engagement moves to NDA Signed |
| Back in the portal | The row reads **Access granted**, the banner is gone, and figures are exact |

**Why it refuses:** the feedback implies detail should unmask as soon as interest arrives, and the signed
scope forbids sharing confidential information without an NDA. Rather than weaken that rule, the NDA is now
one click away from the deal — that is the whole point of 4.2.

### 7.3 Status instead of a checklist (image29, image30)

| Step | Expected |
|---|---|
| Open a deal in the portal | A single status chip: **Open**, **In progress** or **Closed**, plus the conversation with the deal team |
| Look for the 15-step milestone list | It is **not** there by default |
| Look for "Success fee paid" | Not there, and it never will be |
| As an admin, open `/settings/app`, turn on **Investor portal: milestone checklist** | The fund now sees a **14**-step list. Still no success fee |
| Turn it off again | Gone |
| Open the portal **Dashboard** | No Committed/Disbursed/Pending tiles. Instead an onboarding checklist: account → fund profile → NDA → criteria → approval, each step linking to the page that completes it |
| Turn on **Investor portal: finance KPI tiles** | The tiles and the quarterly table appear; the checklist steps aside |

**Where the finance numbers come from:** the CRM's own engagement records. Investors never edit them.

### 7.4 Adding colleagues to a deal (image31)

| Step | Expected |
|---|---|
| As the investor Editor, open a deal you have an engagement on | A **Participants** card: "They must already have portal access" |
| Open the colleague dropdown | Only colleagues who already have a portal login. `zz-E2E Not Onboarded` is **absent**, and so is your primary contact — they follow every deal already, and adding them would create a row that cannot be removed |
| Add the colleague | They appear in the list; staff see them on the engagement page |
| Try to remove your fund's primary contact | Refused — the primary contact always follows the deal |
| Open My Pipeline | An **Only deals I follow** tab, and an **I follow this** chip |

---

## 8. Referral partners can log in (§5 referral agent, image23)

| Step | Expected |
|---|---|
| Sign in as `zz-e2e-partner@e2e.noblestride.test` | You land in the **partner portal** |
| Look around | The mandates you referred, with their stage; a log-out control |
| Try `/dashboard` or `/portal/investor` | You are sent back |
| As a staff admin, open that partner | A **Partner portal access** panel: the live account, suspend, email a reset link, and invite other contacts |

This portal existed but was unreachable — no account could ever resolve to a partner. Now it can.

---

## 9. The six agents

### 9.1 The passphrase

One shared secret per agent, set by an admin, never sent by the agent. Full detail — what it is, who picks
it, how to rotate it, and a troubleshooting table — is in each agent's own `AGENT-GUIDE.md`:

```
crm_agent/AGENT-GUIDE.md                investor_agent/AGENT-GUIDE.md
investor-tracker-agent/AGENT-GUIDE.md   client_agent/AGENT-GUIDE.md
referal_partner_agent/AGENT-GUIDE.md    website_intake_agent/AGENT-GUIDE.md
```

Setting and rotating it (run from the agent's own directory):

```bash
cd crm_agent
lua env sandbox --list
lua env sandbox -k TEAM_PASSPHRASE    -v "<new phrase>"
lua env sandbox -k PASSPHRASE_VERSION -v "<old number + 1>"
```

Bumping `PASSPHRASE_VERSION` is the part that makes a rotation mean anything. Verification is stored per
user, so before this a rotated phrase left everyone who had already verified still verified. Blank or unset
counts as generation 1, so adding the variable signs nobody out.

The passphrase currently live on the agents is **`noblestride2026`**.

> ### Two warnings, both verified on 2026-08-27
>
> **1. `lua chat -e sandbox` is not sandboxed.** It ignores sandbox environment variables and uses the
> **production** ones. Proof: sandbox `CRM_API_URL` was set to an invalid host and the agent still answered
> with live CRM data. So a "sandbox" chat reads and could write your real records. Treat sandbox chats as
> read-only against live data, and test anything that writes with `lua test skill` (local, no network) or
> against a local CRM.
>
> **2. A rotation is not in force until you prove it.** `lua env` reports success and `--list` shows the new
> value while the runtime keeps the old one. After rotating, send the **old** phrase in a fresh chat and
> confirm it is refused **before** telling the team the new one.

### 9.2 Watch every agent answer the client's own questions

```bash
cd noblestride-crm && npm run dev          # in one terminal
cloudflared tunnel --url http://localhost:3000   # in another
TEAM_PASSPHRASE=noblestride2026 STAFF_EMAIL=evans@noblestride.capital \
  bash docs/superpowers/plans/wsc-sandbox-qc.sh
```

It writes a transcript and prints its path. Every message is a question — do not add one that writes, given
warning 1 above. A completed run is committed at
`docs/feedback/wsc-sandbox-qc-20260827-2241.log` if you would rather just read one.

### 9.3 What to check, per agent

**CRM agent (§5 text 1, image19, image20)** — the five-times loop

| Say | Expected |
|---|---|
| `log out` | Signed out of staff mode |
| `how does this work` | A proper explanation: what it does, three example questions, what a passphrase is, that an admin sets `TEAM_PASSPHRASE`. **Not** the staff-only challenge |
| `whats the main function of this CRM <your email>` | The same explanation. This is the client's own message from the screenshots, and it used to return the identical challenge |
| `<your email>` alone | It acknowledges the address and says the passphrase is still needed. It never says whether the address is known |
| `noblestride2026 <your email>` | "Verified. Welcome, <name>" plus three things to try |
| `how many opportunities are in the pipeline` | A count, split into mandates and transactions, **with the definition**: an opportunity is a Mandate or a Transaction; advisory assignments are counted separately |
| `summarize the client <a real client>` | A briefing, one field per line, with a link |
| `recent news on Equity Group Holdings` | Sourced findings under **"Public information (web), not from the CRM"** |
| `research Project Ivory Oryx` | **Refused** — a codename must not go into a public search — and asks for the public company name |
| `recent news on 3M` or `Project Finance Advisors` | These are real companies and are **researched normally**. An early version of the guard refused both |

**Investor tracker (image24)** — same first-contact behaviour, and `Whats a pass phrase and hwo is it set
out` (the client's own wording, misspellings included) gets the explanation. It verifies on the passphrase
alone; sending an email instead is told so politely.

**Referral partner tracker (image23)** — staff only now. `hi` and `verify my partner code 1234` both get a
courteous block that names the **partner portal** as where partners go. `issue an access code for …`
explains that surface was retired. No two-audience pitch anywhere.

**Website intake agent (image22, image25)** — new enquiries only.

| Say | Expected |
|---|---|
| `Hello` | "Good day. Thank you for contacting Noblestride Capital." No exclamation mark, no "Hi there" |
| `I'm Clients ABCD, my email is clientsabcd@gmail.com` | The corporate-email requirement, stated as requirement → reason → next step. **No** "Quick flag though", no mirrored informality |
| `tahst muy coproatret email` | A measured restatement: the requirement is the domain, not how the address is used |
| `is Acme a client of yours?` | Declines to confirm or deny anything in Noblestride's records |
| `how do I check my application later?` | Points at the client portal / client assistant |

**Client agent (image22, image25)** — existing clients only. An informal opener gets a formal reply; a Gmail
address gets the security sentence without ever saying whether it matches; a new company is sent to
`/intake`.

**Investor agent (image21)** — on web chat, `what deal is my account looking at` now gets an **explanation**:
identity here is the verified sender of an email, a chat window cannot prove it, so write in from your
registered address or use the portal (with the link). It confirms nothing about any account. Over email,
from an address on an investor's contact record, it answers with the deal's **code name** and stage.

**Why testing over email needs a real setup:** identity *is* the email address. Add a mailbox your team
controls as a contact on a test investor with a live engagement, then email the agent from it and watch
`lua logs --type skill --name investor-correspondence`. `investor_agent/AGENT-GUIDE.md` has the procedure.

---

## 10. What was lost, and what was rebuilt

Two incidents shaped this work. Both are worth knowing because they explain some of the numbers above.

**1. The original database was emptied (2026-08-27).** Verifying a migration, a `prisma migrate diff` was
run with the real `DATABASE_URL` passed as `--shadow-database-url`. Prisma **resets whatever it is handed as
a shadow**: it dropped every object and replayed the migrations into it. Every application row went. Blast
radius was local only — production, the branch and the dump file were untouched. Recovery was to restore the
dump into a second database rather than reload the first, so the empty one stayed inspectable.
`npm run db:verify-parity` now does that check safely, with its own throwaway shadow, and refuses to run if
`DATABASE_URL` names it.

**2. The first restored copy silently lost most of its data.** By the time this session started,
`noblestride_restored` held 0 transactions, 0 engagements and 4 contacts, and had lost every investor and
partner login — while clients, mandates, investors and staff users still looked correct. A shallow count
check passed; the data was gone. The cause was never found in the codebase (every deletion in the CRM's own
scripts and tests is narrowly scoped). It was restored again into `noblestride_dump2`.

**What is genuinely gone for good:** the application code written between 31 July and 25 August on a
machine that died. Its database schema survived in the dump, which is why six migrations existed with no
code behind them, and that code was rebuilt from the schema during this work.

**Two test bugs that had been quietly dirtying the data**, both now fixed: a smoke test leaked one orphaned
contact per run (52 copies had accumulated), and fixture teardown left the authentication audit trail behind
(342 rows in one session).

---

## 11. Still open

1. **The "Live Tracker deal template"** referred to on image27 is not in the repository. The investor teaser
   currently shows code name, sector, countries, deal type, instrument, target raise, banded financials and
   mandate status. Send us the template and the fields will be mapped to it exactly.
2. **`lua chat -e sandbox` ignoring sandbox environment variables** (section 9.1) is a platform issue worth
   raising with Lua. Until it is fixed, agent write paths cannot be exercised safely through chat.
3. **Per-user access codes for staff.** A single shared passphrase cannot tell two colleagues apart, so the
   audit trail says "a verified staff member" rather than who. Both halves of the better answer already
   exist in the CRM. Not built — do not consider it delivered.
4. **A retainer payment log.** Retainer amount, paid and balance are in place; a log of individual payments
   is not.
5. **Nothing is deployed.** The CRM changes are on the `feedback/2026-08` branch, not on Vercel. All six
   agents are staged one version ahead of what is live — no version was promoted. Both await your go-ahead.
