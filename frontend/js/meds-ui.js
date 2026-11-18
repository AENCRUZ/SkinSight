/*
 * SKINSIGHT — Medication pages (PREVIEW, frontend only)
 *
 * Makes the sample medication screens feel real without any persistence or API:
 *   - medication-tracker.html : mark a dose complete / undo, live progress ring
 *   - medication-history.html : filter tabs (All / Completed / Missed) + summary counts
 *   - add-medication.html     : inline validation and a clear "not saved" result
 *
 * Nothing here is stored. Reloading the page restores the sample data.
 */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ------------------------------------------------------------ tracker
  function initTracker() {
    var list = $("#medList");
    if (!list) return;
    var ring = $("#medRing"), ringText = $("#medRingText"), text = $("#medProgressText"), bar = $("#medBar"), live = $("#medLive");

    function update(message) {
      var items = $$(".med-item", list);
      var done = $$(".med-item.is-done", list).length;
      var total = items.length;
      var pct = total ? Math.round((done / total) * 100) : 0;
      if (ring) {
        ring.style.setProperty("--pct", pct);
        ring.setAttribute("aria-label", done + " of " + total + " doses completed today");
      }
      if (ringText) ringText.textContent = done + "/" + total;
      if (text) text.innerHTML = "<strong>" + done + " of " + total + "</strong> doses completed";
      if (bar) bar.style.width = pct + "%";
      if (live && message) live.textContent = message;
    }

    function setDone(item, isDone) {
      item.classList.toggle("is-done", isDone);
      item.setAttribute("data-status", isDone ? "done" : "pending");
      var complete = $(".med-complete", item), status = $(".med-status", item), undo = $(".med-undo", item);
      if (complete) complete.hidden = isDone;
      if (status) status.hidden = !isDone;
      if (undo) undo.hidden = !isDone;
      var name = ($("h3", item) || {}).textContent || "Dose";
      update(name + (isDone ? " marked as completed." : " marked as not completed."));
      // The control that had focus is now hidden: hand focus to its replacement.
      var next = isDone ? undo : complete;
      if (next) next.focus();
    }

    list.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("button");
      if (!btn) return;
      var item = btn.closest(".med-item");
      if (!item) return;
      if (btn.classList.contains("med-complete")) setDone(item, true);
      else if (btn.classList.contains("med-undo")) setDone(item, false);
    });
    update();
  }

  // ------------------------------------------------------------ history
  function initHistory() {
    var table = $(".hist-table");
    if (!table) return;
    var rows = $$("tbody tr", table);
    var tabs = $$('.tabs[role="tablist"] .tab');
    var empty = $("#histEmpty");

    function counts() {
      var done = rows.filter(function (r) { return r.getAttribute("data-status") === "done"; }).length;
      var missed = rows.filter(function (r) { return r.getAttribute("data-status") === "missed"; }).length;
      var total = done + missed;
      var d = $("#statDone"), m = $("#statMissed"), r = $("#statRate");
      if (d) d.textContent = done;
      if (m) m.textContent = missed;
      if (r) r.textContent = total ? Math.round((done / total) * 100) + "%" : "–";
    }

    function select(tab, focus) {
      var filter = tab.getAttribute("data-filter");
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.setAttribute("tabindex", on ? "0" : "-1");
      });
      var visible = 0;
      rows.forEach(function (row) {
        var show = filter === "all" || row.getAttribute("data-status") === filter;
        row.hidden = !show;
        if (show) visible++;
      });
      if (empty) empty.hidden = visible !== 0;
      table.hidden = visible === 0;
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
    counts();
  }

  // ------------------------------------------------------------ add form
  function initForm() {
    var form = $("#medForm");
    if (!form) return;
    var name = $("#medname"), error = $("#medname-error"), result = $("#medFormResult");

    function setInvalid(on) {
      name.setAttribute("aria-invalid", on ? "true" : "false");
      if (error) error.hidden = !on;
    }
    name.addEventListener("input", function () { if (name.value.trim()) setInvalid(false); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!name.value.trim()) {
        setInvalid(true);
        name.focus();
        return;
      }
      setInvalid(false);
      var target = $("[data-med-name]", result);
      if (target) target.textContent = name.value.trim();
      result.hidden = false;
      result.focus();
    });
  }

  function init() { initTracker(); initHistory(); initForm(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
