/*
 * SKINSIGHT — Medication store
 *
 * FRONTEND ONLY. Everything is kept in this browser's localStorage. Nothing is sent to any server, nothing is
 * synced between devices or browsers, and nothing is backed up.
 *
 * PRIVACY MODEL (read this before changing storage):
 *   - Data is namespaced per PROFILE: "guest" when nobody is signed in, "u_<supabase user id>" for an account.
 *     A profile only ever reads its own keys, so signing out or switching accounts never shows another
 *     profile's medications. Guest data is NOT migrated into an account.
 *   - The active account is read from THIS PROJECT's Supabase session token in localStorage
 *     (sb-<project ref>-auth-token; the ref comes from the same SUPABASE_URL js/supabase-config.js uses), parsed
 *     the way js/auth.js parses it. Other apps on a shared origin (e.g. <user>.github.io) have different refs and
 *     are ignored. The token is the source of truth: if it is gone (sign-out, expired/removed session) the profile
 *     is "guest", even if auth.js's cached "skinsight_user" is stale. We never write to, or depend on changes to,
 *     js/auth.js.
 *   - FAIL CLOSED: if this project's token key cannot be determined (SUPABASE_URL missing, not a string, or not a
 *     valid URL) the profile is "guest". The store NEVER scans or reads any other "sb-*" key, so another project's
 *     Supabase session can never be used to pick a profile.
 *   - This is ISOLATION, NOT SECURITY. The data is stored as plain text under predictable keys. Anyone who can
 *     use this browser profile (DevTools, another script on this origin, a shared computer) can read it, and a
 *     signed-out profile's data stays on the device until it is deleted (see deleteProfileData/deleteAllData).
 *   - The origin on GitHub Pages is shared by every project site under the same user account.
 *
 * If localStorage is unavailable (blocked, private mode, quota) the store keeps working in MEMORY for the life
 * of the page and reports it through status() so the UI can say so. Nothing is persisted in that case.
 *
 * Schedule model (kept from the original prototype): a medication has a schedule (once_daily, twice_daily,
 * every_other_day), a frequency (daily, weekly, as_needed) and a dose time. "as_needed" medications have NO
 * scheduled doses: they are never counted in progress and never produce "not logged" records; the user can log
 * doses whenever they take one.
 */
(function () {
  "use strict";

  var VERSION = "v1";
  var MEDS_PREFIX = "skinsight_meds_" + VERSION + ":";
  var LOG_PREFIX = "skinsight_medlog_" + VERSION + ":";
  var LEGACY_KEYS = ["skinsight_medications", "skinsight_dose_log"]; // global keys used by an earlier prototype
  var LIMITS = { meds: 30, name: 80, notes: 300 };
  var SCHEDULES = ["once_daily", "twice_daily", "every_other_day"];
  var FREQUENCIES = ["daily", "weekly", "as_needed"];
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

  // ------------------------------------------------------------------ dates / formatting (local time)
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return dateKey(new Date()); }
  function fmtTime(t) {
    if (!TIME_RE.test(t || "")) return "";
    var p = t.split(":"), h = +p[0], ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + p[1] + " " + ap;
  }
  function fmtDate(key) {
    if (!DATE_RE.test(key || "")) return "";
    var d = parseKey(key);
    return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ------------------------------------------------------------------ profile (guest / account)
  // supabase-js stores the session under "sb-<project ref>-auth-token", where the ref is the first label of the
  // project hostname. SUPABASE_URL is a top-level const in js/supabase-config.js (loaded before this file).
  // Returns this project's token key, or null when it cannot be determined (SUPABASE_URL missing, not a string, or
  // not a valid URL). Callers must treat null as "signed out": there is deliberately no fallback to other keys.
  function projectTokenKey() {
    try {
      if (typeof SUPABASE_URL === "string" && SUPABASE_URL) {
        return "sb-" + new URL(SUPABASE_URL).hostname.split(".")[0] + "-auth-token";
      }
    } catch (e) { /* invalid SUPABASE_URL: no key can be derived, so the caller fails closed (guest) */ }
    return null;
  }
  function userIdFromToken(raw) {
    if (!raw) return null;
    var data = JSON.parse(raw);
    var u = data && (data.user || (data.currentSession && data.currentSession.user));
    return u && u.id ? String(u.id) : null;
  }
  // The signed-in user's id, or null (= guest). Fails closed: only THIS project's session key is ever read. If it
  // cannot be determined, or the token is missing, unreadable or malformed, the result is null. No other "sb-*"
  // key is inspected, so a session belonging to another project on the same origin can never select a profile.
  //
  // WHERE the token lives (see supabase-config.js, skinsightAuthStorage): sessionStorage for a normal login, and
  // localStorage only when "Keep me signed in" was ticked. Both are checked, in the same order login-gate.js uses,
  // otherwise every default login would be treated as a guest and share the guest medication list.
  function authUserId() {
    try {
      var own = projectTokenKey();
      if (!own) return null;
      var raw = null;
      try { raw = sessionStorage.getItem(own); } catch (e) { /* unavailable: fall through */ }
      if (!raw && localStorage.getItem("skinsight_remember_me") === "true") raw = localStorage.getItem(own);
      return userIdFromToken(raw);
    } catch (e) { return null; } // unreadable storage or malformed token: treat as signed out
  }
  function profile() {
    var id = authUserId();
    if (!id) return { kind: "guest", key: "guest" };
    return { kind: "account", key: "u_" + id.replace(/[^A-Za-z0-9_-]/g, "") };
  }

  // ------------------------------------------------------------------ persistence (with in-memory fallback)
  var memory = {};   // profile key -> { meds, log }; authoritative while persistence is unavailable/failing
  var failed = {};   // profile key -> true after a write failed
  var persist = probe();

  function probe() {
    try {
      var k = "__skinsight_probe__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }
  function readKey(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeKey(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  // Never trust stored JSON: it can be edited by hand, truncated, or written by another version.
  function cleanMeds(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (m) {
      if (!m || typeof m !== "object" || typeof m.id !== "string" || !m.id || typeof m.name !== "string" || !m.name.trim()) return;
      out.push({
        id: m.id.slice(0, 40),
        name: m.name.trim().slice(0, LIMITS.name),
        schedule: SCHEDULES.indexOf(m.schedule) !== -1 ? m.schedule : "once_daily",
        frequency: FREQUENCIES.indexOf(m.frequency) !== -1 ? m.frequency : "daily",
        time: TIME_RE.test(m.time || "") ? m.time : "09:00",
        notes: typeof m.notes === "string" ? m.notes.slice(0, LIMITS.notes) : "",
        created: DATE_RE.test(m.created || "") ? m.created : today()
      });
    });
    return out;
  }
  function cleanLog(obj) {
    var out = {};
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
    Object.keys(obj).forEach(function (k) { if (typeof obj[k] === "number" && isFinite(obj[k])) out[k] = obj[k]; });
    return out;
  }

  function load(p) {
    if (memory[p.key] && (!persist || failed[p.key])) return memory[p.key];
    return { meds: cleanMeds(readKey(MEDS_PREFIX + p.key, [])), log: cleanLog(readKey(LOG_PREFIX + p.key, {})) };
  }
  function save(p, data) {
    memory[p.key] = data; // the in-memory copy is always current; storage is the durable copy when it works
    if (!persist) { failed[p.key] = true; return false; }
    var ok = writeKey(MEDS_PREFIX + p.key, data.meds) && writeKey(LOG_PREFIX + p.key, data.log);
    if (!ok) persist = probe() ? true : false; // distinguish "storage gone" from "this write failed (quota)"
    failed[p.key] = !ok;
    return ok;
  }

  // ------------------------------------------------------------------ describing schedules (plain language)
  function times(time, schedule) {
    var list = [time];
    if (schedule === "twice_daily") {
      var p = time.split(":");
      list.push(pad((+p[0] + 12) % 24) + ":" + p[1]);
    }
    list.sort(); // chronological, e.g. 8:00 AM and 8:00 PM
    return list.map(fmtTime).join(" and ");
  }
  function describe(m) {
    if (m.frequency === "as_needed") return "As needed (not scheduled)";
    var when = times(m.time, m.schedule);
    if (m.frequency === "weekly") {
      return (m.schedule === "twice_daily" ? "Twice on one day each week" : "Once a week") + " at " + when;
    }
    var base = m.schedule === "twice_daily" ? "Twice daily" : m.schedule === "every_other_day" ? "Every other day" : "Once daily";
    return base + " at " + when;
  }

  // ------------------------------------------------------------------ validation
  function validate(data) {
    var errors = {};
    var name = String(data && data.name != null ? data.name : "").replace(/\s+/g, " ").trim();
    var notes = String(data && data.notes != null ? data.notes : "").trim();
    var schedule = data && data.schedule, frequency = data && data.frequency;
    var time = data && data.time;

    if (!name) errors.name = "Enter the medication name.";
    else if (name.length > LIMITS.name) errors.name = "Use " + LIMITS.name + " characters or fewer.";
    if (SCHEDULES.indexOf(schedule) === -1) errors.schedule = "Choose a schedule.";
    if (FREQUENCIES.indexOf(frequency) === -1) errors.frequency = "Choose how often.";
    if (!errors.schedule && !errors.frequency && frequency === "weekly" && schedule === "every_other_day") {
      errors.frequency = "“Weekly” can't be combined with “Every other day”. Choose one.";
    }
    if (frequency !== "as_needed" && !TIME_RE.test(time || "")) errors.time = "Enter a valid dose time.";
    if (notes.length > LIMITS.notes) errors.notes = "Use " + LIMITS.notes + " characters or fewer.";
    return {
      errors: errors,
      clean: {
        name: name, notes: notes, schedule: schedule, frequency: frequency,
        time: frequency === "as_needed" ? "09:00" : time // as-needed medications are not scheduled; time is unused
      }
    };
  }

  // ------------------------------------------------------------------ medications
  function getMeds() { return load(profile()).meds.slice(); }

  function addMed(data) {
    var p = profile(), d = load(p);
    var v = validate(data);
    if (!Object.keys(v.errors).length && d.meds.length >= LIMITS.meds) {
      v.errors._form = "You can track up to " + LIMITS.meds + " medications on this device. Remove one to add another.";
    }
    if (Object.keys(v.errors).length) return { ok: false, errors: v.errors };
    var med = {
      id: "m" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
      name: v.clean.name, schedule: v.clean.schedule, frequency: v.clean.frequency,
      time: v.clean.time, notes: v.clean.notes, created: today()
    };
    d.meds.push(med);
    var saved = save(p, d);
    return { ok: true, med: med, saved: saved };
  }

  // Removes a medication AND its dose records. The snapshot lets the caller offer "Undo".
  function removeMed(id) {
    var p = profile(), d = load(p);
    var index = -1, med = null;
    d.meds.forEach(function (m, i) { if (m.id === id) { med = m; index = i; } });
    if (!med) return null;
    d.meds.splice(index, 1);
    var removedLog = {};
    Object.keys(d.log).forEach(function (k) {
      if (k.indexOf(id + "|") === 0) { removedLog[k] = d.log[k]; delete d.log[k]; }
    });
    save(p, d);
    return { profile: p.key, med: med, index: index, log: removedLog };
  }

  // Idempotent (a double click can't create duplicates) and profile-bound (a snapshot taken under one profile
  // can never be restored into another).
  function restoreMed(snapshot) {
    if (!snapshot || !snapshot.med) return { ok: false, reason: "invalid" };
    var p = profile();
    if (snapshot.profile !== p.key) return { ok: false, reason: "profile" };
    var d = load(p);
    if (d.meds.some(function (m) { return m.id === snapshot.med.id; })) return { ok: true, already: true };
    if (d.meds.length >= LIMITS.meds) return { ok: false, reason: "limit" };
    d.meds.splice(Math.min(snapshot.index, d.meds.length), 0, snapshot.med);
    var log = cleanLog(snapshot.log);
    Object.keys(log).forEach(function (k) { d.log[k] = log[k]; });
    save(p, d);
    return { ok: true };
  }

  // ------------------------------------------------------------------ scheduled doses
  function scheduled(med) { return med.frequency !== "as_needed"; }

  function timesFor(med, key) {
    if (!scheduled(med)) return [];
    var created = parseKey(med.created), day = parseKey(key);
    if (day < created) return [];
    var diff = Math.round((day - created) / 86400000);
    if (med.frequency === "weekly" && diff % 7 !== 0) return [];
    if (med.schedule === "every_other_day" && diff % 2 !== 0) return [];
    var out = [med.time];
    if (med.schedule === "twice_daily") {
      var p = med.time.split(":");
      out.push(pad((+p[0] + 12) % 24) + ":" + p[1]);
    }
    return out;
  }

  // Doses scheduled for one day. status: completed | pending | not_logged (a past dose the user never marked).
  // SKINSIGHT cannot know whether a "not logged" dose was actually taken.
  function slotsFor(key) {
    var d = load(profile()), now = today(), out = [];
    d.meds.forEach(function (med) {
      timesFor(med, key).forEach(function (t) {
        var id = med.id + "|" + key + "|" + t;
        var status = d.log[id] ? "completed" : key < now ? "not_logged" : "pending";
        out.push({ id: id, med: med, date: key, time: t, status: status });
      });
    });
    out.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
    return out;
  }

  function slotValid(d, slotId) {
    var parts = String(slotId).split("|");
    if (parts.length !== 3 || !DATE_RE.test(parts[1]) || parts[1] > today()) return false;
    var med = d.meds.filter(function (m) { return m.id === parts[0]; })[0];
    return !!med && timesFor(med, parts[1]).indexOf(parts[2]) !== -1;
  }
  function completeSlot(slotId) {
    var p = profile(), d = load(p);
    if (!slotValid(d, slotId)) return false;
    d.log[slotId] = Date.now();
    save(p, d);
    return true;
  }
  function uncompleteSlot(slotId) {
    var p = profile(), d = load(p);
    if (!(slotId in d.log) || String(slotId).indexOf("|an|") !== -1) return false;
    delete d.log[slotId];
    save(p, d);
    return true;
  }

  // ------------------------------------------------------------------ as-needed medications
  function asNeededMeds() { return load(profile()).meds.filter(function (m) { return !scheduled(m); }); }

  function parseAsNeeded(id, ts, meds) {
    var parts = id.split("|");
    if (parts.length !== 4 || parts[2] !== "an") return null;
    var med = meds.filter(function (m) { return m.id === parts[0]; })[0];
    if (!med) return null;
    var dt = new Date(ts);
    return { id: id, med: med, date: parts[1], ts: ts, time: pad(dt.getHours()) + ":" + pad(dt.getMinutes()) };
  }
  function asNeededDoses(key) {
    var d = load(profile()), out = [];
    Object.keys(d.log).forEach(function (id) {
      var r = parseAsNeeded(id, d.log[id], d.meds);
      if (r && (!key || r.date === key)) out.push(r);
    });
    out.sort(function (a, b) { return a.ts - b.ts; });
    return out;
  }
  function logAsNeeded(medId) {
    var p = profile(), d = load(p);
    var med = d.meds.filter(function (m) { return m.id === medId; })[0];
    if (!med || scheduled(med)) return null;
    var ts = Date.now(), id = medId + "|" + today() + "|an|" + ts;
    while (d.log[id]) { ts += 1; id = medId + "|" + today() + "|an|" + ts; }
    d.log[id] = ts;
    save(p, d);
    return id;
  }
  function unlogAsNeeded(doseId) {
    var p = profile(), d = load(p);
    if (!(doseId in d.log) || String(doseId).split("|")[2] !== "an") return false;
    delete d.log[doseId];
    save(p, d);
    return true;
  }

  // ------------------------------------------------------------------ history
  // Newest first. Rows: completed | not_logged (scheduled doses) and as_needed (doses the user logged).
  function history() {
    var d = load(profile()), now = today(), out = [];
    d.meds.forEach(function (med) {
      if (!scheduled(med)) return;
      var day = parseKey(med.created), end = parseKey(now);
      while (day <= end) {
        var key = dateKey(day);
        timesFor(med, key).forEach(function (t) {
          var id = med.id + "|" + key + "|" + t;
          var status = d.log[id] ? "completed" : key < now ? "not_logged" : null;
          if (status) out.push({ id: id, med: med, date: key, time: t, status: status });
        });
        day.setDate(day.getDate() + 1);
      }
    });
    Object.keys(d.log).forEach(function (id) {
      var r = parseAsNeeded(id, d.log[id], d.meds);
      if (r) out.push({ id: id, med: r.med, date: r.date, time: r.time, status: "as_needed" });
    });
    out.sort(function (a, b) { var ka = a.date + a.time, kb = b.date + b.time; return ka < kb ? 1 : ka > kb ? -1 : 0; });
    return out;
  }
  // Adherence figures cover SCHEDULED doses only (as-needed doses are excluded by design).
  function summarize(rows) {
    var c = 0, n = 0, a = 0;
    rows.forEach(function (r) { if (r.status === "completed") c++; else if (r.status === "not_logged") n++; else if (r.status === "as_needed") a++; });
    return { completed: c, notLogged: n, asNeeded: a, rate: c + n ? Math.round((c / (c + n)) * 100) : null };
  }

  // ------------------------------------------------------------------ deleting data on this device
  function storageKeys() {
    var keys = [];
    try { for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (e) { }
    return keys;
  }
  function removeKeys(keys) { keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { } }); }

  function deleteProfileData() {
    var p = profile();
    removeKeys([MEDS_PREFIX + p.key, LOG_PREFIX + p.key]);
    delete memory[p.key];
    delete failed[p.key];
    return true;
  }
  // Every profile on this device (guest + all accounts), plus data from the earlier prototype.
  function deleteAllData() {
    removeKeys(storageKeys().filter(function (k) {
      return k && (k.indexOf(MEDS_PREFIX) === 0 || k.indexOf(LOG_PREFIX) === 0 || LEGACY_KEYS.indexOf(k) !== -1);
    }));
    memory = {};
    failed = {};
    return true;
  }
  // How many OTHER profiles have saved data here (a count only: never their content or identity).
  function otherProfileCount() {
    var mine = profile().key, seen = {};
    storageKeys().forEach(function (k) {
      if (!k) return;
      var key = k.indexOf(MEDS_PREFIX) === 0 ? k.slice(MEDS_PREFIX.length) : k.indexOf(LOG_PREFIX) === 0 ? k.slice(LOG_PREFIX.length) : null;
      if (key && key !== mine) seen[key] = true;
    });
    return Object.keys(seen).length;
  }

  // ------------------------------------------------------------------ status + storage-event helper for the UI
  function status() {
    var p = profile();
    return { profile: p, persistent: persist && !failed[p.key], storageUnavailable: !persist, saveFailed: !!failed[p.key] };
  }
  // True for storage events that can change what the UI must show (data changes or a sign-in/out in another tab).
  function isRelevantStorageKey(k) {
    return k == null || k.indexOf(MEDS_PREFIX) === 0 || k.indexOf(LOG_PREFIX) === 0 || k.indexOf("sb-") === 0 || k === "skinsight_user";
  }

  window.SkinStore = {
    LIMITS: LIMITS,
    profile: profile, status: status, isRelevantStorageKey: isRelevantStorageKey,
    getMeds: getMeds, addMed: addMed, removeMed: removeMed, restoreMed: restoreMed, validate: validate,
    slotsFor: slotsFor, completeSlot: completeSlot, uncompleteSlot: uncompleteSlot,
    asNeededMeds: asNeededMeds, asNeededDoses: asNeededDoses, logAsNeeded: logAsNeeded, unlogAsNeeded: unlogAsNeeded,
    history: history, summarize: summarize, describe: describe,
    deleteProfileData: deleteProfileData, deleteAllData: deleteAllData, otherProfileCount: otherProfileCount,
    today: today, fmtTime: fmtTime, fmtDate: fmtDate, esc: esc
  };
})();
