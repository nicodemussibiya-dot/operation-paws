
> **NOTICE:** This repository is a proposal / pilot / demo prototype reference architecture. It is NOT operational until formally adopted.

# Operation PAWS — Public Data Boundary (Non‑Negotiable)

**Last updated:** 23 April 2026

This repository is **PUBLIC**. Assume:
- it will be indexed by search engines,
- it may be cached,
- it can be copied/forked permanently.

## 1) What is allowed in this public repo
Allowed (safe to publish):
- Blank templates with placeholders (no real names, numbers, addresses).
- Process diagrams, SOP checklists, scoring rubrics, curriculum (foundation/non-tactical).
- Public-safe technical architecture and demo code.
- Aggregate metrics definitions and dashboard specifications.
- Public-safe IDs (e.g., `PAWS 000001/04/2026-T3-BR012-K7`).
- Synthetic/fake demo datasets that cannot be linked to real people or dogs.

## 2) What is NOT allowed (never commit)
Do NOT commit, paste, or upload:
- Any person’s personal information: names + phone numbers, addresses, ID numbers, emails.
- WhatsApp screenshots or chat exports (even “blurred” is risky).
- Microchip numbers (or images of microchip scans) when they can be linked to a person/breeder/donor.
- Photos/videos that reveal a private address, kennel location, facility layout, vehicle plates, or identifiable minors.
- Signed documents: MOUs, consent forms, vet records, affidavits, invoices, bank confirmations.
- Any SAPS-provided internal templates, forms, or documents unless SAPS explicitly authorises publication in writing.
- Any operationally sensitive details (tactics, capability-revealing training methods, deployment info).

## 3) Where sensitive information belongs
Sensitive operational records belong in a **ring‑fenced private system** (separate repo + secured database) with:
- access control (least privilege),
- audit logging,
- encryption at rest and in transit,
- retention rules.

## 4) Enforcement
- PRs that introduce disallowed content must be rejected.
- If disallowed content is accidentally committed, remove it immediately and rotate any exposed credentials.
- Use GitHub secret scanning and push protection.
- Report issues privately per `SECURITY.md`.

## 5) Public-first phrasing rule
If a paragraph, screenshot, or file would be risky “on the front page of a newspaper”, it does not belong here.
