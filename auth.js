// Real server-session auth for the You Got It! app pages. Replaces the old
// localStorage "fake profile". Pages call ygiRequireProfile() on load.
async function ygiRequireProfile() {
  let user;
  try {
    const r = await fetch("/api/auth/me");
    if (!r.ok) throw new Error("unauthenticated");
    ({ user } = await r.json());
  } catch (_) {
    window.location.href = "index.html";
    return null;
  }
  const initial = (user.name || "?").charAt(0).toUpperCase();
  document.querySelectorAll(".name").forEach((el) => { el.textContent = `Welcome, ${user.name}`; });
  document.querySelectorAll(".avatar").forEach((el) => { el.textContent = initial; });
  document.querySelectorAll(".user-menu__head strong").forEach((el) => { el.textContent = user.name; });
  document.querySelectorAll("[data-profile-name]").forEach((el) => { el.textContent = user.name; });

  const signOut = document.getElementById("signOutBtn");
  if (signOut) signOut.addEventListener("click", async (e) => {
    e.preventDefault();
    if (window.track) window.track("Sign Out");
    try { await fetch("/api/auth/signout", { method: "POST" }); } catch (_) {}
    window.location.href = "index.html";
  });

  return user;
}
