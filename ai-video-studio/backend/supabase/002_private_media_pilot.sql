-- MAH GPT Studio: R2 private media PILOT ONLY; no public upload access
-- One approved tester; lifetime quota 80,000,000 bytes; 15,000,000 bytes/file.
-- The owner-only Cloudflare Pages endpoint must verify a Supabase JWT and RLS.
begin;
create table if not exists public.studio_media_testers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 consumed_lifetime_bytes bigint not null default 0 check(consumed_lifetime_bytes between 0 and 80000000),
 uploads_reserved int not null default 0 check(uploads_reserved between 0 and 50),
 created_at timestamptz not null default now()
);
alter table public.studio_media_testers enable row level security;
revoke all on public.studio_media_testers from anon,authenticated;
grant select on public.studio_media_testers to authenticated;
drop policy if exists "pilot testers can read own eligibility" on public.studio_media_testers;
create policy "pilot testers can read own eligibility"
 on public.studio_media_testers for select to authenticated
 using(user_id=(select auth.uid()));
-- Confirmed founder's email only. No credentials are stored here.
insert into public.studio_media_testers(user_id)
select id from auth.users where lower(email)='mahoo.hatami@gmail.com' and email_confirmed_at is not null
on conflict(user_id) do nothing;

alter table public.studio_assets
 add column if not exists storage_provider text not null default 'supabase',
 add column if not exists status text not null default 'ready',
 add column if not exists rights_attested_at timestamptz,
 add column if not exists uploaded_at timestamptz;
alter table public.studio_assets
 add constraint studio_media_provider_valid check(storage_provider in ('supabase','r2')),
 add constraint studio_media_status_valid check(status in ('reserved','uploading','ready','deleted'));
create index if not exists studio_assets_owner_provider_idx
 on public.studio_assets(owner_id,storage_provider,created_at desc);
-- Protect R2 catalogue from direct browser tampering; writes via validated RPC.
revoke insert,delete,update on public.studio_assets from authenticated;
grant select on public.studio_assets to authenticated;

create or replace function public.studio_beta_reserve_asset(
 p_project uuid,p_filename text,p_mime text,p_size bigint,p_rights_confirmed boolean
) returns table(asset_id uuid, storage_key text)
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid());
        v_row public.studio_media_testers%rowtype;
        v_id uuid := gen_random_uuid();
        v_clean text;
        v_path text;
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 select * into v_row from public.studio_media_testers where user_id=v_owner for update;
 if not found then raise exception 'Private media pilot is not open for this account'; end if;
 if p_rights_confirmed is distinct from true then raise exception 'Media rights acknowledgement required'; end if;
 if not exists (select 1 from public.studio_projects p where p.id=p_project and p.owner_id=v_owner)
    then raise exception 'Project not found for this account'; end if;
 if p_size is null or p_size<100 or p_size>15000000 then raise exception 'Pilot file must be between 100 bytes and 15 MB'; end if;
 if p_mime not in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime',
                 'audio/mpeg','audio/wav','audio/x-wav','audio/mp4') then raise exception 'Unsupported file type'; end if;
 if p_filename is null or length(p_filename)<1 or length(p_filename)>255
    then raise exception 'Invalid filename'; end if;
 if v_row.consumed_lifetime_bytes+p_size>80000000 or v_row.uploads_reserved>=50
    then raise exception 'Private test lifetime quota reached'; end if;
 v_clean=regexp_replace(p_filename,'[^a-zA-Z0-9._-]','_', 'g');
 if length(v_clean)>100 then v_clean=right(v_clean,100); end if;
 v_path='u/'||v_owner::text||'/p/'||p_project::text||'/'||v_id::text||'/'||v_clean;
 insert into public.studio_assets(id,owner_id,project_id,storage_path,filename,media_type,
     byte_size,storage_provider,status,rights_attested_at)
 values(v_id,v_owner,p_project,v_path,p_filename,p_mime,p_size,'r2','reserved',now());
 update public.studio_media_testers
    set consumed_lifetime_bytes=consumed_lifetime_bytes+p_size,
        uploads_reserved=uploads_reserved+1 where user_id=v_owner;
 asset_id=v_id; storage_key=v_path; return next;
end $$;

create or replace function public.studio_beta_set_asset_status(p_asset uuid,p_next text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_count int;
begin
 if v_user is null or not exists(select 1 from public.studio_media_testers where user_id=v_user)
   then raise exception 'Pilot authentication required'; end if;
 if p_next = 'uploading' then
   update public.studio_assets set status='uploading'
    where id=p_asset and owner_id=v_user and storage_provider='r2' and status='reserved';
 elsif p_next = 'ready' then
   update public.studio_assets set status='ready',uploaded_at=now()
    where id=p_asset and owner_id=v_user and storage_provider='r2' and status='uploading';
 elsif p_next = 'deleted' then
   update public.studio_assets set status='deleted'
    where id=p_asset and owner_id=v_user and storage_provider='r2' and status in ('reserved','uploading','ready');
 else raise exception 'Unsupported status transition'; end if;
 get diagnostics v_count=row_count;
 return v_count=1;
end $$;

revoke all on function public.studio_beta_reserve_asset(uuid,text,text,bigint,boolean) from public,anon;
grant execute on function public.studio_beta_reserve_asset(uuid,text,text,bigint,boolean) to authenticated;
revoke all on function public.studio_beta_set_asset_status(uuid,text) from public,anon;
grant execute on function public.studio_beta_set_asset_status(uuid,text) to authenticated;
commit;
