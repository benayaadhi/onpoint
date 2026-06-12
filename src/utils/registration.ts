import { supabase } from '../lib/supabase';
import { RegistrationEntry, Tournament } from '../types/tournament';
import { saveTournament } from './storage';

export type RegisterStatus = 'registered' | 'waitlist' | 'closed' | 'not_found' | 'error';
export interface RegisterResult {
  status: RegisterStatus;
  count?: number; // urutan pendaftar (nomor tiket)
}

// Submit a registration atomically (RPC locks the row, so simultaneous
// submissions can never clobber each other). Falls back to a plain merge-save
// while the RPC isn't installed yet — fine at low volume, and the SQL file
// upgrades it to fully atomic.
export async function registerTeam(
  tournament: Tournament,
  entry: RegistrationEntry
): Promise<RegisterResult> {
  try {
    const { data, error } = await supabase.rpc('register_team', {
      p_tournament_id: tournament.id,
      p_entry: entry,
    });
    if (!error && data?.status) return { status: data.status as RegisterStatus, count: data.count };
    console.warn('register_team RPC unavailable, falling back:', error);
  } catch (err) {
    console.warn('register_team RPC failed, falling back:', err);
  }

  // Fallback: client-side append (not atomic — installed SQL removes this path)
  const cfg = tournament.registration;
  if (!cfg?.enabled) return { status: 'closed' };
  const regs = tournament.registrations ?? [];
  const quota = cfg.quota ?? 0;
  const waitlist = quota > 0 && regs.length >= quota;
  await saveTournament({
    ...tournament,
    registrations: [...regs, { ...entry, waitlist }],
  });
  return { status: waitlist ? 'waitlist' : 'registered', count: regs.length + 1 };
}

// Admin actions on an entry (paid / unpaid / delete), atomic via RPC with the
// same style of fallback.
export async function updateRegistration(
  tournament: Tournament,
  entryId: string,
  action: 'paid' | 'unpaid' | 'delete'
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('update_registration', {
      p_tournament_id: tournament.id,
      p_entry_id: entryId,
      p_action: action,
      p_promote: action === 'delete',
    });
    if (!error) return data === true;
    console.warn('update_registration RPC unavailable, falling back:', error);
  } catch (err) {
    console.warn('update_registration RPC failed, falling back:', err);
  }

  const regs = tournament.registrations ?? [];
  const next =
    action === 'delete'
      ? regs.filter((r) => r.id !== entryId)
      : regs.map((r) => (r.id === entryId ? { ...r, paid: action === 'paid' } : r));
  await saveTournament({ ...tournament, registrations: next });
  return true;
}

export const DEFAULT_REGISTRATION_FIELDS = [
  { id: 'team', label: 'Nama Tim', type: 'text' as const, required: true },
  { id: 'players', label: 'Nama Pemain (pasangan)', type: 'text' as const, required: true },
  { id: 'wa', label: 'No. WhatsApp', type: 'phone' as const, required: true },
];
