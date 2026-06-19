"use client";

// filter-bar.tsx — Search + 4 filter dropdowns for the investors list page.
// Client Component: pushes searchParams to the URL so the server page re-queries.

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input, Select } from "@/components/ui";
import { options } from "@/lib/vocab";

/**
 * FilterBar — renders a search box + four Select dropdowns.
 * On change, updates URL searchParams so the server page re-fetches with filters.
 * Param keys: q (search), type, sector, geography, status.
 */
export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, searchParams, pathname]
  );

  const typeOptions = [{ value: "", label: "All Types" }, ...options("InvestorType")];
  const sectorOptions = [{ value: "", label: "All Sectors" }, ...options("Sector")];
  const geoOptions = [{ value: "", label: "All Geographies" }, ...options("Geography")];
  const statusOptions = [{ value: "", label: "All Statuses" }, ...options("InvestorStatus")];

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Search input */}
      <div className="w-56">
        <Input
          type="search"
          placeholder="Search investors…"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
          aria-label="Search investors"
        />
      </div>

      {/* Investor Type dropdown */}
      <div className="w-44">
        <Select
          options={typeOptions}
          value={searchParams.get("type") ?? ""}
          onChange={(v) => update("type", v)}
          placeholder="Investor Type"
        />
      </div>

      {/* Sector Focus dropdown */}
      <div className="w-44">
        <Select
          options={sectorOptions}
          value={searchParams.get("sector") ?? ""}
          onChange={(v) => update("sector", v)}
          placeholder="Sector Focus"
        />
      </div>

      {/* Geography dropdown */}
      <div className="w-44">
        <Select
          options={geoOptions}
          value={searchParams.get("geography") ?? ""}
          onChange={(v) => update("geography", v)}
          placeholder="Geography"
        />
      </div>

      {/* Status dropdown */}
      <div className="w-44">
        <Select
          options={statusOptions}
          value={searchParams.get("status") ?? ""}
          onChange={(v) => update("status", v)}
          placeholder="Status"
        />
      </div>
    </div>
  );
}
