# X publishing

X is a manual-only publisher that consumes the existing `data/social-queue.json`; it never fetches or regenerates news and never changes Telegram or Instagram state.

The workflow is **Test MahGPT X publisher** and has no schedule. It publishes at most one item per run. Leave `dry_run=true` for a safe preview; set it to false for one real post. Blank `queue_index` selects the first X-unpublished item.

Required repository secrets: `X_ACCESS_TOKEN` and `X_REFRESH_TOKEN`. Refreshing an expired OAuth 2.0 token also requires the app's OAuth client ID, so the optional secret `X_CLIENT_ID` is used when available; it is never printed. The current implementation posts text through the official `https://api.x.com/2/tweets` endpoint. Media upload is deliberately not attempted with the supplied OAuth 2.0 secrets; the safe fallback is text plus the MahGPT URL.

X state is independent in `data/x-delivery-history.json` and the queue item's `x` block. State is written only after the API confirms success. API diagnostics include endpoint, HTTP status, and sanitized error details; tokens are never logged. No paid service is used.
