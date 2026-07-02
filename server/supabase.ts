import ws from "ws";
// Node < 22 lacks native WebSocket; provide it before creating the client.
if (!(globalThis as any).WebSocket) {
  (globalThis as any).WebSocket = ws as any;
}

import { createClient } from "@supabase/supabase-js";

// Fallback values baked in for published sandbox environment
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default supabase;
