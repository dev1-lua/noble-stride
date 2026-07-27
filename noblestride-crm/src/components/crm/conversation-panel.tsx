"use client";
// Conversation panel — the staff side of the two-way investor↔staff thread
// (action points 2026-07 item 1). Renders the running thread, a Reply
// composer, and the triage-status select (Pending/Open/InProgress/Closed).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";
import { Card, CardHeader, CardBody } from "@/components/ui";
import {
  CONVERSATION_STATUS_CLASSES,
  CONVERSATION_STATUS_LABELS,
  CONVERSATION_STATUS_OPTIONS,
} from "@/lib/conversation-status";
import type { ConversationStatus } from "@prisma/client";

const REPLY = `
  mutation ReplyToConversation($engagementId: ID!, $body: String!) {
    replyToConversation(engagementId: $engagementId, body: $body) { id status lastMessageAt }
  }
`;

const SET_STATUS = `
  mutation SetConversationStatus($id: ID!, $status: ConversationStatus!) {
    setConversationStatus(id: $id, status: $status) { id status }
  }
`;

export interface ConversationMessageItem {
  id: string;
  senderKind: "INVESTOR" | "STAFF";
  senderName: string;
  body: string;
  createdAt: string; // ISO — serialized across the RSC boundary
}

const MSG_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ConversationPanel({
  engagementId,
  conversationId,
  status,
  messages,
  investorName,
}: {
  engagementId: string;
  conversationId: string | null;
  status: ConversationStatus | null;
  messages: ConversationMessageItem[];
  investorName: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [{ fetching: replying }, reply] = useMutation(REPLY);
  const [{ fetching: movingStatus }, setStatus] = useMutation(SET_STATUS);

  return (
    <Card id="conversation">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Conversation
            <span className="ml-2 text-xs font-normal text-[var(--text-tertiary)]">
              two-way thread with {investorName} (visible in their portal)
            </span>
          </h2>
          {conversationId && status ? (
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONVERSATION_STATUS_CLASSES[status]}`}>
                {CONVERSATION_STATUS_LABELS[status]}
              </span>
              <select
                aria-label="Conversation status"
                className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                value={status}
                disabled={movingStatus}
                onChange={async (e) => {
                  setError(null);
                  const res = await setStatus({ id: conversationId, status: e.target.value });
                  if (res.error) setError(res.error.message);
                  else router.refresh();
                }}
              >
                {CONVERSATION_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs text-[var(--text-tertiary)]">No thread yet — a reply starts one</span>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {messages.length > 0 ? (
          <ol className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-lg border px-3 py-2 ${
                  m.senderKind === "STAFF"
                    ? "ml-auto border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-primary)]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {m.senderKind === "STAFF" ? `${m.senderName} (staff)` : m.senderName}
                  </span>
                  <span className="text-[11px] text-[var(--text-tertiary)]">
                    {MSG_DATE_FMT.format(new Date(m.createdAt))}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-[var(--text-primary)]">{m.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">
            No messages yet. Portal requests from {investorName} will appear here; you can also start
            the conversation below.
          </p>
        )}

        <form
          className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            setError(null);
            const res = await reply({ engagementId, body: body.trim() });
            if (res.error) setError(res.error.message);
            else {
              setBody("");
              router.refresh();
            }
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={`Reply to ${investorName} — they'll see this in their portal…`}
            className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={replying || !body.trim()}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {replying ? "Sending…" : "Send reply"}
            </button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
