import React, { useState } from 'react';
import {
  Trophy,
  Clock,
  CheckCircle,
  MapPin,
  Settings,
  Calendar,
  AlertTriangle,
  Tv,
  Copy,
  ExternalLink,
  Edit2,
  ArrowRight,
  Users,
} from 'lucide-react';
import { Tournament, Match, Court } from '../types/tournament';
import { calculateRoundRobinStandings } from '../utils/tournamentLogic';
import {
  autoAssignCourts,
  getCourtName,
  validateCourtCapacity,
  getTournamentScheduleOverview,
  formatScheduledTime,
} from '../utils/courtAssignment';
import CourtManager from './CourtManager';
import GroupKnockoutView from './GroupKnockoutView';

// --- PROPS ---
interface TournamentBracketProps {
  tournament: Tournament;
  isContestantView?: boolean;
  onMatchSelect: (match: Match) => void;
  selectedMatch: Match | null;
  onUpdateTournament?: (tournament: Tournament) => void;
}

export interface ViewProps
  extends Omit<TournamentBracketProps, 'onUpdateTournament'> {
  showCourtManager: boolean;
  setShowCourtManager: (show: boolean) => void;
  onAutoAssignCourts: () => void;
  onUpdateCourts: (courts: Court[]) => void;
  onRenameTeam?: (teamId: string, newName: string) => void;
  courtValidation: {
    isValid: boolean;
    message: string;
    recommendedCourts: number;
  };
  scheduleOverview: any;
}

// --- MAIN COMPONENT ---
export default function TournamentBracket({
  tournament,
  isContestantView = false,
  onMatchSelect,
  selectedMatch,
  onUpdateTournament,
}: TournamentBracketProps) {
  const [showCourtManager, setShowCourtManager] = useState(false);
  const courtValidation = validateCourtCapacity(tournament);
  const scheduleOverview = getTournamentScheduleOverview(tournament);

  const handleAutoAssignCourts = () => {
    if (onUpdateTournament) {
      const result = autoAssignCourts(tournament);
      onUpdateTournament(result.tournament);

      let message = '';
      if (result.assignedMatches.length > 0)
        message += `✅ ${result.assignedMatches.length} matches assigned to play now\n`;
      if (result.scheduledMatches.length > 0)
        message += `⏰ ${result.scheduledMatches.length} matches scheduled for later\n`;
      if (
        result.totalScheduled ===
        result.assignedMatches.length + result.scheduledMatches.length &&
        result.totalScheduled > 0
      )
        message += `\n🎉 All ${result.totalScheduled} available matches have been scheduled!`;

      alert(message.trim() || 'No new matches to assign at the moment.');
    }
  };

  const handleUpdateCourts = (courts: Court[]) => {
    if (onUpdateTournament) {
      onUpdateTournament({ ...tournament, courts });
    }
  };

  const handleRenameTeam = (teamId: string, newName: string) => {
    if (!onUpdateTournament) return;
    const rename = <T extends { id: string; name: string }>(t: T): T =>
      t.id === teamId ? { ...t, name: newName } : t;
    const renameMatch = (m: any) => ({
      ...m,
      team1: rename(m.team1),
      team2: rename(m.team2),
      winner: m.winner ? rename(m.winner) : undefined,
    });
    onUpdateTournament({
      ...tournament,
      teams: tournament.teams.map(rename),
      matches: tournament.matches.map(renameMatch),
      winner: tournament.winner ? rename(tournament.winner) : undefined,
      groups: tournament.groups?.map(g => ({
        ...g,
        teams: g.teams.map(rename),
        standings: g.standings.map(rename),
        matches: g.matches.map(renameMatch),
      })),
    });
  };

  const viewProps: ViewProps = {
    tournament,
    isContestantView,
    onMatchSelect,
    selectedMatch,
    showCourtManager,
    setShowCourtManager,
    onAutoAssignCourts: handleAutoAssignCourts,
    onUpdateCourts: handleUpdateCourts,
    onRenameTeam: onUpdateTournament ? handleRenameTeam : undefined,
    courtValidation,
    scheduleOverview,
  };

  if (tournament.format === 'group-knockout') {
    return <GroupKnockoutView {...viewProps} />;
  }

  if (tournament.format === 'round-robin') {
    return <RoundRobinView {...viewProps} />;
  }

  return <EliminationBracket {...viewProps} />;
}

// --- REUSABLE HEADER COMPONENT ---
export function TournamentHeader({
  isContestantView,
  tournament,
  showCourtManager,
  setShowCourtManager,
  onAutoAssignCourts,
  onUpdateCourts,
  onRenameTeam,
  courtValidation,
  scheduleOverview,
}: any) {
  const [showRenameTeams, setShowRenameTeams] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmRename, setConfirmRename] = useState<{ teamId: string; oldName: string; newName: string } | null>(null);

  const startEdit = (team: { id: string; name: string }) => {
    setEditingTeamId(team.id);
    setEditName(team.name);
    setConfirmRename(null);
  };

  const requestSave = (team: { id: string; name: string }) => {
    const newName = editName.trim();
    if (!newName || newName === team.name) { setEditingTeamId(null); return; }
    setConfirmRename({ teamId: team.id, oldName: team.name, newName });
    setEditingTeamId(null);
  };

  const confirmSave = () => {
    if (!confirmRename || !onRenameTeam) return;
    onRenameTeam(confirmRename.teamId, confirmRename.newName);
    setConfirmRename(null);
  };

  if (isContestantView) return null;

  return (
    <div className="relative z-10 bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-[#2A2A2A] flex items-center gap-3">
          <MapPin className="w-6 h-6 text-[#8B7355]" />
          Court Management
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onAutoAssignCourts}
            disabled={tournament.courts.length === 0}
            className="group flex items-center gap-2 bg-[#B45330] text-white border border-[#B45330] px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:bg-[#C96A40] hover:shadow-neon-green disabled:border-gray-400 disabled:bg-[#F0EBE3] disabled:text-gray-400 disabled:cursor-not-allowed disabled:transform-none"
          >
            <Calendar className="w-4 h-4 text-white group-disabled:text-gray-400" />
            Auto Assign
          </button>
          <button
            onClick={() => setShowCourtManager(!showCourtManager)}
            className="group flex items-center gap-2 bg-white text-[#8B7355] border border-[#8B7355] px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:bg-[#8B7355]/10"
          >
            <Settings className="w-4 h-4 text-[#8B7355]" />
            Manage Courts
          </button>
          {onRenameTeam && (
            <button
              onClick={() => { setShowRenameTeams(!showRenameTeams); setEditingTeamId(null); setConfirmRename(null); }}
              className="group flex items-center gap-2 bg-white text-[#8B7355] border border-[#8B7355] px-4 py-2 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:bg-[#8B7355]/10"
            >
              <Edit2 className="w-4 h-4 text-[#8B7355]" />
              Rename Teams
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4 text-center">
        <div className="bg-[#F0EBE3]/50 border border-[#D4C9BB] rounded-xl p-3">
          <div className="text-gray-400 text-sm font-medium">Total</div>
          <div className="text-2xl font-bold text-[#2A2A2A]">
            {tournament.courts.length}
          </div>
        </div>
        <div className="bg-[#F0EBE3]/50 border border-[#D4C9BB] rounded-xl p-3">
          <div className="text-[#B45330] text-sm font-medium">Available</div>
          <div className="text-2xl font-bold text-[#B45330]">
            {
              tournament.courts.filter(
                (c: Court) => c.isAvailable && !c.currentMatch
              ).length
            }
          </div>
        </div>
        <div className="bg-[#F0EBE3]/50 border border-[#D4C9BB] rounded-xl p-3">
          <div className="text-yellow-400 text-sm font-medium">In Use</div>
          <div className="text-2xl font-bold text-yellow-400">
            {scheduleOverview.inProgressMatches}
          </div>
        </div>
        <div className="bg-[#F0EBE3]/50 border border-[#D4C9BB] rounded-xl p-3">
          <div className="text-[#8B7355] text-sm font-medium">Scheduled</div>
          <div className="text-2xl font-bold text-[#8B7355]">
            {scheduleOverview.scheduledMatches}
          </div>
        </div>
        <div className="bg-[#F0EBE3]/50 border border-[#D4C9BB] rounded-xl p-3">
          <div className="text-gray-400 text-sm font-medium">Completed</div>
          <div className="text-2xl font-bold text-gray-600">
            {scheduleOverview.completedMatches}
          </div>
        </div>
        <div className="bg-[#F0EBE3]/50 border border-[#D4C9BB] rounded-xl p-3">
          <div className="text-red-500 text-sm font-medium">Unscheduled</div>
          <div className="text-2xl font-bold text-red-500">
            {scheduleOverview.unscheduledMatches}
          </div>
        </div>
      </div>

      {!courtValidation.isValid && (
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-xl mb-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <div className="text-sm">
            <strong>Warning:</strong> {courtValidation.message} (Recommended:{' '}
            {courtValidation.recommendedCourts} courts)
          </div>
        </div>
      )}

      {showCourtManager && (
        <div className="border-t border-[#F0EBE3] pt-6 mt-6">
          <CourtManager
            courts={tournament.courts}
            onUpdateCourts={onUpdateCourts}
          />
        </div>
      )}

      {showRenameTeams && onRenameTeam && (
        <div className="border-t border-[#F0EBE3] pt-6 mt-6">
          <h3 className="text-sm font-bold text-[#2A2A2A] flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#B45330]" />
            Rename Teams
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tournament.teams.map((team: { id: string; name: string }) => {
              const isEditing = editingTeamId === team.id;
              const isPending = confirmRename?.teamId === team.id;
              return (
                <div key={team.id} className="bg-[#FAF8F5] border border-[#F0EBE3] rounded-xl p-3">
                  {isPending ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="px-2 py-1 bg-[#F0EBE3] rounded font-mono text-gray-500 line-through text-xs">{confirmRename.oldName}</span>
                        <ArrowRight className="w-3 h-3 text-[#B45330] flex-shrink-0" />
                        <span className="px-2 py-1 bg-[#B45330]/10 border border-[#B45330]/30 rounded font-mono font-bold text-[#B45330] text-xs">{confirmRename.newName}</span>
                      </div>
                      <p className="text-xs text-gray-400">Updates everywhere — matches & standings.</p>
                      <div className="flex gap-2">
                        <button onClick={confirmSave} className="px-3 py-1 bg-[#B45330] text-white rounded-lg text-xs font-bold hover:bg-[#C96A40] transition-colors">Confirm</button>
                        <button onClick={() => setConfirmRename(null)} className="px-3 py-1 bg-[#F0EBE3] text-[#2A2A2A] rounded-lg text-xs hover:bg-[#D4C9BB] transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') requestSave(team); if (e.key === 'Escape') setEditingTeamId(null); }}
                        className="flex-1 px-2 py-1.5 border border-[#B45330]/50 rounded-lg text-sm focus:ring-2 focus:ring-[#B45330] focus:border-transparent min-w-0"
                        autoFocus
                      />
                      <button onClick={() => requestSave(team)} disabled={!editName.trim()} className="px-2 py-1.5 bg-[#B45330] text-white rounded-lg text-xs font-bold hover:bg-[#C96A40] disabled:opacity-40 transition-colors flex-shrink-0">Save</button>
                      <button onClick={() => setEditingTeamId(null)} className="px-2 py-1.5 bg-[#F0EBE3] text-[#2A2A2A] rounded-lg text-xs hover:bg-[#D4C9BB] transition-colors flex-shrink-0">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#2A2A2A] text-sm truncate">{team.name}</span>
                      <button onClick={() => startEdit(team)} className="p-1.5 text-gray-400 hover:text-[#B45330] hover:bg-[#B45330]/10 rounded-lg transition-colors flex-shrink-0" title="Rename">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TV Display Links */}
      {tournament.courts.length > 0 && (
        <div className="border-t border-[#F0EBE3] pt-6 mt-6">
          <h3 className="text-sm font-bold text-[#2A2A2A] flex items-center gap-2 mb-3">
            <Tv className="w-4 h-4 text-[#B45330]" />
            TV Display Links
            <span className="text-xs text-gray-400 font-normal">— buka di browser TV, satu per court</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tournament.courts.map((court, idx) => {
              const url = `${window.location.origin}/tv/${tournament.id}?court=${idx}`;
              return (
                <div
                  key={court.id}
                  className="flex items-center justify-between gap-2 bg-[#FAF8F5] border border-[#F0EBE3] rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${court.currentMatch ? 'bg-red-500 animate-pulse' : court.isAvailable ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="font-semibold text-[#2A2A2A] truncate text-sm">{court.name}</span>
                    {court.currentMatch && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">LIVE</span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => navigator.clipboard.writeText(url).then(() => alert(`URL copied!\n${url}`))}
                      className="p-1.5 text-gray-400 hover:text-[#B45330] hover:bg-[#B45330]/10 rounded-lg transition-colors"
                      title="Copy URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-[#B45330] hover:bg-[#B45330]/10 rounded-lg transition-colors"
                      title="Open TV display"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- VIEW COMPONENTS ---
// FIXED: Complete Round Robin View implementation
export function RoundRobinView({
  tournament,
  onMatchSelect,
  selectedMatch,
  ...headerProps
}: ViewProps) {
  const standings = calculateRoundRobinStandings(tournament);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] space-y-8 font-mono p-4 md:p-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#8B7355]/20 to-[#B45330]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-[#B45330]/20 to-[#8B7355]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <TournamentHeader tournament={tournament} {...headerProps} />

      {/* Round Robin Standings */}
      <div className="relative z-10 bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-2xl">
        <h2 className="text-2xl font-bold text-[#2A2A2A] mb-6 flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-400" />
          Tournament Standings
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F0EBE3] text-gray-600">
                <th className="text-left py-3 px-4">Rank</th>
                <th className="text-left py-3 px-4">Team</th>
                <th className="text-center py-3 px-4">W</th>
                <th className="text-center py-3 px-4">L</th>
                <th className="text-center py-3 px-4">Sets</th>
                <th className="text-center py-3 px-4">Set Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => (
                <tr
                  key={team.id}
                  className={`border-b border-[#F0EBE3]/50 ${index < 2 ? 'bg-[#B45330]/10' : ''
                    }`}
                >
                  <td className="py-4 px-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0
                        ? 'bg-yellow-500 text-black'
                        : index === 1
                          ? 'bg-gray-400 text-black'
                          : index === 2
                            ? 'bg-orange-600 text-white'
                            : 'bg-[#F0EBE3] text-gray-600'
                        }`}
                    >
                      {index + 1}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-[#2A2A2A]">
                    {team.name}
                  </td>
                  <td className="py-4 px-4 text-center text-[#B45330] font-bold">
                    {team.wins || 0}
                  </td>
                  <td className="py-4 px-4 text-center text-red-400 font-bold">
                    {team.losses || 0}
                  </td>
                  <td className="py-4 px-4 text-center text-gray-600">
                    {team.setsWon || 0}-{team.setsLost || 0}
                  </td>
                  <td className="py-4 px-4 text-center text-gray-600">
                    {(team.setsWon || 0) - (team.setsLost || 0) >= 0 ? '+' : ''}
                    {(team.setsWon || 0) - (team.setsLost || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Round Robin Matches */}
      <div className="relative z-10 bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-2xl">
        <h2 className="text-2xl font-bold text-[#2A2A2A] mb-6">All Matches</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournament.matches.map((match) => (
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
      </div>

      {/* Tournament Winner */}
      {tournament.completed && standings.length > 0 && (
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-3 bg-yellow-50 border border-yellow-400 text-yellow-800 px-6 py-3 rounded-full">
            <Trophy className="w-6 h-6" />
            <span className="text-xl font-bold">
              Champion: {standings[0].name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function EliminationBracket({
  tournament,
  onMatchSelect,
  selectedMatch,
  ...headerProps
}: ViewProps) {
  const maxRound =
    tournament.matches.length > 0
      ? Math.max(...tournament.matches.map((m) => m.round))
      : 0;
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] space-y-8 font-mono p-4 md:p-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#8B7355]/20 to-[#B45330]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-[#B45330]/20 to-[#8B7355]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      <TournamentHeader tournament={tournament} {...headerProps} />
      <div className="relative z-10 bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-6 shadow-2xl">
        <h2 className="text-2xl font-bold text-[#2A2A2A] mb-6 flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-400" />
          Tournament Bracket
        </h2>
        <div className="overflow-x-auto">
          <div className="flex gap-8 min-w-max pb-4">
            {rounds.map((round) => (
              <div
                key={round}
                className="flex flex-col justify-around space-y-6 min-w-64"
              >
                <h3 className="text-lg font-semibold text-center text-gray-700 mb-4">
                  {getRoundName(round, maxRound)}
                </h3>
                {tournament.matches
                  .filter((m) => m.round === round)
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
        {tournament.completed && tournament.winner && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-3 bg-yellow-50 border border-yellow-400 text-yellow-800 px-6 py-3 rounded-full">
              <Trophy className="w-6 h-6" />
              <span className="text-xl font-bold">
                Champion: {tournament.winner.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- CHILD COMPONENTS ---
export function MatchCard({
  match,
  onSelect,
  isSelected,
  tournament,
  isContestantView = false,
}: {
  match: Match;
  onSelect: () => void;
  isSelected: boolean;
  tournament?: Tournament;
  isContestantView?: boolean;
}) {
  const cardStyles = isSelected
    ? 'border-[#B45330] bg-[#B45330]/10'
    : match.completed
      ? 'border-[#D4C9BB] bg-[#FFFFFF]/50'
      : 'border-[#8B7355]/50 bg-[#FFFFFF]/50 hover:border-[#8B7355]';

  return (
    <div
      onClick={onSelect}
      className={`group border rounded-xl p-3 cursor-pointer transition-all duration-300 hover:shadow-2xl transform hover:-translate-y-1 ${cardStyles}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {match.groupId ? `GROUP MATCH` : `MATCH ${match.position + 1}`}
        </span>
        <div className="flex items-center gap-2">
          {match.courtId && tournament && (
            <span className="text-xs bg-[#F0EBE3] text-gray-600 px-2 py-1 rounded-full font-medium">
              {getCourtName(tournament, match.courtId)}
            </span>
          )}
          {match.completed ? (
            <CheckCircle className="w-4 h-4 text-[#B45330]" />
          ) : (
            <Clock className="w-4 h-4 text-[#8B7355]" />
          )}
        </div>
      </div>
      <div className="space-y-2">
        <div
          className={`flex items-center justify-between p-2 rounded-lg ${match.winner?.id === match.team1.id
            ? 'bg-[#B45330]/15'
            : 'bg-[#F0EBE3]/50'
            }`}
        >
          <span className="font-semibold text-[#2A2A2A]">{match.team1.name}</span>
          <span className="text-sm font-mono text-gray-600">
            {match.team1Score.sets > 0 || match.team2Score.sets > 0
              ? `${match.team1Score.sets}`
              : ''}
          </span>
        </div>
        <div
          className={`flex items-center justify-between p-2 rounded-lg ${match.winner?.id === match.team2.id
            ? 'bg-[#B45330]/15'
            : 'bg-[#F0EBE3]/50'
            }`}
        >
          <span className="font-semibold text-[#2A2A2A]">{match.team2.name}</span>
          <span className="text-sm font-mono text-gray-600">
            {match.team1Score.sets > 0 || match.team2Score.sets > 0
              ? `${match.team2Score.sets}`
              : ''}
          </span>
        </div>
      </div>
      <div className="mt-3 text-center">
        {!isContestantView && match.schedule?.scheduledTime && (
          <span className="inline-block bg-[#8B7355]/15 text-[#A89070] px-2 py-1 rounded text-xs font-medium">
            ⏰ {formatScheduledTime(match.schedule.scheduledTime)}
          </span>
        )}
        {!match.completed &&
          match.team1.name !== 'TBD' &&
          match.team2.name !== 'TBD' &&
          !isContestantView && (
            <span className="inline-block bg-[#F0EBE3] text-gray-600 px-3 py-1 rounded-full text-xs font-semibold group-hover:bg-[#D4C9BB] transition-all mt-2">
              Click to Manage
            </span>
          )}
      </div>
    </div>
  );
}

export function getRoundName(round: number, maxRound: number): string {
  if (round > maxRound) return `Round ${round}`;
  const roundsFromEnd = maxRound - round;
  switch (roundsFromEnd) {
    case 0:
      return 'Final';
    case 1:
      return 'Semi-Final';
    case 2:
      return 'Quarter-Final';
    default:
      return `Round ${round}`;
  }
}
