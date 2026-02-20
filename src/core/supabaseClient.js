import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export function getSupabaseFromWindowConfig(){
  const cfg = window.SIPRA_CONFIG || {};
  const SUPABASE_URL = (cfg.SUPABASE_URL || "").trim();
  const SUPABASE_ANON_KEY = (cfg.SUPABASE_ANON_KEY || "").trim();
  const hasConfig = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  const supabase = hasConfig ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  return { cfg, SUPABASE_URL, SUPABASE_ANON_KEY, hasConfig, supabase };
}
