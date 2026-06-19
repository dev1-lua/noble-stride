"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";
import type { ZodTypeAny } from "zod";

/** Drop "" / null / undefined so optional Zod fields stay optional and we never send blanks. */
function prune(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === "" || v === null || v === undefined) continue;
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
    const input = prune(values);
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
