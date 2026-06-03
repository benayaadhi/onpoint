import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SponsorSlot {
  position: 1 | 2 | 3;
  logo_url: string | null;
  name?: string | null;
}

export interface SponsorTemplate {
  id: string;
  name: string;
  created_at: string;
  slots?: SponsorSlot[];
}

/** @deprecated alias */
export type Sponsor = SponsorSlot;

// ─── Templates ───────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<SponsorTemplate[]> {
  const { data, error } = await supabase
    .from('sponsor_templates')
    .select('id, name, created_at')
    .order('created_at');
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function createTemplate(name: string): Promise<SponsorTemplate | null> {
  const { data, error } = await supabase
    .from('sponsor_templates')
    .insert({ name })
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  // Remove storage files for this template
  for (const pos of [1, 2, 3]) {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']) {
      await supabase.storage.from('sponsors').remove([`template-${id}-${pos}.${ext}`]);
    }
  }
  await supabase.from('sponsor_templates').delete().eq('id', id);
}

export async function getTemplateSlots(templateId: string): Promise<SponsorSlot[]> {
  const { data, error } = await supabase
    .from('sponsor_template_slots')
    .select('position, logo_url, name')
    .eq('template_id', templateId)
    .order('position');
  if (error) { console.error(error); return emptySlots(); }
  const map = new Map((data || []).map((r) => [r.position, r as SponsorSlot]));
  return [1, 2, 3].map((p) => map.get(p) ?? { position: p as 1 | 2 | 3, logo_url: null });
}

export async function saveTemplateSlot(templateId: string, slot: SponsorSlot): Promise<void> {
  const { error } = await supabase.from('sponsor_template_slots').upsert(
    { template_id: templateId, position: slot.position, logo_url: slot.logo_url, name: slot.name ?? null },
    { onConflict: 'template_id,position' }
  );
  if (error) console.error(error);
}

export async function uploadTemplateSlotLogo(
  templateId: string,
  position: 1 | 2 | 3,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `template-${templateId}-${position}.${ext}`;
  for (const oldExt of ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']) {
    if (oldExt !== ext) {
      await supabase.storage.from('sponsors').remove([`template-${templateId}-${position}.${oldExt}`]);
    }
  }
  const { error } = await supabase.storage.from('sponsors').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('sponsors').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// ─── Tournament Sponsors ──────────────────────────────────────────────────────

export async function getTournamentSponsors(tournamentId: string): Promise<SponsorSlot[]> {
  const { data, error } = await supabase
    .from('tournament_sponsors')
    .select('position, logo_url, name')
    .eq('tournament_id', tournamentId)
    .order('position');
  if (error) { console.error('Failed to load tournament sponsors:', error); return emptySlots(); }
  const map = new Map((data || []).map((r) => [r.position, r as SponsorSlot]));
  return [1, 2, 3].map((p) => map.get(p) ?? { position: p as 1 | 2 | 3, logo_url: null });
}

export async function saveTournamentSponsor(
  tournamentId: string,
  slot: SponsorSlot,
  templateId?: string | null
): Promise<void> {
  const { error } = await supabase.from('tournament_sponsors').upsert(
    {
      tournament_id: tournamentId,
      position: slot.position,
      logo_url: slot.logo_url,
      name: slot.name ?? null,
      template_id: templateId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tournament_id,position' }
  );
  if (error) console.error(error);
}

export async function loadTemplateToTournament(
  templateId: string,
  tournamentId: string
): Promise<SponsorSlot[]> {
  const slots = await getTemplateSlots(templateId);
  await Promise.all(slots.map((slot) => saveTournamentSponsor(tournamentId, slot, templateId)));
  return slots;
}

export async function uploadTournamentSponsorLogo(
  tournamentId: string,
  position: 1 | 2 | 3,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  // Shorten tournament ID to avoid path length issues
  const shortId = tournamentId.slice(0, 8);
  const path = `t-${shortId}-${position}.${ext}`;
  for (const oldExt of ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']) {
    if (oldExt !== ext) {
      await supabase.storage.from('sponsors').remove([`t-${shortId}-${position}.${oldExt}`]);
    }
  }
  const { error } = await supabase.storage.from('sponsors').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('sponsors').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function removeTournamentSponsor(tournamentId: string, position: 1 | 2 | 3): Promise<void> {
  const shortId = tournamentId.slice(0, 8);
  for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']) {
    await supabase.storage.from('sponsors').remove([`t-${shortId}-${position}.${ext}`]);
  }
  await saveTournamentSponsor(tournamentId, { position, logo_url: null }, null);
}

// ─── Legacy stubs (kept so old imports don't break) ───────────────────────────

/** @deprecated Use getTournamentSponsors */
export async function getSponsors(): Promise<SponsorSlot[]> {
  return emptySlots();
}
/** @deprecated */
export async function saveSponsor(_s: SponsorSlot): Promise<void> {}
/** @deprecated */
export async function uploadSponsorLogo(_p: 1 | 2 | 3, _f: File): Promise<string> {
  throw new Error('Use uploadTournamentSponsorLogo');
}
/** @deprecated */
export async function removeSponsorLogo(_p: 1 | 2 | 3): Promise<void> {}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptySlots(): SponsorSlot[] {
  return [1, 2, 3].map((p) => ({ position: p as 1 | 2 | 3, logo_url: null }));
}
