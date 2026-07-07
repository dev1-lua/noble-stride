// documents-by-stage.tsx — Documents-by-stage panel (Task 14, queue-rework spec).
// Presentational only: no data fetching, no Prisma types, no Decimals. The
// mandate/transaction detail pages (RSC) build this plain DTO from the
// already-loaded `documents` array + mandate NDA/EA status + transaction
// vdrLink, then mount <DocumentsByStage/> alongside the existing Documents
// list. Mirrors deal-summary-panel.tsx's import + labeling approach (Task 13).

import { Card, CardHeader, CardBody } from "@/components/ui";
import { label, STATUS_DOT } from "@/lib/vocab";
import {
  WORKFLOW_STAGE_ORDER,
  WORKFLOW_STAGE_LABEL,
  docTypesForStage,
} from "@/lib/doc-stages";

export interface DocRowDTO {
  id: string;
  type: string;
  typeLabel: string;
  statusLabel: string;
  statusValue: string;
  href?: string | null;
}

export interface DocsByStageProps {
  // one entry per existing document already linked to this record
  documents: DocRowDTO[];
  // family-specific pre-known statuses sourced from the record itself:
  ndaStatusLabel: string;
  ndaStatusValue: string; // from Mandate.ndaStatus
  eaStatusLabel: string;
  eaStatusValue: string; // from Mandate.eaStatus
  vdrLinked: boolean; // Transaction.vdrLink present
  addHref?: (docType: string) => string; // opens create drawer prefilled (optional)
}

function StatusDot({ value }: { value: string }) {
  const dotClass = value ? (STATUS_DOT[value] ?? "bg-zinc-400") : "bg-zinc-300";
  return <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotClass}`} />;
}

// Muted pill for a doc slot with no linked document yet. `Chip` is
// vocab-driven (value/group, no children) and can't represent this computed
// state — mirrors the local-badge pattern in deals-table.tsx (`TypeBadge`).
function MissingBadge() {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 ring-1 ring-inset ring-zinc-500/15">
      Missing
    </span>
  );
}

function AddLink({ docType, addHref }: { docType: string; addHref?: (docType: string) => string }) {
  if (!addHref) return null;
  return (
    <a href={addHref(docType)} className="text-xs font-medium text-accent hover:underline">
      + Add
    </a>
  );
}

/** A single expected-document row: label on the left, status/link + optional Add on the right. */
function StageRow({
  rowLabel,
  statusLabel,
  statusValue,
  href,
  missing,
  docType,
  addHref,
}: {
  rowLabel: string;
  statusLabel: string;
  statusValue: string;
  href?: string | null;
  missing: boolean;
  docType: string;
  addHref?: (docType: string) => string;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-zinc-700">{rowLabel}</span>
      <div className="flex items-center gap-3">
        {missing ? (
          <MissingBadge />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <StatusDot value={statusValue} />
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">
                {statusLabel || "—"}
              </a>
            ) : (
              statusLabel || "—"
            )}
          </span>
        )}
        {missing && <AddLink docType={docType} addHref={addHref} />}
      </div>
    </li>
  );
}

/**
 * DocumentsByStage — expected-vs-actual document checklist grouped by
 * workflow stage (SPEC §6). One block per WORKFLOW_STAGE_ORDER entry; one row
 * per docTypesForStage(stage). NDA/EngagementContract are sourced from the
 * Mandate date-pair props (not the documents list); DataRoom has no document
 * types of its own and instead renders a single VDR-linked row.
 */
export function DocumentsByStage(props: DocsByStageProps) {
  const { documents, ndaStatusLabel, ndaStatusValue, eaStatusLabel, eaStatusValue, vdrLinked, addHref } = props;

  const findDoc = (docType: string) => documents.find((d) => d.type === docType);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">Documents by Stage</h2>
      </CardHeader>
      <CardBody className="space-y-5">
        {WORKFLOW_STAGE_ORDER.map((stage) => (
          <div key={stage}>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
              {WORKFLOW_STAGE_LABEL[stage]}
            </h3>
            <ul className="mt-1.5 divide-y divide-zinc-100">
              {stage === "DataRoom" ? (
                <StageRow
                  rowLabel="Data Room"
                  statusLabel={vdrLinked ? "Linked" : ""}
                  statusValue={vdrLinked ? "VDRAccess" : ""}
                  missing={!vdrLinked}
                  docType="DataRoom"
                  addHref={addHref}
                />
              ) : (
                docTypesForStage(stage).map((docType) => {
                  if (docType === "NDA") {
                    return (
                      <StageRow
                        key={docType}
                        rowLabel={label("DocumentType", "NDA")}
                        statusLabel={ndaStatusLabel}
                        statusValue={ndaStatusValue}
                        missing={!ndaStatusValue || ndaStatusValue === "NotSent"}
                        docType={docType}
                        addHref={addHref}
                      />
                    );
                  }
                  if (docType === "EngagementContract") {
                    return (
                      <StageRow
                        key={docType}
                        rowLabel={label("DocumentType", "EngagementContract")}
                        statusLabel={eaStatusLabel}
                        statusValue={eaStatusValue}
                        missing={!eaStatusValue || eaStatusValue === "NotSent"}
                        docType={docType}
                        addHref={addHref}
                      />
                    );
                  }
                  const doc = findDoc(docType);
                  return (
                    <StageRow
                      key={docType}
                      rowLabel={label("DocumentType", docType)}
                      statusLabel={doc?.statusLabel ?? ""}
                      statusValue={doc?.statusValue ?? ""}
                      href={doc?.href}
                      missing={!doc}
                      docType={docType}
                      addHref={addHref}
                    />
                  );
                })
              )}
            </ul>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
