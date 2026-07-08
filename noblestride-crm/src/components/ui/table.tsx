import { cn } from "@/lib/cn";

/**
 * Table — composable parts for a data table.
 * All parts are presentational; callers own layout and data.
 *
 * Usage:
 * <Table>
 *   <THead><Tr><Th>Name</Th></Tr></THead>
 *   <TBody><Tr><Td>Acme</Td></Tr></TBody>
 * </Table>
 */

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export function Table({ children, className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full text-sm border-collapse", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

interface THeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export function THead({ children, className, ...props }: THeadProps) {
  return (
    <thead className={cn("border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]", className)} {...props}>
      {children}
    </thead>
  );
}

interface TBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export function TBody({ children, className, ...props }: TBodyProps) {
  return (
    <tbody className={cn("divide-y divide-[var(--border-subtle)]", className)} {...props}>
      {children}
    </tbody>
  );
}

interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
}

export function Tr({ children, className, ...props }: TrProps) {
  return (
    <tr className={cn("hover:bg-[var(--bg-secondary)] transition-colors", className)} {...props}>
      {children}
    </tr>
  );
}

interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
}

export function Th({ children, className, ...props }: ThProps) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-left text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
}

export function Td({ children, className, ...props }: TdProps) {
  return (
    <td
      className={cn("px-3 py-2 text-[var(--text-secondary)] align-middle", className)}
      {...props}
    >
      {children}
    </td>
  );
}
