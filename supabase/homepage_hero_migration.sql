-- Homepage hero image settings. Safe to run more than once.
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
  for select to anon, authenticated
  using (setting_key in ('homepage_hero_image_url','homepage_hero_image_alt') or public.is_ami_admin());
drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings" on public.site_settings
  for all to authenticated using (public.is_ami_admin()) with check (public.is_ami_admin());
insert into public.site_settings (setting_key, setting_value)
values
 ('homepage_hero_image_url',''),
 ('homepage_hero_image_alt','AMI – The Good Circle community and initiatives')
on conflict (setting_key) do nothing;
