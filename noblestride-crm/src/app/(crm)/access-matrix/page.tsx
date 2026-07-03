// access-matrix/page.tsx — display-only in-org access matrix (design spec §7).
import { AccessMatrix } from "@/components/crm/access-matrix";

export default function AccessMatrixPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Access Matrix</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Who sees what inside NobleStride — Admin, Deal Lead and Team Member lenses
        </p>
      </div>
      <AccessMatrix />
    </div>
  );
}
