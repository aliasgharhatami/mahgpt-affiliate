-- Safety backstop: no Supabase project row may be deleted while its
-- private R2 objects are still marked active. Object deletion happens first.
begin;
create or replace function public.studio_prevent_orphan_r2_project()
returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.studio_assets a
           where a.project_id=old.id and a.owner_id=old.owner_id
             and a.storage_provider='r2' and a.status<>'deleted') then
   raise exception 'Delete private R2 assets before deleting their project';
 end if;
 return old;
end $$;
drop trigger if exists studio_prevent_orphan_r2_project_trigger on public.studio_projects;
create trigger studio_prevent_orphan_r2_project_trigger
 before delete on public.studio_projects
 for each row execute function public.studio_prevent_orphan_r2_project();
commit;