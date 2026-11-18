/* SKINSIGHT — shared medication data (used by medication-tracker.html and medication-history.html) */
(function () {
  var MEDS_KEY = "skinsight_medications";
  var LOG_KEY = "skinsight_dose_log";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

  function read(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return dateKey(new Date()); }

  function fmtTime(t) {
    var p = t.split(":");
    var h = +p[0];
    var ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + p[1] + " " + ap;
  }
  function fmtDate(key) {
    var d = parseKey(key);
    return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getMeds() { return read(MEDS_KEY, []); }
  function getLog() { return read(LOG_KEY, {}); }

  function addMed(data) {
    var meds = getMeds();
    var med = {
      id: "m" + Date.now() + Math.floor(Math.random() * 1000),
      name: data.name,
      schedule: data.schedule,     // once_daily | twice_daily | every_other_day
      frequency: data.frequency,   // daily | weekly | as_needed
      time: data.time || "09:00",
      notes: data.notes || "",
      created: today()
    };
    meds.push(med);
    write(MEDS_KEY, meds);
    return med;
  }

  // Removes a medication and its dose records. Returns a snapshot so it can be undone.
  function removeMed(id) {
    var meds = getMeds();
    var index = -1;
    var med = null;
    meds.forEach(function (m, i) { if (m.id === id) { med = m; index = i; } });
    if (!med) return null;

    meds.splice(index, 1);
    write(MEDS_KEY, meds);

    var log = getLog();
    var removedLog = {};
    Object.keys(log).forEach(function (k) {
      if (k.indexOf(id + "|") === 0) {
        removedLog[k] = log[k];
        delete log[k];
      }
    });
    write(LOG_KEY, log);
    return { med: med, index: index, log: removedLog };
  }

  function restoreMed(snapshot) {
    if (!snapshot) return;
    var meds = getMeds();
    meds.splice(Math.min(snapshot.index, meds.length), 0, snapshot.med);
    write(MEDS_KEY, meds);
    var log = getLog();
    Object.keys(snapshot.log).forEach(function (k) { log[k] = snapshot.log[k]; });
    write(LOG_KEY, log);
  }

  function completeSlot(slotId) {
    var log = getLog();
    log[slotId] = Date.now();
    write(LOG_KEY, log);
  }

  function uncompleteSlot(slotId) {
    var log = getLog();
    delete log[slotId];
    write(LOG_KEY, log);
  }

  // Which dose times does this medication have on a given day?
  function timesFor(med, key) {
    var created = parseKey(med.created);
    var day = parseKey(key);
    if (day < created) return [];
    var diff = Math.round((day - created) / 86400000);
    if (med.frequency === "weekly" && diff % 7 !== 0) return [];
    if (med.schedule === "every_other_day" && diff % 2 !== 0) return [];
    var times = [med.time];
    if (med.schedule === "twice_daily") {
      var p = med.time.split(":");
      times.push(pad((+p[0] + 12) % 24) + ":" + p[1]);
    }
    return times;
  }

  // All doses for one day, with status: completed | missed | pending
  function slotsFor(key) {
    var log = getLog();
    var now = today();
    var out = [];
    getMeds().forEach(function (med) {
      timesFor(med, key).forEach(function (t) {
        var id = med.id + "|" + key + "|" + t;
        var status = "pending";
        if (log[id]) status = "completed";
        else if (key < now && med.frequency !== "as_needed") status = "missed";
        out.push({ id: id, med: med, date: key, time: t, status: status });
      });
    });
    out.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
    return out;
  }

  // Completed + missed doses from the first medication up to today (newest first)
  function history() {
    var meds = getMeds();
    if (!meds.length) return [];
    var earliest = meds.map(function (m) { return m.created; }).sort()[0];
    var d = parseKey(earliest);
    var end = parseKey(today());
    var out = [];
    while (d <= end) {
      slotsFor(dateKey(d)).forEach(function (s) {
        if (s.status !== "pending") out.push(s);
      });
      d.setDate(d.getDate() + 1);
    }
    out.sort(function (a, b) {
      var ka = a.date + a.time, kb = b.date + b.time;
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });
    return out;
  }

  window.SkinStore = {
    addMed: addMed,
    removeMed: removeMed,
    restoreMed: restoreMed,
    completeSlot: completeSlot,
    uncompleteSlot: uncompleteSlot,
    slotsFor: slotsFor,
    history: history,
    today: today,
    fmtTime: fmtTime,
    fmtDate: fmtDate,
    esc: esc
  };
})();