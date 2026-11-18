/*
 * SKINSIGHT — Auth page enhancements (presentation only)
 *
 * Adds helpful, non-blocking feedback to the sign-up / reset-password forms:
 *   - password strength hint   ([data-pw-meter="<inputId>"] + [data-pw-hint="<inputId>"])
 *   - live "passwords match"   ([data-match-hint="<confirmId>"], data-match-with="<passwordId>")
 *   - Caps Lock warning        ([data-caps-hint="<inputId>"])
 *
 * This file never submits, validates for submission, or talks to Supabase.
 * js/auth.js remains the only code that decides whether a form is accepted
 * (it still enforces the 8-character minimum and the match check on submit).
 */
(function () {
  "use strict";

  function byId(id) { return document.getElementById(id); }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // 0 = empty, 1 = too short, 2 = fair, 3 = good, 4 = strong
  function strength(pw) {
    if (!pw) return 0;
    var kinds = (/[a-z]/.test(pw) ? 1 : 0) + (/[A-Z]/.test(pw) ? 1 : 0) + (/\d/.test(pw) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
    if (pw.length < 8) return 1;
    if (pw.length >= 12 && kinds >= 3) return 4;
    if (kinds >= 3 || (pw.length >= 12 && kinds >= 2)) return 3;
    return 2;
  }
  var HINTS = {
    1: "<strong>Too short.</strong> Use at least 8 characters.",
    2: "<strong>Fair.</strong> Add numbers, capitals or symbols to make it stronger.",
    3: "<strong>Good.</strong> A longer password makes it even stronger.",
    4: "<strong>Strong.</strong> Nice choice."
  };

  function initStrength() {
    all("[data-pw-meter]").forEach(function (meter) {
      var input = byId(meter.getAttribute("data-pw-meter"));
      var hint = document.querySelector('[data-pw-hint="' + meter.getAttribute("data-pw-meter") + '"]');
      if (!input) return;
      function update() {
        var level = strength(input.value);
        meter.setAttribute("data-level", String(level));
        meter.hidden = level === 0;
        if (hint) {
          hint.hidden = level === 0;
          if (level) hint.innerHTML = HINTS[level];
        }
      }
      input.addEventListener("input", update);
      update();
    });
  }

  function initMatch() {
    all("[data-match-hint]").forEach(function (hint) {
      var confirm = byId(hint.getAttribute("data-match-hint"));
      var source = byId(hint.getAttribute("data-match-with"));
      if (!confirm || !source) return;
      var last = "";
      function update() {
        var state = !confirm.value ? "" : confirm.value === source.value ? "ok" : "bad";
        if (state === last) return;
        last = state;
        hint.hidden = state === "";
        hint.classList.toggle("is-ok", state === "ok");
        hint.classList.toggle("is-bad", state === "bad");
        hint.textContent = state === "ok" ? "Passwords match." : state === "bad" ? "Passwords don't match yet." : "";
      }
      confirm.addEventListener("input", update);
      source.addEventListener("input", update);
    });
  }

  function initCaps() {
    all("[data-caps-hint]").forEach(function (hint) {
      var input = byId(hint.getAttribute("data-caps-hint"));
      if (!input) return;
      function check(e) {
        var on = !!(e.getModifierState && e.getModifierState("CapsLock"));
        hint.hidden = !on;
      }
      input.addEventListener("keydown", check);
      input.addEventListener("keyup", check);
      input.addEventListener("blur", function () { hint.hidden = true; });
    });
  }

  function init() { initStrength(); initMatch(); initCaps(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
