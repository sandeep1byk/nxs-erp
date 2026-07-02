import ws from "ws";
// Node < 22 lacks native WebSocket; provide it before creating the client.
if (!(globalThis as any).WebSocket) {
  (globalThis as any).WebSocket = ws as any;
}

import { createClient } from "@supabase/supabase-js";

// Fallback values baked in for published sandbox environment
const supabaseUrl = process.env.SUPABASE_URL || "https://sqpjjlbcimkbbragdjjs.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcGpqbGJjaW1rYmJyYWdkampzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODE3NzIsImV4cCI6MjA5ODU1Nzc3Mn0.o0sjjC8-UUi58ghbCwd7L4ngG8h5NNzrcoLakw2hfqg";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default supabase;
