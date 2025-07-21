import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eaeulxmxiwnxopnjrvun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZXVseG14aXdueG9wbmpydnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNzk5MDgsImV4cCI6MjA2ODY1NTkwOH0.BjA12kPMeYN8HSy35itqKcYUYaCXJQ-i_YM4ajVPVeo';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
}); 