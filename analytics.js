// Lightweight analytics helper for You Got It!
// Plausible auto-tracks pageviews. This adds custom goal events:
//  - window.track(name, props) fires a Plausible custom event (no-op until
//    the Plausible script has loaded, so it's safe locally / in demo mode).
//  - any element with a data-event="Name" attribute fires that event on click.
// Per-user metrics (points, retry-improvement) are handled server-side via the
// DB later — Plausible is anonymous / aggregate only.
window.track = function (name, props) {
  if (typeof window.plausible === "function") {
    window.plausible(name, props ? { props } : undefined);
  }
};

document.addEventListener("click", function (e) {
  const el = e.target.closest("[data-event]");
  if (el) window.track(el.getAttribute("data-event"));
});

// Reminder click-through: deep-links in the daily/weekly emails carry ?src=daily
// or ?src=weekly. Fire the goal on landing (email opens can't reach Plausible).
(function () {
  try {
    const src = new URLSearchParams(window.location.search).get("src");
    if (src === "daily" || src === "weekly") {
      window.track("Reminder Clicked", { type: src });
    }
  } catch (_) { /* no-op */ }
})();
