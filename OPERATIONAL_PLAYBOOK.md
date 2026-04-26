# Operation PAWS – Operational Playbook (Command/CFO)

## 1. The Approval Deck Demo Script
Use this guide to understand the "Tinder-style" triage and batch approval process.

### Scene 1: The Single Dog Card
- **Triage**: ✅ Approve (swipe right), ❌ Reject (swipe left), ⭐ Defer (swipe up).
- **Signals**: View AI-generated summaries of regional need and real-time funding pool impacts.

### Scene 2: The Batch "Commit"
- **Filter**: Triage by role (e.g., narcotics) or province (e.g., KZN).
- **Execution**: Tapping "Commit Batch" triggers a 2FA prompt. On success, the system atomically:
    1. Reserves funds from the correct pool.
    2. Creates all operational and financial records.
    3. Writes an immutable audit log.

---

## 2. Financial Governance (CFO)

### Managing Oversupply
PAWS tracks roles and utilization. Excess capacity is converted to:
- `reserve_operational`: Maintained as a national reserve.
- `training_asset`: Used for handler development.
- `community_outreach`: Deployed for school/community engagement.

### Managing Surpluses
At the end of a project or funding cycle, unspent money follows the `paws_funding_pools` rules:
- **Donor Funds**: Returned or rolled over by agreement.
- **SPCA Funds**: Retained by SPCA exclusively for K9 welfare (medical/retirement).
- **SAPS Budget**: Either reverts to Treasury or is moved to a ring-fenced K9 reserve.

---

## 3. The "Open Recipe, Locked Kitchen" Model
All decisions made through these tools are:
- **Transparent**: The logic is visible in the public repository.
- **Secure**: The data is isolated from the public internet.
- **Auditable**: Every "swipe" and "commit" leaves a permanent trail.

---

## 4. Media & Branding Standards
### The "Pinterest" Elite Benchmark
To maintain institutional prestige and operational security:
- **No External Links**: Never use Pinterest or social media links for dog profiles.
- **Cinematic Standard**: All K9 assets must meet the high-contrast, professional photography standard demonstrated in the Pilot Report.
- **Security-First Framing**: Ensure no PII (handler faces, exact street addresses, or sensitive background equipment) is visible in high-resolution uploads.
- **Internal Hosting**: All premium assets are hosted within the PAWS secure storage layer, ensuring they are available even when offline.
