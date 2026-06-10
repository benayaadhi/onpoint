import React, { useState, useRef } from 'react';
import { Plus, Users, Trophy, Target, MapPin, X, Upload, Download, Settings, ChevronDown, Swords } from 'lucide-react';
import { Team, TournamentFormat, Court, TournamentConfig, Club, ClashStructure } from '../types/tournament';
import { generateDummyTeams } from '../utils/tournamentLogic';
import CourtManager from './CourtManager';

interface TournamentSetupProps {
  // Returns an error message (e.g. invalid activation code) or null on success.
  onCreateTournament: (name: string, format: TournamentFormat, teams: Team[], courts: Court[], scoringMode?: 'padel' | 'race', raceTarget?: number, config?: Partial<TournamentConfig>, activationCode?: string) => Promise<string | null> | void;
}

export default function TournamentSetup({ onCreateTournament }: TournamentSetupProps) {
  const [tournamentName, setTournamentName] = useState('Padel Championship');
  const [format, setFormat] = useState<TournamentFormat>('single-elimination');
  const [teams, setTeams] = useState<Team[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [currentTab, setCurrentTab] = useState<'teams' | 'courts'>('teams');
  const [scoringMode, setScoringMode] = useState<'padel' | 'race'>('padel');
  const [raceTarget, setRaceTarget] = useState(4);
  const [activationCode, setActivationCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  // Custom match rules (padel)
  const [setsToWin, setSetsToWin] = useState(2);
  const [gamesToWinSet, setGamesToWinSet] = useState(6);
  const [tiebreakAt, setTiebreakAt] = useState(6);
  const [tiebreakPoints, setTiebreakPoints] = useState(7);
  const [goldenPoint, setGoldenPoint] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // Group config
  const [teamsPerGroup, setTeamsPerGroup] = useState(4);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [thirdPlace, setThirdPlace] = useState(false);
  // Clash config — each club fields a Men/Women/Mix team
  const [clashStructure, setClashStructure] = useState<ClashStructure>('rr-final');
  const [clashThirdPlace, setClashThirdPlace] = useState(true);
  const [clashPoolCount, setClashPoolCount] = useState(3);
  const [clashLadder8, setClashLadder8] = useState(false);
  const [clashClubs, setClashClubs] = useState(
    Array.from({ length: 4 }, (_, i) => ({
      name: `Club ${String.fromCharCode(65 + i)}`,
      men: '',
      women: '',
      mix: '',
    }))
  );
  const csvInputRef = useRef<HTMLInputElement>(null);

  const isPoolKnockout = clashStructure === 'pool-knockout';
  const PK_MAX = 16;
  const pkMin = 6; // need 6 qualifiers (6/poolCount per pool)
  const effPoolCount = clashLadder8 ? 2 : clashPoolCount;

  // Grow/shrink the club list to exactly n entries.
  const ensureClubCount = (n: number) => {
    setClashClubs((prev) => {
      if (prev.length === n) return prev;
      if (prev.length > n) return prev.slice(0, n);
      const extra = Array.from({ length: n - prev.length }, (_, i) => ({
        name: `Club ${String.fromCharCode(65 + prev.length + i)}`,
        men: '',
        women: '',
        mix: '',
      }));
      return [...prev, ...extra];
    });
  };

  const selectClashStructure = (v: ClashStructure) => {
    setClashStructure(v);
    if (v === 'pool-knockout') ensureClubCount(clashPoolCount === 2 ? 10 : 12);
  };

  const selectPoolCount = (n: number) => {
    setClashPoolCount(n);
    ensureClubCount(Math.max(clashClubs.length, 6)); // need 6 qualifiers
  };

  const selectLadder8 = (on: boolean) => {
    setClashLadder8(on);
    if (on) ensureClubCount(8); // 2 pools × 4
  };

  // Balanced pool sizes (sizes differ by ≤1), matches the engine's split.
  const poolSizes = () => {
    const base = Math.floor(clashClubs.length / effPoolCount);
    const extra = clashClubs.length % effPoolCount;
    return Array.from({ length: effPoolCount }, (_, p) => base + (p < extra ? 1 : 0));
  };
  // Pool index (0-based) for a given club index, using the balanced split.
  const poolOfIndex = (idx: number) => {
    const sizes = poolSizes();
    let acc = 0;
    for (let p = 0; p < sizes.length; p++) {
      acc += sizes[p];
      if (idx < acc) return p;
    }
    return sizes.length - 1;
  };

  const updateClub = (idx: number, field: 'name' | 'men' | 'women' | 'mix', value: string) => {
    setClashClubs((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const maxClubs = clashLadder8 ? 8 : isPoolKnockout ? PK_MAX : 8;
  const minClubs = clashLadder8 ? 8 : isPoolKnockout ? pkMin : 2;
  const addClub = () => {
    setClashClubs((prev) =>
      prev.length >= maxClubs
        ? prev
        : [...prev, { name: `Club ${String.fromCharCode(65 + prev.length)}`, men: '', women: '', mix: '' }]
    );
  };
  const removeClub = () => {
    setClashClubs((prev) => (prev.length <= minClubs ? prev : prev.slice(0, -1)));
  };

  // Set-length preset: deciding-game tiebreak triggers at N-1 each (4→3-3, 6→5-5)
  const applySetLength = (games: number) => {
    setGamesToWinSet(games);
    setTiebreakAt(games - 1);
  };

  // Live preview of the knockout bracket size for the current group config
  const knockoutPreview = () => {
    const numGroups = Math.ceil(teams.length / teamsPerGroup) || 0;
    const available = numGroups * qualifiersPerGroup;
    if (available < 2) return 0;
    return Math.pow(2, Math.floor(Math.log2(available)));
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target?.result as string;
      // Strip BOM (Excel UTF-8 exports often include it)
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const names = text
        .split(/[\r\n]+/)
        .map((line) => {
          // Support comma-separated: take first column
          const firstCol = line.split(',')[0];
          return firstCol.trim().replace(/^["']|["']$/g, ''); // strip quotes
        })
        .filter((n) => n.length > 0 && n.toLowerCase() !== 'team name'); // skip header row
      const newTeams: Team[] = names.map((name) => ({
        id: `team-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
      }));
      setTeams((prev) => [...prev, ...newTeams]);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addTeam = () => {
    if (newTeamName.trim()) {
      const newTeam: Team = {
        id: `team-${Date.now()}`,
        name: newTeamName.trim()
      };
      setTeams([...teams, newTeam]);
      setNewTeamName('');
    }
  };

  const removeTeam = (teamId: string) => {
    setTeams(teams.filter(t => t.id !== teamId));
  };

  const generateDummyTeamsHandler = (count: 4 | 8 | 16) => {
    setTeams(generateDummyTeams(count));
  };

  const recommendedCourts = () => {
    if (format === 'group-knockout') return Math.ceil(teams.length / teamsPerGroup);
    if (format === 'round-robin') return Math.max(1, Math.floor(teams.length / 4));
    return 1;
  };

  const clashValid =
    (clashLadder8
      ? clashClubs.length === 8
      : isPoolKnockout
      ? clashClubs.length >= pkMin && clashClubs.length <= PK_MAX
      : clashClubs.length >= 2) &&
    clashClubs.every(
      (c) => c.name.trim() && c.men.trim() && c.women.trim() && c.mix.trim()
    );

  const canCreateTournament = () => {
    if (format === 'clash') return clashValid;
    if (format === 'single-elimination') {
      return teams.length >= 4 && (teams.length & (teams.length - 1)) === 0;
    }
    return teams.length >= 4;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTournament()) return;
    setCodeError(null);

    const rules = { matchRules: { setsToWin, gamesToWinSet, tiebreakAt, tiebreakPoints, goldenPoint } };

    if (format === 'clash') {
      const clubs: Club[] = clashClubs.map((c, ci) => {
        const cid = `club-${ci + 1}`;
        return {
          id: cid,
          name: c.name.trim() || `Club ${ci + 1}`,
          teams: {
            men: { id: `${cid}-men`, name: c.men.trim() },
            women: { id: `${cid}-women`, name: c.women.trim() },
            mix: { id: `${cid}-mix`, name: c.mix.trim() },
          },
        };
      });
      const err = await onCreateTournament(tournamentName, 'clash', [], courts, scoringMode, raceTarget, {
        ...rules,
        clubs,
        clashStructure,
        clashThirdPlace: isPoolKnockout ? clashThirdPlace : undefined,
        clashPoolCount: isPoolKnockout ? effPoolCount : undefined,
        clashLadder8: isPoolKnockout ? clashLadder8 : undefined,
      }, activationCode);
      if (err) setCodeError(err);
      return;
    }

    const err = await onCreateTournament(tournamentName, format, teams, courts, scoringMode, raceTarget, {
      ...rules,
      teamsPerGroup,
      qualifiersPerGroup,
      thirdPlace: format === 'group-knockout' || format === 'single-elimination' ? thirdPlace : undefined,
    }, activationCode);
    if (err) setCodeError(err);
  };

  const addDefaultCourts = (count: number) => {
    const newCourts: Court[] = Array.from({ length: count }, (_, i) => ({
      id: `court-${Date.now()}-${i}`,
      name: `Court ${courts.length + i + 1}`,
      isAvailable: true,
      surface: 'artificial-grass' as const
    }));
    setCourts(prev => [...prev, ...newCourts]);
  };

  return (
    // Wrapper untuk memposisikan card di tengah halaman dengan latar belakang yang sesuai
    <div className="min-h-screen bg-[#FAF8F5] font-mono text-[#2A2A2A] p-4 sm:p-8 flex items-center justify-center">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>

      <div className="relative z-10 bg-[#FFFFFF]/80 backdrop-blur-xl border border-[#F0EBE3] rounded-2xl p-8 shadow-2xl shadow-black/50 max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FFFFFF] border-2 border-[#B45330]/50 rounded-full mb-4">
            <Trophy className="w-8 h-8 text-[#B45330]" />
          </div>
          <h1 className="text-3xl font-bold text-[#2A2A2A] mb-2">Create Padel Tournament</h1>
          <p className="text-gray-600">Set up your tournament with official padel scoring rules</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Tournament Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Name</label>
            <input
              type="text"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-[#F0EBE3] rounded-lg text-[#2A2A2A] placeholder-gray-400 focus:ring-2 focus:ring-[#B45330] focus:border-transparent transition-all"
              placeholder="Enter tournament name"
            />
          </div>

          {/* Activation Code */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Kode Aktivasi</label>
            <input
              type="text"
              value={activationCode}
              onChange={(e) => { setActivationCode(e.target.value.toUpperCase()); setCodeError(null); }}
              className={`w-full px-4 py-3 bg-white border rounded-lg text-[#2A2A2A] placeholder-gray-400 focus:ring-2 focus:ring-[#B45330] focus:border-transparent transition-all font-mono tracking-widest ${codeError ? 'border-red-400' : 'border-[#F0EBE3]'}`}
              placeholder="WPDL-XXXX-XXXX-XXXX"
            />
            {codeError ? (
              <p className="text-sm text-red-500 mt-1.5">{codeError}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1.5">
                Kode menentukan paket (Starter / Compact / Tournament / Championship). Belum punya? Hubungi WePadl.
              </p>
            )}
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-4">Tournament Format</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { value: 'round-robin', label: 'Round Robin', desc: 'Everyone plays everyone', icon: Users },
                { value: 'single-elimination', label: 'Single Elimination', desc: 'Lose and you\'re out', icon: Target },
                { value: 'group-knockout', label: 'Group + Knockout', desc: 'Groups then elimination', icon: Trophy },
                { value: 'clash', label: 'Clash (Club vs Club)', desc: '3 teams/club: men, women, mix', icon: Swords }
              ].map(({ value, label, desc, icon: Icon }) => (
                <label key={value} className="cursor-pointer">
                  <input type="radio" name="format" value={value} checked={format === value} onChange={(e) => setFormat(e.target.value as TournamentFormat)} className="sr-only" />
                  <div className={`p-4 border-2 rounded-lg transition-all h-full transform hover:-translate-y-1 ${format === value
                      ? 'border-[#B45330] bg-[#B45330]/10 shadow-neon-green'
                      : 'border-[#F0EBE3] bg-[#FFFFFF]/50 hover:border-[#8B7355]'
                    }`}>
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-5 h-5 transition-colors ${format === value ? 'text-[#B45330]' : 'text-gray-500'}`} />
                      <div>
                        <div className={`font-semibold transition-colors ${format === value ? 'text-[#B45330]' : 'text-gray-700'}`}>{label}</div>
                        <div className={`text-sm transition-colors ${format === value ? 'text-[#C96A40]' : 'text-gray-500'}`}>{desc}</div>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Scoring Rules */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-4">Scoring Rules</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { value: 'padel', label: 'Official Padel', desc: 'Sets, games, deuce, tiebreak' },
                { value: 'race', label: 'Race to N', desc: 'First to reach N games wins' },
              ].map(({ value, label, desc }) => (
                <label key={value} className="cursor-pointer">
                  <input type="radio" name="scoringMode" value={value} checked={scoringMode === value} onChange={() => setScoringMode(value as 'padel' | 'race')} className="sr-only" />
                  <div className={`p-4 border-2 rounded-lg transition-all h-full transform hover:-translate-y-1 ${scoringMode === value
                    ? 'border-[#B45330] bg-[#B45330]/10'
                    : 'border-[#F0EBE3] bg-[#FFFFFF]/50 hover:border-[#8B7355]'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <Target className={`w-5 h-5 transition-colors ${scoringMode === value ? 'text-[#B45330]' : 'text-gray-500'}`} />
                      <div>
                        <div className={`font-semibold transition-colors ${scoringMode === value ? 'text-[#B45330]' : 'text-gray-700'}`}>{label}</div>
                        <div className={`text-sm transition-colors ${scoringMode === value ? 'text-[#C96A40]' : 'text-gray-500'}`}>{desc}</div>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {scoringMode === 'race' && (
              <div className="mt-4 p-4 bg-[#B45330]/5 border border-[#B45330]/30 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Race Target
                </label>
                <div className="flex items-center gap-3">
                  {[4, 6, 8, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRaceTarget(n)}
                      className={`w-12 h-12 rounded-lg font-bold text-lg transition-all ${raceTarget === n
                        ? 'bg-[#B45330] text-white shadow-md'
                        : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      type="button"
                      onClick={() => setRaceTarget(t => Math.max(1, t - 1))}
                      className="w-8 h-8 rounded-lg bg-white border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold transition-colors"
                    >−</button>
                    <span className="w-10 text-center font-bold text-[#2A2A2A]">{raceTarget}</span>
                    <button
                      type="button"
                      onClick={() => setRaceTarget(t => t + 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold transition-colors"
                    >+</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white border border-[#F0EBE3] rounded-lg px-3 py-2">
                    <span className="text-gray-500">Group / Semis</span>
                    <span className="ml-2 font-bold text-[#2A2A2A]">Race to {raceTarget}</span>
                  </div>
                  <div className="bg-[#B45330]/10 border border-[#B45330]/40 rounded-lg px-3 py-2">
                    <span className="text-[#B45330] font-semibold">Final</span>
                    <span className="ml-2 font-bold text-[#2A2A2A]">Race to {raceTarget + 2}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Custom Match Rules (padel only) */}
          {scoringMode === 'padel' && (
            <div className="border border-[#F0EBE3] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRules(s => !s)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#FAF8F5] hover:bg-[#F0EBE3]/50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Settings className="w-4 h-4 text-[#B45330]" /> Custom Match Rules
                </span>
                <span className="flex items-center gap-2 text-xs text-gray-500">
                  Best of {setsToWin * 2 - 1} · {gamesToWinSet}-game set · {goldenPoint ? 'golden point' : 'advantage'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showRules ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {showRules && (
                <div className="p-4 space-y-5 border-t border-[#F0EBE3]">
                  {/* Sets to win */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Match Length</label>
                    <div className="flex flex-wrap gap-2">
                      {[{ v: 1, l: 'Best of 1' }, { v: 2, l: 'Best of 3' }, { v: 3, l: 'Best of 5' }].map(({ v, l }) => (
                        <button key={v} type="button" onClick={() => setSetsToWin(v)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${setsToWin === v ? 'bg-[#B45330] text-white' : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Set length → deciding-game tiebreak trigger */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Set Length</label>
                    <div className="flex flex-wrap gap-2">
                      {[4, 6].map((g) => (
                        <button key={g} type="button" onClick={() => applySetLength(g)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${gamesToWinSet === g ? 'bg-[#B45330] text-white' : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'}`}>
                          {g} games <span className="opacity-70">(decider {g - 1}-{g - 1})</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Deciding-game tiebreak (first to {tiebreakPoints}{goldenPoint ? `, golden at ${tiebreakPoints - 1}-${tiebreakPoints - 1} → max ${tiebreakPoints}-${tiebreakPoints - 1}` : ', win by 2'}) only when games reach {tiebreakAt}-{tiebreakAt} <span className="font-semibold">and</span> the game hits 40-40. A clean 40-0 just wins the game.</p>
                  </div>

                  {/* Deuce rule */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">At 40-40 (non-deciding games)</label>
                    <div className="flex flex-wrap gap-2">
                      {[{ v: false, l: 'Advantage (win by 2)' }, { v: true, l: 'Golden Point (sudden death)' }].map(({ v, l }) => (
                        <button key={String(v)} type="button" onClick={() => setGoldenPoint(v)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${goldenPoint === v ? 'bg-[#B45330] text-white' : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tiebreak points */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Tiebreak To</label>
                    <div className="flex flex-wrap gap-2">
                      {[5, 7, 10].map(n => (
                        <button key={n} type="button" onClick={() => setTiebreakPoints(n)}
                          className={`w-12 h-10 rounded-lg text-sm font-bold transition-all ${tiebreakPoints === n ? 'bg-[#B45330] text-white' : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Group Settings (group-knockout only) */}
          {format === 'group-knockout' && (
            <div className="p-4 bg-[#B45330]/5 border border-[#B45330]/30 rounded-lg space-y-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Trophy className="w-4 h-4 text-[#B45330]" /> Group Settings
              </label>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Teams per Group</label>
                <div className="flex flex-wrap gap-2">
                  {[3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setTeamsPerGroup(n)}
                      className={`w-12 h-10 rounded-lg text-sm font-bold transition-all ${teamsPerGroup === n ? 'bg-[#B45330] text-white' : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Qualifiers per Group</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} type="button" onClick={() => setQualifiersPerGroup(n)}
                      disabled={n > teamsPerGroup}
                      className={`w-12 h-10 rounded-lg text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${qualifiersPerGroup === n ? 'bg-[#B45330] text-white' : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#F0EBE3] rounded-lg px-3 py-2 text-sm">
                {teams.length >= teamsPerGroup ? (
                  <span className="text-gray-600">
                    {Math.ceil(teams.length / teamsPerGroup)} groups ·{' '}
                    <span className="font-bold text-[#B45330]">{knockoutPreview()}-team knockout</span>
                  </span>
                ) : (
                  <span className="text-gray-400">Add at least {teamsPerGroup} teams to preview the bracket.</span>
                )}
              </div>
            </div>
          )}

          {/* 3rd-place toggle (knockout formats) */}
          {(format === 'group-knockout' || format === 'single-elimination') && (
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={thirdPlace}
                onChange={(e) => setThirdPlace(e.target.checked)}
                className="w-4 h-4 accent-[#B45330]"
              />
              Match perebutan Juara 3 (yang kalah semifinal)
            </label>
          )}

          {/* Clash Setup (clash only) */}
          {format === 'clash' && (
            <div className="p-4 bg-[#B45330]/5 border border-[#B45330]/30 rounded-lg space-y-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Swords className="w-4 h-4 text-[#B45330]" /> Clash Setup — Club vs Club
              </label>

              {/* Structure */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Structure</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 'rr-final', l: 'Round-robin + Final' },
                    { v: 'round-robin', l: 'Round-robin only' },
                    { v: 'pool-knockout', l: 'Squad Battle (Pools + Knockout)' },
                  ].map(({ v, l }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => selectClashStructure(v as ClashStructure)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        clashStructure === v
                          ? 'bg-[#B45330] text-white'
                          : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Squad Battle options */}
              {isPoolKnockout && (
                <div className="space-y-3">
                  {/* Format */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Format</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => selectLadder8(false)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${!clashLadder8 ? 'bg-[#B45330] text-white' : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'}`}
                      >
                        6-tim (2/3 pool, top lolos)
                      </button>
                      <button
                        type="button"
                        onClick={() => selectLadder8(true)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${clashLadder8 ? 'bg-[#B45330] text-white' : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'}`}
                      >
                        Squad Battle 8 (ladder, semua lolos)
                      </button>
                    </div>
                  </div>

                  {/* Pool count (6-team only) */}
                  {!clashLadder8 && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">Jumlah Pool</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { n: 2, l: '2 Pool → bracket 4 tim' },
                          { n: 3, l: '3 Pool → bracket 6 tim' },
                        ].map(({ n, l }) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => selectPoolCount(n)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${clashPoolCount === n ? 'bg-[#B45330] text-white' : 'bg-white text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-600 bg-white border border-[#F0EBE3] rounded-lg p-3">
                    <p className="font-semibold text-[#B45330] mb-1">
                      {clashClubs.length} squad · {effPoolCount} pool ({poolSizes().join(' / ')})
                    </p>
                    {clashLadder8 ? (
                      <>
                        <p>8 squad · 2 pool × 4 · <b>semua lolos</b> ke bracket tangga.</p>
                        <p className="mt-1">Juara pool → bye Semifinal; Runner-up → bye Perempat Final; Peringkat 3 & 4 → Round 1. + perebutan Juara 3.</p>
                        <p className="mt-1 text-gray-500">Scoring: group <b>best of 5</b> (main 5 game penuh); R1 & QF race-to-4; semifinal race-to-5; final & juara-3 race-to-6.</p>
                      </>
                    ) : (
                      <>
                        <p>Tiap pool round-robin. Lolos 6 ({clashPoolCount === 3 ? 'juara + runner-up' : 'top 3'} tiap pool) → bracket 6 tim.</p>
                        <p className="mt-1">Bracket: 2 juara pool teratas bye ke semifinal; PO1 (S3 v S6), PO2 (S4 v S5) → SF1/SF2 → Final.</p>
                        <p className="mt-1 text-gray-500">Scoring: pool & playoff race-to-3, semifinal race-to-5, final race-to-6. Golden point; tiebreak ke 7 @ (N-1)-(N-1).</p>
                        {poolSizes().some((s) => s !== poolSizes()[0]) && (
                          <p className="mt-1 text-[#B45330]">Pool ukurannya beda — seeding lintas-pool pakai rata-rata per match biar adil.</p>
                        )}
                      </>
                    )}
                  </div>

                  {!clashLadder8 && (
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clashThirdPlace}
                        onChange={(e) => setClashThirdPlace(e.target.checked)}
                        className="w-4 h-4 accent-[#B45330]"
                      />
                      Match perebutan Juara 3 (yang kalah SF1 vs SF2)
                    </label>
                  )}
                </div>
              )}

              {/* Clubs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600">
                    {isPoolKnockout ? `Squads (${clashClubs.length})` : `Clubs (${clashClubs.length})`}
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={removeClub} disabled={clashClubs.length <= minClubs}
                      className="w-7 h-7 rounded-lg bg-white border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                    <span className="w-6 text-center font-bold text-[#2A2A2A]">{clashClubs.length}</span>
                    <button type="button" onClick={addClub} disabled={clashClubs.length >= maxClubs}
                      className="w-7 h-7 rounded-lg bg-white border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                  </div>
                </div>

                <div className="space-y-3">
                  {clashClubs.map((club, ci) => (
                    <div key={ci} className="bg-white border border-[#F0EBE3] rounded-lg p-3 space-y-2">
                      {isPoolKnockout && (
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#B45330]">
                          Pool {poolOfIndex(ci) + 1}
                        </div>
                      )}
                      <input
                        type="text"
                        value={club.name}
                        onChange={(e) => updateClub(ci, 'name', e.target.value)}
                        placeholder={`Club ${ci + 1} name`}
                        className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#F0EBE3] rounded-lg text-sm font-bold text-[#2A2A2A] focus:ring-2 focus:ring-[#B45330] focus:border-transparent"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {([
                          ['men', 'Men team'],
                          ['women', 'Women team'],
                          ['mix', 'Mix team'],
                        ] as const).map(([field, ph]) => (
                          <input
                            key={field}
                            type="text"
                            value={club[field]}
                            onChange={(e) => updateClub(ci, field, e.target.value)}
                            placeholder={ph}
                            className="w-full px-3 py-2 bg-white border border-[#F0EBE3] rounded-lg text-sm text-[#2A2A2A] placeholder-gray-400 focus:ring-2 focus:ring-[#B45330] focus:border-transparent"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Tiap klub turunkan 3 tim (Men/Women/Mix). Pas dua klub ketemu, mainnya per kategori.{' '}
                  {isPoolKnockout
                    ? `${effPoolCount} pool (${poolSizes().join('/')}) → ${poolSizes().reduce((s, n) => s + (n * (n - 1)) / 2, 0)} tie pool + ${clashLadder8 ? 8 : 5 + (clashThirdPlace ? 1 : 0)} tie knockout.`
                    : `${clashClubs.length} klub → ${(clashClubs.length * (clashClubs.length - 1)) / 2} tie${clashStructure === 'rr-final' ? ' RR + final' : ''}.`}
                </p>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div>
            <div className="border-b border-[#F0EBE3] mb-6">
              <nav className="-mb-px flex space-x-8">
                {format !== 'clash' && (
                  <button type="button" onClick={() => setCurrentTab('teams')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${currentTab === 'teams' ? 'border-[#B45330] text-[#B45330]' : 'border-transparent text-gray-500 hover:text-[#2A2A2A] hover:border-gray-400'}`}>
                    <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Teams ({teams.length})</div>
                  </button>
                )}
                <button type="button" onClick={() => setCurrentTab('courts')} className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${currentTab === 'courts' ? 'border-[#B45330] text-[#B45330]' : 'border-transparent text-gray-500 hover:text-[#2A2A2A] hover:border-gray-400'}`}>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Courts ({courts.length})
                  </div>
                </button>
              </nav>
            </div>

            {/* Teams Tab */}
            {currentTab === 'teams' && format !== 'clash' && (
              <div className="space-y-6 animate-pulse-glow animation-delay-200">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">Quick Setup</label>
                  <div className="flex flex-wrap gap-3">
                    {[4, 8, 16].map(count => (
                      <button key={count} type="button" onClick={() => generateDummyTeamsHandler(count as 4 | 8 | 16)} className="px-4 py-2 bg-[#FFFFFF] text-[#A89070] rounded-lg hover:bg-[#8B7355]/10 border border-[#8B7355]/50 hover:border-[#8B7355] transition-colors font-medium">
                        Generate {count} Teams
                      </button>
                    ))}
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleCSVUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => csvInputRef.current?.click()}
                      className="px-4 py-2 bg-[#FFFFFF] text-[#A89070] rounded-lg hover:bg-[#8B7355]/10 border border-[#8B7355]/50 hover:border-[#8B7355] transition-colors font-medium flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> Upload CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const template = [
                          'Budi / Andi',
                          'Sari / Dewi',
                          'Kevin / Reza',
                          'Fajar / Fikri',
                          'Tim Macan',
                          'Tim Elang',
                        ].join('\n');
                        const blob = new Blob([template], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'team-template.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 bg-[#FFFFFF] text-[#A89070] rounded-lg hover:bg-[#8B7355]/10 border border-[#8B7355]/50 hover:border-[#8B7355] transition-colors font-medium flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Template
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">CSV: satu nama tim per baris. Kolom pertama yang dipakai kalau ada koma.</p>
                </div>
                <div className="flex gap-3">
                  <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Enter team name" className="flex-1 px-4 py-2 bg-white border border-[#F0EBE3] rounded-lg text-[#2A2A2A] placeholder-gray-400 focus:ring-2 focus:ring-[#B45330] focus:border-transparent" onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTeam(); } }} />
                  <button type="button" onClick={addTeam} className="px-4 py-2 bg-[#B45330] text-white border border-[#B45330] hover:bg-[#C96A40] rounded-lg flex items-center gap-2 font-semibold">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1 rounded-lg bg-[#FAF8F5]/50">
                  {teams.map((team, index) => (
                    <div key={team.id} className="flex items-center justify-between p-3 bg-[#FFFFFF]/70 border border-[#F0EBE3] rounded-lg">
                      <span className="font-medium text-gray-700 truncate">{index + 1}. {team.name}</span>
                      <button type="button" onClick={() => removeTeam(team.id)} className="text-gray-500 hover:text-red-500 transition-colors ml-2"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {teams.length === 0 && (<div className="col-span-full text-center py-8 text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No teams added yet</p></div>)}
                </div>
              </div>
            )}

            {/* Courts Tab */}
            {(currentTab === 'courts' || format === 'clash') && (
              <div className="space-y-6 animate-pulse-glow animation-delay-200">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">Quick Setup</label>
                  <div className="flex flex-wrap gap-3">
                    {[1, 2, 4].map(count => (
                      <button key={count} type="button" onClick={() => addDefaultCourts(count)} className="px-4 py-2 bg-[#FFFFFF] text-[#A89070] rounded-lg hover:bg-[#8B7355]/10 border border-[#8B7355]/50 hover:border-[#8B7355] transition-colors font-medium">
                        Add {count} Court{count > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </div>
                <CourtManager courts={courts} onUpdateCourts={setCourts} />
              </div>
            )}
          </div>

          {/* Requirements Info */}
          <div className="bg-[#8B7355]/10 border border-[#8B7355]/50 rounded-lg p-4">
            <h3 className="font-semibold text-[#A89070] mb-2">Requirements:</h3>
            <ul className="text-gray-600 text-sm space-y-1">
              {format === 'single-elimination' && <li>• Needs a power of 2 teams (4, 8, 16, etc.)</li>}
              {format === 'clash' && <li>• Needs ≥2 clubs, each with all 3 teams (Men/Women/Mix) named.</li>}
              {format !== 'single-elimination' && format !== 'clash' && <li>• Needs at least 4 teams.</li>}
              {courts.length > 0 && (
                <li className="text-green-600">
                  • ✓ {courts.length} court{courts.length > 1 ? 's' : ''} added (TV display enabled)
                </li>
              )}
              {teams.length >= 4 && (
                <li className="text-gray-400">
                  • Recommended: {recommendedCourts()} court{recommendedCourts() > 1 ? 's' : ''} for {teams.length} teams ({format.replace('-', ' ')})
                </li>
              )}
            </ul>
          </div>

          {/* Create Tournament Button */}
          <button type="submit" disabled={!canCreateTournament()} className={`w-full py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-[1.02] duration-300 ${canCreateTournament()
              ? 'bg-gradient-to-r from-[#B45330] to-[#C96A40] text-white shadow-lg hover:shadow-neon-green'
              : 'bg-[#F0EBE3] text-gray-500 cursor-not-allowed'
            }`}>
            Create Tournament
          </button>
        </form>
      </div>
    </div>
  );
}