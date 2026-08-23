# MahGPT multilingual SEO (zero-cost mode)

Supported locales are defined in `config/locales.json`. English remains the default and existing English URLs are unchanged. Localized partner pages use `/<locale>/partners/<existing-slug>.html`.

## Zero-paid-API policy

The production provider is `static`. It uses repository-stored configuration and deterministic templates. No translation API, LLM API, SaaS, secret, or recurring service is required. There are no new secrets.

Run locally:

```bash
node scripts/generate-multilingual.mjs
node scripts/validate-multilingual.mjs
```

## News

The English news refresh remains the source of truth and is not blocked. Multilingual news generation is intentionally provider-pluggable and disabled in zero-cost mode. Future translations may be added as repository-stored files under locale directories or by a separately approved provider; the generator contract can accept localized title/summary fields without changing routes, SEO, affiliate redirects, or templates.

## SEO behavior

Every generated page has a self-canonical URL, all available hreflang links, x-default to English, language metadata, Open Graph locale, and a small language selector. Arabic and Persian pages use RTL markup. Affiliate destinations are extracted from the existing English page and reused unchanged.

## Adding a language

Add one locale entry and its labels, then run the generator and validator. Do not add an API key or external translation dependency.
