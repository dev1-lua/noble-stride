/**
 * e2e/fixtures/cleanup.ts — removes exactly the rows seed.ts created.
 *
 * Scoped by the fixed `zz-` ids and `zz-`/`@e2e.noblestride.test` names, in FK
 * order, plus the AppSetting values restored to their seeded defaults (the
 * app-settings spec toggles them). Never touches anything else — the broader
 * prefix sweep lives in scripts/cleanup-prefixed-test-data.ts.
 */

import { PrismaClient } from "@prisma/client";
import { IDS, EMAILS } from "./seed";

const prisma = new PrismaClient();

export async function cleanupE2E(): Promise<void> {
  const dealIds = [IDS.mandate, IDS.transaction, IDS.advisory, IDS.applicantMandate, IDS.acceptedApplicantMandate];
  const clientIds = [
    IDS.clientKenya,
    IDS.clientUganda,
    // F2.1 website-application fixtures.
    IDS.applicantClient,
    IDS.acceptedApplicantClient,
  ];

  // Workflow progress + audit trails first.
  await prisma.dealStageState.deleteMany({ where: { dealId: { in: dealIds } } });
  await prisma.stageChange.deleteMany({
    where: { OR: [{ mandateId: { in: [IDS.mandate, IDS.applicantMandate, IDS.acceptedApplicantMandate] } }, { transactionId: IDS.transaction }, { advisoryId: IDS.advisory }, { clientId: { in: clientIds } }, { investorId: IDS.investor }] },
  });
  await prisma.activity.deleteMany({
    where: { OR: [{ mandateId: { in: [IDS.mandate, IDS.applicantMandate, IDS.acceptedApplicantMandate] } }, { transactionId: IDS.transaction }, { advisoryId: IDS.advisory }, { clientId: { in: clientIds } }, { investorId: IDS.investor }, { engagementId: IDS.engagement }] },
  });
  await prisma.document.deleteMany({
    where: { OR: [{ mandateId: { in: [IDS.mandate, IDS.applicantMandate, IDS.acceptedApplicantMandate] } }, { transactionId: IDS.transaction }, { advisoryId: IDS.advisory }, { clientId: { in: clientIds } }, { investorId: { in: [IDS.investor, IDS.pendingInvestor] } }] },
  });
  await prisma.task.deleteMany({
    where: { OR: [{ mandateId: { in: [IDS.mandate, IDS.applicantMandate, IDS.acceptedApplicantMandate] } }, { transactionId: IDS.transaction }, { advisoryId: IDS.advisory }, { clientId: { in: clientIds } }] },
  });
  await prisma.folder.deleteMany({
    where: { OR: [{ mandateId: { in: [IDS.mandate, IDS.applicantMandate, IDS.acceptedApplicantMandate] } }, { transactionId: IDS.transaction }, { advisoryId: IDS.advisory }, { clientId: { in: clientIds } }] },
  });
  await prisma.engagementParticipant.deleteMany({ where: { engagementId: IDS.engagement } });
  await prisma.outreachDraft.deleteMany({ where: { OR: [{ transactionId: IDS.transaction }, { investorId: IDS.investor }] } });
  await prisma.engagement.deleteMany({ where: { OR: [{ id: IDS.engagement }, { investorId: IDS.investor }] } });

  // Deals, then their clients.
  await prisma.transaction.deleteMany({ where: { OR: [{ id: IDS.transaction }, { clientId: { in: clientIds } }] } });
  await prisma.advisoryEngagement.deleteMany({ where: { OR: [{ id: IDS.advisory }, { clientId: { in: clientIds } }] } });
  await prisma.mandate.deleteMany({
    where: { OR: [{ id: { in: [IDS.mandate, IDS.applicantMandate, IDS.acceptedApplicantMandate] } }, { clientId: { in: clientIds } }] },
  });

  // Templates created by the workflow-settings spec.
  const zzTemplates = await prisma.workflowTemplate.findMany({
    where: { name: { startsWith: "zz-" }, isDefault: false },
    select: { id: true },
  });
  if (zzTemplates.length > 0) {
    await prisma.mandate.updateMany({ where: { workflowTemplateId: { in: zzTemplates.map((t) => t.id) } }, data: { workflowTemplateId: null } });
    await prisma.transaction.updateMany({ where: { workflowTemplateId: { in: zzTemplates.map((t) => t.id) } }, data: { workflowTemplateId: null } });
    await prisma.advisoryEngagement.updateMany({ where: { workflowTemplateId: { in: zzTemplates.map((t) => t.id) } }, data: { workflowTemplateId: null } });
    await prisma.workflowTemplate.deleteMany({ where: { id: { in: zzTemplates.map((t) => t.id) } } });
  }

  // Saved views created by the deals-filters spec.
  await prisma.savedView.deleteMany({ where: { name: { startsWith: "zz-" } } });

  // Accounts / people / investor.
  const emails = Object.values(EMAILS);
  await prisma.authToken.deleteMany({ where: { account: { email: { in: emails } } } });
  await prisma.authSession.deleteMany({ where: { account: { email: { in: emails } } } });
  await prisma.authAccount.deleteMany({ where: { email: { in: emails } } });
  await prisma.person.deleteMany({
    where: {
      OR: [
        { id: IDS.investorPerson },
        { investorId: IDS.investor },
        { id: IDS.applicantPerson },
        { id: IDS.pendingInvestorPerson },
        { investorId: IDS.pendingInvestor },
        { clientId: { in: clientIds } },
      ],
    },
  });
  await prisma.investor.deleteMany({ where: { id: { in: [IDS.investor, IDS.pendingInvestor] } } });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [IDS.adminUser, IDS.memberUser] } } });
  await prisma.user.deleteMany({ where: { email: { in: [EMAILS.admin, EMAILS.member] } } });

  // Restore the AppSetting defaults the app-settings spec toggles.
  for (const [key, value] of [
    ["agent.client.enabled", "true"],
    ["portal.dashboard.financeTiles", "false"],
    ["portal.deal.milestones", "false"],
  ] as const) {
    await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  // The seeded template must remain the org default.
  const seeded = await prisma.workflowTemplate.findFirst({ where: { name: "Default Transaction Advisory Workflow" }, select: { id: true, isDefault: true } });
  if (seeded && !seeded.isDefault) {
    await prisma.workflowTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    await prisma.workflowTemplate.update({ where: { id: seeded.id }, data: { isDefault: true } });
  }
}

// CLI entry. Deliberately NOT an `import.meta.url` check: Playwright loads
// these TS modules as CJS (globalSetup/globalTeardown), where import.meta is a
// syntax error. Comparing the invoked script path works in both loaders.
const invokedDirectly = process.argv[1]?.endsWith("cleanup.ts") ?? false;
if (invokedDirectly) {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      /* handled below */
    }
  }
  cleanupE2E()
    .then(() => console.log("e2e fixtures removed"))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
