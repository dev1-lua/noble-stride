// portal/investor/deals/[id]/page.tsx — tier-gated deal view (spec §5.2).
// Renders ONLY what the visibility projector returned for this investor's tier.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadInvestorPortalData, loadOwnEngagementForDeal } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";
import { INVESTOR_VISIBLE_MILESTONES, MILESTONE_LABELS } from "@/lib/milestones";
import { nextStepLabel } from "@/lib/next-step";
import { TierBadge } from "@/components/portal/tier-badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { getThreadForEngagement } from "@/server/services/conversations";
import { getPortalMembership, capabilitiesOf } from "@/server/auth/portal-authz";
import { accessState } from "@/server/domain/access-state";
import { portalDealStatus, type PortalDealStatus } from "@/server/domain/deal-status";
import { getBoolSetting } from "@/server/services/app-settings";
import { CONVERSATION_STATUS_LABELS, CONVERSATION_STATUS_CLASSES } from "@/lib/conversation-status";
import { expressInterest, requestNextStep, declineDeal, postThreadMessage } from "./actions";
import { ParticipantsCard } from "./participants-card";
import { listParticipants, eligibleParticipants } from "@/server/services/engagement-participants";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const MSG_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// F6b.3 / G3: three states, deliberately coarse — see domain/deal-status.ts.
const DEAL_STATUS_TONE: Record<PortalDealStatus, string> = {
  Open: "bg-[var(--t-tag-bg-sky)] text-[var(--t-tag-text-sky)]",
  "In progress": "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
  Closed: "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
};

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <dt className="text-sm text-[var(--text-tertiary)]">{k}</dt>
      <dd className="text-right text-sm font-medium text-[var(--text-primary)]">{v ?? "—"}</dd>
    </div>
  );
}

function CheckIcon({ done }: { done: boolean }) {
  if (!done) {
    return (
      <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)]" />
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-[var(--accent)] text-white"
      aria-hidden
    >
      <path
        d="M4.5 8.5l2.5 2.5 4.5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function InvestorDealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    interest?: string;
    request?: string;
    message?: string;
    denied?: string;
    participant?: string;
  }>;
}) {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const { id } = await params;
  const { interest, request, message: messageSent, denied, participant } = await searchParams;
  const { deals } = await loadInvestorPortalData(prisma, vp.recordId);
  const deal = deals.find((d) => d.id === id);
  if (!deal) notFound();

  const journey = await loadOwnEngagementForDeal(prisma, vp.recordId, id);

  // Seat capabilities (item 3): Viewers see everything but act on nothing;
  // thread posting needs the per-member opt-in. Server actions re-check.
  const membership = await getPortalMembership();
  const caps = membership ? capabilitiesOf(membership) : { canEdit: false, canPostInThreads: false };

  // The two-way conversation thread for this engagement (item 1).
  const engagement = journey
    ? await prisma.engagement.findUnique({
        where: { transactionId_investorId: { transactionId: id, investorId: vp.recordId } },
        select: { id: true },
      })
    : null;
  const thread = engagement ? await getThreadForEngagement(engagement.id) : null;

  // F3.2 / D2: the client expected deal detail to unmask as soon as interest is
  // registered. SOW §06 forbids that without an NDA, so instead of weakening
  // the guard we put the NDA one click away from the deal the fund is looking at.
  const ndaStatus = (
    await prisma.investor.findUnique({ where: { id: vp.recordId }, select: { ndaStatus: true } })
  )?.ndaStatus;

  // F6b.3 as amended by G3 (image29): by default the investor gets ONE word for
  // where the deal stands plus the comment thread. The 14-step checklist is
  // opt-in per org, because the client's own note was that it "might need to be
  // removed from the investor".
  const showMilestones = await getBoolSetting("portal.deal.milestones");
  const dealStatus: PortalDealStatus | null = journey
    ? portalDealStatus({
        dealStatus: journey.dealStatus,
        transactionStage: journey.transactionStage,
        engagementStage: journey.own.stage,
      })
    : null;

  // F6b.4 (image31): the fund's own roster on this deal. Only meaningful once
  // they actually have an engagement on it.
  const [participants, eligible] = engagement
    ? await Promise.all([listParticipants(engagement.id), eligibleParticipants(engagement.id, vp.recordId)])
    : [[], []];

  const fin = deal.financialsSummary;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal/investor" className="text-sm text-[var(--accent-hover)] hover:underline">
          ← All opportunities
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{deal.name}</h1>
          <TierBadge tier={deal.tier} />
        </div>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">{deal.companyProfile.clientName}</p>
      </div>

      {/* F6b.2 (image28): interest has been registered and staff have not yet
          granted access. Saying so is the honest answer to "why can I not see
          more?" — and it is also the client's own requested behaviour: detail
          stays restricted until access is granted. */}
      {journey && accessState({ engagementStage: journey.own.stage, status: journey.own.status }) === "interest_received" && (
        <div
          data-testid="interest-received-banner"
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--t-tag-bg-amber)] px-4 py-3 text-sm text-[var(--t-tag-text-amber)]"
        >
          <span className="font-semibold">Interest received</span> — the Noblestride deal team is reviewing your
          request. Detailed information unlocks once access is granted and your NDA is in place.
          {ndaStatus === "None" && (
            <>
              {" "}
              <Link href="/portal/investor/nda" className="font-medium underline">
                Sign the Noblestride NDA
              </Link>{" "}
              to save a step.
            </>
          )}
        </div>
      )}

      {ndaStatus === "None" && (
        <div
          data-testid="nda-prompt"
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]"
        >
          Detailed information is shared after an NDA is signed.{" "}
          <Link
            href="/portal/investor/nda"
            className="font-medium text-[var(--accent-hover)] hover:underline"
            data-testid="nda-prompt-link"
          >
            Sign the Noblestride NDA →
          </Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Company Profile
            </h2>
          </CardHeader>
          <CardBody>
            <dl className="divide-y divide-[var(--border-subtle)]">
              <Row k="Sector" v={deal.companyProfile.sector.map((s) => label("Sector", s)).join(", ")} />
              <Row k="Core product" v={deal.companyProfile.coreProduct} />
              <Row k="HQ" v={deal.companyProfile.hqCity} />
              <Row
                k="Countries"
                v={deal.companyProfile.countries.map((c) => label("Geography", c)).join(", ") || null}
              />
              <Row k="Founded" v={deal.companyProfile.yearFounded} />
            </dl>
            {deal.companyProfile.description && (
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                {deal.companyProfile.description}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Deal &amp; Financials
            </h2>
          </CardHeader>
          <CardBody>
            <dl className="divide-y divide-[var(--border-subtle)]">
              <Row k="Deal type" v={deal.dealTypeTicket.dealType ? label("DealType", deal.dealTypeTicket.dealType) : null} />
              <Row
                k="Instrument"
                v={deal.dealTypeTicket.instrument.map((i) => label("Instrument", i)).join(", ") || null}
              />
              <Row
                k="Target raise"
                v={
                  deal.dealTypeTicket.targetRaise != null
                    ? formatMoney(deal.dealTypeTicket.targetRaise, deal.dealTypeTicket.currency)
                    : null
                }
              />
              <Row
                k={fin.disclosure === "limited" ? "Revenue (range)" : "Revenue (last year)"}
                v={typeof fin.revenueLastYear === "number" ? formatMoney(fin.revenueLastYear) : fin.revenueLastYear}
              />
              <Row
                k={fin.disclosure === "limited" ? "Forecast (range)" : "Revenue forecast"}
                v={typeof fin.revenueForecast === "number" ? formatMoney(fin.revenueForecast) : fin.revenueForecast}
              />
              <Row k="Profitability" v={fin.profitability == null ? null : label("Profitability", fin.profitability)} />
              <Row
                k="Mandate status"
                v={deal.matchingMandateStatus ? label("MandateStage", deal.matchingMandateStatus) : null}
              />
            </dl>
            {fin.disclosure === "limited" && (
              <p className="mt-3 rounded-md bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
                Detailed financials are shared after an NDA is signed. Contact your Noblestride
                advisor to proceed.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Documents</h2>
        </CardHeader>
        <CardBody>
          {deal.documents.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">
              No documents available at your current access level.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {deal.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{doc.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {label("DocumentType", doc.type)}
                      {doc.version ? ` · v${doc.version}` : ""}
                    </div>
                  </div>
                  {doc.downloadUrl ? (
                    <a
                      href={doc.downloadUrl}
                      className="rounded-md bg-[var(--t-tag-bg-emerald)] px-3 py-1 text-xs font-medium text-[var(--t-tag-text-emerald)] transition-colors hover:opacity-80"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">On request</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {deal.advisorClientContacts && deal.advisorClientContacts.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Company Contacts
            </h2>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {deal.advisorClientContacts.map((c, i) => (
                <li key={i} className="py-2.5 text-sm">
                  <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
                  {c.jobTitle && <span className="text-[var(--text-tertiary)]"> — {c.jobTitle}</span>}
                  {c.email && <span className="block text-xs text-[var(--text-tertiary)]">{c.email}</span>}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {journey ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Your Position on This Deal
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  data-testid="deal-status-chip"
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${DEAL_STATUS_TONE[dealStatus ?? "Open"]}`}
                >
                  {dealStatus}
                </span>
                {showMilestones && (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    <span className="font-semibold text-[var(--text-secondary)]">
                      {journey.own.milestoneKeys.length} of {INVESTOR_VISIBLE_MILESTONES.length}
                    </span>{" "}
                    milestones
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {showMilestones && (
              <ol className="divide-y divide-[var(--border-subtle)]" data-testid="deal-milestones">
                {INVESTOR_VISIBLE_MILESTONES.map((key) => {
                  const done = journey.own.milestoneKeys.includes(key);
                  const date = journey.milestoneDates[key];
                  return (
                    <li key={key} className="flex items-center gap-3 py-2">
                      <CheckIcon done={done} />
                      <span
                        className={`text-sm ${done ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}
                      >
                        {MILESTONE_LABELS[key]}
                      </span>
                      {done && date && (
                        <span className="ml-auto text-xs text-[var(--text-tertiary)]">{DATE_FMT.format(date)}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {!showMilestones && (
              <p className="text-sm text-[var(--text-secondary)]">
                {dealStatus === "Closed"
                  ? "This opportunity is closed. Your history stays available here."
                  : dealStatus === "In progress"
                    ? "You have access to this deal and the process is under way. Ask the deal team anything in the conversation below."
                    : "This opportunity is open. Register your interest or ask the deal team a question in the conversation below."}
              </p>
            )}
            {(() => {
              const step = nextStepLabel(journey.own.stage);
              return (
                <div
                  className={`flex flex-wrap items-center gap-3 ${showMilestones ? "mt-4 border-t border-[var(--border-subtle)] pt-4" : "mt-4"}`}
                >
                  {request && (
                    <p className="w-full rounded-md bg-[var(--t-tag-bg-emerald)] px-3 py-2 text-sm font-medium text-[var(--t-tag-text-emerald)]">
                      Request sent — the deal team will follow up.
                    </p>
                  )}
                  {step && caps.canEdit && (
                    <form action={requestNextStep}>
                      <input type="hidden" name="dealId" value={deal.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                      >
                        {step}
                      </button>
                    </form>
                  )}
                  {journey.own.stage !== "Declined" && journey.own.stage !== "Invested" && caps.canEdit && (
                    <form action={declineDeal}>
                      <input type="hidden" name="dealId" value={deal.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-[var(--t-tag-bg-rose)] px-4 py-2 text-sm font-medium text-[var(--t-tag-text-rose)] transition-colors hover:bg-[var(--t-tag-bg-rose)]"
                      >
                        Withdraw from this deal
                      </button>
                    </form>
                  )}
                  {!caps.canEdit && (
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Your access is view-only — ask a team member with edit access to take deal actions.
                    </p>
                  )}
                </div>
              );
            })()}
          </CardBody>
        </Card>
      ) : null}

      {engagement && (
        <ParticipantsCard
          dealId={deal.id}
          participants={participants}
          eligible={eligible}
          canEdit={caps.canEdit}
          notice={participant}
        />
      )}

      {denied && (
        <p className="rounded-md bg-[var(--t-tag-bg-amber)] px-3 py-2 text-sm font-medium text-[var(--t-tag-text-amber)]">
          {denied === "thread"
            ? "Your access is view-only — posting in this conversation needs the team's permission."
            : "Your access is view-only — this action needs edit access."}
        </p>
      )}

      {journey ? (
        // Two-way conversation thread with the deal team (action points 2026-07 item 1).
        <section
          id="conversation"
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Conversation with the Deal Team
            </h2>
            {thread && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONVERSATION_STATUS_CLASSES[thread.status]}`}
              >
                {CONVERSATION_STATUS_LABELS[thread.status]}
              </span>
            )}
          </div>
          {(messageSent || interest || request) && (
            <p className="mt-3 rounded-md bg-[var(--t-tag-bg-emerald)] px-3 py-2 text-sm font-medium text-[var(--t-tag-text-emerald)]">
              {messageSent
                ? "Message sent — the deal team will reply here."
                : "Thank you — your request has been sent to the Noblestride team. They will follow up here."}
            </p>
          )}

          {thread && thread.messages.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {thread.messages.map((m) => (
                <li
                  key={m.id}
                  className={`max-w-[85%] rounded-lg border px-3 py-2 ${
                    m.senderKind === "STAFF"
                      ? "ml-auto border-[var(--accent)]/30 bg-[var(--bg-secondary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-primary)]"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      {m.senderKind === "STAFF" ? `${m.senderName} · Noblestride` : m.senderName}
                    </span>
                    <span className="text-[11px] text-[var(--text-tertiary)]">{MSG_DATE_FMT.format(m.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-[var(--text-primary)]">{m.body}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-tertiary)]">
              No messages yet. Need something specific — data room access, a management call, updated
              financials? Start the conversation below.
            </p>
          )}

          {caps.canPostInThreads ? (
            <form action={postThreadMessage} className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4">
              <input type="hidden" name="dealId" value={deal.id} />
              <textarea
                name="message"
                rows={3}
                required
                placeholder="Write a message to the deal team…"
                className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[var(--text-tertiary)]">{deal.contact}</span>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                >
                  Send message
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-tertiary)]">
              Your access is view-only. Ask your team to enable conversation access if you need to
              message the deal team directly.
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--t-tag-bg-emerald)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--t-tag-text-emerald)]">
            Express Interest
          </h2>
          {interest && (
            <p className="mt-2 rounded-md bg-[var(--bg-primary)] px-3 py-2 text-sm font-medium text-[var(--t-tag-text-emerald)]">
              Thank you — your request has been sent to the Noblestride team. They will follow up
              shortly.
            </p>
          )}
          <p className="mt-2 text-sm text-[var(--t-tag-text-emerald)]">
            Interested in this opportunity? Register your interest and the Noblestride team will start
            your process.
          </p>
          {caps.canEdit ? (
            <form action={expressInterest} className="mt-3 space-y-3">
              <input type="hidden" name="dealId" value={deal.id} />
              <textarea
                name="message"
                rows={3}
                placeholder="Optional message for the deal team…"
                className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[var(--t-tag-text-emerald)]">{deal.contact}</span>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                >
                  Express interest
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-3 text-xs text-[var(--t-tag-text-emerald)]">
              Your access is view-only — a team member with edit access can express interest for your
              organization.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
