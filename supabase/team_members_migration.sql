-- Team profiles managed from the AMI admin dashboard.
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_title text not null default '',
  bio text not null default '',
  photo_url text not null default '',
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at before update on public.team_members
for each row execute function public.set_updated_at();
alter table public.team_members enable row level security;
drop policy if exists "Public can read published team members" on public.team_members;
create policy "Public can read published team members" on public.team_members for select to anon, authenticated using (published = true or public.is_ami_admin());
drop policy if exists "Admins manage team members" on public.team_members;
create policy "Admins manage team members" on public.team_members for all to authenticated using (public.is_ami_admin()) with check (public.is_ami_admin());
grant select on public.team_members to anon, authenticated;
grant insert, update, delete on public.team_members to authenticated;
