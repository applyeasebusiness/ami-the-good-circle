-- AMI professional website content migration.
-- Run once in Supabase SQL Editor after the existing AMI schema.sql has been applied.
-- Adds editable public copy, team profiles, and transparency documents.

-- ===== supabase/page_content_settings_migration.sql =====
-- Editable page headings and introductions managed from the admin dashboard.
create table if not exists public.site_settings (
  setting_key text primary key,
  setting_value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
drop policy if exists "Public can read homepage hero settings" on public.site_settings;
create policy "Public can read homepage hero settings" on public.site_settings
for select to anon, authenticated using (
  setting_key in (
    'homepage_hero_image_url','homepage_hero_image_alt',
    'homepage_eyebrow','homepage_heading_first','homepage_heading_highlight','homepage_subtitle',
    'about_heading','about_intro','initiatives_heading','initiatives_intro',
    'transparency_heading','transparency_intro',
    'home_intro_heading','home_intro_body','nature_title','nature_description','society_title','society_description','culture_title','culture_description',
    'about_vision','about_mission','about_values_intro','initiatives_nature_description','initiatives_society_description','initiatives_culture_description'
  ) or public.is_ami_admin()
);
drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings" on public.site_settings
for all to authenticated using (public.is_ami_admin()) with check (public.is_ami_admin());
insert into public.site_settings(setting_key,setting_value) values
('homepage_hero_image_url',''),
('homepage_hero_image_alt','AMI – The Good Circle community and initiatives'),
('homepage_eyebrow','GOOD PEOPLE · GOOD ACTIONS · GOOD CHANGE'),
('homepage_heading_first','Small actions.'),
('homepage_heading_highlight','Meaningful change.'),
('homepage_subtitle','Working together for a greener environment, a stronger society and a thriving Assamese culture.'),
('about_heading','Good people. Good actions. Good change.'),
('about_intro','Our Land. Our People. Our Responsibility.'),
('initiatives_heading','Three themes. One shared purpose.'),
('initiatives_intro','We bring people together through practical, locally relevant activities.'),
('transparency_heading','Trust is built through transparency.'),
('transparency_intro','We aim to make relevant public information easy to find. Documents and updates are published by the AMI team only after review.'),
('home_intro_heading','A good circle can create a better world.'),
('home_intro_body','AMI – The Good Circle brings people together around the things that matter: our natural heritage, our communities and the culture that connects us. We believe meaningful progress starts locally, with people taking action together.'),
('nature_title','Protect our natural heritage'),('nature_description','Support wildlife conservation, environmental awareness and care for Assam’s unique landscapes.'),
('society_title','Stand together as a community'),('society_description','Encourage compassion, community participation, resilience and support for people in need.'),
('culture_title','Celebrate art and identity'),('culture_description','Promote creative expression and celebrate the language, stories, music and traditions of Assam.'),
('about_vision','To help build a compassionate, environmentally conscious and culturally vibrant society through collective action and community participation.'),
('about_mission','AMI – The Good Circle aims to bring people together around initiatives that care for nature, support communities and celebrate culture. We believe positive change grows when people contribute their time, creativity, knowledge and care.'),
('about_values_intro','Responsibility, compassion, participation and respect for our shared future.'),
('initiatives_nature_description','Potential activities include wildlife awareness, habitat conservation education, waste reduction and community environmental initiatives.'),
('initiatives_society_description','Potential activities include community support, volunteer participation, inclusive activities and local resilience.'),
('initiatives_culture_description','Potential activities include creative arts, storytelling, language, music and the celebration of Assamese identity.')
on conflict(setting_key) do nothing;


-- ===== supabase/team_members_migration.sql =====
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


-- ===== supabase/transparency_documents_migration.sql =====
-- Public transparency documents managed by AMI administrators.
create table if not exists public.public_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Update',
  description text not null default '',
  document_url text not null,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists public_documents_set_updated_at on public.public_documents;
create trigger public_documents_set_updated_at before update on public.public_documents
for each row execute function public.set_updated_at();
alter table public.public_documents enable row level security;
drop policy if exists "Public can read published transparency documents" on public.public_documents;
create policy "Public can read published transparency documents" on public.public_documents for select to anon, authenticated using (published = true or public.is_ami_admin());
drop policy if exists "Admins manage transparency documents" on public.public_documents;
create policy "Admins manage transparency documents" on public.public_documents for all to authenticated using (public.is_ami_admin()) with check (public.is_ami_admin());
grant select on public.public_documents to anon, authenticated;
grant insert, update, delete on public.public_documents to authenticated;
