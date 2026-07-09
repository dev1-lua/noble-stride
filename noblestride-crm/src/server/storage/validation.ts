import { createHash } from "node:crypto";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

// Office formats (docx/xlsx/pptx) are ZIP containers; we accept them when the
// declared type is an office type and the bytes are a ZIP container.
const OFFICE_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const ALLOWED_MIMES = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  ...OFFICE_MIMES,
]);

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sniffMime(bytes: Buffer): string | null {
  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "application/zip";
  return null;
}

export function validateUpload(
  filename: string,
  declaredMime: string,
  bytes: Buffer,
): { ok: true; mime: string; checksum: string } | { ok: false; reason: string } {
  if (bytes.length === 0) return { ok: false, reason: "File is empty." };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, reason: `File is too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB).` };
  if (!ALLOWED_MIMES.has(declaredMime)) return { ok: false, reason: `File type not allowed: ${declaredMime}` };

  const sniffed = sniffMime(bytes);
  const contentOk =
    (declaredMime === "application/pdf" && sniffed === "application/pdf") ||
    (declaredMime === "image/png" && sniffed === "image/png") ||
    (declaredMime === "image/jpeg" && sniffed === "image/jpeg") ||
    (OFFICE_MIMES.has(declaredMime) && sniffed === "application/zip") ||
    // text/plain and text/csv intentionally skip magic-byte sniffing: there is
    // no reliable signature for plain text, uploads are staff-only, and
    // downloads are served as an attachment (never inline-rendered).
    (declaredMime === "text/plain" || declaredMime === "text/csv");

  if (!contentOk) return { ok: false, reason: "File content does not match its declared type." };

  return { ok: true, mime: declaredMime, checksum: sha256(bytes) };
}
