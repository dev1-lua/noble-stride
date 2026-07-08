// Validates a ?next= redirect target: only same-origin absolute paths are
// allowed. Rejects protocol-relative (`//host`), backslash-tricked
// (`/\host` — browsers normalize `\`→`/`), and any non-`/`-leading value,
// which would otherwise become an open redirect after login.
export function safeNext(next: string | undefined): string | null {
  return next && /^\/(?![/\\])/.test(next) ? next : null;
}
