# Studio legal release checklist — 2026-11-02

## Implemented pages

- Public Studio privacy policy: `https://mahgpt.com/privacy-policy.html`
- Public terms: `https://mahgpt.com/terms-of-service.html`
- Editorial policy distinct from privacy, with links to both: `https://mahgpt.com/editorial-policy.html`
- Studio homepage and auth consent now point to the canonical pages.
- Existing Studio legal URLs forward visitors to the canonical pages.
- Terms/privacy acceptance versions changed to `public-beta-2026-11-02-v2` to request acknowledgment of the updated notices.

## REQUIRED BEFORE paid orders, media uploads or commercial launch

1. Confirm and publish the actual legal service operator (individual legal name or registered company, business contact address, country and company details if applicable). KVKK Article 10 requires data-controller identity as part of the notice; generic brand-only wording may be insufficient.
2. Identify applicable legal bases and disclosures for Türkiye KVKK and, where relevant, EU/UK GDPR. Obtain counsel review of cross-border transfers/processor contracts; privacy copy alone is not certification of compliance.
3. Introduce an explicit in-product media-processing agreement describing file types, purpose, providers, allowed transformations, retention/deletion, consent for person's likeness/voice as necessary, and copyright rights attestation.
4. Separate any OPTIONAL marketing/portfolio, voice-clone, likeness advertising, or training permission from mandatory service acceptance. Keep distinct opt-in versions and withdrawal records; declining should not block ordinary paid editing.
5. Create media retention & deletion workflow: expires, account deletion, private storage purge, backup expiry; document actual timeframes only after implementation and testing.
6. Payment checkout must use a compliant external hosted payment processor; never ask for or store raw card PAN/CVV in Studio forms, drafts, email or GitHub. Publish processor identity, data-flow, merchant legal operator, refunds, receipts and chargeback handling.
7. Validate all public policy URLs, with visible homepage links, Google branding audience setting, authorized domain, consent screen scopes and public app verification.
8. Audit browser storage, security, third-party fonts, analytics and affiliate tracking; add cookie controls if non-essential cookies/trackers are introduced and legally required.
9. Document user privacy request process (identity verification, access, correction, deletion, response timeframe) and a real support mailbox; test deletion in Supabase Auth, PostgreSQL and backups.
10. Do not publicly claim video editing, AI generation, uploads or payment services are functional until end-to-end tests prove them.

## Current verified state

- Email and Google OAuth have each produced real identities in Supabase, on one linked user account, with scoped project-table RLS.
- Studio offers email/Google sign-in and private text draft project storage.
- Custom Resend SMTP with verified mahgpt.com domain has been configured by the owner; independent delivery tests to non-team email addresses are recommended.
- New pages and links committed in GitHub; deployment test checks actual Cloudflare-hosted site separately.
