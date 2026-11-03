-- Studio retention: seven days after last use, atomic claim before R2 deletion.
-- Backend renderer must set lifecycle='completed' only after verified final output.
-- No R2 objects are deleted by SQL: a scheduled Cloudflare Worker does that first.
begin;
alter table public.studio_projects drop constraint if exists studio_projects_lifecycle_enum;
alter table public.studio_projects add constraint studio_projects_lifecycle_enum
 check(lifecycle in ('intake','processing','completed','expired','deleting'));
alter table public.studio_projects
 add column if not exists delete_claimed_at timestamptz,
 add column if not exists delete_attempt_at timestamptz,
 add column if not exists delete_attempts integer not null default 0;

create index if not exists studio_projects_retention_due_idx
 on public.studio_projects(lifecycle,expires_at,created_at,delete_attempt_at);

-- Only privileged backends are allowed to mark a final project complete.
-- A completed project must have an expiry; the trigger sets it atomically.
create or replace function public.studio_guard_lifecycle()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' then
   if new.lifecycle<>'intake' or new.finalized_at is not null or new.expires_at is not null
      or new.delete_claimed_at is not null then
    raise exception 'Only intake requests may be submitted by clients';
   end if;
  elsif (new.lifecycle is distinct from old.lifecycle
      or new.finalized_at is distinct from old.finalized_at
      or new.expires_at is distinct from old.expires_at
      or new.last_opened_at is distinct from old.last_opened_at
      or new.delete_claimed_at is distinct from old.delete_claimed_at
      or new.delete_attempt_at is distinct from old.delete_attempt_at
      or new.delete_attempts is distinct from old.delete_attempts) then
    raise exception 'Only the trusted backend may update project lifecycle and expiry';
  end if;
 elsif tg_op='UPDATE' and new.lifecycle='completed' and old.lifecycle is distinct from 'completed' then
   new.finalized_at=now();
   new.last_opened_at=now();
   new.expires_at=now()+interval '7 days';
 end if;
 return new;
end $$;

-- Definer implementation is in private schema and always checks auth.uid().
create or replace function studio_private.studio_touch_completed_project(p_project uuid)
 returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_expiry timestamptz;
begin
 if v_uid is null then raise exception 'Sign in required'; end if;
 update public.studio_projects
   set last_opened_at=now(),expires_at=now()+interval '7 days'
   where id=p_project and owner_id=v_uid and lifecycle='completed'
     and expires_at>now()
 returning expires_at into v_expiry;
 return v_expiry;
end $$;
revoke all on function studio_private.studio_touch_completed_project(uuid) from public,anon;
grant execute on function studio_private.studio_touch_completed_project(uuid) to authenticated;
create or replace function public.studio_touch_completed_project(p_project uuid)
 returns timestamptz language sql security invoker set search_path='' as $$
 select studio_private.studio_touch_completed_project(p_project);
$$;
revoke all on function public.studio_touch_completed_project(uuid) from public,anon;
grant execute on function public.studio_touch_completed_project(uuid) to authenticated;

-- Internal worker RPC: only server-side secret-key (service_role), never a user JWT.
-- A claimed project is frozen against client extension while R2 deletion proceeds.
create or replace function studio_private.studio_gc_claim_next()
 returns uuid language plpgsql security invoker set search_path='' as $$
declare v_project uuid;
begin
 select p.id into v_project
 from public.studio_projects p
 where
   (p.lifecycle='completed' and p.expires_at is not null and p.expires_at<=now())
   or
   (p.lifecycle='intake' and
      greatest(p.created_at,
       coalesce((select max(m.created_at) from public.studio_intake_messages m where m.project_id=p.id),p.created_at),
       coalesce((select max(a.created_at) from public.studio_assets a where a.project_id=p.id),p.created_at),
       coalesce((select max(a.uploaded_at) from public.studio_assets a where a.project_id=p.id),p.created_at)
      )<=now()-interval '7 days')
   or
   (p.lifecycle='deleting' and coalesce(p.delete_attempt_at,'epoch'::timestamptz)<now()-interval '30 minutes')
 order by coalesce(p.delete_attempt_at,p.expires_at,p.created_at) asc
 limit 1 for update of p skip locked;
 if v_project is null then return null; end if;
 update public.studio_projects set lifecycle='deleting',
  delete_claimed_at=coalesce(delete_claimed_at,now()),
  delete_attempt_at=now(),delete_attempts=delete_attempts+1
 where id=v_project;
 return v_project;
end $$;
create or replace function public.studio_gc_claim_next()
 returns uuid language sql security invoker set search_path='' as $$
 select studio_private.studio_gc_claim_next();
$$;
revoke all on function public.studio_gc_claim_next() from public,anon,authenticated;
grant execute on function public.studio_gc_claim_next() to service_role;
revoke all on function studio_private.studio_gc_claim_next() from public,anon,authenticated;
grant usage on schema studio_private to service_role;
grant execute on function studio_private.studio_gc_claim_next() to service_role;

-- Called ONLY after the worker has deleted ALL R2 keys associated with the
-- claimed project. If any asset is stored elsewhere, refuse to finalize.
create or replace function studio_private.studio_gc_finish(p_project uuid)
 returns boolean language plpgsql security invoker set search_path='' as $$
declare v_count int;
begin
 if not exists(select 1 from public.studio_projects p where p.id=p_project and p.lifecycle='deleting' for update)
 then return false; end if;
 if exists(select 1 from public.studio_assets a where a.project_id=p_project
   and a.storage_provider<>'r2') then
   raise exception 'Non-R2 assets require an additional storage cleanup adapter';
 end if;
 update public.studio_assets set status='deleted'
  where project_id=p_project and storage_provider='r2' and status<>'deleted';
 delete from public.studio_projects where id=p_project and lifecycle='deleting';
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;
create or replace function public.studio_gc_finish(p_project uuid)
 returns boolean language sql security invoker set search_path='' as $$
 select studio_private.studio_gc_finish(p_project);
$$;
revoke all on function public.studio_gc_finish(uuid) from public,anon,authenticated;
grant execute on function public.studio_gc_finish(uuid) to service_role;
revoke all on function studio_private.studio_gc_finish(uuid) from public,anon,authenticated;
grant execute on function studio_private.studio_gc_finish(uuid) to service_role;
commit;
