// Adds an "Admin" link to the top nav — only for admin users. The admin
// controls (global model switch + users view) live on admin.html.
(function () {
  function addLink(nav) {
    if (!nav || nav.querySelector('a[href="admin.html"]')) return;
    const a = document.createElement("a");
    a.href = "admin.html";
    a.textContent = "Admin";
    nav.appendChild(a);
  }
  async function mount() {
    let isAdmin = false;
    try { isAdmin = Boolean((await (await fetch("/api/auth/me")).json())?.user?.isAdmin); } catch (_) {}
    if (!isAdmin) return;
    document.querySelectorAll(".topbar__nav").forEach(addLink);
    document.querySelectorAll(".mobile-nav").forEach(addLink);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
