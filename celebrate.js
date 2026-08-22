// Shared confetti burst into a container (used by the desk level-up banner).
// Respects prefers-reduced-motion. Styles/keyframes live in styles.css.
(function () {
  window.ygiConfetti = function (container) {
    if (!container) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    container.classList.add("ygi-confetti");
    container.innerHTML = "";
    var cols = ["#EFE84B", "#FCFCFA", "#2E8B52", "#ffffff"];
    for (var i = 0; i < 26; i++) {
      var s = document.createElement("i");
      var ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 160;
      s.style.setProperty("--dx", (Math.cos(ang) * dist) + "px");
      s.style.setProperty("--dy", (Math.sin(ang) * dist + 40) + "px");
      s.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
      s.style.background = cols[i % cols.length];
      s.style.animationDelay = (Math.random() * 0.12) + "s";
      container.appendChild(s);
    }
    setTimeout(function () { container.innerHTML = ""; }, 1400);
  };
})();
