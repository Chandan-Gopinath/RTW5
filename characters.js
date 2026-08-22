// characters.js — the brand-mark "buddy" character per level. Reuses the approved
// mockup art (no new illustration). Loaded by dashboard.html and progress.html.
(function () {
  var BODY = '<rect x="22" y="26" width="56" height="54" rx="16" fill="#18181C"/>';
  var EYES = '<circle cx="40" cy="48" r="5" fill="#FCFCFA"/><circle cx="60" cy="48" r="5" fill="#FCFCFA"/>';
  var SMILE = '<path d="M40 62 Q50 70 60 62" fill="none" stroke="#EFE84B" stroke-width="4" stroke-linecap="round"/>';

  // Each entry returns the inner SVG markup (viewBox 0 0 100 100).
  var PARTS = {
    buddy:    function () { return BODY + EYES + SMILE; },
    antenna:  function () {
      return '<line x1="50" y1="22" x2="50" y2="10" stroke="#18181C" stroke-width="4" stroke-linecap="round"/>' +
             '<circle cx="50" cy="9" r="6" fill="#EFE84B" stroke="#18181C" stroke-width="3"/>' + BODY + EYES + SMILE;
    },
    headband: function () {
      return BODY + EYES + SMILE + '<path d="M26 30 L74 30" stroke="#EFE84B" stroke-width="6" stroke-linecap="round"/>';
    },
    glasses:  function () {
      return BODY +
             '<circle cx="40" cy="48" r="9" fill="none" stroke="#EFE84B" stroke-width="3"/>' +
             '<circle cx="60" cy="48" r="9" fill="none" stroke="#EFE84B" stroke-width="3"/>' +
             '<line x1="49" y1="48" x2="51" y2="48" stroke="#EFE84B" stroke-width="3"/>' +
             '<path d="M40 64 Q50 70 60 64" fill="none" stroke="#EFE84B" stroke-width="4" stroke-linecap="round"/>';
    },
    mittens:  function () {
      return BODY + EYES + SMILE +
             '<circle cx="18" cy="66" r="7" fill="#EFE84B" stroke="#18181C" stroke-width="2"/>' +
             '<circle cx="82" cy="66" r="7" fill="#EFE84B" stroke="#18181C" stroke-width="2"/>';
    },
    crown:    function () {
      return '<path d="M30 22 L38 12 L50 20 L62 12 L70 22 Z" fill="#EFE84B" stroke="#18181C" stroke-width="2.5" stroke-linejoin="round"/>' +
             '<rect x="22" y="26" width="56" height="54" rx="16" fill="#18181C"/>' +
             '<circle cx="40" cy="50" r="5" fill="#FCFCFA"/><circle cx="60" cy="50" r="5" fill="#FCFCFA"/>' +
             '<path d="M40 64 Q50 72 60 64" fill="none" stroke="#EFE84B" stroke-width="4" stroke-linecap="round"/>';
    },
  };

  window.BUDDY_FEATURES = ["buddy", "antenna", "headband", "glasses", "mittens", "crown"];
  window.buddySvg = function (feature, size) {
    size = size || 64;
    var inner = (PARTS[feature] || PARTS.buddy)();
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">' + inner + '</svg>';
  };
})();
