import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('ai-video-studio/backend/legal-launch-gates.json', 'utf8'));
const config = fs.readFileSync('ai-video-studio/studio-config.js', 'utf8');
const privacy = fs.readFileSync('privacy-policy.html', 'utf8');
const terms = fs.readFileSync('terms-of-service.html', 'utf8');
const mapping = {
  media_uploads: 'mediaUploadsReady',
  paid_checkout: 'paymentsReady',
  ai_rendering: 'aiRenderingReady'
};
let errors = [];
for (const [feature, prop] of Object.entries(mapping)) {
  const match = config.match(new RegExp('\\b' + prop + ':\\s*(true|false)\\b'));
  if (!match) {
    errors.push('Missing explicit boolean ' + prop);
    continue;
  }
  const liveEnabled = match[1] === 'true';
  const checks = manifest.feature_release[feature];
  if (!checks) { errors.push('Missing release checklist for ' + feature); continue; }
  if (liveEnabled !== checks.enabled) errors.push('Feature state mismatch for ' + feature);
  if (!liveEnabled) continue;
  if (!manifest.legal_operator.confirmed || !manifest.legal_operator.public_identity_approved || !manifest.legal_operator.disclosure_reviewed_for_KVKK) {
    errors.push(feature + ' requires confirmed legal data controller/merchant identity and KVKK review');
  }
  for (const [field, completed] of Object.entries(checks)) {
    if (field !== 'enabled' && completed !== true) errors.push(feature + ' legal release gate unchecked: ' + field);
  }
  const strings = [
    ['privacy-policy.html', privacy],
    ['terms-of-service.html', terms]
  ];
  for (const [file, body] of strings) {
    if (body.includes('Actual media uploads, AI video generation, paid checkout, video rendering and portfolio publication are <strong>not enabled</strong>')) {
      errors.push(feature + ' cannot ship while ' + file + ' contains old beta-only claims');
    }
  }
}
if (!privacy.includes('info@mahgpt.com') || !terms.includes('info@mahgpt.com')) errors.push('Legal pages missing support/privacy contact');
if (errors.length) {
  for (const e of errors) console.error('LEGAL RELEASE BLOCKED: ' + e);
  process.exit(1);
}
console.log('Legal release gates: valid; uploads, payments and rendering remain ' +
  (Object.values(manifest.feature_release).every(v => !v.enabled) ? 'disabled' : 'subject to documented approvals') + '.');
