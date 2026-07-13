"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    LuaPop?: {
      init: (config: Record<string, unknown>) => void;
      destroy?: () => void;
    };
  }
}

const SCRIPT_SRC = "https://lua-ai-global.github.io/lua-pop/lua-pop.umd.js";

/**
 * Lua chat widget (summary agent). Rendered only inside the authenticated
 * (crm) shell — the layout redirects anonymous visitors before this mounts.
 * LuaPop injects its UI into document.body (#lua-shadow-root), so the effect
 * cleanup must tear it down or it would survive client-side navigation out
 * of the shell (e.g. logout landing on /login).
 */
export function LuaPopWidget({ agentId }: { agentId: string }) {
  useEffect(() => {
    let cancelled = false;
    const init = () => {
      if (cancelled) return;
      window.LuaPop?.init({
        agentId,
        position: "bottom-right",
        chatTitle: "NobleStride Assistant",
      });
    };

    if (window.LuaPop) {
      init();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
      script.addEventListener("load", init);
    }

    return () => {
      cancelled = true;
      window.LuaPop?.destroy?.();
      document.getElementById("lua-shadow-root")?.remove();
    };
  }, [agentId]);
  return null;
}
