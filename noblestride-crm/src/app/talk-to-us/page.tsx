// talk-to-us/page.tsx — public prospect-facing chat with the NobleStride
// Client Agent (SOW §8.1). The chat is a LuaPop embed isolated in an
// iframe-srcdoc so the widget's CSS/JS never touches the app bundle. The
// page is a dumb host: guardrails live in the agent persona and in the
// automation-gated GraphQL surface (client-intake.ts).

import Link from "next/link";
import { TalkToUsChat } from "./talk-to-us-chat";

export const metadata = { title: "Talk to us — NobleStride Capital" };

export default function TalkToUsPage() {
  const agentId = process.env.NEXT_PUBLIC_LUA_CLIENT_AGENT_ID ?? "";
  const channelId = process.env.NEXT_PUBLIC_LUA_CLIENT_CHANNEL_ID ?? "";
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg-secondary)] px-4 py-6">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Talk to NobleStride</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Tell us about your company and what you&apos;re raising — our team reviews every inquiry.
            Prefer a structured form?{" "}
            <Link href="/intake" className="font-medium text-[var(--accent)] hover:underline">
              Apply here
            </Link>
            .
          </p>
        </div>
        <TalkToUsChat agentId={agentId} channelId={channelId} />
      </div>
    </div>
  );
}
