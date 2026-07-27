// portal/investor/profile — the per-fund editable profile, structured as the
// 7 sections of the client's "Data collected from potential investors" doc.
// These preferences drive which deals get pushed to the investor (§5.3
// discovery filters read sectorFocus/geographicFocus/ticketMin/ticketMax).
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { getPortalMembership } from "@/server/auth/portal-authz";
import { bandsForInvestor } from "@/server/services/ticket-bands";
import { TicketBandsEditor } from "@/components/portal/ticket-bands-editor";
import { options } from "@/lib/vocab";
import { ContactEmailField } from "@/components/portal/contact-email-field";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { PHONE_MESSAGE } from "@/lib/schemas/phone";
import { saveFundProfile } from "./actions";

export const dynamic = "force-dynamic";

const INPUT_CLS =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-tertiary)]">{label}</span>
      {children}
    </label>
  );
}

function ChipGroup({
  name,
  group,
  selected,
}: {
  name: string;
  group: string;
  selected: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options(group).map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input
            type="checkbox"
            name={name}
            value={o.value}
            defaultChecked={selected.includes(o.value)}
            className="peer sr-only"
          />
          <span className="inline-block rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-1 text-xs font-medium text-[var(--text-tertiary)] transition-colors peer-checked:border-[var(--accent)] peer-checked:bg-[var(--t-tag-bg-emerald)] peer-checked:text-[var(--t-tag-text-emerald)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)]">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{title}</h2>
      </CardHeader>
      <CardBody className="space-y-4">{children}</CardBody>
    </Card>
  );
}

function Textarea({
  name,
  defaultValue,
  placeholder,
  rows = 3,
}: {
  name: string;
  defaultValue: string | null;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      name={name}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      rows={rows}
      className={INPUT_CLS}
    />
  );
}

export default async function FundProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; denied?: string }>;
}) {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  // Seat gate (action points 2026-07 item 3): Viewers get a read-only form;
  // the save action re-checks server-side regardless.
  const membership = await getPortalMembership();
  const canEdit = membership?.portalRole === "Editor";

  const { saved, error, denied } = await searchParams;
  const investor = await prisma.investor.findUniqueOrThrow({
    where: { id: vp.recordId },
    include: {
      contacts: {
        // Same ordering (incl. id tiebreaker) as the save action, so the form
        // edits exactly the person the action will update.
        orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  const contact = investor.contacts[0] ?? null;
  const contactName = contact ? [contact.firstName, contact.lastName ?? ""].join(" ").trim() : "";

  // Ticket bands (item 4): existing rows, falling back to the legacy single
  // range so pre-bands profiles edit what they see today.
  const bands = await bandsForInvestor(investor.id);
  const bandRows =
    bands.length > 0
      ? bands.map((b) => ({ min: String(b.min), max: b.max == null ? "" : String(b.max), currency: b.currency }))
      : investor.ticketMin != null || investor.ticketMax != null
        ? [{
            min: investor.ticketMin == null ? "" : String(Number(investor.ticketMin)),
            max: investor.ticketMax == null ? "" : String(Number(investor.ticketMax)),
            currency: investor.currency,
          }]
        : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Fund Profile</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          These preferences drive which opportunities Noblestride shows your fund. Keep them
          current — your Noblestride team can also update them on your behalf.
        </p>
      </div>

      {saved && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--t-tag-bg-emerald)] px-5 py-3 text-sm font-medium text-[var(--t-tag-text-emerald)]">
          Profile saved. Your deal matching preferences are now up to date.
        </div>
      )}

      {error === "phone" && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--t-tag-bg-red)] px-5 py-3 text-sm font-medium text-[var(--t-tag-text-red)]">
          {PHONE_MESSAGE}
        </div>
      )}

      {(denied || !canEdit) && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--t-tag-bg-amber)] px-5 py-3 text-sm font-medium text-[var(--t-tag-text-amber)]">
          Your access is view-only — a team member with edit access can update the fund profile.
        </div>
      )}

      <form action={saveFundProfile} className="space-y-5">
        <fieldset disabled={!canEdit} className="contents">
        <Section title="Fund Strategy & Preferences">
          <Field label="Investment Mandate (target sectors, regions, thesis)">
            <Textarea
              name="investmentMandate"
              defaultValue={investor.investmentMandate}
              placeholder="e.g. Growth-stage equity in East African agribusiness and fintech"
            />
          </Field>
          <Field label="Target Sectors">
            <ChipGroup name="sectorFocus" group="Sector" selected={investor.sectorFocus} />
          </Field>
          <Field label="Deal Stages">
            <ChipGroup
              name="investmentStages"
              group="InvestmentStage"
              selected={investor.investmentStages}
            />
          </Field>
          <Field label="Ticket Sizes (add ranges in every currency you invest in)">
            <TicketBandsEditor initial={bandRows} disabled={!canEdit} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Return Expectations — Target IRR (%)">
              <input
                type="number"
                name="targetIrr"
                step="0.1"
                defaultValue={investor.targetIrr ?? ""}
                className={INPUT_CLS}
              />
            </Field>
          </div>
          <Field label="Preferred Instruments">
            <ChipGroup name="instruments" group="Instrument" selected={investor.instruments} />
          </Field>
        </Section>

        <Section title="Geographic Focus">
          <Field label="Primary Regions">
            <ChipGroup
              name="geographicFocus"
              group="Geography"
              selected={investor.geographicFocus}
            />
          </Field>
          <Field label="Country Restrictions">
            <Textarea
              name="countryRestrictions"
              defaultValue={investor.countryRestrictions}
              placeholder="Countries or markets your fund cannot invest in"
              rows={2}
            />
          </Field>
        </Section>

        <Section title="Track Record & Portfolio">
          <Field label="Notable Investments (deals closed, exits achieved)">
            <Textarea name="notableInvestments" defaultValue={investor.notableInvestments} />
          </Field>
          <Field label="Portfolio Composition (sector, size, performance)">
            <Textarea name="portfolioComposition" defaultValue={investor.portfolioComposition} />
          </Field>
          <Field label="Case Studies (deals similar to the Noblestride pipeline)">
            <Textarea name="caseStudies" defaultValue={investor.caseStudies} />
          </Field>
        </Section>

        <Section title="Fund Life Cycle & Capital">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Current Fund Size / AUM (${investor.currency})`}>
              <input
                type="number"
                name="aum"
                min={0}
                step="any"
                defaultValue={investor.aum != null ? Number(investor.aum) : ""}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Remaining Investment Period">
              <input
                type="text"
                name="remainingInvestmentPeriod"
                defaultValue={investor.remainingInvestmentPeriod ?? ""}
                placeholder="e.g. 3 years, deploying until 2029"
                className={INPUT_CLS}
              />
            </Field>
          </div>
          <Field label="Reinvestment Policies">
            <Textarea name="reinvestmentPolicy" defaultValue={investor.reinvestmentPolicy} rows={2} />
          </Field>
        </Section>

        <Section title="Decision-Making Process & Timelines">
          <Field label="Due Diligence Requirements">
            <Textarea
              name="ddRequirements"
              defaultValue={investor.ddRequirements}
              placeholder="Standard DD checklist, external advisors used, typical duration"
            />
          </Field>
          <Field label="Governance & Approval Process (IC / LP)">
            <Textarea
              name="icApprovalProcess"
              defaultValue={investor.icApprovalProcess}
              placeholder="IC cadence, approval thresholds, LP consent requirements"
            />
          </Field>
        </Section>

        <Section title="Engagement Logistics">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Point of Contact — Name">
              <input
                type="text"
                name="contactName"
                defaultValue={contactName}
                placeholder="Full name"
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Point of Contact — Email">
              <ContactEmailField name="contactEmail" defaultValue={contact?.email ?? ""} />
            </Field>
            <Field label="Point of Contact — Phone">
              <input
                type="text"
                name="contactPhone"
                defaultValue={contact?.phone ?? ""}
                placeholder="+254 …"
                className={INPUT_CLS}
              />
            </Field>
          </div>
          <Field label="Team Composition (key personnel for deal evaluation)">
            <Textarea name="teamComposition" defaultValue={investor.teamComposition} rows={2} />
          </Field>
          <Field label="Collaboration Terms (NDA, exclusivity)">
            <Textarea name="collaborationTerms" defaultValue={investor.collaborationTerms} rows={2} />
          </Field>
        </Section>

        <Section title="Ethical & Impact Considerations">
          <Field label="ESG Policies">
            <Textarea name="esgFocus" defaultValue={investor.esgFocus} rows={2} />
          </Field>
          <Field label="Impact Metrics (social / environmental outcomes prioritised)">
            <Textarea name="impactMetrics" defaultValue={investor.impactMetrics} rows={2} />
          </Field>
          <Field label="Reputational Risks (sectors or geographies you avoid)">
            <Textarea name="reputationalRisks" defaultValue={investor.reputationalRisks} rows={2} />
          </Field>
        </Section>

        {canEdit && (
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-[var(--text-tertiary)]">
              Changes apply to {investor.name} only and take effect immediately.
            </span>
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Save Fund Profile
            </button>
          </div>
        )}
        </fieldset>
      </form>
    </div>
  );
}
