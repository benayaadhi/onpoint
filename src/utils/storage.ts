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

export async function saveTournament(tournament: Tournament): Promise<void> {
  try {
    const { error } = await supabase.from('tournaments').upsert(
      {
        id: tournament.id,
        name: tournament.name,
        format: tournament.format,
        data: tournament,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('Failed to save tournament to Supabase:', error);
      // Fallback to localStorage
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