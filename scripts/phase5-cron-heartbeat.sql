-- phase5-cron-heartbeat.sql
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- Registra cada ejecución del keep-alive (cron y manual). Append-only.

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  status text not null check (status in ('ok', 'error')),
  source text not null check (source in ('cron', 'manual')),
  detail text
);

alter table public.cron_runs enable row level security;

drop policy if exists "cron_runs_select" on public.cron_runs;
create policy "cron_runs_select" on public.cron_runs
  for select to anon using (true);

drop policy if exists "cron_runs_insert" on public.cron_runs;
create policy "cron_runs_insert" on public.cron_runs
  for insert to anon
  with check (status in ('ok', 'error') and source in ('cron', 'manual'));

grant select, insert on public.cron_runs to anon;

create index if not exists idx_cron_runs_ran_at on public.cron_runs (ran_at desc);
