// global-search.test.ts — DB-backed (same fixture pattern as
// src/app/portal/investor/deals/[id]/__tests__/express-interest.smoke.test.ts):
// creates real rows with a unique-per-run marker, exercises `globalSearch`
// against the real Prisma test database, then cleans up.
//
// Two viewer scenarios (design spec Task 3 / plan Task C):
//  1. An INTERNAL viewer searching a known seed term gets results spanning
//     multiple entity types.
//  2. An INVESTOR viewer with a PRE_INTEREST (pre-NDA, no engagement yet)
//     deal gets ONLY the codename-masked identity for that deal — never the
//     real client name (BUG-01) — and never sees entities they have no
//     visibility into (a Partner, another Investor's data, etc. simply never
//     enter the investor branch's query surface at all).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/graphql/context";
import { dealCodename } from "@/server/visibility/codename";
import { globalSearch } from "../global-search";

const UNIQ = `gsearch-${Date.now()}`;

const INTERNAL_ACTOR: Actor = { type: "HUMAN", authenticated: true, accountKind: "INTERNAL" };

describe("globalSearch", () => {
  describe("INTERNAL viewer", () => {
    let investorId: string;
    let clientId: string;
    let mandateId: string;
    let transactionId: string;
    let partnerId: string;
    let serviceProviderId: string;
    let documentId: string;
    let taskId: string;
    let personId: string;
    let engagementId: string;
    let typoMandateId: string;

    beforeAll(async () => {
      const investor = await prisma.investor.create({
        data: { name: `Investor ${UNIQ}`, investorType: "PrivateEquity" },
      });
      const client = await prisma.client.create({ data: { name: `Client ${UNIQ}` } });
      const mandate = await prisma.mandate.create({ data: { name: `Mandate ${UNIQ}`, clientId: client.id } });
      const transaction = await prisma.transaction.create({
        data: { name: `Transaction ${UNIQ}`, clientId: client.id },
      });
      const partner = await prisma.partner.create({ data: { name: `Partner ${UNIQ}` } });
      const serviceProvider = await prisma.serviceProvider.create({
        data: { name: `ServiceProvider ${UNIQ}`, type: "LawFirm" },
      });
      const document = await prisma.document.create({
        data: {
          name: `Document ${UNIQ}`,
          type: "Teaser",
          transactionId: transaction.id,
        },
      });
      const task = await prisma.task.create({ data: { title: `Task ${UNIQ}` } });
      const person = await prisma.person.create({
        data: { firstName: `Person${UNIQ}`, lastName: "Contact", investorId: investor.id },
      });
      const engagement = await prisma.engagement.create({
        data: {
          name: `Engagement ${UNIQ}`,
          transactionId: transaction.id,
          investorId: investor.id,
        },
      });
      // A deliberately MISSPELLED mandate name (no space, single token) so the
      // fuzzy test below can only match it via trigram similarity — a plain
      // ILIKE substring on the correctly-spelled query cannot.
      const typoMandate = await prisma.mandate.create({
        data: { name: `Phamaceuticals${UNIQ}`, clientId: client.id },
      });

      investorId = investor.id;
      clientId = client.id;
      mandateId = mandate.id;
      transactionId = transaction.id;
      partnerId = partner.id;
      serviceProviderId = serviceProvider.id;
      documentId = document.id;
      taskId = task.id;
      personId = person.id;
      engagementId = engagement.id;
      typoMandateId = typoMandate.id;
    });

    afterAll(async () => {
      await prisma.engagement.deleteMany({ where: { id: engagementId } });
      await prisma.task.deleteMany({ where: { id: taskId } });
      await prisma.document.deleteMany({ where: { id: documentId } });
      await prisma.person.deleteMany({ where: { id: personId } });
      await prisma.transaction.deleteMany({ where: { id: transactionId } });
      await prisma.mandate.deleteMany({ where: { id: { in: [mandateId, typoMandateId] } } });
      await prisma.serviceProvider.deleteMany({ where: { id: serviceProviderId } });
      await prisma.partner.deleteMany({ where: { id: partnerId } });
      await prisma.client.deleteMany({ where: { id: clientId } });
      await prisma.investor.deleteMany({ where: { id: investorId } });
    });

    it("returns results spanning multiple entity types for a known seed term", async () => {
      const results = await globalSearch(INTERNAL_ACTOR, UNIQ, 50);
      const types = new Set(results.map((r) => r.type));

      expect(types).toEqual(
        new Set([
          "Investor",
          "Client",
          "Mandate",
          "Transaction",
          "Partner",
          "ServiceProvider",
          "Document",
          "Task",
          "Person",
          "Engagement",
        ]),
      );

      expect(results.find((r) => r.id === investorId)).toMatchObject({
        type: "Investor",
        title: `Investor ${UNIQ}`,
        href: `/investors/${investorId}`,
      });
      expect(results.find((r) => r.id === clientId)).toMatchObject({
        type: "Client",
        title: `Client ${UNIQ}`,
        href: `/clients/${clientId}`,
      });
      expect(results.find((r) => r.id === transactionId)).toMatchObject({
        type: "Transaction",
        title: `Transaction ${UNIQ}`,
        href: `/transactions/${transactionId}`,
      });
      expect(results.find((r) => r.id === engagementId)).toMatchObject({
        type: "Engagement",
        title: `Engagement ${UNIQ}`,
        href: `/engagement/${engagementId}`,
      });
    });

    it("finds a record despite a typo (trigram fuzzy — the correctly-spelled query is NOT a substring of the misspelled stored name)", async () => {
      // Stored: "Phamaceuticals…"  Query: "Pharmaceuticals…" (extra 'r').
      // A whole-string ILIKE '%query%' cannot match this; only trigram can.
      const results = await globalSearch(INTERNAL_ACTOR, `Pharmaceuticals${UNIQ}`, 50);
      expect(results.find((r) => r.id === typoMandateId)).toMatchObject({ type: "Mandate" });
    });

    it("returns [] for an unauthenticated actor", async () => {
      const results = await globalSearch({ type: "HUMAN", authenticated: false }, UNIQ, 50);
      expect(results).toEqual([]);
    });
  });

  describe("INVESTOR viewer — visibility (BUG-01 regression)", () => {
    let investorId: string;
    let realClientId: string;
    let dealId: string;
    let teaserDocId: string;
    let internalDocId: string;
    let otherPartnerId: string;
    let codename: string;

    beforeAll(async () => {
      // Approved + Active investor, no criteria set → discovers every active
      // deal at PRE_INTEREST (no engagement row is created for this deal).
      const investor = await prisma.investor.create({
        data: { name: `Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "Approved" },
      });
      const client = await prisma.client.create({ data: { name: `RealClientName ${UNIQ}` } });
      const deal = await prisma.transaction.create({
        data: { name: `RealDealName ${UNIQ}`, clientId: client.id },
      });
      // Teaser-level doc — visible pre-NDA (PRE_INTEREST allowlist).
      const teaserDoc = await prisma.document.create({
        data: {
          name: `Teaser Deck ${UNIQ}`,
          type: "Teaser",
          accessLevel: "InvestorShared",
          transactionId: deal.id,
        },
      });
      // Internal-only doc — must NEVER surface for any external viewer.
      const internalDoc = await prisma.document.create({
        data: {
          name: `Internal Memo ${UNIQ}`,
          type: "FinancialModel",
          accessLevel: "Internal",
          transactionId: deal.id,
        },
      });
      // An entity the investor has zero visibility into — must never appear
      // in the investor branch's results regardless of query term.
      const otherPartner = await prisma.partner.create({ data: { name: `Partner ${UNIQ}` } });

      investorId = investor.id;
      realClientId = client.id;
      dealId = deal.id;
      teaserDocId = teaserDoc.id;
      internalDocId = internalDoc.id;
      otherPartnerId = otherPartner.id;
      codename = dealCodename(deal.id);
    });

    afterAll(async () => {
      await prisma.document.deleteMany({ where: { id: { in: [teaserDocId, internalDocId] } } });
      await prisma.transaction.deleteMany({ where: { id: dealId } });
      await prisma.client.deleteMany({ where: { id: realClientId } });
      await prisma.investor.deleteMany({ where: { id: investorId } });
      await prisma.partner.deleteMany({ where: { id: otherPartnerId } });
    });

    function investorActor(): Actor {
      return { type: "HUMAN", authenticated: true, accountKind: "INVESTOR", investorId };
    }

    it("surfaces the PRE_INTEREST deal under its codename, never the real client name", async () => {
      const byCodename = await globalSearch(investorActor(), codename, 20);
      const dealResult = byCodename.find((r) => r.id === dealId);
      expect(dealResult).toBeDefined();
      expect(dealResult).toMatchObject({
        type: "Transaction",
        title: codename,
        subtitle: codename,
        href: `/portal/investor/deals/${dealId}`,
      });
      // The real deal/client name must not appear anywhere in the result.
      expect(JSON.stringify(dealResult)).not.toContain(`RealDealName ${UNIQ}`);
      expect(JSON.stringify(dealResult)).not.toContain(`RealClientName ${UNIQ}`);
    });

    it("never returns a match when searching the real (masked) client/deal name", async () => {
      const byRealClientName = await globalSearch(investorActor(), `RealClientName ${UNIQ}`, 20);
      expect(byRealClientName.find((r) => r.id === dealId)).toBeUndefined();

      const byRealDealName = await globalSearch(investorActor(), `RealDealName ${UNIQ}`, 20);
      expect(byRealDealName.find((r) => r.id === dealId)).toBeUndefined();
    });

    it("surfaces the teaser-level document (under its masked name) but never the Internal-only document", async () => {
      // The document's own projected name is ALSO masked at PRE_INTEREST
      // (`${DocumentType label} — ${codename}`, see project.ts), so a raw
      // UNIQ-term search would find nothing — search by the codename that
      // actually appears in the projected name instead.
      const byCodename = await globalSearch(investorActor(), codename, 50);
      expect(byCodename.find((r) => r.id === teaserDocId)).toMatchObject({
        type: "Document",
        href: `/portal/investor/deals/${dealId}`,
      });
      expect(byCodename.find((r) => r.id === internalDocId)).toBeUndefined();
      // Belt-and-braces: the internal doc's real name is never findable either.
      const byInternalDocName = await globalSearch(investorActor(), `Internal Memo ${UNIQ}`, 50);
      expect(byInternalDocName.find((r) => r.id === internalDocId)).toBeUndefined();
    });

    it("never returns entities the investor has no visibility into (e.g. a Partner)", async () => {
      const results = await globalSearch(investorActor(), codename, 50);
      expect(results.some((r) => r.type === "Partner")).toBe(false);
      expect(results.find((r) => r.id === otherPartnerId)).toBeUndefined();
      // The investor branch only ever surfaces its own two entity kinds.
      expect(new Set(results.map((r) => r.type))).toEqual(new Set(["Transaction", "Document"]));

      // Searching the Partner's own real name never finds it either — the
      // investor branch's query surface never includes Partner at all.
      const byPartnerName = await globalSearch(investorActor(), `Partner ${UNIQ}`, 50);
      expect(byPartnerName.find((r) => r.id === otherPartnerId)).toBeUndefined();
    });

    it("returns [] when the investor id is missing from the actor (never trusts a client id)", async () => {
      const results = await globalSearch(
        { type: "HUMAN", authenticated: true, accountKind: "INVESTOR" },
        UNIQ,
        20,
      );
      expect(results).toEqual([]);
    });
  });
});
