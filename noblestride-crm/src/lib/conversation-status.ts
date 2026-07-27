// Conversation queue status labels + chip styling (action points 2026-07).
// Shared by the investor portal thread card and the staff engagement page.

import type { ConversationStatus } from "@prisma/client";

export const CONVERSATION_STATUS_ORDER: ConversationStatus[] = ["Pending", "Open", "InProgress", "Closed"];

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  Pending: "Pending",
  Open: "Open",
  InProgress: "In progress",
  Closed: "Closed",
};

/** Tag-token classes matching the app's Chip conventions. */
export const CONVERSATION_STATUS_CLASSES: Record<ConversationStatus, string> = {
  Pending: "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]",
  Open: "bg-[var(--t-tag-bg-sky)] text-[var(--t-tag-text-sky)]",
  InProgress: "bg-[var(--t-tag-bg-violet)] text-[var(--t-tag-text-violet)]",
  Closed: "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
};

export const CONVERSATION_STATUS_OPTIONS = CONVERSATION_STATUS_ORDER.map((value) => ({
  value,
  label: CONVERSATION_STATUS_LABELS[value],
}));
