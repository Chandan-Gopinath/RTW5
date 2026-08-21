// Admin model switcher — injected into the top bar on the app pages.
// For now: no auth, per-browser choice saved in localStorage ('ygiModel') and
// sent with each draft/grade request. When the DB + real auth land, this becomes
// an admin-gated, server-side global setting. Deliberately only switches the
// grading/draft model — it exposes no user data, so it's safe to ship ungated.
(function () {
  const KEY = "ygiModel";
  const DEFAULT = "gemini";
  // read anywhere via window.ygiGetModel()
  window.ygiGetModel = () => localStorage.getItem(KEY) || DEFAULT;

  const FALLBACK_MODELS = [
    { id: "gemini", label: "Gemini 3.6 Flash", live: false },
    { id: "groq-20b", label: "GPT-OSS 20B", live: false },
    { id: "groq-120b", label: "GPT-OSS 120B", live: false },
  ];

  function render(models) {
    const list = document.getElementById("adminModelList");
    if (!list) return;
    const cur = window.ygiGetModel();
    list.innerHTML = models.map((m) => `
      <label class="admin-model ${m.id === cur ? "is-active" : ""}">
        <input type="radio" name="ygiModel" value="${m.id}" ${m.id === cur ? "checked" : ""}>
        <span class="admin-model__name">${m.label}</span>
        <span class="admin-model__badge ${m.live ? "is-live" : "is-demo"}">${m.live ? "live" : "demo"}</span>
      </label>`).join("");
    list.querySelectorAll('input[name="ygiModel"]').forEach((r) =>
      r.addEventListener("change", () => {
        localStorage.setItem(KEY, r.value);
        render(models);
        if (window.track) window.track("Model Switched", { model: r.value });
      })
    );
  }

  async function loadModels() {
    let models = FALLBACK_MODELS, def = DEFAULT;
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (data && Array.isArray(data.models)) { models = data.models; def = data.default || DEFAULT; }
    } catch (e) { /* keep fallback (all demo) — e.g. offline / static host */ }
    // if the saved choice is no longer offered (e.g. a model was renamed), reset
    if (!models.some((m) => m.id === window.ygiGetModel())) localStorage.setItem(KEY, def);
    render(models);
  }

  function wireToggle(wrap) {
    const chip = wrap.querySelector("#adminChip");
    const menu = wrap.querySelector("#adminMenu");
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle("open");
      chip.setAttribute("aria-expanded", open);
    });
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && !chip.contains(e.target)) {
        menu.classList.remove("open");
        chip.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { menu.classList.remove("open"); chip.setAttribute("aria-expanded", "false"); }
    });
  }

  function mount() {
    const anchor = document.querySelector(".topbar__user");
    if (!anchor || document.querySelector(".admin-menu-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "admin-menu-wrap";
    wrap.innerHTML = `
      <button class="admin-chip" id="adminChip" aria-haspopup="true" aria-expanded="false" aria-controls="adminMenu">
        <span class="admin-chip__label">Admin</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="admin-menu" id="adminMenu" role="menu">
        <div class="admin-menu__head">Grading model<span class="admin-menu__note">applies to draft + grading</span></div>
        <div class="admin-menu__list" id="adminModelList">Loading…</div>
        <div class="admin-menu__foot">No sign-in yet — this switch is local to your browser.</div>
      </div>`;
    anchor.parentNode.insertBefore(wrap, anchor);
    wireToggle(wrap);
    loadModels();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
