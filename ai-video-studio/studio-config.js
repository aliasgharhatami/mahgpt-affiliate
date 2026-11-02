// Browser-visible configuration only. Never put a Supabase secret/service-role key here.
// Public email beta: owner connected verified mahgpt.com domain to Resend SMTP.
// Real Google OAuth remains server-controlled and must be configured in Google Cloud and Supabase.
window.MAH_STUDIO_CONFIG = Object.freeze({
  supabaseUrl: "https://gthwpfscrewwamjxheyj.supabase.co",
  supabasePublishableKey: "sb_publishable_7QQCrCTCZ_-rBPKIWc0qVg_cu2lAaoD",
  authReady: true, // Email sign-in with Supabase Auth.
  redirectsReady: true, // Site owner confirmed https://mahgpt.com/ as the Supabase callback.
  legalApproved: false, // Full commercial/media terms not yet finalized.
  registrationAudience: 'public-beta', // Anyone can request a text-only beta account using verified Resend SMTP.
  googleProviderReady: false, // Auto-discovered from Supabase Auth's public provider settings.
  termsVersion: "public-beta-2026-11-02-v2",
  privacyVersion: "public-beta-2026-11-02-v2"
});
