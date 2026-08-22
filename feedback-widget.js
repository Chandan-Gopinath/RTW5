// Shared feedback widget. Two uses:
//   window.ygiFeedback(container, context) — mount an inline widget (e.g. the
//     AIGround reveal step, context "grade:<taskId>").
//   Auto: injects a "Send feedback" item into the account menu (#userMenu) on
//     every app page and opens a small popover hosting the same widget.
// Posts to /api/feedback and fires the "Feedback Submitted" analytics goal.
(function () {
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  // Build a fresh widget element bound to `context`. `onDone` fires after a
  // successful send (used to auto-close the popover).
  function buildWidget(context, onDone) {
    const root = el("div", "fbw");
    root.innerHTML = `
      <p class="fbw__q">Was this helpful?</p>
      <div class="fbw__rate" role="group" aria-label="Rate this">
        <button type="button" class="fbw__thumb" data-r="up" aria-label="Thumbs up">👍</button>
        <button type="button" class="fbw__thumb" data-r="down" aria-label="Thumbs down">👎</button>
      </div>
      <input type="text" class="fbw__note" maxlength="1000" placeholder="Add a note (optional)" hidden>
      <div class="fbw__actions" hidden><button type="button" class="fbw__send">Send</button></div>
      <p class="fbw__thanks" hidden>Thanks — got it 🙌</p>`;

    let rating = null;
    const thumbs = root.querySelectorAll(".fbw__thumb");
    const note = root.querySelector(".fbw__note");
    const actions = root.querySelector(".fbw__actions");
    const sendBtn = root.querySelector(".fbw__send");

    thumbs.forEach((t) => t.addEventListener("click", () => {
      rating = t.getAttribute("data-r");
      thumbs.forEach((x) => x.classList.toggle("is-on", x === t));
      note.hidden = false;
      actions.hidden = false;
      note.focus();
    }));

    sendBtn.addEventListener("click", async () => {
      if (!rating) return;
      sendBtn.disabled = true;
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context, rating, message: note.value }),
        });
        if (!res.ok) throw new Error("failed");
        if (window.track) window.track("Feedback Submitted", { context, rating });
        root.querySelector(".fbw__q").hidden = true;
        root.querySelector(".fbw__rate").hidden = true;
        note.hidden = true;
        actions.hidden = true;
        root.querySelector(".fbw__thanks").hidden = false;
        if (onDone) setTimeout(onDone, 1200);
      } catch (_) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Try again";
      }
    });

    return root;
  }

  window.ygiFeedback = function (container, context) {
    if (!container) return;
    container.innerHTML = "";
    container.appendChild(buildWidget(context || "unknown"));
  };

  // ---- account-menu integration ----
  function injectMenuItem() {
    const menu = document.getElementById("userMenu");
    const signOut = document.getElementById("signOutBtn");
    if (!menu || document.getElementById("fbwMenuItem")) return;

    const item = el("button", "user-menu__item", `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Send feedback</span>`);
    item.id = "fbwMenuItem";
    item.type = "button";
    item.setAttribute("role", "menuitem");
    if (signOut) menu.insertBefore(item, signOut);
    else menu.appendChild(item);

    // a lightweight popover, created once
    const pop = el("div", "fbw-pop");
    pop.hidden = true;
    document.body.appendChild(pop);

    function close() { pop.hidden = true; }
    function open() {
      window.ygiFeedback(pop, "menu");
      pop.hidden = false;
    }
    item.addEventListener("click", (e) => {
      e.preventDefault();
      pop.hidden ? open() : close();
    });
    document.addEventListener("click", (e) => {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== item && !item.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectMenuItem);
  } else {
    injectMenuItem();
  }
})();
