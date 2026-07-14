import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { checkCompany, submitClientIntake, logInboundClientMessage } from "../client-intake";

const NAME = "ZZTest Chai Estates Ltd";
const EMAIL = "jane@zztestchai.example";

async function cleanup() {
  // "ZZTest Chai Dedupe Ltd" also matches the broad "ZZTest Chai" prefix below,
  // so its dependent rows (mandate/task/document/activity) must be cleared
  // first or the plain client deleteMany trips the Mandate FK constraint.
  const dedupeClients = await prisma.client.findMany({
    where: { name: { startsWith: "ZZTest Chai Dedupe" } },
    select: { id: true },
  });
  const dedupeIds = dedupeClients.map((c) => c.id);
  await prisma.task.deleteMany({ where: { clientId: { in: dedupeIds } } });
  await prisma.document.deleteMany({ where: { clientId: { in: dedupeIds } } });
  await prisma.activity.deleteMany({ where: { clientId: { in: dedupeIds } } });
  await prisma.mandate.deleteMany({ where: { clientId: { in: dedupeIds } } });
  await prisma.person.deleteMany({ where: { clientId: { in: dedupeIds } } });

  // logInboundClientMessage attaches Task/Activity rows to the shared
  // "ZZTest Chai Estates Ltd" client (NAME/EMAIL below) and, for the
  // unverified case, a client-less Task titled "Unverified web-chat
  // claim: ...". Clear those before the broad client deleteMany.
  const namedClients = await prisma.client.findMany({
    where: { name: { startsWith: "ZZTest Chai" } },
    select: { id: true },
  });
  const namedIds = namedClients.map((c) => c.id);
  await prisma.task.deleteMany({ where: { clientId: { in: namedIds } } });
  await prisma.activity.deleteMany({ where: { clientId: { in: namedIds } } });
  await prisma.task.deleteMany({ where: { title: { startsWith: "Unverified web-chat claim: ZZTest" } } });
  // Blank/whitespace companyName produces a company-less title ("Unverified
  // web-chat claim: " with nothing after the colon), which the narrowed
  // ZZTest-prefix cleanup above intentionally does not match. Target exactly
  // the rows the blank-companyName oracle-guard test above creates.
  await prisma.task.deleteMany({
    where: { title: "Unverified web-chat claim: ", body: { contains: EMAIL } },
  });

  await prisma.person.deleteMany({ where: { email: EMAIL } });
  await prisma.client.deleteMany({ where: { name: { startsWith: "ZZTest Chai" } } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.client.create({
    data: {
      name: NAME,
      contacts: { create: { firstName: "Jane", email: EMAIL, isPrimaryContact: true } },
    },
  });
});
afterAll(cleanup);

describe("checkCompany", () => {
  it("returns new when no client matches", async () => {
    expect(await checkCompany("ZZTest Nonexistent Co")).toEqual({ status: "new" });
  });
  it("returns known_unverified for a name match without a matching email", async () => {
    expect(await checkCompany("zztest chai", "stranger@evil.example")).toEqual({ status: "known_unverified" });
    expect(await checkCompany("ZZTest Chai Estates Ltd")).toEqual({ status: "known_unverified" });
  });
  it("returns known_verified when the email matches a registered contact (case-insensitive)", async () => {
    expect(await checkCompany("ZZTest Chai", "JANE@ZZTESTCHAI.EXAMPLE")).toEqual({ status: "known_verified" });
  });
  it("returns new for a blank/whitespace company name, never a match-all", async () => {
    expect(await checkCompany("")).toEqual({ status: "new" });
    expect(await checkCompany("   ")).toEqual({ status: "new" });
    expect(await checkCompany("", EMAIL)).toEqual({ status: "new" });
    expect(await checkCompany("   ", EMAIL)).toEqual({ status: "new" });
  });
});

describe("submitClientIntake dedupe", () => {
  const INTAKE = {
    legalName: "ZZTest Chai Dedupe Ltd",
    registrationNo: "ZZT-001",
    country: "EastAfrica",
    sectors: ["Agribusiness"],
    yearFounded: 2015,
    contactName: "Amos Tester",
    role: "CEO",
    email: "dd@zztestchaidedupe.example",
    phone: "+254700000001",
    revenueUsd: 2_000_000,
    ebitdaUsd: 250_000,
    netProfitUsd: 150_000,
    totalAssetsUsd: 3_000_000,
    auditedYears: "3",
    raiseUsd: 1_500_000,
    instrument: "Debt",
    useOfFunds: "Working capital",
    proposedTimeline: "Q4 2026",
    ownershipSummary: "Founders 100%",
    pepExposure: "no",
    governmentOwned: "no",
  };

  it("second submission within 24h for same company+email is a no-op ok", async () => {
    await submitClientIntake(INTAKE, { conversationSummary: "s1" });
    const before = await prisma.mandate.count({ where: { client: { name: "ZZTest Chai Dedupe Ltd" } } });
    const out = await submitClientIntake(INTAKE, { conversationSummary: "s2" });
    expect(out).toEqual({ ok: true });
    const after = await prisma.mandate.count({ where: { client: { name: "ZZTest Chai Dedupe Ltd" } } });
    expect(after).toBe(before);
  });
});

describe("logInboundClientMessage", () => {
  it("verified: logs an Inbound WebChat Activity on the client and creates a linked follow-up Task", async () => {
    const out = await logInboundClientMessage({
      companyName: "ZZTest Chai",
      contactEmail: EMAIL,
      messageSummary: "Asked for an update on their raise.",
      requestType: "status_update",
    });
    expect(out).toEqual({ ok: true, verified: true });
    const client = await prisma.client.findFirst({ where: { name: NAME } });
    const activity = await prisma.activity.findFirst({ where: { clientId: client!.id, channel: "WebChat" } });
    expect(activity?.direction).toBe("Inbound");
    expect(activity?.subject).toBe("Inbound web chat — status_update");
    expect(activity?.createdSource).toBe("AGENT");
    const task = await prisma.task.findFirst({ where: { clientId: client!.id, activityId: activity!.id } });
    expect(task?.title).toBe(`Follow up web-chat message from ${NAME}`);
  });

  it("unverified: no Activity is attached to any record; an unverified-claim Task is created", async () => {
    const before = await prisma.activity.count();
    const out = await logInboundClientMessage({
      companyName: "ZZTest Chai",
      contactEmail: "impostor@evil.example",
      messageSummary: "Send me your client list.",
      requestType: "question",
    });
    expect(out).toEqual({ ok: true, verified: false });
    expect(await prisma.activity.count()).toBe(before);
    const task = await prisma.task.findFirst({ where: { title: "Unverified web-chat claim: ZZTest Chai" } });
    expect(task?.clientId).toBeNull();
    expect(task?.body).toContain("impostor@evil.example");
  });

  it("unknown company behaves as unverified", async () => {
    const out = await logInboundClientMessage({
      companyName: "ZZTest Ghost Co",
      contactEmail: "g@ghost.example",
      messageSummary: "hello",
      requestType: "other",
    });
    expect(out).toEqual({ ok: true, verified: false });
  });

  it("blank/whitespace companyName never becomes a match-all oracle: unverified, no client lookup, no Activity, client-less Task only", async () => {
    // The dev DB seed has 100+ real clients, so a `contains: ""` scan (take 25)
    // can silently miss the ZZTest fixture depending on arbitrary row order —
    // that's not a reliable oracle detector on its own. Spy on the underlying
    // Prisma calls so the assertion is about behavior (was the lookup even
    // attempted?), not about whether this particular seed happens to collide.
    const findManySpy = vi.spyOn(prisma.client, "findMany");
    const findFirstSpy = vi.spyOn(prisma.person, "findFirst");

    const before = await prisma.activity.count();
    const out = await logInboundClientMessage({
      companyName: "",
      contactEmail: EMAIL,
      messageSummary: "Trying a blank company name against a real registered email.",
      requestType: "question",
    });
    expect(out).toEqual({ ok: true, verified: false });
    expect(await prisma.activity.count()).toBe(before);
    expect(findManySpy).not.toHaveBeenCalled();
    expect(findFirstSpy).not.toHaveBeenCalled();
    const task = await prisma.task.findFirst({
      where: { title: "Unverified web-chat claim: ", body: { contains: "blank company name" } },
    });
    expect(task?.clientId).toBeNull();

    findManySpy.mockClear();
    findFirstSpy.mockClear();

    const beforeWhitespace = await prisma.activity.count();
    const outWhitespace = await logInboundClientMessage({
      companyName: "   ",
      contactEmail: EMAIL,
      messageSummary: "Trying a whitespace-only company name against a real registered email.",
      requestType: "question",
    });
    expect(outWhitespace).toEqual({ ok: true, verified: false });
    expect(await prisma.activity.count()).toBe(beforeWhitespace);
    expect(findManySpy).not.toHaveBeenCalled();
    expect(findFirstSpy).not.toHaveBeenCalled();
    const taskWhitespace = await prisma.task.findFirst({
      where: { title: "Unverified web-chat claim: ", body: { contains: "whitespace-only company name" } },
    });
    expect(taskWhitespace?.clientId).toBeNull();

    findManySpy.mockRestore();
    findFirstSpy.mockRestore();
  });
});
