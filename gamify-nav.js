// Fills the top-nav points/level chip from the shared progress cache
// (instant from cache, then refreshed) via ygiOnProgress. No-op if the chip
// isn't on the page or the user isn't signed in.
(function () {
  function fill(p) {
    var chip = document.getElementById("navGamify");
    if (!chip) return;
    var lvl = document.getElementById("navGamifyLevel");
    var pts = document.getElementById("navGamifyPts");
    var ch = document.getElementById("navGamifyChar");
    if (lvl) lvl.textContent = p.level;
    if (pts) pts.textContent = p.points;
    if (ch && window.buddySvg) ch.innerHTML = window.buddySvg(p.character, 24);
    chip.hidden = false;
  }
  if (window.ygiOnProgress) window.ygiOnProgress(function (p) { fill(p); });
})();
