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
-- Any new priced quote MUST match the completed private analysis for the same
-- project, owner and quality. Do not allow a stale analysis to price another job.
create or replace function public.studio_quote_analysis_binding_guard()
 returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.analysis_job_id is not null then
   if new.quality is null or
      not exists(select 1 from public.studio_ai_analysis_jobs j
        where j.id=new.analysis_job_id and j.project_id=new.project_id
          and j.owner_id=new.owner_id and j.quality=new.quality
          and j.status='completed') then
     raise exception 'Quote must belong to a completed, owned analysis';
   end if;
   if new.status='quoted' and (new.currency<>'USD' or
       new.amount_minor is null or new.amount_minor<100 or
       new.amount_minor>1000000 or new.expires_at is null or
       new.expires_at<=now() or new.expires_at>now()+interval '14 days') then
     raise exception 'Invalid priced quote lifetime or amount';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists studio_quote_analysis_binding_guard_trigger on public.studio_quotes;
create trigger studio_quote_analysis_binding_guard_trigger
 before insert or update on public.studio_quotes
 for each row execute function public.studio_quote_analysis_binding_guard();

-- All quote mutations remain server-only; no browser payment acceptance.
commit;
