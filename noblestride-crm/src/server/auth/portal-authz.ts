// Investor-portal seat authorization (action points 2026-07 item 3).
// Person.portalRole: Editors act, Viewers read. Thread participation for
// Viewers is a per-member opt-in (Person.canPostInThreads); Editors always
// may post. SECURITY: everything derives from the real session — these
// helpers are the SERVER-SIDE gate; hiding controls in the UI is cosmetic.

import { redirect } from "next/navigation";
import { getCurrentAuth } from "./current";
import type { PortalMemberRole } from "@prisma/client";

export interface PortalMembership {
  investorId: string;
  personId: string;
  /** "First Last" display label for the signed-in member. */
  label: string;
  portalRole: PortalMemberRole;
  canPostInThreads: boolean;
}

export interface PortalCapabilities {
  canEdit: boolean;
  canPostInThreads: boolean;
}

export function capabilitiesOf(m: Pick<PortalMembership, "portalRole" | "canPostInThreads">): PortalCapabilities {
  const canEdit = m.portalRole === "Editor";
  return { canEdit, canPostInThreads: canEdit || m.canPostInThreads };
}

/**
 * The signed-in investor-portal member, or null when the session isn't an
 * investor seat. Pages use this to decide which controls to render.
 */
export async function getPortalMembership(): Promise<PortalMembership | null> {
  const auth = await getCurrentAuth();
  const person = auth?.person;
  if (!person?.investorId || auth?.account.kind !== "INVESTOR") return null;
  return {
    investorId: person.investorId,
    personId: person.id,
    label: `${person.firstName} ${person.lastName ?? ""}`.trim(),
    portalRole: person.portalRole,
    canPostInThreads: person.canPostInThreads,
  };
}

/** Signed-in investor member of ANY role; redirects when not an investor session. */
export async function requirePortalMember(): Promise<PortalMembership> {
  const m = await getPortalMembership();
  if (!m) redirect("/login");
  return m;
}

/**
 * Server gate for portal mutations: Editors only. Viewers are bounced back
 * to the page they came from with a flag the UI can surface.
 */
export async function requirePortalEditor(fallbackPath = "/portal/investor"): Promise<PortalMembership> {
  const m = await requirePortalMember();
  if (m.portalRole !== "Editor") redirect(`${fallbackPath}?denied=edit`);
  return m;
}

/** Server gate for posting into conversation threads: Editors, or opted-in Viewers. */
export async function requireThreadParticipation(fallbackPath = "/portal/investor"): Promise<PortalMembership> {
  const m = await requirePortalMember();
  if (!capabilitiesOf(m).canPostInThreads) redirect(`${fallbackPath}?denied=thread`);
  return m;
}
