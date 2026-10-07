/* Sidekick embed: adds a chat button that opens the assistant in a frame. */
(function () {
  if (window.__sidekickLoaded) return;
  window.__sidekickLoaded = true;

  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : window.location.origin;

  var button = document.createElement("button");
  button.type = "button";
  button.textContent = "Chat";
  button.setAttribute("aria-label", "Open chat");
  button.setAttribute("aria-expanded", "false");
  button.style.cssText =
    "position:fixed;right:20px;bottom:20px;z-index:2147483000;height:48px;padding:0 20px;border:0;border-radius:6px;" +
    "background:#0F6B4F;color:#fff;font:600 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(16,35,28,.25)";

  var frame = document.createElement("iframe");
  frame.title = "Chat with the shop assistant";
  frame.setAttribute("loading", "lazy");
  frame.style.cssText =
    "position:fixed;right:20px;bottom:80px;z-index:2147483000;width:380px;max-width:calc(100vw - 24px);height:560px;" +
    "max-height:calc(100vh - 100px);border:1px solid #10231C;border-radius:10px;background:#fff;display:none;box-shadow:0 8px 24px rgba(16,35,28,.25)";

  var opened = false;
  function toggle() {
    opened = !opened;
    if (opened && !frame.src) frame.src = origin + "/widget";
    frame.style.display = opened ? "block" : "none";
    button.textContent = opened ? "Close" : "Chat";
    button.setAttribute("aria-expanded", String(opened));
    button.setAttribute("aria-label", opened ? "Close chat" : "Open chat");
  }
  button.addEventListener("click", toggle);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && opened) toggle();
  });

  document.body.appendChild(frame);
  document.body.appendChild(button);
})();
