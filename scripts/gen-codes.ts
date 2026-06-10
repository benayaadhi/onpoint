/**
 * Generate activation codes (jual via WA, satu kode = satu tournament).
 *
 * Tabel kode dikunci RLS, jadi script ini butuh SERVICE ROLE KEY (bukan anon):
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 *
 *   export SUPABASE_SERVICE_KEY="eyJ..."   # sekali per sesi terminal
 *   npx tsx scripts/gen-codes.ts tournament 3 "Budi - WA 0812xxx"
 *
 * Tiers: starter | compact | tournament | championship
 * JANGAN pernah taruh service key di kode yang di-deploy.
 */
import { randomBytes } from 'crypto';

const SUPABASE_URL = 'https://ivwlszqdnlebpnaofqce.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const TIERS = ['starter', 'compact', 'tournament', 'championship'] as const;
const tier = process.argv[2] as (typeof TIERS)[number];
const count = parseInt(process.argv[3] ?? '1', 10);
const note = process.argv[4] ?? null;

if (!SERVICE_KEY) {
  console.error('Set dulu: export SUPABASE_SERVICE_KEY="<service_role key dari dashboard>"');
  process.exit(1);
}
if (!TIERS.includes(tier)) {
  console.error(`Pakai: npx tsx scripts/gen-codes.ts <${TIERS.join('|')}> [jumlah] [catatan]`);
  process.exit(1);
}

// No ambiguous chars (0/O, 1/I) so codes survive being read out loud over WA.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const chunk = (len: number) =>
  Array.from(randomBytes(len), (b) => ALPHABET[b % ALPHABET.length]).join('');
const prefix = { starter: 'STR', compact: 'CMP', tournament: 'TUR', championship: 'CHP' }[tier];

const rows = Array.from({ length: count }, () => ({
  code: `WPDL-${prefix}-${chunk(4)}-${chunk(4)}`,
  tier,
  note,
}));

const res = await fetch(`${SUPABASE_URL}/rest/v1/activation_codes`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(rows),
});
if (!res.ok) {
  console.error('Gagal insert:', res.status, await res.text());
  process.exit(1);
}
console.log(`${count} kode ${tier.toUpperCase()}${note ? ` untuk "${note}"` : ''}:`);
rows.forEach((r) => console.log(`  ${r.code}`));
