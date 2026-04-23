# Operation PAWS — Security Policy

**Last updated:** 23 April 2026

## 1) Reporting a security issue
If you discover:
- exposed secrets (API keys, tokens),
- personal data accidentally committed,
- a vulnerability in the website or tracker,
- an impersonation/scam issue involving Operation PAWS,

Do NOT open a public GitHub issue.

Instead:
- Email: (add a security email ASAP, e.g., `security@YOURDOMAIN`)
- If no email exists yet, use a private channel with the maintainer (repository owner) and do not include sensitive details in public posts.

## 2) What is considered sensitive
Sensitive includes:
- any personal info (names, numbers, addresses),
- microchip numbers tied to people,
- signed documents,
- credentials/secrets,
- partner internal docs,
- facility layouts or operational security details.

## 3) Supported versions
The GitHub Pages site and repo content should be treated as the supported release. Fixes will be pushed to `main`.

## 4) Hard requirements for contributors
- Never commit secrets. Use environment variables and `.env.example` files only.
- Never commit PII. See `PUBLIC_DATA_BOUNDARY.md`.
- Prefer “public safe by design”: assume everything is visible forever.

## 5) Recommended repo settings (turn these on)
- GitHub: Secret scanning + Push protection
- Branch protection on `main` (require PR review once you have collaborators)
- Dependabot alerts (if/when you add dependencies)
