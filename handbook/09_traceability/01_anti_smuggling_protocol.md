
> **NOTICE:** This repository is a proposal / pilot / demo prototype reference architecture. It is NOT operational until formally adopted.

# Anti-Smuggling & Diversion Protocol

**Objective:** To ensure 100% traceability of every dog in the Operation PAWS pipeline and prevent any possibility of "smuggling for profit" or unauthorized diversion of animals.

## 1. The Microchip Anchor
- **Mandatory Identification:** No dog is accepted for assessment or intake without a verified microchip.
- **Verification Rule:** The microchip must be scanned at every transition point (Owner -> SPCA -> Academy -> SAPS).
- **Scanning Proof:** Handover documentation must include a photo of the scanner display showing the microchip number, timestamped and geotagged.

## 2. Triple-Point Verification
To ensure a dog hasn't been "swapped" or "diverted":
1.  **Intake (SPCA/Vet):** Independent verification of microchip + health check + owner identity.
2.  **Assessment (SAPS):** SAPS evaluators verify the microchip matches the intake record.
3.  **Deployment (SAPS):** Final verification against the SAPS 84 History File and PAS serial number.

## 3. The Digital Audit Trail (Supabase)
Every dog has a tamper-proof digital log in the ring-fenced database:
- `timestamp`
- `paws_ref`
- `microchip_number` (encrypted/private)
- `event_type` (e.g., "Handover to Academy")
- `authorized_by` (digital signature/ID)
- `location_coordinates` (for custody transfer verification)

## 4. "Closed-Loop" Outcomes
If a dog is not accepted into the SAPS program:
- **Default:** Return to owner/breeder.
- **Verification:** Owner must sign a "Return of Custody" form, and the microchip must be scanned upon return to prove the correct dog was handed back.
- **SPCA Lane:** If the owner surrenders the dog, it moves into the official SPCA rehoming system, NOT a private sale channel.

## 5. Transparency Dashboard (Public)
The public tracker at `/docs/tracker/` serves as an anti-smuggling tool:
- Anyone can see the total number of dogs in each stage.
- If a dog "disappears" from the numbers without a "Deployed" or "Returned to Owner" status, it triggers an immediate internal audit.

## 6. Zero-Tolerance for Unchipped Dogs
- Under no circumstances will Operation PAWS staff or partners handle an unchipped dog for more than the time it takes to implant a chip.
- If a dog is unchipped at initial contact, it must be chipped at a registered vet/SPCA with the owner present before proceeding.
