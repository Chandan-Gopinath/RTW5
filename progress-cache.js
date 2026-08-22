// One cached /api/progress fetch shared across the page (stale-while-revalidate).
// Consumers register with ygiOnProgress(fn): fn(progress, isStale, tasks) is called
// immediately with the cached value (if any, isStale=true), then again with the
// fresh value once the network responds (isStale=false). `tasks` is the per-task
// completion map ({ [id]: { attempts, passed, lastAt } }); older consumers that take
// only (progress, isStale) keep working.
(function () {
  var CACHE_KEY = "ygiProgress";
  var cbs = [];
  var fresh = null;

  function cached() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (_) { return null; }
  }
  // Tolerate the legacy cache shape (a bare progress object) as well as the new
  // { progress, tasks } payload.
  function norm(v) {
    if (!v) return null;
    if (v.progress) return { progress: v.progress, tasks: v.tasks || {} };
    return { progress: v, tasks: {} };
  }
  function emit(fn, payload, isStale) { fn(payload.progress, isStale, payload.tasks); }

  window.ygiSetProgressCache = function (payload) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch (_) {}
  };

  window.ygiOnProgress = function (fn) {
    cbs.push(fn);
    if (fresh) { emit(fn, fresh, false); return; }
    var c = norm(cached());
    if (c) emit(fn, c, true);
  };

  fetch("/api/progress")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.progress) return;
      fresh = { progress: d.progress, tasks: d.tasks || {} };
      window.ygiSetProgressCache(fresh);
      cbs.forEach(function (fn) { emit(fn, fresh, false); });
    })
    .catch(function () {});
})();
