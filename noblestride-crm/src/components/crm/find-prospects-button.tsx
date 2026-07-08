"use client";

// find-prospects-button.tsx — Client component: triggers aiFindProspects on click,
// renders a ranked prospects panel with sector and rationale.

import { useState } from "react";
import { useClient, gql } from "@urql/next";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui";

const FIND_PROSPECTS_DOC = gql`
  query FindProspects($mandateId: ID!) {
    aiFindProspects(mandateId: $mandateId) {
      name
      sector
      rationale
    }
  }
`;

interface Prospect {
  name: string;
  sector: string;
  rationale: string;
}

interface FindProspectsButtonProps {
  mandateId: string;
}

export function FindProspectsButton({ mandateId }: FindProspectsButtonProps) {
  const client = useClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [open, setOpen] = useState(false);

  async function handleClick() {
    if (open && prospects !== null) {
      setOpen(false);
      return;
    }

    setLoading(true);
    setError(null);
    setOpen(true);

    try {
      const { data, error: gqlError } = await client
        .query(FIND_PROSPECTS_DOC, { mandateId })
        .toPromise();

      if (gqlError) {
        setError(gqlError.message ?? "Failed to load prospects.");
      } else {
        setProspects(data?.aiFindProspects ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Finding…
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5" />
            {open && prospects !== null ? "Hide Prospects" : "Find Prospects"}
          </>
        )}
      </Button>

      {open && !loading && (
        <div className="absolute right-0 top-full mt-2 z-50 w-96 max-w-[90vw] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-lg">
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Prospect Clients
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)]">
            {error ? (
              <div className="px-4 py-3 text-sm text-red-500">{error}</div>
            ) : !prospects || prospects.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[var(--text-tertiary)]">No prospects found for this mandate.</div>
            ) : (
              prospects.map((p, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--t-tag-bg-violet)] text-[10px] font-bold text-[var(--t-tag-text-violet)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{p.name}</span>
                      <span className="flex-shrink-0 rounded-full bg-[var(--t-tag-bg-gray)] px-2 py-0.5 text-[10px] text-[var(--t-tag-text-gray)]">
                        {p.sector}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)] leading-relaxed">{p.rationale}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
