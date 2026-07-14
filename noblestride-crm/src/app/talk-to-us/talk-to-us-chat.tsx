"use client";

// Hosts LuaPop inside an isolated iframe (srcdoc). A fresh sessionId is
// generated per mount so shared/public computers never resume a stranger's
// conversation; "New chat" just regenerates it (remounting the iframe).

import { useEffect, useState } from "react";

const LUA_POP_SRC = "https://lua-ai-global.github.io/lua-pop/lua-pop.umd.js";

function newSessionId(): string {
  return `web-${crypto.randomUUID()}`;
}

function buildSrcdoc(agentId: string, sessionId: string, channelId: string, websiteHost: string): string {
  const config = {
    agentId,
    sessionId,
    environment: "production",
    displayMode: "embedded",
    embeddedDisplayConfig: {
      targetContainerId: "lua-chat-embedded-root",
      useContainerHeight: true,
      conversationStarters: [
        "We're raising capital and want NobleStride's help",
        "I'd like to tell you about our company",
        "We're an existing client with an update",
      ],
    },
    attachmentsEnabled: true,
    chatTitle: "NobleStride",
    chatInputPlaceholder: "Tell us about your company…",
    welcomeMessage:
      "Welcome to NobleStride Capital — we help established African companies raise growth capital. Tell me a little about your company and what you're looking to raise, and I'll make sure the right person on our team follows up.",
  };
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="color-scheme" content="light" />
<style>
  html, body { height: 100%; margin: 0; }
  body { background: transparent; }
  #lua-chat-embedded-root { height: 100%; width: 100%; }
</style>
</head>
<body>
<div id="lua-chat-embedded-root"></div>
<script>
  // Inside an iframe-srcdoc, window.location.hostname is "" — so LuaPop's
  // webchat/config call goes out with an empty website param and 400s, no
  // webchat auth is established, and every chat call after it 401s. Same
  // class of workaround as the CRM shell's LuaPopWidget dev shim: patch XHR
  // (LuaPop uses axios/XHR) to (a) fill the empty website param with the
  // parent page's hostname and (b) attach the webchat channel identifier.
  (function () {
    var channelId = ${JSON.stringify(channelId)};
    var websiteHost = ${JSON.stringify(websiteHost)};
    var LUA_URL = /api\\.(heylua\\.ai|lua\\.dev)\\/(webchat\\/config|chat\\/)/;
    function rewrite(url) {
      try {
        if (typeof url === "string" && LUA_URL.test(url)) {
          var u = new URL(url);
          if (websiteHost && u.searchParams.has("website") && !u.searchParams.get("website")) {
            u.searchParams.set("website", websiteHost);
          }
          if (channelId && !u.searchParams.has("channelIdentifier")) {
            u.searchParams.set("channelIdentifier", channelId);
          }
          return u.toString();
        }
      } catch (e) {}
      return url;
    }
    var originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      args[1] = rewrite(url);
      return originalOpen.apply(this, args);
    };
    // LuaPop streams chat responses via fetch(), not XHR — patch both.
    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        if (typeof input === "string") {
          input = rewrite(input);
        } else if (input && typeof input.url === "string") {
          var rewritten = rewrite(input.url);
          if (rewritten !== input.url) input = new Request(rewritten, input);
        }
      } catch (e) {}
      return originalFetch.call(this, input, init);
    };
  })();
  window.__LUA_BOOT = function () {
    try { window.LuaPop && window.LuaPop.init(${JSON.stringify(config)}); }
    catch (e) { console.error("LuaPop init failed", e); }
  };
</script>
<script src="${LUA_POP_SRC}" onload="window.__LUA_BOOT()"></script>
</body>
</html>`;
}

export function TalkToUsChat({ agentId, channelId = "" }: { agentId: string; channelId?: string }) {
  // Generated client-side only: crypto.randomUUID() during SSR would produce
  // a different srcdoc on the server than on the client (hydration mismatch).
  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => setSessionId(newSessionId()), []);

  if (!agentId) {
    return (
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-8 text-center text-sm text-[var(--text-secondary)]">
        Chat is not configured. Please use the{" "}
        <a href="/intake" className="font-medium text-[var(--accent)] hover:underline">
          application form
        </a>{" "}
        instead.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setSessionId(newSessionId())}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          + New chat
        </button>
      </div>
      <div className="min-h-[560px] flex-1 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        {sessionId && (
          <iframe
            key={sessionId}
            srcDoc={buildSrcdoc(agentId, sessionId, channelId, typeof window !== "undefined" ? window.location.hostname : "")}
            title="Chat with NobleStride"
            className="h-full w-full border-0"
            allow="microphone; clipboard-write"
            // ACCEPTED RISK (2026-07-14 review): no sandbox attribute, so this
            // srcdoc iframe shares the CRM origin with the third-party LuaPop
            // UMD bundle (supply-chain XSS exposure). sandbox without
            // allow-same-origin was tried and breaks the widget (it requires
            // localStorage and derives its `website` param from the origin),
            // and sandbox WITH allow-same-origin is a no-op. Mitigation plan:
            // host this embed on a separate origin (e.g. chat.noblestride.com)
            // before production launch.
          />
        )}
      </div>
    </div>
  );
}
