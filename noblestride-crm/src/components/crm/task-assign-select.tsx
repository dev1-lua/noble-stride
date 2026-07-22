"use client";

// task-assign-select.tsx — inline lead/assist editor for a tasks-table cell.
// A single Select that fires the assignTask mutation on change (optimistic,
// rolls back on error, then router.refresh()). Clicks are stopped from
// bubbling so editing a cell never opens the row's edit drawer. The update
// service fires the "you were assigned" bell notification.

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

const ASSIGN_TASK = `
  mutation AssignTask($id: ID!, $assigneeId: ID, $assistantId: ID) {
    assignTask(id: $id, assigneeId: $assigneeId, assistantId: $assistantId) { id }
  }
`;

export function TaskAssignSelect({ taskId, field, value, users }: {
  taskId: string;
  field: "assigneeId" | "assistantId";
  value: string | null;
  users: SelectOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, exec] = useMutation(ASSIGN_TASK);

  async function handleChange(next: string) {
    if (!next || next === selected || pending) return;
    const prev = selected;
    setSelected(next);
    setError(null);
    setPending(true);
    const result = await exec({ id: taskId, [field]: next });
    setPending(false);
    if (result.error) {
      setSelected(prev);
      const raw = result.error.graphQLErrors?.[0]?.message ?? result.error.message;
      setError((raw.startsWith("[GraphQL] ") ? raw.slice("[GraphQL] ".length) : raw) || "Update failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="min-w-[8rem] space-y-1" onClick={(e) => e.stopPropagation()}>
      <Select
        options={users}
        value={selected}
        onChange={handleChange}
        placeholder={field === "assigneeId" ? "Set lead…" : "Set assist…"}
        disabled={pending}
        aria-label={field === "assigneeId" ? "Deal lead" : "Deal assist"}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
