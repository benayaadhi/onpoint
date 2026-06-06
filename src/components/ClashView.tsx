import { useState } from 'react';
import { Trophy, Swords, BarChart2, Network, Search } from 'lucide-react';
import { TournamentHeader, MatchCard, ViewProps } from './TournamentBracket';
import {
  calculateClashStandings,
  calculateClashPoolStandings,
  calculateClashOverallStandings,
  computeClashSeeds,
} from '../utils/tournamentLogic';
import { Tie, RubberCategory, RUBBER_CATEGORIES } from '../types/tournament';

const CATEGORY_LABEL: Record<RubberCategory, string> = {
  men: 'Men',
  women: 'Women',
  mix: 'Mix',
};

export default function ClashView({
  tournament,
  onMatchSelect,
  selectedMatch,
  ...headerProps
}: ViewProps) {
  const clubs = tournament.clubs ?? [];
  const ties = tournament.ties ?? [];
  const isPoolKnockout = tournament.clashStructure === 'pool-knockout';
  const isLadder = !!tournament.clashLadder8;
  const standings = isPoolKnockout ? [] : calculateClashStandings(tournament);
  const clubName = (id: string) => clubs.find((c) => c.id === id)?.name ?? 'TBD';
  const poolName = (i: number) => tournament.clashPools?.[i]?.name ?? (i === 0 ? 'Pool A' : 'Pool B');

  // Display name for a tie slot: real club, else a seed/feeder placeholder.
  const slotName = (tie: Tie, slot: 1 | 2) => {
    const id = slot === 1 ? tie.club1Id : tie.club2Id;
    if (id) return clubName(id);
    if (isLadder) {
      const A = poolName(0), B = poolName(1);
      const top = tie.position === 0;
      if (tie.stage === 'round1')
        return slot === 1 ? `Peringkat 3 ${top ? A : B}` : `Peringkat 4 ${top ? B : A}`;
      if (tie.stage === 'quarterfinal')
        return slot === 1 ? `Winner R1 ${top ? 'atas' : 'bawah'}` : `Runner-up ${top ? B : A}`;
      if (tie.stage === 'semifinal')
        return slot === 1 ? `Winner QF ${top ? 'atas' : 'bawah'}` : `Juara ${top ? A : B}`;
      if (tie.stage === 'final') return slot === 1 ? 'Winner SF atas' : 'Winner SF bawah';
      if (tie.stage === 'third-place') return slot === 1 ? 'Loser SF atas' : 'Loser SF bawah';
    }
    if (tie.stage === 'semifinal' && slot === 1) return `Winner PO${tie.position + 1}`;
    if (tie.stage === 'final') return slot === 1 ? 'Winner SF1' : 'Winner SF2';
    if (tie.stage === 'third-place') return slot === 1 ? 'Loser SF1' : 'Loser SF2';
    const seed = slot === 1 ? tie.seed1 : tie.seed2;
    return seed ? `Seed #${seed}` : 'TBD';
  };

  const rrTies = ties.filter((t) => t.stage === 'round-robin');
  const finalTie = ties.find((t) => t.stage === 'final');
  const rounds = [...new Set(rrTies.map((t) => t.round))].sort((a, b) => a - b);

  const [tab, setTab] = useState<'standings' | 'fixtures'>('standings');
  const [pkTab, setPkTab] = useState<'overall' | 'pools' | 'knockout'>('overall');
  const [openTieId, setOpenTieId] = useState<string | null>(null);
  const [poolSearch, setPoolSearch] = useState('');

  // Match a club by squad name OR any player (men/women/mix) name.
  const clubMatches = (clubId?: string) => {
    const q = poolSearch.trim().toLowerCase();
    if (!q || !clubId) return false;
    const club = clubs.find((c) => c.id === clubId);
    if (!club) return false;
    if (club.name.toLowerCase().includes(q)) return true;
    return RUBBER_CATEGORIES.some((cat) => club.teams[cat]?.name.toLowerCase().includes(q));
  };

  // Count rubbers won by each club in a tie (for the tie header score).
  const tieScore = (tie: Tie) => {
    let c1 = 0;
    let c2 = 0;
    tie.matchIds.forEach((id) => {
      const m = tournament.matches.find((x) => x.id === id);
      if (!m || !m.completed || !m.winner) return;
      if (m.winner.id === m.team1.id) c1++;
      else c2++;
    });
    return { c1, c2 };
  };

  // The 3 rubber cards (men/women/mix) for a tie.
  const renderRubbers = (tie: Tie) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {RUBBER_CATEGORIES.map((cat) => {
        const m = tie.matchIds
          .map((id) => tournament.matches.find((x) => x.id === id))
          .find((x) => x?.category === cat);
        if (!m) return null;
        return (
          <div key={cat}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#8B7355] mb-1 text-center">
              {CATEGORY_LABEL[cat]}
            </div>
            <MatchCard
              match={m}
              onSelect={() => onMatchSelect(m)}
              isSelected={selectedMatch?.id === m.id}
              tournament={tournament}
              isContestantView={headerProps.isContestantView}
            />
          </div>
        );
      })}
    </div>
  );

  const renderTie = (tie: Tie) => {
    const { c1, c2 } = tieScore(tie);
    const isFinal = tie.stage === 'final';
    const winnerName = tie.winnerClubId ? clubName(tie.winnerClubId) : null;

    return (
      <div
        key={tie.id}
        className={`bg-[#FFFFFF]/80 backdrop-blur-xl border rounded-2xl p-5 shadow-lg ${
          isFinal ? 'border-yellow-400/70' : 'border-[#F0EBE3]'
        }`}
      >
        {/* Tie header — club vs club */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg font-bold text-[#2A2A2A] truncate">{slotName(tie, 1)}</span>
            <span className="text-sm font-bold text-[#B45330] bg-[#B45330]/10 px-2 py-0.5 rounded">
              {c1} - {c2}
            </span>
            <span className="text-lg font-bold text-[#2A2A2A] truncate">{slotName(tie, 2)}</span>
          </div>
          {tie.completed && winnerName ? (
            <span className="flex items-center gap-1 text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-300 px-2 py-1 rounded-full whitespace-nowrap">
              <Trophy className="w-3 h-3" /> {winnerName}
            </span>
          ) : (
            <span className="text-xs font-medium text-gray-400 whitespace-nowrap">
              {isFinal && !tie.club1Id ? 'Awaiting finalists' : 'In Progress'}
            </span>
          )}
        </div>

        {/* 3 rubbers */}
        {renderRubbers(tie)}
      </div>
    );
  };

  // ── Pool-knockout (Squad Battle) layout ───────────────────────────────────
  if (isPoolKnockout) {
    const pools = tournament.clashPools ?? [];
    const knockoutActive = tournament.clashStage === 'knockout' || tournament.clashStage === 'done';
    const seeds = knockoutActive && !isLadder ? computeClashSeeds(tournament) : [];
    const poTies = ties.filter((t) => t.stage === 'playoff').sort((a, b) => a.position - b.position);
    const sfTies = ties.filter((t) => t.stage === 'semifinal').sort((a, b) => a.position - b.position);
    const finalTie = ties.find((t) => t.stage === 'final');
    const thirdTie = ties.find((t) => t.stage === 'third-place');

    const [po1, po2] = poTies;
    const [sf1, sf2] = sfTies;
    const openTie = ties.find((t) => t.id === openTieId) ?? null;
    // Ladder (Squad Battle 8) ties
    const atPos = (stage: Tie['stage'], pos: number) => ties.find((t) => t.stage === stage && t.position === pos);
    const r1t = atPos('round1', 0), r1b = atPos('round1', 1);
    const qft = atPos('quarterfinal', 0), qfb = atPos('quarterfinal', 1);

    const winnerSlot = (tie: Tie, slot: 1 | 2) =>
      tie.completed && tie.winnerClubId === (slot === 1 ? tie.club1Id : tie.club2Id);

    // Compact, clickable bracket node (2 slots + aggregate tie score).
    const NodeCard = ({ tie, accent }: { tie?: Tie; accent?: boolean }) => {
      if (!tie) return <div className="w-44" />;
      const { c1, c2 } = tieScore(tie);
      const open = openTieId === tie.id;
      const row = (name: string, score: number, win: boolean) => (
        <div className={`flex items-center justify-between gap-2 px-3 py-2 ${win ? 'bg-[#B45330]/10 text-[#B45330] font-bold' : 'text-[#2A2A2A]'}`}>
          <span className="truncate text-sm">{name}</span>
          <span className="tabular-nums text-sm">{score}</span>
        </div>
      );
      return (
        <button
          type="button"
          onClick={() => setOpenTieId(open ? null : tie.id)}
          className={`w-44 rounded-xl border bg-white overflow-hidden text-left transition-all shadow-sm hover:shadow-md ${
            open ? 'border-[#B45330] ring-2 ring-[#B45330]/30' : accent ? 'border-yellow-400/70' : 'border-[#F0EBE3]'
          }`}
        >
          {row(slotName(tie, 1), c1, winnerSlot(tie, 1))}
          <div className="border-t border-[#F0EBE3]" />
          {row(slotName(tie, 2), c2, winnerSlot(tie, 2))}
        </button>
      );
    };

    const line = 'border-[#E5DDD3]';
    const StraightConnector = () => (
      <div className="relative w-8 self-stretch">
        <div className={`absolute left-0 right-0 top-1/4 border-t-2 ${line}`} />
        <div className={`absolute left-0 right-0 bottom-1/4 border-t-2 ${line}`} />
      </div>
    );
    const ElbowConnector = () => (
      <div className="relative w-8 self-stretch">
        <div className={`absolute left-0 w-1/2 top-1/4 border-t-2 ${line}`} />
        <div className={`absolute left-0 w-1/2 bottom-1/4 border-t-2 ${line}`} />
        <div className={`absolute left-1/2 top-1/4 bottom-1/4 border-l-2 ${line}`} />
        <div className={`absolute left-1/2 right-0 top-1/2 border-t-2 ${line}`} />
      </div>
    );
    const colLabel = (l: string) => (
      <div className="w-44 text-center text-[10px] font-bold uppercase tracking-widest text-[#8B7355]">{l}</div>
    );

    const overall = calculateClashOverallStandings(tournament);
    const poolNameOf = (clubId: string) =>
      pools.find((p) => p.clubIds.includes(clubId))?.name ?? '';

    const tabBtn = (id: 'overall' | 'pools' | 'knockout', label: string, Icon: typeof BarChart2) => (
      <button
        onClick={() => setPkTab(id)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
          pkTab === id ? 'bg-[#B45330] text-white shadow-md' : 'bg-white/60 border border-[#F0EBE3] text-gray-500 hover:bg-white'
        }`}
      >
        <Icon className="w-4 h-4" /> {label}
      </button>
    );

    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] space-y-8 font-mono p-4 md:p-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#8B7355]/20 to-[#B45330]/10 rounded-full blur-3xl animate-pulse"></div>
        </div>

        <TournamentHeader tournament={tournament} {...headerProps} />

        <div className="relative z-10 flex flex-wrap gap-2">
          {tabBtn('overall', 'Overall', Trophy)}
          {tabBtn('pools', 'Pools', BarChart2)}
          {tabBtn('knockout', 'Knockout', Network)}
        </div>

        {/* Overall leaderboard (all squads, pool-stage performance) */}
        {pkTab === 'overall' && (
          <div className="relative z-10 bg-white/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-5 shadow-lg overflow-x-auto">
            <h2 className="text-xl font-bold text-[#2A2A2A] flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-[#B45330]" /> Overall Leaderboard
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Semua squad · performa fase pool · ranking PTS → GD → GF
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0EBE3] text-gray-400">
                  <th className="text-left py-2 px-2 w-8">#</th>
                  <th className="text-left py-2 px-3">Squad</th>
                  <th className="text-left py-2 px-2">Pool</th>
                  <th className="text-center py-2 px-2">P</th>
                  <th className="text-center py-2 px-2">W</th>
                  <th className="text-center py-2 px-2">L</th>
                  <th className="text-center py-2 px-2">GF</th>
                  <th className="text-center py-2 px-2">GA</th>
                  <th className="text-center py-2 px-2">GD</th>
                  <th className="text-center py-2 px-2 text-[#B45330]">PTS</th>
                </tr>
              </thead>
              <tbody>
                {overall.map((r, idx) => (
                  <tr key={r.club.id} className={`border-b border-[#F0EBE3]/50 ${idx === 0 ? 'bg-yellow-50' : ''}`}>
                    <td className="py-2 px-2">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-[#8B7355] text-white' : idx === 2 ? 'bg-[#B45330] text-white' : 'bg-[#F0EBE3] text-gray-400'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-[#2A2A2A]">{r.club.name}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{poolNameOf(r.club.id)}</td>
                    <td className="py-2 px-2 text-center text-gray-600">{r.played}</td>
                    <td className="py-2 px-2 text-center text-gray-600">{r.wins}</td>
                    <td className="py-2 px-2 text-center text-gray-600">{r.losses}</td>
                    <td className="py-2 px-2 text-center text-gray-600">{r.rubbersWon}</td>
                    <td className="py-2 px-2 text-center text-gray-600">{r.rubbersLost}</td>
                    <td className={`py-2 px-2 text-center font-bold ${r.rubberDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {r.rubberDiff >= 0 ? `+${r.rubberDiff}` : r.rubberDiff}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-[#B45330]">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pools */}
        {pkTab === 'pools' && (
          <div className="relative z-10 space-y-8">
            {/* Search squad / player */}
            <div className="relative max-w-sm">
              <input
                type="text"
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                placeholder="Cari squad atau nama pemain…"
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#F0EBE3] rounded-xl text-sm text-[#2A2A2A] placeholder-gray-400 focus:ring-2 focus:ring-[#B45330] focus:border-transparent"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {poolSearch && (
                <button
                  onClick={() => setPoolSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#B45330] text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {pools.map((pool) => {
              const rows = calculateClashPoolStandings(tournament, pool.id);
              const poolTies = ties
                .filter((t) => t.stage === 'pool' && t.poolId === pool.id)
                .sort((a, b) => a.round - b.round || a.position - b.position);
              return (
                <div key={pool.id} className="space-y-4">
                  <div className="bg-white/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-5 shadow-lg overflow-x-auto">
                    <h2 className="text-xl font-bold text-[#2A2A2A] flex items-center gap-2 mb-4">
                      <BarChart2 className="w-5 h-5 text-[#B45330]" /> {pool.name}
                    </h2>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#F0EBE3] text-gray-400">
                          <th className="text-left py-2 px-2 w-8">#</th>
                          <th className="text-left py-2 px-3">Squad</th>
                          <th className="text-center py-2 px-2">P</th>
                          <th className="text-center py-2 px-2">W</th>
                          <th className="text-center py-2 px-2">L</th>
                          <th className="text-center py-2 px-2">GF</th>
                          <th className="text-center py-2 px-2">GA</th>
                          <th className="text-center py-2 px-2">GD</th>
                          <th className="text-center py-2 px-2 text-[#B45330]">PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, idx) => {
                          const hit = clubMatches(r.club.id);
                          return (
                          <tr key={r.club.id} className={`border-b border-[#F0EBE3]/50 ${hit ? 'bg-yellow-200 ring-2 ring-[#B45330]' : idx < 2 ? 'bg-[#B45330]/10' : ''}`}>
                            <td className="py-2 px-2">
                              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-[#8B7355] text-white' : 'bg-[#F0EBE3] text-gray-400'}`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-bold text-[#2A2A2A]">{r.club.name}</td>
                            <td className="py-2 px-2 text-center text-gray-600">{r.played}</td>
                            <td className="py-2 px-2 text-center text-gray-600">{r.wins}</td>
                            <td className="py-2 px-2 text-center text-gray-600">{r.losses}</td>
                            <td className="py-2 px-2 text-center text-gray-600">{r.rubbersWon}</td>
                            <td className="py-2 px-2 text-center text-gray-600">{r.rubbersLost}</td>
                            <td className={`py-2 px-2 text-center font-bold ${r.rubberDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {r.rubberDiff >= 0 ? `+${r.rubberDiff}` : r.rubberDiff}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-[#B45330]">{r.points}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-400 mt-3">Top 2 lolos · ranking PTS → GD → GF</p>
                  </div>
                  <div className="space-y-4">
                    {poolTies.map((tie) => (
                      <div
                        key={tie.id}
                        className={clubMatches(tie.club1Id) || clubMatches(tie.club2Id) ? 'rounded-2xl ring-2 ring-[#B45330]' : ''}
                      >
                        {renderTie(tie)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Knockout */}
        {pkTab === 'knockout' && (
          <div className="relative z-10 space-y-8">
            {seeds.length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-5 shadow-lg">
                <h2 className="text-lg font-bold text-[#2A2A2A] flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-[#B45330]" /> Seeding
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {seeds.map((club, i) => (
                    <div key={club.id} className="flex items-center gap-2 bg-[#FAF8F5] border border-[#F0EBE3] rounded-lg px-3 py-2">
                      <span className="w-6 h-6 rounded-full bg-[#B45330] text-white inline-flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span className="font-semibold text-sm text-[#2A2A2A] truncate">{club.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!knockoutActive && (
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <Network className="w-4 h-4" /> Preview bagan — terisi otomatis setelah fase pool selesai.
              </p>
            )}

            {/* Bracket tree */}
            <div className="bg-white/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-5 shadow-lg overflow-x-auto">
              {isLadder ? (
                <div className="inline-flex flex-col gap-2 min-w-max">
                  <div className="inline-flex">
                    {colLabel('Round 1')}
                    <div className="w-8" />
                    {colLabel('Quarterfinal')}
                    <div className="w-8" />
                    {colLabel('Semifinal')}
                    <div className="w-8" />
                    {colLabel('Final')}
                  </div>
                  <div className="inline-flex items-stretch" style={{ minHeight: 260 }}>
                    <div className="flex flex-col justify-around">
                      <NodeCard tie={r1t} />
                      <NodeCard tie={r1b} />
                    </div>
                    <StraightConnector />
                    <div className="flex flex-col justify-around">
                      <NodeCard tie={qft} />
                      <NodeCard tie={qfb} />
                    </div>
                    <StraightConnector />
                    <div className="flex flex-col justify-around">
                      <NodeCard tie={sf1} />
                      <NodeCard tie={sf2} />
                    </div>
                    <ElbowConnector />
                    <div className="flex flex-col justify-center">
                      <NodeCard tie={finalTie} accent />
                    </div>
                  </div>
                </div>
              ) : (
              <div className="inline-flex flex-col gap-2 min-w-max">
                <div className="inline-flex">
                  {colLabel('Playoff')}
                  <div className="w-8" />
                  {colLabel('Semifinal')}
                  <div className="w-8" />
                  {colLabel('Final')}
                </div>
                <div className="inline-flex items-stretch" style={{ minHeight: 220 }}>
                  <div className="flex flex-col justify-around">
                    <NodeCard tie={po1} />
                    <NodeCard tie={po2} />
                  </div>
                  <StraightConnector />
                  <div className="flex flex-col justify-around">
                    <NodeCard tie={sf1} />
                    <NodeCard tie={sf2} />
                  </div>
                  <ElbowConnector />
                  <div className="flex flex-col justify-center">
                    <NodeCard tie={finalTie} accent />
                  </div>
                </div>
              </div>
              )}

              {thirdTie && (
                <div className="mt-6 pt-4 border-t border-[#F0EBE3]">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#8B7355] flex items-center gap-1">
                    🥉 3rd Place
                  </div>
                  <NodeCard tie={thirdTie} />
                </div>
              )}

              <p className="text-xs text-gray-400 mt-4">Klik node buat lihat 3 rubber (Men/Women/Mix).</p>
            </div>

            {/* Expanded rubbers for the selected tie */}
            {openTie && (
              <div className="bg-white/80 backdrop-blur-xl border border-[#B45330]/40 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-[#2A2A2A]">
                    {slotName(openTie, 1)} <span className="text-[#B45330]">vs</span> {slotName(openTie, 2)}
                  </span>
                  <button onClick={() => setOpenTieId(null)} className="text-xs text-gray-400 hover:text-[#B45330] transition-colors">
                    Tutup ✕
                  </button>
                </div>
                {renderRubbers(openTie)}
              </div>
            )}
          </div>
        )}

        {/* Champion */}
        {tournament.completed && tournament.winnerClubId && (
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center gap-3 bg-yellow-50 border border-yellow-400 text-yellow-800 px-6 py-3 rounded-full">
              <Trophy className="w-6 h-6" />
              <span className="text-xl font-bold">Champion: {clubName(tournament.winnerClubId)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] space-y-8 font-mono p-4 md:p-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#8B7355]/20 to-[#B45330]/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <TournamentHeader tournament={tournament} {...headerProps} />

      {/* Tabs */}
      <div className="relative z-10 flex flex-wrap gap-2">
        <button
          onClick={() => setTab('standings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
            tab === 'standings'
              ? 'bg-[#B45330] text-white shadow-md'
              : 'bg-white/60 border border-[#F0EBE3] text-gray-500 hover:bg-white'
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Club Standings
        </button>
        <button
          onClick={() => setTab('fixtures')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
            tab === 'fixtures'
              ? 'bg-[#B45330] text-white shadow-md'
              : 'bg-white/60 border border-[#F0EBE3] text-gray-500 hover:bg-white'
          }`}
        >
          <Swords className="w-4 h-4" /> Ties & Rubbers
        </button>
      </div>

      {/* Standings */}
      {tab === 'standings' && (
        <div className="relative z-10 bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold text-[#2A2A2A] flex items-center gap-3 mb-2">
            <BarChart2 className="w-6 h-6 text-[#B45330]" /> Club Standings
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Diurutkan berdasarkan rubber menang, lalu selisih set, lalu tie menang.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F0EBE3] text-gray-400 text-sm">
                  <th className="text-left py-3 px-2 w-10">#</th>
                  <th className="text-left py-3 px-4">Club</th>
                  <th className="text-center py-3 px-2">Rubbers</th>
                  <th className="text-center py-3 px-2 hidden sm:table-cell">W-L</th>
                  <th className="text-center py-3 px-2 hidden sm:table-cell">Set Diff</th>
                  <th className="text-center py-3 px-2">Ties</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((club, index) => {
                  const setDiff = (club.setsWon || 0) - (club.setsLost || 0);
                  return (
                    <tr
                      key={club.id}
                      className={`border-b border-[#F0EBE3]/50 ${index < 2 ? 'bg-[#B45330]/10' : ''}`}
                    >
                      <td className="py-3 px-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0
                              ? 'bg-[#B45330] text-white'
                              : index === 1
                                ? 'bg-[#8B7355] text-white'
                                : 'bg-[#F0EBE3] text-gray-400'
                          }`}
                        >
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#2A2A2A]">{club.name}</td>
                      <td className="py-3 px-2 text-center text-[#B45330] font-bold">{club.rubbersWon || 0}</td>
                      <td className="py-3 px-2 text-center text-gray-600 hidden sm:table-cell">
                        {club.rubbersWon || 0}-{club.rubbersLost || 0}
                      </td>
                      <td className={`py-3 px-2 text-center font-bold hidden sm:table-cell ${setDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {setDiff >= 0 ? `+${setDiff}` : setDiff}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-600 font-bold">{club.tiesWon || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fixtures (ties grouped by round + final) */}
      {tab === 'fixtures' && (
        <div className="relative z-10 space-y-8">
          {rounds.map((round) => (
            <div key={round} className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-500 flex items-center gap-2">
                <Swords className="w-5 h-5" /> Round {round}
              </h3>
              {rrTies
                .filter((t) => t.round === round)
                .sort((a, b) => a.position - b.position)
                .map(renderTie)}
            </div>
          ))}

          {finalTie && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-yellow-600 flex items-center gap-2">
                <Trophy className="w-5 h-5" /> Final
              </h3>
              {renderTie(finalTie)}
            </div>
          )}
        </div>
      )}

      {/* Champion */}
      {tournament.completed && tournament.winnerClubId && (
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-3 bg-yellow-50 border border-yellow-400 text-yellow-800 px-6 py-3 rounded-full">
            <Trophy className="w-6 h-6" />
            <span className="text-xl font-bold">Champion: {clubName(tournament.winnerClubId)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
