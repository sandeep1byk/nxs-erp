import ws from "ws";
// Node < 22 lacks native WebSocket; provide it before creating the client.
if (!(globalThis as any).WebSocket) {
  (globalThis as any).WebSocket = ws as any;
}

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "placeholder-key";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default supabase;
