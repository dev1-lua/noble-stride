// Contact-email input with the Gmail/Yahoo policy warning (warn, never block).
// Client component so the warning tracks what the user types.
"use client";

import { useState } from "react";

const FREE_MAIL = /@(gmail|yahoo)\./i;

export function ContactEmailField({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div>
      <input
        type="email"
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="contact@yourfund.com"
        className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
      />
      {FREE_MAIL.test(value) && (
        <p className="mt-1.5 rounded-md border border-[var(--t-tag-bg-amber)] bg-[var(--t-tag-bg-amber)] px-2.5 py-1.5 text-xs text-[var(--t-tag-text-amber)]">
          Please use a fund domain email (Gmail/Yahoo addresses are excluded per NobleStride
          policy).
        </p>
      )}
    </div>
  );
}
