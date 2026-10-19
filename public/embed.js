/* Sidekick embed: adds a chat button that opens the assistant in a frame.
   The button and frame live in a shadow root, so the host page's CSS cannot restyle them. */
(function () {
  if (window.__sidekickLoaded) return;
  window.__sidekickLoaded = true;

  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : window.location.origin;
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var font = "600 15px/1 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  var css = [
    ":host{all:initial}",
    ".sk-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 20px 0 18px;border:0;border-radius:999px;background:#16181B;color:#F5F3EC;font:" +
      font +
      ";cursor:pointer;outline:2px solid transparent;box-shadow:0 1px 2px rgba(22,24,27,.2),0 10px 28px rgba(22,24,27,.24)}",
    ".sk-btn:hover{background:#2A2E33}",
    /* Two-tone ring: white next to the dark button, dark outside it, visible on light and dark host pages. */
    ".sk-btn:focus-visible{box-shadow:0 0 0 2px #FFFFFF,0 0 0 5px #16181B,0 10px 28px rgba(22,24,27,.24)}",
    ".sk-dot{width:8px;height:8px;border-radius:50%;background:#7FBF95;box-shadow:0 0 0 3px rgba(127,191,149,.22)}",
    ".sk-frame{position:fixed;right:20px;bottom:84px;z-index:2147483000;width:380px;max-width:calc(100vw - 24px);height:560px;max-height:calc(100vh - 104px);border:1px solid #DCD8CC;border-radius:8px;background:#FFFFFF;box-shadow:0 1px 2px rgba(22,24,27,.06),0 24px 48px -16px rgba(22,24,27,.28);display:none;opacity:0;transform:translateY(12px) scale(.98);transform-origin:bottom right}",
    ".sk-frame.is-open{opacity:1;transform:none}",
    "@media (prefers-reduced-motion:no-preference){.sk-frame{transition:opacity 180ms ease-out,transform 220ms cubic-bezier(.2,.8,.2,1)}.sk-btn{transition:background-color 150ms}}",
    "@media (max-width:420px){.sk-btn{right:12px;bottom:12px}.sk-frame{right:12px;bottom:76px;max-height:calc(100vh - 92px)}}",
    "@media (forced-colors:active){.sk-btn{border:2px solid ButtonText}.sk-frame{border:2px solid CanvasText}}",
  ].join("");

  var host = document.createElement("div");
  host.setAttribute("data-sidekick", "");
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var style = document.createElement("style");
  style.textContent = css;
  root.appendChild(style);

  var button = document.createElement("button");
  button.type = "button";
  button.className = "sk-btn";
  button.setAttribute("aria-label", "Open chat");
  button.setAttribute("aria-expanded", "false");
  var dot = document.createElement("span");
  dot.className = "sk-dot";
  dot.setAttribute("aria-hidden", "true");
  var label = document.createElement("span");
  label.textContent = "Chat";
  button.appendChild(dot);
  button.appendChild(label);

  var frame = document.createElement("iframe");
  frame.className = "sk-frame";
  frame.title = "Chat with the shop assistant";
  frame.setAttribute("loading", "lazy");

  var opened = false;
  var hideTimer = 0;

  function setOpen(next, returnFocus) {
    if (next === opened) return;
    opened = next;
    window.clearTimeout(hideTimer);
    if (opened) {
      if (!frame.src) frame.src = origin + "/widget";
      frame.style.display = "block";
      if (reduceMotion) {
        frame.classList.add("is-open");
      } else {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            if (opened) frame.classList.add("is-open");
          });
        });
      }
      frame.focus();
    } else {
      frame.classList.remove("is-open");
      hideTimer = window.setTimeout(function () {
        if (!opened) frame.style.display = "none";
      }, reduceMotion ? 0 : 230);
      if (returnFocus) button.focus();
    }
    label.textContent = opened ? "Close" : "Chat";
    button.setAttribute("aria-expanded", String(opened));
    button.setAttribute("aria-label", opened ? "Close chat" : "Open chat");
  }

  button.addEventListener("click", function () {
    setOpen(!opened, false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && opened) setOpen(false, true);
  });

  // Escape pressed inside the chat frame arrives as a message from the widget page.
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || e.source !== frame.contentWindow) return;
    if (e.data === "sidekick:close" && opened) setOpen(false, true);
  });

  // Button first, so Tab goes from the button into the open chat.
  root.appendChild(button);
  root.appendChild(frame);

  function mount() {
    document.body.appendChild(host);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
