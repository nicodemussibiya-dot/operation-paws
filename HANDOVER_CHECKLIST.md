
> **NOTICE:** This repository is a proposal / pilot / demo prototype reference architecture. It is NOT operational until formally adopted.

# Operation PAWS – Project Handover Checklist

**Architecture & Security**
- [x] All critical tables under RLS; PII ring-fenced.
- [x] Public access limited to anonymized / aggregate views.
- [x] 2FA + `paws-secure-action` with single-use, race-safe tokens enforced for high-privilege changes.
- [x] `.gitignore` and `.env.example` in place; no keys in repo.

**Governance**
- [x] `paws_user_roles` with formal roles (officer, commissioner, presidency_oversight, auditor, etc.).
- [x] `paws_role_change_proposals` for AI-/human-drafted role changes.
- [x] Secure-action path `UPDATE_ROLE_FROM_PROPOSAL` wired and audited.
- [x] Presidency Oversight role with read-only, aggregate dashboards.

**AI Layer**
- [x] Centralized guardrails in `_shared/prompts.ts` with CORE_GUARDRAILS.
- [x] Specialized assistants: Officer, Command, Presidency, Citizen, Governance Clerk.
- [x] `paws-chat` and other AI entry points wired to hardened system prompts.
- [x] TECH_AI_SECURITY documented.

**Pilot Simulation Infrastructure**
- [x] `paws_dog_operations` and `paws_dog_insurance_events` created.
- [x] `paws_system_state` tracks `phase = pilot | closeout | league`.
- [x] 500-dog pilot simulation schema ready for seeding.
- [x] PAWS_PILOT_SUMMARY_PROMPT and close-out template available.

**Next Steps for a Real Deployment**
- [ ] Choose production Supabase project(s) per environment (dev/stage/prod).
- [ ] Integrate with real authentication (passkeys / FIDO2 + 2FA).
- [ ] Run legal/privacy review and POPIA impact assessment.
- [ ] Train staff using the AI assistants and mock data.
- [ ] Gradually onboard real K9 units province-by-province.
