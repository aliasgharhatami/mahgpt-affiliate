-- Phase 11C: Founder-only Oracle render queue. No public rendering is enabled by this migration.
-- Requires existing studio_projects, studio_assets, studio_media_testers and lifecycle guards.
begin;
create table if not exists public.studio_render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  preset text not null default 'brief-preview-v1'
    check (preset = 'brief-preview-v1'),
  brief_snapshot text not null default '' check (char_length(brief_snapshot) <= 3000),
  status text not null default 'queued'
    check (status in ('queued','rendering','completed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 2),
  lease_token uuid,
  lease_expires_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  output_asset_id uuid references public.studio_assets(id) on delete set null,
  error_code text check (error_code is null or error_code in ('render_failed','input_unavailable','output_failed','timeout')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_render_jobs_owner_project_fk
    foreign key(project_id,owner_id) references public.studio_projects(id,owner_id) on delete cascade
);
create index if not exists studio_render_jobs_owner_idx on public.studio_render_jobs(owner_id,created_at desc);
create index if not exists studio_render_jobs_queue_idx on public.studio_render_jobs(status,created_at);
create unique index if not exists studio_render_jobs_one_active_owner
 on public.studio_render_jobs(owner_id) where status in ('queued','rendering');
alter table public.studio_render_jobs enable row level security;
revoke all on public.studio_render_jobs from public,anon,authenticated;
grant select on public.studio_render_jobs to authenticated;
grant insert(project_id,preset) on public.studio_render_jobs to authenticated;
drop policy if exists "studio jobs: owner read" on public.studio_render_jobs;
create policy "studio jobs: owner read" on public.studio_render_jobs for select to authenticated
 using(owner_id=(select auth.uid()));
drop policy if exists "studio jobs: founder queue" on public.studio_render_jobs;
create policy "studio jobs: founder queue" on public.studio_render_jobs for insert to authenticated
 with check(owner_id=(select auth.uid()) and status='queued' and attempts=0
   and exists(select 1 from public.studio_media_testers t where t.user_id=(select auth.uid()))
   and exists(select 1 from public.studio_projects p where p.id=project_id
     and p.owner_id=(select auth.uid()) and p.lifecycle='intake'));

create or replace function public.studio_render_job_intake_guard()
 returns trigger language plpgsql security invoker set search_path='' as $$
declare v_project public.studio_projects%rowtype;
begin
 if (select auth.uid()) is null or new.owner_id is distinct from (select auth.uid()) then
   raise exception 'Authentication required';
 end if;
 -- Serialize concurrent submissions for this account before applying the daily quota.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text, 114));
 select * into v_project from public.studio_projects
   where id=new.project_id and owner_id=new.owner_id and lifecycle='intake' for update;
 if not found then raise exception 'Only an unfinished owned project can be rendered'; end if;
 if not exists(select 1 from public.studio_media_testers t where t.user_id=new.owner_id) then
   raise exception 'Render pilot is not enabled for this account';
 end if;
 if (select count(*) from public.studio_render_jobs j
    where j.owner_id=new.owner_id and j.created_at>now()-interval '24 hours')>=3 then
   raise exception 'Private render limit: 3 jobs per 24 hours';
 end if;
 if exists(select 1 from public.studio_render_jobs j where j.owner_id=new.owner_id
     and j.status in ('queued','rendering')) then
   raise exception 'A render job is already active';
 end if;
 if new.preset<>'brief-preview-v1' then raise exception 'Unsupported render preset'; end if;
 new.brief_snapshot=left(coalesce((
   select m.body from public.studio_intake_messages m where m.project_id=new.project_id
   and m.owner_id=new.owner_id and m.role='user' order by m.created_at desc,m.id desc limit 1
 ),nullif(v_project.brief,''),v_project.title),3000);
 new.status='queued';new.attempts=0;new.lease_token=null;new.lease_expires_at=null;
 new.output_asset_id=null;new.started_at=null;new.finished_at=null;new.error_code=null;
 new.created_at=now();new.updated_at=now();
 return new;
end $$;
drop trigger if exists studio_render_job_intake_guard_trigger on public.studio_render_jobs;
create trigger studio_render_job_intake_guard_trigger before insert on public.studio_render_jobs
 for each row execute function public.studio_render_job_intake_guard();

-- Invoker-only RPCs are restricted to service_role at the grant boundary.
-- The Cloudflare Pages worker gateway holds the server secret; browsers never do.
create or replace function public.studio_worker_claim()
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_job public.studio_render_jobs%rowtype;
begin
 -- Recover abandoned workers; at most two attempts per job.
 update public.studio_projects p set lifecycle='intake'
 where p.lifecycle='processing' and exists(
   select 1 from public.studio_render_jobs j where j.project_id=p.id
    and j.status='rendering' and j.lease_expires_at<now()
 );
 update public.studio_render_jobs j set
   status=case when attempts<2 then 'queued' else 'failed' end,
   lease_token=null,lease_expires_at=null,updated_at=now(),
   finished_at=case when attempts>=2 then now() else null end,
   error_code=case when attempts>=2 then 'timeout' else null end
 where j.status='rendering' and j.lease_expires_at<now();
 select * into v_job from public.studio_render_jobs j
  where j.status='queued' order by j.created_at,j.id limit 1 for update skip locked;
 if not found then return null; end if;
 update public.studio_render_jobs set status='rendering',
  attempts=attempts+1,lease_token=gen_random_uuid(),
  lease_expires_at=now()+interval '15 minutes',
  started_at=coalesce(started_at,now()),updated_at=now()
 where id=v_job.id returning * into v_job;
 update public.studio_projects set lifecycle='processing' where id=v_job.project_id and lifecycle='intake';
 return pg_catalog.jsonb_build_object(
  'id',v_job.id,'project_id',v_job.project_id,'preset',v_job.preset,
  'lease',v_job.lease_token,'brief',v_job.brief_snapshot,
  'assets',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',a.id,'media_type',a.media_type,'byte_size',a.byte_size)
      order by a.created_at,a.id)
    from (select * from public.studio_assets
      where owner_id=v_job.owner_id and project_id=v_job.project_id
      and storage_provider='r2' and status='ready'
      and media_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime')
      order by created_at,id limit 4) a
  ),'[]'::jsonb)
 );
end $$;

create or replace function public.studio_worker_renew(p_job uuid,p_lease uuid)
 returns boolean language plpgsql security invoker set search_path='' as $$
declare v_count int;
begin
 update public.studio_render_jobs set lease_expires_at=now()+interval '15 minutes',updated_at=now()
 where id=p_job and lease_token=p_lease and status='rendering' and lease_expires_at>now();
 get diagnostics v_count=row_count;return v_count=1;
end $$;

create or replace function public.studio_worker_fail(p_job uuid,p_lease uuid,p_code text)
 returns boolean language plpgsql security invoker set search_path='' as $$
declare v_job public.studio_render_jobs%rowtype;
begin
 if p_code not in ('render_failed','input_unavailable','output_failed','timeout') then
   raise exception 'Invalid failure code'; end if;
 update public.studio_render_jobs set status='failed',error_code=p_code,
  finished_at=now(),updated_at=now(),lease_expires_at=null,lease_token=null
 where id=p_job and lease_token=p_lease and status='rendering' and lease_expires_at>now()
 returning * into v_job;
 if not found then return false; end if;
 update public.studio_projects set lifecycle='intake'
   where id=v_job.project_id and lifecycle='processing';
 return true;
end $$;

-- Call only AFTER Cloudflare confirms actual R2 object bytes and video/mp4 signature.
create or replace function public.studio_worker_finish(
 p_job uuid,p_lease uuid,p_bytes bigint)
 returns boolean language plpgsql security invoker set search_path='' as $$
declare v_job public.studio_render_jobs%rowtype;v_asset uuid;v_path text;
begin
 if p_bytes<1000 or p_bytes>20000000 then raise exception 'Output size outside pilot limit';end if;
 select * into v_job from public.studio_render_jobs
   where id=p_job and lease_token=p_lease and status='rendering'
    and lease_expires_at>now() for update;
 if not found then return false; end if;
 v_path=v_job.owner_id::text||'/'||v_job.project_id::text||'/r2/render/'||v_job.id::text||'/final.mp4';
 insert into public.studio_assets
 (owner_id,project_id,storage_path,filename,media_type,byte_size,storage_provider,status,uploaded_at)
 values(v_job.owner_id,v_job.project_id,v_path,'studio-preview.mp4',
 'video/mp4',p_bytes,'r2','ready',now())
 returning id into v_asset;
 update public.studio_render_jobs set status='completed',output_asset_id=v_asset,
   lease_expires_at=null,lease_token=null,finished_at=now(),updated_at=now()
 where id=p_job;
 update public.studio_projects set lifecycle='completed',updated_at=now()
 where id=v_job.project_id and lifecycle='processing';
 if not found then raise exception 'Project no longer processing'; end if;
 return true;
end $$;

revoke all on function public.studio_worker_claim() from public,anon,authenticated;
revoke all on function public.studio_worker_renew(uuid,uuid) from public,anon,authenticated;
revoke all on function public.studio_worker_fail(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.studio_worker_finish(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.studio_worker_claim() to service_role;
grant execute on function public.studio_worker_renew(uuid,uuid) to service_role;
grant execute on function public.studio_worker_fail(uuid,uuid,text) to service_role;
grant execute on function public.studio_worker_finish(uuid,uuid,bigint) to service_role;
-- Worker connection uses a service-role JWT under Cloudflare Pages only.
grant select,insert,update,delete on public.studio_render_jobs to service_role;
-- Disallow deleting a project with an active job even if the owner triggers a stale UI action.
create or replace function public.studio_render_protect_project()
 returns trigger language plpgsql security invoker set search_path='' as $
begin
 if current_user in ('authenticated','anon') and
   exists(select 1 from public.studio_render_jobs j where j.project_id=old.id
     and j.status in ('queued','rendering')) then
   if tg_op='DELETE' then raise exception 'Cannot delete a project during rendering';end if;
   if new.brief is distinct from old.brief or new.reference_url is distinct from old.reference_url
      or new.selected_style is distinct from old.selected_style then
      raise exception 'Cannot modify this project during rendering';end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $;
drop trigger if exists studio_render_protect_project_trigger on public.studio_projects;
create trigger studio_render_protect_project_trigger before update or delete on public.studio_projects
 for each row execute function public.studio_render_protect_project();
commit;
