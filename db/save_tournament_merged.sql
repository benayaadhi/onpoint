-- Atomic, conflict-safe tournament save.
-- Run ONCE in the Supabase SQL Editor. Additive: nothing else changes, and the
-- app falls back to a plain upsert if this function is absent.
--
-- Why: the app stores a whole tournament as one jsonb row. When two courts are
-- scored at once, each device saves its full (stale) copy → last-write-wins
-- clobbers the other court. This function locks the row and merges per match.

create or replace function save_tournament_merged(
  p_id text,
  p_name text,
  p_format text,
  p_data jsonb
) returns void
language plpgsql
as $$
declare
  existing jsonb;
begin
  -- Serialize concurrent writers for this tournament.
  select data into existing from tournaments where id = p_id for update;

  if existing is null then
    insert into tournaments (id, name, format, data, updated_at)
    values (p_id, p_name, p_format, p_data, now());
    return;
  end if;

  -- Merge matches: per match id keep the version with the greater lastUpdated
  -- (tie → incoming wins). A concurrent court's newer match is preserved.
  -- coalesce(...,'[]') guards the empty-array case: jsonb_agg over zero rows
  -- returns SQL NULL, and jsonb_set is STRICT → that would null out p_data.
  p_data := jsonb_set(p_data, '{matches}', coalesce((
    select jsonb_agg(
      case
        when coalesce((ex.match->>'lastUpdated')::bigint, 0)
           > coalesce((n->>'lastUpdated')::bigint, 0)
        then ex.match
        else n
      end
    )
    from jsonb_array_elements(p_data->'matches') n
    left join lateral (
      select e as match
      from jsonb_array_elements(existing->'matches') e
      where e->>'id' = n->>'id'
      limit 1
    ) ex on true
  ), '[]'::jsonb));

  -- Recompute each court's currentMatch from the merged match statuses, so
  -- court "live" state (used by the TV) can't be clobbered by a stale save.
  if p_data ? 'courts' then
    p_data := jsonb_set(p_data, '{courts}', coalesce((
      select jsonb_agg(
        case
          when c ? 'id' then jsonb_set(
            c, '{currentMatch}',
            coalesce(
              (select to_jsonb(m->>'id')
               from jsonb_array_elements(p_data->'matches') m
               where m->>'courtId' = c->>'id'
                 and m->>'status' = 'in-progress'
               limit 1),
              'null'::jsonb)
          )
          else c
        end
      )
      from jsonb_array_elements(p_data->'courts') c
    ), '[]'::jsonb));
  end if;

  -- Safety net: never write NULL over an existing tournament.
  if p_data is null then
    raise exception 'save_tournament_merged: refusing to write NULL data for %', p_id;
  end if;

  update tournaments
  set data = p_data, name = p_name, format = p_format, updated_at = now()
  where id = p_id;
end;
$$;
