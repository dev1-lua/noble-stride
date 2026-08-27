/**
 * scripts/seed-workflow-defaults.ts
 *
 * Idempotent, production-safe seed for the default deal-workflow template
 * (Aug-2026 feedback: replaces the hard-coded 17-step journey with a
 * configurable WorkflowTemplate/WorkflowStep pair) and the AppSetting defs.
 *
 * Upserts:
 *   - the WorkflowTemplate at DEFAULT_WORKFLOW_TEMPLATE_ID (name kept in sync;
 *     `isDefault` is only ever set true on first create, and only if no OTHER
 *     template is already marked default — it never flips an existing row)
 *   - each of the 13 DEFAULT_WORKFLOW_STEPS, keyed by (templateId, key)
 *   - each APP_SETTING_DEFS entry, CREATE-ONLY (`update: {}`) — never
 *     overwrites a value an admin has already changed, and never touches an
 *     existing row's `updatedAt`
 *
 * Safe to run repeatedly, including against the restored-production DB: it
 * never deletes anything. This is the ONLY seed script allowed to run against
 * `DATABASE_URL` there — see the warning atop `prisma/seed.ts`.
 *
 * USAGE (run from noblestride-crm/)
 *   npm run seed:workflow
 */

import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_WORKFLOW_TEMPLATE_ID,
  DEFAULT_WORKFLOW_TEMPLATE_NAME,
  DEFAULT_WORKFLOW_STEPS,
} from "../src/server/domain/workflow-default";
import { APP_SETTING_DEFS } from "../src/lib/app-settings";

export async function seedWorkflowDefaults(prisma: PrismaClient) {
  // ─── WorkflowTemplate ──────────────────────────────────────────────────
  // A raw-SQL partial unique index (`WorkflowTemplate_single_default`) allows
  // at most one isDefault=true row DB-wide, so only claim `isDefault: true`
  // on create, and only when no OTHER template already holds it.
  const otherDefault = await prisma.workflowTemplate.findFirst({
    where: { isDefault: true, id: { not: DEFAULT_WORKFLOW_TEMPLATE_ID } },
    select: { id: true },
  });
  await prisma.workflowTemplate.upsert({
    where: { id: DEFAULT_WORKFLOW_TEMPLATE_ID },
    create: {
      id: DEFAULT_WORKFLOW_TEMPLATE_ID,
      name: DEFAULT_WORKFLOW_TEMPLATE_NAME,
      isDefault: !otherDefault,
    },
    update: { name: DEFAULT_WORKFLOW_TEMPLATE_NAME },
  });

  // ─── WorkflowStep (13 rows) ────────────────────────────────────────────
  for (const step of DEFAULT_WORKFLOW_STEPS) {
    await prisma.workflowStep.upsert({
      where: { templateId_key: { templateId: DEFAULT_WORKFLOW_TEMPLATE_ID, key: step.key } },
      create: {
        id: step.id,
        templateId: DEFAULT_WORKFLOW_TEMPLATE_ID,
        key: step.key,
        title: step.title,
        phase: step.phase,
        description: step.description,
        order: step.order,
        appliesTo: step.appliesTo,
      },
      update: {
        title: step.title,
        phase: step.phase,
        description: step.description,
        order: step.order,
        appliesTo: step.appliesTo,
      },
    });
  }

  // ─── AppSetting defs — create-only, never overwrite an admin's value ──
  for (const def of APP_SETTING_DEFS) {
    await prisma.appSetting.upsert({
      where: { key: def.key },
      update: {},
      create: { key: def.key, value: def.default },
    });
  }

  const [templateCount, stepCount, settingCount] = await Promise.all([
    prisma.workflowTemplate.count(),
    prisma.workflowStep.count({ where: { templateId: DEFAULT_WORKFLOW_TEMPLATE_ID } }),
    prisma.appSetting.count(),
  ]);
  return { templateCount, stepCount, settingCount };
}

const isMain = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      // fall through to the explicit error below
    }
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Refusing to start: DATABASE_URL is not set and .env did not provide one.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  seedWorkflowDefaults(prisma)
    .then((counts) => {
      console.log(
        `seed:workflow — ${counts.templateCount} workflow template(s), ${counts.stepCount} step(s) on the default template, ${counts.settingCount} AppSetting row(s).`,
      );
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
