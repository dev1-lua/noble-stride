import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { requestClientStatusOtp, verifyClientStatusOtp, verifyStatusToken, getClientStatus } from "../client-status";
import { readDevOtp } from "@/server/auth/dev-otp-sink";

const COMPANY_A = "ZZTest Co";
const COMPANY_B = "ZZTest Rival Co";

const MAIN_EMAIL = "zztest.contact@zzco.example";
const RIVAL_EMAIL = "zztest.rival@zzco.example";
const COOLDOWN_EMAIL = "zztest.cooldown@zzco.example";
const CAP_EMAIL = "zztest.cap@zzco.example";
const REREQUEST_EMAIL = "zztest.rerequest@zzco.example";
const MAILER_EMAIL = "zztest.mailer@zzco.example";
const NOMATCH_EMAIL = "zztest.nomatch@zzco.example";

const VERIFY_HAPPY_EMAIL = "zztest.verify.happy@zzco.example";
const VERIFY_WRONG_EMAIL = "zztest.verify.wrong@zzco.example";
const VERIFY_LOCK_EMAIL = "zztest.verify.lock@zzco.example";
const VERIFY_REPLAY_EMAIL = "zztest.verify.replay@zzco.example";
const VERIFY_EXPIRED_EMAIL = "zztest.verify.expired@zzco.example";
const VERIFY_NOCHALLENGE_EMAIL = "zztest.verify.nochallenge@zzco.example";

const ALL_EMAILS = [
  MAIN_EMAIL, RIVAL_EMAIL, COOLDOWN_EMAIL, CAP_EMAIL, REREQUEST_EMAIL, MAILER_EMAIL, NOMATCH_EMAIL,
  VERIFY_HAPPY_EMAIL, VERIFY_WRONG_EMAIL, VERIFY_LOCK_EMAIL, VERIFY_REPLAY_EMAIL, VERIFY_EXPIRED_EMAIL,
  VERIFY_NOCHALLENGE_EMAIL,
];

let companyAId: string;
let capPersonId: string;

async function cleanup() {
  await prisma.clientOtpChallenge.deleteMany({ where: { destination: { in: ALL_EMAILS } } });
  await prisma.person.deleteMany({ where: { email: { in: ALL_EMAILS } } });
  await prisma.client.deleteMany({ where: { name: { in: [COMPANY_A, COMPANY_B] } } });
}

beforeAll(async () => {
  await cleanup();
  const companyA = await prisma.client.create({ data: { name: COMPANY_A } });
  companyAId = companyA.id;
  await prisma.person.create({ data: { firstName: "Zz", email: MAIN_EMAIL, isPrimaryContact: true, clientId: companyA.id } });
  await prisma.person.create({ data: { firstName: "Zz", email: COOLDOWN_EMAIL, clientId: companyA.id } });
  const capPerson = await prisma.person.create({ data: { firstName: "Zz", email: CAP_EMAIL, clientId: companyA.id } });
  capPersonId = capPerson.id;
  await prisma.person.create({ data: { firstName: "Zz", email: REREQUEST_EMAIL, clientId: companyA.id } });
  await prisma.person.create({ data: { firstName: "Zz", email: MAILER_EMAIL, clientId: companyA.id } });
  await prisma.person.create({ data: { firstName: "Zz", email: VERIFY_HAPPY_EMAIL, clientId: companyA.id } });
  await prisma.person.create({ data: { firstName: "Zz", email: VERIFY_WRONG_EMAIL, clientId: companyA.id } });
  await prisma.person.create({ data: { firstName: "Zz", email: VERIFY_LOCK_EMAIL, clientId: companyA.id } });
  await prisma.person.create({ data: { firstName: "Zz", email: VERIFY_REPLAY_EMAIL, clientId: companyA.id } });
  await prisma.person.create({ data: { firstName: "Zz", email: VERIFY_EXPIRED_EMAIL, clientId: companyA.id } });
  await prisma.person.create({ data: { firstName: "Zz", email: VERIFY_NOCHALLENGE_EMAIL, clientId: companyA.id } });

  const companyB = await prisma.client.create({ data: { name: COMPANY_B } });
  await prisma.person.create({ data: { firstName: "Zz", email: RIVAL_EMAIL, isPrimaryContact: true, clientId: companyB.id } });
});
afterAll(cleanup);

describe("requestClientStatusOtp", () => {
  it("match: creates one challenge, hashes the code, sends mail", async () => {
    const res = await requestClientStatusOtp(COMPANY_A, MAIN_EMAIL);
    expect(res).toEqual({ ok: true });
    const rows = await prisma.clientOtpChallenge.findMany({ where: { destination: MAIN_EMAIL } });
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).toMatch(/^[0-9a-f]{64}$/); // sha256, never the raw code
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("no company match: identical {ok:true}, NO challenge row", async () => {
    const res = await requestClientStatusOtp("ZZTest Totally Unknown Co", NOMATCH_EMAIL);
    expect(res).toEqual({ ok: true });
    const rows = await prisma.clientOtpChallenge.findMany({ where: { destination: NOMATCH_EMAIL } });
    expect(rows).toHaveLength(0);
  });

  it("email not a registered contact of the matched company: {ok:true}, NO row", async () => {
    // RIVAL_EMAIL is a registered contact of COMPANY_B, not COMPANY_A.
    const res = await requestClientStatusOtp(COMPANY_A, RIVAL_EMAIL);
    expect(res).toEqual({ ok: true });
    const rows = await prisma.clientOtpChallenge.findMany({ where: { destination: RIVAL_EMAIL } });
    expect(rows).toHaveLength(0);
  });

  it("empty companyName: {ok:true}, NO client query at all", async () => {
    const findManySpy = vi.spyOn(prisma.client, "findMany");
    const findFirstSpy = vi.spyOn(prisma.person, "findFirst");

    const res = await requestClientStatusOtp("", MAIN_EMAIL);
    expect(res).toEqual({ ok: true });
    expect(findManySpy).not.toHaveBeenCalled();
    expect(findFirstSpy).not.toHaveBeenCalled();

    findManySpy.mockRestore();
    findFirstSpy.mockRestore();
  });

  it("60s cooldown: second request within 60s still ONE row", async () => {
    const first = await requestClientStatusOtp(COMPANY_A, COOLDOWN_EMAIL);
    expect(first).toEqual({ ok: true });
    const second = await requestClientStatusOtp(COMPANY_A, COOLDOWN_EMAIL);
    expect(second).toEqual({ ok: true });

    const rows = await prisma.clientOtpChallenge.findMany({ where: { destination: COOLDOWN_EMAIL } });
    expect(rows).toHaveLength(1);
  });

  it("hourly cap: 5 rows exist within the hour, 6th request {ok:true}, still 5 rows", async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await prisma.clientOtpChallenge.create({
        data: {
          clientId: companyAId,
          personId: capPersonId,
          codeHash: "0".repeat(64),
          destination: CAP_EMAIL,
          createdAt: new Date(now - i * 1000),
          expiresAt: new Date(now + 600_000),
        },
      });
    }

    const res = await requestClientStatusOtp(COMPANY_A, CAP_EMAIL);
    expect(res).toEqual({ ok: true });

    const rows = await prisma.clientOtpChallenge.findMany({ where: { destination: CAP_EMAIL } });
    expect(rows).toHaveLength(5);
  });

  it("re-request after cooldown invalidates the previous challenge (one active per person)", async () => {
    const first = await requestClientStatusOtp(COMPANY_A, REREQUEST_EMAIL);
    expect(first).toEqual({ ok: true });

    const rowsAfterFirst = await prisma.clientOtpChallenge.findMany({ where: { destination: REREQUEST_EMAIL } });
    expect(rowsAfterFirst).toHaveLength(1);
    const firstRow = rowsAfterFirst[0];

    // Backdate past the cooldown window so the second call is allowed through.
    await prisma.clientOtpChallenge.update({
      where: { id: firstRow.id },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });

    const second = await requestClientStatusOtp(COMPANY_A, REREQUEST_EMAIL);
    expect(second).toEqual({ ok: true });

    const rowsAfterSecond = await prisma.clientOtpChallenge.findMany({
      where: { destination: REREQUEST_EMAIL },
      orderBy: { createdAt: "asc" },
    });
    expect(rowsAfterSecond).toHaveLength(2);
    const [old, fresh] = rowsAfterSecond;
    expect(old.id).toBe(firstRow.id);
    expect(old.consumedAt).not.toBeNull();
    expect(fresh.consumedAt).toBeNull();
  });

  it("mailer failure still returns {ok:true} and logs", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingSend = vi.fn().mockRejectedValue(new Error("boom"));

    const res = await requestClientStatusOtp(COMPANY_A, MAILER_EMAIL, { send: failingSend });
    expect(res).toEqual({ ok: true });
    expect(failingSend).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();

    const rows = await prisma.clientOtpChallenge.findMany({ where: { destination: MAILER_EMAIL } });
    expect(rows).toHaveLength(1);

    errorSpy.mockRestore();
  });
});

describe("verifyClientStatusOtp / verifyStatusToken", () => {
  const PRIOR_AUTH_SECRET = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = "zz-test-secret-client-status-0123456789";
  });
  afterAll(() => {
    if (PRIOR_AUTH_SECRET === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = PRIOR_AUTH_SECRET;
  });

  async function requestAndReadCode(email: string): Promise<string> {
    await requestClientStatusOtp(COMPANY_A, email);
    const code = readDevOtp(email);
    if (!code) throw new Error(`no dev OTP recorded for ${email}`);
    return code;
  }

  it("happy path: correct code -> {status:'ok', token}; token verifies; challenge consumed", async () => {
    const code = await requestAndReadCode(VERIFY_HAPPY_EMAIL);
    const res = await verifyClientStatusOtp(COMPANY_A, VERIFY_HAPPY_EMAIL, code);
    expect(res.status).toBe("ok");
    const token = (res as { status: "ok"; token: string }).token;
    expect(typeof token).toBe("string");

    const person = await prisma.person.findFirst({ where: { email: VERIFY_HAPPY_EMAIL } });
    const claims = await verifyStatusToken(token);
    expect(claims).toEqual({ clientId: companyAId, personId: person!.id });

    const rows = await prisma.clientOtpChallenge.findMany({ where: { destination: VERIFY_HAPPY_EMAIL } });
    expect(rows).toHaveLength(1);
    expect(rows[0].consumedAt).not.toBeNull();
  });

  let wrongCodeResult: unknown;

  it("wrong code -> {status:'failed'}; attempts incremented; 5 wrong -> locked; correct code after lock still fails", async () => {
    await requestAndReadCode(VERIFY_LOCK_EMAIL);

    for (let i = 0; i < 5; i++) {
      const res = await verifyClientStatusOtp(COMPANY_A, VERIFY_LOCK_EMAIL, "000000");
      expect(res).toEqual({ status: "failed" });
      wrongCodeResult = res;
    }

    const row = await prisma.clientOtpChallenge.findFirst({ where: { destination: VERIFY_LOCK_EMAIL } });
    expect(row!.attempts).toBe(5);
    expect(row!.consumedAt).toBeNull();

    // correct code, but the challenge is now locked out (attempts >= maxAttempts).
    const realCode = readDevOtp(VERIFY_LOCK_EMAIL)!;
    const lockedRes = await verifyClientStatusOtp(COMPANY_A, VERIFY_LOCK_EMAIL, realCode);
    expect(lockedRes).toEqual({ status: "failed" });

    const rowAfter = await prisma.clientOtpChallenge.findFirst({ where: { destination: VERIFY_LOCK_EMAIL } });
    expect(rowAfter!.consumedAt).toBeNull(); // never consumed: locked before the code check
  });

  it("replay: verifying the same correct code twice -> second call fails", async () => {
    const code = await requestAndReadCode(VERIFY_REPLAY_EMAIL);
    const first = await verifyClientStatusOtp(COMPANY_A, VERIFY_REPLAY_EMAIL, code);
    expect(first.status).toBe("ok");

    const second = await verifyClientStatusOtp(COMPANY_A, VERIFY_REPLAY_EMAIL, code);
    expect(second).toEqual({ status: "failed" });
  });

  it("expired challenge -> {status:'failed'}", async () => {
    const code = await requestAndReadCode(VERIFY_EXPIRED_EMAIL);
    await prisma.clientOtpChallenge.updateMany({
      where: { destination: VERIFY_EXPIRED_EMAIL },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await verifyClientStatusOtp(COMPANY_A, VERIFY_EXPIRED_EMAIL, code);
    expect(res).toEqual({ status: "failed" });
  });

  it("no company match / no active challenge / garbage inputs all fail identically to wrong code", async () => {
    // no company match at all
    const noCompany = await verifyClientStatusOtp("ZZTest Totally Unknown Co", VERIFY_WRONG_EMAIL, "000000");
    expect(noCompany).toEqual(wrongCodeResult);

    // matched company but email is not a registered contact of it
    const notAContact = await verifyClientStatusOtp(COMPANY_A, RIVAL_EMAIL, "000000");
    expect(notAContact).toEqual(wrongCodeResult);

    // registered contact, but no challenge was ever requested for them
    const noChallenge = await verifyClientStatusOtp(COMPANY_A, VERIFY_NOCHALLENGE_EMAIL, "000000");
    expect(noChallenge).toEqual(wrongCodeResult);

    // garbage / empty inputs
    const garbage = await verifyClientStatusOtp("", "", "");
    expect(garbage).toEqual(wrongCodeResult);
  });

  it("verifyStatusToken: expired token -> null; tampered token -> null; wrong purpose -> null", async () => {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

    const expiredToken = await new SignJWT({ clientId: "c1", personId: "p1", purpose: "client-status" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 20)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret);
    expect(await verifyStatusToken(expiredToken)).toBeNull();

    const validToken = await new SignJWT({ clientId: "c1", personId: "p1", purpose: "client-status" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("900s")
      .sign(secret);
    const tampered = validToken.slice(0, -2) + (validToken.slice(-2) === "AA" ? "BB" : "AA");
    expect(await verifyStatusToken(tampered)).toBeNull();

    const wrongPurpose = await new SignJWT({ clientId: "c1", personId: "p1", purpose: "not-client-status" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("900s")
      .sign(secret);
    expect(await verifyStatusToken(wrongPurpose)).toBeNull();
  });
});

describe("getClientStatus", () => {
  const PRIOR_AUTH_SECRET = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = "zz-test-secret-client-status-0123456789";
  });
  afterAll(() => {
    if (PRIOR_AUTH_SECRET === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = PRIOR_AUTH_SECRET;
  });

  const ST_RECEIVED = "ZZTest Status Received";
  const ST_UNDER_REVIEW = "ZZTest Status UnderReview";
  const ST_ENGAGED = "ZZTest Status Engaged";
  const ST_DEAL_PREP = "ZZTest Status DealPrep";
  const ST_OUTREACH = "ZZTest Status Outreach";
  const ST_DUE_DILIGENCE = "ZZTest Status DueDiligence";
  const ST_TERM_SHEET = "ZZTest Status TermSheet";
  const ST_CLOSING = "ZZTest Status Closing";
  const ST_COMPLETED = "ZZTest Status Completed";
  const ST_LOST = "ZZTest Status Lost";
  const ST_CLOSED_LOST_TXN = "ZZTest Status TxnDidNotProceed";
  const ST_PRECEDENCE = "ZZTest Status Precedence";
  const ST_DOCS_AND_RAISE = "ZZTest Status DocsAndRaise";
  const ST_FORBIDDEN = "ZZTest Status Forbidden";
  const ST_ACTIVITY = "ZZTest Status ActivityLog";

  const ALL_STATUS_CLIENT_NAMES = [
    ST_RECEIVED, ST_UNDER_REVIEW, ST_ENGAGED, ST_DEAL_PREP, ST_OUTREACH, ST_DUE_DILIGENCE,
    ST_TERM_SHEET, ST_CLOSING, ST_COMPLETED, ST_LOST, ST_CLOSED_LOST_TXN, ST_PRECEDENCE,
    ST_DOCS_AND_RAISE, ST_FORBIDDEN, ST_ACTIVITY,
  ];
  const STATUS_INVESTOR_NAMES = ["ZZTest Status Investor"];

  const ids: Record<string, string> = {};

  async function signToken(clientId: string): Promise<string> {
    return new SignJWT({ clientId, personId: "zztest-status-person", purpose: "client-status" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("900s")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  }

  async function cleanupStatusFixtures() {
    const clients = await prisma.client.findMany({ where: { name: { in: ALL_STATUS_CLIENT_NAMES } } });
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length > 0) {
      const transactions = await prisma.transaction.findMany({ where: { clientId: { in: clientIds } } });
      const transactionIds = transactions.map((t) => t.id);
      if (transactionIds.length > 0) {
        await prisma.engagement.deleteMany({ where: { transactionId: { in: transactionIds } } });
      }
      await prisma.activity.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.document.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.transaction.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.mandate.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    }
    await prisma.investor.deleteMany({ where: { name: { in: STATUS_INVESTOR_NAMES } } });
  }

  beforeAll(async () => {
    await cleanupStatusFixtures();

    const received = await prisma.client.create({ data: { name: ST_RECEIVED } });
    await prisma.mandate.create({ data: { name: "M", clientId: received.id, stage: "NewLead" } });
    ids.received = received.id;

    const underReview = await prisma.client.create({ data: { name: ST_UNDER_REVIEW } });
    await prisma.mandate.create({ data: { name: "M", clientId: underReview.id, stage: "Qualification" } });
    ids.underReview = underReview.id;

    const engaged = await prisma.client.create({ data: { name: ST_ENGAGED } });
    await prisma.mandate.create({ data: { name: "M", clientId: engaged.id, stage: "Signed" } });
    ids.engaged = engaged.id;

    const dealPrep = await prisma.client.create({ data: { name: ST_DEAL_PREP } });
    await prisma.mandate.create({ data: { name: "M", clientId: dealPrep.id, stage: "Signed" } });
    await prisma.transaction.create({ data: { name: "T", clientId: dealPrep.id, stage: "DealPreparation" } });
    ids.dealPrep = dealPrep.id;

    const outreach = await prisma.client.create({ data: { name: ST_OUTREACH } });
    await prisma.transaction.create({ data: { name: "T", clientId: outreach.id, stage: "InvestorOutreach" } });
    ids.outreach = outreach.id;

    const dueDiligence = await prisma.client.create({ data: { name: ST_DUE_DILIGENCE } });
    await prisma.transaction.create({ data: { name: "T", clientId: dueDiligence.id, stage: "DueDiligence" } });
    ids.dueDiligence = dueDiligence.id;

    const termSheet = await prisma.client.create({ data: { name: ST_TERM_SHEET } });
    await prisma.transaction.create({ data: { name: "T", clientId: termSheet.id, stage: "TermSheet" } });
    ids.termSheet = termSheet.id;

    const closing = await prisma.client.create({ data: { name: ST_CLOSING } });
    await prisma.transaction.create({ data: { name: "T", clientId: closing.id, stage: "Closing" } });
    ids.closing = closing.id;

    const completed = await prisma.client.create({ data: { name: ST_COMPLETED } });
    await prisma.transaction.create({ data: { name: "T", clientId: completed.id, stage: "ClosedWon" } });
    ids.completed = completed.id;

    const lost = await prisma.client.create({ data: { name: ST_LOST } });
    await prisma.mandate.create({ data: { name: "M", clientId: lost.id, stage: "Lost" } });
    ids.lost = lost.id;

    const closedLostTxn = await prisma.client.create({ data: { name: ST_CLOSED_LOST_TXN } });
    await prisma.mandate.create({ data: { name: "M", clientId: closedLostTxn.id, stage: "NewLead" } });
    await prisma.transaction.create({ data: { name: "T", clientId: closedLostTxn.id, stage: "ClosedLost" } });
    ids.closedLostTxn = closedLostTxn.id;

    const precedence = await prisma.client.create({ data: { name: ST_PRECEDENCE } });
    await prisma.mandate.create({ data: { name: "M", clientId: precedence.id, stage: "Signed" } });
    await prisma.transaction.create({ data: { name: "T", clientId: precedence.id, stage: "DueDiligence" } });
    ids.precedence = precedence.id;

    const docsAndRaise = await prisma.client.create({ data: { name: ST_DOCS_AND_RAISE } });
    await prisma.mandate.create({
      data: {
        name: "M",
        clientId: docsAndRaise.id,
        stage: "Qualification",
        ndaStatus: "Sent",
        eaStatus: "Signed",
        dealSize: 2_000_000,
        currency: "USD",
      },
    });
    await prisma.document.create({
      data: { name: "Teaser doc", type: "Teaser", status: "Approved", clientId: docsAndRaise.id },
    });
    await prisma.document.create({
      data: { name: "IM doc", type: "IM", status: "Draft", clientId: docsAndRaise.id },
    });
    ids.docsAndRaise = docsAndRaise.id;

    const forbidden = await prisma.client.create({ data: { name: ST_FORBIDDEN } });
    await prisma.mandate.create({ data: { name: "M", clientId: forbidden.id, stage: "Signed" } });
    const forbiddenTxn = await prisma.transaction.create({
      data: { name: "T", clientId: forbidden.id, stage: "InvestorOutreach" },
    });
    const investor = await prisma.investor.create({
      data: { name: STATUS_INVESTOR_NAMES[0], investorType: "PrivateEquity" },
    });
    await prisma.engagement.create({
      data: { name: "E", transactionId: forbiddenTxn.id, investorId: investor.id },
    });
    ids.forbidden = forbidden.id;

    const activityClient = await prisma.client.create({ data: { name: ST_ACTIVITY } });
    await prisma.mandate.create({ data: { name: "M", clientId: activityClient.id, stage: "NewLead" } });
    ids.activity = activityClient.id;
  });
  afterAll(cleanupStatusFixtures);

  it("Mandate NewLead, no transaction -> received, coarseStage null", async () => {
    const payload = await getClientStatus(await signToken(ids.received));
    expect(payload.applicationState).toBe("received");
    expect(payload.coarseStage).toBeNull();
  });

  it("Mandate Qualification, no transaction -> under_review", async () => {
    const payload = await getClientStatus(await signToken(ids.underReview));
    expect(payload.applicationState).toBe("under_review");
    expect(payload.coarseStage).toBeNull();
  });

  it("Mandate Signed, no transaction -> engaged", async () => {
    const payload = await getClientStatus(await signToken(ids.engaged));
    expect(payload.applicationState).toBe("engaged");
    expect(payload.coarseStage).toBeNull();
  });

  it("Transaction DealPreparation -> in_execution / docs_prep", async () => {
    const payload = await getClientStatus(await signToken(ids.dealPrep));
    expect(payload.applicationState).toBe("in_execution");
    expect(payload.coarseStage).toBe("docs_prep");
  });

  it("Transaction InvestorOutreach -> in_execution / investor_outreach", async () => {
    const payload = await getClientStatus(await signToken(ids.outreach));
    expect(payload.applicationState).toBe("in_execution");
    expect(payload.coarseStage).toBe("investor_outreach");
  });

  it("Transaction DueDiligence -> in_execution / due_diligence", async () => {
    const payload = await getClientStatus(await signToken(ids.dueDiligence));
    expect(payload.applicationState).toBe("in_execution");
    expect(payload.coarseStage).toBe("due_diligence");
  });

  it("Transaction TermSheet -> in_execution / term_sheet", async () => {
    const payload = await getClientStatus(await signToken(ids.termSheet));
    expect(payload.applicationState).toBe("in_execution");
    expect(payload.coarseStage).toBe("term_sheet");
  });

  it("Transaction Closing -> in_execution / closing", async () => {
    const payload = await getClientStatus(await signToken(ids.closing));
    expect(payload.applicationState).toBe("in_execution");
    expect(payload.coarseStage).toBe("closing");
  });

  it("Transaction ClosedWon -> completed", async () => {
    const payload = await getClientStatus(await signToken(ids.completed));
    expect(payload.applicationState).toBe("completed");
    expect(payload.coarseStage).toBeNull();
  });

  it("Mandate Lost -> with_team, neutral wording (never lost/reject/deprioritiz)", async () => {
    const payload = await getClientStatus(await signToken(ids.lost));
    expect(payload.applicationState).toBe("with_team");
    expect(payload.coarseStage).toBeNull();
    expect(payload.stageMessage).toMatch(/with our team/i);
    expect(payload.stageMessage).not.toMatch(/lost|reject|deprioritiz/i);
    expect(payload.nextStep).not.toMatch(/lost|reject|deprioritiz/i);
  });

  it("Transaction ClosedLost (mandate otherwise NewLead) -> with_team, neutral wording", async () => {
    const payload = await getClientStatus(await signToken(ids.closedLostTxn));
    expect(payload.applicationState).toBe("with_team");
    expect(payload.stageMessage).toMatch(/with our team/i);
    expect(JSON.stringify(payload)).not.toMatch(/lost|reject|deprioritiz/i);
  });

  it("most-advanced-open-transaction wins over mandate when both exist", async () => {
    const payload = await getClientStatus(await signToken(ids.precedence));
    // Mandate is Signed (would be "engaged" alone), but the open DueDiligence
    // transaction must win.
    expect(payload.applicationState).toBe("in_execution");
    expect(payload.coarseStage).toBe("due_diligence");
  });

  it("ndaStatus/eaStatus mapping, preparedDocuments subset, submittedRaise formatting", async () => {
    const payload = await getClientStatus(await signToken(ids.docsAndRaise));
    expect(payload.ndaStatus).toBe("sent");
    expect(payload.engagementAgreementStatus).toBe("signed");
    expect(payload.preparedDocuments).toEqual(["Teaser"]); // IM is Draft, not Approved/Shared
    expect(payload.submittedRaise).toBe("USD 2,000,000");
  });

  it("whitelist key assertion: payload never gains keys beyond spec §5.3", async () => {
    const payload = await getClientStatus(await signToken(ids.forbidden));
    expect(Object.keys(payload).sort()).toEqual(
      [
        "companyName",
        "applicationState",
        "coarseStage",
        "stageMessage",
        "ndaStatus",
        "engagementAgreementStatus",
        "preparedDocuments",
        "submittedRaise",
        "nextStep",
        "lastUpdated",
      ].sort(),
    );
  });

  it("forbidden-content probe: investor name attached via Engagement never appears in the payload", async () => {
    const payload = await getClientStatus(await signToken(ids.forbidden));
    expect(JSON.stringify(payload)).not.toContain(STATUS_INVESTOR_NAMES[0]);
  });

  it("Activity logged: subject/channel/createdSource match the tracked-workflow convention", async () => {
    await getClientStatus(await signToken(ids.activity));
    const rows = await prisma.activity.findMany({ where: { clientId: ids.activity } });
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe("Client checked status via web chat");
    expect(rows[0].channel).toBe("WebChat");
    expect(rows[0].createdSource).toBe("AGENT");
  });

  it("bad/expired token -> throws /verification expired/i", async () => {
    await expect(getClientStatus("not-a-real-token")).rejects.toThrow(/verification expired/i);
  });
});
