import { Tournament, Match } from '../types/tournament';
import { supabase } from '../lib/supabase';

// ─── Supabase Broadcast: fast cross-device score sync ────────────────────────
// Single shared channel per tournament — handles subscription timing with queue.

interface TournamentChannel {
  ch: ReturnType<typeof supabase.channel>;
  ready: boolean;
  queue: object[];
  listeners: Set<(match: Match) => void>;
}

const _channels = new Map<string, TournamentChannel>();

function getOrCreateChannel(tournamentId: string): TournamentChannel {
  const key = `onpoint-scores-${tournamentId}`;
  if (_channels.has(key)) return _channels.get(key)!;

  const state: TournamentChannel = {
    ch: null as any,
    ready: false,
    queue: [],
    listeners: new Set(),
  };

  state.ch = supabase
    .channel(key)
    .on('broadcast', { event: 'score' }, ({ payload }) => {
      if (payload?.match) {
        state.listeners.forEach((fn) => fn(payload.match as Match));
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        state.ready = true;
        // Flush any messages that arrived before subscription completed
        state.queue.forEach((msg) => state.ch.send(msg));
        state.queue = [];
      }
    });

  _channels.set(key, state);
  return state;
}

export function broadcastScoreUpdate(match: Match, tournamentId: string): void {
  const state = getOrCreateChannel(tournamentId);
  const msg = { type: 'broadcast' as const, event: 'score', payload: { match } };
  if (state.ready) {
    state.ch.send(msg);
  } else {
    state.queue.push(msg); // will send once SUBSCRIBED
  }
}

export function subscribeToScoreUpdates(
  tournamentId: string,
  callback: (match: Match) => void
): () => void {
  const state = getOrCreateChannel(tournamentId);
  state.listeners.add(callback);
  return () => { state.listeners.delete(callback); };
}

// Plain whole-row upsert (last-write-wins). Used as a fallback before the
// merge function is installed, or if the RPC isn't available.
async function upsertTournament(tournament: Tournament): Promise<{ error: unknown }> {
  return supabase.from('tournaments').upsert(
    {
      id: tournament.id,
      name: tournament.name,
      format: tournament.format,
      data: tournament,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
}

export async function saveTournament(tournament: Tournament): Promise<void> {
  try {
    // Preferred path: atomic server-side merge (per-match by lastUpdated +
    // court.currentMatch recomputed from match status). Prevents two courts
    // scored at once from clobbering each other. Requires the
    // `save_tournament_merged` DB function (see db/save_tournament_merged.sql).
    const { error: rpcError } = await supabase.rpc('save_tournament_merged', {
      p_id: tournament.id,
      p_name: tournament.name,
      p_format: tournament.format,
      p_data: tournament,
    });
    if (!rpcError) return;

    // Function not installed / errored → fall back to plain upsert so the app
    // keeps working before the migration is applied.
    console.warn('save_tournament_merged unavailable, using upsert fallback:', rpcError);
    const { error } = await upsertTournament(tournament);
    if (error) {
      console.error('Failed to save tournament to Supabase:', error);
      saveTournamentLocal(tournament);
    }
  } catch (error) {
    console.error('Failed to save tournament:', error);
    saveTournamentLocal(tournament);
  }
}

export async function getTournaments(): Promise<Tournament[]> {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('data')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load tournaments from Supabase:', error);
      return getTournamentsLocal();
    }

    return (data || []).map((row: { data: Tournament }) => row.data);
  } catch (error) {
    console.error('Failed to load tournaments:', error);
    return getTournamentsLocal();
  }
}

// Fetch a single tournament by id — used by the polling fallback so each tick
// transfers one row instead of the whole table.
export async function getTournament(id: string): Promise<Tournament | null> {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('data')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load tournament from Supabase:', error);
      return getTournamentsLocal().find((t) => t.id === id) ?? null;
    }

    return (data?.data as Tournament) ?? null;
  } catch (error) {
    console.error('Failed to load tournament:', error);
    return getTournamentsLocal().find((t) => t.id === id) ?? null;
  }
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', tournamentId);

    if (error) {
      console.error('Failed to delete tournament from Supabase:', error);
      deleteTournamentLocal(tournamentId);
    }
  } catch (error) {
    console.error('Failed to delete tournament:', error);
    deleteTournamentLocal(tournamentId);
  }
}

// Lightweight change feed: notifies WHICH tournament changed instead of
// refetching the whole table. Each save used to make every connected client
// download every row — that's what ate the Supabase egress quota. Callers
// fetch just the row they care about (getTournament).
export function subscribeTournamentChanges(
  onChange: (tournamentId: string | null) => void
): () => void {
  const channelId = `tournaments-feed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tournaments' },
      (payload) => {
        const row = (payload.new ?? payload.old) as { id?: string } | null;
        onChange(row?.id ?? null);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to real-time tournament changes
export function subscribeTournaments(
  callback: (tournaments: Tournament[]) => void
): () => void {
  const channelId = `tournaments-changes-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tournaments',
      },
      async () => {
        // Re-fetch all tournaments on any change
        const tournaments = await getTournaments();
        callback(tournaments);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

// ========================================
// localStorage fallback (offline / errors)
// ========================================
const STORAGE_KEY = 'padel_tournaments';

function saveTournamentLocal(tournament: Tournament): void {
  try {
    const tournaments = getTournamentsLocal();
    const existingIndex = tournaments.findIndex((t) => t.id === tournament.id);
    if (existingIndex !== -1) {
      tournaments[existingIndex] = tournament;
    } else {
      tournaments.push(tournament);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  } catch (error) {
    console.error('Failed to save tournament locally:', error);
  }
}

function getTournamentsLocal(): Tournament[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load tournaments locally:', error);
    return [];
  }
}

function deleteTournamentLocal(tournamentId: string): void {
  try {
    const tournaments = getTournamentsLocal().filter(
      (t) => t.id !== tournamentId
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  } catch (error) {
    console.error('Failed to delete tournament locally:', error);
  }
}