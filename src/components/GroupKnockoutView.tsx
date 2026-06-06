import React, { useState, useEffect } from 'react';
import { Trophy, Users, Target, BarChart2 } from 'lucide-react';
import {
  TournamentHeader,
  MatchCard,
  getRoundName,
  ViewProps,
} from './TournamentBracket';
import { Group } from '../types/tournament';

function CrossGroupLeaderboard({ groups }: { groups: Group[] }) {
  if (!groups || groups.length === 0) return null;

  // Find max rank tier (e.g. 4 if each group has 4 teams)
  const maxTier = Math.max(...groups.map((g) => g.standings.length));

  // Build tiers: for each rank position, collect all teams at that position
  const tiers: { rankLabel: string; entries: { team: Group['standings'][0]; groupName: string; groupRank: number }[] }[] = [];

  for (let rank = 0; rank < maxTier; rank++) {
    const entries: { team: Group['standings'][0]; groupName: string; groupRank: number }[] = [];
    groups.forEach((group) => {
      if (group.standings[rank]) {
        entries.push({
          team: group.standings[rank],
          groupName: group.name,
          groupRank: rank + 1,
        });
      }
    });

    // Sort within tier: W desc → pointsWon desc → pointsLost asc
    entries.sort((a, b) => {
      const aW = a.team.wins || 0;
      const bW = b.team.wins || 0;
      if (aW !== bW) return bW - aW;
      const aPW = (a.team as any).pointsWon ?? (a.team as any).gamesWon ?? 0;
      const bPW = (b.team as any).pointsWon ?? (b.team as any).gamesWon ?? 0;
      if (aPW !== bPW) return bPW - aPW;
      const aPL = (a.team as any).pointsLost ?? (a.team as any).gamesLost ?? 0;
      const bPL = (b.team as any).pointsLost ?? (b.team as any).gamesLost ?? 0;
      return aPL - bPL;
    });

    const rankLabel = rank === 0 ? '1st Place' : rank === 1 ? '2nd Place' : rank === 2 ? '3rd Place' : `${rank + 1}th Place`;
    tiers.push({ rankLabel, entries });
  }

  const tierColors = [
    { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', badge: 'bg-yellow-500 text-black', label: 'text-yellow-600' },
    { bg: 'bg-[#8B7355]/10', border: 'border-[#8B7355]/30', badge: 'bg-[#8B7355] text-white', label: 'text-[#8B7355]' },
    { bg: 'bg-orange-500/10', border: 'border-orange-500/30', badge: 'bg-orange-500 text-white', label: 'text-orange-500' },
    { bg: 'bg-gray-400/10', border: 'border-gray-400/30', badge: 'bg-gray-400 text-white', label: 'text-gray-400' },
  ];

  return (
    <div className="space-y-6">
      {tiers.map((tier, tierIdx) => {
        const color = tierColors[Math.min(tierIdx, tierColors.length - 1)];
        return (
          <div key={tier.rankLabel} className={`rounded-xl border ${color.border} ${color.bg} p-4`}>
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-sm font-bold uppercase tracking-widest ${color.label}`}>
                {tier.rankLabel} — All Groups
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F0EBE3] text-gray-400 text-sm">
                  <th className="text-left py-2 px-2 w-10">#</th>
                  <th className="text-left py-2 px-4">Team</th>
                  <th className="text-center py-2 px-2">Group</th>
                  <th className="text-center py-2 px-2">W</th>
                  <th className="text-center py-2 px-2 hidden sm:table-cell">PW</th>
                  <th className="text-center py-2 px-2 hidden sm:table-cell">PL</th>
                  <th className="text-center py-2 px-2 hidden sm:table-cell">PD</th>
                </tr>
              </thead>
              <tbody>
                {tier.entries.map((entry, idx) => {
                  const pw = (entry.team as any).pointsWon ?? (entry.team as any).gamesWon ?? 0;
                  const pl = (entry.team as any).pointsLost ?? (entry.team as any).gamesLost ?? 0;
                  const pd = pw - pl;
                  return (
                  <tr key={entry.team.id} className="border-b border-[#F0EBE3]/40">
                    <td className="py-2 px-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? color.badge : 'bg-[#F0EBE3] text-gray-400'}`}>
                        {idx + 1}
                      </div>
                    </td>
                    <td className="py-2 px-4 font-bold text-[#2A2A2A]">{entry.team.name}</td>
                    <td className="py-2 px-2 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#B45330]/10 text-[#B45330] border border-[#B45330]/30 font-medium">
                        {entry.groupName}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-[#B45330] font-bold">{entry.team.wins || 0}</td>
                    <td className="py-2 px-2 text-center text-gray-600 hidden sm:table-cell">{pw}</td>
                    <td className="py-2 px-2 text-center text-gray-600 hidden sm:table-cell">{pl}</td>
                    <td className={`py-2 px-2 text-center font-bold hidden sm:table-cell ${pd >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {pd >= 0 ? `+${pd}` : pd}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default function GroupKnockoutView({
  tournament,
  onMatchSelect,
  selectedMatch,
  ...headerProps
}: ViewProps) {
  const { groups = [] } = tournament;
  const knockoutMatches = tournament.matches.filter((m) => !m.groupId);

  // Get max round for knockout stage
  const maxRound =
    knockoutMatches.length > 0
      ? Math.max(...knockoutMatches.map((m) => m.round))
      : 0;
  const knockoutRounds = Array.from({ length: maxRound - 1 }, (_, i) => i + 2);

  const hasKnockout = knockoutRounds.length > 0;
  const hasGroups = groups.length > 0;

  // Default to groups if still in group stage, otherwise knockout
  const isGroupStage = tournament.groupStage === true;
  const defaultTab = (!isGroupStage && hasKnockout) ? 'knockout' : 'groups';
  const [activeTab, setActiveTab] = useState<'groups' | 'leaderboard' | 'knockout'>(defaultTab);

  // Auto-switch to knockout only when group stage ends mid-session
  useEffect(() => {
    if (!isGroupStage && hasKnockout && activeTab === 'groups') {
      setActiveTab('knockout');
    }
  }, [isGroupStage, hasKnockout]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] space-y-8 font-mono p-4 md:p-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#8B7355]/20 to-[#B45330]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-[#B45330]/20 to-[#8B7355]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <TournamentHeader tournament={tournament} {...headerProps} />

      {/* Tab Switcher */}
      <div className="relative z-10 flex flex-wrap gap-2">
        {hasKnockout && (
          <button
            onClick={() => setActiveTab('knockout')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'knockout'
                ? 'bg-[#B45330] text-white shadow-md'
                : 'bg-white/60 border border-[#F0EBE3] text-gray-500 hover:bg-white'
            }`}
          >
            <Target className="w-4 h-4" />
            Knockout Stage
          </button>
        )}
        {hasGroups && (
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'groups'
                ? 'bg-[#B45330] text-white shadow-md'
                : 'bg-white/60 border border-[#F0EBE3] text-gray-500 hover:bg-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Group Standings
          </button>
        )}
        {hasGroups && (
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-[#B45330] text-white shadow-md'
                : 'bg-white/60 border border-[#F0EBE3] text-gray-500 hover:bg-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Overall Leaderboard
          </button>
        )}
      </div>

      {/* Overall Cross-Group Leaderboard */}
      {hasGroups && activeTab === 'leaderboard' && (
        <div className="relative z-10 bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold text-[#2A2A2A] flex items-center gap-3 mb-6">
            <BarChart2 className="w-6 h-6 text-[#B45330]" />
            Overall Leaderboard
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Semua tim diurutkan berdasarkan posisi rank dalam grup mereka, lalu diadu antar grup berdasarkan W → PW → PL.
          </p>
          <CrossGroupLeaderboard groups={groups} />
        </div>
      )}

      {/* Group Stage */}
      {hasGroups && activeTab === 'groups' && (
        <div className="relative z-10 space-y-6">
          {groups.map((group, groupIndex) => (
            <div
              key={group.id}
              className="bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-2xl"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#2A2A2A] flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                  {group.name} Standings
                </h2>
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${group.completed
                      ? 'bg-[#B45330]/20 text-[#B45330] border border-[#B45330]/50'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                    }`}
                >
                  {group.completed ? 'Complete' : 'In Progress'}
                </div>
              </div>

              {/* Standings Table */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F0EBE3] text-gray-400">
                      <th className="text-left py-3 px-2">No</th>
                      <th className="text-left py-3 px-4">Team</th>
                      <th className="text-center py-3 px-2">W</th>
                      <th className="text-center py-3 px-2">PW</th>
                      <th className="text-center py-3 px-2">PL</th>
                      <th className="text-center py-3 px-2">PD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.standings.map((team, index) => {
                      const pw = (team as any).pointsWon || 0;
                      const pl = (team as any).pointsLost || 0;
                      const pd = pw - pl;
                      return (
                      <tr
                        key={team.id}
                        className={`border-b border-[#F0EBE3]/50 ${index < 2 ? 'bg-[#B45330]/10' : ''
                          }`}
                      >
                        <td className="py-3 px-2">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0
                                ? 'bg-[#B45330] text-black'
                                : index === 1
                                  ? 'bg-[#8B7355] text-white'
                                  : 'bg-[#F0EBE3] text-gray-300'
                              }`}
                          >
                            {index + 1}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#2A2A2A]">
                          {team.name}
                        </td>
                        <td className="py-3 px-2 text-center text-[#B45330] font-bold">
                          {team.wins || 0}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-600 font-bold">
                          {pw}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-600 font-bold">
                          {pl}
                        </td>
                        <td className={`py-3 px-2 text-center font-bold ${pd >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {pd >= 0 ? `+${pd}` : pd}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Group Matches */}
              <div>
                <h3 className="text-lg font-semibold text-[#2A2A2A] mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Group Matches
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.matches.map((groupMatch) => {
                    const fullMatch = tournament.matches.find(
                      (m) => m.id === groupMatch.id
                    );
                    if (!fullMatch) return null;

                    return (
                      <MatchCard
                        key={fullMatch.id}
                        match={fullMatch}
                        onSelect={() => onMatchSelect(fullMatch)}
                        isSelected={selectedMatch?.id === fullMatch.id}
                        tournament={tournament}
                        isContestantView={headerProps.isContestantView}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Knockout Stage */}
      {hasKnockout && activeTab === 'knockout' && (
        <div className="relative z-10 bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold text-[#2A2A2A] mb-6 flex items-center gap-3">
            <Target className="w-6 h-6 text-[#8B7355]" />
            Knockout Stage
          </h2>
          <div className="overflow-x-auto">
            <div className="flex gap-8 min-w-max pb-4">
              {knockoutRounds.map((round) => (
                <div
                  key={round}
                  className="flex flex-col justify-around space-y-6 min-w-64"
                >
                  <h3 className="text-lg font-semibold text-center text-gray-300 mb-4">
                    {getRoundName(round, maxRound)}
                  </h3>
                  {knockoutMatches
                    .filter((m) => m.round === round && !m.isThirdPlace)
                    .sort((a, b) => a.position - b.position)
                    .map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        onSelect={() => onMatchSelect(match)}
                        isSelected={selectedMatch?.id === match.id}
                        tournament={tournament}
                        isContestantView={headerProps.isContestantView}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>

          {/* 3rd-place match */}
          {knockoutMatches.filter((m) => m.isThirdPlace).map((match) => (
            <div key={match.id} className="mt-6 pt-6 border-t border-[#F0EBE3] max-w-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#8B7355] mb-3 flex items-center gap-2">
                🥉 3rd Place
              </h3>
              <MatchCard
                match={match}
                onSelect={() => onMatchSelect(match)}
                isSelected={selectedMatch?.id === match.id}
                tournament={tournament}
                isContestantView={headerProps.isContestantView}
              />
            </div>
          ))}
        </div>
      )}

      {/* Tournament Winner */}
      {tournament.completed && tournament.winner && (
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-3 bg-yellow-50 border border-yellow-400 text-yellow-800 px-6 py-3 rounded-full">
            <Trophy className="w-6 h-6" />
            <span className="text-xl font-bold">
              Champion: {tournament.winner.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
