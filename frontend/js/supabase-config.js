// Supabase Configuration 

const SUPABASE_URL = "https://bckznfjabfdqziybgorh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJja3puZmphYmZkcXppeWJnb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MzgxNzksImV4cCI6MjEwOTQxNDE3OX0.UJo9WmPLCyEMZU_vVHYRRh-tVsYhgyvOQ1ePTe1pgec";

function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL === "string" &&
    typeof SUPABASE_ANON_KEY === "string" &&
    !SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
  );
}

/**
 * Dynamic Storage Adapter for Supabase Auth:
 * - If "Keep me signed in" is checked (skinsight_remember_me === "true"), tokens persist in localStorage (permanent across restarts).
 * - If unchecked (default), tokens stay in sessionStorage (automatically wiped out when browser/tab closes).
 * - If not remembered, any orphan auth tokens in localStorage are cleaned up on startup.
 */
var skinsightAuthStorage = {
  isRemembered: function () {
    try {
      return localStorage.getItem("skinsight_remember_me") === "true";
    } catch (e) {
      return false;
    }
  },
  getItem: function (key) {
    try {
      if (this.isRemembered()) {
        return localStorage.getItem(key) || sessionStorage.getItem(key);
      }
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: function (key, value) {
    try {
      if (this.isRemembered()) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch (e) {}
  },
  removeItem: function (key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (e) {}
  }
};

// Automatic cleanup of orphan tokens from localStorage if "Keep me signed in" was not checked
(function () {
  try {
    if (localStorage.getItem("skinsight_remember_me") !== "true") {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && (k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1 || k === "skinsight_user")) {
          localStorage.removeItem(k);
        }
      }
    }
  } catch (e) {}
})();

window.supabaseClient = (function () {
  if (typeof window.supabase === "undefined") {
    console.warn("Supabase library not loaded. Make sure the @supabase/supabase-js script is included.");
    return null;
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: skinsightAuthStorage,
      persistSession: true,
      autoRefreshToken: true
    }
  });
})();
