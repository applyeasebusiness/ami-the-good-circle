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
