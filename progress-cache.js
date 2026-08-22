// One cached /api/progress fetch shared across the page (stale-while-revalidate).
// Consumers register with ygiOnProgress(fn): fn(progress, isStale) is called
// immediately with the cached value (if any, isStale=true), then again with the
// fresh value once the network responds (isStale=false). Fixes the late pop-in.
(function () {
  var CACHE_KEY = "ygiProgress";
  var cbs = [];
  var fresh = null;

  function cached() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (_) { return null; }
  }

  window.ygiSetProgressCache = function (p) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(p)); } catch (_) {}
  };

  window.ygiOnProgress = function (fn) {
    cbs.push(fn);
    if (fresh) { fn(fresh, false); return; }
    var c = cached();
    if (c) fn(c, true);
  };

  fetch("/api/progress")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.progress) return;
      fresh = d.progress;
      window.ygiSetProgressCache(fresh);
      cbs.forEach(function (fn) { fn(fresh, false); });
    })
    .catch(function () {});
})();
