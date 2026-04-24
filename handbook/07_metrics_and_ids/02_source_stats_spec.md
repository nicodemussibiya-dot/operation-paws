# PAWS Source Stats & Leaderboard Spec

**Goal:** To recognize and incentivize high-quality donors and breeders while maintaining strict privacy (No PII).

## 1. The Opt-In Rule
- By default, source identities are anonymized (e.g., `BR012` or `DN027`).
- A source (Breeder/Donor) must provide written opt-in consent to display their Kennel Name or Real Name on the public leaderboard.

## 2. Metric Categories
- **Volume:** Number of dogs entered into the pipeline.
- **Quality:** Percentage of dogs that pass Tier 2 (The Combine).
- **Service:** Percentage of dogs officially accepted by SAPS (Tier 3 Success).

## 3. Public Leaderboard Display
The leaderboard shows:
1.  **Rank**
2.  **Source ID / Name** (e.g., "Silvercreek Kennels" or `BR042`)
3.  **Candidates Sent**
4.  **SAPS Accepted** (Total)
5.  **Status** (e.g., "Premier PAWS Partner")

## 4. Privacy Guardrails
- **No Private Details:** No phone numbers, addresses, or specific microchip links are ever shown on the leaderboard.
- **Anonymized Fallback:** If a source has not opted-in, they are listed only by their `BR###` or `DN###` code.
- **Revocation:** A source can request to return to "Anonymized" status at any time.

## 5. Implementation (Supabase)
- **Table:** `public_source_stats` (A public view of aggregate counts).
- **Sorting:** Primarily sorted by "SAPS Accepted" count.
