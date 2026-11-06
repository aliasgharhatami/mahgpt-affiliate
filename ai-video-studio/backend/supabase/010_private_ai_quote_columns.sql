-- Phase 12B: quotation stage and financial-data isolation.
-- Staged release: DO NOT apply until the chat quote UI has stopped selecting
-- AI analysis fields in the authenticated browser. Apply under coordinated
-- release. Never unlock real payment by this migration.
begin;
alter table public.studio_quotes
  add column if not exists analysis_job_id uuid
    references public.studio_ai_analysis_jobs(id) on delete set null,
  add column if not exists quality text
    check(quality is null or quality in
      ('normal','semi_professional','professional'));
create index if not exists studio_quote_analysis_job_idx
 on public.studio_quotes(analysis_job_id);
-- Restrict customers to display-only values; they should never inspect
-- internal tokens, provider plans, margin or AI reasoning via REST API.
revoke select on public.studio_ai_analysis_jobs from authenticated;
grant select(id,project_id,quality,status,error_code,created_at,completed_at)
 on public.studio_ai_analysis_jobs to authenticated;

-- Existing studio_quotes only holds customer price and safe public copy.
-- Prices remain service-role written, quote status not editable by clients.
revoke all on public.studio_quotes from anon,authenticated;
grant select(id,project_id,status,currency,amount_minor,estimate_version,
 expires_at,created_at,quality,analysis_job_id)
 on public.studio_quotes to authenticated;
-- All quote mutations remain server-only; no browser payment acceptance.
commit;
