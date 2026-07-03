// portal/investor/profile — the per-fund editable profile, structured as the
// 7 sections of the client's "Data collected from potential investors" doc.
// These preferences drive which deals get pushed to the investor (§5.3
// discovery filters read sectorFocus/geographicFocus/ticketMin/ticketMax).
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { options } from "@/lib/vocab";
import { ContactEmailField } from "@/components/portal/contact-email-field";
import { saveFundProfile } from "./actions";

export const dynamic = "force-dynamic";

const INPUT_CLS =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</span>
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
          <span className="inline-block rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-500 transition-colors peer-checked:border-emerald-300 peer-checked:bg-emerald-50 peer-checked:text-emerald-800 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
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
  searchParams: Promise<{ saved?: string }>;
}) {
  const vp = await getViewpoint();
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const { saved } = await searchParams;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Fund Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">
          These preferences drive which opportunities NobleStride shows your fund. Keep them
          current — your NobleStride team can also update them on your behalf.
        </p>
      </div>

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800">
          Profile saved. Your deal matching preferences are now up to date.
        </div>
      )}

      <form action={saveFundProfile} className="space-y-5">
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`Ticket Size — Minimum (${investor.currency})`}>
              <input
                type="number"
                name="ticketMin"
                min={0}
                step="any"
                defaultValue={investor.ticketMin != null ? Number(investor.ticketMin) : ""}
                className={INPUT_CLS}
              />
            </Field>
            <Field label={`Ticket Size — Maximum (${investor.currency})`}>
              <input
                type="number"
                name="ticketMax"
                min={0}
                step="any"
                defaultValue={investor.ticketMax != null ? Number(investor.ticketMax) : ""}
                className={INPUT_CLS}
              />
            </Field>
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
          <Field label="Case Studies (deals similar to the NobleStride pipeline)">
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

        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-zinc-400">
            Changes apply to {investor.name} only and take effect immediately.
          </span>
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Save Fund Profile
          </button>
        </div>
      </form>
    </div>
  );
}
