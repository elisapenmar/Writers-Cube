-- Account-level subscription plan state plus a monthly AI-assist usage meter.
--
-- Billing happens on the website via Stripe (reader-app model); the app only
-- signs users in and reads plan state. This migration adds the persistence the
-- requirePlan() gate and the free-tier caps enforce against. It is idempotent,
-- so it is safe to run whether or not the objects already exist.
--
-- Plans: 'free' (default) or 'paid'. A single cross-device subscription, so the
-- plan is keyed to the user, not to a device or a project.

create table if not exists account_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  -- Optional metadata the website's Stripe webhook can fill in later. Kept here
  -- so the app never needs to talk to Stripe; it only reads these columns.
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table account_plans enable row level security;

-- A user may read their own plan. Writes are intentionally NOT granted to the
-- authenticated role: plan changes come from the website's Stripe webhook (a
-- service-role context), never from the signed-in app. This prevents a user
-- from upgrading themselves by writing the row directly.
do $$ begin
  create policy "read own plan" on account_plans
    for select to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Per-user, per-month tally of AI-assist calls. The free tier caps how many of
-- these a user may run each month, because each call bills the Claude API per
-- token. `period` is the first day of the month (UTC) the count applies to.
create table if not exists ai_usage_meter (
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null,
  used int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

alter table ai_usage_meter enable row level security;

-- A user may read their own usage (to render "X of Y assists used this month").
-- The increment is done by a SECURITY DEFINER function below, so no direct
-- insert/update policy is granted to the authenticated role.
do $$ begin
  create policy "read own ai usage" on ai_usage_meter
    for select to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Atomically increment (and create) the current month's counter for the caller
-- and return the new total. SECURITY DEFINER so the row is written without an
-- RLS write policy, but it always acts on auth.uid() so a user can only ever
-- move their own meter.
create or replace function public.increment_ai_usage(p_period date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into ai_usage_meter (user_id, period, used, updated_at)
    values (auth.uid(), p_period, 1, now())
  on conflict (user_id, period)
    do update set used = ai_usage_meter.used + 1, updated_at = now()
  returning used into v_used;
  return v_used;
end;
$$;
