import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Maximize, Minimize, Monitor, Trophy, Tv, ArrowLeft, Target } from 'lucide-react';
import { Tournament, Match, Court, Group, AdItem } from '../types/tournament';
import { getTournaments, getTournament, subscribeTournaments, subscribeTournamentChanges, subscribeToScoreUpdates } from '../utils/storage';
import { realTimeUpdates, MatchUpdateData } from '../utils/realTimeUpdates';
import { getRacePointDisplay, isGoldenPoint } from '../utils/raceScoring';
import { getTournamentSponsors, SponsorSlot } from '../utils/sponsors';
import { getNetworkAds } from '../utils/ads';
import { canOwnAds, canOwnSponsors, isNetworkAdTier } from '../utils/tier';
import { calculateGroupStandings } from '../utils/tournamentLogic';

// ─── Ad Player — YouTube-style, not skippable ─────────────────────────────────
// Plays the playlist full-screen. Images run durationSec (default 8s); videos
// always play to completion (only a load-failure skips one, so a broken file
// can't freeze the TV). `single` shows one ad then calls onCycleDone — used
// for the automatic between-games break; the manual Break cycles until resumed.

function AdPlayer({ ads, single, onCycleDone, scoreStrip }: {
  ads: AdItem[];
  single?: boolean;
  onCycleDone?: () => void;
  scoreStrip?: React.ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const ad = ads[idx % ads.length];

  const advance = React.useCallback(() => {
    setIdx((i) => {
      if (single || i + 1 >= ads.length) onCycleDone?.();
      return (i + 1) % ads.length;
    });
  }, [ads.length, single, onCycleDone]);

  // Image timer
  useEffect(() => {
    if (!ad || ad.type !== 'image') return;
    const t = setTimeout(advance, (ad.durationSec ?? 8) * 1000);
    return () => clearTimeout(t);
  }, [ad, advance]);

  if (!ad) return null;
  return (
    <div className="min-h-screen bg-black font-mono relative flex items-center justify-center">
      {ad.type === 'video' ? (
        <video
          key={ad.id + idx}
          src={ad.url}
          autoPlay
          muted
          playsInline
          onEnded={advance}
          onError={advance}
          className="w-full h-screen object-contain"
        />
      ) : (
        <img key={ad.id + idx} src={ad.url} alt="" className="w-full h-screen object-contain" onError={advance} />
      )}
      <div className="absolute bottom-4 right-4 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded">
        AD
      </div>
      {scoreStrip}
    </div>
  );
}

// Slim live-score bar shown on top of ads during a mid-match break, so the
// score never disappears even while an ad is playing.
function AdScoreStrip({ match, court }: { match: Match; court: Court }) {
  const isRace = match.scoringMode === 'race';
  const s1 = isRace ? match.team1RaceScore ?? 0 : match.team1Score.games;
  const s2 = isRace ? match.team2RaceScore ?? 0 : match.team2Score.games;
  return (
    <div className="absolute top-0 inset-x-0 bg-black/80 backdrop-blur text-white flex items-center justify-center gap-4 py-2 px-4 text-sm md:text-lg font-bold">
      <span className="text-[#C96A40] uppercase tracking-widest text-xs md:text-sm">{court.name} · BREAK</span>
      <span className="truncate max-w-[30%]">{match.team1.name}</span>
      <span className="text-[#C96A40]">{s1} – {s2}</span>
      <span className="truncate max-w-[30%]">{match.team2.name}</span>
    </div>
  );
}

// ─── Waiting Screen — shows standings while no match active ──────────────────

function WaitingScreen({ court, tournament, nextMatch }: {
  court: Court;
  tournament: Tournament;
  nextMatch: Match | null;
}) {
  const isGroupKnockout = tournament.format === 'group-knockout';
  const groups: Group[] = tournament.groups ?? [];

  // Knockout is active when group stage is done (or format is pure elimination)
  const isKnockoutActive = isGroupKnockout
    ? !tournament.groupStage
    : tournament.format === 'single-elimination';

  // For round-robin: calculate standings
  const rrStandings = tournament.format === 'round-robin'
    ? [...tournament.teams]
        .map(team => ({
          ...team,
          wins: tournament.matches.filter(m => m.completed && m.winner?.id === team.id).length,
          losses: tournament.matches.filter(m => m.completed && m.winner && m.winner.id !== team.id && (m.team1.id === team.id || m.team2.id === team.id)).length,
        }))
        .sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0))
    : [];

  // Shared background
  const bg = (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#B45330]/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-[#8B7355]/10 rounded-full blur-3xl animate-pulse delay-1000" />
    </>
  );

  // ── Knockout idle screen ────────────────────────────────────────────────────
  if (isKnockoutActive) {
    const hasNext = nextMatch && nextMatch.team1.name !== 'TBD' && nextMatch.team2.name !== 'TBD';

    // Determine round label for next match
    const knockoutMatches = tournament.matches.filter(m => !m.groupId);
    const maxRound = knockoutMatches.length > 0
      ? Math.max(...knockoutMatches.map(m => m.round))
      : 0;
    const getRoundLabel = (round: number) => {
      if (round === maxRound) return 'Final';
      if (round === maxRound - 1) return 'Semifinal';
      if (round === maxRound - 2) return 'Quarterfinal';
      return `Round ${round}`;
    };

    return (
      <div className="min-h-screen bg-[#0e0a08] font-mono flex flex-col items-center justify-center relative overflow-hidden">
        {bg}

        <div className="relative z-10 text-center px-8 w-full max-w-3xl mx-auto">
          {/* Court + tournament */}
          <div className="text-[#B45330] text-xl font-bold tracking-[0.3em] uppercase mb-1">{court.name}</div>
          <div className="text-white/40 text-sm tracking-widest uppercase mb-2">{tournament.name}</div>
          <div className="inline-flex items-center gap-2 bg-[#B45330]/20 border border-[#B45330]/40 text-[#B45330] text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-16">
            <Target className="w-3 h-3" /> Knockout Stage
          </div>

          {hasNext ? (
            <>
              <div className="text-white/40 text-sm font-bold uppercase tracking-[0.4em] mb-6">Up Next</div>
              <div className="text-[#B45330] text-base font-bold uppercase tracking-widest mb-8">
                {getRoundLabel(nextMatch!.round)}
              </div>

              {/* Team vs Team — big */}
              <div className="flex items-center justify-center gap-6 md:gap-12 mb-12">
                <div className="flex-1 text-right">
                  <div className="text-4xl md:text-6xl font-black text-white uppercase leading-tight">
                    {nextMatch!.team1.name}
                  </div>
                </div>
                <div className="flex-shrink-0 text-2xl md:text-4xl font-black text-white/20">VS</div>
                <div className="flex-1 text-left">
                  <div className="text-4xl md:text-6xl font-black text-white uppercase leading-tight">
                    {nextMatch!.team2.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-white/20">
                <Monitor className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Waiting for match to start</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-7xl mb-8 opacity-20">🏆</div>
              <div className="text-white/30 text-2xl font-bold mb-3">Standing by</div>
              <div className="flex items-center justify-center gap-2 text-white/20">
                <Monitor className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Waiting for next match</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Group stage / round-robin idle screen ───────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF8F5] font-mono flex flex-col relative overflow-hidden">
      {bg}

      <div className="relative z-10 flex flex-col flex-1 px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-[#B45330] text-xl font-bold tracking-[0.3em] uppercase mb-1">
            {court.name}
          </div>
          <div className="text-4xl md:text-5xl font-black text-[#2A2A2A] tracking-tight">
            {tournament.name.toUpperCase()}
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Monitor className="w-5 h-5 text-gray-400 animate-pulse" />
            <span className="text-gray-400 text-base">Waiting for next match</span>
          </div>
        </div>

        {/* Up Next */}
        {nextMatch && nextMatch.team1.name !== 'TBD' && nextMatch.team2.name !== 'TBD' && (
          <div className="bg-white/90 border border-[#B45330]/30 rounded-2xl p-6 mb-8 max-w-lg mx-auto w-full text-center shadow-lg">
            <div className="text-xs text-[#B45330] font-bold uppercase tracking-widest mb-3">Up Next</div>
            <div className="text-2xl font-black text-[#2A2A2A]">{nextMatch.team1.name}</div>
            <div className="text-gray-400 text-sm my-1">VS</div>
            <div className="text-2xl font-black text-[#2A2A2A]">{nextMatch.team2.name}</div>
          </div>
        )}

        {/* Group standings */}
        {isGroupKnockout && groups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto w-full">
            {groups.map(group => {
              const standings = calculateGroupStandings(group, tournament.matches);
              return (
                <div key={group.id} className="bg-white/80 backdrop-blur border border-[#F0EBE3] rounded-2xl p-5 shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span className="font-bold text-[#2A2A2A] text-sm">{group.name}</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {standings.map((team, idx) => (
                        <tr key={team.id} className={idx < standings.length - 1 ? 'border-b border-[#F0EBE3]' : ''}>
                          <td className="py-1.5 pr-2">
                            <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-[#8B7355] text-white' : 'bg-[#F0EBE3] text-gray-400'}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-1.5 font-semibold text-[#2A2A2A] flex-1">{team.name}</td>
                          <td className="py-1.5 text-center text-[#B45330] font-bold">{team.wins ?? 0}W</td>
                          <td className="py-1.5 text-center text-gray-400">{team.losses ?? 0}L</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* Round-robin standings */}
        {rrStandings.length > 0 && (
          <div className="bg-white/80 backdrop-blur border border-[#F0EBE3] rounded-2xl p-6 max-w-lg mx-auto w-full shadow">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="font-bold text-[#2A2A2A]">Standings</span>
            </div>
            <table className="w-full">
              <tbody>
                {rrStandings.map((team, idx) => (
                  <tr key={team.id} className={idx < rrStandings.length - 1 ? 'border-b border-[#F0EBE3]' : ''}>
                    <td className="py-2 pr-3">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-black' : 'bg-[#F0EBE3] text-gray-400'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-2 font-semibold text-[#2A2A2A]">{team.name}</td>
                    <td className="py-2 text-center text-[#B45330] font-bold">{team.wins}W</td>
                    <td className="py-2 text-center text-gray-400">{team.losses}L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Court Picker ─────────────────────────────────────────────────────────────

export function TVCourtPicker() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // tournament id

  useEffect(() => {
    getTournaments().then(setTournaments);
    const unsub = subscribeTournaments(setTournaments);
    return unsub;
  }, []);

  const activeTournaments = tournaments.filter(t => !t.completed);
  const displayList = activeTournaments.length > 0 ? activeTournaments : tournaments;

  const tournament = selected
    ? displayList.find(t => t.id === selected)
    : displayList.length === 1 ? displayList[0] : null;

  const goToTV = (courtIndex: number) => {
    if (!tournament) return;
    navigate(`/tv/${tournament.id}?court=${courtIndex}`);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] font-mono flex flex-col items-center justify-center p-8 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#B45330] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Tv className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-[#2A2A2A]">TV Display</h1>
          <p className="text-gray-500 mt-1">Pilih court yang mau ditampilin</p>
        </div>

        {/* Tournament picker (only if multiple) */}
        {!tournament && displayList.length > 1 && (
          <div className="space-y-3 mb-6">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Tournament</p>
            {displayList.map(t => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className="w-full text-left p-4 bg-white border-2 border-[#F0EBE3] hover:border-[#B45330] rounded-2xl transition-all font-semibold text-[#2A2A2A]"
              >
                {t.name}
                <span className="text-xs text-gray-400 ml-2 font-normal">{t.format.replace('-', ' ')}</span>
              </button>
            ))}
          </div>
        )}

        {/* Court list */}
        {tournament && (
          <>
            {displayList.length > 1 && (
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#B45330] mb-4 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Ganti tournament
              </button>
            )}
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {tournament.name}
            </p>
            {tournament.courts.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Monitor className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Belum ada court dikonfigurasi.</p>
                <p className="text-sm mt-1">Tambah court di halaman admin dulu.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tournament.courts.map((court, idx) => (
                  <button
                    key={court.id}
                    onClick={() => goToTV(idx)}
                    className="w-full flex items-center justify-between p-5 bg-white border-2 border-[#F0EBE3] hover:border-[#B45330] hover:shadow-lg rounded-2xl transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${court.currentMatch ? 'bg-red-500 animate-pulse' : court.isAvailable ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="font-black text-xl text-[#2A2A2A] group-hover:text-[#B45330] transition-colors">
                        {court.name}
                      </span>
                      {court.currentMatch && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">LIVE</span>
                      )}
                    </div>
                    <Tv className="w-5 h-5 text-gray-300 group-hover:text-[#B45330] transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tournaments.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Monitor className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Tidak ada tournament aktif.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Team name display ────────────────────────────────────────────────────────

function TeamName({ name }: { name: string }) {
  const parts = name.split(' / ');
  if (parts.length === 2) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-6xl md:text-7xl font-black text-[#2A2A2A] uppercase leading-tight">{parts[0]}</span>
        <span className="text-6xl md:text-7xl font-black text-[#2A2A2A] uppercase leading-tight">{parts[1]}</span>
      </div>
    );
  }
  return (
    <div className="text-6xl md:text-7xl font-black text-[#2A2A2A] uppercase leading-tight">{name}</div>
  );
}

// ─── Scoreboard — Race Mode ───────────────────────────────────────────────────

function RaceScoreboard({ match, court, tournament }: { match: Match; court: Court; tournament: Tournament }) {
  const goldenPoint = isGoldenPoint(match);
  const raceTarget = match.raceTarget || 4;

  return (
    <div className="flex-1 flex flex-col px-6 md:px-10 py-2">
      {/* Header — minimal */}
      <div className="grid grid-cols-3 items-center mb-2 flex-shrink-0">
        <div className="text-gray-400 text-sm uppercase tracking-widest">{court.name} · {match.gamesFixed ? `BEST OF ${match.gamesFixed}` : `RACE TO ${raceTarget}`}</div>
        <div className="flex justify-center">
          <span className="text-2xl font-black tracking-[0.25em] uppercase text-[#2A2A2A]">ONPOINT</span>
        </div>
        <div className="text-[#B45330] text-sm font-bold tracking-[0.2em] uppercase text-right">{tournament.name}</div>
      </div>

      {goldenPoint && !match.isTiebreaker && (
        <div className="mb-2 py-2 px-8 bg-gradient-to-r from-yellow-500/20 via-yellow-400/30 to-yellow-500/20 border-2 border-yellow-400/60 rounded-2xl text-center animate-pulse flex-shrink-0">
          <span className="text-4xl font-black text-yellow-700 tracking-wider">⚡ GOLDEN POINT ⚡</span>
        </div>
      )}

      {match.isTiebreaker && (
        <div className="mb-2 py-2 px-8 bg-gradient-to-r from-blue-500/20 via-blue-400/30 to-blue-500/20 border-2 border-blue-400/60 rounded-2xl text-center animate-pulse flex-shrink-0">
          <span className="text-4xl font-black text-blue-600 tracking-wider">🎾 TIEBREAK</span>
        </div>
      )}

      {/* Scorecard — fills remaining space */}
      <div className={`flex-1 flex flex-col rounded-3xl overflow-hidden border-2 shadow-2xl ${goldenPoint ? 'border-yellow-400 shadow-yellow-200' : 'border-[#8B7355]'}`}>
        {/* Column headers */}
        <div className="flex-shrink-0 grid bg-[#F0EBE3] text-center py-4" style={{ gridTemplateColumns: '3fr 160px 200px' }}>
          <div />
          <div className="text-2xl font-bold text-[#B45330]">GAMES</div>
          <div className={`text-2xl font-bold rounded-tr-3xl py-1 ${goldenPoint ? 'bg-yellow-400 text-black' : 'bg-[#B45330] text-white'}`}>POINT</div>
        </div>

        {/* Team 1 row */}
        <div className="flex-1 grid border-b-2 border-[#F0EBE3]" style={{ gridTemplateColumns: '3fr 160px 200px' }}>
          <div className="px-10 flex items-center">
            <TeamName name={match.team1.name} />
          </div>
          <div className="flex items-center justify-center text-9xl font-black text-[#2A2A2A]">{match.team1RaceScore ?? 0}</div>
          <div className={`flex items-center justify-center text-[10rem] font-black leading-none ${match.isTiebreaker ? 'bg-blue-500 text-white' : goldenPoint ? 'bg-yellow-400 text-black' : 'bg-[#B45330] text-white'}`}>
            {match.isTiebreaker
              ? (match.tiebreakPoints?.team1 ?? 0)
              : getRacePointDisplay(match.team1Score.points)}
          </div>
        </div>

        {/* Team 2 row */}
        <div className="flex-1 grid" style={{ gridTemplateColumns: '3fr 160px 200px' }}>
          <div className="px-10 flex items-center">
            <TeamName name={match.team2.name} />
          </div>
          <div className="flex items-center justify-center text-9xl font-black text-[#2A2A2A]">{match.team2RaceScore ?? 0}</div>
          <div className={`flex items-center justify-center text-[10rem] font-black leading-none rounded-br-3xl ${match.isTiebreaker ? 'bg-blue-500 text-white' : goldenPoint ? 'bg-yellow-400 text-black' : 'bg-[#B45330] text-white'}`}>
            {match.isTiebreaker
              ? (match.tiebreakPoints?.team2 ?? 0)
              : getRacePointDisplay(match.team2Score.points)}
          </div>
        </div>
      </div>

      {match.completed && match.winner && (
        <div className="text-center mt-2 flex-shrink-0 animate-pulse">
          <div className="inline-flex items-center gap-3 bg-yellow-50 border-2 border-yellow-400 text-yellow-800 px-8 py-3 rounded-full text-2xl font-black">
            <Trophy className="w-7 h-7" /> WINNER: {match.winner.name}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sponsor Bar ──────────────────────────────────────────────────────────────

function SponsorBar({ sponsors }: { sponsors: SponsorSlot[] }) {
  return (
    <div className="h-24 bg-white border-t-2 border-[#B45330] flex items-center justify-center px-8 flex-shrink-0">
      <div className="flex justify-center items-center gap-10">
        {[1, 2, 3].map(pos => {
          const s = sponsors.find(sp => sp.position === pos);
          return (
            <div key={pos} className="bg-[#F0EBE3] rounded-lg p-2 border border-[#8B7355]">
              <div className="w-28 h-14 bg-[#FAF8F5] rounded flex items-center justify-center overflow-hidden">
                {s?.logo_url
                  ? <img src={s.logo_url} alt={`Sponsor ${pos}`} className="max-h-full max-w-full object-contain" />
                  : <span className="text-[#B45330] text-xs font-mono">SPONSOR {pos}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main TVDisplay ───────────────────────────────────────────────────────────

export default function TVDisplay() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [searchParams] = useSearchParams();

  // Support both ?court=INDEX (new) and ?courtId=ID (legacy)
  const courtIndex = searchParams.get('court');
  const courtIdLegacy = searchParams.get('courtId');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sponsors, setSponsors] = useState<SponsorSlot[]>([]);
  const [winnerDisplay, setWinnerDisplay] = useState<Match | null>(null);
  const [countdown, setCountdown] = useState(0);
  const prevActiveMatchIdRef = React.useRef<string | null>(null);

  // Load + subscribe via Supabase (cross-device). Egress-friendly: fetch only
  // this tournament's row, and refetch it (debounced 2s) when it changes —
  // never the whole table.
  useEffect(() => {
    if (!tournamentId) return;
    getTournament(tournamentId).then(t => {
      if (t) setTournament(t);
    });
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeTournamentChanges((id) => {
      if (id !== tournamentId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        getTournament(tournamentId).then(t => {
          if (t) setTournament(t);
        });
      }, 2000);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [tournamentId]);

  // Resolve court
  const court: Court | undefined = tournament
    ? courtIndex !== null
      ? tournament.courts[parseInt(courtIndex, 10)]
      : tournament.courts.find(c => c.id === courtIdLegacy) ?? undefined
    : undefined;

  const activeMatchId = court?.currentMatch ?? null;

  // Same-device fast sync (BroadcastChannel)
  useEffect(() => {
    if (!activeMatchId) return;
    const unsub = realTimeUpdates.subscribeToMatch(activeMatchId, (data: MatchUpdateData) => {
      setTournament(prev => {
        if (!prev) return prev;
        return { ...prev, matches: prev.matches.map(m => m.id === data.match.id ? data.match : m) };
      });
    });
    return unsub;
  }, [activeMatchId]);

  // Cross-device fast sync (Supabase broadcast, ~50ms)
  useEffect(() => {
    if (!tournamentId) return;
    const unsub = subscribeToScoreUpdates(tournamentId, (match) => {
      setTournament(prev => {
        if (!prev) return prev;
        const matches = prev.matches.map(m => {
          if (m.id !== match.id) return m;
          // Reject a stale broadcast that would revert a newer score
          if ((match.lastUpdated ?? 0) < (m.lastUpdated ?? 0)) return m;
          return match;
        });
        // Adopt court.currentMatch from the broadcast so the TV goes live /
        // clears immediately instead of waiting for the slower table-change
        // refetch or the 20s poll (which can lag several seconds when many
        // courts are scored at once).
        const courts = prev.courts.map(c => {
          if (match.courtId !== c.id) return c;
          if (match.status === 'in-progress' && !match.completed && c.currentMatch !== match.id) {
            return { ...c, currentMatch: match.id };
          }
          if (match.completed && c.currentMatch === match.id) {
            return { ...c, currentMatch: null };
          }
          return c;
        });
        return { ...prev, matches, courts };
      });
    });
    return unsub;
  }, [tournamentId]);

  // Guaranteed fallback poll (matters when the realtime connection drops —
  // observed when a venue's WiFi hiccups at match start). Adaptive: while the
  // court is WAITING for a match (the critical moment to detect a start) poll
  // every 5s; once a match is live the broadcast carries the scores, so 20s.
  useEffect(() => {
    if (!tournamentId) return;
    const interval = setInterval(() => {
      getTournament(tournamentId).then(t => {
        if (t) setTournament(t);
      });
    }, activeMatchId ? 20000 : 5000);
    return () => clearInterval(interval);
  }, [tournamentId, activeMatchId]);

  // Sponsors
  useEffect(() => {
    if (tournamentId) getTournamentSponsors(tournamentId).then(setSponsors);
  }, [tournamentId]);

  // Fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  const activeMatch = activeMatchId
    ? tournament?.matches.find(m => m.id === activeMatchId) ?? null
    : null;

  // ── TV ads (YouTube-style) ─────────────────────────────────────────────────
  // Tier rules: starter plays WePadl's network reel (organizer has no say);
  // championship/legacy play the organizer's own ads; compact/tournament play
  // nothing.
  const [networkAdItems, setNetworkAdItems] = useState<AdItem[]>([]);
  useEffect(() => {
    if (tournament && isNetworkAdTier(tournament)) getNetworkAds().then(setNetworkAdItems);
  }, [tournament?.id]);
  const ownAds: AdItem[] =
    tournament && tournament.adsEnabled !== false && canOwnAds(tournament) ? tournament.ads ?? [] : [];
  const ads: AdItem[] = tournament && isNetworkAdTier(tournament) ? networkAdItems : ownAds;
  // Short slot = the brief between-games gap (bumper, 3-5s creatives only).
  // Long slot = between matches / manual break. Videos default to long.
  const shortAds = ads.filter((a) => (a.slot ?? (a.type === 'video' ? 'long' : 'both')) !== 'long');
  const longAds = ads.filter((a) => (a.slot ?? (a.type === 'video' ? 'long' : 'both')) !== 'short');
  const hasAds = longAds.length > 0;
  const hasShortAds = shortAds.length > 0;

  // Waiting screen alternates: info/standings ~20s ↔ one full ad cycle.
  const [waitingPhase, setWaitingPhase] = useState<'info' | 'ads'>('info');
  useEffect(() => {
    if (activeMatch || !hasAds) { setWaitingPhase('info'); return; }
    if (waitingPhase === 'info') {
      const t = setTimeout(() => setWaitingPhase('ads'), 20000);
      return () => clearTimeout(t);
    }
  }, [activeMatch, hasAds, waitingPhase]);

  // Automatic between-games ad: when the live match's game/set tally changes
  // (a game just ended), play one short ad. It ends on its own — but the
  // moment the next point is scored, play has resumed, so the scoreboard
  // takes priority and the ad is cancelled immediately.
  const [autoAdBreak, setAutoAdBreak] = useState(false);
  const gameKeyRef = React.useRef<string | null>(null);
  const breakPtsRef = React.useRef<string | null>(null);
  const ptsKey = (m: Match) =>
    `${m.team1Score.points}-${m.team2Score.points}|${m.tiebreakPoints?.team1 ?? 0}-${m.tiebreakPoints?.team2 ?? 0}`;
  useEffect(() => {
    if (!activeMatch || activeMatch.completed) {
      gameKeyRef.current = null;
      breakPtsRef.current = null;
      setAutoAdBreak(false);
      return;
    }
    const m = activeMatch;
    const key = `${m.id}|${m.team1RaceScore ?? 0}-${m.team2RaceScore ?? 0}|${m.team1Score.sets}-${m.team2Score.sets}|${m.team1Score.games}-${m.team2Score.games}`;
    const prev = gameKeyRef.current;
    gameKeyRef.current = key;
    if (hasShortAds && prev && prev.startsWith(`${m.id}|`) && prev !== key) {
      setAutoAdBreak(true);
      breakPtsRef.current = ptsKey(m);
      return;
    }
    // A point landed while the between-games ad was up → back to the score.
    if (autoAdBreak && breakPtsRef.current !== null && ptsKey(m) !== breakPtsRef.current) {
      setAutoAdBreak(false);
      breakPtsRef.current = null;
    }
  }, [activeMatch, hasShortAds, autoAdBreak]);

  // When activeMatchId clears (court freed), check if the previous match was completed
  // and show winner celebration for 15 seconds before going to waiting screen
  // Use a ref for tournament so we can read the latest value without adding it
  // as a dependency — prevents the effect re-running on every 2s poll update
  const tournamentRef = React.useRef(tournament);
  tournamentRef.current = tournament;

  useEffect(() => {
    const prev = prevActiveMatchIdRef.current;
    prevActiveMatchIdRef.current = activeMatchId;

    if (prev && !activeMatchId) {
      const justFinished = tournamentRef.current?.matches.find(
        m => m.id === prev && m.completed && m.winner
      );
      if (justFinished) {
        setWinnerDisplay(justFinished);
        setCountdown(15);
      }
    }
  }, [activeMatchId]); // only triggers when the active match changes, not on every poll

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown(c => {
        if (c <= 1) {
          setWinnerDisplay(null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const nextMatch = court && tournament
    ? tournament.matches.find(
        m => m.courtId === court.id &&
          m.status === 'scheduled' &&
          m.team1.name !== 'TBD' &&
          m.team2.name !== 'TBD'
      ) ?? null
    : null;

  const FullscreenBtn = () => (
    <>
      <button
        onClick={toggleFullscreen}
        className="fixed top-4 right-4 z-50 p-3 bg-white/80 backdrop-blur border border-[#F0EBE3] rounded-xl shadow-lg text-[#2A2A2A] hover:bg-white transition-all"
      >
        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
      </button>
      {tournament && isNetworkAdTier(tournament) && (
        <div className="fixed bottom-3 left-3 z-50 bg-black/70 text-white/90 text-xs font-bold px-3 py-1.5 rounded-full pointer-events-none">
          ⚡ Powered by OnPoint
        </div>
      )}
    </>
  );

  // Loading
  if (!tournament) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] font-mono flex items-center justify-center">
        <div className="text-center">
          <Monitor className="w-16 h-16 mx-auto text-[#B45330] animate-pulse mb-4" />
          <p className="text-gray-500 text-xl">Connecting...</p>
        </div>
      </div>
    );
  }

  if (!court) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] font-mono flex items-center justify-center">
        <div className="text-center max-w-sm">
          <Monitor className="w-12 h-12 mx-auto text-red-400 mb-3" />
          <p className="text-[#2A2A2A] font-bold text-xl mb-1">Court tidak ditemukan</p>
          <p className="text-gray-400 text-sm">Courts: {tournament.courts.map(c => c.name).join(', ') || 'belum ada'}</p>
        </div>
      </div>
    );
  }

  // Winner celebration — show for 15s after match completes
  if (!activeMatch && winnerDisplay) {
    return (
      <div className="min-h-screen bg-[#1a0a00] font-mono flex flex-col items-center justify-center relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#B45330/30_0%,_transparent_70%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#B45330]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#C96A40]/20 rounded-full blur-3xl animate-pulse delay-500" />

        <FullscreenBtn />

        <div className="relative z-10 text-center px-8">
          {/* Court & tournament */}
          <div className="text-[#B45330] text-lg font-bold tracking-[0.3em] uppercase mb-2">{court.name}</div>
          <div className="text-white/50 text-sm tracking-widest uppercase mb-16">{tournament.name}</div>

          {/* Trophy */}
          <div className="text-9xl mb-8 animate-bounce">🏆</div>

          {/* Winner name */}
          <div className="text-white/60 text-2xl font-bold uppercase tracking-widest mb-4">Winner</div>
          <div className="text-6xl md:text-8xl font-black text-white uppercase leading-tight mb-6">
            {winnerDisplay.winner?.name}
          </div>

          {/* Score */}
          <div className="flex items-center justify-center gap-6 text-3xl font-bold mb-16">
            <span className={winnerDisplay.winner?.id === winnerDisplay.team1.id ? 'text-[#B45330]' : 'text-white/40'}>
              {winnerDisplay.team1RaceScore ?? 0}
            </span>
            <span className="text-white/30">–</span>
            <span className={winnerDisplay.winner?.id === winnerDisplay.team2.id ? 'text-[#B45330]' : 'text-white/40'}>
              {winnerDisplay.team2RaceScore ?? 0}
            </span>
          </div>

          {/* Countdown */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#B45330] rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 15) * 100}%` }}
              />
            </div>
            <span className="text-white/30 text-sm">Next match in {countdown}s</span>
          </div>
        </div>

        {/* Sponsor bar */}
        {tournament.showSponsorBar !== false && sponsors.length > 0 && canOwnSponsors(tournament) && <SponsorBar sponsors={sponsors} />}
      </div>
    );
  }

  // Tournament complete — show champion screen
  if (!activeMatch && tournament.completed && tournament.winner) {
    return (
      <div className="min-h-screen bg-[#1a0a00] font-mono flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#B45330/30_0%,_transparent_70%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#B45330]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#C96A40]/20 rounded-full blur-3xl animate-pulse delay-500" />

        <FullscreenBtn />

        <div className="relative z-10 text-center px-8">
          <div className="text-[#B45330] text-lg font-bold tracking-[0.3em] uppercase mb-1">{court.name}</div>
          <div className="text-white/40 text-sm tracking-widest uppercase mb-12">{tournament.name}</div>

          <div className="text-9xl mb-8 animate-bounce">🏆</div>

          <div className="text-white/50 text-xl font-bold uppercase tracking-[0.4em] mb-4">Tournament Champion</div>
          <div className="text-6xl md:text-8xl font-black text-white uppercase leading-tight mb-6">
            {tournament.winner.name}
          </div>

          <div className="inline-flex items-center gap-2 bg-[#B45330]/20 border border-[#B45330]/40 text-[#B45330] text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-full">
            Tournament Complete
          </div>
        </div>

        {tournament.showSponsorBar !== false && sponsors.length > 0 && canOwnSponsors(tournament) && <SponsorBar sponsors={sponsors} />}
      </div>
    );
  }

  // Waiting — no active match: alternate standings/up-next with the ad reel
  if (!activeMatch) {
    if (hasAds && waitingPhase === 'ads') {
      return (
        <>
          <FullscreenBtn />
          <AdPlayer ads={longAds} onCycleDone={() => setWaitingPhase('info')} />
        </>
      );
    }
    return (
      <>
        <FullscreenBtn />
        <WaitingScreen court={court} tournament={tournament} nextMatch={nextMatch} />
      </>
    );
  }

  // Mid-match break: manual (admin pressed Break) or automatic (a game just
  // ended). Not skippable — the ad finishes on its own; manual break keeps
  // cycling until the admin resumes or scores the next point. The automatic
  // between-games gap only plays SHORT-slot ads (bumper 3-5s); the manual
  // break is a long rest, so it gets the long reel.
  if (activeMatch.onBreak && hasAds) {
    return (
      <>
        <FullscreenBtn />
        <AdPlayer
          ads={longAds}
          scoreStrip={<AdScoreStrip match={activeMatch} court={court} />}
        />
      </>
    );
  }
  if (autoAdBreak && hasShortAds) {
    return (
      <>
        <FullscreenBtn />
        <AdPlayer
          ads={shortAds}
          single
          onCycleDone={() => setAutoAdBreak(false)}
          scoreStrip={<AdScoreStrip match={activeMatch} court={court} />}
        />
      </>
    );
  }

  // Active match scoreboard
  return (
    <div className="min-h-screen bg-[#FAF8F5] font-mono flex flex-col relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:48px_48px]" />
      <FullscreenBtn />

      <div className="relative z-10 flex items-center gap-2 px-6 pt-2">
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Live</span>
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <RaceScoreboard match={activeMatch} court={court} tournament={tournament} />
      </div>

      {tournament.showSponsorBar !== false && sponsors.length > 0 && canOwnSponsors(tournament) && (
        <div className="relative z-10">
          <SponsorBar sponsors={sponsors} />
        </div>
      )}
    </div>
  );
}
