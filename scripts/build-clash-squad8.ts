/**
 * Squad Battle 8 (ladder) — pools already completed, knockout pending.
 *   node scripts/build-clash-squad8.mjs            # print SQL
 *   node scripts/build-clash-squad8.mjs --insert   # write to Supabase
 *   node scripts/build-clash-squad8.mjs --full      # also play the knockout
 */
import { createTournament, advanceTournament } from '../src/utils/tournamentLogic';
import { supabase } from '../src/lib/supabase';
import { Club, Court, Match, Tie, Tournament, RUBBER_CATEGORIES } from '../src/types/tournament';
import { slugify } from '../src/utils/slugify';

// Deterministic RNG
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260607);

// Squads from clash squad.xlsx (Pool A = 1-4, Pool B = 5-8). '?' = missing in file.
const SQUADS: { name: string; men: string; women: string; mix: string }[] = [
  { name: 'PADELBAR', men: 'Barry Tenardi / Orlando Goldschmidt', women: 'Steve Leonardy / Winanda Setiawan', mix: 'Keitha Vanya Clarita / Puspa Wido' },
  { name: 'BANDEL PADEL', men: 'Eko Harry Saputra / M Hartoyo', women: 'Anggi Romares / Lisa Tumbelaka', mix: 'Dian Restu / Nita (Manit)' },
  { name: 'PARTY', men: 'Gege / Tomo', women: 'Febi / Bella', mix: 'Adzan / Winda' },
  { name: 'SLV PDL 1', men: 'Aan Martin / Rio Raditya', women: 'Asrie / Andrea', mix: 'Nadia / Hensob' },
  { name: 'SLV PDL 2', men: 'Alvin P / Kevin P', women: 'Sky / Akasya', mix: 'Arti / Danica' },
  { name: 'Madél', men: 'Fadil Joan / Ricky Adikama', women: 'Monika Vianny / Kiky Rifqie', mix: 'Hilman Tsani / Jess Ica' },
  { name: 'PADELINE', men: 'PADELINE Men 1 / PADELINE Men 2', women: 'PADELINE Women 1 / PADELINE Women 2', mix: 'PADELINE Mix 1 / PADELINE Mix 2' },
  { name: 'PPC', men: 'Fradit / Raja', women: 'PPC Women 1 / Faiz', mix: 'PPC Mix 1 / PPC Mix 2' },
];

const clubs: Club[] = SQUADS.map((s, i) => {
  const id = `club-${i + 1}`;
  return {
    id, name: s.name,
    teams: {
      men: { id: `${id}-men`, name: s.men },
      women: { id: `${id}-women`, name: s.women },
      mix: { id: `${id}-mix`, name: s.mix },
    },
  };
});

const rating = new Map<string, number>();
clubs.forEach((c, i) => rating.set(c.id, 8 + ((i * 5 + 2) % 9) - rng() * 3));

const courts: Court[] = [1, 2].map((n) => ({ id: `court-${n}`, name: `Court ${n}`, slug: `court-${n}`, surface: 'artificial-grass', isAvailable: true }));

const NAME = 'WePadl Clash Squad 8';
let t: Tournament = createTournament(NAME, 'clash', [], courts, 'race', 4, {
  clubs, clashStructure: 'pool-knockout', clashLadder8: true,
});
t = { ...t, id: 'clash-squad-8', slug: slugify(NAME), createdAt: new Date().toISOString() };

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
function playTie(tie: Tie) {
  const r1 = rating.get(tie.club1Id) ?? 8, r2 = rating.get(tie.club2Id) ?? 8;
  tie.matchIds.forEach((mid) => {
    const m = t.matches.find((x) => x.id === mid) as Match;
    const team1Wins = rng() < sigmoid((r1 - r2) / 3 + (rng() - 0.5) * 0.8);
    if (m.gamesFixed) {
      // best of 5: winner 3-5 games, loser the rest of 5
      const wGames = 3 + Math.floor(rng() * 3); // 3..5
      const lGames = 5 - wGames;
      m.team1RaceScore = team1Wins ? wGames : lGames;
      m.team2RaceScore = team1Wins ? lGames : wGames;
    } else {
      const tgt = m.raceTarget || 4;
      const loser = Math.floor(rng() * tgt);
      m.team1RaceScore = team1Wins ? tgt : loser;
      m.team2RaceScore = team1Wins ? loser : tgt;
    }
    m.completed = true;
    m.status = 'completed';
    m.winner = team1Wins ? m.team1 : m.team2;
    m.courtId = courts[0].id;
  });
}
const stage = (s: string) => t.ties!.filter((x) => x.stage === s);

// Play pools only (default). --full also plays the ladder.
stage('pool').forEach(playTie);
t = advanceTournament(t);
if (process.argv.includes('--full')) {
  for (const s of ['round1', 'quarterfinal', 'semifinal']) { stage(s).forEach((x) => playTie(t.ties!.find((y) => y.id === x.id)!)); t = advanceTournament(t); }
  [...stage('final'), ...stage('third-place')].forEach((x) => playTie(t.ties!.find((y) => y.id === x.id)!));
  t = advanceTournament(t);
}

const cn = (id?: string) => clubs.find((c) => c.id === id)?.name ?? id ?? 'TBD';
console.log('id:', t.id, '| stage:', t.clashStage, '| completed:', t.completed);
t.clashPools?.forEach((p) => console.log(`  ${p.name}: ${p.clubIds.map(cn).join(', ')}`));
const at = (s: string, pos: number) => t.ties!.find((x) => x.stage === s && x.position === pos);
console.log('R1:', cn(at('round1', 0)?.club1Id), 'v', cn(at('round1', 0)?.club2Id), '|', cn(at('round1', 1)?.club1Id), 'v', cn(at('round1', 1)?.club2Id));
console.log('QF byes:', cn(at('quarterfinal', 0)?.club2Id), '/', cn(at('quarterfinal', 1)?.club2Id), '| SF byes:', cn(at('semifinal', 0)?.club2Id), '/', cn(at('semifinal', 1)?.club2Id));

async function main() {
  if (process.argv.includes('--insert')) {
    const { error } = await supabase.from('tournaments').upsert(
      { id: t.id, name: t.name, format: t.format, data: t, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    console.log(error ? `Insert failed: ${error.message}` : `\nInserted ✓  → /contestant/tournament/${t.id}`);
    process.exit(0);
  }
  const json = JSON.stringify(t).replace(/'/g, "''");
  console.log('\n-- Paste into Supabase SQL Editor --');
  console.log(
    `insert into tournaments (id, name, format, data, updated_at)\n` +
      `values ('${t.id}', '${t.name.replace(/'/g, "''")}', '${t.format}', '${json}'::jsonb, now())\n` +
      `on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;`
  );
  console.log(`\n-- Remove later:\n-- delete from tournaments where id = '${t.id}';`);
  process.exit(0);
}
main();
