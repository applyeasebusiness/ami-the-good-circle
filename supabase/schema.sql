-- AMI – The Good Circle backend schema
-- Run in Supabase SQL Editor. Review privacy and retention obligations before collecting real data.

create table if not exists public.form_submissions (
  id bigint generated always as identity primary key,
  form_type text not null check (form_type in ('contact', 'volunteer', 'membership')),
  payload jsonb not null,
  status text not null default 'new' check (status in ('new', 'in_review', 'responded', 'closed')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  location text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  registration_url text not null default '',
  cover_image_url text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  alt_text text not null,
  caption text not null default '',
  event_date date,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists form_submissions_set_updated_at on public.form_submissions;
create trigger form_submissions_set_updated_at before update on public.form_submissions
for each row execute function public.set_updated_at();
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();
drop trigger if exists gallery_items_set_updated_at on public.gallery_items;
create trigger gallery_items_set_updated_at before update on public.gallery_items
for each row execute function public.set_updated_at();

create or replace function public.is_ami_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
revoke all on function public.is_ami_admin() from public;
grant execute on function public.is_ami_admin() to authenticated;

alter table public.form_submissions enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.gallery_items enable row level security;

-- The Vercel server function uses SUPABASE_SERVICE_ROLE_KEY to insert submissions.
-- No anon/authenticated policies are granted for public form-submission access.
revoke all on public.form_submissions from anon, authenticated;
grant select, update on public.form_submissions to authenticated;
drop policy if exists "Admins can read submissions" on public.form_submissions;
create policy "Admins can read submissions" on public.form_submissions for select to authenticated using (public.is_ami_admin());
drop policy if exists "Admins can update submissions" on public.form_submissions;
create policy "Admins can update submissions" on public.form_submissions for update to authenticated using (public.is_ami_admin()) with check (public.is_ami_admin());

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
drop policy if exists "Users can read own profile or admins can read all" on public.profiles;
create policy "Users can read own profile or admins can read all" on public.profiles for select to authenticated using (id = auth.uid() or public.is_ami_admin());
-- No client policy permits changing roles. Promote an admin manually in SQL Editor.

revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events" on public.events for select to anon, authenticated using (status = 'published' or public.is_ami_admin());
drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events" on public.events for all to authenticated using (public.is_ami_admin()) with check (public.is_ami_admin());

revoke all on public.gallery_items from anon, authenticated;
grant select on public.gallery_items to anon, authenticated;
grant insert, update, delete on public.gallery_items to authenticated;
drop policy if exists "Public can read published gallery items" on public.gallery_items;
create policy "Public can read published gallery items" on public.gallery_items for select to anon, authenticated using (published = true or public.is_ami_admin());
drop policy if exists "Admins manage gallery items" on public.gallery_items;
create policy "Admins manage gallery items" on public.gallery_items for all to authenticated using (public.is_ami_admin()) with check (public.is_ami_admin());

-- Gallery storage: public image delivery, authenticated admins only for upload/update/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ami-gallery', 'ami-gallery', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view AMI gallery images" on storage.objects;
create policy "Public can view AMI gallery images" on storage.objects for select to anon, authenticated using (bucket_id = 'ami-gallery');
drop policy if exists "AMI admins can upload gallery images" on storage.objects;
create policy "AMI admins can upload gallery images" on storage.objects for insert to authenticated with check (bucket_id = 'ami-gallery' and public.is_ami_admin());
drop policy if exists "AMI admins can update gallery images" on storage.objects;
create policy "AMI admins can update gallery images" on storage.objects for update to authenticated using (bucket_id = 'ami-gallery' and public.is_ami_admin()) with check (bucket_id = 'ami-gallery' and public.is_ami_admin());
drop policy if exists "AMI admins can delete gallery images" on storage.objects;
create policy "AMI admins can delete gallery images" on storage.objects for delete to authenticated using (bucket_id = 'ami-gallery' and public.is_ami_admin());

-- After the first admin user signs up via /admin.html, run this query with that user's UUID:
-- insert into public.profiles (id, display_name, role)
-- values ('PASTE-AUTH-USER-UUID-HERE', 'AMI Administrator', 'admin')
-- on conflict (id) do update set role = 'admin', display_name = excluded.display_name;
