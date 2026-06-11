-- Team registration RPCs. Run ONCE in the Supabase SQL Editor. Additive.
--
-- Why RPCs: registrations arrive concurrently from many players' phones.
-- A plain read-modify-write of the tournament row would let two simultaneous
-- submissions clobber each other (the same disease the per-match merge cured
-- for scores), so every entry mutation is atomic under a row lock here.

-- Register a team. Respects the quota: entries beyond it are waitlisted.
-- Returns: {"status": "registered"|"waitlist"|"closed"|"not_found", "count": n}
create or replace function register_team(p_tournament_id text, p_entry jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb;
  cfg jsonb;
  regs jsonb;
  quota int;
  cnt int;
  entry jsonb := p_entry;
  status text;
begin
  select data into d from tournaments where id = p_tournament_id for update;
  if d is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  cfg := d->'registration';
  if cfg is null or coalesce((cfg->>'enabled')::boolean, false) = false then
    return jsonb_build_object('status', 'closed');
  end if;

  regs := coalesce(d->'registrations', '[]'::jsonb);
  cnt := jsonb_array_length(regs);
  quota := coalesce((cfg->>'quota')::int, 0); -- 0 = unlimited

  if quota > 0 and cnt >= quota then
    status := 'waitlist';
  else
    status := 'registered';
  end if;
  entry := entry || jsonb_build_object('waitlist', status = 'waitlist');

  update tournaments
  set data = jsonb_set(d, '{registrations}', regs || entry)
  where id = p_tournament_id;

  return jsonb_build_object('status', status, 'count', cnt + 1);
end;
$$;

-- Toggle paid / remove an entry (admin actions), atomic for the same reason.
create or replace function update_registration(
  p_tournament_id text,
  p_entry_id text,
  p_action text, -- 'paid' | 'unpaid' | 'delete'
  p_promote boolean default false -- delete: also promote first waitlisted
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb;
  regs jsonb;
  out_regs jsonb := '[]'::jsonb;
  e jsonb;
  found boolean := false;
  promoted boolean := false;
begin
  select data into d from tournaments where id = p_tournament_id for update;
  if d is null then return false; end if;
  regs := coalesce(d->'registrations', '[]'::jsonb);

  for e in select * from jsonb_array_elements(regs) loop
    if e->>'id' = p_entry_id then
      found := true;
      if p_action = 'delete' then
        continue; -- drop it
      elsif p_action = 'paid' then
        e := e || '{"paid": true}'::jsonb;
      elsif p_action = 'unpaid' then
        e := e || '{"paid": false}'::jsonb;
      end if;
    elsif p_action = 'delete' and p_promote and not promoted
          and coalesce((e->>'waitlist')::boolean, false) then
      e := e || '{"waitlist": false}'::jsonb; -- a slot opened up
      promoted := true;
    end if;
    out_regs := out_regs || e;
  end loop;

  if not found then return false; end if;
  update tournaments
  set data = jsonb_set(d, '{registrations}', out_regs)
  where id = p_tournament_id;
  return true;
end;
$$;

-- Revert:
--   drop function if exists register_team(text, jsonb);
--   drop function if exists update_registration(text, text, text, boolean);
