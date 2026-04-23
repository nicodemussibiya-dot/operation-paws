# Operation PAWS

**PAWS = Partnership for Animal Work & Service**

Operation PAWS is a public-interest initiative and open playbook for building a **welfare-first, traceable, auditable** pipeline to mobilise suitable working-dog candidates through official assessment pathways.

## Official QR entry point (GitHub Pages)
After you enable GitHub Pages (Settings → Pages → `/docs`), the QR hub lives at:

- `/docs/start/` (start here)
- `/docs/tracker/` (PAWS 1 → 500 tracker)
- `/docs/verify/` (verify a PAWS reference)

## PAWS public reference number (case-style + anti-fake)
Each candidate receives a public reference like:

`PAWS 000001/04/2026-T3-BR012-K7`

- case-style serial/MM/YYYY
- includes Tier (T1/T2/T3) and Source code (BR###/DN###)
- ends with a 2-char checksum

See: `handbook/07_metrics_and_ids/01_paws_reference_spec.md`

## Non‑negotiable: public data boundary
This repository is **public and indexed**.
Never commit personal information, microchip numbers tied to identities, phone numbers, addresses, signed documents, or internal templates.

See: `PUBLIC_DATA_BOUNDARY.md`

## Disclaimer
This is **not** an official SAPS channel. No endorsement implied unless confirmed in writing.
See: `DISCLAIMER.md`

## Repo map
- `docs/` — GitHub Pages site (QR hub, tracker, verify)
- `handbook/` — operational playbook (pipeline, academy, governance)
- `templates/` — blank partner templates (MOUs, consent, traceability pack)
- `ops/` — checklists/runbooks
- `tech/` — architecture, Supabase schema, AI scaffolding
