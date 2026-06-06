import React, { useState, useEffect } from 'react';
import { Monitor, Trophy, Maximize, Minimize } from 'lucide-react';
import { Match } from '../types/tournament';
import { realTimeUpdates, MatchUpdateData } from '../utils/realTimeUpdates';
import { getRacePointDisplay, isGoldenPoint } from '../utils/raceScoring';
import { getTournamentSponsors, SponsorSlot } from '../utils/sponsors';
import { subscribeToScoreUpdates } from '../utils/storage';

// --- INTERFACES ---
interface StandaloneSpectatorViewProps {
  matchId: string;
  tournamentName?: string;
  tournamentId?: string;
}

interface SetHistory {
  setNumber: number;
  team1Games: number;
  team2Games: number;
  winner: 'team1' | 'team2';
  completed: boolean;
}

// --- KOMPONEN UTAMA ---
export default function StandaloneSpectatorView({ matchId, tournamentName = "PADEL TOURNAMENT", tournamentId }: StandaloneSpectatorViewProps) {
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [setHistory, setSetHistory] = useState<SetHistory[]>([]);
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

  const raceTarget = currentMatch?.raceTarget || 4;

  useEffect(() => {
    const initialMatch = realTimeUpdates.getCurrentMatchData(matchId);
    if (initialMatch) {
      setCurrentMatch(initialMatch);
      setIsConnected(true);

      // Reconstruct set history from initial match data
      if (initialMatch.team1Score.sets > 0 || initialMatch.team2Score.sets > 0) {
        const existingSets: SetHistory[] = [];

        for (let i = 1; i < initialMatch.currentSet; i++) {
          const setWinner = i <= initialMatch.team1Score.sets ? 'team1' : 'team2';
          existingSets.push({
            setNumber: i,
            team1Games: setWinner === 'team1' ? 6 : 4,
            team2Games: setWinner === 'team2' ? 6 : 4,
            winner: setWinner,
            completed: true
          });
        }
        setSetHistory(existingSets);
      }
    }

    // Local same-device updates
    const unsubscribeLocal = realTimeUpdates.subscribeToMatch(matchId, (data: MatchUpdateData) => {
      setCurrentMatch(data.match);
      setLastUpdate(`${data.action} at ${new Date(data.timestamp).toLocaleTimeString()}`);
      setIsConnected(true);

      // Update set history if match progressed to a new set
      if (data.action === 'Set Win' && data.match.currentSet > (setHistory.length + 1)) {
        const lastSetNumber = data.match.currentSet - 1;
        const lastSet = data.match.setHistory?.find(s => s.setNumber === lastSetNumber);
        if (lastSet) {
          setSetHistory(prev => [...prev, lastSet]);
        }
      }
    });

    // Cross-device updates via Supabase Broadcast
    const unsubscribeBroadcast = tournamentId
      ? subscribeToScoreUpdates(tournamentId, (updatedMatch) => {
          if (updatedMatch.id === matchId) {
            setCurrentMatch(updatedMatch);
            setIsConnected(true);
          }
        })
      : null;

    return () => {
      unsubscribeLocal();
      unsubscribeBroadcast?.();
    };
  }, [matchId, tournamentId]);


  // Layar Tunggu (Loading Screen)
  if (!currentMatch) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] font-mono flex items-center justify-center p-4">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        <div className="relative text-center bg-white/80 backdrop-blur-lg border border-[#F0EBE3] rounded-2xl p-12 shadow-2xl shadow-black/50">
          <Monitor className="w-16 h-16 mx-auto mb-6 text-[#B45330] animate-pulse" />
          <h1 className="text-2xl font-bold mb-2 text-[#2A2A2A]">Awaiting Match Transmission...</h1>
          <p className="text-gray-600">
            {isConnected ? 'Connection established. Waiting for match to begin.' : 'Initializing live connection...'}
          </p>
          <div className="w-full bg-[#F0EBE3] h-1 mt-6 rounded-full overflow-hidden">
            <div className="bg-[#B45330] h-1 rounded-full w-1/3 animate-[shimmer_2s_infinite]" style={{ animation: 'shimmer 2s infinite' }}></div>
          </div>
        </div>
        <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
      </div>
    );
  }

  // --- RACE MODE SCOREBOARD ---
  const goldenPoint = isGoldenPoint(currentMatch);
  return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] font-mono flex flex-col">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>

        <header className="relative z-10 flex justify-between items-center p-6 border-b border-[#F0EBE3]">
          <div className="flex items-center gap-3">
            <Monitor className="w-8 h-8 text-[#B45330]" />
            <span className="text-2xl font-bold text-[#B45330]">SPECTATOR VIEW</span>
            {isConnected && <div className="w-3 h-3 bg-[#B45330] rounded-full animate-pulse" title="Live connected" />}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">Match ID: {matchId}</div>
              <div className="text-xs text-gray-500">Auto-refreshing</div>
            </div>
            <button onClick={toggleFullscreen} className="p-2 bg-[#F0EBE3] hover:bg-[#D4C9BB] text-[#2A2A2A] rounded-lg transition-colors cursor-pointer z-50">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <main className="relative z-10 flex-1 flex flex-col justify-center px-4 md:px-8">
          <div className="text-center mb-6">
            <div className="text-[#B45330] text-4xl font-bold tracking-wider mb-2">{tournamentName?.toUpperCase()}</div>
            <div className="text-gray-600 text-lg">{currentMatch?.gamesFixed ? `BEST OF ${currentMatch.gamesFixed}` : `RACE TO ${raceTarget}`}</div>
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

          <div className={`bg-[#FFFFFF] rounded-2xl overflow-hidden border max-w-6xl mx-auto w-full ${goldenPoint ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.3)]' : 'border-[#8B7355] shadow-neon-purple'}`}>
            {/* Header */}
            <div className="grid grid-cols-3 bg-[#F0EBE3] text-center py-4">
              <div className="text-2xl font-bold text-gray-400"></div>
              <div className="text-2xl font-bold text-[#B45330]">GAMES</div>
              <div className={`text-2xl font-bold ${goldenPoint ? 'bg-yellow-400 text-black' : 'bg-[#B45330] text-[#FAF8F5]'} rounded-tr-xl`}>POINT</div>
            </div>

            {/* Team 1 */}
            <div className="grid grid-cols-3 border-b border-[#F0EBE3]">
              <div className="p-6 flex items-center gap-3">
                <div className="text-4xl font-bold text-[#2A2A2A] uppercase">{currentMatch.team1.name}</div>
              </div>
              <div className="p-6 text-center text-4xl font-bold flex items-center justify-center">{currentMatch.team1RaceScore || 0}</div>
              <div className={`p-6 text-center text-6xl font-bold flex items-center justify-center ${currentMatch.isTiebreaker ? 'bg-blue-500 text-white' : goldenPoint ? 'bg-yellow-400 text-black' : 'bg-[#B45330] text-[#FAF8F5]'}`}>
                {currentMatch.isTiebreaker
                  ? (currentMatch.tiebreakPoints?.team1 || 0)
                  : getRacePointDisplay(currentMatch.team1Score.points)}
              </div>
            </div>

            {/* Team 2 */}
            <div className="grid grid-cols-3">
              <div className="p-6 flex items-center gap-3">
                <div className="text-4xl font-bold text-[#2A2A2A] uppercase">{currentMatch.team2.name}</div>
              </div>
              <div className="p-6 text-center text-4xl font-bold flex items-center justify-center">{currentMatch.team2RaceScore || 0}</div>
              <div className={`p-6 text-center text-6xl font-bold flex items-center justify-center ${currentMatch.isTiebreaker ? 'bg-blue-500 text-white' : goldenPoint ? 'bg-yellow-400 text-black' : 'bg-[#B45330] text-[#FAF8F5]'}`}>
                {currentMatch.isTiebreaker
                  ? (currentMatch.tiebreakPoints?.team2 || 0)
                  : getRacePointDisplay(currentMatch.team2Score.points)}
              </div>
            </div>
          </div>

          <footer className="text-center mt-8">
            {currentMatch.completed && (
              <div className="text-4xl font-bold text-[#B45330] mb-4 flex items-center justify-center gap-3 animate-pulse-glow">
                <Trophy className="w-8 h-8" /> WINNER: {currentMatch.winner?.name}
                <span className="text-2xl text-gray-400 ml-4">
                  {currentMatch.team1RaceScore} - {currentMatch.team2RaceScore}
                </span>
              </div>
            )}
            {lastUpdate && (
              <div className="text-sm text-gray-600 bg-white border border-[#F0EBE3] rounded-lg p-3 inline-block">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#B45330] rounded-full animate-pulse"></div>
                  Last update: {lastUpdate}
                </div>
              </div>
            )}
          </footer>
        </main>

        {/* Sponsor Bar */}
        <div className="relative z-10 h-24 bg-white border-t-2 border-[#B45330] flex items-center justify-center px-8">
          <div className="flex justify-center items-center gap-10">
            {[1, 2, 3].map((pos) => {
              const s = sponsors.find((sp) => sp.position === pos);
              return (
                <div key={pos} className="bg-[#F0EBE3] rounded-lg p-2 border border-[#8B7355]">
                  <div className="w-28 h-14 bg-[#FAF8F5] rounded flex items-center justify-center overflow-hidden">
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

// FUNGSI UNTUK MEMBUKA JENDELA BARU
export function openSpectatorWindow(matchId: string, tournamentName?: string, tournamentId?: string) {
  const params = new URLSearchParams({
    matchId,
    ...(tournamentName && { tournamentName }),
    ...(tournamentId && { tournamentId }),
  });

  const url = `${window.location.origin}/spectator?${params}`;

  const spectatorWindow = window.open(
    url,
    `spectator-${matchId}`,
    'width=1200,height=800,resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no'
  );

  if (!spectatorWindow) {
    navigator.clipboard?.writeText(url).then(() => {
      alert('Spectator view URL copied to clipboard! Open it in a new tab.');
    }).catch(() => {
      prompt('Copy this URL to open spectator view:', url);
    });
  }

  return spectatorWindow;
}