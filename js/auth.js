/*
 * SKINSIGHT — Auth UI interactions 
 * Frontend-ONLY. No network calls, no password handling/storage,
 * no real authentication.
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {

    /* ---------------- Password show/hide ---------------- */
    var toggles = document.querySelectorAll("[data-toggle-password]");
    Array.prototype.forEach.call(toggles, function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-toggle-password");
        var input = document.getElementById(targetId);
        if (!input) return;
        var showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.classList.toggle("is-visible", !showing);
        btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      });
    });

    /* ---------------- Placeholder form submit ---------------- */
    // Forms are not wired to a backend yet. On "submit" we just run
    // native validation and, if it passes, show a small inline note
    // so this reads as a working UI during design/dev review.
    var authForms = document.querySelectorAll("[data-auth-form]");
    Array.prototype.forEach.call(authForms, function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        var successBlock = form.parentElement.querySelector("[data-auth-success]");
        if (successBlock) {
          // e.g. Forgot Password: swap the form for a confirmation state
          form.style.display = "none";
          successBlock.classList.add("show");
          return;
        }

        // Mark as "logged in" (demo only) and return to the previous page if any
        try { localStorage.setItem("skinsight_logged_in", "true"); } catch (err) {}

        var nextPage = new URLSearchParams(window.location.search).get("next");
        if (nextPage && /^[a-z0-9-]+\.html$/i.test(nextPage)) {
          window.location.href = nextPage;
          return;
        }

        var note = form.querySelector("[data-auth-note]");
        if (note) {
          note.classList.add("show");
        }
      });
    });
  });
})();