-- MAH GPT Studio — automatic intake behind the main composer.
-- Archive is for finalized outputs only, not text drafts or upload tests.
begin;
alter table public.studio_projects
 add column if not exists lifecycle text not null default 'intake',
 add column if not exists finalized_at timestamptz,
 add column if not exists last_opened_at timestamptz,
 add column if not exists expires_at timestamptz;
alter table public.studio_projects
 add constraint studio_projects_lifecycle_enum
 check(lifecycle in ('intake','processing','completed','expired'));
create index if not exists studio_projects_archive_idx
 on public.studio_projects(owner_id,lifecycle,expires_at);

-- Do not allow client-side fake completed/paid projects, or manipulation of
-- finalization. A trusted rendering backend can later promote completed files.
create or replace function public.studio_guard_lifecycle()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' then
   if new.lifecycle<>'intake' or new.finalized_at is not null or new.expires_at is not null then
    raise exception 'Only intake requests may be submitted by clients';
   end if;
  elsif (new.lifecycle is distinct from old.lifecycle
      or new.finalized_at is distinct from old.finalized_at
      or new.expires_at is distinct from old.expires_at
      or new.last_opened_at is distinct from old.last_opened_at) then
    raise exception 'Only the trusted rendering backend can change finalization or expiry';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists studio_guard_lifecycle_trigger on public.studio_projects;
create trigger studio_guard_lifecycle_trigger
 before insert or update on public.studio_projects
 for each row execute function public.studio_guard_lifecycle();

create table if not exists public.studio_intake_messages(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 role text not null default 'user' check(role in ('user','assistant')),
 body text not null check(char_length(body) between 1 and 10000),
 created_at timestamptz not null default now(),
 constraint studio_intake_messages_project_fk
 foreign key(project_id,owner_id) references public.studio_projects(id,owner_id) on delete cascade
);
create index if not exists studio_intake_messages_project_idx
 on public.studio_intake_messages(project_id,created_at,id);
alter table public.studio_intake_messages enable row level security;
revoke all on public.studio_intake_messages from anon,authenticated;
grant select on public.studio_intake_messages to authenticated;
grant insert(project_id,body) on public.studio_intake_messages to authenticated;
create policy "intake messages: owner read"
 on public.studio_intake_messages for select to authenticated
 using(owner_id=(select auth.uid()));
create policy "intake messages: owner text submission"
 on public.studio_intake_messages for insert to authenticated
 with check(owner_id=(select auth.uid()) and role='user'
  and exists(select 1 from public.studio_projects p
   where p.id=project_id and p.owner_id=(select auth.uid()) and p.lifecycle='intake'));

-- Completed jobs only: on reopen/explicit reuse extend expiry by 7 days,
-- and only for the owner. No client can set finalized_at on its own.
create or replace function public.studio_touch_completed_project(p_project uuid)
 returns timestamptz language plpgsql security invoker set search_path='' as $$
declare v_expiry timestamptz;
begin
 update public.studio_projects p
 set last_opened_at=now(),expires_at=now()+interval '7 days'
 where p.id=p_project and p.owner_id=(select auth.uid())
   and p.lifecycle='completed' and (p.expires_at is null or p.expires_at>now())
 returning expires_at into v_expiry;
 return v_expiry;
end $$;
-- Function changes controlled server fields. It runs SECURITY INVOKER with
-- the caller's permissions but trigger rejects client-side updates; a narrowly
-- privileged service endpoint must perform touch later (not exposed today).
revoke execute on function public.studio_touch_completed_project(uuid) from public,anon,authenticated;
commit;