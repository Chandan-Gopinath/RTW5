// Fills the top-nav points/level chip on every app page from /api/progress.
// Silent no-op if not signed in, the endpoint errors, or the chip isn't on the page.
(async function () {
  try {
    const r = await fetch("/api/progress");
    if (!r.ok) return;
    const { progress: p } = await r.json();
    const chip = document.getElementById("navGamify");
    if (!chip) return;
    const lvl = document.getElementById("navGamifyLevel");
    const pts = document.getElementById("navGamifyPts");
    const ch = document.getElementById("navGamifyChar");
    if (lvl) lvl.textContent = p.level;
    if (pts) pts.textContent = p.points;
    if (ch && window.buddySvg) ch.innerHTML = window.buddySvg(p.character, 22);
    chip.hidden = false;
  } catch (_) {}
})();
