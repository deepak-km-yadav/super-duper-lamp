/**
 * BotForge embed widget.
 *
 * Adds a floating chat bubble to any site. The bot is loaded by slug from the
 * server, so the visitor needs no API key of their own -- which is the whole
 * reason this file exists.
 *
 * Usage:
 *   <script src="https://your-site/embed.js" data-bot-slug="my-bot" defer></script>
 *
 * Optional attributes:
 *   data-color     accent colour for the bubble          (default #0ea5e9)
 *   data-position  "right" | "left"                      (default right)
 *   data-label     accessible label for the bubble       (default "Chat with us")
 *   data-greeting  set to "closed" to not auto-open on desktop
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var slug = script.getAttribute("data-bot-slug");
  if (!slug) {
    console.error("[botforge] embed.js needs a data-bot-slug attribute.");
    return;
  }

  // Only ever mount once, even if the tag is included twice.
  if (window.__botforgeEmbedMounted) return;
  window.__botforgeEmbedMounted = true;

  var origin = new URL(script.src, window.location.href).origin;
  var color = script.getAttribute("data-color") || "#0ea5e9";
  var side = script.getAttribute("data-position") === "left" ? "left" : "right";
  var label = script.getAttribute("data-label") || "Chat with us";

  var chatUrl = origin + "/chatterbox/chat/" + encodeURIComponent(slug) + "?embed=1";

  var host = document.createElement("div");
  host.setAttribute("data-botforge-embed", slug);
  // Shadow DOM so the host page's CSS cannot reach in and break the widget.
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var style = document.createElement("style");
  style.textContent = [
    ":host, * { box-sizing: border-box; }",
    ".wrap {",
    "  position: fixed; bottom: 20px; " + side + ": 20px; z-index: 2147483000;",
    "  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;",
    "}",
    ".bubble {",
    "  width: 56px; height: 56px; border-radius: 9999px; border: 0; cursor: pointer;",
    "  background: " + color + "; color: #fff; display: grid; place-items: center;",
    "  box-shadow: 0 6px 24px rgba(0,0,0,.24); transition: transform .15s ease;",
    "}",
    ".bubble:hover { transform: scale(1.06); }",
    ".bubble:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }",
    ".panel {",
    "  position: fixed; bottom: 88px; " + side + ": 20px;",
    "  width: 400px; height: 600px; max-width: calc(100vw - 32px);",
    "  max-height: calc(100vh - 120px);",
    "  border: 0; border-radius: 16px; overflow: hidden; background: #fff;",
    "  box-shadow: 0 16px 48px rgba(0,0,0,.28);",
    "  opacity: 0; transform: translateY(8px); pointer-events: none;",
    "  transition: opacity .18s ease, transform .18s ease;",
    "}",
    ".panel.open { opacity: 1; transform: translateY(0); pointer-events: auto; }",
    "@media (max-width: 480px) {",
    "  .panel {",
    "    " + side + ": 8px; bottom: 80px; width: calc(100vw - 16px);",
    "    height: calc(100vh - 100px);",
    "  }",
    "}",
    "@media (prefers-reduced-motion: reduce) {",
    "  .bubble, .panel { transition: none; }",
    "}",
  ].join("\n");

  var wrap = document.createElement("div");
  wrap.className = "wrap";

  var iframe = document.createElement("iframe");
  iframe.className = "panel";
  iframe.title = label;
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("allow", "clipboard-write");

  var button = document.createElement("button");
  button.className = "bubble";
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", "false");
  button.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
    "</svg>";

  var open = false;
  var loaded = false;

  function setOpen(next) {
    open = next;
    // The iframe src is set on first open, so an embed that is never used
    // costs the host page nothing.
    if (open && !loaded) {
      iframe.src = chatUrl;
      loaded = true;
    }
    iframe.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  }

  button.addEventListener("click", function () {
    setOpen(!open);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) {
      setOpen(false);
      button.focus();
    }
  });

  wrap.appendChild(iframe);
  wrap.appendChild(button);
  root.appendChild(style);
  root.appendChild(wrap);

  function mount() {
    document.body.appendChild(host);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
