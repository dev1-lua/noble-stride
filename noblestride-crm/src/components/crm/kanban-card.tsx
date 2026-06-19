// kanban-card.tsx — Individual draggable cards for the Kanban boards.
// Pure rendering — receives plain DTO props; no Prisma types cross the RSC boundary.

import { Chip, Avatar } from "@/components/ui";
import { cn } from "@/lib/cn";

// ─── Card DTO types ───────────────────────────────────────────────────────────

export interface MandateCardDTO {
  id: string;
  clientName: string;
  sectors: string[];
  nextAction: string | null;
  daysInStage: number;
  ownerName: string | null;
  ownerColor: string | null;
}

export interface TransactionCardDTO {
  id: string;
  clientName: string;
  dealTypeName: string | null;
  sectors: string[];
  instruments: string[];
  targetRaise: string | null; // pre-formatted e.g. "$8.0M"
  investorsContacted: number;
  activeConversations: number;
  daysInStage: number;
  ownerName: string | null;
  ownerColor: string | null;
}

// ─── Mandate card ─────────────────────────────────────────────────────────────

interface MandateKanbanCardProps {
  card: MandateCardDTO;
  /** Used for href links to detail page */
  href: string;
  className?: string;
}

export function MandateKanbanCard({ card, href, className }: MandateKanbanCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-zinc-200 shadow-sm p-3.5 space-y-2.5 cursor-grab active:cursor-grabbing",
        className
      )}
    >
      {/* Client name */}
      <a
        href={href}
        className="block text-sm font-semibold text-zinc-900 hover:text-accent transition-colors leading-snug"
        onClick={(e) => e.stopPropagation()}
      >
        {card.clientName}
      </a>

      {/* Sector chips */}
      {card.sectors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.sectors.slice(0, 2).map((s) => (
            <Chip key={s} value={s} group="Sector" />
          ))}
          {card.sectors.length > 2 && (
            <span className="text-xs text-zinc-400">+{card.sectors.length - 2}</span>
          )}
        </div>
      )}

      {/* Next action */}
      {card.nextAction && (
        <p className="text-xs text-zinc-500 leading-snug line-clamp-2">
          <span className="font-medium text-zinc-700">Next: </span>
          {card.nextAction}
        </p>
      )}

      {/* Footer: days in stage + owner avatar */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-xs text-zinc-400">{card.daysInStage}d in stage</span>
        {card.ownerName && (
          <Avatar
            name={card.ownerName}
            color={card.ownerColor ?? undefined}
            size="sm"
          />
        )}
      </div>
    </div>
  );
}

// ─── Transaction card ─────────────────────────────────────────────────────────

interface TransactionKanbanCardProps {
  card: TransactionCardDTO;
  href: string;
  className?: string;
}

export function TransactionKanbanCard({ card, href, className }: TransactionKanbanCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-zinc-200 shadow-sm p-3.5 space-y-2.5 cursor-grab active:cursor-grabbing",
        className
      )}
    >
      {/* Client name + deal type */}
      <div>
        <a
          href={href}
          className="block text-sm font-semibold text-zinc-900 hover:text-accent transition-colors leading-snug"
          onClick={(e) => e.stopPropagation()}
        >
          {card.clientName}
        </a>
        {card.dealTypeName && (
          <p className="text-xs text-zinc-500 mt-0.5">{card.dealTypeName}</p>
        )}
      </div>

      {/* Sector + instrument chips */}
      <div className="flex flex-wrap gap-1">
        {card.sectors.slice(0, 1).map((s) => (
          <Chip key={s} value={s} group="Sector" />
        ))}
        {card.instruments.slice(0, 1).map((inst) => (
          <Chip key={inst} value={inst} group="Instrument" />
        ))}
      </div>

      {/* Deal size */}
      {card.targetRaise && (
        <p className="text-sm font-bold text-zinc-900">{card.targetRaise}</p>
      )}

      {/* Investor engagement counts */}
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span>
          <span className="font-medium text-zinc-700">{card.investorsContacted}</span> contacted
        </span>
        <span>
          <span className="font-medium text-zinc-700">{card.activeConversations}</span> active
        </span>
        <a
          href={href}
          className="ml-auto text-accent hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          View →
        </a>
      </div>

      {/* Footer: days in stage + owner avatar */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-xs text-zinc-400">{card.daysInStage}d in stage</span>
        {card.ownerName && (
          <Avatar
            name={card.ownerName}
            color={card.ownerColor ?? undefined}
            size="sm"
          />
        )}
      </div>
    </div>
  );
}
