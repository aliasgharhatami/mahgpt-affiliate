-- Close exposed SECURITY DEFINER warning with private implementation and invoker RPC.
begin;
create schema if not exists studio_private;
revoke all on schema studio_private from public,anon,authenticated;
grant usage on schema studio_private to authenticated;

create or replace function studio_private.studio_beta_reserve_asset(
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
 v_path=v_owner::text||'/'||p_project::text||'/r2/'||v_id::text||'/'||v_clean;
 insert into public.studio_assets(id,owner_id,project_id,storage_path,filename,media_type,
     byte_size,storage_provider,status,rights_attested_at)
 values(v_id,v_owner,p_project,v_path,p_filename,p_mime,p_size,'r2','reserved',now());
 update public.studio_media_testers
    set consumed_lifetime_bytes=consumed_lifetime_bytes+p_size,
        uploads_reserved=uploads_reserved+1 where user_id=v_owner;
 asset_id=v_id; storage_key=v_path; return next;
end $$;


create or replace function studio_private.studio_beta_set_asset_status(p_asset uuid,p_next text)
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

revoke all on function studio_private.studio_beta_reserve_asset(uuid,text,text,bigint,boolean) from public,anon;
grant execute on function studio_private.studio_beta_reserve_asset(uuid,text,text,bigint,boolean) to authenticated;
revoke all on function studio_private.studio_beta_set_asset_status(uuid,text) from public,anon;
grant execute on function studio_private.studio_beta_set_asset_status(uuid,text) to authenticated;

create or replace function public.studio_beta_reserve_asset(
 p_project uuid,p_filename text,p_mime text,p_size bigint,p_rights_confirmed boolean
) returns table(asset_id uuid,storage_key text)
language sql security invoker set search_path = ''
as $$
 select * from studio_private.studio_beta_reserve_asset(p_project,p_filename,p_mime,p_size,p_rights_confirmed);
$$;

create or replace function public.studio_beta_set_asset_status(p_asset uuid,p_next text)
returns boolean language sql security invoker set search_path=''
as $$
 select studio_private.studio_beta_set_asset_status(p_asset,p_next);
$$;

revoke all on function public.studio_beta_reserve_asset(uuid,text,text,bigint,boolean) from public,anon;
grant execute on function public.studio_beta_reserve_asset(uuid,text,text,bigint,boolean) to authenticated;
revoke all on function public.studio_beta_set_asset_status(uuid,text) from public,anon;
grant execute on function public.studio_beta_set_asset_status(uuid,text) to authenticated;
commit;
