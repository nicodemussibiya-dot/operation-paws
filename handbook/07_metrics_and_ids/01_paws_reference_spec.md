# Operation PAWS — Public Reference Number Spec (Case-Style)

## Goal
Issue a public-facing reference number for every candidate dog that:
* feels like a South African “registered case” reference (serial + month + year),
* is unique and never reused,
* includes Tier and Source (Breeder/Donor) code,
* can be validated using a checksum,
* does NOT expose any personal info or microchip numbers.

## Public Reference Format (Final)
`PAWS 000001/04/2026-T3-BR012-K7`

**Segments:**
* `PAWS` = Programme prefix
* `000001` = Global serial (monotonic sequence; never reused)
* `04/2026` = Registration month/year (MM/YYYY)
* `T1` | `T2` | `T3` = Tier at ORIGIN (Tier at intake)
* `BR###` | `DN###` = Source code (Breeder or Donor; PAWS-issued)
* `K7` = 2-char checksum (base36)

## Source Code Rules
* BR### = breeder source code (e.g., BR012).
* DN### = donor source code (e.g., DN027).
* Source code maps privately to real identities in our ring-fenced system.
* Public display of breeder names is opt-in; otherwise only BR/DN codes appear.
