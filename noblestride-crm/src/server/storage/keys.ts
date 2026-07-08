// Deterministic object keys for stored files. Keys are the ONLY thing that
// reaches a provider path, so filename sanitization happens here.

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\- ]+/g, "").trim();
  return cleaned.length > 0 ? cleaned : "file";
}

/** Strip path separators and collapse traversal sequences from a single key segment. */
function sanitizeSegment(s: string): string {
  const cleaned = s.replace(/[\\/]/g, "").replace(/\.{2,}/g, "").trim();
  return cleaned.length > 0 ? cleaned : "x";
}

export function buildObjectKey(parts: {
  entityType: string;
  entityId: string;
  documentId: string;
  version: string;
  filename: string;
}): string {
  const file = sanitizeFilename(parts.filename);
  return `${sanitizeSegment(parts.entityType)}/${sanitizeSegment(parts.entityId)}/${sanitizeSegment(parts.documentId)}/${sanitizeSegment(parts.version)}-${file}`;
}
