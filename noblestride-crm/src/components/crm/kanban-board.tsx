"use client";

// kanban-board.tsx — Client component: DnD boards for Mandates + Transactions.
// - Receives pre-shaped plain DTOs from the RSC server page (no Prisma types cross boundary).
// - Holds columns in local state for optimistic moves.
// - Fires updateMandateStage / updateTransactionStage mutation via urql on drop.
// - On success: router.refresh() so the RSC re-queries authoritative DB state.
// - On error: reverts optimistic move + surfaces a console error.

import { useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { MandateKanbanCard, TransactionKanbanCard } from "./kanban-card";
import type { MandateCardDTO, TransactionCardDTO } from "./kanban-card";
import { STAGE_HELP } from "@/lib/vocab";

// ─── GraphQL mutation strings ─────────────────────────────────────────────────

const UPDATE_MANDATE_STAGE = `
  mutation UpdateMandateStage($id: ID!, $stage: MandateStage!) {
    updateMandateStage(id: $id, stage: $stage) { id stage }
  }
`;

const UPDATE_TRANSACTION_STAGE = `
  mutation UpdateTransactionStage($id: ID!, $stage: TransactionStage!) {
    updateTransactionStage(id: $id, stage: $stage) { id stage }
  }
`;

const UPDATE_ADVISORY_STAGE = `
  mutation UpdateAdvisoryStage($id: ID!, $stage: AdvisoryStage!) {
    updateAdvisoryStage(id: $id, stage: $stage) { id stage }
  }
`;

// ─── Column DTO ───────────────────────────────────────────────────────────────

export interface KanbanColumnDTO<T> {
  stage: string;
  label: string;
  items: T[];
}

// ─── Props ────────────────────────────────────────────────────────────────────

type MandateKanbanProps = {
  kind: "mandate";
  columns: KanbanColumnDTO<MandateCardDTO>[];
  /** §7.2 lens: disables drag restaging when the active org-role lacks Update. */
  readOnly?: boolean;
};

type TransactionKanbanProps = {
  kind: "transaction";
  columns: KanbanColumnDTO<TransactionCardDTO>[];
  /** §7.2 lens: disables drag restaging when the active org-role lacks Update. */
  readOnly?: boolean;
};

// Advisory cards carry the same fields as mandate cards (client, sectors,
// next action, days-in-stage, lead) so the board reuses MandateCardDTO/-Card.
type AdvisoryKanbanProps = {
  kind: "advisory";
  columns: KanbanColumnDTO<MandateCardDTO>[];
  /** §7.2 lens: disables drag restaging when the active org-role lacks Update. */
  readOnly?: boolean;
};

type KanbanBoardProps = MandateKanbanProps | TransactionKanbanProps | AdvisoryKanbanProps;

const STAGE_HELP_KEY = {
  mandate: "MandateStage",
  transaction: "TransactionStage",
  advisory: "AdvisoryStage",
} as const;

// ─── Color accent per stage column index ─────────────────────────────────────

const COLUMN_HEADER_COLORS = [
  "border-l-slate-400",
  "border-l-sky-500",
  "border-l-violet-500",
  "border-l-amber-500",
  "border-l-orange-500",
  "border-l-emerald-500",
  "border-l-rose-500",
];

// ─── Generic card type for column state ──────────────────────────────────────

type AnyCardDTO = MandateCardDTO | TransactionCardDTO;

// ─── KanbanBoard ─────────────────────────────────────────────────────────────

export function KanbanBoard(props: KanbanBoardProps) {
  const router = useRouter();

  // Local state seeded from server props — drives optimistic moves.
  // Cast to generic column array so setState can work with either board kind.
  const [columns, setColumns] = useState<KanbanColumnDTO<AnyCardDTO>[]>(
    props.columns as KanbanColumnDTO<AnyCardDTO>[]
  );

  // urql mutations
  const [, executeMandateMutation] = useMutation(UPDATE_MANDATE_STAGE);
  const [, executeTransactionMutation] = useMutation(UPDATE_TRANSACTION_STAGE);
  const [, executeAdvisoryMutation] = useMutation(UPDATE_ADVISORY_STAGE);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (props.readOnly) return;
      const { source, destination, draggableId } = result;

      // Dropped outside a list or in the same column at same position
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      )
        return;

      // Snapshot prior state for rollback
      const prevColumns = columns;

      // --- Optimistic update ---
      setColumns((cols) => {
        const next: KanbanColumnDTO<AnyCardDTO>[] = cols.map((col) => ({
          ...col,
          items: [...col.items],
        }));

        const srcCol = next.find((c) => c.stage === source.droppableId);
        const dstCol = next.find((c) => c.stage === destination.droppableId);
        if (!srcCol || !dstCol) return cols;

        const [moved] = srcCol.items.splice(source.index, 1);
        dstCol.items.splice(destination.index, 0, moved);

        return next;
      });

      // --- Fire the mutation ---
      const newStage = destination.droppableId;

      let error: Error | null = null;

      if (props.kind === "mandate") {
        const result = await executeMandateMutation({ id: draggableId, stage: newStage });
        if (result.error) error = result.error;
      } else if (props.kind === "advisory") {
        const result = await executeAdvisoryMutation({ id: draggableId, stage: newStage });
        if (result.error) error = result.error;
      } else {
        const result = await executeTransactionMutation({ id: draggableId, stage: newStage });
        if (result.error) error = result.error;
      }

      if (error) {
        // Revert optimistic move
        console.error("[KanbanBoard] restage failed — reverting:", error.message);
        setColumns(prevColumns);
        return;
      }

      // Success: refresh RSC so authoritative state + daysInStage recalculate
      router.refresh();
    },
    [columns, props.kind, props.readOnly, executeMandateMutation, executeTransactionMutation, executeAdvisoryMutation, router]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {/* Horizontally scrolling container */}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[480px]">
        {columns.map((col, colIdx) => (
          <div
            key={col.stage}
            className="flex-shrink-0 w-64 flex flex-col"
          >
            {/* Column header */}
            <div
              title={STAGE_HELP[STAGE_HELP_KEY[props.kind]][col.stage]}
              className={`mb-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] border-l-4 ${
                COLUMN_HEADER_COLORS[colIdx % COLUMN_HEADER_COLORS.length]
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  {col.label}
                </span>
                <span className="text-xs font-bold text-[var(--t-tag-text-gray)] bg-[var(--t-tag-bg-gray)] rounded-full px-2 py-0.5">
                  {col.items.length}
                </span>
              </div>
            </div>

            {/* Droppable area */}
            <Droppable droppableId={col.stage}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 flex flex-col gap-2 rounded-md p-1.5 min-h-[120px] border border-[var(--border-subtle)] transition-colors ${
                    snapshot.isDraggingOver
                      ? "bg-accent/5 ring-1 ring-accent/20"
                      : "bg-[var(--bg-secondary)]"
                  }`}
                >
                  {col.items.map((item, idx) => (
                    <Draggable key={item.id} draggableId={item.id} index={idx} isDragDisabled={props.readOnly}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={provided.draggableProps.style}
                          className={snapshot.isDragging ? "opacity-90 rotate-1 shadow-md" : ""}
                        >
                          {props.kind === "transaction" ? (
                            <TransactionKanbanCard
                              card={item as TransactionCardDTO}
                              href={`/transactions/${item.id}`}
                            />
                          ) : (
                            <MandateKanbanCard
                              card={item as MandateCardDTO}
                              href={props.kind === "advisory" ? `/advisory/${item.id}` : `/mandates/${item.id}`}
                            />
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {col.items.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xs text-[var(--text-tertiary)] text-center py-4">Drop here</p>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
