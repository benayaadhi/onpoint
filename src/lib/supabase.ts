import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ivwlszqdnlebpnaofqce.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2d2xzenFkbmxlYnBuYW9mcWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTE4MDEsImV4cCI6MjA5MTI4NzgwMX0.cCnzbs7L3yPBjmhNLetsQ4uC_bv0YBLB7bI4CFgjhvQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
