# Operation PAWS AI Implementation Guide
## Deploying the Executive Response Model & Agentic Upgrades

This guide explains how to activate the police-grade explainability and agentic search capabilities.

## 1. Database Enhancements
Run the following SQL in your Supabase editor to ensure audit trails are robust:

```sql
-- Create AI reasoning log table
CREATE TABLE IF NOT EXISTS paws_ai_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id uuid NOT NULL,
  agent_id text NOT NULL,
  reasoning_chain jsonb NOT NULL,
  evidence_pyramid jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookup during inquiries
CREATE INDEX IF NOT EXISTS idx_ai_audit_interaction ON paws_ai_audit(interaction_id);
```

## 2. Setting Up Web Search (Agentic Capability)
To enable the AI to search the news:
1. Get an API key from a provider like **Serper.dev** or **Tavily**.
2. Add it to your Supabase secrets:
   `supabase secrets set SEARCH_API_KEY=your_key_here`
3. Update your Edge Function to call the search API when the AI determines it needs external info.

## 3. Connecting the Prompts
Update your AI router (e.g., `tech/ai/prompts/MASTER_SYSTEM_PROMPT.md`) to reference the new models:
- Include the `EXECUTIVE_RESPONSE_MODEL.md` as a global constraint.
- Use `UPGRADED_COMMISSIONER_AGENT.md` for all high-level command interactions.

## 4. Verification
Test the system with this prompt:
"How does our current K9 health status compare to the latest SAPS national wellness standards from 2024?"

The AI should:
1. Search the web for SAPS standards.
2. Query internal paws_dogs data.
3. Provide a response with the Evidence Pyramid.
