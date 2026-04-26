-- Migration: 011_public_chat_security.sql
-- Goal: Secure the public chat endpoint with rate limiting to prevent API abuse.

CREATE TABLE IF NOT EXISTS paws_chat_rate_limit (
    ip_hash text PRIMARY KEY,
    attempts int DEFAULT 1,
    last_attempt timestamptz DEFAULT now(),
    blocked_until timestamptz
);

-- Enable RLS (only service role can read/write)
ALTER TABLE paws_chat_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on chat rate limit"
    ON paws_chat_rate_limit
    TO service_role
    USING (true)
    WITH CHECK (true);
