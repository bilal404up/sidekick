/* Sidekick embed: a brass drawer-pull chat button that opens the assistant in a frame.
   The button and frame live in a shadow root, so the host page's CSS cannot restyle them. */
(function () {
  if (window.__sidekickLoaded) return;
  window.__sidekickLoaded = true;

  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : window.location.origin;
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var css = [
    ":host{all:initial}",
    ".sk-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 12px 0 10px;border:0;border-radius:8px;background:#3A2819;color:#FFFDF6;font:400 17px/1 Georgia,'Times New Roman',serif;cursor:pointer;outline:2px solid transparent;box-shadow:inset 0 -3px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.08),0 10px 24px rgba(20,12,6,.35)}",
    ".sk-btn:hover{background:#4A3421}",
    /* Two-tone ring: cream next to the oak button, oak outside it, visible on light and dark host pages. */
    ".sk-btn:focus-visible{box-shadow:0 0 0 2px #FFFDF6,0 0 0 5px #3A2819,0 10px 24px rgba(20,12,6,.35)}",
    ".sk-label{position:relative;display:inline-flex;align-items:center;height:30px;padding:0 16px;border:1.5px solid #C9A35B;border-radius:3px;background:rgba(0,0,0,.14)}",
    ".sk-label::before,.sk-label::after{content:'';position:absolute;top:50%;width:4px;height:4px;margin-top:-2px;border-radius:50%;background:#C9A35B}",
    ".sk-label::before{left:5px}",
    ".sk-label::after{right:5px}",
    ".sk-pull{display:block;width:28px;height:16px}",
    ".sk-frame{position:fixed;right:20px;bottom:84px;z-index:2147483000;width:380px;max-width:calc(100vw - 24px);height:560px;max-height:calc(100vh - 104px);border:1px solid #5E4530;border-radius:12px;background:#E3D3AE;box-shadow:0 1px 0 #5E4530,0 28px 44px -20px rgba(15,9,4,.7);display:none;opacity:0;transform:translateY(14px)}",
    ".sk-frame.is-open{opacity:1;transform:none}",
    "@media (prefers-reduced-motion:no-preference){.sk-frame{transition:opacity 200ms ease-out,transform 220ms cubic-bezier(.2,.8,.2,1)}.sk-pull{transition:transform 150ms ease-out}.sk-btn:hover .sk-pull{transform:translateY(2px)}.sk-btn[aria-expanded='true'] .sk-pull{transform:translateY(3px)}}",
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

  var label = document.createElement("span");
  label.className = "sk-label";
  label.textContent = "Chat";
  button.appendChild(label);
  button.insertAdjacentHTML(
    "beforeend",
    '<svg class="sk-pull" viewBox="0 0 28 16" aria-hidden="true" focusable="false">' +
      '<path d="M2 3h24" stroke="#8C6A2C" stroke-width="2.5" stroke-linecap="round" fill="none"/>' +
      '<path d="M5 3c0 7 4 11 9 11s9-4 9-11" fill="#C9A35B" stroke="#8C6A2C" stroke-width="1.5" stroke-linejoin="round"/>' +
      "</svg>"
  );

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
