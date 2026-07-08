"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";
import type { ZodTypeAny } from "zod";

/** Build the mutation input: drop blanks ("", null, undefined) so optional Zod
 * fields stay optional, and strip `id` — the record id travels as its own $id
 * variable, and an unknown `id` field inside a *Input type fails strict input
 * coercion (graphql 17), nulling the whole input.
 *
 * `clearableFields` is an opt-in escape hatch from that "blank means leave
 * unchanged" convention: for the fields it names, a blank string `""` is sent
 * through as an explicit `null` (a real "clear this field" signal) instead of
 * being dropped. `null`/`undefined` are still dropped for every field,
 * clearable or not — only `""` (an actual blank selection) triggers a clear.
 * Fields not listed keep the default drop-on-blank behavior unchanged. */
export function buildMutationInput(
  values: Record<string, unknown>,
  clearableFields: readonly string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (k === "id") continue;
    if (v === "") {
      if (clearableFields.includes(k)) out[k] = null;
      continue;
    }
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

interface UseEntityFormOptions {
  initial: Record<string, unknown>;
  schema: ZodTypeAny;
  createMutation: string;
  updateMutation: string;
  mode: "create" | "edit";
  recordId?: string;
  onSuccess: () => void;
  /** Fields where a blank ("") value should be sent as an explicit `null`
   * (clear) rather than dropped (leave unchanged). See `buildMutationInput`. */
  clearableFields?: string[];
}

export function useEntityForm(opts: UseEntityFormOptions) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(opts.initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [, runCreate] = useMutation(opts.createMutation);
  const [, runUpdate] = useMutation(opts.updateMutation);

  const setValue = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  async function submit() {
    const input = buildMutationInput(values, opts.clearableFields);
    const parsed = opts.schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);

    const result =
      opts.mode === "create"
        ? await runCreate({ input })
        : await runUpdate({ id: opts.recordId, input });

    setPending(false);

    if (result.error) {
      setFormError(result.error.message.replace(/^\[GraphQL\]\s*/, ""));
      return;
    }
    router.refresh();
    opts.onSuccess();
  }

  return { values, setValue, errors, formError, pending, submit };
}
