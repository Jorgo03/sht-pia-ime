-- Plans are sold in periods of 1, 3, 6 or 12 months, for promotions and
-- agency plans alike (owner, 2026-10-14). Replaces duration_days and
-- billing_interval='month', which could only say "N days" or "monthly".
--
-- Shape after this: one row per (kind, tier, period). "Pro" is four rows
-- (pro/1, pro/3, pro/6, pro/12) sharing a tier name, so the apps show one
-- plan with four lengths, and each length can be priced on its own (longer
-- usually cheaper per month). Promotions run their period once and end;
-- agency plans renew every period_months.
--
-- PENDING: not yet applied. Supabase asks the owner to confirm destructive
-- steps (the two DROP COLUMNs), and the prompt timed out unanswered on
-- 2026-10-14. Apply on the owner's go, then move into supabase/migrations/
-- under the version Supabase records.
--
-- Safe as an in-place change: applied while public.plans held 0 rows and no
-- other table referenced one (verified before applying).

alter table public.plans drop constraint plans_shape;
alter table public.plans drop column duration_days;
alter table public.plans drop column billing_interval;

alter table public.plans
  add column tier text not null check (tier ~ '^[a-z0-9_]+$'),
  add column period_months integer not null check (period_months in (1, 3, 6, 12));

alter table public.plans
  add constraint plans_one_price_per_tier_and_period unique (kind, tier, period_months);

comment on column public.plans.tier is
  'Plan family shown to users, e.g. promote, pro, premium. One row per period.';
comment on column public.plans.period_months is
  'Length bought: 1, 3, 6 or 12 months. Promotions run it once; agency plans renew every period.';
comment on column public.plans.promotion_credits is
  'Agency plans: free listing promotions included per month of the plan.';
