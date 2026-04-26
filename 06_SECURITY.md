# Project Security & Data Integrity

Operation PAWS handles sensitive operational data and partner secrets. This document outlines our multi-layered security approach.

## 1. Secrets Management
- **Environment Variables:** All API keys (OpenAI, Gemini, OpenRouter, Supabase) are stored as encrypted environment variables in the Supabase Edge Runtime.
- **No Secrets in Repo:** We use `.gitignore` to prevent any local `.env` files from being committed.
- **Rotational Policy:** Keys are rotated every 90 days or immediately upon any suspected breach.

## 2. Database Security (Supabase)
- **Row Level Security (RLS):** Enabled on all tables. Anonymized public views are used for the tracker, ensuring that PII (names/microchips) is never exposed to the internet.
- **Service Role Access:** Only authorized edge functions and admin accounts use the `service_role` key.
- **Audit Logging:** Every write operation is logged with a timestamp and the initiating user/function ID.

## 3. AI Safety & Boundaries
- **System Prompt Guardrails:** The AI is strictly instructed to refuse requests for tactical info, facility layouts, or PII.
- **Output Filtering:** The `intake_router` schema ensures that only structured, safe data is processed into the database.

## 4. Frontend Integrity (GitHub Pages)
- **HTTPS Only:** The site is served exclusively over TLS.
- **Subresource Integrity (SRI):** We use SRI for any external fonts or scripts to prevent man-in-the-middle attacks.

## 5. Physical Security (On-Site)
- **Offline Backups:** During screening days, an offline backup of the intake log is maintained to ensure data persistence if network connectivity fails.
- **Chain of Custody:** Physical documents (e.g., SAPS 505a) are handled only by authorized personnel and filed securely at the Unit level.

## 6. Oversight Security Gate (Presidency)
Access for the Presidency Oversight role is strictly compartmentalized:
- **RBAC Gating**: Managed through the `paws_user_roles` table with `presidency_oversight` role.
- **Aggregate Isolation**: Users with this role are restricted via RLS to pre-anonymized views (`paws_national_governance_dashboard`). They have ZERO access to the underlying `paws_dogs` operational table.
- **Enhanced Verification**: Mandatory 2FA and IP-restricted logins (where possible) are required for oversight accounts.
- **Immutable Audit**: Every query and login by an oversight account is captured in `paws_audit_log`. 
- **Private Access**: Dashboards are served on private, non-indexed URLs and are NEVER exposed to the public internet.
