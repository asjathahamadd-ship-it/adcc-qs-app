create table if not exists public.dprs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete set null,
  report_date date not null default current_date,
  weather text, work jsonb default '[]', manpower jsonb default '[]',
  equipment text, remarks text, photos jsonb default '[]',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.dprs enable row level security;
create policy "own dprs" on public.dprs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.dprs to authenticated;
