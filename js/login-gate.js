/*
 * SKINSIGHT — Login gate for sending the consultation summary
 * Frontend-only demo. Real security needs a backend session check.
 */
(function () {
  "use strict";

  var AUTH_KEY = "skinsight_logged_in";

  function isLoggedIn() {
    try { return localStorage.getItem(AUTH_KEY) === "true"; }
    catch (e) { return false; }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (isLoggedIn()) return;

    var next = window.location.pathname.split("/").pop() || "clinic-details.html";

    // Build the popup
    var modal = document.createElement("div");
    modal.className = "login-gate";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "login-gate-title");
    modal.innerHTML =
      '<div class="login-gate-panel">' +
        '<h3 id="login-gate-title">Log in to send your summary</h3>' +
        '<p>Please log in or create a free account to email, copy, or download your consultation summary.</p>' +
        '<a href="login.html?next=' + encodeURIComponent(next) + '" class="btn btn-primary btn-block">Log In</a>' +
        '<a href="signup.html?next=' + encodeURIComponent(next) + '" class="btn btn-secondary btn-block">Create an Account</a>' +
        '<button type="button" class="btn btn-ghost btn-block" data-gate-close>Not now</button>' +
      '</div>';
    document.body.appendChild(modal);

    function open()  { modal.classList.add("show"); }
    function close() { modal.classList.remove("show"); }

    // Intercept clicks BEFORE the mailto / copy / download actions run
    document.addEventListener("click", function (e) {
      var action = e.target.closest(".send-option a, .send-option button");
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      open();
    }, true);

    modal.addEventListener("click", function (e) {
      if (e.target === modal || e.target.hasAttribute("data-gate-close")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  });
})();