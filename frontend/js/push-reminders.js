/*
 * SKINSIGHT — Medication push reminders (opt-in)
 *
 * When the user turns reminders on, this browser gets a Web Push subscription and the CURRENT profile's medication
 * list (names, notes, dose times, schedule) plus which recent doses are already marked completed is sent to the
 * SKINSIGHT backend, which sends a notification at each dose time — even when no SKINSIGHT tab is open.
 * Every change to the medication list is re-sent automatically; turning reminders off deletes the server copy.
 *
 * Load order: after js/medication-store.js and before js/meds-ui.js (all deferred). Renders into #medReminders.
 */
(function () {
  "use strict";

  var S = window.SkinStore;
  if (!S) return;

  var LOCAL_API_URL = "http://localhost:5000";
  var PRODUCTION_API_URL = "https://skinsight-f5p8.onrender.com"; // keep in sync with js/api.js
  var isLocal = ["localhost", "127.0.0.1", ""].indexOf(window.location.hostname) !== -1;
  var API = (window.SKINSIGHT_API_URL || (isLocal ? LOCAL_API_URL : PRODUCTION_API_URL)).replace(/\/+$/, "");
  var TEST_DELAY = 10;

  var supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
  var registration = null;
  var busy = false;
  var syncTimer = null;
  var lastError = "";

  // ------------------------------------------------------------------ helpers
  function $(sel) { return document.querySelector(sel); }
  function icon(name) { return '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>'; }

  function keyToBytes(base64) {
    var pad = "=".repeat((4 - (base64.length % 4)) % 4);
    var raw = window.atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function api(path, body) {
    var opts = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    return fetch(API + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.success === false) throw new Error(data.error || "The reminder server didn't respond (" + res.status + ").");
        return data;
      });
    }, function () {
      throw new Error("Couldn't reach the reminder server. Check your connection and try again.");
    });
  }

  function timezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
  }

  function yesterday() {
    var d = new Date(); d.setDate(d.getDate() - 1);
    var p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  // Doses already marked completed (today + yesterday) so the server doesn't remind about them.
  function completedSlots() {
    return S.slotsFor(S.today()).concat(S.slotsFor(yesterday()))
      .filter(function (s) { return s.status === "completed"; })
      .map(function (s) { return s.id; });
  }

  function getRegistration() {
    if (registration) return Promise.resolve(registration);
    return navigator.serviceWorker.register("sw.js").then(function (reg) { registration = reg; return reg; });
  }

  function currentSubscription() {
    if (!supported) return Promise.resolve(null);
    return getRegistration().then(function (reg) { return reg.pushManager.getSubscription(); });
  }

  function send(sub) {
    return api("/api/notifications/subscribe", {
      subscription: sub.toJSON(),
      medications: S.getMeds(),
      completed: completedSlots(),
      timezone: timezone()
    });
  }

  // ------------------------------------------------------------------ actions
  function enable() {
    if (Notification.permission === "denied") return Promise.reject(new Error("Notifications are blocked for this site. Allow them in your browser's site settings, then try again."));
    return Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") throw new Error("Notifications weren't allowed, so reminders stay off.");
      return Promise.all([getRegistration(), api("/api/notifications/vapid-public-key")]);
    }).then(function (r) {
      var reg = r[0], key = r[1].publicKey;
      return reg.pushManager.getSubscription().then(function (existing) {
        return existing || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) });
      });
    }).then(send);
  }

  function disable() {
    return currentSubscription().then(function (sub) {
      if (!sub) return;
      var endpoint = sub.endpoint;
      return sub.unsubscribe().then(function () {
        return api("/api/notifications/unsubscribe", { endpoint: endpoint }).catch(function () { /* server copy expires on next failed send */ });
      });
    });
  }

  function test() {
    return currentSubscription().then(function (sub) {
      if (!sub) throw new Error("Turn reminders on first.");
      return send(sub).then(function () {
        return api("/api/notifications/test", { endpoint: sub.endpoint, delaySeconds: TEST_DELAY });
      });
    });
  }

  // Re-send the schedule after any change (debounced). Silent: failures are retried on the next change/visit.
  function scheduleSync() {
    if (!supported) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      currentSubscription().then(function (sub) { if (sub) return send(sub); }).catch(function () { });
    }, 800);
  }

  // Wrap every store method that changes what should be reminded about.
  ["addMed", "removeMed", "restoreMed", "completeSlot", "uncompleteSlot", "deleteProfileData", "deleteAllData"].forEach(function (name) {
    var original = S[name];
    if (typeof original !== "function") return;
    S[name] = function () {
      var result = original.apply(S, arguments);
      scheduleSync();
      return result;
    };
  });

  // ------------------------------------------------------------------ UI
  function render(sub) {
    var mount = $("#medReminders");
    if (!mount) return;

    var on = !!sub, html, status, actions = "";
    if (!supported) {
      status = '<span class="badge badge-muted">Not available</span>';
      html = "This browser can't receive push notifications. Use Chrome, Edge or Firefox on a computer or Android phone. On iPhone/iPad, add SKINSIGHT to your Home Screen first (iOS 16.4 or later).";
    } else if (Notification.permission === "denied") {
      status = '<span class="badge badge-muted">Blocked</span>';
      html = "Notifications are blocked for this site. To use reminders, allow notifications in your browser's site settings (the icon left of the address bar), then reload this page.";
    } else if (on) {
      status = '<span class="badge badge-done">' + icon("circle-check") + " On</span>";
      html = "You'll get a notification at each scheduled dose time, even when no SKINSIGHT tab is open. Doses you've marked as completed are skipped. As-needed medications never send reminders.";
      actions = '<button type="button" class="btn btn-secondary btn-sm" data-reminder-test>Send a test in ' + TEST_DELAY + ' seconds</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-reminder-toggle>Turn off reminders</button>';
    } else {
      status = '<span class="badge badge-muted">Off</span>';
      html = "Get a notification at each dose time, even when Chrome isn't open on this page.";
      actions = '<button type="button" class="btn btn-primary btn-sm" data-reminder-toggle>Turn on reminders</button>';
    }

    mount.innerHTML =
      '<section class="card card-static med-reminders" aria-labelledby="medRemindersTitle">' +
        '<div class="med-reminders-head"><h2 id="medRemindersTitle">Dose reminders</h2>' + status + '</div>' +
        '<p>' + html + '</p>' +
        (supported && Notification.permission !== "denied"
          ? '<p class="med-hint"><strong>Privacy:</strong> turning reminders on sends this profile\'s medication names, notes and dose times to SKINSIGHT\'s server so it can notify you. Turning them off deletes that copy.</p>'
          : "") +
        (on ? '<p class="med-hint">On Windows and macOS, Chrome must be allowed to run in the background (Chrome Settings → System → “Continue running background apps when Google Chrome is closed”). Reminders are only sent to this browser.</p>' : "") +
        (lastError ? '<p class="med-reminders-error" role="alert">' + icon("alert-circle") + " " + S.esc(lastError) + "</p>" : "") +
        (actions ? '<div class="med-reminders-actions">' + actions + "</div>" : "") +
      "</section>";
  }

  function refresh() {
    return currentSubscription().then(render, function () { render(null); });
  }

  function onClick(e) {
    var t = e.target.closest && e.target.closest("[data-reminder-toggle], [data-reminder-test]");
    if (!t || busy) return;
    busy = true;
    t.disabled = true;
    lastError = "";
    var isTest = t.hasAttribute("data-reminder-test");
    var original = t.textContent;
    t.textContent = isTest ? "Sending…" : "Please wait…";

    var job = isTest ? test() : currentSubscription().then(function (sub) { return sub ? disable() : enable(); });
    job.then(function () {
      if (isTest) {
        t.textContent = "Test sent — you can close Chrome now";
        setTimeout(function () { busy = false; refresh(); }, TEST_DELAY * 1000);
        return;
      }
      busy = false;
      return refresh();
    }).catch(function (err) {
      lastError = err && err.message ? err.message : "Something went wrong.";
      busy = false;
      t.textContent = original;
      return refresh();
    });
  }

  function init() {
    var mount = $("#medReminders");
    if (!mount) return;
    mount.addEventListener("click", onClick);
    refresh().then(scheduleSync); // keep the server copy current on every visit
    // Signed in / out in another tab, or storage changed: the active profile's list may differ.
    window.addEventListener("storage", function (e) { if (S.isRelevantStorageKey(e.key)) scheduleSync(); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { scheduleSync(); refresh(); } });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
