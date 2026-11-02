// Browser-visible configuration only. Never put a Supabase secret/service-role key here.
// Enable AFTER a dedicated project exists, RLS migration has been reviewed/applied,
// Google/email redirects are configured, and final privacy terms are published.
window.MAH_STUDIO_CONFIG = Object.freeze({
  supabaseUrl: "",
  supabasePublishableKey: "",
  authReady: false,
  legalApproved: false,
  googleProviderReady: false,
  termsVersion: "pending-final",
  privacyVersion: "pending-final"
});
