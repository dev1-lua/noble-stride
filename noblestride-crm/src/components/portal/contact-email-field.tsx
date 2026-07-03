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
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      {FREE_MAIL.test(value) && (
        <p className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          Please use a fund domain email (Gmail/Yahoo addresses are excluded per NobleStride
          policy).
        </p>
      )}
    </div>
  );
}
