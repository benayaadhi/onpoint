import { supabase } from '../lib/supabase';
import { AdItem } from '../types/tournament';

// Ads media lives in the existing public 'sponsors' bucket (same as logos),
// so no new bucket or table is needed.

export async function uploadAdMedia(tournamentId: string, file: File): Promise<AdItem> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const isVideo = file.type.startsWith('video');
  const path = `ad-${tournamentId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('sponsors')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('sponsors').getPublicUrl(path);
  return {
    id: `ad-${Date.now()}`,
    url: data.publicUrl,
    type: isVideo ? 'video' : 'image',
    durationSec: isVideo ? undefined : 8,
    name: file.name,
    // Long videos shouldn't land in the brief between-games gap by default.
    slot: isVideo ? 'long' : 'both',
  };
}

// WePadl's network reel (played on starter-tier TVs). Lives in the single-row
// network_ads table; returns [] until that table exists.
export async function getNetworkAds(): Promise<AdItem[]> {
  try {
    const { data, error } = await supabase
      .from('network_ads')
      .select('items')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return [];
    return (data.items as AdItem[]) ?? [];
  } catch {
    return [];
  }
}

export async function saveNetworkAds(items: AdItem[]): Promise<boolean> {
  const { error } = await supabase
    .from('network_ads')
    .upsert({ id: 1, items, updated_at: new Date().toISOString() });
  if (error) console.error('saveNetworkAds:', error);
  return !error;
}

export async function removeAdMedia(url: string): Promise<void> {
  const marker = '/sponsors/';
  const idx = url.indexOf(marker);
  if (idx === -1) return; // external URL — nothing stored on our side
  const path = decodeURIComponent(url.slice(idx + marker.length));
  await supabase.storage.from('sponsors').remove([path]);
}
