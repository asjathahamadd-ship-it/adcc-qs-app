create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete set null,
  stage text not null, location text, taken_on date default current_date,
  note text, photos jsonb default '[]',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.progress_photos enable row level security;
create policy "own progress photos" on public.progress_photos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.progress_photos to authenticated;
