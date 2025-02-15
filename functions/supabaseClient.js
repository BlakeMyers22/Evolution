// functions/supabaseClient.js
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

// For Node < 18, we explicitly define global fetch
if (!global.fetch) {
  global.fetch = fetch;
}

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return supabase;
}

module.exports = { getSupabase };

