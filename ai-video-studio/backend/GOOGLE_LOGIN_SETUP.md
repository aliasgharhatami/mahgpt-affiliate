# Google sign-in for MAH GPT Studio (production setup)

The frontend uses `supabase.auth.signInWithOAuth({provider:'google', options:{redirectTo:'https://mahgpt.com/'}})`. The Google button is **disabled unless the public Supabase Auth `/auth/v1/settings` endpoint reports `external.google=true`**. This prevents a broken Google button while client credentials have not been configured.

## Setup: account owner only

1. Go to `https://console.cloud.google.com/auth/overview` under the Google account that should own MAH GPT Studio.
2. Choose or create a Google Cloud project named `MAH GPT Studio`.
3. Google Auth Platform → Branding: App name `MAH GPT Studio`, support email owned by the operator, authorized domain `mahgpt.com`, developer contact. Link to:
   - `https://mahgpt.com/ai-video-studio/privacy.html`
   - `https://mahgpt.com/ai-video-studio/terms.html`
4. Audience: choose `External`. Before general launch, change publishing status from `Testing` to `In production` (or `Publish app`). In Testing only individually listed test accounts can sign in.
5. Data Access: the Supabase Google integration needs `openid`, `userinfo.email` and `userinfo.profile`. Request no sensitive scopes or drive/Gmail access.
6. Google Auth Platform → Clients → Create Client → `Web application`:
   - Authorized JavaScript origin: `https://mahgpt.com` (no trailing slash).
   - Authorized redirect URI: `https://gthwpfscrewwamjxheyj.supabase.co/auth/v1/callback`.
7. Copy Google `Client ID` and `Client Secret` **directly into Supabase Dashboard** at `https://supabase.com/dashboard/project/gthwpfscrewwamjxheyj/auth/providers?provider=Google`. Enable the provider and save.
   **Never** enter the secret in GitHub `studio-config.js`, in browser code, or in chat messages.
8. Verify Supabase Authentication → URL Configuration:
   - Site URL: `https://mahgpt.com/`
   - Allowed Redirect URLs includes `https://mahgpt.com/`.
9. Refresh the deployed `https://mahgpt.com/`. The Google button becomes enabled after the Supabase public settings endpoint announces the provider as active.
10. From a different Google account (if available) test consent → Supabase callback → app root → Accept Terms → My Projects. Then check authentication log for successful login.

## Important release boundaries

- Email passwordless authentication via verified Resend SMTP can be opened to anyone as **public beta**.
- Google OAuth credentials must be created by the organization owner. The currently connected Supabase plugin cannot create Google Cloud OAuth clients or edit hosted Supabase Auth providers.
- This is **not** Supabase OAuth Server (a different feature in the left navigation).
- Public accounts currently can store private text-only drafts; media upload, paid orders, AI quoting and rendering are not enabled.
- Test Cloudflare root publishing separately: if `Login build 06` is missing from the live homepage, GitHub changes are not yet deployed.
