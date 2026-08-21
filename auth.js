// Shared local "fake" profile helpers for the You Got It! prototype.
// No server, no real accounts — just a name + 4-digit code kept in
// localStorage on this device (explicitly not a password, no recovery).
const YGI_PROFILE_KEY = "ygiProfile";

function ygiSaveProfile(name, code) {
  localStorage.setItem(YGI_PROFILE_KEY, JSON.stringify({ name, code }));
}

function ygiGetProfile() {
  try {
    return JSON.parse(localStorage.getItem(YGI_PROFILE_KEY));
  } catch {
    return null;
  }
}

function ygiClearProfile() {
  localStorage.removeItem(YGI_PROFILE_KEY);
}

// Fills the shared app chrome (welcome name, avatar initial, account menu)
// and any [data-profile-name] elements from the stored profile. Redirects to
// sign-in if this device has no profile yet. Wires the sign-out link, if present.
function ygiRequireProfile() {
  const profile = ygiGetProfile();
  if (!profile || !profile.name) {
    window.location.href = "index.html";
    return null;
  }
  const initial = profile.name.charAt(0).toUpperCase();
  document.querySelectorAll(".name").forEach((el) => { el.textContent = `Welcome, ${profile.name}`; });
  document.querySelectorAll(".avatar").forEach((el) => { el.textContent = initial; });
  document.querySelectorAll(".user-menu__head strong").forEach((el) => { el.textContent = profile.name; });
  document.querySelectorAll("[data-profile-name]").forEach((el) => { el.textContent = profile.name; });

  const signOut = document.getElementById("signOutBtn");
  if (signOut) signOut.addEventListener("click", ygiClearProfile);

  return profile;
}
