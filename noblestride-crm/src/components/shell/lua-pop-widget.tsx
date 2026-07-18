"use client";

import { useEffect, useState } from "react";

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

export interface LuaAgentChoice {
  key: string;
  /** Short label shown in the agent switcher pill. */
  label: string;
  /** Title shown in the LuaPop chat header. */
  chatTitle: string;
  agentId: string;
  channelId?: string;
}

/**
 * Lua chat widget(s). Rendered only inside the authenticated (crm) shell —
 * the layout redirects anonymous visitors before this mounts. When more than
 * one agent is configured, a small switcher pill lets staff flip between
 * them; switching tears down LuaPop and re-inits with the selected agent
 * (LuaPop supports a single live instance per page).
 * LuaPop injects its UI into document.body (#lua-shadow-root), so the effect
 * cleanup must tear it down or it would survive client-side navigation out
 * of the shell (e.g. logout landing on /login).
 */
export function LuaPopWidget({ agents }: { agents: LuaAgentChoice[] }) {
  const [activeKey, setActiveKey] = useState(agents[0]?.key);
  const agent = agents.find((a) => a.key === activeKey) ?? agents[0];

  useEffect(() => {
    if (!agent) return;
    let cancelled = false;

    const isDevHost = typeof window !== "undefined" && DEV_HOSTS.has(window.location.hostname);
    const restoreShim = isDevHost && agent.channelId ? installDevChannelShim(agent.channelId) : undefined;

    const init = () => {
      if (cancelled) return;
      window.LuaPop?.init({
        agentId: agent.agentId,
        // Passed for forward-compat; current public bundle ignores it on dev
        // domains, which is why installDevChannelShim() exists.
        ...(agent.channelId ? { channelIdentifier: agent.channelId } : {}),
        position: "bottom-right",
        chatTitle: agent.chatTitle,
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
  }, [agent]);

  if (agents.length < 2) return null;

  return (
    // Sits just above LuaPop's bottom-right launcher bubble.
    <div className="fixed bottom-24 right-5 z-40 flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-1 shadow-[var(--shadow-card)]">
      {agents.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={() => setActiveKey(a.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            a.key === agent?.key
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
