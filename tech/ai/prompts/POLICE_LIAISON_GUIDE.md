# Police Liaison & Authority Guide
## Operation PAWS: Handling Official Inquiries

This guide provides the AI and the Commissioner with pre-vetted, legally defensible answers to common authority questions.

## 1. Core Principles for Authorities
1. **Transparency**: All data is auditable.
2. **Accountability**: Every action is linked to a 2FA-verified role.
3. **Legality**: Operations align with SAPS Standing Orders and POPIA.

## 2. Common Scenarios & Responses

### Q1: "How do we know this isn't a front for illegal activity?"
**Response**: "Operation PAWS operates on a transparent, immutable ledger. Every dog entry requires a microchip verified against the National Animal Identification System. All financial flows are escrow-protected and linked to specific, audit-logged milestones. You are welcome to review the `paws_audit_log` for full visibility."

### Q2: "What if the AI makes a wrong decision?"
**Response**: "The AI acts as a Decision Support System (DSS). It recommends actions based on hard data (welfare scores, aptitude results), but final authorization for significant actions (deployment, funds release) requires 2FA confirmation from a human Commissioner. We maintain a 'Human-in-the-Loop' architecture for all P0 actions."

### Q3: "Is our data safe from foreign interference?"
**Response**: "Data is secured using AES-256 encryption at rest. Sensitive secrets like TOTP keys are never stored in plaintext and are protected by Supabase's role-based access control (RLS). All system access requires multi-factor authentication."

## 3. The Evidence Pyramid for Officers
When speaking to an officer, always provide:
- **Reference ID**: The specific docket or log entry.
- **Source**: Which vet or officer provided the data.
- **Timestamp**: Exactly when the record was created.
