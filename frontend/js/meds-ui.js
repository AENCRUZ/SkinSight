/*
 * SKINSIGHT — Medication pages UI (tracker, add-medication, history)
 *
 * FRONTEND ONLY. All data comes from js/medication-store.js, which keeps it in this browser's localStorage,
 * namespaced per profile (guest / signed-in account). Nothing is sent anywhere, except by js/push-reminders.js when
 * the user opts in to dose reminders. See that file for the privacy
 * model and its limits. This file never touches authentication: it only READS the session through the store and
 * (optionally) listens to supabase-js auth events to notice a sign-in / sign-out.
 *
 * Pages are detected by their mount points:
 *   #medList      -> medication-tracker.html   (today's doses, as-needed list, my medications)
 *   #medFormMount -> add-medication.html       (full-page form, same form code as the tracker's dialog)
 *   #histBody     -> medication-history.html   (filters, stats, paged table)
 */
(function () {
  "use strict";

  var S = window.SkinStore;
  if (!S) return;

  var HISTORY_PAGE = 50;
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  var supportsDialog = typeof HTMLDialogElement === "function" && typeof document.createElement("dialog").showModal === "function";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var esc = S.esc;
  function icon(name) { return '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>'; }

  var isTracker = !!$("#medList");
  var isHistory = !!$("#histBody");
  var isAdd = !!$("#medFormMount");
  if (!isTracker && !isHistory && !isAdd) return;

  // ------------------------------------------------------------------ state shared by all three pages
  var state = {
    profileKey: S.profile().key,
    day: S.today(),
    messages: [],   // dismissible info / success banners
    undo: [],       // persistent "removed X: Undo" banners (snapshots live in memory only)
    nextId: 1,
    awaitingCloud: false // signed in, nothing cached yet, first cloud sync not finished: don't claim "no medications"
  };

  // ------------------------------------------------------------------ first cloud sync (read-only view of the store's status)
  // The store starts its own sync shortly after load and announces success with "skinsight:meds-synced". It sends no
  // event on failure, so we watch status() and give up after CLOUD_WAIT_MS. The store itself is not changed.
  var CLOUD_WAIT_MS = 10000, cloudWaitTimer = null;
  function stopCloudWait() {
    if (cloudWaitTimer) { window.clearInterval(cloudWaitTimer); cloudWaitTimer = null; }
    if (!state.awaitingCloud) return;
    state.awaitingCloud = false;
    if (isTracker) renderTracker();
  }
  function startCloudWait() {
    if (cloudWaitTimer) { window.clearInterval(cloudWaitTimer); cloudWaitTimer = null; }
    var st = S.status();
    state.awaitingCloud = st.profile.kind === "account" && !st.synced && st.tableAvailable &&
      !!window.supabaseClient && S.getMeds().length === 0;
    if (!state.awaitingCloud) return;
    var started = Date.now(), sawSyncing = false;
    cloudWaitTimer = window.setInterval(function () {
      var s = S.status();
      if (s.syncing) sawSyncing = true;
      if (s.synced || !s.tableAvailable || (sawSyncing && !s.syncing) || s.profile.kind !== "account" ||
          Date.now() - started > CLOUD_WAIT_MS) {
        stopCloudWait();
      }
    }, 400);
  }

  // ------------------------------------------------------------------ announcements (one controlled live region)
  var live = $("#medLive");
  function announce(text) {
    if (!live) return;
    live.textContent = "";
    window.setTimeout(function () { live.textContent = text; }, 60);
  }

  function profileLabel() { return S.status().profile.kind === "account" ? "your signed-in account" : "the guest profile"; }
  // ------------------------------------------------------------------ storage status row + "Privacy & data" disclosure
  // Always visible: where the data lives (and, for guests, that it is not synced or backed up) plus Sync now.
  // Behind the disclosure: the full storage/privacy explanation and Delete. The "not medical advice" statement
  // stays visible in the page's footer notice (tracker) or the one-line disclaimer below (add / history pages).
  state.noticeOpen = false;
  function renderNotice() {
    var mount = $("#medNotice");
    if (!mount) return;
    var st = S.status();
    var isAccount = st.profile.kind === "account";

    var headTitle = !isAccount ? "Saved on this device only"
      : st.tableAvailable ? "Synced to your account" : "Saved on this device";
    var subHtml = !isAccount
      ? 'Not synced or backed up. <a href="signup.html">Sign in to sync</a> across devices.'
      : st.tableAvailable ? "" : "Cloud storage isn’t set up yet, so your medications are kept in this browser.";
    var descriptionHtml = isAccount
      ? '<p>Your medications are securely saved to your <strong>SKINSIGHT account in Supabase</strong> and synced across your devices. A local copy is cached in this browser so the tracker works instantly and offline.</p>' +
        (!st.tableAvailable ? '<p class="med-hint"><em>Note: Cloud tables are not created in Supabase yet. Medication data is safely preserved on this device.</em></p>' : '') +
        '<p>SKINSIGHT only records what you tell it. Reminders are <strong>optional and off by default</strong>. It <strong>cannot verify that you took a medication</strong> and <strong>does not give medical advice</strong>. Follow the instructions of your healthcare professional.</p>'
      : '<p>You are using the <strong>guest profile</strong>. Everything here is saved only in <strong>this browser on this device</strong>. It is <strong>not synced</strong> across devices and <strong>not backed up</strong>. <a href="signup.html">Create an account or sign in</a> to sync your medications in the cloud.</p>' +
        '<p><strong>Shared or public device?</strong> Anyone who can use this browser profile may be able to read this information. Delete your data when you’re finished.</p>' +
        '<p>SKINSIGHT only records what you tell it. It <strong>cannot verify that you took a medication</strong> and <strong>does not give medical advice</strong>. Follow the instructions of your healthcare professional.</p>';

    var syncButton = isAccount
      ? '<button type="button" class="btn btn-secondary btn-sm" data-med-sync>' + icon("rotate-ccw") + ' Sync now</button>' : "";
    var deleteButton = isAccount
      ? '<button type="button" class="btn btn-ghost btn-sm med-notice-delete" data-med-delete>' + icon("trash") + ' Delete medication data</button>'
      : '<button type="button" class="btn btn-ghost btn-sm med-notice-delete" data-med-delete>' + icon("trash") + ' Delete medication data on this device</button>';

    mount.innerHTML =
      '<section class="med-notice' + (isAccount && st.tableAvailable ? " is-synced" : "") + '" aria-labelledby="medNoticeTitle">' +
        '<div class="med-notice-row">' +
          icon(isAccount && st.tableAvailable ? "circle-check" : "info") +
          '<div class="med-notice-text"><h2 id="medNoticeTitle">' + esc(headTitle) + '</h2>' +
            (subHtml ? '<p class="med-notice-sub">' + subHtml + '</p>' : "") + '</div>' +
          (syncButton ? '<div class="med-notice-actions">' + syncButton + '</div>' : "") +
        '</div>' +
        '<details class="med-notice-more"' + (state.noticeOpen ? " open" : "") + '>' +
          '<summary>Privacy &amp; data' + icon("chevron-down") + '</summary>' +
          '<div class="med-notice-body">' + descriptionHtml +
            '<div class="med-notice-danger">' + deleteButton + '</div></div>' +
        '</details>' +
        (isTracker ? "" : '<p class="med-disclaimer">SKINSIGHT records what you tell it, can’t confirm doses were taken, and doesn’t give medical advice.</p>') +
      '</section>';
    var more = $(".med-notice-more", mount);
    if (more) more.addEventListener("toggle", function () { state.noticeOpen = more.open; });
  }

  // ------------------------------------------------------------------ alerts: storage warnings, messages, undo banners
  function alertHtml(kind, iconName, text, actions) {
    return '<div class="med-alert is-' + kind + '">' + icon(iconName) + '<p>' + text + '</p>' + (actions ? '<div class="med-alert-actions">' + actions + '</div>' : "") + '</div>';
  }
  function renderAlerts() {
    var mount = $("#medAlerts");
    if (!mount) return;
    var st = S.status(), html = "";
    if (st.storageUnavailable) {
      html += alertHtml("warning", "alert-circle", '<strong>Your browser is blocking storage, so nothing can be saved.</strong> You can still use this page, but everything you add is lost when you leave or reload it.');
    } else if (st.saveFailed) {
      html += alertHtml("warning", "alert-circle", '<strong>Your latest change couldn’t be saved</strong> (browser storage may be full or restricted). It is kept on this page only and will be lost when you leave or reload it.');
    }
    if (st.profile.kind === "account" && S.hasGuestData && S.hasGuestData() && !state.dismissedGuestMigration) {
      html += alertHtml("info", "info", '<strong>Guest medications found:</strong> You have medications saved on this device from guest mode. Would you like to sync them into your account?',
        '<button type="button" class="btn btn-primary btn-sm" data-migrate-guest>Sync to account</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-dismiss-guest-migration>Dismiss</button>');
    }
    state.messages.forEach(function (m) {
      html += alertHtml(m.kind, m.kind === "success" ? "circle-check" : "info", esc(m.text),
        '<button type="button" class="btn btn-ghost btn-sm" data-dismiss-message="' + m.id + '">Dismiss</button>');
    });
    state.undo.forEach(function (u) {
      html += alertHtml("undo", "trash", '<strong>' + esc(u.name) + '</strong> was removed, along with its dose history.',
        '<button type="button" class="btn btn-secondary btn-sm" data-undo-remove="' + u.id + '">Undo</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-dismiss-undo="' + u.id + '">Dismiss</button>');
    });
    mount.innerHTML = html;
  }
  function addMessage(kind, text) { state.messages.push({ id: state.nextId++, kind: kind, text: text }); }

  // ------------------------------------------------------------------ tracker
  function slotHtml(s) {
    var done = s.status === "completed", time = S.fmtTime(s.time), name = esc(s.med.name);
    return '<li class="med-item' + (done ? " is-done" : "") + '">' +
      '<span class="med-time">' + esc(time) + '</span>' +
      '<div class="med-card"><div class="med-info"><h3>' + name + '</h3>' + (s.med.notes ? '<p>' + esc(s.med.notes) + '</p>' : "") + '</div>' +
      '<div class="med-actions">' + (done
        ? '<span class="badge badge-done">' + icon("circle-check") + ' Completed</span>' +
          '<button type="button" class="med-undo" data-uncomplete="' + esc(s.id) + '" aria-label="Undo completed: ' + name + ' at ' + esc(time) + '">Undo</button>'
        : '<button type="button" class="btn btn-secondary btn-sm" data-complete="' + esc(s.id) + '" aria-label="Mark as completed: ' + name + ' at ' + esc(time) + '">Mark as completed</button>') +
      '</div></div></li>';
  }
  function asNeededHtml(med) {
    var doses = S.asNeededDoses(S.today());
    doses = doses.filter(function (d) { return d.med.id === med.id; });
    var taken = doses.length ? "Logged today: " + doses.map(function (d) { return S.fmtTime(d.time); }).join(", ") : "Nothing logged today";
    var last = doses[doses.length - 1], name = esc(med.name);
    return '<li class="med-item is-plain"><div class="med-card"><div class="med-info"><h3>' + name + '</h3>' +
      '<p>' + (med.notes ? esc(med.notes) + " · " : "") + esc(taken) + '</p></div>' +
      '<div class="med-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-an-log="' + esc(med.id) + '" aria-label="Log a dose: ' + name + '">Log a dose</button>' +
        (last ? '<button type="button" class="med-undo" data-an-undo="' + esc(last.id) + '" aria-label="Undo last logged dose: ' + name + '">Undo last</button>' : "") +
      '</div></div></li>';
  }
  function mineHtml(med) {
    var name = esc(med.name);
    return '<li><div class="med-mine-info"><strong>' + name + '</strong><span>' + esc(S.describe(med)) + '</span></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-remove="' + esc(med.id) + '" aria-label="Remove medication: ' + name + '">Remove</button></li>';
  }

  function renderTracker(focusSel) {
    var slots = S.slotsFor(S.today());
    var meds = S.getMeds(), asNeeded = S.asNeededMeds();
    var done = slots.filter(function (s) { return s.status === "completed"; }).length, total = slots.length;
    var pct = total ? Math.round((done / total) * 100) : 0;

    // Progress lives in the "Today's schedule" heading and only appears when doses are scheduled today.
    $("#medProgress").hidden = !total;
    $("#medProgressText").innerHTML = total ? "<strong>" + done + " of " + total + "</strong> done" : "";
    $("#medBar").style.width = pct + "%";

    var list = $("#medList"), empty = $("#medScheduleEmpty");
    list.innerHTML = slots.map(slotHtml).join("");
    list.hidden = !total;
    if (!meds.length && state.awaitingCloud) {
      empty.hidden = false;
      empty.innerHTML = '<p class="med-loading" role="status">Loading your medications from your account…</p>';
    } else if (!meds.length) {
      var st = S.status();
      var whereSaved = st.profile.kind !== "account" ? "everything stays on this device"
        : st.cloudSync ? "it’s saved to your account" : "it’s saved on this device";
      empty.hidden = false;
      empty.innerHTML = '<div class="card card-static med-empty"><span class="med-empty-icon">' + icon("pill") + '</span><h3>No medications yet</h3>' +
        '<p>Add a medication your healthcare professional prescribed or recommended. You’ll see its doses here each day, and ' + whereSaved + '.</p>' +
        '<button type="button" class="btn btn-primary" data-open-add>' + icon("plus") + ' Add medication</button></div>';
    } else if (!total) {
      empty.hidden = false;
      empty.innerHTML = '<div class="card card-static med-empty"><h3>Nothing scheduled today</h3><p>None of your medications have a scheduled dose today.' + (asNeeded.length ? " As-needed medications are listed below." : "") + '</p></div>';
    } else { empty.hidden = true; empty.innerHTML = ""; }

    var anSection = $("#medAsNeededSection");
    anSection.hidden = !asNeeded.length;
    $("#medAsNeededList").innerHTML = asNeeded.map(asNeededHtml).join("");
    var mineSection = $("#medMineSection");
    mineSection.hidden = !meds.length;
    $("#medMine").innerHTML = meds.map(mineHtml).join("");

    if (focusSel) { var el = $(focusSel); if (el) el.focus(); }
  }

  function afterChange(focusSel) {
    renderAlerts();
    if (isTracker) renderTracker(focusSel);
    if (isHistory) renderHistory();
  }

  function slotSummary(id) {
    var s = S.slotsFor(S.today()).filter(function (x) { return x.id === id; })[0];
    return s ? s.med.name + " at " + S.fmtTime(s.time) : "Dose";
  }
  function progressSentence() {
    var slots = S.slotsFor(S.today()), done = slots.filter(function (s) { return s.status === "completed"; }).length;
    return done + " of " + slots.length + " scheduled doses completed today.";
  }

  function onTrackerClick(e) {
    var t = e.target.closest && e.target.closest("button, a");
    if (!t) return;

    var id = t.getAttribute("data-complete");
    if (id) {
      var label = slotSummary(id);
      if (S.completeSlot(id)) { announce(label + " marked as completed. " + progressSentence()); afterChange('[data-uncomplete="' + id.replace(/"/g, '\\"') + '"]'); }
      return;
    }
    id = t.getAttribute("data-uncomplete");
    if (id) {
      var label2 = slotSummary(id);
      if (S.uncompleteSlot(id)) { announce(label2 + " is no longer marked as completed. " + progressSentence()); afterChange('[data-complete="' + id.replace(/"/g, '\\"') + '"]'); }
      return;
    }
    id = t.getAttribute("data-an-log");
    if (id) {
      var med = S.getMeds().filter(function (m) { return m.id === id; })[0];
      if (S.logAsNeeded(id)) { announce("Dose logged for " + (med ? med.name : "medication") + "."); afterChange('[data-an-log="' + id + '"]'); }
      return;
    }
    id = t.getAttribute("data-an-undo");
    if (id) {
      var parts = id.split("|"), medId = parts[0];
      if (S.unlogAsNeeded(id)) { announce("Last logged dose removed."); afterChange('[data-an-log="' + medId + '"]'); }
      return;
    }
    id = t.getAttribute("data-remove");
    if (id) {
      var snap = S.removeMed(id);
      if (!snap) return;
      var u = { id: state.nextId++, name: snap.med.name, snapshot: snap };
      state.undo.push(u);
      announce(snap.med.name + " removed, along with its dose history. Use Undo to restore it.");
      afterChange('[data-undo-remove="' + u.id + '"]');
      return;
    }
    if (t.hasAttribute("data-open-add")) openAddDialog(t);
  }

  function onAlertClick(e) {
    var t = e.target.closest && e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-migrate-guest")) {
      t.disabled = true;
      S.migrateGuestData().then(function (res) {
        if (res.ok) {
          addMessage("success", "Successfully synced " + (res.migrated || "your") + " guest medications into your account.");
          announce("Guest medications synced into your account.");
        } else {
          addMessage("info", "Couldn't sync guest medications. Please check your connection.");
        }
        afterChange(null);
      });
      return;
    }
    if (t.hasAttribute("data-dismiss-guest-migration")) {
      state.dismissedGuestMigration = true;
      renderAlerts();
      return;
    }
    var id = t.getAttribute("data-undo-remove");
    if (id) {
      var item = state.undo.filter(function (u) { return String(u.id) === id; })[0];
      if (!item) return;
      var r = S.restoreMed(item.snapshot);
      state.undo = state.undo.filter(function (u) { return u !== item; });
      if (r.ok) { announce(item.name + " restored."); afterChange('[data-remove="' + item.snapshot.med.id + '"]'); }
      else {
        addMessage("info", r.reason === "limit" ? "Couldn’t restore " + item.name + ": you already have the maximum number of medications on this device."
          : "Couldn’t restore " + item.name + " because the profile on this device changed.");
        announce("Couldn’t restore " + item.name + ".");
        afterChange("#medAddLink");
      }
      return;
    }
    id = t.getAttribute("data-dismiss-undo");
    if (id) { state.undo = state.undo.filter(function (u) { return String(u.id) !== id; }); afterChange(isTracker ? "#medAddLink" : null); return; }
    id = t.getAttribute("data-dismiss-message");
    if (id) { state.messages = state.messages.filter(function (m) { return String(m.id) !== id; }); afterChange(isTracker ? "#medAddLink" : null); }
  }

  // ------------------------------------------------------------------ the add form (shared by the dialog and the add page)
  function formHtml(p) {
    return '<form class="med-form" novalidate>' +
      '<div class="field"><label for="' + p + 'Name">Medication name <span class="req" aria-hidden="true">*</span></label>' +
        '<input type="text" id="' + p + 'Name" name="name" maxlength="' + S.LIMITS.name + '" autocomplete="off" required aria-required="true" aria-describedby="' + p + 'NameErr" aria-invalid="false" placeholder="e.g., Hydrocortisone Cream 1%">' +
        '<p class="field-error" id="' + p + 'NameErr" hidden></p></div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="' + p + 'Schedule">Schedule</label>' +
          '<select id="' + p + 'Schedule" name="schedule" aria-describedby="' + p + 'ScheduleErr"><option value="once_daily">Once daily</option><option value="twice_daily">Twice daily</option><option value="every_other_day">Every other day</option></select>' +
          '<p class="field-error" id="' + p + 'ScheduleErr" hidden></p></div>' +
        '<div class="field"><label for="' + p + 'Frequency">Frequency</label>' +
          '<select id="' + p + 'Frequency" name="frequency" aria-describedby="' + p + 'FrequencyErr ' + p + 'Combo"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="as_needed">As needed</option></select>' +
          '<p class="field-error" id="' + p + 'FrequencyErr" hidden></p></div>' +
      '</div>' +
      '<p class="med-hint" id="' + p + 'Combo">“As needed” turns off the schedule and dose time. “Weekly” can’t be combined with “Every other day”.</p>' +
      '<div class="field med-field-spaced" id="' + p + 'TimeField"><label for="' + p + 'Time">Dose time</label>' +
        '<input type="time" id="' + p + 'Time" name="time" value="09:00" aria-describedby="' + p + 'TimeHint ' + p + 'TimeErr" aria-invalid="false">' +
        '<p class="med-hint" id="' + p + 'TimeHint">The time shown next to the dose, and when a reminder is sent if you turn reminders on.</p>' +
        '<p class="field-error" id="' + p + 'TimeErr" hidden></p></div>' +
      '<div class="field"><label for="' + p + 'Notes">Notes <span class="med-optional">(optional)</span></label>' +
        '<textarea id="' + p + 'Notes" name="notes" maxlength="' + S.LIMITS.notes + '" aria-describedby="' + p + 'NotesHint ' + p + 'NotesErr" placeholder="Apply a thin layer to the affected area"></textarea>' +
        '<p class="med-hint" id="' + p + 'NotesHint">Saved on this device (and sent with reminders, if you turn them on).</p><p class="field-error" id="' + p + 'NotesErr" hidden></p></div>' +
      '<div class="med-form-summary">' + icon("calendar") + '<p id="' + p + 'Summary" aria-live="polite"></p></div>' +
      '<div class="med-form-error" id="' + p + 'FormErr" hidden></div>' +
      '<div class="form-actions"><button type="submit" class="btn btn-primary">Save medication</button><button type="button" class="btn btn-ghost" data-form-cancel>Cancel</button></div>' +
    '</form>';
  }

  function mountForm(mount, opts) {
    var p = opts.prefix;
    mount.innerHTML = formHtml(p);
    var form = $("form", mount);
    var f = {
      name: $("#" + p + "Name"), schedule: $("#" + p + "Schedule"), frequency: $("#" + p + "Frequency"),
      time: $("#" + p + "Time"), notes: $("#" + p + "Notes"), timeField: $("#" + p + "TimeField"),
      summary: $("#" + p + "Summary"), formErr: $("#" + p + "FormErr")
    };
    var order = ["name", "schedule", "frequency", "time", "notes"];

    function setError(field, msg) {
      var input = f[field], err = $("#" + p + { name: "Name", schedule: "Schedule", frequency: "Frequency", time: "Time", notes: "Notes" }[field] + "Err");
      if (!input || !err) return;
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      err.hidden = !msg;
      err.innerHTML = msg ? icon("alert-circle") + " " + esc(msg) : "";
    }
    function clearErrors() { order.forEach(function (k) { setError(k, ""); }); f.formErr.hidden = true; f.formErr.innerHTML = ""; }

    function syncDependencies() {
      var freq = f.frequency.value, sched = f.schedule.value, asNeeded = freq === "as_needed";
      $$("option", f.schedule).forEach(function (o) { o.disabled = o.value === "every_other_day" && freq === "weekly"; });
      $$("option", f.frequency).forEach(function (o) { o.disabled = o.value === "weekly" && sched === "every_other_day"; });
      f.schedule.disabled = asNeeded;
      f.time.disabled = asNeeded;
      f.timeField.classList.toggle("is-off", asNeeded);
      f.summary.textContent = summaryText();
    }
    function summaryText() {
      if (f.frequency.value === "as_needed") return "As needed: not scheduled, not counted in your daily progress, and never marked “not logged”. Log a dose whenever you take one.";
      if (!TIME_RE.test(f.time.value || "")) return "Choose a dose time to see the schedule.";
      return "Scheduled: " + S.describe({ frequency: f.frequency.value, schedule: f.schedule.value, time: f.time.value }) + ", starting today.";
    }

    ["schedule", "frequency", "time"].forEach(function (k) { f[k].addEventListener("change", syncDependencies); });
    f.time.addEventListener("input", function () { f.summary.textContent = summaryText(); setError("time", ""); });
    f.name.addEventListener("input", function () { if (f.name.value.trim()) setError("name", ""); });
    f.notes.addEventListener("input", function () { setError("notes", ""); });
    $("[data-form-cancel]", form).addEventListener("click", function () { if (opts.onCancel) opts.onCancel(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearErrors();
      var res = S.addMed({ name: f.name.value, schedule: f.schedule.value, frequency: f.frequency.value, time: f.time.value, notes: f.notes.value });
      if (!res.ok) {
        var first = null;
        order.forEach(function (k) { if (res.errors[k]) { setError(k, res.errors[k]); if (!first) first = f[k]; } });
        if (res.errors._form) {
          f.formErr.hidden = false;
          f.formErr.innerHTML = alertHtml("warning", "alert-circle", esc(res.errors._form));
          f.formErr.setAttribute("role", "alert");
          if (!first) first = f.name;
        }
        if (first) first.focus();
        announce("The medication wasn’t saved. " + (first ? "Fix the highlighted field." : ""));
        return;
      }
      opts.onSaved(res);
    });
    syncDependencies();
    return { focus: function () { f.name.focus(); } };
  }

  // ------------------------------------------------------------------ dialogs
  function getDialog(id, cls) {
    var d = document.getElementById(id);
    if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "med-dialog " + (cls || ""); document.body.appendChild(d); }
    return d;
  }
  function wireDialog(dlg, returnTo, onClose) {
    var downOnBackdrop = false;
    dlg.onmousedown = function (e) { downOnBackdrop = e.target === dlg; };
    dlg.onclick = function (e) { if (downOnBackdrop && e.target === dlg) dlg.close(); downOnBackdrop = false; };
    dlg.onclose = function () {
      document.documentElement.classList.remove("med-dialog-open");
      dlg.innerHTML = "";
      if (onClose) onClose(dlg.returnValue);
      var back = returnTo && document.body.contains(returnTo) ? returnTo : $("#medAddLink");
      if (back) back.focus();
    };
    document.documentElement.classList.add("med-dialog-open");
  }
  function closeDialogs() { $$("dialog.med-dialog[open]").forEach(function (d) { try { d.close(); } catch (e) { } }); }

  function openAddDialog(trigger) {
    if (!supportsDialog) { window.location.href = "add-medication.html"; return; }
    var dlg = getDialog("medDialog");
    dlg.setAttribute("aria-labelledby", "medDialogTitle");
    dlg.innerHTML = '<div class="med-dialog-inner"><div class="med-dialog-head"><h2 id="medDialogTitle">Add medication</h2>' +
      '<button type="button" class="med-dialog-close" data-dialog-close aria-label="Close">' + icon("x") + '</button></div>' +
      '<p class="med-dialog-sub">Enter details for a medication prescribed or recommended by a healthcare professional. It will be saved on this device (and sent with reminders, if you turn them on).</p>' +
      '<div id="medDialogMount"></div></div>';
    var formApi = mountForm($("#medDialogMount", dlg), {
      prefix: "dlg",
      onCancel: function () { dlg.close(); },
      onSaved: function (res) {
        var name = res.med.name;
        dlg.close("saved");
        addMessage(res.saved ? "success" : "info", res.saved ? name + " added." : name + " added for this page only: it couldn’t be saved in your browser.");
        announce(name + " added." + (res.saved ? "" : " It could not be saved in your browser."));
        afterChange(null);
      }
    });
    $("[data-dialog-close]", dlg).addEventListener("click", function () { dlg.close(); });
    wireDialog(dlg, trigger);
    dlg.showModal();
    formApi.focus();
  }

  function openDeleteDialog(trigger) {
    var others = S.otherProfileCount(), who = profileLabel();
    if (!supportsDialog) {
      if (window.confirm("Delete all medication data saved on this device for " + who + "? This can't be undone.")) { finishDelete("profile", true); }
      return;
    }
    var dlg = getDialog("medDeleteDialog");
    dlg.setAttribute("aria-labelledby", "medDeleteTitle");
    dlg.innerHTML = '<div class="med-dialog-inner"><div class="med-dialog-head"><h2 id="medDeleteTitle">Delete medication data on this device?</h2>' +
      '<button type="button" class="med-dialog-close" data-dialog-close aria-label="Close">' + icon("x") + '</button></div>' +
      '<p class="med-dialog-sub">This permanently deletes the medications, notes and dose history saved in this browser. It can’t be undone. It doesn’t affect any other device (nothing is stored elsewhere).</p>' +
      '<form method="dialog" id="medDeleteForm"><fieldset class="med-delete-options"><legend>What should be deleted?</legend>' +
        '<label><input type="radio" name="scope" value="profile" checked><span>Only data for ' + esc(who) + '<small>The medications, notes and dose history saved here for this profile.</small></span></label>' +
        '<label><input type="radio" name="scope" value="all"><span>Everything on this device<small>' + (others ? others + " other profile" + (others === 1 ? " also has" : "s also have") + " saved data here. " : "") + 'Includes the guest profile, every account, and data from earlier versions.</small></span></label>' +
      '</fieldset><div class="form-actions"><button type="submit" class="btn btn-danger-solid">Delete data</button><button type="button" class="btn btn-ghost" data-dialog-close>Cancel</button></div></form></div>';
    $$("[data-dialog-close]", dlg).forEach(function (b) { b.addEventListener("click", function () { dlg.close(); }); });
    $("#medDeleteForm", dlg).addEventListener("submit", function (e) {
      e.preventDefault();
      var scope = ($("input[name=scope]:checked", dlg) || {}).value || "profile";
      dlg.close("deleted");
      finishDelete(scope);
    });
    wireDialog(dlg, trigger);
    dlg.showModal();
    var first = $("input[name=scope]", dlg); if (first) first.focus();
  }
  function finishDelete(scope, focusAfter) {
    if (scope === "all") S.deleteAllData(); else S.deleteProfileData();
    state.undo = [];
    state.messages = [];
    var text = scope === "all" ? "Medication data for every profile was deleted from this device." : "Medication data for " + profileLabel() + " was deleted from this device.";
    addMessage("success", text);
    announce(text);
    afterChange(null);
    // With a <dialog>, focus returns to the button that opened it when the dialog closes; only the fallback needs help.
    if (focusAfter) { var target = $("#medAddLink") || $("#medNotice [data-med-delete]"); if (target) target.focus(); }
  }

  // ------------------------------------------------------------------ history
  var hist = { filter: "all", shown: HISTORY_PAGE };
  var EMPTY = {
    all: "No dose history yet. Add a medication on the tracker and mark doses as you take them.",
    completed: "No completed doses yet.",
    not_logged: "No unmarked doses. Every past dose has been marked as completed.",
    as_needed: "No as-needed doses logged yet."
  };
  function statusBadge(status) {
    return status === "completed" ? '<span class="badge badge-done">Completed</span>'
      : status === "not_logged" ? '<span class="badge badge-muted">Not logged</span>'
      : '<span class="badge badge-info">As needed</span>';
  }
  function renderHistory(focusFirstNew) {
    var rows = S.history(), sum = S.summarize(rows);
    $("#statDone").textContent = sum.completed;
    $("#statNotLogged").textContent = sum.notLogged;
    $("#statRate").textContent = sum.rate === null ? "–" : sum.rate + "%";

    var filtered = rows.filter(function (r) { return hist.filter === "all" || r.status === hist.filter; });
    var table = $("#histTable"), empty = $("#histEmpty"), more = $("#histMore");
    var previouslyShown = $$("#histBody tr").length;
    if (!filtered.length) {
      table.hidden = true; empty.hidden = false; more.hidden = true;
      empty.innerHTML = esc(EMPTY[hist.filter]) + (hist.filter === "all" ? ' <a href="medication-tracker.html">Go to the tracker</a>' : "");
      $("#histBody").innerHTML = "";
      return;
    }
    table.hidden = false; empty.hidden = true;
    var visible = filtered.slice(0, hist.shown);
    $("#histBody").innerHTML = visible.map(function (r) {
      return '<tr data-status="' + r.status + '"><td data-label="Medication">' + esc(r.med.name) + '</td>' +
        '<td data-label="Date">' + esc(S.fmtDate(r.date)) + " · " + esc(S.fmtTime(r.time)) + '</td>' +
        '<td data-label="Status">' + statusBadge(r.status) + '</td></tr>';
    }).join("");
    var remaining = filtered.length - visible.length;
    more.hidden = remaining <= 0;
    $("#histMoreBtn").textContent = "Show " + Math.min(HISTORY_PAGE, remaining) + " more (" + remaining + " remaining)";
    if (focusFirstNew) { var row = $$("#histBody tr")[previouslyShown]; if (row) { row.setAttribute("tabindex", "-1"); row.focus(); } }
  }
  function initHistory() {
    var tabs = $$('.tabs[role="tablist"] .tab');
    function select(tab, focus) {
      hist.filter = tab.getAttribute("data-filter");
      hist.shown = HISTORY_PAGE;
      tabs.forEach(function (t) { var on = t === tab; t.setAttribute("aria-selected", on ? "true" : "false"); t.setAttribute("tabindex", on ? "0" : "-1"); });
      renderHistory();
      var n = $$("#histBody tr").length, total = S.history().filter(function (r) { return hist.filter === "all" || r.status === hist.filter; }).length;
      announce(total ? "Showing " + n + " of " + total + " records." : EMPTY[hist.filter]);
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab, false); });
      tab.addEventListener("keydown", function (e) {
        var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (e.key === "Home") { e.preventDefault(); select(tabs[0], true); }
        else if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1], true); }
        else if (dir) { e.preventDefault(); select(tabs[(i + dir + tabs.length) % tabs.length], true); }
      });
    });
    $("#histMoreBtn").addEventListener("click", function () { hist.shown += HISTORY_PAGE; renderHistory(true); });
    renderHistory();
  }

  // ------------------------------------------------------------------ add page
  function initAddPage() {
    var mount = $("#medFormMount");
    mountForm(mount, {
      prefix: "page",
      onCancel: function () { window.location.href = "medication-tracker.html"; },
      onSaved: function (res) {
        if (res.saved) { window.location.href = "medication-tracker.html?added=1"; return; }
        // Not persisted (storage blocked/full): leaving the page would lose it, so stay and say so.
        addMessage("info", res.med.name + " was added for this page only: your browser couldn’t save it, so it will be lost when you leave.");
        announce("Added for this page only. Your browser couldn’t save it.");
        afterChange(null);
      }
    });
  }

  // ------------------------------------------------------------------ profile / day / storage change protection
  function renderEverything() {
    renderNotice();
    renderAlerts();
    if (isTracker) renderTracker();
    if (isHistory) renderHistory();
  }
  function checkProfile() {
    var key = S.profile().key;
    if (key === state.profileKey) return false;
    // Signed in, out, or switched account (this tab or another). Never carry anything across profiles.
    state.profileKey = key;
    closeDialogs();
    state.undo = [];
    state.messages = [];
    hist.shown = HISTORY_PAGE;
    startCloudWait();
    renderEverything();
    announce("The signed-in profile changed. Now showing medication data for " + profileLabel() + ".");
    return true;
  }
  function refresh() {
    if (checkProfile()) return;
    state.day = S.today();
    renderAlerts();
    if (isTracker) renderTracker();
    if (isHistory) renderHistory();
  }

  function init() {
    startCloudWait();
    renderEverything();

    if (isTracker) {
      var main = $("#medApp") || document;
      main.addEventListener("click", onTrackerClick);
      var link = $("#medAddLink");
      if (link) link.addEventListener("click", function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !supportsDialog) return; // let the browser open the full page
        e.preventDefault();
        openAddDialog(link);
      });
      if (new URLSearchParams(window.location.search).get("added") === "1") {
        addMessage("success", "Medication added.");
        announce("Medication added.");
        try { window.history.replaceState(null, "", window.location.pathname); } catch (e) { }
        renderAlerts();
      }
    }
    if (isHistory) initHistory();
    if (isAdd) initAddPage();

    var alerts = $("#medAlerts");
    if (alerts) alerts.addEventListener("click", onAlertClick);
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-med-delete]");
      if (t) { openDeleteDialog(t); return; }
      var syncBtn = e.target.closest && e.target.closest("[data-med-sync]");
      if (syncBtn) {
        syncBtn.disabled = true;
        announce("Syncing medications with Supabase...");
        S.syncFromCloud().then(function (res) {
          syncBtn.disabled = false;
          if (res.ok) {
            addMessage("success", "Medications synced with Supabase.");
            announce("Medications synced with Supabase.");
          } else {
            var msg = (res.error && res.error.message) || "Check your database setup or network connection.";
            addMessage("info", "Could not sync with Supabase: " + msg);
          }
          afterChange(null);
        });
      }
    });

    // Automatically update UI when cloud data arrives
    window.addEventListener("skinsight:meds-synced", function () {
      stopCloudWait();
      refresh();
    });

    // Anything that can change what this page should show.
    window.addEventListener("storage", function (e) { if (S.isRelevantStorageKey(e.key)) refresh(); });
    window.addEventListener("pageshow", function (e) { if (e.persisted) { refresh(); renderNotice(); } });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    window.setInterval(function () { if (S.today() !== state.day || S.profile().key !== state.profileKey) refresh(); }, 30000);
    if (window.supabaseClient && window.supabaseClient.auth && window.supabaseClient.auth.onAuthStateChange) {
      try {
        window.supabaseClient.auth.onAuthStateChange(function (event) {
          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            S.syncFromCloud();
          }
          window.setTimeout(refresh, 0);
        });
      } catch (e) { }
    }

    var st = S.status();
    if (st.storageUnavailable) announce("Your browser is blocking storage, so medications can't be saved on this device.");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
