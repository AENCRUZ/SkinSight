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

window.supabaseClient = (function () {
  if (typeof window.supabase === "undefined") {
    console.warn("Supabase library not loaded. Make sure the @supabase/supabase-js script is included.");
    return null;
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
