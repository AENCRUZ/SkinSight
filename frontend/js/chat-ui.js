/*
 * SKINSIGHT — Chat UI enhancements + conversation history sidebar
 *
 * FRONTEND ONLY. No network calls, no new API integrations.
 *
 * chat.js keeps the live conversation in sessionStorage ("skinsight_chat_history")
 * and talks to the backend. This file never touches that contract; it only:
 *   - lays out and drives the history sidebar (collapse, search, grouping, delete)
 *   - lets users start a new consultation and revisit earlier ones from THIS
 *     browser session (kept in sessionStorage under skinsight_ui_* keys, so they
 *     vanish when the tab closes or the user signs out — auth.js clears sessionStorage)
 *   - shows clearly labelled SAMPLE conversations (mock data, read-only preview;
 *     never loaded into the live chat, so fake transcripts are never sent to the AI)
 *   - starter prompts, auto-growing composer, attach-menu accessibility, error styling
 *
 * BACKEND WORK NEEDED FOR REAL, PERSISTENT HISTORY (not implemented here):
 *   see "REAL_HISTORY_API" at the bottom of this file.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------- constants
  var KEY_LIVE = "skinsight_chat_history";             // owned by chat.js (read/write only to restore a saved chat)
  var KEY_SUMMARY = "skinsight_consultation_summary";  // owned by summary.js (cleared when the live chat changes)
  var KEY_CONVOS = "skinsight_ui_convos";              // archived conversations from this session
  var KEY_CURRENT = "skinsight_ui_current";            // metadata of the live conversation
  var KEY_HIDDEN = "skinsight_ui_mock_hidden";         // sample conversations the user deleted
  var LS_SIDEBAR = "skinsight_ui_sidebar";             // per-viewer convenience: "open" | "closed"
  var MAX_SAVED = 30;

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
  var previewEl = document.getElementById("chatPreview");
  var textarea = document.querySelector(".chat-inputbar textarea");
  var sendBtn = document.querySelector(".chat-inputbar button.send");
  var attachToggle = document.getElementById("attach-toggle");
  var mobileMq = window.matchMedia("(max-width: 900px)");

  var state = { query: "", preview: null, confirmId: null, lastFocusId: null };

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
  function uid() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------------------------------------------------------------- mock data
  // MOCK DATA — clearly labelled "Sample" in the UI. Replace with real history from the
  // API once persistent conversations exist (see REAL_HISTORY_API).
  function buildMocks() {
    var H = 3600 * 1000, D = 24 * H, now = Date.now();
    return [
      { id: "mock-1", title: "Dry patches around my nose", updatedAt: now - 2.5 * H, messages: [
        ["user", "I've had dry, flaky patches around my nose for about a week."],
        ["ai", "Thanks for sharing that. To organize this for your dermatologist: is the skin itchy, burning or tender? And have you changed any skincare products recently?"],
        ["user", "Slightly itchy. I started a new moisturizer last week."],
        ["ai", "Noted: dry, flaky patches around the nose for about a week, mild itching, and a new moisturizer started a week ago. Would you like to add a photo before I prepare your summary?"] ] },
      { id: "mock-2", title: "Itchy rash on my forearm", updatedAt: now - 1 * D - 3 * H, messages: [
        ["user", "There's a red, itchy rash on my left forearm that appeared two days ago."],
        ["ai", "I'm sorry it's bothering you. Has anything new touched that area, such as a plant, a detergent, jewelry or a new lotion?"],
        ["user", "I did some gardening the day before."],
        ["ai", "Thank you. I'll record the timing, location and the gardening as a possible trigger so you can discuss it with your dermatologist."] ] },
      { id: "mock-3", title: "Acne flare on my jawline", updatedAt: now - 3 * D, messages: [
        ["user", "My acne is getting worse along my jawline this month."],
        ["ai", "Let's document that. Roughly when did the flare begin, and have there been any changes in stress, sleep, diet or products?"],
        ["user", "About three weeks ago, right when exams started."] ] },
      { id: "mock-4", title: "Scalp flaking and redness", updatedAt: now - 12 * D, messages: [
        ["user", "My scalp is flaking and red behind my ears."],
        ["ai", "Thanks. Is it itchy, and does it get better or worse after washing your hair? I'll note what you share for your visit."] ] },
      { id: "mock-5", title: "Questions about a changing mole", updatedAt: now - 41 * D, messages: [
        ["user", "I have a mole on my back that looks darker than before."],
        ["ai", "A change like that is worth showing a professional. I can't assess it, but I can organize when you noticed the change and any other details to bring to a dermatologist."] ] }
    ];
  }
  var MOCKS = buildMocks();

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
    return Array.isArray(h) ? h : [];
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
    if (!meta || !meta.id) {
      meta = { id: uid(), createdAt: Date.now(), updatedAt: Date.now(), sig: last };
      writeJSON(sessionStorage, KEY_CURRENT, meta);
    } else if (meta.sig !== last) {
      meta.sig = last;
      meta.updatedAt = Date.now();
      writeJSON(sessionStorage, KEY_CURRENT, meta);
    }
    return meta;
  }

  function savedConvos() {
    var c = readJSON(sessionStorage, KEY_CONVOS, []);
    return Array.isArray(c) ? c : [];
  }
  function hiddenMocks() {
    var h = readJSON(sessionStorage, KEY_HIDDEN, []);
    return Array.isArray(h) ? h : [];
  }

  // Move the live conversation into the archive (no-op when empty).
  function archiveLive() {
    var history = liveHistory();
    if (!history.length) return;
    var meta = currentMeta(history);
    var saved = savedConvos().filter(function (c) { return c.id !== meta.id; });
    saved.unshift({ id: meta.id, title: titleFromHistory(history), createdAt: meta.createdAt, updatedAt: meta.updatedAt, history: history });
    writeJSON(sessionStorage, KEY_CONVOS, saved.slice(0, MAX_SAVED));
  }

  // ------------------------------------------------------------- collection
  function collectItems() {
    var items = [];
    var history = liveHistory();
    var meta = currentMeta(history);
    if (meta) {
      items.push({ id: meta.id, kind: "live", title: titleFromHistory(history), updatedAt: meta.updatedAt, text: searchText(history) });
    }
    savedConvos().forEach(function (c) {
      items.push({ id: c.id, kind: "saved", title: c.title || titleFromHistory(c.history || []), updatedAt: c.updatedAt || c.createdAt || 0, text: searchText(c.history || []), ref: c });
    });
    var hidden = hiddenMocks();
    MOCKS.forEach(function (m) {
      if (hidden.indexOf(m.id) !== -1) return;
      items.push({ id: m.id, kind: "mock", title: m.title, updatedAt: m.updatedAt, text: m.messages.map(function (x) { return x[1]; }).join(" ").toLowerCase(), ref: m });
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
    var isActive = item.kind === "live" ? !state.preview : state.preview === item.id;
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
    open.setAttribute("data-act", "open");
    if (isActive) open.setAttribute("aria-current", "true");
    open.appendChild(el("span", "cs-title", item.title));
    var meta = el("span", "cs-meta");
    var time = el("time", null, timeLabel(item.updatedAt));
    time.setAttribute("datetime", new Date(item.updatedAt).toISOString());
    time.title = new Date(item.updatedAt).toLocaleString();
    meta.appendChild(time);
    if (item.kind === "mock") meta.appendChild(el("span", "cs-badge is-sample", "Sample"));
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
        if (hiddenMocks().length) {
          var show = el("button", "btn btn-ghost btn-sm", "Show sample conversations");
          show.type = "button"; show.setAttribute("data-act", "restore-samples");
          empty.appendChild(show);
        }
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
    var title = state.preview
      ? ((MOCKS.filter(function (m) { return m.id === state.preview; })[0] || {}).title || "Sample conversation") + " (sample)"
      : history.length ? titleFromHistory(history) : "New consultation";
    if (titleEl) titleEl.textContent = title;
  }

  // ----------------------------------------------------------------- actions
  function reloadChat() { window.location.reload(); }

  function newConsultation() {
    archiveLive();
    clearLive();
    reloadChat();
  }

  function openItem(item) {
    if (item.kind === "mock") { showPreview(item.ref); closeSidebarIfMobile(); return; }
    if (item.kind === "live") { hidePreview(); closeSidebarIfMobile(); return; }
    // Restore an archived conversation of this session into the live chat.
    var target = item.ref;
    archiveLive();
    var remaining = savedConvos().filter(function (c) { return c.id !== target.id; });
    writeJSON(sessionStorage, KEY_CONVOS, remaining);
    writeJSON(sessionStorage, KEY_LIVE, target.history || []);
    removeKey(sessionStorage, KEY_SUMMARY);
    var last = (target.history || []).length + ":" + turnText((target.history || [])[(target.history || []).length - 1]).length;
    writeJSON(sessionStorage, KEY_CURRENT, { id: target.id, createdAt: target.createdAt || Date.now(), updatedAt: target.updatedAt || Date.now(), sig: last });
    reloadChat();
  }

  function deleteItem(item) {
    if (item.kind === "mock") {
      var hidden = hiddenMocks(); hidden.push(item.id);
      writeJSON(sessionStorage, KEY_HIDDEN, hidden);
      if (state.preview === item.id) hidePreview();
    } else if (item.kind === "saved") {
      writeJSON(sessionStorage, KEY_CONVOS, savedConvos().filter(function (c) { return c.id !== item.id; }));
    } else if (item.kind === "live") {
      clearLive();
      reloadChat();
      return;
    }
    state.confirmId = null;
    render();
    syncTitle();
    var first = listEl.querySelector(".cs-open");
    (first || newBtn).focus();
  }

  function findItem(id) {
    return collectItems().filter(function (i) { return i.id === id; })[0] || null;
  }

  // ------------------------------------------------------- sample preview
  function showPreview(mock) {
    state.preview = mock.id;
    previewEl.textContent = "";

    var banner = el("div", "chat-preview-banner");
    banner.setAttribute("tabindex", "-1");
    banner.appendChild(el("strong", null, "Sample conversation"));
    banner.appendChild(el("p", null, "This is demo data showing how saved consultations will look. It isn't your conversation, isn't sent to the assistant, and can't be continued."));
    previewEl.appendChild(banner);

    var thread = el("div", "chat-preview-thread");
    thread.setAttribute("role", "log");
    thread.setAttribute("tabindex", "0"); // scrollable region must be reachable by keyboard
    thread.setAttribute("aria-label", "Sample conversation: " + mock.title);
    mock.messages.forEach(function (m) {
      thread.appendChild(el("div", "msg " + (m[0] === "user" ? "msg-user" : "msg-ai"), m[1]));
    });
    previewEl.appendChild(thread);

    var actions = el("div", "chat-preview-actions");
    var back = el("button", "btn btn-primary", "Back to my consultation");
    back.type = "button"; back.addEventListener("click", function () { hidePreview(); textarea && textarea.focus(); });
    var fresh = el("button", "btn btn-secondary", "Start a new consultation");
    fresh.type = "button"; fresh.addEventListener("click", newConsultation);
    actions.appendChild(back); actions.appendChild(fresh);
    previewEl.appendChild(actions);

    shell.classList.add("is-previewing");
    render();
    syncTitle();
    banner.focus({ preventScroll: true });
  }

  function hidePreview() {
    if (!state.preview) return;
    state.preview = null;
    shell.classList.remove("is-previewing");
    previewEl.textContent = "";
    render();
    syncTitle();
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
      if (act === "restore-samples") { removeKey(sessionStorage, KEY_HIDDEN); render(); return; }
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
    render();
    syncTitle();
    autosize();
    new MutationObserver(onChatChanged).observe(chatBody, { childList: true });

    // Restored from bfcache or signed out in another tab.
    window.addEventListener("pageshow", function () { updateChatState(); render(); syncTitle(); });
    window.addEventListener("storage", function (e) { if (e.key === "skinsight_user" && !e.newValue) { render(); syncTitle(); } });
  }

  init();

  /*
   * REAL_HISTORY_API — what the backend would need before this can be real
   * -----------------------------------------------------------------------
   * Data (Supabase/Postgres, row-level security keyed on auth.uid()):
   *   conversations(id uuid, user_id uuid, title text, created_at, updated_at, deleted_at)
   *   messages(id, conversation_id, role 'user'|'model', content text, image_path text null, created_at)
   *   summaries(conversation_id, json, created_at)            -- replaces the sessionStorage summary cache
   *   Storage bucket for skin photos (private, signed URLs, size/type limits, lifecycle/retention).
   * Endpoints (all behind requireAuth; strict auth, no guest fallback):
   *   GET    /api/conversations?cursor=&q=      list newest-first, paginated, full-text search (tsvector)
   *   POST   /api/conversations                 create -> { id }
   *   GET    /api/conversations/:id             conversation + messages
   *   PATCH  /api/conversations/:id             rename / auto-title
   *   DELETE /api/conversations/:id             soft delete now, hard-delete job + image purge later
   *   POST   /api/chat/message                  accept conversation_id; load history server-side
   *                                             (stops trusting client-supplied history/roles)
   * Also: LLM-generated titles, per-user quotas, account-deletion cascade, consent + retention
   * policy for health data, audit logging, and an export-my-data path.
   */
})();
