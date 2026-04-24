// docs/config.js
// Public config for Operation PAWS. 
// Security is handled via Row Level Security (RLS) and Edge Function validation.

window.PAWS_CONFIG = {
  PROJECT_REF: "dorihyvbgbhsxvdrtqqr",
  SUPABASE_URL: "https://dorihyvbgbhsxvdrtqqr.supabase.co",

  // "anon public" key from Supabase Dashboard -> Project Settings -> API
  // Safe to expose in browser when RLS is active.
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcmloeXZiZ2Joc3h2ZHJ0cXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTM5NzE0MDAsImV4cCI6MjAzNTU0NzQwMH0.7vV6Y5p3M9X_p7f6_mQ5n_Q5f7f_mQ5n_Q5f7f_mQ5n_Q5f7", 
};
