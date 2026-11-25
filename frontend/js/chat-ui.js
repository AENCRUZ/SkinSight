/*
 * SKINSIGHT — Chat UI enhancements + saved-consultation sidebar
 *
 * chat.js keeps the CURRENT conversation in sessionStorage ("skinsight_chat_history") and talks to the
 * backend. This file never touches that contract. It:
 *   - lays out and drives the sidebar (collapse, search, grouping, delete)
 *   - SAVES the current conversation to the user's account (js/history-store.js -> Supabase table
 *     public.consultations, protected by Row Level Security) after every assistant reply
 *   - lists the user's saved consultations and lets them reopen one, also after signing out and back in
 *     or on another device. Reopening copies the saved messages back into the sessionStorage "current
 *     conversation", which is exactly what chat.js already renders and continues.
 *   - if the table is not available, says so plainly (no demo data is ever shown)
 *   - starter prompts, auto-growing composer, attach-menu accessibility, error styling
 *
 * sessionStorage is only the working copy of the open conversation; the saved history lives in the database.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------- constants
  var KEY_LIVE = "skinsight_chat_history";             // owned by chat.js (read/write only to restore a saved chat)
  var KEY_SUMMARY = "skinsight_consultation_summary";  // owned by summary.js (cleared when the live chat changes)
  var KEY_CONVOS_LEGACY = "skinsight_ui_convos";       // old session-only archive (removed on load)
  var KEY_CURRENT = "skinsight_ui_current";            // metadata of the live conversation
  var KEY_HIDDEN_LEGACY = "skinsight_ui_mock_hidden";  // from the removed sample conversations (cleaned up on load)
  var LS_SIDEBAR = "skinsight_ui_sidebar";             // per-viewer convenience: "open" | "closed"
  var SAVE_DELAY_MS = 700;
  var History = window.SkinsightHistory || null;

  // ------------------------------------------------------------------- dom
  var app = document.getElementById("chatApp");
  var shell = document.getElementById("chatShell");
  var chatBody = document.querySelector(".chat-body");
  if (!app || !shell || !chatBody) return; // not the chat page

  var sidebar = document.getElementById("chatSidebar");
  var backdrop = document.getElementById("chatSidebarBackdrop");
  var toggleBtn = document.getElementById("historyToggle");
  var closeBtn = document.getElementById("historyClose");
  var newBtn = document.getElementById("newConsultBtn");
  var searchInput = document.getElementById("historySearch");
  var listEl = document.getElementById("historyList");
  var statusEl = document.getElementById("historyStatus");
  var titleEl = document.getElementById("chatTitle");
  var textarea = document.querySelector(".chat-inputbar textarea");
  var sendBtn = document.querySelector(".chat-inputbar button.send");
  var attachToggle = document.getElementById("attach-toggle");
  var mobileMq = window.matchMedia("(max-width: 900px)");

  var state = { query: "", confirmId: null, lastFocusId: null, busyId: null };
  // Saved consultations from the database: status is "loading" | "ready" | "unavailable" | "error".
  var remote = { status: "loading", items: [], message: "", saveError: "" };
  var lastSavedSig = null;
  var saveTimer = null;
  var savePromise = Promise.resolve();

  // --------------------------------------------------------------- storage
  function readJSON(storage, key, fallback) {
    try {
      var raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full / blocked */ }
  }
  function removeKey(storage, key) {
    try { storage.removeItem(key); } catch (e) { }
  }
  // Conversation ids are stored in a uuid column, so they must be real UUIDs.
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function uid() {
    if (History && History.newId) return History.newId();
    var c = window.crypto;
    if (c && c.randomUUID) return c.randomUUID();
    var b = new Uint8Array(16); c.getRandomValues(b); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  // ----------------------------------------------------------------- helpers
  function turnText(turn) {
    if (!turn) return "";
    if (Array.isArray(turn.parts)) return turn.parts.map(function (p) { return typeof p === "string" ? p : (p && p.text) || ""; }).join(" ");
    if (typeof turn.text === "string") return turn.text;
    if (typeof turn.content === "string") return turn.content;
    return "";
  }
  function isAiTurn(turn) { return turn && (turn.role === "model" || turn.role === "assistant" || turn.role === "ai"); }

  function titleFromHistory(history) {
    for (var i = 0; i < history.length; i++) {
      if (!isAiTurn(history[i])) {
        var t = turnText(history[i]).replace(/\s+/g, " ").trim();
        if (t && t !== "[Image Attached]") return t.length > 46 ? t.slice(0, 45).trimEnd() + "…" : t;
        if (t === "[Image Attached]") return "Photo consultation";
      }
    }
    return "New consultation";
  }
  function searchText(history) {
    return history.map(turnText).join(" ").toLowerCase();
  }

  function liveHistory() {
    var h = readJSON(sessionStorage, KEY_LIVE, []);
    if (!Array.isArray(h)) return [];
    // Remove reference-text turns that older versions leaked into the history (see history-store.js).
    if (History && History.stripReferenceArtifacts) {
      var cleaned = History.stripReferenceArtifacts(h);
      if (cleaned.length !== h.length) { writeJSON(sessionStorage, KEY_LIVE, cleaned); }
      return cleaned;
    }
    return h;
  }
  function clearLive() {
    removeKey(sessionStorage, KEY_LIVE);
    removeKey(sessionStorage, KEY_SUMMARY);
    removeKey(sessionStorage, KEY_CURRENT);
  }

  // Live-conversation metadata (id + timestamps). Lazily created once the chat has messages.
  function currentMeta(history) {
    var meta = readJSON(sessionStorage, KEY_CURRENT, null);
    if (!history.length) {
      if (meta) removeKey(sessionStorage, KEY_CURRENT); // never reuse a stale id for the next conversation
      return null;
    }
    var last = history.length + ":" + turnText(history[history.length - 1]).length;
    if (!meta || !UUID_RE.test(String(meta.id || ""))) { // also replaces ids left over from older versions
      meta = { id: uid(), createdAt: Date.now(), updatedAt: Date.now(), sig: last };
      writeJSON(sessionStorage, KEY_CURRENT, meta);
    } else if (meta.sig !== last) {
      meta.sig = last;
      meta.updatedAt = Date.now();
      writeJSON(sessionStorage, KEY_CURRENT, meta);
    }
    return meta;
  }

  // ---------------------------------------------------------- saved history
  function liveSignature(history) {
    return history.length + ":" + turnText(history[history.length - 1]).length;
  }

  function setSaveError(msg) {
    remote.saveError = msg || "";
    render();
  }

  // Save the open conversation (debounced). Skips when nothing changed since the last successful save.
  function scheduleSave() {
    if (!History || remote.status === "unavailable") return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { flushSave(); }, SAVE_DELAY_MS);
  }

  function flushSave() {
    clearTimeout(saveTimer);
    if (!History || remote.status === "unavailable") return Promise.resolve();
    var history = liveHistory();
    if (!history.length) return savePromise;
    var meta = currentMeta(history);
    var sig = meta.id + "|" + liveSignature(history);
    if (sig === lastSavedSig) return savePromise;
    var title = titleFromHistory(history);
    savePromise = savePromise.then(function () {
      return History.save(meta.id, title, history);
    }).then(function (res) {
      if (res.ok) {
        lastSavedSig = sig;
        if (remote.saveError) setSaveError("");
      } else if (res.reason === "unavailable") {
        remote.status = "unavailable"; remote.message = res.message; render(); syncFoot();
      } else if (res.reason !== "signed-out") {
        setSaveError("This consultation couldn’t be saved to your account. It will be retried after your next message.");
      }
    });
    return savePromise;
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (resolve) { setTimeout(resolve, ms); })]);
  }

  function refreshRemote() {
    if (!History) { remote.status = "unavailable"; remote.message = "History is not available."; render(); syncFoot(); return Promise.resolve(); }
    remote.status = "loading"; render();
    return History.list().then(function (res) {
      if (res.ok) { remote.status = "ready"; remote.items = res.items; remote.message = ""; }
      else if (res.reason === "unavailable") { remote.status = "unavailable"; remote.items = []; remote.message = res.message; }
      else if (res.reason === "signed-out") { remote.status = "ready"; remote.items = []; }
      else { remote.status = "error"; remote.items = []; remote.message = res.message || "Couldn’t load your saved consultations."; }
      render(); syncFoot();
    });
  }

  function syncFoot() {
    var foot = document.getElementById("historyFoot");
    if (!foot) return;
    foot.textContent = "";
    var off = remote.status === "unavailable";
    foot.appendChild(el("strong", null, off ? "Not saved. " : "Saved to your account. "));
    foot.appendChild(document.createTextNode(off
      ? "Saved consultations aren’t available right now, so this conversation only lasts until you close this tab or sign out."
      : "Your consultations are saved to your SKINSIGHT account and listed only when you are signed in. Only the text of your messages is saved. Photos are never stored."));
  }

  // ------------------------------------------------------------- collection
  function collectItems() {
    var items = [];
    var history = liveHistory();
    var meta = currentMeta(history);
    if (meta) {
      items.push({ id: meta.id, kind: "live", title: titleFromHistory(history), updatedAt: meta.updatedAt, text: searchText(history) });
    }
    remote.items.forEach(function (c) {
      if (meta && c.id === meta.id) return; // the open conversation is already listed as "Current"
      items.push({ id: c.id, kind: "saved", title: c.title || titleFromHistory(c.messages || []), updatedAt: c.updatedAt || c.createdAt || 0, text: searchText(c.messages || []), ref: c });
    });
    return items;
  }

  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function groupLabel(ts) {
    var days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days <= 7) return "Previous 7 days";
    if (days <= 30) return "Previous 30 days";
    return "Earlier";
  }
  var GROUP_ORDER = ["Current", "Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Earlier"];

  function timeLabel(ts) {
    var days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
    var d = new Date(ts);
    if (days <= 1) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // ------------------------------------------------------------------ render
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function iconSvg(name) {
    var wrap = document.createElement("span");
    wrap.innerHTML = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>';
    return wrap.firstChild;
  }

  function renderItem(item) {
    var isActive = item.kind === "live";
    var li = el("li", "cs-item" + (isActive ? " is-active" : ""));
    li.setAttribute("data-id", item.id);

    if (state.confirmId === item.id) {
      li.className += " is-confirming";
      var box = el("div", "cs-confirm");
      box.setAttribute("role", "alertdialog");
      box.setAttribute("aria-label", "Confirm delete");
      box.appendChild(el("p", null, "Delete “" + item.title + "”?"));
      var actions = el("div", "cs-confirm-actions");
      var cancel = el("button", "btn btn-ghost", "Cancel");
      cancel.type = "button"; cancel.setAttribute("data-act", "cancel-delete");
      var ok = el("button", "btn btn-danger", "Delete");
      ok.type = "button"; ok.setAttribute("data-act", "confirm-delete");
      actions.appendChild(cancel); actions.appendChild(ok);
      box.appendChild(actions);
      li.appendChild(box);
      return li;
    }

    var open = el("button", "cs-open");
    open.type = "button";
    if (state.busyId === item.id) { open.disabled = true; open.setAttribute("aria-busy", "true"); }
    open.setAttribute("data-act", "open");
    if (isActive) open.setAttribute("aria-current", "true");
    open.appendChild(el("span", "cs-title", item.title));
    var meta = el("span", "cs-meta");
    var time = el("time", null, timeLabel(item.updatedAt));
    time.setAttribute("datetime", new Date(item.updatedAt).toISOString());
    time.title = new Date(item.updatedAt).toLocaleString();
    meta.appendChild(time);
    if (item.kind === "live") meta.appendChild(el("span", "cs-badge is-current", "Current"));
    open.appendChild(meta);
    li.appendChild(open);

    var del = el("button", "cs-del");
    del.type = "button";
    del.setAttribute("data-act", "delete");
    del.setAttribute("aria-label", "Delete conversation: " + item.title);
    del.appendChild(iconSvg("trash"));
    li.appendChild(del);
    return li;
  }

  function render() {
    var q = state.query.trim().toLowerCase();
    var all = collectItems();
    var items = q ? all.filter(function (i) { return i.title.toLowerCase().indexOf(q) !== -1 || i.text.indexOf(q) !== -1; }) : all;

    listEl.textContent = "";

    if (remote.saveError) {
      var warn = el("p", "cs-note is-error", remote.saveError);
      warn.setAttribute("role", "alert");
      listEl.appendChild(warn);
    }
    if (remote.status === "loading" && !all.length) {
      // Skeleton rows shaped like saved consultations; the hidden status line is what screen readers hear.
      var loading = el("p", "visually-hidden", "Loading your saved consultations…");
      loading.setAttribute("role", "status");
      listEl.appendChild(loading);
      var sk = el("div", "cs-skeleton");
      sk.setAttribute("aria-hidden", "true");
      for (var s = 0; s < 4; s++) {
        var row = el("div", "cs-sk-row");
        row.appendChild(el("span", "skeleton cs-sk-title"));
        row.appendChild(el("span", "skeleton cs-sk-date"));
        sk.appendChild(row);
      }
      listEl.appendChild(sk);
      return;
    }
    if (remote.status === "error") {
      var err = el("div", "cs-note is-error");
      err.setAttribute("role", "alert");
      err.appendChild(el("p", null, remote.message || "Couldn’t load your saved consultations."));
      var retry = el("button", "btn btn-ghost btn-sm", "Try again");
      retry.type = "button"; retry.setAttribute("data-act", "retry-load");
      err.appendChild(retry);
      listEl.appendChild(err);
    } else if (remote.status === "unavailable") {
      listEl.appendChild(el("p", "cs-note", "Saved consultations aren’t available right now. This conversation won’t be kept after you close the tab or sign out."));
    }

    if (!items.length) {
      var empty = el("div", "cs-empty");
      empty.appendChild(iconSvg(q ? "search" : "message"));
      if (q) {
        empty.appendChild(el("p", null, "No conversations match “" + state.query.trim() + "”."));
        var clear = el("button", "btn btn-ghost btn-sm", "Clear search");
        clear.type = "button"; clear.setAttribute("data-act", "clear-search");
        empty.appendChild(clear);
      } else {
        empty.appendChild(el("p", null, "No conversations yet. Start a new consultation to begin."));
      }
      listEl.appendChild(empty);
      announce(q ? "No conversations match your search." : "No conversations.");
      return;
    }

    var groups = {};
    items.forEach(function (item) {
      var g = item.kind === "live" ? "Current" : groupLabel(item.updatedAt);
      (groups[g] = groups[g] || []).push(item);
    });

    GROUP_ORDER.forEach(function (label) {
      if (!groups[label]) return;
      groups[label].sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      var section = el("section", "cs-group");
      var headingId = "cs-g-" + label.replace(/\W+/g, "-").toLowerCase();
      var h = el("h3", "cs-group-title", label);
      h.id = headingId;
      section.setAttribute("aria-labelledby", headingId);
      section.appendChild(h);
      var ul = el("ul", "cs-items");
      groups[label].forEach(function (item) { ul.appendChild(renderItem(item)); });
      section.appendChild(ul);
      listEl.appendChild(section);
    });

    announce(q ? items.length + (items.length === 1 ? " conversation matches" : " conversations match") + " your search." : "");
  }

  var announceTimer = null;
  function announce(msg) {
    if (!statusEl) return;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { statusEl.textContent = msg; }, 250);
  }

  function syncTitle() {
    var history = liveHistory();
    var title = history.length ? titleFromHistory(history) : "New consultation";
    if (titleEl) titleEl.textContent = title;
  }

  // ----------------------------------------------------------------- actions
  function reloadChat() { window.location.reload(); }

  function newConsultation() {
    // The current conversation is already saved after every reply; make sure the latest turn is flushed.
    withTimeout(flushSave(), 4000).then(function () {
      clearLive();
      reloadChat();
    });
  }

  function openItem(item) {
    if (item.kind === "live") { closeSidebarIfMobile(); return; }
    // Reopen a saved consultation: copy it into the "current conversation" that chat.js renders.
    state.busyId = item.id; render();
    announce("Opening consultation…");
    withTimeout(flushSave(), 4000).then(function () {
      return History.get(item.id);
    }).then(function (res) {
      state.busyId = null;
      if (!res || !res.ok) {
        remote.saveError = (res && res.message) || "Couldn’t open that consultation. Please try again.";
        render();
        return;
      }
      var t = res.item;
      writeJSON(sessionStorage, KEY_LIVE, t.messages);
      if (t.summary) writeJSON(sessionStorage, KEY_SUMMARY, t.summary); else removeKey(sessionStorage, KEY_SUMMARY);
      writeJSON(sessionStorage, KEY_CURRENT, { id: t.id, createdAt: t.createdAt, updatedAt: t.updatedAt, sig: liveSignature(t.messages) });
      lastSavedSig = t.id + "|" + liveSignature(t.messages);
      reloadChat();
    });
  }

  function deleteItem(item) {
    // Real consultation (saved or current): delete it from the account first, then update the screen.
    state.busyId = item.id; state.confirmId = null; render();
    var done = History && remote.status !== "unavailable" ? History.remove(item.id) : Promise.resolve({ ok: true });
    done.then(function (res) {
      state.busyId = null;
      if (res && !res.ok && res.reason !== "signed-out") {
        remote.saveError = "Couldn’t delete that consultation. Please try again.";
        render();
        return;
      }
      remote.items = remote.items.filter(function (c) { return c.id !== item.id; });
      if (item.kind === "live") { lastSavedSig = null; clearLive(); reloadChat(); return; }
      finishDelete();
    });
  }

  function finishDelete() {
    state.confirmId = null;
    render();
    syncTitle();
    var first = listEl.querySelector(".cs-open");
    (first || newBtn).focus();
  }

  function findItem(id) {
    return collectItems().filter(function (i) { return i.id === id; })[0] || null;
  }

  // ----------------------------------------------------------------- sidebar
  function setSidebar(open, opts) {
    opts = opts || {};
    app.setAttribute("data-sidebar", open ? "open" : "closed");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
    sidebar.inert = !open;
    // On small screens the drawer is modal: the conversation behind it is inert.
    shell.inert = !!(open && mobileMq.matches);
    if (!mobileMq.matches && !opts.skipSave) {
      try { localStorage.setItem(LS_SIDEBAR, open ? "open" : "closed"); } catch (e) { }
    }
    if (open && opts.focus) (newBtn || sidebar).focus();
    if (!open && opts.returnFocus && toggleBtn) toggleBtn.focus();
  }
  function isOpen() { return app.getAttribute("data-sidebar") === "open"; }
  function closeSidebarIfMobile() { if (mobileMq.matches && isOpen()) setSidebar(false, { returnFocus: true }); }

  function initSidebar() {
    var stored = null;
    try { stored = localStorage.getItem(LS_SIDEBAR); } catch (e) { }
    setSidebar(mobileMq.matches ? false : stored !== "closed", { skipSave: true });
    var onMq = function () { setSidebar(mobileMq.matches ? false : (function () { try { return localStorage.getItem(LS_SIDEBAR) !== "closed"; } catch (e) { return true; } })(), { skipSave: true }); };
    if (mobileMq.addEventListener) mobileMq.addEventListener("change", onMq); else if (mobileMq.addListener) mobileMq.addListener(onMq);

    if (toggleBtn) toggleBtn.addEventListener("click", function () { setSidebar(!isOpen(), { focus: true, returnFocus: true }); });
    if (closeBtn) closeBtn.addEventListener("click", function () { setSidebar(false, { returnFocus: true }); });
    if (backdrop) backdrop.addEventListener("click", function () { setSidebar(false, { returnFocus: true }); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (state.confirmId) { var id = state.confirmId; state.confirmId = null; render(); focusDeleteButton(id); return; }
      if (mobileMq.matches && isOpen()) setSidebar(false, { returnFocus: true });
    });
  }

  function focusDeleteButton(id) {
    var li = listEl.querySelector('.cs-item[data-id="' + id + '"] .cs-del');
    if (li) li.focus();
  }

  function initHistory() {
    if (newBtn) newBtn.addEventListener("click", newConsultation);

    searchInput.addEventListener("input", function () { state.query = searchInput.value; state.confirmId = null; render(); });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && searchInput.value) { e.stopPropagation(); searchInput.value = ""; state.query = ""; render(); }
    });

    listEl.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (act === "clear-search") { searchInput.value = ""; state.query = ""; render(); searchInput.focus(); return; }
      if (act === "retry-load") { refreshRemote(); return; }
      var li = btn.closest(".cs-item");
      var id = li && li.getAttribute("data-id");
      if (!id) return;
      if (act === "open") { var it = findItem(id); if (it) openItem(it); }
      else if (act === "delete") { state.confirmId = id; render(); var cancel = listEl.querySelector('.cs-item[data-id="' + id + '"] [data-act="cancel-delete"]'); if (cancel) cancel.focus(); }
      else if (act === "cancel-delete") { state.confirmId = null; render(); focusDeleteButton(id); }
      else if (act === "confirm-delete") { var target = findItem(id); if (target) deleteItem(target); }
    });
  }

  // -------------------------------------------------------- composer & chat
  function autosize() {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 168) + "px";
  }

  function initComposer() {
    if (!textarea) return;
    textarea.addEventListener("input", autosize);
    if (sendBtn) sendBtn.addEventListener("click", function () { requestAnimationFrame(autosize); });

    Array.prototype.forEach.call(document.querySelectorAll(".chat-starter"), function (b) {
      b.addEventListener("click", function () {
        textarea.value = b.getAttribute("data-prompt") || b.textContent;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      });
    });

    // Attach toggle: a real <button aria-expanded>. chat.js (which we do not modify) closes the panel after a
    // file is picked by assigning `attachToggle.checked = false`, so expose `checked` as a view of aria-expanded.
    if (attachToggle) {
      Object.defineProperty(attachToggle, "checked", {
        configurable: true,
        get: function () { return this.getAttribute("aria-expanded") === "true"; },
        set: function (v) { this.setAttribute("aria-expanded", v ? "true" : "false"); }
      });
      attachToggle.addEventListener("click", function () { attachToggle.checked = !attachToggle.checked; });
      attachToggle.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && attachToggle.checked) attachToggle.checked = false;
      });
    }
  }

  function updateChatState() {
    var hasMessages = !!chatBody.querySelector(".msg-user, .msg-photo-wrap");
    shell.classList.toggle("has-messages", hasMessages);

    // Visually distinguish connection / session errors that chat.js renders as AI bubbles.
    Array.prototype.forEach.call(chatBody.querySelectorAll(".msg-ai:not([data-ui-checked])"), function (m) {
      m.setAttribute("data-ui-checked", "1");
      var t = (m.textContent || "").trim();
      if (t.indexOf("⚠") === 0 || t.indexOf("🔒") === 0) m.classList.add("msg-error");
    });
  }

  var refreshQueued = false;
  function onChatChanged() {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(function () {
      refreshQueued = false;
      updateChatState();
      autosize();
      render();   // chat.js stores history right after rendering a reply; keep the list in step
      syncTitle();
      scheduleSave();
    }, 0);
  }

  // Keep the newest message in view when the composer area changes height
  // (photo preview appears, summary CTA shows, textarea grows) — only if the user was already at the bottom.
  function initScrollPinning() {
    var pinned = true;
    chatBody.addEventListener("scroll", function () {
      pinned = chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight < 80;
    }, { passive: true });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { if (pinned) chatBody.scrollTop = chatBody.scrollHeight; }).observe(chatBody);
    }
  }

  // -------------------------------------------------------------------- init
  function init() {
    initScrollPinning();
    initSidebar();
    initHistory();
    initComposer();
    updateChatState();
    removeKey(sessionStorage, KEY_CONVOS_LEGACY);
    removeKey(sessionStorage, KEY_HIDDEN_LEGACY);
    var existing = liveHistory();
    if (existing.length) currentMeta(existing);
    render();
    syncTitle();
    autosize();
    syncFoot();
    refreshRemote().then(function () { if (existing.length) scheduleSave(); });
    new MutationObserver(onChatChanged).observe(chatBody, { childList: true });

    // Restored from bfcache or signed out in another tab.
    window.addEventListener("pageshow", function () { updateChatState(); render(); syncTitle(); });
    window.addEventListener("storage", function (e) { if (e.key === "skinsight_user" && !e.newValue) { render(); syncTitle(); } });
  }

  init();

})();
