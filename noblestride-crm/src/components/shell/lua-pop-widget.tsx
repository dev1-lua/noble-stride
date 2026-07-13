"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    LuaPop?: { init: (config: Record<string, unknown>) => void };
  }
}

const SCRIPT_SRC = "https://lua-ai-global.github.io/lua-pop/lua-pop.umd.js";

/**
 * Lua chat widget (summary agent). Rendered only inside the authenticated
 * (crm) shell — the layout redirects anonymous visitors before this mounts.
 */
export function LuaPopWidget({ agentId }: { agentId: string }) {
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      window.LuaPop?.init({
        agentId,
        position: "bottom-right",
        chatTitle: "NobleStride Assistant",
      });
    };
    document.body.appendChild(script);
  }, [agentId]);
  return null;
}
