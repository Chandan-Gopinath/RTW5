// Adds an "Admin" link to the top nav — only for admin users. Renders instantly
// from a cached flag (no late pop-in for returning admins), then revalidates against
// the server. The admin controls live on admin.html.
(function () {
  function addLink(nav) {
    if (!nav || nav.querySelector('a[href="admin.html"]')) return;
    const a = document.createElement("a");
    a.href = "admin.html";
    a.textContent = "Admin";
    nav.appendChild(a);
  }
  function apply(isAdmin) {
    if (!isAdmin) return;
    document.querySelectorAll(".topbar__nav").forEach(addLink);
    document.querySelectorAll(".mobile-nav").forEach(addLink);
  }
  // 1) instant, from the cached flag — no flicker for returning admins
  try { if (localStorage.getItem("ygiIsAdmin") === "1") apply(true); } catch (_) {}
  // 2) confirm/refresh from the server
  (async function () {
    let isAdmin;
    try { isAdmin = Boolean((await (await fetch("/api/auth/me")).json())?.user?.isAdmin); } catch (_) { return; }
    try { localStorage.setItem("ygiIsAdmin", isAdmin ? "1" : "0"); } catch (_) {}
    apply(isAdmin);
  })();
})();
