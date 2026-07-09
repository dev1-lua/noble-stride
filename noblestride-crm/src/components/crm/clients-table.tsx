// clients-table.tsx — Client list table. Presentational, server-compatible.
import Link from "next/link";
import { Avatar, Chip, Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type ClientRow = {
  id: string;
  name: string;
  hqCity: string | null;
  sector: string[];
  revenueLastYear: number | null;
  status: string;
  mandateCount: number;
};

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-5 py-12 text-center text-[var(--text-tertiary)]">
        No clients yet. Use "+ New Client" to add one.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Client</Th><Th>Status</Th><Th>Sector</Th><Th>Mandates</Th><Th>HQ City</Th><Th>Revenue (LY)</Th>
          </Tr>
        </THead>
        <TBody>
          {clients.map((c) => (
            <Tr key={c.id}>
              <Td>
                <Link href={`/clients/${c.id}`} className="group flex items-center gap-3">
                  <Avatar name={c.name} size="sm" />
                  <span className="font-medium text-[var(--text-primary)] transition-colors group-hover:text-accent">{c.name}</span>
                </Link>
              </Td>
              <Td>{c.status ? <Chip value={c.status} group="ClientStatus" /> : "—"}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {c.sector.slice(0, 3).map((s) => <Chip key={s} value={s} group="Sector" />)}
                  {c.sector.length > 3 && <span className="text-xs text-[var(--text-tertiary)]">+{c.sector.length - 3}</span>}
                </div>
              </Td>
              <Td className="text-[var(--text-secondary)]">{c.mandateCount}</Td>
              <Td className="text-[var(--text-secondary)]">{c.hqCity ?? "—"}</Td>
              <Td className="whitespace-nowrap text-[var(--text-secondary)]">{c.revenueLastYear == null ? "—" : formatMoney(c.revenueLastYear)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
