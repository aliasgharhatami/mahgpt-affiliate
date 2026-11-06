-- Phase 12B: bind future server-issued customer quotes to one analysis and tier.
-- No client can insert, update or accept payment. No quote is created here.
begin;
alter table public.studio_quotes
 add column if not exists analysis_job_id uuid
   references public.studio_ai_analysis_jobs(id) on delete cascade,
 add column if not exists quality text
   check (quality in ('normal','semi_professional','professional'));
create unique index if not exists studio_quotes_analysis_unique
 on public.studio_quotes(analysis_job_id)
 where analysis_job_id is not null;

-- The trusted backend may only issue analysis-linked quotes using matching
-- owner, project and quality; price remains internally computed.
create or replace function public.studio_quote_analysis_integrity()
 returns trigger language plpgsql security invoker set search_path='' as $$
declare j public.studio_ai_analysis_jobs%rowtype;
begin
 if new.analysis_job_id is not null then
   select * into j from public.studio_ai_analysis_jobs
   where id=new.analysis_job_id for share;
   if not found or j.project_id is distinct from new.project_id or
      j.owner_id is distinct from new.owner_id or
      j.quality is distinct from new.quality or
      j.status <> 'completed' then
     raise exception 'Customer quote must match one completed, owned analysis';
   end if;
   if new.status='quoted' and (new.amount_minor is null or
      new.amount_minor<=0 or new.expires_at is null or
      new.expires_at<=now() or new.expires_at>now()+interval '7 days') then
     raise exception 'Customer quote needs positive amount and bounded validity';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists studio_quote_analysis_integrity_trigger on public.studio_quotes;
create trigger studio_quote_analysis_integrity_trigger
 before insert or update on public.studio_quotes
 for each row execute function public.studio_quote_analysis_integrity();
commit;
