// Smoke tests for the Task 12 intake-review service mutations:
// acceptIntakeMandate, deprioritizeIntakeMandate, rerunQualification.
// Robust to the database being down (see mandates-crud.smoke.test.ts pattern):
// all writes are skipped, never failed, when DATABASE_URL is unset/unreachable.

import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, deleteMandate, acceptIntakeMandate, deprioritizeIntakeMandate, rerunQualification } from "@/server/services/mandates";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

const UNIQ = `smoke-intake-${Date.now()}`;

afterAll(async () => {
  await withDb(async () => {
    await prisma.activity.deleteMany({ where: { mandate: { name: { contains: UNIQ } } } });
    await prisma.stageChange.deleteMany({ where: { mandate: { name: { contains: UNIQ } } } });
    await prisma.mandate.deleteMany({ where: { name: { contains: UNIQ } } });
    await prisma.client.deleteMany({ where: { name: { contains: UNIQ } } });
    await prisma.user.deleteMany({ where: { email: { contains: UNIQ } } });
    return true;
  });
});

describe("acceptIntakeMandate (smoke)", () => {
  it("assigns the lead and logs an 'Intake accepted' activity", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: `Accept Client ${UNIQ}` }, { type: "HUMAN" });
      const mandate = await createMandate(
        { name: `Accept Mandate ${UNIQ}`, clientId: client.id, source: "Website" },
        { type: "HUMAN" },
      );
      expect(mandate.leadId).toBeNull();

      const lead = await prisma.user.create({
        data: { name: `Smoke Lead ${UNIQ}`, email: `lead-${UNIQ}@example.com`, role: "DealLead" },
      });

      const updated = await acceptIntakeMandate(mandate.id, lead.id, { type: "HUMAN" });
      expect(updated.leadId).toBe(lead.id);

      const activity = await prisma.activity.findFirst({ where: { mandateId: mandate.id } });
      expect(activity?.subject).toBe("Intake accepted");

      await deleteMandate(mandate.id);
      await deleteClient(client.id);
      await prisma.user.delete({ where: { id: lead.id } });
      return true;
    });
    if (out === null) return;
  });
});

describe("deprioritizeIntakeMandate (smoke)", () => {
  it("sets dealStatus Dropped and appends the reason to existing notes", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: `Deprioritize Client ${UNIQ}` }, { type: "HUMAN" });
      const mandate = await createMandate(
        { name: `Deprioritize Mandate ${UNIQ}`, clientId: client.id, notes: "Original applicant note" },
        { type: "HUMAN" },
      );
      expect(mandate.dealStatus).toBe("Open");

      const updated = await deprioritizeIntakeMandate(mandate.id, "Outside geographic focus", { type: "HUMAN" });
      expect(updated.dealStatus).toBe("Dropped");
      expect(updated.notes).toBe("Original applicant note\nOutside geographic focus");

      const stageChange = await prisma.stageChange.findFirst({ where: { mandateId: mandate.id, field: "dealStatus" } });
      expect(stageChange?.fromValue).toBe("Open");
      expect(stageChange?.toValue).toBe("Dropped");

      const activity = await prisma.activity.findFirst({ where: { mandateId: mandate.id } });
      expect(activity?.subject).toBe("Intake deprioritized");

      await deleteMandate(mandate.id);
      await deleteClient(client.id);
      return true;
    });
    if (out === null) return;
  });

  it("sets notes to just the reason when no prior notes exist", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: `Deprioritize NoNotes Client ${UNIQ}` }, { type: "HUMAN" });
      const mandate = await createMandate({ name: `Deprioritize NoNotes Mandate ${UNIQ}`, clientId: client.id }, { type: "HUMAN" });

      const updated = await deprioritizeIntakeMandate(mandate.id, "First reason on record", { type: "HUMAN" });
      expect(updated.notes).toBe("First reason on record");

      await deleteMandate(mandate.id);
      await deleteClient(client.id);
      return true;
    });
    if (out === null) return;
  });
});

describe("rerunQualification (smoke)", () => {
  it("re-maps persisted Client + Mandate Decimal/enum fields and re-triages to Deprioritized", async () => {
    const out = await withDb(async () => {
      const client = await createClient(
        {
          name: `Rerun Client ${UNIQ}`,
          countries: ["Europe"], // no SSA geography
          sector: ["OilAndGas"], // restricted sector
          revenueLastYear: 900_000, // below the USD 1M floor
          ebitda: 200_000,
          auditedFinancialsYears: 5,
          yearFounded: 2015,
          pepExposure: false,
          governmentOwned: false,
        },
        { type: "HUMAN" },
      );
      const mandate = await createMandate(
        { name: `Rerun Mandate ${UNIQ}`, clientId: client.id, dealSize: 2_000_000 },
        { type: "HUMAN" },
      );
      expect(mandate.qualificationVerdict).toBeNull();

      const updated = await rerunQualification(mandate.id);
      expect(updated.qualificationVerdict).toBe("Deprioritized");
      expect(updated.qualificationReasons).toContain("Operating outside Sub-Saharan Africa geographies");
      expect(updated.qualificationReasons).toContain("Operating in a restricted sector: OilAndGas");
      expect(updated.qualificationReasons).toContain("Revenue below USD 1M (USD 900,000 reported)");
      expect(updated.qualifiedAt).toBeInstanceOf(Date);

      await deleteMandate(mandate.id);
      await deleteClient(client.id);
      return true;
    });
    if (out === null) return;
  });

  it("re-triages to Qualified when persisted data clears every check", async () => {
    const out = await withDb(async () => {
      const client = await createClient(
        {
          name: `Rerun Qualified Client ${UNIQ}`,
          countries: ["EastAfrica"],
          sector: ["Technology"],
          revenueLastYear: 5_000_000,
          ebitda: 500_000,
          auditedFinancialsYears: 4,
          yearFounded: 2015,
          pepExposure: false,
          governmentOwned: false,
        },
        { type: "HUMAN" },
      );
      const mandate = await createMandate(
        { name: `Rerun Qualified Mandate ${UNIQ}`, clientId: client.id, dealSize: 3_000_000 },
        { type: "HUMAN" },
      );

      const updated = await rerunQualification(mandate.id);
      expect(updated.qualificationVerdict).toBe("Qualified");
      expect(updated.qualificationReasons).toEqual([]);

      await deleteMandate(mandate.id);
      await deleteClient(client.id);
      return true;
    });
    if (out === null) return;
  });
});
