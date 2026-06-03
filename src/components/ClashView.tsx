import { useState } from 'react';
import { Trophy, Swords, BarChart2 } from 'lucide-react';
import { TournamentHeader, MatchCard, ViewProps } from './TournamentBracket';
import { calculateClashStandings } from '../utils/tournamentLogic';
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
  const standings = calculateClashStandings(tournament);
  const clubName = (id: string) => clubs.find((c) => c.id === id)?.name ?? 'TBD';

  const rrTies = ties.filter((t) => t.stage === 'round-robin');
  const finalTie = ties.find((t) => t.stage === 'final');
  const rounds = [...new Set(rrTies.map((t) => t.round))].sort((a, b) => a - b);

  const [tab, setTab] = useState<'standings' | 'fixtures'>('standings');

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
            <span className="text-lg font-bold text-[#2A2A2A] truncate">{clubName(tie.club1Id)}</span>
            <span className="text-sm font-bold text-[#B45330] bg-[#B45330]/10 px-2 py-0.5 rounded">
              {c1} - {c2}
            </span>
            <span className="text-lg font-bold text-[#2A2A2A] truncate">{clubName(tie.club2Id)}</span>
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
      </div>
    );
  };

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
