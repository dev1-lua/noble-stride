// Validates a ?next= redirect target: only same-origin absolute paths are
// allowed. Rejects protocol-relative (`//host`), backslash-tricked
// (`/\host` — browsers normalize `\`→`/`), control-character-tricked
// (tab/CR/LF are stripped by browsers before URL parsing, so a raw `\t`,
// `\n`, or `\r` in the path could reconstruct a protocol-relative URL, e.g.
// `/\t/evil.com` → `//evil.com`), and any non-`/`-leading value, which
// would otherwise become an open redirect after login.
export function safeNext(next: string | undefined): string | null {
  return next && /^\/(?![/\\])/.test(next) && !/[\x00-\x1f]/.test(next)
    ? next
    : null;
}
