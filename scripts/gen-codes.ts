/**
 * Generate activation codes (jual via WA, satu kode = satu tournament).
 *   npx tsx scripts/gen-codes.ts <tier> [jumlah] [catatan pembeli]
 *   npx tsx scripts/gen-codes.ts tournament 3 "Budi - WA 0812xxx"
 * Tiers: starter | compact | tournament | championship
 * Butuh tabel activation_codes (db/activation_codes.sql) sudah terpasang.
 */
import { randomBytes } from 'crypto';
import { supabase } from '../src/lib/supabase';

const TIERS = ['starter', 'compact', 'tournament', 'championship'] as const;
const tier = process.argv[2] as (typeof TIERS)[number];
const count = parseInt(process.argv[3] ?? '1', 10);
const note = process.argv[4] ?? null;

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

const { error } = await supabase.from('activation_codes').insert(rows);
if (error) {
  console.error('Gagal insert (tabel activation_codes sudah dipasang?):', error.message);
  process.exit(1);
}
console.log(`${count} kode ${tier.toUpperCase()}${note ? ` untuk "${note}"` : ''}:`);
rows.forEach((r) => console.log(`  ${r.code}`));
