"use client";

// folder-browser.tsx — file-room browser island (client feedback 2026-07):
// breadcrumbs, child-folder grid with rename/move/delete, per-file
// move-to-folder control. Navigation is URL-driven (?folder=<id>) so the RSC
// page re-queries; writes go through the folder server actions and land via
// revalidatePath. Folders organize only — access stays on the document.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Folder as FolderIcon, FolderPlus, MoreHorizontal, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { Chip } from "@/components/ui";
import {
  createFolderAction,
  renameFolderAction,
  moveFolderAction,
  deleteFolderAction,
  moveDocumentAction,
} from "@/app/(crm)/documents/folder-actions";

export interface FolderCardData {
  id: string;
  name: string;
  documentCount: number;
  childCount: number;
}

export interface FileRowData {
  id: string;
  name: string;
  type: string;
  accessLevel: string;
  status: string | null;
  fileUrl: string | null;
  uploadedAtDisplay: string;
}

export interface FolderOption {
  value: string;
  label: string;
}

export function FolderBrowser({
  currentFolderId,
  breadcrumbs,
  folders,
  files,
  folderOptions,
  canEdit,
}: {
  currentFolderId: string | null;
  breadcrumbs: { id: string; name: string }[];
  folders: FolderCardData[];
  files: FileRowData[];
  /** Flattened tree (indented labels) for move destinations. */
  folderOptions: FolderOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);

  function act(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const folderHref = (id: string | null) => (id ? `/documents?folder=${id}` : "/documents");

  return (
    <div className="space-y-4">
      {/* Breadcrumbs + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href={folderHref(null)} className={currentFolderId ? "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" : "font-semibold text-[var(--text-primary)]"}>
            File Room
          </Link>
          {breadcrumbs.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1.5">
              <span className="text-[var(--text-tertiary)]">/</span>
              {i === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-[var(--text-primary)]">{b.name}</span>
              ) : (
                <Link href={folderHref(b.id)} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                  {b.name}
                </Link>
              )}
            </span>
          ))}
        </nav>
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setCreating((v) => !v)} disabled={pending}>
            <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
            New folder
          </Button>
        )}
      </div>

      {creating && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            act(() => createFolderAction({ name: newName, parentId: currentFolderId }));
            setNewName("");
            setCreating(false);
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name"
            className="w-64 rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <Button type="submit" variant="primary" size="sm" disabled={pending}>Create</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
        </form>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {/* Folder grid */}
      {folders.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folders.map((f) => (
            <div
              key={f.id}
              className="group relative flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 transition-colors hover:border-[var(--border-strong)]"
            >
              <FolderIcon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <Link href={folderHref(f.id)} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{f.name}</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {f.childCount > 0 ? `${f.childCount} folder${f.childCount === 1 ? "" : "s"} · ` : ""}
                  {f.documentCount} file{f.documentCount === 1 ? "" : "s"}
                </p>
              </Link>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Folder actions for ${f.name}`}
                  onClick={() => setMenuFor(menuFor === f.id ? null : f.id)}
                  className="rounded p-1 text-[var(--text-tertiary)] opacity-0 transition-opacity hover:bg-[var(--bg-tertiary)] group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              )}
              {menuFor === f.id && (
                <div className="absolute right-2 top-10 z-20 w-44 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                    onClick={() => {
                      const name = window.prompt("Rename folder", f.name);
                      setMenuFor(null);
                      if (name && name.trim() && name !== f.name) act(() => renameFolderAction(f.id, name));
                    }}
                  >
                    Rename
                  </button>
                  <MoveSelect
                    label="Move to…"
                    options={[{ value: "", label: "File Room (top level)" }, ...folderOptions.filter((o) => o.value !== f.id)]}
                    onSelect={(dest) => {
                      setMenuFor(null);
                      act(() => moveFolderAction(f.id, dest || null));
                    }}
                  />
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-[var(--bg-tertiary)]"
                    onClick={() => {
                      setMenuFor(null);
                      if (window.confirm(`Delete "${f.name}"? Sub-folders are deleted too; files inside become unfiled (never deleted).`)) {
                        act(() => deleteFolderAction(f.id));
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Files in this folder */}
      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          {currentFolderId ? "Files" : "Unfiled documents"}
        </div>
        {files.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--text-tertiary)]">
            {currentFolderId ? "No files in this folder yet." : "Every document is filed."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {files.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                <div className="min-w-0 flex-1">
                  {doc.fileUrl ? (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-[var(--text-primary)] hover:text-accent">
                      {doc.name}
                    </a>
                  ) : (
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{doc.name}</p>
                  )}
                  <p className="text-[11px] text-[var(--text-tertiary)]">Uploaded {doc.uploadedAtDisplay}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip value={doc.type} group="DocumentType" />
                  <Chip value={doc.accessLevel} group="DocumentAccessLevel" />
                  {canEdit && (
                    <MoveSelect
                      compact
                      label="Move"
                      options={[{ value: "", label: "Unfiled" }, ...folderOptions]}
                      onSelect={(dest) => act(() => moveDocumentAction(doc.id, dest || null))}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Minimal move control: a native select styled as a menu row / small button. */
function MoveSelect({
  label,
  options,
  onSelect,
  compact = false,
}: {
  label: string;
  options: FolderOption[];
  onSelect: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value="__noop"
      onChange={(e) => {
        if (e.target.value !== "__noop") onSelect(e.target.value);
      }}
      className={
        compact
          ? "rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 py-1 text-[11px] text-[var(--text-secondary)]"
          : "block w-full rounded px-2 py-1.5 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
      }
    >
      <option value="__noop" hidden>
        {label}
      </option>
      {options.map((o) => (
        <option key={o.value || "root"} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
