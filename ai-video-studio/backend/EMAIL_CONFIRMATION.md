# MAH GPT Studio – email confirmation fix (2026-11-02)

## Incident verified
The Supabase hosted auth logs showed `GET /verify` responses returning `403: Email link is invalid or has expired` and `One-time token not found` for the attempted confirmation. As of this check, the beta user's email is not confirmed and has no active session.

The link may have expired, been superseded by a newer request, been used, or been prefetched by a scanner. The logs do not uniquely prove which explanation applies.

## Fix deployed to GitHub
- `https://mahgpt.com/confirm-email.html` is a first-party interstitial that does **not** call Supabase verification on load.
- `ai-video-studio/confirm-email.js` only calls `verifyOtp({token_hash,type:'email'})` after the user clicks **Confirm Email & Open My Projects**.
- The URL containing the token hash is removed from the browser address bar immediately and is never rendered or logged to the console.
- `ai-video-studio/studio-account.js` displays errors from the returning Supabase URL instead of silently hiding the failure.

## Required Supabase dashboard changes – owner-only settings
Open [Authentication Email Templates](https://supabase.com/dashboard/project/gthwpfscrewwamjxheyj/auth/templates).

Choose **Confirm signup**, and replace the message body with:

```html
<h2>Confirm your MAH GPT Studio email</h2>
<p>Click below to open our secure confirmation page. On that page, press Confirm Email to finish signing in.</p>
<p><a href="https://mahgpt.com/confirm-email.html?token_hash={{ .TokenHash }}">Confirm email address</a></p>
```

For subsequent sign-ins, also change the **Magic Link** template:

```html
<h2>Sign in to MAH GPT Studio</h2>
<p><a href="https://mahgpt.com/confirm-email.html?token_hash={{ .TokenHash }}">Continue to secure email sign-in</a></p>
```

Save templates in Supabase **before** requesting a new sign-in email. Do not paste one-time tokens or API secrets into a chat, ticket or repository.

## Validation steps
1. Request a fresh email from `https://mahgpt.com/` using the authorized beta address. Use the newest email only.
2. Open the link. It must go to `mahgpt.com/confirm-email.html` and display a separate confirmation button.
3. Click the button once. The browser should return to `mahgpt.com/` with an authenticated session.
4. The header should show **My Projects** (or **Accept Terms** if the beta agreement has not yet been recorded). Save a text-only draft and check it persists after reload.
5. Review `auth.users.email_confirmed_at` and `auth.users.last_sign_in_at`; check login and RLS under another account before public launch.

Production public signup still requires custom SMTP, legal compliance review and separate Google OAuth configuration.
