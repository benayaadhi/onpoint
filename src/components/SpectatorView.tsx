import React, { useState, useEffect } from 'react';
import { Monitor, X, Maximize, Minimize } from 'lucide-react';
import { Match } from '../types/tournament';
import { realTimeUpdates, MatchUpdateData } from '../utils/realTimeUpdates';
import { getRacePointDisplay, isGoldenPoint } from '../utils/raceScoring';
import { getTournamentSponsors, SponsorSlot } from '../utils/sponsors';
import { subscribeToScoreUpdates } from '../utils/storage';

interface SpectatorViewProps {
  match: Match;
  onClose: () => void;
  tournamentName?: string;
  tournamentId?: string;
  setHistory: Array<{
    setNumber: number;
    team1Games: number;
    team2Games: number;
    winner: 'team1' | 'team2';
    completed: boolean;
  }>;
}

export default function SpectatorView({
  match,
  onClose,
  tournamentName = 'PADEL TOURNAMENT',
  tournamentId,
  setHistory,
}: SpectatorViewProps) {
  const [currentMatch, setCurrentMatch] = useState<Match>(match);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sponsors, setSponsors] = useState<SponsorSlot[]>([]);

  useEffect(() => {
    if (tournamentId) {
      getTournamentSponsors(tournamentId).then(setSponsors);
    }
  }, [tournamentId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const raceTarget = currentMatch.raceTarget || 4;

  useEffect(() => {
    setCurrentMatch(match);

    // Local same-device updates
    const unsubscribeLocal = realTimeUpdates.subscribeToMatch(
      match.id,
      (data: MatchUpdateData) => {
        setCurrentMatch(data.match);
        setLastUpdate(
          `${data.action} at ${new Date(data.timestamp).toLocaleTimeString()}`
        );
      }
    );

    // Cross-device updates via Supabase Broadcast
    const unsubscribeBroadcast = tournamentId
      ? subscribeToScoreUpdates(tournamentId, (updatedMatch) => {
          if (updatedMatch.id === match.id) {
            setCurrentMatch(updatedMatch);
          }
        })
      : null;

    return () => {
      unsubscribeLocal();
      unsubscribeBroadcast?.();
    };
  }, [match.id, tournamentId]);

  useEffect(() => {
    setCurrentMatch(match);
  }, [match]);

  // --- RACE MODE SCOREBOARD ---
  const goldenPoint = isGoldenPoint(currentMatch);
  return (
      <div className="fixed inset-0 bg-[#FAF8F5] text-[#2A2A2A] z-50 flex flex-col font-mono">
        <div className="flex justify-between items-center p-4 border-b border-[#F0EBE3]">
          <div className="flex items-center gap-3">
            <Monitor className="w-6 h-6 text-[#B45330]" />
            <span className="text-lg font-bold text-[#B45330]">SPECTATOR VIEW</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleFullscreen} className="p-2 bg-[#F0EBE3] hover:bg-[#D4C9BB] text-[#2A2A2A] rounded-lg transition-colors cursor-pointer z-50">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="bg-[#FF416C] hover:bg-[#E03A5F] p-2 rounded-full">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-4">
          <div className="text-center mb-6">
            <div className="text-[#B45330] text-5xl font-bold tracking-wider mb-2">
              {tournamentName?.toUpperCase()}
            </div>
            <div className="text-gray-600 text-3xl">RACE TO {raceTarget}</div>
          </div>

          {/* Golden Point Banner */}
          {goldenPoint && !currentMatch.isTiebreaker && (
            <div className="mb-6 py-4 px-8 bg-gradient-to-r from-yellow-500/20 via-yellow-400/30 to-yellow-500/20 border-2 border-yellow-400/60 rounded-2xl text-center animate-pulse mx-auto max-w-2xl w-full">
              <span className="text-4xl font-black text-yellow-700 tracking-wider">⚡ GOLDEN POINT ⚡</span>
            </div>
          )}

          {/* Tiebreak Banner */}
          {currentMatch.isTiebreaker && (
            <div className="mb-6 py-4 px-8 bg-gradient-to-r from-blue-500/20 via-blue-400/30 to-blue-500/20 border-2 border-blue-400/60 rounded-2xl text-center animate-pulse mx-auto max-w-2xl w-full">
              <span className="text-4xl font-black text-blue-600 tracking-wider">🎾 TIEBREAK</span>
            </div>
          )}

          <div className={`bg-[#FFFFFF] rounded-3xl overflow-hidden shadow-neon mx-auto w-full max-w-5xl ${goldenPoint ? 'border-2 border-yellow-400' : 'border-2 border-[#8B7355]'}`}>
            {/* Header */}
            <div className="grid grid-cols-3 bg-[#F0EBE3] text-center py-6">
              <div className="text-3xl font-bold text-gray-600"></div>
              <div className="text-3xl font-bold text-[#B45330]">GAMES</div>
              <div className={`text-3xl font-bold ${goldenPoint ? 'bg-yellow-400 text-black' : 'bg-[#B45330] text-[#FAF8F5]'} rounded-tr-3xl`}>POINT</div>
            </div>

            {/* Team 1 */}
            <div className="grid grid-cols-3 border-b-2 border-[#F0EBE3]">
              <div className="p-10 flex items-center gap-6 bg-[#FFFFFF]">
                <div className="text-6xl font-bold text-[#2A2A2A] uppercase">{currentMatch.team1.name}</div>
              </div>
              <div className="p-10 text-center text-8xl font-bold flex items-center justify-center text-[#2A2A2A]">
                {currentMatch.team1RaceScore || 0}
              </div>
              <div className={`p-10 text-center text-9xl font-bold flex items-center justify-center ${currentMatch.isTiebreaker ? 'bg-blue-500 text-white' : goldenPoint ? 'bg-yellow-400 text-black' : 'bg-[#B45330] text-[#FAF8F5]'}`}>
                {currentMatch.isTiebreaker
                  ? (currentMatch.tiebreakPoints?.team1 || 0)
                  : getRacePointDisplay(currentMatch.team1Score.points)}
              </div>
            </div>

            {/* Team 2 */}
            <div className="grid grid-cols-3">
              <div className="p-10 flex items-center gap-6 bg-[#FFFFFF]">
                <div className="text-6xl font-bold text-[#2A2A2A] uppercase">{currentMatch.team2.name}</div>
              </div>
              <div className="p-10 text-center text-8xl font-bold flex items-center justify-center text-[#2A2A2A]">
                {currentMatch.team2RaceScore || 0}
              </div>
              <div className={`p-10 text-center text-9xl font-bold flex items-center justify-center rounded-br-3xl ${currentMatch.isTiebreaker ? 'bg-blue-500 text-white' : goldenPoint ? 'bg-yellow-400 text-black' : 'bg-[#B45330] text-[#FAF8F5]'}`}>
                {currentMatch.isTiebreaker
                  ? (currentMatch.tiebreakPoints?.team2 || 0)
                  : getRacePointDisplay(currentMatch.team2Score.points)}
              </div>
            </div>
          </div>

          {/* Winner / Update */}
          <div className="text-center mt-8">
            {currentMatch.completed && (
              <div className="text-4xl font-bold text-[#B45330] mb-4 flex items-center justify-center gap-4">
                <span className="text-5xl">🏆</span> WINNER: {currentMatch.winner?.name}
                <span className="text-2xl text-gray-400 ml-4">
                  {currentMatch.team1RaceScore} - {currentMatch.team2RaceScore}
                </span>
              </div>
            )}
            {lastUpdate && (
              <div className="text-lg text-gray-600 bg-white rounded-lg p-3 inline-block border border-[#F0EBE3]">
                Last update: {lastUpdate}
              </div>
            )}
          </div>
        </div>

        {/* Sponsor Space */}
        <div className="h-32 bg-[#FFFFFF] border-t-2 border-[#B45330] flex items-center justify-center px-8">
          <div className="flex justify-center items-center gap-12">
            {[1, 2, 3].map((pos) => {
              const s = sponsors.find((sp) => sp.position === pos);
              return (
                <div key={pos} className="bg-[#F0EBE3] rounded-lg p-3 border border-[#8B7355]">
                  <div className="w-32 h-16 bg-[#FAF8F5] rounded flex items-center justify-center overflow-hidden">
                    {s?.logo_url ? (
                      <img src={s.logo_url} alt={`Sponsor ${pos}`} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[#B45330] text-xs font-mono">SPONSOR {pos}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
  );
}
