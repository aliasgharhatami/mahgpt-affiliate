-- Phase 12B: hide internal AI production routing, provider tokens and costs
-- from the browser. Server role retains full access for future quote approvals.
-- Existing owner-only RLS and narrow INSERT grant remain unchanged.
begin;
revoke select on table public.studio_ai_analysis_jobs from authenticated;
grant select(id,project_id,owner_id,quality,status,error_code,created_at,completed_at)
 on table public.studio_ai_analysis_jobs to authenticated;
-- Explicitly forbid column-level grants for confidential analysis details.
revoke select(brief_snapshot,analysis,input_tokens,output_tokens,estimated_cost_usd,
 attempts,lease_token,lease_expires_at,consent_confirmed)
 on table public.studio_ai_analysis_jobs from authenticated;
commit;
