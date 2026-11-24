/*
 * SKINSIGHT — Medication store
 *
 * HYBRID STORAGE: Local-first with Supabase Cloud Sync.
 *   - Offline-first: Data is always instantly cached in browser localStorage / memory so UI is instantaneous.
 *   - Authenticated Cloud Sync: When signed into Supabase, medications and dose completion logs
 *     are synchronized with the PostgreSQL database (tables: `public.medications` and `public.medication_logs`).
 *   - Guest Mode: Unauthenticated users store data in localStorage namespaced under "guest".
 *   - Migration: When a user with guest data logs in, their medications can be seamlessly synced to their account.
 *   - Fail-Safe: If tables are not created or network is offline, the store falls back to local storage gracefully.
 */
(function () {
  "use strict";

  var VERSION = "v1";
  var MEDS_PREFIX = "skinsight_meds_" + VERSION + ":";
  var LOG_PREFIX = "skinsight_medlog_" + VERSION + ":";
  var LEGACY_KEYS = ["skinsight_medications", "skinsight_dose_log"];
  var LIMITS = { meds: 30, name: 80, notes: 300 };
  var SCHEDULES = ["once_daily", "twice_daily", "every_other_day"];
  var FREQUENCIES = ["daily", "weekly", "as_needed"];
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

  // ------------------------------------------------------------------ dates / formatting
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

  // ------------------------------------------------------------------ profile
  function projectTokenKey() {
    try {
      if (typeof SUPABASE_URL === "string" && SUPABASE_URL) {
        return "sb-" + new URL(SUPABASE_URL).hostname.split(".")[0] + "-auth-token";
      }
    } catch (e) {}
    return null;
  }
  function userIdFromToken(raw) {
    if (!raw) return null;
    var data = JSON.parse(raw);
    var u = data && (data.user || (data.currentSession && data.currentSession.user));
    return u && u.id ? String(u.id) : null;
  }
  function authUserId() {
    try {
      var own = projectTokenKey();
      if (!own) return null;
      var raw = null;
      try { raw = sessionStorage.getItem(own); } catch (e) {}
      if (!raw && localStorage.getItem("skinsight_remember_me") === "true") raw = localStorage.getItem(own);
      return userIdFromToken(raw);
    } catch (e) { return null; }
  }
  function profile() {
    var id = authUserId();
    if (!id) return { kind: "guest", key: "guest", userId: null };
    return { kind: "account", key: "u_" + id.replace(/[^A-Za-z0-9_-]/g, ""), userId: id };
  }

  // ------------------------------------------------------------------ persistence (localStorage + in-memory)
  var memory = {};
  var failed = {};
  var persist = probe();
  var cloudState = { syncing: false, synced: false, tableAvailable: true, lastError: null };

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
        created: DATE_RE.test(m.created || "") ? m.created : (m.created_at || today())
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
    var data = { meds: cleanMeds(readKey(MEDS_PREFIX + p.key, [])), log: cleanLog(readKey(LOG_PREFIX + p.key, {})) };
    memory[p.key] = data;
    return data;
  }
  function save(p, data) {
    memory[p.key] = data;
    if (!persist) { failed[p.key] = true; return false; }
    var ok = writeKey(MEDS_PREFIX + p.key, data.meds) && writeKey(LOG_PREFIX + p.key, data.log);
    if (!ok) persist = probe() ? true : false;
    failed[p.key] = !ok;
    return ok;
  }

  // ------------------------------------------------------------------ SUPABASE CLOUD SYNC
  function supabase() {
    return window.supabaseClient || null;
  }

  function isMissingTableError(err) {
    if (!err) return false;
    var msg = (err.message || "").toLowerCase();
    var code = err.code || "";
    return code === "PGRST205" || code === "42P01" || msg.indexOf("does not exist") !== -1 || msg.indexOf("schema cache") !== -1;
  }

  function notifySync() {
    try {
      window.dispatchEvent(new CustomEvent("skinsight:meds-synced", { detail: { profile: profile() } }));
    } catch (e) {}
  }

  async function syncFromCloud() {
    var p = profile();
    if (p.kind !== "account" || !p.userId) return { ok: false, reason: "signed-out" };
    var c = supabase();
    if (!c) return { ok: false, reason: "unavailable" };

    cloudState.syncing = true;
    try {
      var medsRes = await c.from("medications").select("*").order("created_at", { ascending: true });
      if (medsRes.error) {
        if (isMissingTableError(medsRes.error)) cloudState.tableAvailable = false;
        throw medsRes.error;
      }

      var logsRes = await c.from("medication_logs").select("*");
      if (logsRes.error) {
        if (isMissingTableError(logsRes.error)) cloudState.tableAvailable = false;
        throw logsRes.error;
      }

      cloudState.tableAvailable = true;
      var current = load(p);

      var remoteMeds = cleanMeds((medsRes.data || []).map(function (m) {
        return {
          id: m.id,
          name: m.name,
          schedule: m.schedule,
          frequency: m.frequency,
          time: m.dose_time,
          notes: m.notes,
          created: m.created_at
        };
      }));

      var remoteLog = {};
      (logsRes.data || []).forEach(function (l) {
        if (l.slot_key) remoteLog[l.slot_key] = Number(l.logged_at);
      });

      // If remote has data, update local store with remote data
      if (remoteMeds.length > 0 || Object.keys(remoteLog).length > 0) {
        current.meds = remoteMeds;
        current.log = remoteLog;
        save(p, current);
      } else if (current.meds.length > 0) {
        // Local has data but cloud is empty: push local to cloud
        await pushLocalToCloud(p, current);
      }

      cloudState.synced = true;
      cloudState.syncing = false;
      notifySync();
      return { ok: true, count: current.meds.length };
    } catch (err) {
      cloudState.syncing = false;
      cloudState.lastError = err;
      return { ok: false, error: err };
    }
  }

  async function pushLocalToCloud(p, data) {
    var c = supabase();
    if (!c || p.kind !== "account" || !cloudState.tableAvailable) return;
    try {
      if (data.meds.length > 0) {
        var medRows = data.meds.map(function (m) {
          return {
            id: m.id,
            user_id: p.userId,
            name: m.name,
            schedule: m.schedule,
            frequency: m.frequency,
            dose_time: m.time,
            notes: m.notes || "",
            created_at: m.created
          };
        });
        await c.from("medications").upsert(medRows, { onConflict: "id" });
      }
      var logKeys = Object.keys(data.log);
      if (logKeys.length > 0) {
        var logRows = [];
        logKeys.forEach(function (k) {
          var parts = k.split("|");
          if (parts[0]) {
            logRows.push({
              user_id: p.userId,
              medication_id: parts[0],
              slot_key: k,
              logged_at: data.log[k]
            });
          }
        });
        if (logRows.length) await c.from("medication_logs").upsert(logRows, { onConflict: "user_id,medication_id,slot_key" });
      }
    } catch (e) {
      if (isMissingTableError(e)) cloudState.tableAvailable = false;
    }
  }

  function cloudSaveMed(med) {
    var p = profile(), c = supabase();
    if (!c || p.kind !== "account" || !cloudState.tableAvailable) return;
    c.from("medications").upsert({
      id: med.id,
      user_id: p.userId,
      name: med.name,
      schedule: med.schedule,
      frequency: med.frequency,
      dose_time: med.time,
      notes: med.notes || "",
      created_at: med.created
    }, { onConflict: "id" }).then(function (res) {
      if (res.error && isMissingTableError(res.error)) cloudState.tableAvailable = false;
    }).catch(function () {});
  }

  function cloudRemoveMed(id) {
    var p = profile(), c = supabase();
    if (!c || p.kind !== "account" || !cloudState.tableAvailable) return;
    c.from("medications").delete().eq("id", id).then(function (res) {
      if (res.error && isMissingTableError(res.error)) cloudState.tableAvailable = false;
    }).catch(function () {});
  }

  function cloudSaveLog(slotKey, timestamp) {
    var p = profile(), c = supabase();
    if (!c || p.kind !== "account" || !cloudState.tableAvailable) return;
    var parts = slotKey.split("|");
    var medId = parts[0];
    if (!medId) return;
    c.from("medication_logs").upsert({
      user_id: p.userId,
      medication_id: medId,
      slot_key: slotKey,
      logged_at: timestamp
    }, { onConflict: "user_id,medication_id,slot_key" }).then(function (res) {
      if (res.error && isMissingTableError(res.error)) cloudState.tableAvailable = false;
    }).catch(function () {});
  }

  function cloudRemoveLog(slotKey) {
    var p = profile(), c = supabase();
    if (!c || p.kind !== "account" || !cloudState.tableAvailable) return;
    c.from("medication_logs").delete().eq("slot_key", slotKey).then(function (res) {
      if (res.error && isMissingTableError(res.error)) cloudState.tableAvailable = false;
    }).catch(function () {});
  }

  // ------------------------------------------------------------------ Guest-to-Account Migration
  function hasGuestData() {
    var guestKey = "guest";
    var data = load({ key: guestKey, kind: "guest" });
    return data.meds && data.meds.length > 0;
  }

  async function migrateGuestData() {
    var p = profile();
    if (p.kind !== "account" || !p.userId) return { ok: false, reason: "signed-out" };
    var guestData = load({ key: "guest", kind: "guest" });
    if (!guestData.meds || !guestData.meds.length) return { ok: true, migrated: 0 };

    var userStore = load(p);
    var added = 0;
    guestData.meds.forEach(function (m) {
      if (!userStore.meds.some(function (existing) { return existing.name.toLowerCase() === m.name.toLowerCase(); })) {
        userStore.meds.push(m);
        added++;
      }
    });
    Object.keys(guestData.log).forEach(function (k) {
      userStore.log[k] = guestData.log[k];
    });

    save(p, userStore);
    await pushLocalToCloud(p, userStore);

    // Clear guest storage
    try {
      localStorage.removeItem(MEDS_PREFIX + "guest");
      localStorage.removeItem(LOG_PREFIX + "guest");
      delete memory["guest"];
    } catch (e) {}

    notifySync();
    return { ok: true, migrated: added };
  }

  // ------------------------------------------------------------------ describing schedules
  function times(time, schedule) {
    var list = [time];
    if (schedule === "twice_daily") {
      var p = time.split(":");
      list.push(pad((+p[0] + 12) % 24) + ":" + p[1]);
    }
    list.sort();
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
        time: frequency === "as_needed" ? "09:00" : time
      }
    };
  }

  // ------------------------------------------------------------------ medications mutations
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
    cloudSaveMed(med);
    return { ok: true, med: med, saved: saved };
  }

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
    cloudRemoveMed(id);
    return { profile: p.key, med: med, index: index, log: removedLog };
  }

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
    cloudSaveMed(snapshot.med);
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
    var now = Date.now();
    d.log[slotId] = now;
    save(p, d);
    cloudSaveLog(slotId, now);
    return true;
  }
  function uncompleteSlot(slotId) {
    var p = profile(), d = load(p);
    if (!(slotId in d.log) || String(slotId).indexOf("|an|") !== -1) return false;
    delete d.log[slotId];
    save(p, d);
    cloudRemoveLog(slotId);
    return true;
  }

  // ------------------------------------------------------------------ as-needed
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
    cloudSaveLog(id, ts);
    return id;
  }
  function unlogAsNeeded(doseId) {
    var p = profile(), d = load(p);
    if (!(doseId in d.log) || String(doseId).split("|")[2] !== "an") return false;
    delete d.log[doseId];
    save(p, d);
    cloudRemoveLog(doseId);
    return true;
  }

  // ------------------------------------------------------------------ history
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
  function summarize(rows) {
    var c = 0, n = 0, a = 0;
    rows.forEach(function (r) { if (r.status === "completed") c++; else if (r.status === "not_logged") n++; else if (r.status === "as_needed") a++; });
    return { completed: c, notLogged: n, asNeeded: a, rate: c + n ? Math.round((c / (c + n)) * 100) : null };
  }

  // ------------------------------------------------------------------ deleting data
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
    var c = supabase();
    if (c && p.kind === "account" && p.userId && cloudState.tableAvailable) {
      c.from("medications").delete().eq("user_id", p.userId).then(function () {}).catch(function () {});
      c.from("medication_logs").delete().eq("user_id", p.userId).then(function () {}).catch(function () {});
    }
    return true;
  }
  function deleteAllData() {
    removeKeys(storageKeys().filter(function (k) {
      return k && (k.indexOf(MEDS_PREFIX) === 0 || k.indexOf(LOG_PREFIX) === 0 || LEGACY_KEYS.indexOf(k) !== -1);
    }));
    memory = {};
    failed = {};
    return true;
  }
  function otherProfileCount() {
    var mine = profile().key, seen = {};
    storageKeys().forEach(function (k) {
      if (!k) return;
      var key = k.indexOf(MEDS_PREFIX) === 0 ? k.slice(MEDS_PREFIX.length) : k.indexOf(LOG_PREFIX) === 0 ? k.slice(LOG_PREFIX.length) : null;
      if (key && key !== mine) seen[key] = true;
    });
    return Object.keys(seen).length;
  }

  // ------------------------------------------------------------------ status
  function status() {
    var p = profile();
    return {
      profile: p,
      persistent: persist && !failed[p.key],
      storageUnavailable: !persist,
      saveFailed: !!failed[p.key],
      cloudSync: p.kind === "account" && cloudState.tableAvailable,
      syncing: cloudState.syncing,
      synced: cloudState.synced,
      tableAvailable: cloudState.tableAvailable
    };
  }
  function isRelevantStorageKey(k) {
    return k == null || k.indexOf(MEDS_PREFIX) === 0 || k.indexOf(LOG_PREFIX) === 0 || k.indexOf("sb-") === 0 || k === "skinsight_user";
  }

  // Automatically initiate sync on startup if signed in
  if (typeof window !== "undefined") {
    window.setTimeout(function () {
      if (profile().kind === "account") syncFromCloud();
    }, 100);
  }

  window.SkinStore = {
    LIMITS: LIMITS,
    profile: profile, status: status, isRelevantStorageKey: isRelevantStorageKey,
    syncFromCloud: syncFromCloud, hasGuestData: hasGuestData, migrateGuestData: migrateGuestData,
    getMeds: getMeds, addMed: addMed, removeMed: removeMed, restoreMed: restoreMed, validate: validate,
    slotsFor: slotsFor, completeSlot: completeSlot, uncompleteSlot: uncompleteSlot,
    asNeededMeds: asNeededMeds, asNeededDoses: asNeededDoses, logAsNeeded: logAsNeeded, unlogAsNeeded: unlogAsNeeded,
    history: history, summarize: summarize, describe: describe,
    deleteProfileData: deleteProfileData, deleteAllData: deleteAllData, otherProfileCount: otherProfileCount,
    today: today, fmtTime: fmtTime, fmtDate: fmtDate, esc: esc
  };
})();
