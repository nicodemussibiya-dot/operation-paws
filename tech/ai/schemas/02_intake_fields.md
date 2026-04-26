
> **NOTICE:** This repository is a proposal / pilot / demo prototype reference architecture. It is NOT operational until formally adopted.

# SPEC: Digital Intake Fields (Tier 1)

This document defines the data points collected during the initial digital intake (WhatsApp/Telegram/Web).

## 1. Donor/Owner Info (Private)
- `owner_full_name`
- `owner_phone` (WhatsApp primary)
- `owner_location` (Town/Province)
- `breeder_prefix` (If applicable)

## 2. Candidate Dog Info
- `dog_name`
- `dog_breed`
- `dog_sex`
- `dog_age_months`
- `microchip_number` (Mandatory if already chipped)
- `vaccination_status` (Boolean + photo upload)

## 3. Preliminary Temperament (Questionnaire)
- **Toy Drive:** "On a scale of 1-10, how obsessed is the dog with a ball?"
- **Environment:** "Does the dog show fear during thunderstorms or around loud trucks?"
- **Social:** "How does the dog react to a friendly stranger entering your home?"

## 4. Media Uploads
- 1 x Standing profile photo.
- 1 x Close-up of face/teeth.
- 1 x Video (30s) showing the dog chasing and retrieving a toy.
