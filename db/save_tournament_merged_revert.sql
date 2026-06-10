-- REVERT save_tournament_merged.
-- Run in the Supabase SQL Editor to remove the merge function. Safe & instant:
-- the client auto-falls back to a plain upsert, so nothing breaks and NO data
-- is lost (this function only changed how writes happen, never the schema/data).

drop function if exists save_tournament_merged(text, text, text, jsonb);
