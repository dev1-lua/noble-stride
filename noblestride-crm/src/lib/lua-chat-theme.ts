// lua-chat-theme.ts — makes the embedded LuaPop webchat match the CRM's light
// design language. Shared by the staff /assistant embed and the public
// talk-to-us embed (both build an iframe srcdoc around the LuaPop UMD bundle).
//
// Why this exists: LuaPop's init() config has no theme options. Its UI is
// shadcn-tokened (CSS variables on :root/:host inside an OPEN shadow root) and
// it flips a `.dark` class from the OS `prefers-color-scheme` — which is why
// the widget rendered near-black for anyone on a dark-mode machine while the
// CRM around it stayed light. Two-part fix, both injected into the srcdoc:
//
//  1. LUA_CHAT_FORCE_LIGHT_SCRIPT — runs BEFORE the LuaPop bundle loads and
//     stubs matchMedia so `(prefers-color-scheme: dark)` never matches. The
//     widget then always renders its light theme, like the app around it.
//  2. LUA_CHAT_THEME_SCRIPT — waits for the widget's open shadow root and
//     appends a <style> overriding the few brand tokens that still clash:
//     LuaPop's violet brand/ring → CRM emerald, Onest → Inter. A `.dark`
//     re-pin is included as a safety net in case a future bundle applies dark
//     through some other path.
//
// Accepted trade-off: the bundle URL is unversioned, so a future LuaPop UI
// rewrite could ignore these tokens — failure mode is cosmetic only (widget
// falls back toward its own styling but keeps working).
//
// Both snippets are embedded inside srcdoc template literals: keep them free
// of backticks and ${ } sequences.

// CRM tokens (globals.css): --accent #059669, hover #047857, borders #e9ecef.
const ACCENT = "#059669";
const ACCENT_HOVER = "#047857";

const THEME_CSS = [
  // Brand alignment — LuaPop's violet → CRM emerald; Onest → Inter (the
  // bundle already loads Inter from Google Fonts, so the face is available).
  ":host{font-family:Inter,ui-sans-serif,system-ui,sans-serif}",
  `:host,.dark{--brand:${ACCENT};--brand-foreground:#ffffff;--ring:${ACCENT};--primary:${ACCENT};--primary-foreground:#ffffff;--radius:0.5rem}`,
  // Safety net: if a `.dark` class ever appears despite the matchMedia stub,
  // re-pin the surface tokens to the light palette so the embed never goes
  // black inside the light CRM.
  ".dark{--background:#ffffff;--foreground:#212529;--card:#ffffff;--card-foreground:#212529;--popover:#ffffff;--popover-foreground:#212529;--secondary:#f8f9fa;--secondary-foreground:#212529;--muted:#f8f9fa;--muted-foreground:#868e96;--accent:#f1f3f5;--accent-foreground:#212529;--border:#e9ecef;--input:#e9ecef;--sidebar:#f8f9fa;--sidebar-foreground:#212529}",
  `a{color:${ACCENT}}a:hover{color:${ACCENT_HOVER}}`,
].join("\n");

export const LUA_CHAT_FORCE_LIGHT_SCRIPT = `
  // LuaPop themes itself from the OS prefers-color-scheme; the CRM is always
  // light, so pin the widget to light before the bundle can ask.
  (function () {
    var originalMatchMedia = window.matchMedia;
    window.matchMedia = function (query) {
      if (typeof query === "string" && query.indexOf("prefers-color-scheme") !== -1) {
        return {
          matches: query.indexOf("dark") === -1,
          media: query,
          onchange: null,
          addListener: function () {},
          removeListener: function () {},
          addEventListener: function () {},
          removeEventListener: function () {},
          dispatchEvent: function () { return false; },
        };
      }
      return originalMatchMedia.call(window, query);
    };
  })();
`;

export const LUA_CHAT_THEME_SCRIPT = `
  // Retone LuaPop to the CRM design language. Its UI lives in an OPEN shadow
  // root and is driven by shadcn-style CSS variables, so appending one <style>
  // of token overrides is enough — no reaching into its (hashed) classes.
  (function () {
    var css = ${JSON.stringify(THEME_CSS)};
    function inject() {
      var host = document.querySelector(".lua-pop-embedded");
      var root = host && host.shadowRoot;
      if (!root) return false;
      if (!root.querySelector("style[data-ns-theme]")) {
        var style = document.createElement("style");
        style.setAttribute("data-ns-theme", "");
        style.textContent = css;
        root.appendChild(style);
        // Re-append if the widget ever rebuilds its shadow content.
        new MutationObserver(function () {
          if (!root.querySelector("style[data-ns-theme]")) root.appendChild(style);
        }).observe(root, { childList: true });
      }
      return true;
    }
    var tries = 0;
    var timer = setInterval(function () {
      if (inject() || ++tries > 100) clearInterval(timer);
    }, 150);
  })();
`;
