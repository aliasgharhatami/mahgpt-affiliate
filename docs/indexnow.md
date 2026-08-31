# IndexNow setup

The notifier is intentionally fail-open and dry-run by default.

1. Create a random key and add it to the repository Actions secret named `INDEXNOW_KEY`.
2. Publish the same key as a public text file at `https://mahgpt.com/indexnow-key.txt` (the file must contain only the key).
3. The `indexnow-notify` workflow runs only after the multilingual/sitemap workflow succeeds.
4. Set `INDEXNOW_DRY_RUN=false` in the workflow only after the public key file is live.

The notifier reads only HTTPS `mahgpt.com` URLs from the generated sitemaps, excludes `/go/` and non-indexable files, skips an unchanged sitemap hash, and never fails the deployment if the IndexNow endpoint is unavailable. The secret is never printed or written to workflow logs.
