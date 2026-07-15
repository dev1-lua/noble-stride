// access-matrix/page.tsx — display-only in-org access matrix (design spec §7).
import { AccessMatrix } from "@/components/crm/access-matrix";

export default function AccessMatrixPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Access Matrix</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Who sees what inside Noblestride — Admin, Deal Lead and Team Member lenses
        </p>
      </div>
      <AccessMatrix />
    </div>
  );
}
