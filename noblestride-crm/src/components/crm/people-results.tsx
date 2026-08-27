// people-results.tsx — "search a person, get their fund" (F3.4 / image9).
//
// Sits above the investor table when the search box is in use. The table
// narrows the list of FUNDS; this card answers "who is this person?" and links
// straight to their row on the fund page, which is what the client was actually
// asking for. Hidden entirely when there are no people matches, so the normal
// fund search is unaffected.

import Link from "next/link";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui";
import type { InvestorPersonHit } from "@/server/services/persons";

export function PeopleResults({ hits, query }: { hits: InvestorPersonHit[]; query: string }) {
  if (hits.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          People matching &ldquo;{query}&rdquo;
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
          {hits.length} contact{hits.length === 1 ? "" : "s"} across all investors
        </p>
      </CardHeader>
      <CardBody className="divide-y divide-[var(--border-subtle)] p-0">
        {hits.map((hit) => (
          <div
            key={hit.personId}
            data-testid="people-result"
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <Link
                // Deep-links to the contact's own row on the fund page.
                href={`/investors/${hit.investorId}#contact-${hit.personId}`}
                className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
              >
                {hit.name}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-tertiary)]">
                {hit.jobTitle && <span>{hit.jobTitle}</span>}
                <span>·</span>
                <Link
                  href={`/investors/${hit.investorId}`}
                  className="font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
                >
                  {hit.investorName}
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
              {hit.email && (
                <a href={`mailto:${hit.email}`} className="hover:text-[var(--accent)]">
                  {hit.email}
                </a>
              )}
              {hit.phone && <span>{hit.phone}</span>}
              {hit.hasAccount && <Badge tone="success">Portal access</Badge>}
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
