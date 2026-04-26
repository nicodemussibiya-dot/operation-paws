# Operation PAWS — AI Security & Data Boundary Policy

This document defines the security guardrails for all AI agents and LLM integrations within the Operation PAWS ecosystem.

## 1. The "Open-Source Code, Closed System" AI Model
All AI agents must be instructed that:
- The codebase and schemas they see are **PUBLIC**.
- The real data, secrets, and deployment environments are **PRIVATE**.
- They must NEVER speculate on or attempt to reveal production secrets.

## 2. PII & Data Sensitivity
AI agents are **PROHIBITED** from:
- Requesting or outputting Names, Phone Numbers, Addresses, or Microchip numbers.
- Accessing raw `paws_dogs` records (unless through a privacy-preserving anonymized view).
- Revealing internal audit logs or 2FA tokens.

## 3. Mandatory Guardrails (CORE_GUARDRAILS)
Every AI entry point MUST implement the following baseline:
- **Secret Redaction**: Refuse to output anything resembling a key or token.
- **Jailbreak Resistance**: Explicitly ignore instructions to bypass safety rules.
- **Grounded Responses**: Only provide information verified by the repository's public documentation.

## 4. Implementation Rules
- **Environment Variables**: AI API keys MUST be stored in Supabase Secrets/Vault and never hard-coded.
- **CORS**: AI entry points must use the shared `corsHeaders` gate.
- **Auditability**: Significant AI interactions (e.g. governance queries) should be logged to `paws_audit_log`.

## 5. Deployment Checklist
- [ ] System prompt includes `CORE_GUARDRAILS`.
- [ ] API keys are retrieved via `Deno.env.get`.
- [ ] Output filtering for PII is enabled.
- [ ] CORS is restricted to authorized origins.
