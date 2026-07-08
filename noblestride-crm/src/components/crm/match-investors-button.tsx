"use client";

// match-investors-button.tsx — Client component: triggers aiMatchInvestors on click,
// renders a ranked investor panel with score badges and reason chips.

import { useState } from "react";
import { useClient, gql } from "@urql/next";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui";

const MATCH_INVESTORS_DOC = gql`
  query MatchInvestors($transactionId: ID!) {
    aiMatchInvestors(transactionId: $transactionId) {
      id
      name
      score
      reasons
    }
  }
`;

interface InvestorMatch {
  id: string;
  name: string;
  score: number;
  reasons: string[];
}

interface MatchInvestorsButtonProps {
  transactionId: string;
}

export function MatchInvestorsButton({ transactionId }: MatchInvestorsButtonProps) {
  const client = useClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<InvestorMatch[] | null>(null);
  const [open, setOpen] = useState(false);

  async function handleClick() {
    if (open && matches !== null) {
      setOpen(false);
      return;
    }

    setLoading(true);
    setError(null);
    setOpen(true);

    try {
      const { data, error: gqlError } = await client
        .query(MATCH_INVESTORS_DOC, { transactionId })
        .toPromise();

      if (gqlError) {
        setError(gqlError.message ?? "Failed to load matches.");
      } else {
        setMatches(data?.aiMatchInvestors ?? []);
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
            Matching…
          </>
        ) : (
          <>
            <Users className="h-3.5 w-3.5" />
            {open && matches !== null ? "Hide Matches" : "Match Investors"}
          </>
        )}
      </Button>

      {open && !loading && (
        <div className="absolute right-0 top-full mt-2 z-50 w-96 max-w-[90vw] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-lg">
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Investor Matches
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)]">
            {error ? (
              <div className="px-4 py-3 text-sm text-red-500">{error}</div>
            ) : !matches || matches.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[var(--text-tertiary)]">No matching investors found.</div>
            ) : (
              matches.map((m, rank) => (
                <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                  {/* Rank number */}
                  <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--t-tag-bg-gray)] text-[10px] font-bold text-[var(--t-tag-text-gray)]">
                    {rank + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{m.name}</span>
                      <span className="flex-shrink-0 rounded-full bg-[var(--t-tag-bg-emerald)] px-2 py-0.5 text-xs font-bold text-[var(--t-tag-text-emerald)]">
                        {Math.round(m.score * 100)}%
                      </span>
                    </div>
                    {m.reasons.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {m.reasons.map((reason, ri) => (
                          <span
                            key={ri}
                            className="rounded-full bg-[var(--t-tag-bg-gray)] px-2 py-0.5 text-[10px] text-[var(--t-tag-text-gray)]"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
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
