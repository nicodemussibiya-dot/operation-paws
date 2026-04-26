// docs/config.js
// Public config for Operation PAWS. 
// Security is handled via Row Level Security (RLS) and Edge Function validation.

window.PAWS_CONFIG = {
  PROJECT_REF: "local-demo",
  SUPABASE_URL: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
    ? "http://127.0.0.1:54321" 
    : "https://dorihyvbgbhsxvdrtqqr.supabase.co", // Replace with your real URL in production

  // "anon public" key from Supabase Dashboard -> Project Settings -> API
  // Safe to expose in browser when RLS is active.
  SUPABASE_ANON_KEY: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsLWRlbW8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcxMzk3MTQwMCwiZXhwIjo0ODY3NTcxNDAwfQ.example"
    : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcmloeXZiZ2Joc3h2ZHJ0cXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTM5NzE0MDAsImV4cCI6MjAzNTU0NzQwMH0.7vV6Y5p3M9X_p7f6_mQ5n_Q5f7f_mQ5n_Q5f7f_mQ5n_Q5f7", 
};
