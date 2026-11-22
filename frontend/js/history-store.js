/*
 * SKINSIGHT — saved consultations (conversation history)
 *
 * Stores each consultation as ONE row in the Supabase table `public.consultations`
 * (see supabase/migrations/001_consultations.sql). The browser talks to Supabase directly with the signed-in
 * user's session; Row Level Security on the table guarantees a user can only read or change their own rows.
 *
 * What is saved: chat text (user + assistant), a title and the generated summary. Photos are never stored:
 * a photo turn is the text "[Image Attached]".
 *
 * Every method resolves to { ok: true, ... } or { ok: false, reason, message } and never throws:
 *   reason "signed-out"  -> nobody is logged in
 *   reason "unavailable" -> the table does not exist yet (migration not run) or Supabase is not loaded
 *   reason "error"       -> network / permission / other failure
 */
(function () {
  "use strict";

  var TABLE = "consultations";
  var MAX_TURNS = 100;
  var MAX_TURN_CHARS = 8000;
  var LIST_LIMIT = 50;

  function client() { return window.supabaseClient || null; }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    var b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  function fail(err, fallbackReason) {
    var msg = (err && err.message) || "Request failed";
    var code = (err && err.code) || "";
    var missing = code === "PGRST205" || code === "42P01" || /does not exist|schema cache|Could not find the table/i.test(msg);
    return {
      ok: false,
      reason: missing ? "unavailable" : (fallbackReason || "error"),
      message: missing ? "Saved consultations are not set up on this server yet." : msg
    };
  }

  async function activeUser() {
    var c = client();
    if (!c || !c.auth) return { ok: false, reason: "unavailable", message: "Sign-in service is not loaded." };
    try {
      var res = await c.auth.getSession();
      var session = res && res.data && res.data.session;
      if (!session || !session.user) return { ok: false, reason: "signed-out", message: "Not signed in." };
      return { ok: true, client: c, userId: session.user.id };
    } catch (e) {
      return fail(e);
    }
  }

  // Older versions saved the retrieved reference text (it starts with a long "=====" banner) as if the user had
  // written it, followed by a duplicate reply. Drop those turns so titles and chats show only real messages.
  var REFERENCE_BANNER = /^=+\s*VERIFIED CLINICAL INTAKE KNOWLEDGE BASE/i;
  function turnTextOf(t) {
    if (!t || typeof t !== "object") return "";
    if (Array.isArray(t.parts)) return t.parts.map(function (p) { return typeof p === "string" ? p : (p && p.text) || ""; }).join(" ");
    if (typeof t.text === "string") return t.text;
    return typeof t.content === "string" ? t.content : "";
  }
  function stripReferenceArtifacts(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var t = arr[i];
      var isModel = function (x) { return x && (x.role === "model" || x.role === "assistant" || x.role === "ai"); };
      if (t && !isModel(t) && REFERENCE_BANNER.test(turnTextOf(t).trim())) {
        if (isModel(arr[i + 1])) i++;
        continue;
      }
      out.push(t);
    }
    return out;
  }

  // Accept only well-formed turns, whatever came back from the database.
  function cleanMessages(raw) {
    if (!Array.isArray(raw)) return [];
    raw = stripReferenceArtifacts(raw);
    var out = [];
    raw.slice(0, MAX_TURNS).forEach(function (t) {
      if (!t || typeof t !== "object") return;
      var text = "";
      if (Array.isArray(t.parts)) text = t.parts.map(function (p) { return p && typeof p.text === "string" ? p.text : ""; }).join(" ");
      else if (typeof t.text === "string") text = t.text;
      text = text.trim().slice(0, MAX_TURN_CHARS);
      if (!text) return;
      out.push({ role: t.role === "model" || t.role === "assistant" || t.role === "ai" ? "model" : "user", parts: [{ text: text }] });
    });
    return out;
  }

  // A title saved by an older version may be just a run of "=" characters (the start of the leaked reference text).
  // Show the first real user message instead.
  function displayTitle(title, messages) {
    var t = String(title || "").trim();
    if (t && !/^[=\-_\s.…]{6,}$/.test(t)) return t;
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === "user") {
        var s = messages[i].parts[0].text.replace(/\s+/g, " ").trim();
        if (s && s !== "[Image Attached]") return s.length > 46 ? s.slice(0, 45).trimEnd() + "…" : s;
        if (s === "[Image Attached]") return "Photo consultation";
      }
    }
    return "New consultation";
  }

  function cleanSummary(raw) {
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  }

  function toTime(v) {
    var t = Date.parse(v);
    return isNaN(t) ? Date.now() : t;
  }

  /** List the signed-in user's consultations, newest first (messages included so the sidebar can search). */
  async function list() {
    var who = await activeUser();
    if (!who.ok) return who;
    try {
      var res = await who.client
        .from(TABLE)
        .select("id,title,messages,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (res.error) return fail(res.error);
      return {
        ok: true,
        items: (res.data || []).map(function (r) {
          var msgs = cleanMessages(r.messages);
          return {
            id: r.id,
            title: displayTitle(r.title, msgs),
            messages: msgs,
            createdAt: toTime(r.created_at),
            updatedAt: toTime(r.updated_at)
          };
        })
      };
    } catch (e) { return fail(e); }
  }

  /** Load one consultation, including its saved summary. */
  async function get(id) {
    var who = await activeUser();
    if (!who.ok) return who;
    try {
      var res = await who.client.from(TABLE).select("id,title,messages,summary,created_at,updated_at").eq("id", id).maybeSingle();
      if (res.error) return fail(res.error);
      if (!res.data) return { ok: false, reason: "error", message: "That consultation could not be found." };
      var r = res.data;
      return {
        ok: true,
        item: {
          id: r.id, title: displayTitle(r.title, cleanMessages(r.messages)), messages: cleanMessages(r.messages), summary: cleanSummary(r.summary),
          createdAt: toTime(r.created_at), updatedAt: toTime(r.updated_at)
        }
      };
    } catch (e) { return fail(e); }
  }

  /** Create or update a consultation's title and messages (the summary column is left untouched). */
  async function save(id, title, messages) {
    var who = await activeUser();
    if (!who.ok) return who;
    var clean = cleanMessages(messages);
    if (!clean.length) return { ok: true, skipped: true };
    try {
      var res = await who.client.from(TABLE).upsert(
        { id: id, title: String(title || "New consultation").slice(0, 120), messages: clean },
        { onConflict: "id" }
      );
      if (res.error) return fail(res.error);
      return { ok: true };
    } catch (e) { return fail(e); }
  }

  /** Attach the generated summary to an existing consultation. */
  async function saveSummary(id, summary) {
    var who = await activeUser();
    if (!who.ok) return who;
    var clean = cleanSummary(summary);
    if (!clean || !id) return { ok: true, skipped: true };
    try {
      var res = await who.client.from(TABLE).update({ summary: clean }).eq("id", id);
      if (res.error) return fail(res.error);
      return { ok: true };
    } catch (e) { return fail(e); }
  }

  async function remove(id) {
    var who = await activeUser();
    if (!who.ok) return who;
    try {
      var res = await who.client.from(TABLE).delete().eq("id", id);
      if (res.error) return fail(res.error);
      return { ok: true };
    } catch (e) { return fail(e); }
  }

  window.SkinsightHistory = { stripReferenceArtifacts: stripReferenceArtifacts, list: list, get: get, save: save, saveSummary: saveSummary, remove: remove, newId: uuid };
})();
