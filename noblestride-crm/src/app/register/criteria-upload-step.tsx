"use client";
// F3.1 / image5: the optional investment-criteria upload, offered immediately
// after the fund registers.
//
// Optional is load-bearing here: the fund has just filled in a long wizard, and
// a hard requirement at this point would cost registrations. So Skip is a
// first-class action, and skipping lands on exactly the same confirmation as
// uploading.

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const submitClass =
  "rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60";

export default function CriteriaUploadStep() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function take(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
  }

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first, or skip this step.");
      return;
    }
    setState("sending");
    setError(null);
    const data = new FormData();
    data.set("file", file);
    try {
      const res = await fetch("/api/register/criteria-upload", { method: "POST", body: data });
      if (res.ok) {
        router.push("/register?step=pending&uploaded=1");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setState("error");
      setError(body.error ?? "We couldn't save that file. You can skip this step and send it later.");
    } catch {
      setState("error");
      setError("We couldn't save that file. You can skip this step and send it later.");
    }
  }

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
        Add your investment criteria
      </h2>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">
        Optional — a one-page investment criteria or mandate summary helps us match you faster. PDF,
        Word or Excel, up to 15 MB.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (inputRef.current && e.dataTransfer.files.length > 0) {
            inputRef.current.files = e.dataTransfer.files;
            take(e.dataTransfer.files);
          }
        }}
        className={
          "mt-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors " +
          (dragging
            ? "border-[var(--accent)] bg-[var(--t-tag-bg-emerald)]"
            : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]")
        }
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".pdf,.docx,.xlsx"
          data-testid="criteria-file"
          onChange={(e) => take(e.target.files)}
          className="mx-auto block text-xs text-[var(--text-secondary)]"
        />
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          {fileName ? `Selected: ${fileName}` : "or drag a file here"}
        </p>
      </div>

      {error && <p className="mt-2 text-xs text-[var(--t-tag-text-rose)]">{error}</p>}

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
        <Link
          href="/register?step=pending"
          data-testid="criteria-skip"
          className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
        >
          Skip for now
        </Link>
        <button type="button" onClick={upload} disabled={state === "sending"} className={submitClass}>
          {state === "sending" ? "Uploading…" : "Upload and finish →"}
        </button>
      </div>
    </section>
  );
}
