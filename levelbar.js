// Shared segmented level bar (design variation C) — renders into `el` from a
// gamification progress object. Used by the desk rail and the Progress page so
// they stay identical.
(function () {
  var SEG = 10;
  window.ygiLevelBar = function (el, p) {
    if (!el || !p) return;
    var atTop = !p.nextLevelAt;
    var into = p.pointsIntoLevel || 0;
    var toNext = p.pointsToNext || 0;
    var band = into + toNext;
    var filled = atTop ? SEG : (band > 0 ? Math.max(0, Math.min(SEG, Math.round((into / band) * SEG))) : 0);
    var segs = "";
    for (var i = 0; i < SEG; i++) segs += '<i class="' + (i < filled ? "on" : "") + '"></i>';
    var frac = atTop ? "Max level" : (into + " / " + band + " pts");
    var next = atTop
      ? "🎉 You've reached the top"
      : (toNext + " to go → <b>" + (p.nextLevelName || ("Level " + (p.level + 1))) + "</b>");
    el.innerHTML =
      '<div class="lvlbar__head"><span class="lvlbar__name">' + p.levelName + "</span>" +
      '<span class="lvlbar__lvl">Level ' + p.level + " · " + p.points + " pts</span></div>" +
      '<div class="lvlbar__seg">' + segs + "</div>" +
      '<div class="lvlbar__foot"><span class="lvlbar__frac">' + frac + "</span>" +
      '<span class="lvlbar__next">' + next + "</span></div>";
  };
})();
