-- Phase 12A: founder-only, text-only OpenAI analysis BEFORE rendering.
-- STAGED MIGRATION: do not apply until Cloudflare gateway and Oracle analyser
-- are staged; this never enables AI inference by itself.
begin;

create table if not exists public.studio_ai_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quality text not null check (quality in ('normal','semi_professional','professional')),
  consent_confirmed boolean not null default false check (consent_confirmed = true),
  brief_snapshot text not null default '' check (char_length(brief_snapshot) between 1 and 1200),
  status text not null default 'queued'
    check (status in ('queued','analyzing','completed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 1),
  lease_token uuid,
  lease_expires_at timestamptz,
  analysis jsonb,
  input_tokens integer check (input_tokens is null or input_tokens between 0 and 4000),
  output_tokens integer check (output_tokens is null or output_tokens between 0 and 900),
  estimated_cost_usd numeric(12,8) check (estimated_cost_usd is null or
    estimated_cost_usd between 0 and 0.002),
  error_code text check (error_code is null or
    error_code in ('analysis_failed','api_unavailable','budget_limit','timeout')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint studio_ai_analysis_owner_project_fk
    foreign key(project_id,owner_id)
    references public.studio_projects(id,owner_id) on delete cascade
);
create index if not exists studio_ai_analysis_owner_idx
 on public.studio_ai_analysis_jobs(owner_id,created_at desc);
create index if not exists studio_ai_analysis_queue_idx
 on public.studio_ai_analysis_jobs(status,created_at);
create unique index if not exists studio_ai_analysis_one_active
 on public.studio_ai_analysis_jobs(owner_id)
 where status in ('queued','analyzing');

alter table public.studio_ai_analysis_jobs enable row level security;
revoke all on table public.studio_ai_analysis_jobs from public,anon,authenticated;
grant select on table public.studio_ai_analysis_jobs to authenticated;
grant insert(project_id,quality,consent_confirmed)
 on table public.studio_ai_analysis_jobs to authenticated;
grant select,insert,update,delete on table public.studio_ai_analysis_jobs to service_role;

drop policy if exists "ai analysis: owner read" on public.studio_ai_analysis_jobs;
create policy "ai analysis: owner read"
 on public.studio_ai_analysis_jobs for select to authenticated
 using (owner_id=(select auth.uid()));

drop policy if exists "ai analysis: founder request" on public.studio_ai_analysis_jobs;
create policy "ai analysis: founder request"
 on public.studio_ai_analysis_jobs for insert to authenticated
 with check (
  owner_id=(select auth.uid())
  and consent_confirmed=true
  and status='queued' and attempts=0 and analysis is null
  and exists (select 1 from public.studio_media_testers t
    where t.user_id=(select auth.uid()))
  and exists (select 1 from public.studio_projects p
    where p.id=project_id and p.owner_id=(select auth.uid())
      and p.lifecycle='intake')
 );

-- Owner's current saved text is snapshotted by Postgres: no browser override,
-- no media sent to the model and no silent truncation of long descriptions.
create or replace function public.studio_ai_analysis_intake_guard()
 returns trigger language plpgsql security invoker set search_path='' as $$
declare v_brief text;v_lifecycle text;
begin
 if (select auth.uid()) is null or
    new.owner_id is distinct from (select auth.uid()) then
   raise exception 'Authenticated account required';
 end if;
 if not exists (select 1 from public.studio_media_testers t
    where t.user_id=new.owner_id) then
   raise exception 'AI analysis is enabled for the founder test account only';
 end if;
 if new.consent_confirmed is distinct from true then
   raise exception 'Explicit AI text analysis consent is required';
 end if;
 -- Serialize requests for this owner, including concurrent browser sessions.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(new.owner_id::text, 719));
 select p.lifecycle,p.brief into v_lifecycle,v_brief
 from public.studio_projects p where p.id=new.project_id
   and p.owner_id=new.owner_id for update;
 if not found or v_lifecycle<>'intake' then
   raise exception 'A saved, unfinished private project is required';
 end if;
 if exists(select 1 from public.studio_ai_analysis_jobs j
     where j.owner_id=new.owner_id and j.status in ('queued','analyzing')) then
   raise exception 'An AI analysis is already queued for this account';
 end if;
 if (select count(*) from public.studio_ai_analysis_jobs j
     where j.owner_id=new.owner_id and j.created_at>now()-interval '24 hours')>=3 then
   raise exception 'Private AI analysis limit: 3 per 24 hours';
 end if;
 select m.body into v_brief
 from public.studio_intake_messages m
 where m.project_id=new.project_id and m.owner_id=new.owner_id
   and m.role='user'
 order by m.created_at desc,m.id desc limit 1;
 if v_brief is null then
   select nullif(p.brief,'') into v_brief
   from public.studio_projects p where p.id=new.project_id;
 end if;
 v_brief=pg_catalog.btrim(coalesce(v_brief,''));
 if char_length(v_brief)<1 or char_length(v_brief)>1200 then
   raise exception 'AI analysis requires a saved description between 1 and 1200 characters';
 end if;
 new.brief_snapshot=v_brief;
 new.status='queued';new.attempts=0;
 new.lease_token=null;new.lease_expires_at=null;
 new.analysis=null;new.input_tokens=null;new.output_tokens=null;
 new.estimated_cost_usd=null;new.error_code=null;
 new.created_at=now();new.completed_at=null;
 return new;
end $$;
drop trigger if exists studio_ai_analysis_intake_guard_trigger on public.studio_ai_analysis_jobs;
create trigger studio_ai_analysis_intake_guard_trigger
 before insert on public.studio_ai_analysis_jobs
 for each row execute function public.studio_ai_analysis_intake_guard();

-- Service-role-only RPCs. The browser can read its own result, never claim,
-- finish or manipulate costs. Expired leases FAIL, never retry paid calls.
create or replace function public.studio_ai_worker_claim()
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_job public.studio_ai_analysis_jobs%rowtype;
begin
 update public.studio_ai_analysis_jobs
 set status='failed',error_code='timeout',completed_at=now(),
     lease_token=null,lease_expires_at=null
 where status='analyzing' and lease_expires_at<now();
 select * into v_job from public.studio_ai_analysis_jobs j
 where j.status='queued'
 order by j.created_at,j.id limit 1 for update skip locked;
 if not found then return null; end if;
 update public.studio_ai_analysis_jobs
 set status='analyzing',attempts=1,lease_token=gen_random_uuid(),
     lease_expires_at=now()+interval '4 minutes'
 where id=v_job.id returning * into v_job;
 return pg_catalog.jsonb_build_object(
   'id',v_job.id,'lease',v_job.lease_token,
   'quality',v_job.quality,'brief',v_job.brief_snapshot);
end $$;

create or replace function public.studio_ai_worker_finish(
 p_job uuid,p_lease uuid,p_analysis jsonb,p_input_tokens integer,
 p_output_tokens integer,p_cost_usd numeric
) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
 if p_analysis is null or pg_catalog.jsonb_typeof(p_analysis)<>'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(p_analysis))<>6
    or not (p_analysis ?& array['complexity','productionApproach',
       'estimatedDurationSeconds','needsVoiceover','needsReview','summary'])
    or p_analysis->>'complexity' not in
       ('simple','moderate','advanced','specialist_3d')
    or p_analysis->>'productionApproach' not in
       ('ffmpeg_text_motion','template_motion_graphics','custom_2d_animation',
        'specialist_3d','generative_media_required')
    or pg_catalog.jsonb_typeof(p_analysis->'estimatedDurationSeconds')<>'number'
    or (p_analysis->>'estimatedDurationSeconds') !~ '^[0-9]{1,3}$'
    or (p_analysis->>'estimatedDurationSeconds')::integer not between 1 and 600
    or pg_catalog.jsonb_typeof(p_analysis->'needsVoiceover')<>'boolean'
    or pg_catalog.jsonb_typeof(p_analysis->'needsReview')<>'boolean'
    or pg_catalog.jsonb_typeof(p_analysis->'summary')<>'string'
    or char_length(p_analysis->>'summary')>600
    or p_input_tokens not between 1 and 4000
    or p_output_tokens not between 1 and 900
    or p_cost_usd is null or p_cost_usd<0 or p_cost_usd>0.002 then
    raise exception 'Invalid AI analysis result or spend budget';
 end if;
 update public.studio_ai_analysis_jobs
 set status='completed',analysis=p_analysis,input_tokens=p_input_tokens,
   output_tokens=p_output_tokens,estimated_cost_usd=p_cost_usd,
   completed_at=now(),lease_token=null,lease_expires_at=null
 where id=p_job and lease_token=p_lease and status='analyzing'
   and lease_expires_at>now() and attempts=1;
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;

create or replace function public.studio_ai_worker_fail(
 p_job uuid,p_lease uuid,p_code text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
 if p_code not in ('analysis_failed','api_unavailable','budget_limit','timeout')
 then raise exception 'Invalid AI failure code'; end if;
 update public.studio_ai_analysis_jobs
 set status='failed',error_code=p_code,completed_at=now(),
     lease_token=null,lease_expires_at=null
 where id=p_job and lease_token=p_lease and status='analyzing'
   and lease_expires_at>now();
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;

revoke all on function public.studio_ai_worker_claim() from public,anon,authenticated;
revoke all on function public.studio_ai_worker_finish(uuid,uuid,jsonb,integer,integer,numeric)
 from public,anon,authenticated;
revoke all on function public.studio_ai_worker_fail(uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.studio_ai_worker_claim() to service_role;
grant execute on function public.studio_ai_worker_finish(uuid,uuid,jsonb,integer,integer,numeric)
 to service_role;
grant execute on function public.studio_ai_worker_fail(uuid,uuid,text) to service_role;
commit;
