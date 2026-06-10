import { Tournament } from '../types/tournament';
import { supabase } from '../lib/supabase';

// Pricing tiers. Tournaments created before the gate existed have no tier
// and keep full access (grandfathered).
export type Tier = 'starter' | 'compact' | 'tournament' | 'championship';

const isLegacy = (t: Tournament) => !t.tier;

// Sponsor bar (3 logo slots) is the organizer's from the 'tournament' tier up.
export function canOwnSponsors(t: Tournament): boolean {
  return isLegacy(t) || t.tier === 'tournament' || t.tier === 'championship';
}

// The full TV Ads system (own video/image ads, Break) is championship-only.
export function canOwnAds(t: Tournament): boolean {
  return isLegacy(t) || t.tier === 'championship';
}

// Starter-tier TVs play WePadl's network reel and carry the watermark.
export function isNetworkAdTier(t: Tournament): boolean {
  return t.tier === 'starter';
}

// One code = one event: a tiered tournament is writable (scoring, reset,
// court assignment) for 3 days after activation, then becomes read-only —
// results stay viewable forever. Legacy/ungated tournaments never expire.
export const ACTIVE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function isExpired(t: Tournament): boolean {
  if (!t.tier || !t.activatedAt) return false;
  return Date.now() - new Date(t.activatedAt).getTime() > ACTIVE_WINDOW_MS;
}

export function expiryLabel(t: Tournament): string | null {
  if (!t.tier || !t.activatedAt) return null;
  return new Date(new Date(t.activatedAt).getTime() + ACTIVE_WINDOW_MS).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export const TIER_LABELS: Record<Tier, string> = {
  starter: 'Starter',
  compact: 'Compact',
  tournament: 'Tournament',
  championship: 'Championship',
};

// Redeem an activation code for a new tournament. Returns the tier, or null
// when the code is invalid/used. Returns 'ungated' when the DB function is
// not installed yet, so the app keeps working before the migration.
export async function redeemActivationCode(
  code: string,
  tournamentId: string
): Promise<Tier | 'ungated' | null> {
  try {
    const { data, error } = await supabase.rpc('redeem_activation_code', {
      p_code: code,
      p_tournament_id: tournamentId,
    });
    if (error) {
      console.warn('redeem_activation_code unavailable — creating ungated:', error);
      return 'ungated';
    }
    return (data as Tier | null) ?? null;
  } catch (err) {
    console.warn('redeem_activation_code failed — creating ungated:', err);
    return 'ungated';
  }
}
