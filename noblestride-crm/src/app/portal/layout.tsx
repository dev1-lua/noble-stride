// portal/layout.tsx — shared external-portal segment. Shell markup lives in
// the role-specific layouts: partner keeps the classic external shell, the
// investor portal uses the CRM-style shell (one design language with the
// internal CRM). Kept dynamic so both sub-trees read the live viewpoint
// cookie and Postgres data per request.
export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
