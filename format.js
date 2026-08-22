// Shared date formatting — dd/mm/yyyy across the app.
(function () {
  window.ygiFmtDate = function (d) {
    if (!d) return "—";
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(dt.getDate()) + "/" + p(dt.getMonth() + 1) + "/" + dt.getFullYear();
  };
})();
