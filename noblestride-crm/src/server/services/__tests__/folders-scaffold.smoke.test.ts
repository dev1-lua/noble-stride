// DB-backed smoke tests for file-room scaffolding (action points 2026-07
// item 5): deal-create auto-template, per-investor subfolders on engagement
// create, and idempotency of both.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTransaction } from "@/server/services/transactions";
import { createEngagement } from "@/server/services/engagements-crud";
import { ensureInvestorDealFolder } from "@/server/services/folders";
import {
  DEAL_FOLDER_TEMPLATE,
  POTENTIAL_INVESTORS_FOLDER,
  INVESTOR_TERM_SHEETS_FOLDER,
} from "@/server/domain/folder-templates";

const ACTOR = { type: "HUMAN" as const };

describe("file-room scaffolding", () => {
  let clientId: string;
  let investorId: string;

  beforeAll(async () => {
    await cleanup();
    clientId = (await prisma.client.create({ data: { name: "ZZ Folders Client" } })).id;
    investorId = (
      await prisma.investor.create({ data: { name: "ZZ Folders Capital", investorType: "PrivateEquity" } })
    ).id;
  });

  afterAll(cleanup);

  async function cleanup() {
    await prisma.folder.deleteMany({ where: { name: { startsWith: "ZZ Folders" }, parentId: null } });
    await prisma.engagement.deleteMany({ where: { name: { startsWith: "ZZ Folders" } } });
    await prisma.transaction.deleteMany({ where: { name: { startsWith: "ZZ Folders" } } });
    await prisma.investor.deleteMany({ where: { name: { startsWith: "ZZ Folders" } } });
    await prisma.client.deleteMany({ where: { name: { startsWith: "ZZ Folders" } } });
  }

  it("creating a deal auto-scaffolds the standard template", async () => {
    const txn = await createTransaction({ name: "ZZ Folders Deal", clientId }, ACTOR);
    const root = await prisma.folder.findFirst({ where: { transactionId: txn.id, parentId: null } });
    expect(root?.name).toBe("ZZ Folders Deal");

    const children = await prisma.folder.findMany({ where: { parentId: root!.id }, orderBy: { name: "asc" } });
    expect(children.map((c) => c.name)).toEqual([...DEAL_FOLDER_TEMPLATE]);
  });

  it("creating an engagement nests {investor}/Term Sheets under 07 Potential Investors, idempotently", async () => {
    const txn = await createTransaction({ name: "ZZ Folders Deal Two", clientId }, ACTOR);
    await createEngagement({ name: "ZZ Folders Engagement", transactionId: txn.id, investorId }, ACTOR);

    const root = await prisma.folder.findFirstOrThrow({ where: { transactionId: txn.id, parentId: null } });
    const pi = await prisma.folder.findFirstOrThrow({ where: { parentId: root.id, name: POTENTIAL_INVESTORS_FOLDER } });
    const investorFolder = await prisma.folder.findFirstOrThrow({ where: { parentId: pi.id, name: "ZZ Folders Capital" } });
    const termSheets = await prisma.folder.findFirst({
      where: { parentId: investorFolder.id, name: INVESTOR_TERM_SHEETS_FOLDER },
    });
    expect(termSheets).not.toBeNull();

    // Idempotent: a second ensure changes nothing.
    const again = await ensureInvestorDealFolder(txn.id, "ZZ Folders Capital");
    expect(again?.id).toBe(investorFolder.id);
    const dupes = await prisma.folder.count({ where: { parentId: pi.id, name: "ZZ Folders Capital" } });
    expect(dupes).toBe(1);
  });

  it("scaffolds lazily for a pre-template deal root (older deals get 07 on first touch)", async () => {
    // Simulate an OLD deal whose root predates the template.
    const txn = await prisma.transaction.create({ data: { name: "ZZ Folders Legacy", clientId } });
    await prisma.folder.create({ data: { name: "ZZ Folders Legacy", transactionId: txn.id } });

    const folder = await ensureInvestorDealFolder(txn.id, "ZZ Folders Capital");
    expect(folder).not.toBeNull();
    const root = await prisma.folder.findFirstOrThrow({ where: { transactionId: txn.id, parentId: null } });
    const pi = await prisma.folder.findFirst({ where: { parentId: root.id, name: POTENTIAL_INVESTORS_FOLDER } });
    expect(pi).not.toBeNull();
  });
});
