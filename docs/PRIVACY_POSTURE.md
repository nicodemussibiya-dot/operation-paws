# Privacy Posture: Why the Public Tracker Cannot Leak PII

Operation PAWS uses a strictly tiered data architecture to ensure that operational security (OPSEC) and Personal Identifiable Information (PII) are never exposed to the public.

## 1. Physical Table Separation
The database maintains two entirely separate sets of tables:
- **`public.paws_dogs`**: The "Locked Kitchen." Contains names, microchips, owner contacts, and specific deployment locations. This table is protected by Row Level Security (RLS) that denies all access to anonymous users.
- **`public.paws_public_dogs`**: The "Open Recipe." A dedicated, newspaper-safe table containing only anonymized data (Breed, General Status, Region, and a non-sequential reference ID).

## 2. Row Level Security (RLS)
Every table in the system has RLS enabled.
- **Anon Policy**: The only table accessible to anonymous users is `paws_public_dogs`.
- **Authenticated Policy**: Even for authenticated users, access is restricted by role. An Officer in Province A cannot see dogs in Province B unless authorized.

## 3. Data Boundary Logic
All public-facing views (e.g., `paws_public_tracker`, `paws_public_stats`) are built exclusively on top of the `paws_public_dogs` table. There is no SQL join that allows a public user to "jump" from a public reference to a private PII field.

## 4. Summary of Safe Fields
| Field | Public? | Rationale |
| :--- | :--- | :--- |
| `paws_ref` | YES | Unique tracking ID (e.g. PAWS-26-00042) |
| `breed` | YES | General classification |
| `status` | YES | Public accountability (e.g. "Training", "Deployed") |
| `microchip` | **NO** | Prevents dog theft/cloning |
| `owner_name`| **NO** | PII protection |
| `coordinates`| **NO** | OPSEC / Handler safety |

## 5. Verifiable Audit Trail
Every access to sensitive data is logged in an immutable audit trail (`paws_audit_log`). This trail is visible to the **Presidency Oversight** role, ensuring that even high-level administrators are watched.
