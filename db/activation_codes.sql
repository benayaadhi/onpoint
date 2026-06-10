-- Activation codes + tier gate. Run ONCE in the Supabase SQL Editor.
-- Additive: nothing existing changes. Until this is installed, the app
-- falls back to creating tournaments without a tier (full access), so
-- deploy order doesn't matter — same pattern as save_tournament_merged.

create table if not exists activation_codes (
  code text primary key,
  tier text not null check (tier in ('starter', 'compact', 'tournament', 'championship')),
  status text not null default 'unused' check (status in ('unused', 'used', 'void')),
  tournament_id text,
  note text, -- buyer name / WA contact, for your bookkeeping
  created_at timestamptz default now(),
  redeemed_at timestamptz
);

-- Network ads (WePadl's own reel, shown on starter-tier TVs). Single row.
create table if not exists network_ads (
  id int primary key default 1,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);
insert into network_ads (id) values (1) on conflict (id) do nothing;

-- RLS: the codes table is fully locked from the public API — codes can ONLY
-- be redeemed through the function below (which runs as definer), and only
-- created with the service-role key (scripts/gen-codes.ts). This is what
-- stops anyone minting their own codes via REST.
alter table activation_codes enable row level security;

-- network_ads must stay readable by TVs and writable from the (anon) admin
-- UI — same trust level as the tournaments table itself.
alter table network_ads enable row level security;
drop policy if exists network_ads_read on network_ads;
create policy network_ads_read on network_ads for select using (true);
drop policy if exists network_ads_write on network_ads;
create policy network_ads_write on network_ads for all using (true) with check (true);

-- Atomically redeem a code: only an 'unused' code passes, and it can never
-- be redeemed twice (row lock serializes concurrent attempts). SECURITY
-- DEFINER so it can see the RLS-locked codes table.
create or replace function redeem_activation_code(p_code text, p_tournament_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_code text := upper(trim(p_code));
begin
  select tier into v_tier
  from activation_codes
  where code = v_code and status = 'unused'
  for update;

  if v_tier is null then
    return null; -- unknown, already used, or voided
  end if;

  update activation_codes
  set status = 'used', tournament_id = p_tournament_id, redeemed_at = now()
  where code = v_code;

  return v_tier;
end;
$$;

-- Revert (removes the gate; the app falls back to ungated creation):
--   drop function if exists redeem_activation_code(text, text);
--   drop table if exists activation_codes;
--   drop table if exists network_ads;

-- This file is safe to re-run (create if not exists / or replace / drop+create
-- policies).
