
> **NOTICE:** This repository is a proposal / pilot / demo prototype reference architecture. It is NOT operational until formally adopted. (Hardened Build: 2026-04-26 v3 — CORS fail-closed, zero-PII views, dead-code purge)

# Operation PAWS

## What Operation PAWS Is

Operation PAWS is a national K9 command-and-oversight system for South Africa.

- The **code and logic are open** so anyone can inspect how decisions are made.
- The **data and infrastructure are closed** so no one outside the system can see live cases, locations, or personal information.

PAWS does three things at once:

1. **Protects dogs and handlers**
   - Every dog has a full lifecycle: training, deployments, welfare, insurance, and losses.
   - Risk, injuries, and near-misses are tracked, not hidden.
   - Welfare and SPCA screening are built into the intake and audit trail.

2. **Protects the public and fights crime**
   - Each K9 operation is logged: arrests, seizures, missing persons found, firearms recovered.
   - The system can show which tactics reduce violence and which don’t.
   - Leadership can see risk and performance by province, not just headlines.

3. **Protects the integrity of SAPS and the Presidency**
   - No single Commissioner can quietly switch off oversight.
   - A Presidency Oversight role sees national, anonymized dashboards but cannot edit or delete.
   - AI can propose leadership changes based on official notices, but **only humans with 2FA and secure actions can approve them**.

In short: PAWS is **“open recipe, locked kitchen”** for national K9 mobilization.
The recipe (code, policies, RLS) is public. The kitchen (real dogs, people, and data) is locked behind strict authentication, 2FA, and database policies.

---

## Technical Overview
- **Stack**: Supabase (PostgreSQL + RLS + Edge Functions).
- **Security**: 2FA, JWT-based RBAC, Single-use Action Tokens, Hardened CORS.
- **AI**: Phase-aware guardrails for Officers, Command, Oversight, and Public.
- **Oversight**: Presidency Dashboard for national stability monitoring.

---

## 500-Dog Pilot Close-Out
The system has completed its initial 500-dog pilot simulation. See [CLOSE_OUT_REPORT.md](./CLOSE_OUT_REPORT.md) for results.
