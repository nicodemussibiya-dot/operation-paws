-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Chunks Table
CREATE TABLE IF NOT EXISTS paws_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL, -- e.g. '01_GOVERNANCE.md'
    content TEXT NOT NULL,
    embedding vector(768), -- 768 matches Gemini text-embedding-004 default
    access_level TEXT DEFAULT 'public' CHECK (access_level IN ('public', 'restricted')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for similarity search
CREATE INDEX ON paws_knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- RPC for matching knowledge
CREATE OR REPLACE FUNCTION match_paws_knowledge(
    query_embedding vector(768),
    match_count INT DEFAULT 5,
    min_similarity FLOAT DEFAULT 0.5,
    p_access_level TEXT DEFAULT 'public'
)
RETURNS TABLE (
    id UUID,
    source TEXT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pkc.id,
        pkc.source,
        pkc.content,
        1 - (pkc.embedding <=> query_embedding) AS similarity
    FROM paws_knowledge_chunks pkc
    WHERE (pkc.access_level = 'public' OR p_access_level = 'restricted')
      AND 1 - (pkc.embedding <=> query_embedding) > min_similarity
    ORDER BY pkc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
