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
    'transparency_heading','transparency_intro'
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
('transparency_intro','We aim to make relevant public information easy to find. Documents and updates are published by the AMI team only after review.')
on conflict(setting_key) do nothing;
