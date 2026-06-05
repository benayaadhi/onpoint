/**
 * Realistic end-to-end Squad Battle simulation → Supabase.
 *
 *   node scripts/simulate-squad-battle.mjs            # create + insert
 *   node scripts/simulate-squad-battle.mjs --dry      # simulate only, no insert
 *   node scripts/simulate-squad-battle.mjs delete <id>  # remove a sim tournament
 *
 * (Run the bundled .mjs — see the build command printed by the assistant.)
 */
import { createTournament, advanceTournament } from '../src/utils/tournamentLogic';
import { supabase } from '../src/lib/supabase';
import { Club, Court, Match, Tie, Tournament, RUBBER_CATEGORIES } from '../src/types/tournament';

// ─── Deterministic RNG so re-runs produce the same realistic bracket ──────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260605);

// ─── Realistic squad + player data ───────────────────────────────────────────
const SQUAD_NAMES = [
  'Jakarta Smashers', 'Bali Padel Club', 'Bandung Volley', 'Surabaya Aces',
  'Medan Padel', 'Bekasi Bandits', 'Tangerang Titans', 'Depok Dragons',
  'Yogya Strikers', 'Semarang Storm', 'Makassar Magic', 'Bogor Blasters',
];
const MALE = ['Andi', 'Budi', 'Citra', 'Dimas', 'Eka', 'Fajar', 'Gilang', 'Hadi', 'Irfan', 'Joko', 'Krisna', 'Lukman', 'Maman', 'Nanda', 'Oka', 'Putra', 'Rizki', 'Surya', 'Taufik', 'Wahyu', 'Yoga', 'Bayu', 'Galih', 'Reza'];
const FEMALE = ['Ayu', 'Bunga', 'Cinta', 'Dewi', 'Elis', 'Fitri', 'Gita', 'Hana', 'Indah', 'Jihan', 'Kayla', 'Lina', 'Maya', 'Nadia', 'Olivia', 'Putri', 'Rara', 'Sinta', 'Tania', 'Vina', 'Wulan', 'Yuni', 'Zahra', 'Mega'];
const LAST = ['Pratama', 'Wijaya', 'Saputra', 'Hidayat', 'Nugroho', 'Lestari', 'Kusuma', 'Santoso', 'Halim', 'Permana', 'Maulana', 'Anggraini', 'Siregar', 'Wibowo', 'Hartono', 'Gunawan', 'Suryadi', 'Mahendra', 'Ramadhan', 'Setiawan', 'Pradana', 'Cahyani', 'Firmansyah', 'Yulianti'];

let mIdx = 0;
let fIdx = 0;
let lIdx = 0;
const man = () => `${MALE[mIdx++ % MALE.length]} ${LAST[lIdx++ % LAST.length]}`;
const woman = () => `${FEMALE[fIdx++ % FEMALE.length]} ${LAST[lIdx++ % LAST.length]}`;
const pair = (a: () => string, b: () => string) => `${a()} / ${b()}`;

const clubs: Club[] = SQUAD_NAMES.map((name, i) => {
  const id = `club-${i + 1}`;
  return {
    id,
    name,
    teams: {
      men: { id: `${id}-men`, name: pair(man, man) },
      women: { id: `${id}-women`, name: pair(woman, woman) },
      mix: { id: `${id}-mix`, name: pair(man, woman) },
    },
  };
});

// Latent strength per squad (drives realistic, varied results).
const rating = new Map<string, number>();
clubs.forEach((c, i) => rating.set(c.id, 8 + ((i * 7 + 3) % 9) - rng() * 4)); // ~4..12, jumbled

const courts: Court[] = [1, 2, 3].map((n) => ({
  id: `court-${n}`,
  name: `Court ${n}`,
  slug: `court-${n}`,
  surface: 'artificial-grass',
  isAvailable: true,
}));

// ─── Build tournament ─────────────────────────────────────────────────────────
// Fixed id so re-running a later stage updates the SAME tournament (upsert).
const SIM_ID = 'sim-squad-battle';
// How far to play: pools | playoffs | semis | full (default full)
const STAGE = (process.argv.find((a) => a.startsWith('--stage='))?.split('=')[1] ?? 'full') as
  | 'pools' | 'playoffs' | 'semis' | 'full';

let t: Tournament = createTournament(
  'WePadl Squad Battle Vol. 1 (SIM)',
  'clash',
  [],
  courts,
  'race',
  4,
  { clubs, clashStructure: 'pool-knockout', clashThirdPlace: true }
);
t = { ...t, id: SIM_ID };

// ─── Simulate a tie (3 rubbers) with realistic race-to-4 scores ──────────────
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
let clock = new Date('2026-06-06T04:00:00.000Z'); // 11:00 WIB

function courtForTie(tie: Tie): string {
  if (tie.stage === 'pool' && tie.poolId) {
    const idx = (t.clashPools ?? []).findIndex((p) => p.id === tie.poolId);
    return courts[Math.max(0, idx)].id;
  }
  return courts[tie.position % courts.length].id;
}

function playTie(tie: Tie) {
  const r1 = rating.get(tie.club1Id) ?? 8;
  const r2 = rating.get(tie.club2Id) ?? 8;
  const courtId = courtForTie(tie);
  tie.matchIds.forEach((mid, i) => {
    const m = t.matches.find((x) => x.id === mid) as Match;
    const p = sigmoid((r1 - r2) / 3 + (rng() - 0.5) * 0.8); // per-rubber variance
    const team1Wins = rng() < p;
    const loser = Math.floor(rng() * 4); // 0..3 (3 = golden-point thriller)
    const start = new Date(clock.getTime() + i * 16 * 60000);
    const end = new Date(start.getTime() + 14 * 60000);
    m.completed = true;
    m.status = 'completed';
    m.courtId = courtId;
    m.team1RaceScore = team1Wins ? 4 : loser;
    m.team2RaceScore = team1Wins ? loser : 4;
    m.winner = team1Wins ? m.team1 : m.team2;
    m.schedule = {
      scheduledTime: start.toISOString(),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
    m.lastUpdated = Date.now();
  });
  clock = new Date(clock.getTime() + 50 * 60000); // next tie slot
}

const tiesOf = (stage: Tie['stage']) =>
  (t.ties ?? []).filter((x) => x.stage === stage).sort((a, b) => a.round - b.round || a.position - b.position);

// 1) Pool stage (always)
tiesOf('pool').forEach(playTie);
t = advanceTournament(t);
// 2) Playoffs
if (STAGE !== 'pools') {
  tiesOf('playoff').forEach(playTie);
  t = advanceTournament(t);
}
// 3) Semifinals
if (STAGE === 'semis' || STAGE === 'full') {
  tiesOf('semifinal').forEach(playTie);
  t = advanceTournament(t);
}
// 4) Final + 3rd place
if (STAGE === 'full') {
  [...tiesOf('final'), ...tiesOf('third-place')].forEach(playTie);
  t = advanceTournament(t);
}

// Bump createdAt so it sorts to the top of the list.
t = { ...t, createdAt: new Date().toISOString() };

// ─── Report ───────────────────────────────────────────────────────────────────
const clubName = (id?: string) => clubs.find((c) => c.id === id)?.name ?? id ?? 'TBD';
const finalTie = (t.ties ?? []).find((x) => x.stage === 'final');
const thirdTie = (t.ties ?? []).find((x) => x.stage === 'third-place');

console.log('\n=== Squad Battle simulation ===');
console.log('played to: ', STAGE);
console.log('id:        ', t.id);
console.log('name:      ', t.name);
console.log('completed: ', t.completed, '| stage:', t.clashStage);
console.log('matches:   ', t.matches.length, '(all completed:', t.matches.every((m) => m.completed) + ')');
(t.clashPools ?? []).forEach((p) => {
  const ids = p.clubIds.map(clubName).join(', ');
  console.log(`  ${p.name}: ${ids}`);
});
console.log('FINAL:     ', clubName(finalTie?.club1Id), 'vs', clubName(finalTie?.club2Id), '→', clubName(finalTie?.winnerClubId));
if (thirdTie) console.log('3rd place: ', clubName(thirdTie.club1Id), 'vs', clubName(thirdTie.club2Id), '→', clubName(thirdTie.winnerClubId));
console.log('CHAMPION:  ', clubName(t.winnerClubId));

// ─── Persist / delete ──────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('delete')) {
    const id = argv[argv.indexOf('delete') + 1] || SIM_ID;
    const { error } = await supabase.from('tournaments').delete().eq('id', id);
    if (error) { console.error('Delete failed:', error.message); process.exit(1); }
    console.log('\nDeleted tournament', id);
    process.exit(0);
  }

  if (argv.includes('--dry')) {
    console.log('\n[--dry] not inserting. Remove --dry to push to Supabase.');
    process.exit(0);
  }

  // Print an INSERT statement to paste into the Supabase SQL Editor.
  if (argv.includes('--sql')) {
    const json = JSON.stringify(t).replace(/'/g, "''");
    const name = t.name.replace(/'/g, "''");
    console.log('\n-- Paste into Supabase SQL Editor --');
    console.log(
      `insert into tournaments (id, name, format, data, updated_at)\n` +
        `values ('${t.id}', '${name}', '${t.format}', '${json}'::jsonb, now())\n` +
        `on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;`
    );
    console.log(`\n-- To remove later:\n-- delete from tournaments where id = '${t.id}';`);
    process.exit(0);
  }

  const { error } = await supabase.from('tournaments').upsert(
    { id: t.id, name: t.name, format: t.format, data: t, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) { console.error('\nInsert failed:', error.message); process.exit(1); }

  console.log('\nInserted into Supabase ✓');
  console.log('View (contestant):', `/contestant/tournament/${t.id}`);
  console.log('View (admin):     ', `/admin/tournament/${t.id}`);
  console.log('Delete later:     ', `node scripts/simulate-squad-battle.mjs delete ${t.id}`);
  process.exit(0);
}

main();
