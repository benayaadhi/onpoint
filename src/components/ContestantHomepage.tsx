import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, Clock, Target, ArrowRight, Signal, Loader2, Monitor, Tv, ExternalLink, Copy } from 'lucide-react';
import { Tournament } from '../types/tournament';
import { getTournaments, subscribeTournaments } from '../utils/storage';
import { slugify } from '../utils/slugify';

interface ContestantHomepageProps {
  onSelectTournament: (tournament: Tournament) => void;
  onBackToHome: () => void;
}

export default function ContestantHomepage({ onSelectTournament, onBackToHome }: ContestantHomepageProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTournaments()
      .then((data) => {
        setTournaments(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load tournaments:', err);
        setLoading(false);
      });

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeTournaments((updated) => {
        setTournaments(updated);
      });
    } catch (err) {
      console.error('Failed to subscribe to tournaments:', err);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const activeTournaments = tournaments.filter(t => !t.completed);
  const completedTournaments = tournaments.filter(t => t.completed);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#B45330]" />
      </div>
    );
  }

  // Fungsi status yang disederhanakan untuk kejelasan
  const getTournamentStatus = (tournament: Tournament) => {
    const inProgressMatches = tournament.matches.filter(m => m.status === 'in-progress').length;

    if (tournament.completed) {
      return { key: 'completed', text: 'Completed' };
    }
    if (inProgressMatches > 0) {
      return { key: 'live', text: 'Live' };
    }
    if (tournament.matches.some(m => m.completed)) {
      return { key: 'inProgress', text: 'In Progress' };
    }
    return { key: 'startingSoon', text: 'Starting Soon' };
  };

  const getProgressPercentage = (tournament: Tournament) => {
    const totalMatches = tournament.matches.filter(m => m.team1.name !== 'TBD' && m.team2.name !== 'TBD').length;
    if (totalMatches === 0) return 0;
    const completedMatches = tournament.matches.filter(m => m.completed).length;
    return Math.round((completedMatches / totalMatches) * 100);
  };

  const StatusPill = ({ statusKey, statusText }: { statusKey: string, statusText: string }) => {
    let styles = '';
    switch (statusKey) {
      case 'live':
        styles = 'bg-[#B45330]/10 text-[#B45330] border-[#B45330]/50 animate-pulse';
        break;
      case 'inProgress':
        styles = 'bg-[#8B7355]/10 text-[#A89070] border-[#8B7355]/50';
        break;
      case 'completed':
        styles = 'bg-[#F0EBE3] text-gray-600 border-[#D4C9BB]';
        break;
      default: // startingSoon
        styles = 'bg-[#F0EBE3] text-gray-600 border-[#D4C9BB]';
    }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${styles}`}>
        {statusText}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2A2A2A] font-mono overflow-x-hidden">
      {/* Background Grid & Blurs */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#8B7355]/20 to-[#B45330]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-[#B45330]/20 to-[#8B7355]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-6 border-b border-[#F0EBE3]/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFFFFF] rounded-lg flex items-center justify-center border border-[#F0EBE3]"><Target className="w-6 h-6 text-[#B45330]" /></div>
            <div>
              <span className="font-display text-2xl font-bold tracking-[0.12em]"><span style={{ color: '#C9952F' }}>ON</span><span className="text-[#2A2A2A]">POINT</span></span>
              <div className="text-sm text-gray-600">Tournament Viewer</div>
            </div>
          </div>
          <button onClick={onBackToHome} className="border border-[#8B7355] text-[#8B7355] px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 hover:bg-[#8B7355]/10 hover:border-[#8B7355]">
            Back to Home
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-display text-5xl lg:text-6xl font-bold uppercase tracking-tight text-[#2A2A2A] mb-6">
              Live <span className="bg-gradient-to-r from-[#B45330] to-[#C96A40] bg-clip-text text-transparent">Tournaments</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">Follow your favorite padel tournaments in real-time. Watch live matches, check standings, and never miss a point.</p>
          </div>

          {/* Active Tournaments */}
          {activeTournaments.length > 0 && (
            <section className="mb-16">
              <h2 className="text-3xl font-bold text-[#2A2A2A] mb-8 flex items-center gap-3">
                <Signal className="text-[#B45330] animate-pulse" /> Active Tournaments
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {activeTournaments.map(tournament => {
                  const status = getTournamentStatus(tournament);
                  const progress = getProgressPercentage(tournament);
                  const liveMatches = tournament.matches.filter(m => m.status === 'in-progress').length;
                  const cardStyle = status.key === 'live'
                    ? 'border-[#B45330] animate-pulse-glow shadow-neon-green'
                    : 'border-[#F0EBE3] hover:border-[#8B7355]';

                  const hasCourts = tournament.courts && tournament.courts.length > 0;
                  const tournamentSlug = tournament.slug || slugify(tournament.name);
                  const tvUrl = `${window.location.origin}/tv/${tournament.id}`;

                  return (
                    <div key={tournament.id} className={`group bg-white border rounded-2xl p-6 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-md ${cardStyle}`}>
                      <div
                        className="cursor-pointer"
                        onClick={() => onSelectTournament(tournament)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-[#2A2A2A] mb-2">{tournament.name}</h3>
                            <div className="flex items-center gap-2 mb-2">
                              <StatusPill statusKey={status.key} statusText={status.text} />
                              {liveMatches > 0 && <span className="px-2 py-1 bg-[#B45330] text-white rounded-full text-xs font-bold">{liveMatches} LIVE</span>}
                            </div>
                          </div>
                          <Trophy className="w-6 h-6 text-yellow-500/50 group-hover:text-yellow-500 transition-colors" />
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Format:</span><span className="text-[#2A2A2A] font-medium capitalize">{tournament.format.replace('-', ' ')}</span></div>
                          <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Teams:</span><span className="text-[#2A2A2A] font-medium">{tournament.teams.length}</span></div>
                          <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Progress:</span><span className="text-[#2A2A2A] font-medium">{progress}%</span></div>
                        </div>

                        <div className="w-full bg-[#F0EBE3] rounded-full h-2 mb-4"><div className="bg-gradient-to-r from-[#B45330] to-[#C96A40] h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div></div>

                        <div className="flex items-center justify-end text-[#B45330]/50 group-hover:text-[#B45330] transition-colors mb-3">
                          <span className="text-sm font-medium">View Tournament</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      <div className="relative z-10 border-t border-[#F0EBE3] pt-3" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs font-bold text-[#2A2A2A] flex items-center gap-1.5 mb-2">
                            <Tv className="w-3 h-3 text-[#B45330]" /> TV Display Links
                          </p>
                          {hasCourts ? (
                            <div className="flex flex-col gap-1.5">
                              {tournament.courts.map((court, idx) => {
                                const courtSlug = court.slug || slugify(court.name);
                                const url = `${window.location.origin}/tv/${tournamentSlug}/${courtSlug}`;
                                return (
                                  <div key={court.id} className="flex items-center justify-between gap-2 bg-[#FAF8F5] border border-[#F0EBE3] rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${court.currentMatch ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                                      <span className="text-xs font-semibold text-[#2A2A2A] truncate">{court.name}</span>
                                      {court.currentMatch && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">LIVE</span>}
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <button
                                        onClick={() => navigator.clipboard.writeText(url)}
                                        className="p-1.5 text-gray-400 hover:text-[#B45330] hover:bg-[#B45330]/10 rounded-lg transition-colors"
                                        title="Copy URL"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-gray-400 hover:text-[#B45330] hover:bg-[#B45330]/10 rounded-lg transition-colors"
                                        title="Open TV display"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <a
                              href="/tv"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F0EBE3] hover:bg-[#B45330] text-[#8B7355] hover:text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              <Monitor className="w-3 h-3" /> Open TV Display
                            </a>
                          )}
                        </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Completed Tournaments */}
          {completedTournaments.length > 0 && (
            <section className="mb-12 opacity-70">
              <h2 className="text-3xl font-bold text-[#2A2A2A] mb-8 flex items-center gap-3"><Trophy className="w-8 h-8 text-gray-500" /> Completed Tournaments</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedTournaments.map(tournament => (
                  <div key={tournament.id} onClick={() => onSelectTournament(tournament)} className="group bg-white border border-[#F0EBE3] rounded-2xl p-6 hover:border-[#D4C9BB] hover:shadow-sm transition-all duration-300 cursor-pointer">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-700 mb-2">{tournament.name}</h3>
                        <StatusPill statusKey="completed" statusText="Completed" />
                      </div>
                      <Trophy className="w-6 h-6 text-gray-400" />
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Champion:</span><span className="text-[#2A2A2A] font-bold">{tournament.winner?.name || 'N/A'}</span></div>
                      <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Teams:</span><span className="text-[#2A2A2A] font-medium">{tournament.teams.length}</span></div>
                    </div>
                    <div className="flex items-center justify-end text-gray-500 group-hover:text-[#2A2A2A] transition-colors">
                      <span className="text-sm font-medium">View Results</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ... (Empty State & Quick Stats - dapat di-style serupa) ... */}

        </div>
      </main>
    </div>
  );
}