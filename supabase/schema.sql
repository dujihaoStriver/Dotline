-- 点线 · Supabase schema (准备日后云同步时使用)
-- 当前 MVP 使用浏览器 localStorage，此文件先对齐数据模型。

create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  note text not null default '',
  kind text not null check (kind in ('timed', 'all_day')),
  start_date date not null,
  end_date date not null,
  color text not null default '#0f766e',
  start_at timestamptz,
  end_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  priority integer not null default 0,
  carried_from uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_dates_idx on public.tasks (user_id, start_date, end_date);

create index if not exists tasks_user_done_idx on public.tasks (user_id, done);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period in ('week', 'month', 'year')),
  period_key text not null,
  period_start date not null,
  period_end date not null,
  content text not null default '',
  insights text not null default '',
  carryovers text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period, period_key)
);

create index if not exists reviews_user_period_idx
  on public.reviews (user_id, period, period_key);

alter table public.tasks enable row level security;
alter table public.reviews enable row level security;

create policy "tasks_own_all" on public.tasks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reviews_own_all" on public.reviews
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
