/**
 * Build the "OOP 7 Juni 2026" group-knockout tournament (not started).
 *   node scripts/build-gk-list.mjs           # print SQL to paste in Supabase
 *   node scripts/build-gk-list.mjs --insert  # write directly to Supabase
 */
import { createTournament } from '../src/utils/tournamentLogic';
import { supabase } from '../src/lib/supabase';
import { Team, Court } from '../src/types/tournament';
import { slugify } from '../src/utils/slugify';

// 4 groups × 4 pairs, in group order A,B,C,D (engine chunks in order).
const GROUPS: Record<string, string[]> = {
  A: ['Ficky - Erika', 'Venty - Dian', 'Citra Malik - Dinata Oktasia', 'Dita - Opi'],
  B: ['Rizky Sutjipto - Erick Christopher', 'Tiito - Ega', 'Johan - Doni', 'Rifat - ?'],
  C: ['Kelvin - Denny Tan', 'Reza - Farhan', 'Ryan - Adjie', 'Winson - Darius'],
  D: ['Ruben - Martino', 'Angel - Brian', 'Arga Rizki - Andre Dwi', 'Agoes Prima Putro - Ojan'],
};

const teams: Team[] = [];
let n = 1;
for (const g of ['A', 'B', 'C', 'D']) {
  for (const name of GROUPS[g]) teams.push({ id: `team-${n++}`, name });
}

const courts: Court[] = [5, 6].map((c) => ({
  id: `court-${c}`,
  name: `Court ${c}`,
  slug: `court-${c}`,
  surface: 'artificial-grass',
  isAvailable: true,
}));

const NAME = 'OOP 7 Juni 2026';
let t = createTournament(NAME, 'group-knockout', teams, courts, 'race', 4, {
  teamsPerGroup: 4,
  qualifiersPerGroup: 2,
  thirdPlace: true,
});
t = { ...t, id: 'oop-7juni-2026', slug: slugify(NAME), createdAt: new Date().toISOString() };

// Report
console.log('Tournament:', t.name, '| id:', t.id);
console.log('Format:', t.format, '| scoring: race-to-4 (final race-to-6)');
t.groups?.forEach((grp) => console.log(`  ${grp.name}: ${grp.teams.map((x) => x.name).join(', ')}`));
const ko = t.matches.filter((m) => !m.groupId);
const third = ko.find((m) => m.isThirdPlace);
console.log(`Group matches: ${t.matches.length - ko.length} | Knockout slots: ${ko.length} (QF/SF/Final${third ? ' + 3rd place' : ''})`);
console.log('All matches completed:', t.matches.some((m) => m.completed) ? 'NO (some already done?!)' : 'none — not started ✓');

async function main() {
  if (process.argv.includes('--insert')) {
    const { error } = await supabase.from('tournaments').upsert(
      { id: t.id, name: t.name, format: t.format, data: t, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    console.log(error ? `Insert failed: ${error.message}` : '\nInserted into Supabase ✓');
    console.log(`Admin: /admin/tournament/${t.id}`);
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
