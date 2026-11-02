-- MAH GPT Studio · first database migration (prepared, NOT deployed)
-- Apply only to a dedicated Supabase project after reviewing operator privacy
-- policies, authentication redirects, region and storage limits.
-- Exposes project data only to the authenticated owner (RLS).
begin;

create extension if not exists pgcrypto;

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled project',
  brief text not null default '',
  reference_url text,
  -- This is a draft and media catalogue only; job status/payment is server-owned.
  selected_style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, owner_id),
  constraint studio_project_title_length check (char_length(title) between 1 and 140),
  constraint studio_project_brief_length check (char_length(brief) <= 20000),
  constraint studio_reference_length check (reference_url is null or char_length(reference_url) <= 2048)
);

create index if not exists studio_projects_owner_idx
on public.studio_projects(owner_id, updated_at desc);

alter table public.studio_projects enable row level security;
revoke all on table public.studio_projects from anon, authenticated;
grant select, insert, update, delete on table public.studio_projects to authenticated;

create policy "projects: owner may read"
on public.studio_projects for select to authenticated
using (owner_id = (select auth.uid()));

create policy "projects: owner may insert"
on public.studio_projects for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "projects: owner may edit"
on public.studio_projects for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "projects: owner may delete"
on public.studio_projects for delete to authenticated
using (owner_id = (select auth.uid()));

create table if not exists public.studio_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  storage_path text not null,
  filename text not null,
  media_type text not null,
  byte_size bigint not null check (byte_size between 0 and 157286400),
  created_at timestamptz not null default now(),
  unique(owner_id, storage_path),
  constraint studio_assets_project_owner_fk
     foreign key (project_id, owner_id)
     references public.studio_projects(id, owner_id) on delete cascade,
  constraint studio_assets_path_scope check (
    split_part(storage_path,'/',1)=owner_id::text
    and split_part(storage_path,'/',2)=project_id::text
  ),
  constraint studio_assets_filename_length check (char_length(filename) between 1 and 255),
  constraint studio_assets_media_type_length check (char_length(media_type) between 3 and 100)
);

create index if not exists studio_assets_project_idx
on public.studio_assets(project_id, owner_id);

alter table public.studio_assets enable row level security;
revoke all on table public.studio_assets from anon, authenticated;
grant select, insert, delete on table public.studio_assets to authenticated;

create policy "assets: owner may read"
on public.studio_assets for select to authenticated
using (owner_id = (select auth.uid()));

create policy "assets: owner may add"
on public.studio_assets for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "assets: owner may delete"
on public.studio_assets for delete to authenticated
using (owner_id = (select auth.uid()));

-- Agreement history: create one record after a verified login, at acceptance.
-- This is not permission to publish, advertise, or train AI on user content.
create table if not exists public.studio_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  constraint studio_agreements_version check (
    char_length(terms_version) between 1 and 40
    and char_length(privacy_version) between 1 and 40
  ),
  unique(user_id, terms_version, privacy_version)
);
create index if not exists studio_agreements_user_idx
on public.studio_agreement_acceptances(user_id, accepted_at desc);
alter table public.studio_agreement_acceptances enable row level security;
revoke all on table public.studio_agreement_acceptances from anon, authenticated;
grant select, insert on table public.studio_agreement_acceptances to authenticated;
create policy "agreements: owner may read"
on public.studio_agreement_acceptances for select to authenticated
using (user_id = (select auth.uid()));
create policy "agreements: user may accept"
on public.studio_agreement_acceptances for insert to authenticated
with check (user_id = (select auth.uid()));

-- Quotes can only be written by the trusted backend. Client sees final
-- customer-facing charge (never internal model costs or secret provider data).
create table if not exists public.studio_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft'
      check (status in ('draft','quoted','expired','cancelled','accepted')),
  currency char(3) not null default 'USD',
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  customer_breakdown jsonb not null default '[]'::jsonb,
  estimate_version text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (project_id,owner_id)
    references public.studio_projects(id,owner_id) on delete cascade
);
create index if not exists studio_quotes_owner_idx
on public.studio_quotes(owner_id, project_id);
alter table public.studio_quotes enable row level security;
revoke all on table public.studio_quotes from anon, authenticated;
grant select on table public.studio_quotes to authenticated;
create policy "quotes: owner may read"
on public.studio_quotes for select to authenticated
using (owner_id = (select auth.uid()));

-- Private media bucket. Use one prefix per account and project:
-- <user-uuid>/<project-uuid>/<safe-asset-name>
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('studio-project-media','studio-project-media',false,157286400,
array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/wav','audio/mp4','audio/x-wav'])
on conflict (id) do nothing;

create policy "studio storage: user may upload under their folder"
on storage.objects for insert to authenticated
with check (
 bucket_id='studio-project-media'
 and (storage.foldername(name))[1] = (select auth.uid())::text
 and exists(
   select 1 from public.studio_projects p
   where p.owner_id=(select auth.uid())
   and p.id::text=(storage.foldername(name))[2]
 )
);
create policy "studio storage: user may view own files"
on storage.objects for select to authenticated
using (
 bucket_id='studio-project-media'
 and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "studio storage: user may delete own files"
on storage.objects for delete to authenticated
using (
 bucket_id='studio-project-media'
 and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
