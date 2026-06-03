import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Zap,
  Undo,
  Monitor,
  ExternalLink,
  MapPin,
  Trophy,
  Target,
  Timer,
  FileText,
} from 'lucide-react';
import { Match, Tournament, DEFAULT_MATCH_RULES } from '../types/tournament';
import { getDisplayScore } from '../utils/padelScoring';
import { addRacePoint, getRacePointDisplay } from '../utils/raceScoring';
import { realTimeUpdates, REAL_TIME_EVENTS } from '../utils/realTimeUpdates';
import { getCourtName } from '../utils/courtAssignment';
import SpectatorView from './SpectatorView';
import { openSpectatorWindow } from './StandaloneSpectatorView';

// --- INTERFACES ---
interface MatchScoringProps {
  match: Match;
  onUpdateMatch: (match: Match) => void;
  onBack: () => void;
  onNextMatch?: () => void;
  tournamentName?: string;
  tournament?: Tournament;
}

interface MatchHistoryEntry {
  match: Match;
  timestamp: number;
  action: string;
}

interface SetHistory {
  setNumber: number;
  team1Games: number;
  team2Games: number;
  winner: 'team1' | 'team2';
  completed: boolean;
}

interface PointLogEntry {
  team: string;
  action: string;
}

// --- MAIN COMPONENT ---
export default function MatchScoring({
  match,
  onUpdateMatch,
  onBack,
  onNextMatch,
  tournamentName,
  tournament,
}: MatchScoringProps & { onNextMatch?: () => void }) {
  const [currentMatch, setCurrentMatch] = useState<Match>(match);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [showSpectatorView, setShowSpectatorView] = useState(false);
  const [setHistory, setSetHistory] = useState<SetHistory[]>(match.setHistory || []);
  const [faultCount, setFaultCount] = useState(0);
  const [showChangeover, setShowChangeover] = useState(false);
  const [pointLog, setPointLog] = useState<PointLogEntry[]>([]);
  const [quickWinPending, setQuickWinPending] = useState<'team1' | 'team2' | null>(null);
  const [quickWinLoserScore, setQuickWinLoserScore] = useState<number>(0);

  // ── Match stopwatch ────────────────────────────────────────────────────────
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const matchStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Match notes ────────────────────────────────────────────────────────────
  const [showNotes, setShowNotes] = useState(false);
  const [matchNote, setMatchNote] = useState('');

  const isRaceMode = currentMatch.scoringMode === 'race';
  const raceTarget = currentMatch.raceTarget || 4;
  // Resolved padel rules for this match (falls back to standard 6/7/2 + advantage)
  const rules = { ...DEFAULT_MATCH_RULES, ...(currentMatch.rules || {}) };

  useEffect(() => {
    // Ignore an incoming match that is older than what we already show, so a
    // late/stale update can't revert a fresher local score (no score bounce).
    setCurrentMatch((prev) =>
      prev && prev.id === match.id && (match.lastUpdated ?? 0) < (prev.lastUpdated ?? 0)
        ? prev
        : match
    );
    setSetHistory(match.setHistory || []);
    realTimeUpdates.saveCurrentMatchData(match);
  }, [match]);

  const cloneMatch = (m: Match): Match => JSON.parse(JSON.stringify(m));

  const addToLog = (action: string, team: string) => {
    setPointLog((prev) => [{ team, action }, ...prev].slice(0, 8));
  };

  // Start timer on first point, stop when match completes
  const startTimer = () => {
    if (matchStartedAtRef.current !== null) return; // already running
    matchStartedAtRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - matchStartedAtRef.current!) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTimer(); // cleanup on unmount
  }, []);

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const updateMatchWithHistory = (
    updatedMatch: Match,
    action: string,
    eventType?: string
  ) => {
    // Stamp this change so stale incoming updates can be rejected downstream.
    const stamped: Match = { ...updatedMatch, lastUpdated: Date.now() };

    // Start timer on first scoring action
    startTimer();
    // Stop timer when match ends
    if (stamped.completed) stopTimer();

    setMatchHistory((prev) => [
      ...prev,
      { match: cloneMatch(currentMatch), timestamp: Date.now(), action },
    ]);
    setCurrentMatch(stamped);
    onUpdateMatch(stamped);
    realTimeUpdates.saveCurrentMatchData(stamped);
    realTimeUpdates.broadcastMatchUpdate(
      stamped,
      action,
      eventType || REAL_TIME_EVENTS.MATCH_UPDATED
    );
  };

  // ─── Complete the current set (padel) and advance match / next set ─────────
  const completeSet = (match: Match, g1: number, g2: number) => {
    const w: 'team1' | 'team2' = g1 > g2 ? 'team1' : 'team2';
    const completedSet: SetHistory = {
      setNumber: match.currentSet,
      team1Games: g1,
      team2Games: g2,
      winner: w,
      completed: true,
    };
    setSetHistory((prev) => [...prev, completedSet]);
    if (!match.setHistory) match.setHistory = [];
    match.setHistory.push(completedSet);

    if (w === 'team1') match.team1Score.sets++;
    else match.team2Score.sets++;

    if (match.team1Score.sets >= rules.setsToWin) {
      match.winner = match.team1;
      match.completed = true;
      match.status = 'completed';
    } else if (match.team2Score.sets >= rules.setsToWin) {
      match.winner = match.team2;
      match.completed = true;
      match.status = 'completed';
    } else {
      match.team1Score.games = 0;
      match.team2Score.games = 0;
      match.currentSet++;
    }
  };

  // ─── endGame helper (padel, non-deciding & clean wins) ─────────────────────
  const endGame = (match: Match, winner: 'team1' | 'team2') => {
    match.team1Score.points = 0;
    match.team2Score.points = 0;
    match.isDeuce = false;
    match.advantage = undefined;
    match.pointsInGame = 0;

    if (winner === 'team1') match.team1Score.games++;
    else match.team2Score.games++;

    // Serve rotates after each game
    match.servingTeam = match.servingTeam === 'team1' ? 'team2' : 'team1';

    const g1 = match.team1Score.games;
    const g2 = match.team2Score.games;
    const N = rules.gamesToWinSet;

    // Set won when a team reaches N games and leads. Covers a normal 6-4 and
    // the deciding clean win 6-5 (the N-1/N-1 game decided without a tiebreak).
    if ((g1 >= N && g1 > g2) || (g2 >= N && g2 > g1)) {
      completeSet(match, g1, g2);
    }
  };

  // ─── Deciding-game tiebreak (shared by race & padel) ───────────────────────
  // Triggered only when both teams are one game from winning (N-1 each) and the
  // game reaches 40-40. First to rules.tiebreakPoints (win by 2). Winner takes
  // the Nth game → match (race) or set (padel).
  const handleTiebreakPoint = (team: 'team1' | 'team2') => {
    const m = cloneMatch(currentMatch);
    if (!m.tiebreakPoints) m.tiebreakPoints = { team1: 0, team2: 0 };

    const prevTiePts = m.tiebreakPoints.team1 + m.tiebreakPoints.team2;
    m.tiebreakPoints[team]++;
    m.pointsInGame++;

    // Tiebreak serve rotates after the 1st point, then every 2
    if (m.pointsInGame > 0 && m.pointsInGame % 2 === 1) {
      m.servingTeam = m.servingTeam === 'team1' ? 'team2' : 'team1';
    }
    const newTiePts = m.tiebreakPoints.team1 + m.tiebreakPoints.team2;
    if (newTiePts > 0 && newTiePts % 6 === 0 && prevTiePts % 6 !== 0) {
      setShowChangeover(true);
    }

    const tb1 = m.tiebreakPoints.team1;
    const tb2 = m.tiebreakPoints.team2;
    const target = rules.tiebreakPoints;
    // Golden mode (and race, which is always golden): sudden death at
    // (target-1)-(target-1) → first to target wins outright (e.g. 7-6).
    // Advantage mode: must win the tiebreak by 2 (8-6, 9-7, ...).
    const goldenTiebreak = isRaceMode || rules.goldenPoint;
    const tbWon = goldenTiebreak
      ? (tb1 >= target && tb1 > tb2) || (tb2 >= target && tb2 > tb1)
      : (tb1 >= target && tb1 - tb2 >= 2) || (tb2 >= target && tb2 - tb1 >= 2);

    if (tbWon) {
      const winTeam: 'team1' | 'team2' = tb1 > tb2 ? 'team1' : 'team2';
      m.isTiebreaker = false;
      m.tiebreakPoints = undefined;
      m.pointsInGame = 0;
      m.team1Score.points = 0;
      m.team2Score.points = 0;

      if (isRaceMode) {
        // Winner reaches the race target → match won
        m.team1RaceScore = winTeam === 'team1' ? raceTarget : raceTarget - 1;
        m.team2RaceScore = winTeam === 'team2' ? raceTarget : raceTarget - 1;
        m.winner = winTeam === 'team1' ? m.team1 : m.team2;
        m.completed = true;
        m.status = 'completed';
      } else {
        // Winner takes the Nth game → 4-3 / 6-5, then set is completed
        const N = rules.gamesToWinSet;
        const g1 = winTeam === 'team1' ? N : N - 1;
        const g2 = winTeam === 'team1' ? N - 1 : N;
        m.team1Score.games = g1;
        m.team2Score.games = g2;
        completeSet(m, g1, g2);
        if (!m.completed) setShowChangeover(true);
      }
    }

    const teamName = team === 'team1' ? m.team1.name : m.team2.name;
    addToLog('Point', teamName);
    updateMatchWithHistory(
      m,
      `Tiebreak point for ${teamName}${m.completed ? ' — Match Won!' : ''}`,
      m.completed ? REAL_TIME_EVENTS.MATCH_COMPLETED : REAL_TIME_EVENTS.POINT_SCORED
    );
  };

  // ─── Race mode ────────────────────────────────────────────────────────────
  const handleRacePoint = (team: 'team1' | 'team2') => {
    const updatedMatch = addRacePoint(cloneMatch(currentMatch), team);
    const r1 = updatedMatch.team1RaceScore || 0;
    const r2 = updatedMatch.team2RaceScore || 0;

    // Deciding game (both one game from winning) reaching 40-40 → tiebreak
    // instead of a single golden point.
    if (
      updatedMatch.isGoldenPoint &&
      !updatedMatch.completed &&
      r1 === raceTarget - 1 &&
      r2 === raceTarget - 1
    ) {
      updatedMatch.isTiebreaker = true;
      updatedMatch.tiebreakPoints = { team1: 0, team2: 0 };
      updatedMatch.isGoldenPoint = false;
      updatedMatch.pointsInGame = 0;
      updatedMatch.team1Score.points = 0;
      updatedMatch.team2Score.points = 0;
      setShowChangeover(true);
    }

    const teamName = team === 'team1' ? updatedMatch.team1.name : updatedMatch.team2.name;
    const eventType = updatedMatch.completed
      ? REAL_TIME_EVENTS.MATCH_COMPLETED
      : REAL_TIME_EVENTS.POINT_SCORED;
    addToLog('Point', teamName);
    updateMatchWithHistory(
      updatedMatch,
      `Point for ${teamName}${updatedMatch.completed ? ' — Match Won!' : ''}`,
      eventType
    );
  };

  // ─── Padel mode (non-tiebreak point) ──────────────────────────────────────
  const handlePadelPoint = (team: 'team1' | 'team2') => {
    const prevGames = currentMatch.team1Score.games + currentMatch.team2Score.games;
    const prevSet = currentMatch.currentSet;
    const updatedMatch = cloneMatch(currentMatch);

    if (team === 'team1') updatedMatch.team1Score.points++;
    else updatedMatch.team2Score.points++;
    updatedMatch.pointsInGame++;

    const p1 = updatedMatch.team1Score.points;
    const p2 = updatedMatch.team2Score.points;
    const N = rules.gamesToWinSet;
    const deciding =
      updatedMatch.team1Score.games === N - 1 &&
      updatedMatch.team2Score.games === N - 1;

    if (p1 >= 3 && p2 >= 3) {
      if (p1 === p2) {
        if (deciding) {
          // Deciding game at 40-40 → switch to tiebreak instead of deuce
          updatedMatch.isTiebreaker = true;
          updatedMatch.tiebreakPoints = { team1: 0, team2: 0 };
          updatedMatch.pointsInGame = 0;
          updatedMatch.isDeuce = false;
          updatedMatch.advantage = undefined;
          updatedMatch.team1Score.points = 0;
          updatedMatch.team2Score.points = 0;
          setShowChangeover(true);
        } else {
          // 40-40: deuce (advantage mode) or golden point
          updatedMatch.isDeuce = true;
          updatedMatch.advantage = undefined;
        }
      } else if (rules.goldenPoint) {
        endGame(updatedMatch, p1 > p2 ? 'team1' : 'team2');
      } else if (p1 > p2) {
        if (updatedMatch.advantage === 'team1') {
          endGame(updatedMatch, 'team1');
        } else {
          updatedMatch.isDeuce = false;
          updatedMatch.advantage = 'team1';
        }
      } else {
        if (updatedMatch.advantage === 'team2') {
          endGame(updatedMatch, 'team2');
        } else {
          updatedMatch.isDeuce = false;
          updatedMatch.advantage = 'team2';
        }
      }
    } else if (p1 >= 4) {
      endGame(updatedMatch, 'team1');
    } else if (p2 >= 4) {
      endGame(updatedMatch, 'team2');
    }

    // Detect changeover after regular game ends
    if (!updatedMatch.isTiebreaker) {
      const newGames = updatedMatch.team1Score.games + updatedMatch.team2Score.games;
      const newSet = updatedMatch.currentSet;
      if (newSet !== prevSet) {
        setShowChangeover(true);
      } else if (newGames !== prevGames && newGames % 2 === 1) {
        setShowChangeover(true);
      }
    }

    const teamName =
      team === 'team1' ? updatedMatch.team1.name : updatedMatch.team2.name;
    addToLog('Point', teamName);
    updateMatchWithHistory(
      updatedMatch,
      `Point for ${teamName}`,
      REAL_TIME_EVENTS.POINT_SCORED
    );
  };

  // ─── Dispatcher ───────────────────────────────────────────────────────────
  const handlePoint = (team: 'team1' | 'team2') => {
    setFaultCount(0);
    if (currentMatch.isTiebreaker) handleTiebreakPoint(team);
    else if (isRaceMode) handleRacePoint(team);
    else handlePadelPoint(team);
  };

  // ─── Serve fault / let ────────────────────────────────────────────────────
  const handleFault = () => {
    const serverName =
      currentMatch.servingTeam === 'team1'
        ? currentMatch.team1.name
        : currentMatch.team2.name;

    if (faultCount === 0) {
      setFaultCount(1);
      addToLog('First Fault', serverName);
    } else {
      // Double fault → point to receiver
      setFaultCount(0);
      const receiver = currentMatch.servingTeam === 'team1' ? 'team2' : 'team1';
      addToLog('Double Fault', serverName);
      if (currentMatch.isTiebreaker) handleTiebreakPoint(receiver);
      else if (isRaceMode) handleRacePoint(receiver);
      else handlePadelPoint(receiver);
    }
  };

  const handleLet = () => {
    setFaultCount(0);
    addToLog('Let — Replay', '');
  };

  // ─── Switch serve ─────────────────────────────────────────────────────────
  const switchServe = () => {
    const updatedMatch = cloneMatch(currentMatch);
    updatedMatch.servingTeam =
      updatedMatch.servingTeam === 'team1' ? 'team2' : 'team1';
    updateMatchWithHistory(updatedMatch, 'Switch serve', REAL_TIME_EVENTS.SERVE_SWITCHED);
  };

  // ─── Quick win ────────────────────────────────────────────────────────────
  const confirmQuickWin = () => {
    if (!quickWinPending) return;
    const winner = quickWinPending;
    const target = currentMatch.raceTarget || 4;
    const updatedMatch = cloneMatch(currentMatch);

    // Set race scores with actual winner/loser scores
    updatedMatch.team1RaceScore = winner === 'team1' ? target : quickWinLoserScore;
    updatedMatch.team2RaceScore = winner === 'team2' ? target : quickWinLoserScore;
    updatedMatch.team1Score = { ...updatedMatch.team1Score, points: 0, games: 0 };
    updatedMatch.team2Score = { ...updatedMatch.team2Score, points: 0, games: 0 };
    updatedMatch.winner = winner === 'team1' ? updatedMatch.team1 : updatedMatch.team2;
    updatedMatch.completed = true;
    updatedMatch.status = 'completed';
    updatedMatch.isDeuce = false;
    updatedMatch.advantage = undefined;
    updatedMatch.isTiebreaker = false;
    updatedMatch.tiebreakPoints = undefined;
    updatedMatch.isGoldenPoint = false;

    const winnerName = winner === 'team1' ? updatedMatch.team1.name : updatedMatch.team2.name;
    const t1 = updatedMatch.team1RaceScore;
    const t2 = updatedMatch.team2RaceScore;
    updateMatchWithHistory(
      updatedMatch,
      `Quick win: ${updatedMatch.team1.name} ${t1}–${t2} ${updatedMatch.team2.name}`,
      REAL_TIME_EVENTS.MATCH_COMPLETED
    );
    setQuickWinPending(null);
    setQuickWinLoserScore(0);
  };

  // ─── Manual race score adjustment ────────────────────────────────────────
  const adjustRacePoint = (team: 'team1' | 'team2', delta: number) => {
    const updated = cloneMatch(currentMatch);
    if (team === 'team1') {
      updated.team1Score = { ...updated.team1Score, points: Math.max(0, Math.min(3, updated.team1Score.points + delta)) };
    } else {
      updated.team2Score = { ...updated.team2Score, points: Math.max(0, Math.min(3, updated.team2Score.points + delta)) };
    }
    const p1 = updated.team1Score.points;
    const p2 = updated.team2Score.points;
    updated.isGoldenPoint = p1 >= 3 && p2 >= 3;
    updateMatchWithHistory(updated, `Points adjusted`, REAL_TIME_EVENTS.MATCH_UPDATED);
  };

  const adjustRaceScore = (team: 'team1' | 'team2', delta: number) => {
    const updated = cloneMatch(currentMatch);
    const target = updated.raceTarget || 4;

    if (team === 'team1') {
      updated.team1RaceScore = Math.max(0, (updated.team1RaceScore || 0) + delta);
    } else {
      updated.team2RaceScore = Math.max(0, (updated.team2RaceScore || 0) + delta);
    }

    const t1 = updated.team1RaceScore || 0;
    const t2 = updated.team2RaceScore || 0;

    if (t1 >= target) {
      updated.winner = updated.team1;
      updated.completed = true;
      updated.status = 'completed';
      updated.team1Score = { ...updated.team1Score, points: 0 };
      updated.team2Score = { ...updated.team2Score, points: 0 };
      updated.isGoldenPoint = false;
    } else if (t2 >= target) {
      updated.winner = updated.team2;
      updated.completed = true;
      updated.status = 'completed';
      updated.team1Score = { ...updated.team1Score, points: 0 };
      updated.team2Score = { ...updated.team2Score, points: 0 };
      updated.isGoldenPoint = false;
    } else {
      updated.winner = undefined;
      updated.completed = false;
      updated.status = 'in-progress';
    }

    updateMatchWithHistory(updated, `Score adjusted: ${t1}–${t2}`, REAL_TIME_EVENTS.MATCH_UPDATED);
  };

  // ─── Undo ─────────────────────────────────────────────────────────────────
  const handleUndo = () => {
    if (matchHistory.length === 0) return;
    const lastState = matchHistory[matchHistory.length - 1];
    const restoredMatch = cloneMatch(lastState.match);
    setMatchHistory((prev) => prev.slice(0, -1));
    setFaultCount(0);
    setShowChangeover(false);
    setPointLog((prev) => prev.slice(1));
    setCurrentMatch(restoredMatch);
    onUpdateMatch(restoredMatch);
    if (lastState.action.includes('Set Win')) {
      setSetHistory((prev) => prev.slice(0, -1));
    }
    realTimeUpdates.saveCurrentMatchData(restoredMatch);
    realTimeUpdates.broadcastMatchUpdate(
      restoredMatch,
      `Undo: ${lastState.action}`,
      REAL_TIME_EVENTS.MATCH_UPDATED
    );
  };

  // ─── Situation detector (Game / Set / Match point) ────────────────────────
  const getSituation = () => {
    if (currentMatch.completed || isRaceMode) return null;

    const p1 = currentMatch.team1Score.points;
    const p2 = currentMatch.team2Score.points;
    const g1 = currentMatch.team1Score.games;
    const g2 = currentMatch.team2Score.games;
    const s1 = currentMatch.team1Score.sets;
    const s2 = currentMatch.team2Score.sets;

    if (currentMatch.isTiebreaker) {
      const tb1 = currentMatch.tiebreakPoints?.team1 || 0;
      const tb2 = currentMatch.tiebreakPoints?.team2 || 0;
      const tbMatchPt = rules.tiebreakPoints - 1;
      const lastSet = rules.setsToWin - 1;
      if (tb1 >= tbMatchPt && tb1 > tb2 && s1 === lastSet)
        return { text: `MATCH POINT — ${currentMatch.team1.name}`, style: 'bg-red-900/40 border-red-500 text-red-300' };
      if (tb2 >= tbMatchPt && tb2 > tb1 && s2 === lastSet)
        return { text: `MATCH POINT — ${currentMatch.team2.name}`, style: 'bg-red-900/40 border-red-500 text-red-300' };
      return null;
    }

    const lastSet = rules.setsToWin - 1;
    const setPtGames = rules.gamesToWinSet - 1;
    const t1GamePt = (p1 >= 3 && p1 > p2) || currentMatch.advantage === 'team1';
    const t2GamePt = (p2 >= 3 && p2 > p1) || currentMatch.advantage === 'team2';
    const t1SetPt = t1GamePt && g1 >= setPtGames && g1 >= g2;
    const t2SetPt = t2GamePt && g2 >= setPtGames && g2 >= g1;
    const t1MatchPt = t1SetPt && s1 === lastSet;
    const t2MatchPt = t2SetPt && s2 === lastSet;

    if (t1MatchPt) return { text: `MATCH POINT — ${currentMatch.team1.name}`, style: 'bg-red-900/40 border-red-500 text-red-300 animate-pulse' };
    if (t2MatchPt) return { text: `MATCH POINT — ${currentMatch.team2.name}`, style: 'bg-red-900/40 border-red-500 text-red-300 animate-pulse' };
    if (t1SetPt) return { text: `SET POINT — ${currentMatch.team1.name}`, style: 'bg-orange-900/40 border-orange-500 text-orange-300' };
    if (t2SetPt) return { text: `SET POINT — ${currentMatch.team2.name}`, style: 'bg-orange-900/40 border-orange-500 text-orange-300' };
    if (t1GamePt) return { text: `GAME POINT — ${currentMatch.team1.name}`, style: 'bg-yellow-900/30 border-yellow-600 text-yellow-300' };
    if (t2GamePt) return { text: `GAME POINT — ${currentMatch.team2.name}`, style: 'bg-yellow-900/30 border-yellow-600 text-yellow-300' };
    return null;
  };

  const situation = getSituation();
  const servingTeamName =
    currentMatch.servingTeam === 'team1'
      ? currentMatch.team1.name
      : currentMatch.team2.name;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const winnerName = quickWinPending
    ? (quickWinPending === 'team1' ? currentMatch.team1.name : currentMatch.team2.name)
    : '';

  return (
    <>
      {/* ── Quick Win Confirmation Dialog ── */}
      {quickWinPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="font-bold text-[#2A2A2A] text-lg">Confirm Quick Win</h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Winner: <span className="font-bold text-[#2A2A2A]">{winnerName}</span>
            </p>

            <div className="mb-5">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Loser's score</p>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuickWinLoserScore(n)}
                    className={`flex-1 py-2.5 rounded-xl font-black text-lg border-2 transition-all ${
                      quickWinLoserScore === n
                        ? 'bg-[#B45330] text-white border-[#B45330]'
                        : 'bg-[#FAF8F5] text-[#2A2A2A] border-[#F0EBE3] hover:border-[#B45330]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-gray-500 mt-2 font-mono">
                Final: <span className="font-bold text-[#2A2A2A]">
                  {quickWinPending === 'team1'
                    ? `${raceTarget}–${quickWinLoserScore}`
                    : `${quickWinLoserScore}–${raceTarget}`}
                </span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setQuickWinPending(null); setQuickWinLoserScore(0); }}
                className="flex-1 py-2 rounded-xl border border-[#D4C9BB] text-gray-600 hover:bg-[#F0EBE3] transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmQuickWin}
                className="flex-1 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition-colors"
              >
                Confirm Win
              </button>
            </div>
          </div>
        </div>
      )}

      {showSpectatorView && (
        <SpectatorView
          match={currentMatch}
          onClose={() => setShowSpectatorView(false)}
          tournamentName={tournamentName}
          tournamentId={tournament?.id}
          setHistory={setHistory}
        />
      )}

      <div className="min-h-screen bg-[#FAF8F5] font-mono text-[#2A2A2A] p-4 sm:p-6 flex flex-col">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        {/* ── Header ── */}
        <header className="relative z-10 flex items-center justify-between mb-5 w-full max-w-5xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-[#2A2A2A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>

          <div className="text-center">
            <h2 className="text-xl font-bold text-[#2A2A2A]">Live Match Scoring</h2>
            <div className="flex items-center justify-center gap-3 mt-0.5">
              {isRaceMode ? (
                <div className="flex items-center gap-1.5 text-sm">
                  <Target className="w-3.5 h-3.5 text-[#B45330]" />
                  <span className="text-gray-600">Race to {raceTarget}</span>
                </div>
              ) : (
                <p className="text-gray-600 text-sm">
                  Set {currentMatch.currentSet} of 3
                  {currentMatch.isTiebreaker && <span className="text-blue-400 font-semibold"> — TIEBREAK</span>}
                </p>
              )}
              {/* Stopwatch */}
              {matchStartedAtRef.current !== null && (
                <div className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                  <Timer className="w-3 h-3" />
                  {formatElapsed(elapsedSeconds)}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowSpectatorView(true)}
              className="flex items-center gap-1.5 bg-white text-[#8B7355] border border-[#8B7355]/50 px-3 py-1.5 rounded-xl text-sm transition-all hover:bg-[#8B7355]/10"
            >
              <Monitor className="w-4 h-4 text-[#8B7355]" /> View
            </button>
            <button
              onClick={() => openSpectatorWindow(currentMatch.id, tournamentName, tournament?.id)}
              className="flex items-center gap-1.5 bg-white text-[#8B7355] border border-[#8B7355]/50 px-3 py-1.5 rounded-xl text-sm transition-all hover:bg-[#8B7355]/10"
            >
              <ExternalLink className="w-4 h-4 text-[#8B7355]" /> Pop-out
            </button>
            <button
              onClick={() => setShowNotes(n => !n)}
              className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-xl text-sm transition-all ${matchNote ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : 'bg-white text-[#8B7355] border-[#8B7355]/50 hover:bg-[#8B7355]/10'}`}
            >
              <FileText className="w-4 h-4" /> {matchNote ? 'Note ●' : 'Note'}
            </button>
          </div>
        </header>

        <main className="relative z-10 w-full max-w-5xl mx-auto flex-grow flex flex-col gap-4">

          {/* ── Notes panel ── */}
          {showNotes && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
              <div className="text-xs font-bold text-yellow-700 uppercase tracking-widest mb-2">Match Note</div>
              <textarea
                value={matchNote}
                onChange={(e) => setMatchNote(e.target.value)}
                placeholder="e.g. Team A requested timeout, court changed, injury..."
                className="w-full text-sm bg-white border border-yellow-200 rounded-lg p-3 text-[#2A2A2A] placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
                rows={3}
              />
            </div>
          )}

          {/* ── Set history strip ── */}
          {setHistory.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-500 text-xs uppercase tracking-widest">Sets:</span>
              {setHistory.map((s) => (
                <span
                  key={s.setNumber}
                  className={`px-3 py-1 rounded-lg border text-sm font-bold ${
                    s.winner === 'team1'
                      ? 'bg-[#B45330]/10 border-[#B45330]/40 text-[#B45330]'
                      : 'bg-[#8B7355]/10 border-[#8B7355]/40 text-[#A89070]'
                  }`}
                >
                  Set {s.setNumber}: {s.team1Games}–{s.team2Games}
                </span>
              ))}
            </div>
          )}

          {/* ── Golden point banner ── */}
          {isRaceMode && currentMatch.isGoldenPoint && (
            <div className="py-2 px-6 bg-gradient-to-r from-yellow-500/20 via-yellow-400/30 to-yellow-500/20 border border-yellow-400/60 rounded-xl text-center animate-pulse">
              <span className="text-xl font-black text-yellow-300 tracking-wider">⚡ GOLDEN POINT ⚡</span>
            </div>
          )}

          {/* ── Deciding tiebreak banner ── */}
          {currentMatch.isTiebreaker && (
            <div className="py-2 px-6 bg-gradient-to-r from-blue-500/20 via-blue-400/30 to-blue-500/20 border border-blue-400/60 rounded-xl text-center animate-pulse">
              <span className="text-xl font-black text-blue-500 tracking-wider">🎾 TIEBREAK — first to {rules.tiebreakPoints}</span>
            </div>
          )}

          {/* ── Situation banner (Match / Set / Game point) ── */}
          {situation && (
            <div className={`py-2 px-6 border rounded-xl text-center ${situation.style}`}>
              <span className="text-base font-black tracking-wider">🎯 {situation.text}</span>
            </div>
          )}

          {/* ── Changeover banner ── */}
          {showChangeover && !currentMatch.completed && (
            <div className="py-3 px-5 bg-blue-50 border border-blue-300 rounded-xl flex items-center justify-between">
              <span className="text-blue-700 font-bold">🔄 CHANGE SIDES</span>
              <button
                onClick={() => setShowChangeover(false)}
                className="text-blue-600 hover:text-blue-800 bg-blue-100 px-3 py-1 rounded-lg text-sm transition-colors"
              >
                Done ✓
              </button>
            </div>
          )}

          {/* ── First fault indicator ── */}
          {faultCount === 1 && (
            <div className="py-2 px-4 bg-yellow-900/30 border border-yellow-500/60 rounded-xl text-center">
              <span className="text-yellow-300 font-semibold text-sm">
                ⚠️ FIRST FAULT — Second serve
              </span>
            </div>
          )}

          {/* ── Scoreboard ── */}
          <div
            className={`bg-white border rounded-2xl p-5 text-[#2A2A2A] ${
              isRaceMode && currentMatch.isGoldenPoint
                ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]'
                : currentMatch.isTiebreaker
                ? 'border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                : 'border-[#8B7355] shadow-[0_0_15px_rgba(139,115,85,0.15)]'
            }`}
          >
            <div className="grid grid-cols-2 gap-4 divide-x divide-[#F0EBE3]">

              {/* Team 1 */}
              <div className="text-center pr-4">
                <div className="flex items-center justify-center gap-2 mb-2 min-h-[36px]">
                  {currentMatch.servingTeam === 'team1' && (
                    <span className="text-base" title="Serving">🎾</span>
                  )}
                  <h3
                    className={`text-xl font-bold truncate transition-colors ${
                      currentMatch.servingTeam === 'team1' ? 'text-[#2A2A2A]' : 'text-gray-400'
                    }`}
                  >
                    {currentMatch.team1.name}
                  </h3>
                </div>

                {isRaceMode ? (
                  <>
                    <div className="text-7xl font-bold text-[#B45330] mb-1">
                      {currentMatch.isTiebreaker
                        ? (currentMatch.tiebreakPoints?.team1 || 0)
                        : getRacePointDisplay(currentMatch.team1Score.points)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Games: <span className="text-[#2A2A2A] font-bold">{currentMatch.team1RaceScore || 0}</span> / {raceTarget}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-7xl font-bold text-[#B45330] mb-1">
                      {currentMatch.isTiebreaker
                        ? currentMatch.tiebreakPoints?.team1 || 0
                        : getDisplayScore(
                            currentMatch.team1Score,
                            currentMatch.isDeuce,
                            currentMatch.advantage,
                            'team1'
                          )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Sets: <span className="text-[#2A2A2A] font-bold">{currentMatch.team1Score.sets}</span>
                      {' · '}
                      Games: <span className="text-[#2A2A2A] font-bold">{currentMatch.team1Score.games}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Team 2 */}
              <div className="text-center pl-4">
                <div className="flex items-center justify-center gap-2 mb-2 min-h-[36px]">
                  {currentMatch.servingTeam === 'team2' && (
                    <span className="text-base" title="Serving">🎾</span>
                  )}
                  <h3
                    className={`text-xl font-bold truncate transition-colors ${
                      currentMatch.servingTeam === 'team2' ? 'text-[#2A2A2A]' : 'text-gray-400'
                    }`}
                  >
                    {currentMatch.team2.name}
                  </h3>
                </div>

                {isRaceMode ? (
                  <>
                    <div className="text-7xl font-bold text-[#A89070] mb-1">
                      {currentMatch.isTiebreaker
                        ? (currentMatch.tiebreakPoints?.team2 || 0)
                        : getRacePointDisplay(currentMatch.team2Score.points)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Games: <span className="text-[#2A2A2A] font-bold">{currentMatch.team2RaceScore || 0}</span> / {raceTarget}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-7xl font-bold text-[#A89070] mb-1">
                      {currentMatch.isTiebreaker
                        ? currentMatch.tiebreakPoints?.team2 || 0
                        : getDisplayScore(
                            currentMatch.team2Score,
                            currentMatch.isDeuce,
                            currentMatch.advantage,
                            'team2'
                          )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Sets: <span className="text-[#2A2A2A] font-bold">{currentMatch.team2Score.sets}</span>
                      {' · '}
                      Games: <span className="text-[#2A2A2A] font-bold">{currentMatch.team2Score.games}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Serving info + court */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[#8B7355]/20 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Serving:</span>
                <span className="text-[#2A2A2A] font-semibold">{servingTeamName}</span>
                <span>🎾</span>
              </div>
              {currentMatch.courtId && tournament && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#8B7355]" />
                  <span className="text-[#A89070] font-medium">
                    {getCourtName(tournament, currentMatch.courtId)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!currentMatch.completed ? (
            <>
              {/* ── Main point buttons ── */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePoint('team1')}
                  className={`py-8 px-4 rounded-xl font-bold text-xl transition-all duration-150 shadow-lg transform active:scale-95 hover:scale-[1.02] ${
                    isRaceMode && currentMatch.isGoldenPoint
                      ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black'
                      : 'bg-[#B45330] text-white hover:bg-[#C96A40]'
                  }`}
                >
                  +1 {currentMatch.team1.name}
                </button>
                <button
                  onClick={() => handlePoint('team2')}
                  className={`py-8 px-4 rounded-xl font-bold text-xl transition-all duration-150 shadow-lg transform active:scale-95 hover:scale-[1.02] ${
                    isRaceMode && currentMatch.isGoldenPoint
                      ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black'
                      : 'bg-[#8B7355] text-white hover:bg-[#A89070]'
                  }`}
                >
                  +1 {currentMatch.team2.name}
                </button>
              </div>

              {/* ── Serve controls ── */}
              <div className="bg-white border border-[#F0EBE3] rounded-xl p-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                  Serve Controls
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Fault / Double fault — padel only */}
                  {!isRaceMode && (
                    <button
                      onClick={handleFault}
                      className={`flex-1 min-w-[110px] py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors ${
                        faultCount === 0
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-400 hover:bg-yellow-100'
                          : 'bg-red-600 text-white border border-red-400 hover:bg-red-500'
                      }`}
                    >
                      {faultCount === 0 ? '⚠️ Fault' : '❌ Double Fault!'}
                    </button>
                  )}

                  {/* Let — padel only */}
                  {!isRaceMode && (
                    <button
                      onClick={handleLet}
                      className="flex-1 min-w-[90px] py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#F0EBE3] text-gray-700 border border-[#D4C9BB] hover:bg-[#E8E0D5] transition-colors"
                    >
                      🔄 Let
                    </button>
                  )}

                  {/* Switch serve — always available */}
                  <button
                    onClick={switchServe}
                    className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm bg-[#F0EBE3] text-gray-700 border border-[#D4C9BB] hover:bg-[#E8E0D5] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Switch Serve
                  </button>
                </div>
              </div>

              {/* ── Match controls ── */}
              <div className="bg-white border border-[#F0EBE3] rounded-xl p-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                  Match Controls
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={matchHistory.length === 0}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm bg-[#FFFFFF] text-red-400 border border-red-500/50 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Undo className="w-4 h-4" /> Undo
                    {matchHistory.length > 0 && (
                      <span className="bg-red-900/60 text-red-300 text-xs px-1.5 py-0.5 rounded-full">
                        {matchHistory.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => { setQuickWinPending('team1'); setQuickWinLoserScore(0); }}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm bg-[#FFFFFF] text-yellow-400 border border-yellow-400/50 hover:bg-yellow-400/10 transition-colors"
                  >
                    <Zap className="w-4 h-4" /> Win: {currentMatch.team1.name}
                  </button>

                  <button
                    onClick={() => { setQuickWinPending('team2'); setQuickWinLoserScore(0); }}
                    className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm bg-[#FFFFFF] text-yellow-400 border border-yellow-400/50 hover:bg-yellow-400/10 transition-colors"
                  >
                    <Zap className="w-4 h-4" /> Win: {currentMatch.team2.name}
                  </button>
                </div>
              </div>

              {/* ── Race target override (race mode only) ── */}
              {isRaceMode && (
                <div className="bg-white border border-[#B45330]/30 rounded-xl p-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Target className="w-3 h-3" /> Race Target (this match)
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[4, 6, 8, 10].map(n => (
                      <button
                        key={n}
                        onClick={() => {
                          const updated = cloneMatch(currentMatch);
                          updated.raceTarget = n;
                          updateMatchWithHistory(updated, `Race target changed to ${n}`, REAL_TIME_EVENTS.MATCH_UPDATED);
                        }}
                        className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${raceTarget === n
                          ? 'bg-[#B45330] text-white shadow-md'
                          : 'bg-[#FAF8F5] text-gray-600 border border-[#F0EBE3] hover:border-[#B45330]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 ml-1">
                      <button
                        onClick={() => {
                          const updated = cloneMatch(currentMatch);
                          updated.raceTarget = Math.max(1, raceTarget - 1);
                          updateMatchWithHistory(updated, `Race target changed to ${updated.raceTarget}`, REAL_TIME_EVENTS.MATCH_UPDATED);
                        }}
                        className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold transition-colors"
                      >−</button>
                      <span className="w-8 text-center font-bold text-[#B45330]">{raceTarget}</span>
                      <button
                        onClick={() => {
                          const updated = cloneMatch(currentMatch);
                          updated.raceTarget = raceTarget + 1;
                          updateMatchWithHistory(updated, `Race target changed to ${updated.raceTarget}`, REAL_TIME_EVENTS.MATCH_UPDATED);
                        }}
                        className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold transition-colors"
                      >+</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Manual score adjustment (race mode only) ── */}
              {isRaceMode && (
                <div className="bg-white border border-orange-300/50 rounded-xl p-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                    Adjust Score
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Team 1 */}
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 truncate font-medium">{currentMatch.team1.name}</div>
                      {/* Points */}
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Points</div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => adjustRacePoint('team1', -1)} disabled={currentMatch.team1Score.points <= 0}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                          <span className="flex-1 text-center text-lg font-bold text-[#B45330]">
                            {getRacePointDisplay(currentMatch.team1Score.points)}
                          </span>
                          <button onClick={() => adjustRacePoint('team1', 1)} disabled={currentMatch.team1Score.points >= 3}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                        </div>
                      </div>
                      {/* Games */}
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Games</div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => adjustRaceScore('team1', -1)} disabled={(currentMatch.team1RaceScore || 0) <= 0}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                          <span className="flex-1 text-center text-lg font-bold text-[#B45330]">
                            {currentMatch.team1RaceScore || 0}
                          </span>
                          <button onClick={() => adjustRaceScore('team1', 1)}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold text-sm transition-colors">+</button>
                        </div>
                      </div>
                    </div>
                    {/* Team 2 */}
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 truncate font-medium">{currentMatch.team2.name}</div>
                      {/* Points */}
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Points</div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => adjustRacePoint('team2', -1)} disabled={currentMatch.team2Score.points <= 0}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#8B7355] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                          <span className="flex-1 text-center text-lg font-bold text-[#8B7355]">
                            {getRacePointDisplay(currentMatch.team2Score.points)}
                          </span>
                          <button onClick={() => adjustRacePoint('team2', 1)} disabled={currentMatch.team2Score.points >= 3}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#8B7355] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                        </div>
                      </div>
                      {/* Games */}
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Games</div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => adjustRaceScore('team2', -1)} disabled={(currentMatch.team2RaceScore || 0) <= 0}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#8B7355] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                          <span className="flex-1 text-center text-lg font-bold text-[#8B7355]">
                            {currentMatch.team2RaceScore || 0}
                          </span>
                          <button onClick={() => adjustRaceScore('team2', 1)}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#8B7355] font-bold text-sm transition-colors">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Point log ── */}
              {pointLog.length > 0 && (
                <div className="bg-white border border-[#F0EBE3] rounded-xl p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                    Recent Actions
                  </div>
                  <div className="space-y-1">
                    {pointLog.map((entry, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-sm transition-opacity ${
                          i === 0 ? 'opacity-100' : `opacity-${Math.max(30, 70 - i * 10)}`
                        }`}
                        style={{ opacity: Math.max(0.2, 1 - i * 0.15) }}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            i === 0 ? 'bg-[#B45330]' : 'bg-gray-600'
                          }`}
                        />
                        {entry.team && (
                          <span className={`font-medium ${i === 0 ? 'text-[#2A2A2A]' : 'text-gray-500'}`}>
                            {entry.team}
                          </span>
                        )}
                        {entry.action !== 'Point' && (
                          <span className="text-gray-500 text-xs">— {entry.action}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ── Match complete view ── */
            <div className="space-y-4">
              {/* Winner card */}
              <div className="text-center py-8 bg-white border-2 border-[#B45330] rounded-2xl shadow-[0_0_30px_rgba(180,83,48,0.2)]">
                <Trophy className="w-14 h-14 text-[#B45330] mx-auto mb-3" />
                <div className="text-3xl font-bold text-[#2A2A2A] mb-1">
                  {currentMatch.winner?.name}
                </div>
                <div className="text-[#B45330] font-semibold tracking-widest text-sm uppercase">
                  Winner
                </div>
                {isRaceMode && (
                  <div className="text-gray-400 mt-2">
                    {currentMatch.team1RaceScore} – {currentMatch.team2RaceScore} games
                  </div>
                )}
              </div>

              {/* Set-by-set summary */}
              {setHistory.length > 0 && (
                <div className="bg-[#FFFFFF]/80 border border-[#F0EBE3] rounded-xl p-4">
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-4">
                    Match Summary
                  </div>

                  {/* Headers */}
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mb-2 px-1">
                    <div>Set</div>
                    <div className="text-center font-bold text-[#B45330]">
                      {currentMatch.team1.name}
                    </div>
                    <div className="text-center font-bold text-[#A89070]">
                      {currentMatch.team2.name}
                    </div>
                  </div>

                  {/* Set rows */}
                  {setHistory.map((s) => (
                    <div
                      key={s.setNumber}
                      className={`grid grid-cols-3 gap-2 py-2 px-1 rounded mb-1 text-sm ${
                        s.winner === 'team1' ? 'bg-[#B45330]/5' : 'bg-[#8B7355]/5'
                      }`}
                    >
                      <div className="text-gray-500">Set {s.setNumber}</div>
                      <div
                        className={`text-center font-bold ${
                          s.winner === 'team1' ? 'text-[#B45330]' : 'text-gray-500'
                        }`}
                      >
                        {s.team1Games}
                      </div>
                      <div
                        className={`text-center font-bold ${
                          s.winner === 'team2' ? 'text-[#A89070]' : 'text-gray-500'
                        }`}
                      >
                        {s.team2Games}
                      </div>
                    </div>
                  ))}

                  {/* Sets won total */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-1 mt-1 border-t border-[#F0EBE3] text-sm">
                    <div className="text-gray-400 font-bold">Total Sets</div>
                    <div
                      className={`text-center font-bold ${
                        currentMatch.winner?.id === currentMatch.team1.id
                          ? 'text-[#B45330]'
                          : 'text-gray-500'
                      }`}
                    >
                      {currentMatch.team1Score.sets}
                    </div>
                    <div
                      className={`text-center font-bold ${
                        currentMatch.winner?.id === currentMatch.team2.id
                          ? 'text-[#A89070]'
                          : 'text-gray-500'
                      }`}
                    >
                      {currentMatch.team2Score.sets}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Manual score adjustment for completed race match ── */}
              {isRaceMode && (
                <div className="bg-white border border-orange-300/50 rounded-xl p-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                    Adjust Score
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Team 1 */}
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 truncate font-medium">{currentMatch.team1.name}</div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Points</div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => adjustRacePoint('team1', -1)} disabled={currentMatch.team1Score.points <= 0}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                          <span className="flex-1 text-center text-lg font-bold text-[#B45330]">
                            {getRacePointDisplay(currentMatch.team1Score.points)}
                          </span>
                          <button onClick={() => adjustRacePoint('team1', 1)} disabled={currentMatch.team1Score.points >= 3}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Games</div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => adjustRaceScore('team1', -1)} disabled={(currentMatch.team1RaceScore || 0) <= 0}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                          <span className="flex-1 text-center text-lg font-bold text-[#B45330]">
                            {currentMatch.team1RaceScore || 0}
                          </span>
                          <button onClick={() => adjustRaceScore('team1', 1)}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#B45330] font-bold text-sm transition-colors">+</button>
                        </div>
                      </div>
                    </div>
                    {/* Team 2 */}
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 truncate font-medium">{currentMatch.team2.name}</div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Points</div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => adjustRacePoint('team2', -1)} disabled={currentMatch.team2Score.points <= 0}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#8B7355] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                          <span className="flex-1 text-center text-lg font-bold text-[#8B7355]">
                            {getRacePointDisplay(currentMatch.team2Score.points)}
                          </span>
                          <button onClick={() => adjustRacePoint('team2', 1)} disabled={currentMatch.team2Score.points >= 3}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#8B7355] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Games</div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => adjustRaceScore('team2', -1)} disabled={(currentMatch.team2RaceScore || 0) <= 0}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#8B7355] font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                          <span className="flex-1 text-center text-lg font-bold text-[#8B7355]">
                            {currentMatch.team2RaceScore || 0}
                          </span>
                          <button onClick={() => adjustRaceScore('team2', 1)}
                            className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#F0EBE3] text-gray-600 hover:border-[#8B7355] font-bold text-sm transition-colors">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {matchHistory.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-colors font-semibold"
                >
                  <Undo className="w-4 h-4" /> Undo Last Point
                  <span className="bg-red-900/60 text-red-300 text-xs px-1.5 py-0.5 rounded-full">
                    {matchHistory.length}
                  </span>
                </button>
              )}

              {onNextMatch && (
                <button
                  onClick={onNextMatch}
                  className="w-full py-3 bg-[#B45330] text-white rounded-xl font-bold hover:bg-[#C96A40] transition-colors"
                >
                  Next Match →
                </button>
              )}

              <button
                onClick={onBack}
                className="w-full py-3 bg-white border border-[#F0EBE3] rounded-xl text-gray-600 hover:text-[#2A2A2A] hover:border-[#D4C9BB] transition-colors"
              >
                ← Back to Bracket
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
