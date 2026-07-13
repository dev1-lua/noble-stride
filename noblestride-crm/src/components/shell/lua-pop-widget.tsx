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

const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/**
 * On a development domain the LuaPop webchat API requires the channel
 * identifier as a query param (`webchat/config` and `chat/*` return 400/401
 * without it), but the public LuaPop bundle never attaches it from init
 * config. This patches XMLHttpRequest.open to append `channelIdentifier` to
 * Lua webchat/chat requests that lack it, so the widget works on localhost.
 * Scoped to dev hosts only — it is inert once served from a real domain, where
 * LuaPop resolves the channel from the allowed-websites config instead.
 * Returns a restore function.
 */
function installDevChannelShim(channelId: string): () => void {
  const proto = XMLHttpRequest.prototype;
  const original = proto.open;
  const LUA_URL = /api\.(heylua\.ai|lua\.dev)\/(webchat\/config|chat\/)/;
  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    try {
      if (typeof url === "string" && LUA_URL.test(url) && !url.includes("channelIdentifier=")) {
        url += (url.includes("?") ? "&" : "?") + "channelIdentifier=" + encodeURIComponent(channelId);
      }
    } catch {
      // never let the shim break a request
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (original as any).call(this, method, url, ...rest);
  };
  return () => {
    proto.open = original;
  };
}

/**
 * Lua chat widget (summary agent). Rendered only inside the authenticated
 * (crm) shell — the layout redirects anonymous visitors before this mounts.
 * LuaPop injects its UI into document.body (#lua-shadow-root), so the effect
 * cleanup must tear it down or it would survive client-side navigation out
 * of the shell (e.g. logout landing on /login).
 */
export function LuaPopWidget({ agentId, channelId }: { agentId: string; channelId?: string }) {
  useEffect(() => {
    let cancelled = false;

    const isDevHost = typeof window !== "undefined" && DEV_HOSTS.has(window.location.hostname);
    const restoreShim = isDevHost && channelId ? installDevChannelShim(channelId) : undefined;

    const init = () => {
      if (cancelled) return;
      window.LuaPop?.init({
        agentId,
        // Passed for forward-compat; current public bundle ignores it on dev
        // domains, which is why installDevChannelShim() exists.
        ...(channelId ? { channelIdentifier: channelId } : {}),
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
      restoreShim?.();
    };
  }, [agentId, channelId]);
  return null;
}
