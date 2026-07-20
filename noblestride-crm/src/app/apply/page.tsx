// apply/page.tsx — public page hosting the Website Intake & Qualification
// Agent (SOW §10). The chat is a LuaPop embed isolated in an iframe-srcdoc
// so the widget's CSS/JS never touches the app bundle. The page is a dumb
// host: guardrails live in the agent persona and in the automation-gated
// GraphQL surface (submitWebsiteIntake / client-intake.ts).

import Link from "next/link";
import { ApplyChat } from "./apply-chat";

export const metadata = { title: "Apply for funding — Noblestride Capital" };

export default function ApplyPage() {
  const agentId = process.env.NEXT_PUBLIC_LUA_WEBSITE_INTAKE_AGENT_ID ?? "";
  const channelId = process.env.NEXT_PUBLIC_LUA_WEBSITE_INTAKE_CHANNEL_ID ?? "";
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg-secondary)] px-4 py-6">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Apply for funding</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Tell us about your company and your raise — our assistant will take your application
            step by step, and our team reviews every submission. Prefer a structured form?{" "}
            <Link href="/intake" className="font-medium text-[var(--accent)] hover:underline">
              Apply here
            </Link>
            .
          </p>
        </div>
        <ApplyChat agentId={agentId} channelId={channelId} />
      </div>
    </div>
  );
}
