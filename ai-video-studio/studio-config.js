// Browser-visible configuration only. Never put a Supabase secret/service-role key here.
// Restricted email beta only. Redirects confirmed by owner; project RLS verified.
// Public signup and Google sign-in remain OFF until SMTP, OAuth, and final legal approval.
window.MAH_STUDIO_CONFIG = Object.freeze({
  supabaseUrl: "https://gthwpfscrewwamjxheyj.supabase.co",
  supabasePublishableKey: "sb_publishable_7QQCrCTCZ_-rBPKIWc0qVg_cu2lAaoD",
  authReady: true, // Email sign-in with Supabase (restricted beta).
  redirectsReady: true, // Site owner confirmed https://mahgpt.com/ as the Supabase callback.
  legalApproved: false, // No general-public onboarding until final legal disclosures.
  betaEmailOnly: true, // Default SMTP permits email links to Supabase team addresses only.
  googleProviderReady: false,
  termsVersion: "beta-2026-11-02",
  privacyVersion: "beta-2026-11-02"
});
