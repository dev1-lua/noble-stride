"use client";

// filter-bar.tsx — Search + 4 filter dropdowns for the investors list page.
// Client Component: pushes searchParams to the URL so the server page re-queries.

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input, MultiSelect } from "@/components/ui";
import { options } from "@/lib/vocab";

// Multi-value params are comma-joined in the URL, e.g. ?sector=Tech,Health.
// An empty/absent param means "no constraint" (all values).
function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

/**
 * FilterBar — renders a search box + four searchable multi-select dropdowns.
 * On change, updates URL searchParams so the server page re-fetches with filters.
 * Param keys: q (search), type, sector, geography, status — each comma-joined
 * when multiple values are selected.
 */
export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const update = useCallback(
    (key: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (values.length > 0) {
        params.set(key, values.join(","));
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, searchParams, pathname]
  );

  const updateSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, searchParams, pathname]
  );

  const typeOptions = options("InvestorType");
  const sectorOptions = options("Sector");
  const geoOptions = options("Geography");
  const statusOptions = options("InvestorStatus");

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Search input */}
      <div className="w-56">
        <Input
          type="search"
          placeholder="Search investors…"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => updateSearch(e.target.value)}
          aria-label="Search investors"
        />
      </div>

      {/* Investor Type dropdown */}
      <div className="w-44">
        <MultiSelect
          options={typeOptions}
          selected={parseList(searchParams.get("type"))}
          onChange={(v) => update("type", v)}
          placeholder="Investor Type"
        />
      </div>

      {/* Sector Focus dropdown */}
      <div className="w-44">
        <MultiSelect
          options={sectorOptions}
          selected={parseList(searchParams.get("sector"))}
          onChange={(v) => update("sector", v)}
          placeholder="Sector Focus"
        />
      </div>

      {/* Geography dropdown */}
      <div className="w-44">
        <MultiSelect
          options={geoOptions}
          selected={parseList(searchParams.get("geography"))}
          onChange={(v) => update("geography", v)}
          placeholder="Geography"
        />
      </div>

      {/* Status dropdown */}
      <div className="w-44">
        <MultiSelect
          options={statusOptions}
          selected={parseList(searchParams.get("status"))}
          onChange={(v) => update("status", v)}
          placeholder="Status"
        />
      </div>
    </div>
  );
}
