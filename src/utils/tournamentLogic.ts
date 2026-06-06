import {
  Tournament,
  Team,
  Match,
  TournamentFormat,
  Court,
  MatchStatus,
  Group,
  Club,
  Tie,
  ClashPool,
  RUBBER_CATEGORIES,
  TournamentConfig,
  DEFAULT_MATCH_RULES,
} from '../types/tournament';
import { createEmptyScore } from './padelScoring';

/**
 * Mode-agnostic standings comparator (higher = better, sorts ascending index).
 * Race mode populates pointsWon/pointsLost; padel mode populates sets/games.
 * The inactive mode's fields stay 0, so one comparator serves both.
 */
function compareStandings(a: Team, b: Team): number {
  const winDiff = (b.wins || 0) - (a.wins || 0);
  if (winDiff !== 0) return winDiff;

  const pointDiff =
    (b.pointsWon || 0) - (b.pointsLost || 0) -
    ((a.pointsWon || 0) - (a.pointsLost || 0));
  if (pointDiff !== 0) return pointDiff;

  const setDiff =
    (b.setsWon || 0) - (b.setsLost || 0) -
    ((a.setsWon || 0) - (a.setsLost || 0));
  if (setDiff !== 0) return setDiff;

  const gameDiff =
    (b.gamesWon || 0) - (b.gamesLost || 0) -
    ((a.gamesWon || 0) - (a.gamesLost || 0));
  return gameDiff;
}

/**
 * Standard recursive bracket seed order for a power-of-2 field.
 * Returns 0-indexed seeds in slot order so that, with a position-pair merge
 * (slots 2p / 2p+1 feed the next round), the top two seeds only meet in the
 * final. e.g. n=8 → [0,7,4,3,2,5,6,1].
 */
function getSeedSlots(n: number): number[] {
  let slots = [1, 2];
  while (slots.length < n) {
    const sum = slots.length * 2 + 1;
    const next: number[] = [];
    for (const s of slots) {
      next.push(s);
      next.push(sum - s);
    }
    slots = next;
  }
  return slots.map((s) => s - 1);
}

/**
 * Knockout bracket size: power of 2 derived from how many real qualifiers
 * exist (qualifiersPerGroup from each group, capped by group size). Keeps
 * placeholder generation and advancement consistent for any team count.
 */
function computeKnockoutSize(
  groups: { teams: Team[] }[],
  qualifiersPerGroup: number
): number {
  const available = groups.reduce(
    (sum, g) => sum + Math.min(qualifiersPerGroup, g.teams.length),
    0
  );
  return Math.pow(2, Math.floor(Math.log2(Math.max(2, available))));
}

export function generateDummyTeams(count: 4 | 8 | 16): Team[] {
  const teamNames = [
    'Smash Masters',
    'Net Ninjas',
    'Court Kings',
    'Paddle Power',
    'Glass Warriors',
    'Baseline Beasts',
    'Volley Vipers',
    'Ace Attackers',
    'Drop Shot Dragons',
    'Lob Legends',
    'Spin Specialists',
    'Wall Warriors',
    'Corner Crushers',
    'Service Sharks',
    'Rally Rockets',
    'Court Crusaders',
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i + 1}`,
    name: teamNames[i] || `Team ${i + 1}`,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
  }));
}

export function createTournament(
  name: string,
  format: TournamentFormat,
  teams: Team[],
  courts: Court[] = [],
  scoringMode: 'padel' | 'race' = 'padel',
  raceTarget: number = 4,
  config?: Partial<TournamentConfig>
): Tournament {
  const matchRules = { ...DEFAULT_MATCH_RULES, ...(config?.matchRules || {}) };
  const teamsPerGroup = config?.teamsPerGroup ?? 4;
  const qualifiersPerGroup = config?.qualifiersPerGroup ?? 2;
  const isClash = format === 'clash';
  const clubs = isClash ? config?.clubs ?? [] : undefined;
  const clashStructure = isClash ? config?.clashStructure ?? 'rr-final' : undefined;
  // Clash teams = every club's three category teams flattened.
  const effectiveTeams = isClash && clubs
    ? clubs.flatMap((c) => RUBBER_CATEGORIES.map((cat) => c.teams[cat]))
    : teams;

  // Pool-knockout: split clubs into 2 or 3 balanced pools.
  const clashPoolCount =
    isClash && clashStructure === 'pool-knockout'
      ? config?.clashPoolCount ?? 3
      : undefined;
  const clashPools =
    isClash && clashStructure === 'pool-knockout' && clubs
      ? balancedPools(clubs, clashPoolCount ?? 3)
      : undefined;

  const tournament: Tournament = {
    id: `tournament-${Date.now()}`,
    name,
    format,
    teams: effectiveTeams,
    matches: [],
    courts,
    currentRound: 1,
    completed: false,
    createdAt: new Date().toISOString(),
    matchDuration: 90,
    breakBetweenMatches: 15,
    groups: format === 'group-knockout' ? [] : undefined,
    groupStage: format === 'group-knockout',
    // Squad Battle uses fixed per-stage race scoring, so it is always race mode.
    scoringMode: clashStructure === 'pool-knockout' ? 'race' : scoringMode,
    raceTarget,
    matchRules,
    teamsPerGroup,
    qualifiersPerGroup,
    thirdPlace: config?.thirdPlace ?? false,
    clubs,
    clashStructure,
    clashStage: isClash
      ? clashStructure === 'pool-knockout'
        ? 'pool'
        : 'round-robin'
      : undefined,
    clashPools,
    clashPoolCount,
    clashThirdPlace: isClash && clashStructure === 'pool-knockout'
      ? config?.clashThirdPlace ?? true
      : undefined,
  };
  tournament.matches = generateMatches(tournament);

  // Attach padel rules to every match (race mode uses raceTarget instead)
  if (scoringMode !== 'race') {
    tournament.matches.forEach((m) => {
      m.rules = matchRules;
    });
  }

  return tournament;
}

function generateFairRoundRobinMatches(
  teams: Team[],
  round: number,
  matchIdOffset: number = 0,
  groupId?: string
): Match[] {
  const matches: Match[] = [];
  let matchId = matchIdOffset;
  let scheduleTeams = [...teams];

  if (scheduleTeams.length % 2 !== 0) {
    scheduleTeams.push({ id: 'bye', name: 'BYE' });
  }

  const numTeams = scheduleTeams.length;
  const numRounds = numTeams - 1;
  const halfNumTeams = numTeams / 2;

  for (let r = 0; r < numRounds; r++) {
    for (let i = 0; i < halfNumTeams; i++) {
      const team1 = scheduleTeams[i];
      const team2 = scheduleTeams[numTeams - 1 - i];

      if (team1.id !== 'bye' && team2.id !== 'bye') {
        const match = createMatch(
          `match-${matchId++}`,
          team1,
          team2,
          round,
          matches.length,
          groupId
        );
        matches.push(match);
      }
    }

    const lastTeam = scheduleTeams.pop();
    if (lastTeam) {
      scheduleTeams.splice(1, 0, lastTeam);
    }
  }

  return matches;
}

function generateMatches(tournament: Tournament): Match[] {
  switch (tournament.format) {
    case 'round-robin':
      return generateRoundRobinMatches(tournament.teams);
    case 'single-elimination':
      return generateEliminationMatches(tournament.teams, tournament.scoringMode, tournament.raceTarget, tournament.thirdPlace);
    case 'group-knockout':
      return generateGroupKnockoutMatches(tournament);
    case 'clash':
      return tournament.clashStructure === 'pool-knockout'
        ? generateClashPoolKnockout(tournament)
        : generateClashMatches(tournament);
    default:
      return [];
  }
}

// ─── Clash (club vs club) generation ─────────────────────────────────────────

// Round-robin pairings of clubs via the circle method (each club plays once
// per round). Returns club-vs-club ties spread across rounds.
function roundRobinClubPairings(
  clubs: Club[]
): { round: number; a: Club; b: Club }[] {
  const arr: (Club | null)[] = [...clubs];
  if (arr.length % 2 !== 0) arr.push(null); // bye
  const n = arr.length;
  const out: { round: number; a: Club; b: Club }[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) out.push({ round: r + 1, a, b });
    }
    const last = arr.pop();
    if (last !== undefined) arr.splice(1, 0, last);
  }
  return out;
}

function applyRubberScoring(m: Match, tournament: Tournament): void {
  if (tournament.scoringMode === 'race') {
    m.scoringMode = 'race';
    m.raceTarget = tournament.raceTarget || 4;
    m.team1RaceScore = 0;
    m.team2RaceScore = 0;
    m.isGoldenPoint = false;
  }
}

function generateClashMatches(tournament: Tournament): Match[] {
  const clubs = tournament.clubs ?? [];
  const structure = tournament.clashStructure ?? 'rr-final';
  const matches: Match[] = [];
  const ties: Tie[] = [];
  let matchId = 1;
  let tieId = 1;

  // Build the 3 rubbers (men/women/mix) for a tie between two clubs.
  const buildRubbers = (
    tie: Tie,
    club1: Club | null,
    club2: Club | null,
    round: number
  ) => {
    RUBBER_CATEGORIES.forEach((cat, idx) => {
      const team1 = club1 ? club1.teams[cat] : { id: '', name: 'TBD' };
      const team2 = club2 ? club2.teams[cat] : { id: '', name: 'TBD' };
      const m = createMatch(`match-${matchId++}`, team1, team2, round, idx);
      m.tieId = tie.id;
      m.category = cat;
      applyRubberScoring(m, tournament);
      tie.matchIds.push(m.id);
      matches.push(m);
    });
  };

  // Round-robin ties (used by 'round-robin' and 'rr-final').
  const pairings = roundRobinClubPairings(clubs);
  pairings.forEach((p, idx) => {
    const tie: Tie = {
      id: `tie-${tieId++}`,
      club1Id: p.a.id,
      club2Id: p.b.id,
      round: p.round,
      stage: 'round-robin',
      position: idx,
      matchIds: [],
      completed: false,
    };
    buildRubbers(tie, p.a, p.b, p.round);
    ties.push(tie);
  });

  // 'rr-final' adds a placeholder final tie filled after the round-robin.
  if (structure === 'rr-final') {
    const maxRound = pairings.reduce((mx, p) => Math.max(mx, p.round), 0);
    const finalTie: Tie = {
      id: `tie-${tieId++}`,
      club1Id: '',
      club2Id: '',
      round: maxRound + 1,
      stage: 'final',
      position: 0,
      matchIds: [],
      completed: false,
    };
    buildRubbers(finalTie, null, null, maxRound + 1);
    ties.push(finalTie);
  }

  tournament.ties = ties;
  return matches;
}

// ─── Clash pool-knockout (Squad Battle) generation ───────────────────────────

// Split clubs into `poolCount` balanced, contiguous pools (sizes differ by ≤1).
function balancedPools(clubs: Club[], poolCount: number): ClashPool[] {
  const pools: ClashPool[] = Array.from({ length: poolCount }, (_, i) => ({
    id: `pool-${i + 1}`,
    name: `Pool ${i + 1}`,
    clubIds: [] as string[],
  }));
  const base = Math.floor(clubs.length / poolCount);
  const extra = clubs.length % poolCount; // first `extra` pools get one more
  let idx = 0;
  for (let p = 0; p < poolCount; p++) {
    const size = base + (p < extra ? 1 : 0);
    for (let k = 0; k < size && idx < clubs.length; k++) {
      pools[p].clubIds.push(clubs[idx++].id);
    }
  }
  return pools;
}

// Pools (round-robin each) + a seeded knockout:
//   3 pools → 6-team bracket: PO1=S3vS6, PO2=S4vS5, SF1=PO1 v S2,
//             SF2=PO2 v S1, Final (+ optional 3rd place)
//   2 pools → 4-team bracket: SF1=Champ A v RU B, SF2=Champ B v RU A,
//             Final (+ optional 3rd place)
function generateClashPoolKnockout(tournament: Tournament): Match[] {
  const clubs = tournament.clubs ?? [];
  const poolCount = tournament.clashPoolCount ?? 3;
  const pools = tournament.clashPools ?? balancedPools(clubs, poolCount);
  const thirdPlace = tournament.clashThirdPlace ?? true;
  const byId = new Map(clubs.map((c) => [c.id, c]));
  const matches: Match[] = [];
  const ties: Tie[] = [];
  let matchId = 1;
  let tieId = 1;

  // Per-stage race target (games to win the rubber). Tiebreak fires at
  // (target-1)-(target-1) → first to 7, golden at 6-6 (handled by the scorer).
  const stageTarget = (stage: Tie['stage']): number => {
    switch (stage) {
      case 'semifinal': return 5;
      case 'final': return 6;
      case 'third-place': return 5;
      default: return 3; // pool, playoff
    }
  };

  const buildRubbers = (
    tie: Tie,
    club1: Club | null,
    club2: Club | null,
    round: number
  ) => {
    RUBBER_CATEGORIES.forEach((cat, idx) => {
      const team1 = club1 ? club1.teams[cat] : { id: '', name: 'TBD' };
      const team2 = club2 ? club2.teams[cat] : { id: '', name: 'TBD' };
      const m = createMatch(`match-${matchId++}`, team1, team2, round, idx);
      m.tieId = tie.id;
      m.category = cat;
      applyRubberScoring(m, tournament);
      m.scoringMode = 'race';
      m.raceTarget = stageTarget(tie.stage); // per-stage games-to-win
      tie.matchIds.push(m.id);
      matches.push(m);
    });
  };

  // Pool round-robin ties
  pools.forEach((pool) => {
    const poolClubs = pool.clubIds
      .map((id) => byId.get(id))
      .filter((c): c is Club => Boolean(c));
    roundRobinClubPairings(poolClubs).forEach((p, idx) => {
      const tie: Tie = {
        id: `tie-${tieId++}`,
        club1Id: p.a.id,
        club2Id: p.b.id,
        round: p.round,
        stage: 'pool',
        poolId: pool.id,
        position: idx,
        matchIds: [],
        completed: false,
      };
      buildRubbers(tie, p.a, p.b, p.round);
      ties.push(tie);
    });
  });

  // Knockout placeholders (filled by advanceClashTournament).
  // round: 1 = playoff, 2 = semifinal, 3 = final / third-place.
  const koTie = (
    stage: Tie['stage'],
    position: number,
    round: number,
    seed1?: number,
    seed2?: number
  ) => {
    const tie: Tie = {
      id: `tie-${tieId++}`,
      club1Id: '',
      club2Id: '',
      round,
      stage,
      position,
      matchIds: [],
      completed: false,
      seed1,
      seed2,
    };
    buildRubbers(tie, null, null, round);
    ties.push(tie);
  };

  // Always a 6-team bracket: seeds 1 & 2 bye to the semifinals.
  //   2 pools → 6 qualify = top 3 each (pool winners are seeds 1 & 2 = byes)
  //   3 pools → 6 qualify = top 2 each (best 2 champions = seeds 1 & 2 = byes)
  koTie('playoff', 0, 1, 3, 6);
  koTie('playoff', 1, 1, 4, 5);
  koTie('semifinal', 0, 2, undefined, 2); // club1 = PO1 winner
  koTie('semifinal', 1, 2, undefined, 1); // club1 = PO2 winner
  koTie('final', 0, 3);
  if (thirdPlace) koTie('third-place', 1, 3);

  tournament.ties = ties;
  return matches;
}

function generateRoundRobinMatches(teams: Team[]): Match[] {
  return generateFairRoundRobinMatches(teams, 1);
}

function generateEliminationMatches(
  teams: Team[],
  scoringMode?: 'padel' | 'race',
  raceTarget?: number,
  thirdPlace?: boolean
): Match[] {
  const matches: Match[] = [];
  let matchId = 1;
  for (let i = 0; i < teams.length; i += 2) {
    const m = createMatch(
      `match-${matchId++}`,
      teams[i],
      teams[i + 1],
      1,
      Math.floor(i / 2)
    );
    if (scoringMode === 'race') {
      m.scoringMode = 'race';
      m.raceTarget = raceTarget || 4;
      m.team1RaceScore = 0;
      m.team2RaceScore = 0;
      m.isGoldenPoint = false;
    }
    matches.push(m);
  }
  let matchesInRound = teams.length / 2;
  let round = 2;
  while (matchesInRound > 1) {
    matchesInRound /= 2;
    const isFinal = matchesInRound === 1;
    for (let pos = 0; pos < matchesInRound; pos++) {
      matches.push({
        id: `match-${matchId++}`,
        team1: { id: '', name: 'TBD' },
        team2: { id: '', name: 'TBD' },
        team1Score: createEmptyScore(),
        team2Score: createEmptyScore(),
        completed: false,
        round,
        position: pos,
        currentSet: 1,
        currentGame: 0,
        servingTeam: 'team1',
        isDeuce: false,
        isTiebreaker: false,
        pointsInGame: 0,
        status: 'scheduled' as MatchStatus,
        schedule: {},
        scoringMode: scoringMode,
        raceTarget: scoringMode === 'race' ? (isFinal ? (raceTarget || 4) + 2 : (raceTarget || 4)) : undefined,
        team1RaceScore: scoringMode === 'race' ? 0 : undefined,
        team2RaceScore: scoringMode === 'race' ? 0 : undefined,
        isGoldenPoint: false,
      });
    }
    round++;
  }

  // 3rd-place match (needs a semifinal round, i.e. 4+ teams). round-1 = final.
  if (thirdPlace && teams.length >= 4) {
    matches.push({
      id: `match-${matchId++}`,
      team1: { id: '', name: 'TBD' },
      team2: { id: '', name: 'TBD' },
      team1Score: createEmptyScore(),
      team2Score: createEmptyScore(),
      completed: false,
      round: round - 1,
      position: 1,
      currentSet: 1,
      currentGame: 0,
      servingTeam: 'team1',
      isDeuce: false,
      isTiebreaker: false,
      pointsInGame: 0,
      status: 'scheduled' as MatchStatus,
      schedule: {},
      isThirdPlace: true,
      scoringMode: scoringMode,
      raceTarget: scoringMode === 'race' ? (raceTarget || 4) : undefined,
      team1RaceScore: scoringMode === 'race' ? 0 : undefined,
      team2RaceScore: scoringMode === 'race' ? 0 : undefined,
      isGoldenPoint: false,
    });
  }
  return matches;
}

function generateGroupKnockoutMatches(tournament: Tournament): Match[] {
  let allMatches: Match[] = [];
  const groups: Group[] = [];
  let matchIdCounter = 1;

  const totalTeams = tournament.teams.length;
  const teamsPerGroup = tournament.teamsPerGroup ?? 4;
  const numberOfGroups = Math.ceil(totalTeams / teamsPerGroup);
  const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  for (let i = 0; i < numberOfGroups; i++) {
    const startIndex = i * teamsPerGroup;
    const endIndex = Math.min(startIndex + teamsPerGroup, totalTeams);
    const groupTeams = tournament.teams.slice(startIndex, endIndex);

    const groupMatches = generateFairRoundRobinMatches(
      groupTeams,
      1,
      matchIdCounter,
      `group-${i + 1}`
    );

    // Apply race scoring to group matches if tournament uses race mode
    if (tournament.scoringMode === 'race') {
      groupMatches.forEach((m) => {
        m.scoringMode = 'race';
        m.raceTarget = tournament.raceTarget || 4;
        m.team1RaceScore = 0;
        m.team2RaceScore = 0;
        m.isGoldenPoint = false;
      });
    }

    matchIdCounter += groupMatches.length;
    allMatches.push(...groupMatches);

    const initialStandings = groupTeams.map((team) => ({
      ...team,
      wins: 0,
      losses: 0,
      pointsWon: 0,
      pointsLost: 0,
    }));

    const group: Group = {
      id: `group-${i + 1}`,
      name: `Group ${groupNames[i]}`,
      teams: groupTeams,
      completed: false,
      matches: groupMatches,
      standings: initialStandings,
      preferredCourtId: tournament.courts[i]?.id,
    };
    groups.push(group);
  }

  tournament.groups = groups;

  // Qualification: top N from each group, sized to a power of 2 derived from
  // the group structure (e.g. 4 groups × top 2 → 8, × top 4 → 16).
  const qualifiedTeamsCount = computeKnockoutSize(
    groups,
    tournament.qualifiersPerGroup ?? 2
  );
  const knockoutRounds = Math.ceil(Math.log2(qualifiedTeamsCount)); // QF/SF/Final etc.
  generateKnockoutPlaceholders(
    allMatches,
    qualifiedTeamsCount,
    knockoutRounds,
    matchIdCounter,
    tournament.scoringMode,
    tournament.raceTarget,
    tournament.thirdPlace
  );

  return allMatches;
}

// calculateKnockoutRounds is now inlined in generateGroupKnockoutMatches

function generateKnockoutPlaceholders(
  matches: Match[],
  qualifiedTeamsCount: number,
  knockoutRounds: number,
  startingMatchId: number,
  scoringMode?: 'padel' | 'race',
  raceTarget?: number,
  thirdPlace?: boolean
): void {
  let matchId = startingMatchId;
  let teamsInRound = qualifiedTeamsCount;
  const finalRound = knockoutRounds + 1;
  for (let round = 2; round <= finalRound; round++) {
    const matchesInRound = teamsInRound / 2;
    const isFinal = matchesInRound === 1;
    for (let pos = 0; pos < matchesInRound; pos++) {
      matches.push({
        id: `match-${matchId++}`,
        team1: { id: '', name: 'TBD' },
        team2: { id: '', name: 'TBD' },
        team1Score: createEmptyScore(),
        team2Score: createEmptyScore(),
        completed: false,
        round,
        position: pos,
        currentSet: 1,
        currentGame: 0,
        servingTeam: 'team1',
        isDeuce: false,
        isTiebreaker: false,
        pointsInGame: 0,
        status: 'scheduled' as MatchStatus,
        schedule: {},
        // Race scoring for knockout matches
        scoringMode: scoringMode,
        raceTarget: scoringMode === 'race' ? (isFinal ? (raceTarget || 4) + 2 : (raceTarget || 4)) : undefined,
        team1RaceScore: scoringMode === 'race' ? 0 : undefined,
        team2RaceScore: scoringMode === 'race' ? 0 : undefined,
        isGoldenPoint: false,
      });
    }
    teamsInRound = matchesInRound;
  }

  // 3rd-place match (only when a semifinal round exists): same round as the
  // final, position 1, filled from the two semifinal losers on advancement.
  if (thirdPlace && knockoutRounds >= 2) {
    matches.push({
      id: `match-${matchId++}`,
      team1: { id: '', name: 'TBD' },
      team2: { id: '', name: 'TBD' },
      team1Score: createEmptyScore(),
      team2Score: createEmptyScore(),
      completed: false,
      round: finalRound,
      position: 1,
      currentSet: 1,
      currentGame: 0,
      servingTeam: 'team1',
      isDeuce: false,
      isTiebreaker: false,
      pointsInGame: 0,
      status: 'scheduled' as MatchStatus,
      schedule: {},
      isThirdPlace: true,
      scoringMode: scoringMode,
      raceTarget: scoringMode === 'race' ? (raceTarget || 4) : undefined,
      team1RaceScore: scoringMode === 'race' ? 0 : undefined,
      team2RaceScore: scoringMode === 'race' ? 0 : undefined,
      isGoldenPoint: false,
    });
  }
}

// ─── Clash standings & advancement ───────────────────────────────────────────

// Clubs ranked by rubbers won, then unit difference (padel sets / race games),
// then ties won. Only round-robin rubbers count toward the table.
export function calculateClashStandings(tournament: Tournament): Club[] {
  const clubs = (tournament.clubs ?? []).map((c) => ({
    ...c,
    rubbersWon: 0,
    rubbersLost: 0,
    tiesWon: 0,
    setsWon: 0,
    setsLost: 0,
  }));
  const byId = new Map(clubs.map((c) => [c.id, c]));
  const rrTies = (tournament.ties ?? []).filter((t) => t.stage === 'round-robin');

  rrTies.forEach((tie) => {
    const c1 = byId.get(tie.club1Id);
    const c2 = byId.get(tie.club2Id);
    if (!c1 || !c2) return;

    let c1Rubbers = 0;
    let c2Rubbers = 0;
    let done = 0;

    tie.matchIds.forEach((mid) => {
      const m = tournament.matches.find((x) => x.id === mid);
      if (!m || !m.completed || !m.winner) return;
      done++;
      const c1Won = m.winner.id === m.team1.id;
      const u1 = m.scoringMode === 'race' ? m.team1RaceScore || 0 : m.team1Score.sets;
      const u2 = m.scoringMode === 'race' ? m.team2RaceScore || 0 : m.team2Score.sets;

      if (c1Won) c1Rubbers++;
      else c2Rubbers++;
      c1.rubbersWon += c1Won ? 1 : 0;
      c1.rubbersLost += c1Won ? 0 : 1;
      c2.rubbersWon += c1Won ? 0 : 1;
      c2.rubbersLost += c1Won ? 1 : 0;
      c1.setsWon += u1;
      c1.setsLost += u2;
      c2.setsWon += u2;
      c2.setsLost += u1;
    });

    if (tie.matchIds.length > 0 && done === tie.matchIds.length) {
      if (c1Rubbers > c2Rubbers) c1.tiesWon += 1;
      else if (c2Rubbers > c1Rubbers) c2.tiesWon += 1;
    }
  });

  return clubs.sort((a, b) => {
    if (b.rubbersWon !== a.rubbersWon) return b.rubbersWon - a.rubbersWon;
    const aDiff = a.setsWon - a.setsLost;
    const bDiff = b.setsWon - b.setsLost;
    if (bDiff !== aDiff) return bDiff - aDiff;
    return b.tiesWon - a.tiesWon;
  });
}

// ─── Clash pool-knockout standings & seeding (Squad Battle) ───────────────────

// One row of a pool table. GF/GA/GD are in disciplines (rubbers).
export interface ClashPoolRow {
  club: Club;
  played: number; // completed ties
  wins: number;
  draws: number;
  losses: number;
  points: number; // wins × 3
  rubbersWon: number; // GF
  rubbersLost: number; // GA
  rubberDiff: number; // GD
}

// Pool ranking: PTS (tie wins ×3) → GD (rubber diff) → GF (rubbers won).
function compareClashPoolRows(a: ClashPoolRow, b: ClashPoolRow): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.rubberDiff !== a.rubberDiff) return b.rubberDiff - a.rubberDiff;
  return b.rubbersWon - a.rubbersWon;
}

export function calculateClashPoolStandings(
  tournament: Tournament,
  poolId: string
): ClashPoolRow[] {
  const pool = (tournament.clashPools ?? []).find((p) => p.id === poolId);
  const rows = new Map<string, ClashPoolRow>();
  (pool?.clubIds ?? []).forEach((id) => {
    const club = (tournament.clubs ?? []).find((c) => c.id === id);
    if (club) {
      rows.set(id, {
        club,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        rubbersWon: 0,
        rubbersLost: 0,
        rubberDiff: 0,
      });
    }
  });

  const poolTies = (tournament.ties ?? []).filter(
    (t) => t.stage === 'pool' && t.poolId === poolId
  );
  poolTies.forEach((tie) => {
    const r1 = rows.get(tie.club1Id);
    const r2 = rows.get(tie.club2Id);
    if (!r1 || !r2) return;

    let c1 = 0;
    let c2 = 0;
    let done = 0;
    tie.matchIds.forEach((mid) => {
      const m = tournament.matches.find((x) => x.id === mid);
      if (!m || !m.completed || !m.winner) return;
      done++;
      if (m.winner.id === m.team1.id) c1++;
      else c2++;
    });

    r1.rubbersWon += c1;
    r1.rubbersLost += c2;
    r2.rubbersWon += c2;
    r2.rubbersLost += c1;

    if (tie.matchIds.length > 0 && done === tie.matchIds.length) {
      r1.played++;
      r2.played++;
      if (c1 > c2) {
        r1.wins++;
        r2.losses++;
      } else if (c2 > c1) {
        r2.wins++;
        r1.losses++;
      } else {
        r1.draws++;
        r2.draws++;
      }
    }
  });

  rows.forEach((r) => {
    r.points = r.wins * 3;
    r.rubberDiff = r.rubbersWon - r.rubbersLost;
  });

  return [...rows.values()].sort(compareClashPoolRows);
}

// Cross-pool ranking uses per-match averages so pools of different sizes are
// compared fairly (a 4-team pool plays more ties than a 3-team pool). For
// equal-sized pools this is identical to ranking on raw PTS → GD → GF.
function compareClashSeedRows(a: ClashPoolRow, b: ClashPoolRow): number {
  const pa = a.played || 1;
  const pb = b.played || 1;
  const pts = b.points / pb - a.points / pa;
  if (Math.abs(pts) > 1e-9) return pts;
  const gd = b.rubberDiff / pb - a.rubberDiff / pa;
  if (Math.abs(gd) > 1e-9) return gd;
  return b.rubbersWon / pb - a.rubbersWon / pa;
}

// Seed order for the 6-team knockout. Qualifiers per pool = 6 / poolCount
// (3 pools → top 2 each, 2 pools → top 3 each). Seeded by finishing rank:
// all pool winners first (ranked across pools), then all runners-up, etc.
// So seeds 1 & 2 are always pool winners → they bye to the semifinals.
export function computeClashSeeds(tournament: Tournament): Club[] {
  const pools = tournament.clashPools ?? [];
  const poolCount = tournament.clashPoolCount ?? pools.length ?? 3;
  const perPool = poolCount > 0 ? Math.round(6 / poolCount) : 2;
  const standingsByPool = pools.map((p) => calculateClashPoolStandings(tournament, p.id));

  const seeds: ClashPoolRow[] = [];
  for (let rank = 0; rank < perPool; rank++) {
    const tier = standingsByPool
      .map((s) => s[rank])
      .filter((r): r is ClashPoolRow => Boolean(r))
      .sort(compareClashSeedRows);
    seeds.push(...tier);
  }
  return seeds.slice(0, 6).map((r) => r.club);
}

// Flat leaderboard of every squad across all pools, ranked PTS → GD → GF.
// Pool-stage performance only (the true overall winner is the bracket champion).
export function calculateClashOverallStandings(
  tournament: Tournament
): ClashPoolRow[] {
  const pools = tournament.clashPools ?? [];
  const all = pools.flatMap((p) => calculateClashPoolStandings(tournament, p.id));
  return all.sort(compareClashPoolRows);
}

function advanceClashTournament(tournament: Tournament): Tournament {
  // Recompute completion + winner of every tie (a tie = 3 rubbers).
  const ties: Tie[] = (tournament.ties ?? []).map((tie) => {
    const rubbers = tie.matchIds
      .map((id) => tournament.matches.find((m) => m.id === id))
      .filter((m): m is Match => Boolean(m));
    const allDone = rubbers.length === 3 && rubbers.every((m) => m.completed);
    let winnerClubId = tie.winnerClubId;
    if (allDone) {
      let c1 = 0;
      let c2 = 0;
      rubbers.forEach((m) => {
        if (!m.winner) return;
        if (m.winner.id === m.team1.id) c1++;
        else c2++;
      });
      winnerClubId = c1 >= c2 ? tie.club1Id : tie.club2Id;
    }
    return { ...tie, completed: allDone, winnerClubId };
  });

  let updated: Tournament = { ...tournament, ties };
  const structure = tournament.clashStructure ?? 'rr-final';

  if (structure === 'pool-knockout') {
    return advanceClashPoolKnockout(updated);
  }

  const standings = calculateClashStandings(updated);
  const rrTies = ties.filter((t) => t.stage === 'round-robin');
  const rrDone = rrTies.length > 0 && rrTies.every((t) => t.completed);

  if (structure === 'round-robin') {
    if (rrDone) {
      updated.completed = true;
      updated.winnerClubId = standings[0]?.id;
      updated.clashStage = 'done';
    }
    return updated;
  }

  // rr-final: seed the final tie with the top two clubs once the RR is done.
  const finalTie = ties.find((t) => t.stage === 'final');
  if (!finalTie) return updated;

  if (rrDone && !finalTie.club1Id && standings.length >= 2) {
    const top1 = tournament.clubs!.find((c) => c.id === standings[0].id);
    const top2 = tournament.clubs!.find((c) => c.id === standings[1].id);
    if (top1 && top2) {
      const newTies = ties.map((t) =>
        t.id === finalTie.id ? { ...t, club1Id: top1.id, club2Id: top2.id } : t
      );
      const newMatches = updated.matches.map((m) =>
        m.tieId === finalTie.id && m.category
          ? { ...m, team1: top1.teams[m.category], team2: top2.teams[m.category] }
          : m
      );
      updated = { ...updated, ties: newTies, matches: newMatches, clashStage: 'final' };
    }
  }

  const freshFinal = (updated.ties ?? []).find((t) => t.stage === 'final');
  if (freshFinal?.completed && freshFinal.winnerClubId) {
    updated.completed = true;
    updated.winnerClubId = freshFinal.winnerClubId;
    updated.clashStage = 'done';
  }

  return updated;
}

// Fills the pool-knockout bracket per-pairing as results come in. Receives a
// tournament whose ties already have fresh completed/winnerClubId values.
// Already-filled slots are never overwritten, so an in-progress tie is safe.
function advanceClashPoolKnockout(tournament: Tournament): Tournament {
  let updated: Tournament = { ...tournament };

  const tieAt = (stage: Tie['stage'], position: number) =>
    (updated.ties ?? []).find((t) => t.stage === stage && t.position === position);
  const clubById = (id: string) => (updated.clubs ?? []).find((c) => c.id === id);

  // Set a club into a tie slot (1 or 2) and its 3 rubber matches.
  const fillSlot = (tieId: string, slot: 1 | 2, club: Club) => {
    updated = {
      ...updated,
      ties: (updated.ties ?? []).map((t) =>
        t.id === tieId
          ? slot === 1
            ? { ...t, club1Id: club.id }
            : { ...t, club2Id: club.id }
          : t
      ),
      matches: updated.matches.map((m) =>
        m.tieId === tieId && m.category
          ? slot === 1
            ? { ...m, team1: club.teams[m.category] }
            : { ...m, team2: club.teams[m.category] }
          : m
      ),
    };
  };

  const poolTies = (updated.ties ?? []).filter((t) => t.stage === 'pool');
  const poolsDone = poolTies.length > 0 && poolTies.every((t) => t.completed);

  // 1) Pools done → seed playoffs (S3vS6, S4vS5) + semifinal byes (S2, S1).
  if (poolsDone) {
    const seeds = computeClashSeeds(updated);
    const seed = (n: number) => seeds[n - 1]; // 1-indexed
    const po1 = tieAt('playoff', 0);
    const po2 = tieAt('playoff', 1);
    const sf1 = tieAt('semifinal', 0);
    const sf2 = tieAt('semifinal', 1);
    if (po1 && !po1.club1Id && seed(3) && seed(6)) {
      fillSlot(po1.id, 1, seed(3));
      fillSlot(po1.id, 2, seed(6));
    }
    if (po2 && !po2.club1Id && seed(4) && seed(5)) {
      fillSlot(po2.id, 1, seed(4));
      fillSlot(po2.id, 2, seed(5));
    }
    if (sf1 && !sf1.club2Id && seed(2)) fillSlot(sf1.id, 2, seed(2));
    if (sf2 && !sf2.club2Id && seed(1)) fillSlot(sf2.id, 2, seed(1));
    if (updated.clashStage === 'pool') updated = { ...updated, clashStage: 'knockout' };
  }

  // 2) Playoff winners → semifinal club1 slot.
  const po1d = tieAt('playoff', 0);
  const po2d = tieAt('playoff', 1);
  const sf1d = tieAt('semifinal', 0);
  const sf2d = tieAt('semifinal', 1);
  if (po1d?.completed && po1d.winnerClubId && sf1d && !sf1d.club1Id) {
    const w = clubById(po1d.winnerClubId);
    if (w) fillSlot(sf1d.id, 1, w);
  }
  if (po2d?.completed && po2d.winnerClubId && sf2d && !sf2d.club1Id) {
    const w = clubById(po2d.winnerClubId);
    if (w) fillSlot(sf2d.id, 1, w);
  }

  // 3) Semifinal winners → final; losers → third-place (if present).
  const sf1e = tieAt('semifinal', 0);
  const sf2e = tieAt('semifinal', 1);
  if (sf1e?.completed && sf2e?.completed && sf1e.winnerClubId && sf2e.winnerClubId) {
    const w1 = clubById(sf1e.winnerClubId);
    const w2 = clubById(sf2e.winnerClubId);
    const finalTie = tieAt('final', 0);
    if (finalTie && !finalTie.club1Id && w1 && w2) {
      fillSlot(finalTie.id, 1, w1);
      fillSlot(finalTie.id, 2, w2);
    }
    const l1 = clubById(
      sf1e.winnerClubId === sf1e.club1Id ? sf1e.club2Id : sf1e.club1Id
    );
    const l2 = clubById(
      sf2e.winnerClubId === sf2e.club1Id ? sf2e.club2Id : sf2e.club1Id
    );
    const thirdTie = tieAt('third-place', 1);
    if (thirdTie && !thirdTie.club1Id && l1 && l2) {
      fillSlot(thirdTie.id, 1, l1);
      fillSlot(thirdTie.id, 2, l2);
    }
  }

  // 4) Final done → champion.
  const finalDone = tieAt('final', 0);
  if (finalDone?.completed && finalDone.winnerClubId) {
    updated = {
      ...updated,
      completed: true,
      winnerClubId: finalDone.winnerClubId,
      clashStage: 'done',
    };
  }

  return updated;
}

function createMatch(
  id: string,
  team1: Team,
  team2: Team,
  round: number,
  position: number,
  groupId?: string
): Match {
  return {
    id,
    team1,
    team2,
    team1Score: createEmptyScore(),
    team2Score: createEmptyScore(),
    completed: false,
    round,
    position,
    currentSet: 1,
    currentGame: 0,
    servingTeam: Math.random() < 0.5 ? 'team1' : 'team2',
    isDeuce: false,
    isTiebreaker: false,
    pointsInGame: 0,
    status: 'scheduled' as MatchStatus,
    schedule: {},
    groupId,
    // Race scoring defaults (will be overridden if tournament uses race mode)
    team1RaceScore: 0,
    team2RaceScore: 0,
  };
}

// FIXED: Always update standings first before checking advancement
export function advanceTournament(tournament: Tournament): Tournament {
  const updatedTournament = { ...tournament };

  if (tournament.format === 'group-knockout') {
    // ALWAYS update group standings first for all groups
    let tournamentWithUpdatedStandings = updatedTournament;

    if (updatedTournament.groups) {
      const updatedGroups = updatedTournament.groups.map((group) => {
        const newStandings = calculateGroupStandings(
          group,
          updatedTournament.matches
        );
        const allMatchesInGroupComplete = group.matches.every(
          (gMatch) =>
            updatedTournament.matches.find((tMatch) => tMatch.id === gMatch.id)
              ?.completed
        );
        return {
          ...group,
          standings: newStandings,
          completed: allMatchesInGroupComplete,
        };
      });

      tournamentWithUpdatedStandings = {
        ...updatedTournament,
        groups: updatedGroups,
      };
    }

    return advanceGroupKnockoutTournament(tournamentWithUpdatedStandings);
  }

  if (tournament.format === 'single-elimination') {
    return advanceEliminationTournament(updatedTournament);
  }

  if (tournament.format === 'clash') {
    return advanceClashTournament(updatedTournament);
  }

  // For round-robin, check if tournament is complete
  if (tournament.format === 'round-robin') {
    const allMatchesComplete = tournament.matches.every((m) => m.completed);
    if (allMatchesComplete) {
      const standings = calculateRoundRobinStandings(tournament);
      return {
        ...updatedTournament,
        completed: true,
        winner: standings[0],
      };
    }
  }

  return updatedTournament;
}

function advanceGroupKnockoutTournament(tournament: Tournament): Tournament {
  if (!tournament.groups || !tournament.groupStage) {
    return advanceEliminationTournament(tournament);
  }

  const allGroupMatchesCompleted = tournament.matches
    .filter((m) => m.groupId)
    .every((m) => m.completed);

  if (!allGroupMatchesCompleted) {
    return tournament;
  }

  // Qualification: top `qualifiersPerGroup` from each group, grouped by their
  // finishing rank (all winners, then all runners-up, then all 3rds, ...).
  // Each rank tier is sorted by cross-group performance; tiers are then
  // concatenated so better group placings seed ahead of worse ones.
  const qualifiersPerGroup = tournament.qualifiersPerGroup ?? 2;
  const knockoutSize = computeKnockoutSize(tournament.groups, qualifiersPerGroup);

  const qualifiedByRank: Team[] = [];
  for (let rank = 0; rank < qualifiersPerGroup; rank++) {
    const tier = tournament.groups
      .map((group) => group.standings[rank])
      .filter((t): t is Team => Boolean(t))
      .sort(compareStandings);
    qualifiedByRank.push(...tier);
  }

  // Trim the lowest tier down to the power-of-2 bracket size.
  const qualifiedTeams = qualifiedByRank.slice(0, knockoutSize);

  console.log('Qualified teams:', qualifiedTeams.map((t) => t.name));

  // Standard bracket seeding so the top two seeds can only meet in the final.
  const seedSlots = getSeedSlots(qualifiedTeams.length);

  const finalMatches = tournament.matches.map((match) => {
    if (match.round !== 2 || match.groupId) {
      return match;
    }

    const team1Index = seedSlots[match.position * 2];
    const team2Index = seedSlots[match.position * 2 + 1];

    if (qualifiedTeams[team1Index] && qualifiedTeams[team2Index]) {
      return {
        ...match,
        team1: qualifiedTeams[team1Index],
        team2: qualifiedTeams[team2Index],
      };
    }
    return match;
  });

  return {
    ...tournament,
    matches: finalMatches,
    groupStage: false,
    currentRound: 2,
  };
}

// Group standings: W → PW (highest) → PL (lowest)
export function calculateGroupStandings(
  group: Group,
  allTournamentMatches: Match[]
): Team[] {
  const standings = group.teams.map((team) => ({
    ...team,
    wins: 0,
    losses: 0,
    pointsWon: 0,
    pointsLost: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
  }));

  const groupMatches = (allTournamentMatches || []).filter(
    (match) => match.groupId === group.id && match.completed
  );

  groupMatches.forEach((match) => {
    if (match.winner) {
      const winnerTeam = match.winner;
      const loserTeam =
        match.team1.id === winnerTeam.id ? match.team2 : match.team1;

      const winnerIndex = standings.findIndex((t) => t.id === winnerTeam.id);
      const loserIndex = standings.findIndex((t) => t.id === loserTeam.id);

      const winnerIsTeam1 = winnerTeam.id === match.team1.id;

      // Race scoring: use raceScore fields
      if (match.scoringMode === 'race') {
        const winnerPts = winnerIsTeam1 ? (match.team1RaceScore || 0) : (match.team2RaceScore || 0);
        const loserPts = winnerIsTeam1 ? (match.team2RaceScore || 0) : (match.team1RaceScore || 0);

        if (winnerIndex !== -1) {
          standings[winnerIndex].wins = (standings[winnerIndex].wins || 0) + 1;
          standings[winnerIndex].pointsWon = (standings[winnerIndex].pointsWon || 0) + winnerPts;
          standings[winnerIndex].pointsLost = (standings[winnerIndex].pointsLost || 0) + loserPts;
        }
        if (loserIndex !== -1) {
          standings[loserIndex].losses = (standings[loserIndex].losses || 0) + 1;
          standings[loserIndex].pointsWon = (standings[loserIndex].pointsWon || 0) + loserPts;
          standings[loserIndex].pointsLost = (standings[loserIndex].pointsLost || 0) + winnerPts;
        }
      } else {
        // Legacy padel scoring
        const winnerScore = winnerIsTeam1 ? match.team1Score : match.team2Score;
        const loserScore = winnerIsTeam1 ? match.team2Score : match.team1Score;

        if (winnerIndex !== -1) {
          standings[winnerIndex].wins = (standings[winnerIndex].wins || 0) + 1;
          standings[winnerIndex].setsWon = (standings[winnerIndex].setsWon || 0) + winnerScore.sets;
          standings[winnerIndex].setsLost = (standings[winnerIndex].setsLost || 0) + loserScore.sets;
          standings[winnerIndex].gamesWon = (standings[winnerIndex].gamesWon || 0) + winnerScore.games;
          standings[winnerIndex].gamesLost = (standings[winnerIndex].gamesLost || 0) + loserScore.games;
        }
        if (loserIndex !== -1) {
          standings[loserIndex].losses = (standings[loserIndex].losses || 0) + 1;
          standings[loserIndex].setsWon = (standings[loserIndex].setsWon || 0) + loserScore.sets;
          standings[loserIndex].setsLost = (standings[loserIndex].setsLost || 0) + winnerScore.sets;
          standings[loserIndex].gamesWon = (standings[loserIndex].gamesWon || 0) + loserScore.games;
          standings[loserIndex].gamesLost = (standings[loserIndex].gamesLost || 0) + winnerScore.games;
        }
      }
    }
  });

  // Sort: wins → point diff (race) → set diff → game diff (padel)
  return standings.sort(compareStandings);
}

function advanceEliminationTournament(tournament: Tournament): Tournament {
  // Knockout matches only (group matches carry a groupId and are left alone).
  const knockoutMatches = tournament.matches.filter((m) => !m.groupId);
  if (knockoutMatches.length === 0) return tournament;

  // First knockout round: round 1 for single-elimination, round 2 for
  // group-knockout (its bracket is seeded by qualification, not by feeders).
  const firstKnockoutRound = Math.min(...knockoutMatches.map((m) => m.round));
  const maxRound = Math.max(...knockoutMatches.map((m) => m.round));

  // Fill each later-round match as soon as BOTH its feeder matches are done —
  // independent of the other matches in the same round. So if A beats B and
  // D beats C, the A vs D semifinal is ready even while E/F and G/H play on.
  // Already-assigned slots (same team id) are left untouched so an in-progress
  // match is never reset.
  // The two semifinals feed both the final and the (optional) 3rd-place match.
  const loserOf = (m?: Match): Team | undefined => {
    if (!m?.completed || !m.winner) return undefined;
    return m.winner.id === m.team1.id ? m.team2 : m.team1;
  };
  const sf1 = knockoutMatches.find((m) => m.round === maxRound - 1 && m.position === 0);
  const sf2 = knockoutMatches.find((m) => m.round === maxRound - 1 && m.position === 1);

  const newMatches = tournament.matches.map((match) => {
    if (match.groupId || match.round <= firstKnockoutRound) return match;

    // 3rd-place match: fill from the two semifinal losers (not bracket feeders).
    if (match.isThirdPlace) {
      const l1 = loserOf(sf1);
      const l2 = loserOf(sf2);
      let updated = match;
      if (l1 && match.team1?.id !== l1.id) updated = { ...updated, team1: l1 };
      if (l2 && match.team2?.id !== l2.id) updated = { ...updated, team2: l2 };
      return updated;
    }

    const prevRound = match.round - 1;
    const feeder1 = knockoutMatches.find(
      (m) => m.round === prevRound && m.position === match.position * 2 && !m.isThirdPlace
    );
    const feeder2 = knockoutMatches.find(
      (m) => m.round === prevRound && m.position === match.position * 2 + 1 && !m.isThirdPlace
    );

    let updated = match;
    if (
      feeder1?.completed &&
      feeder1.winner &&
      match.team1?.id !== feeder1.winner.id
    ) {
      updated = { ...updated, team1: feeder1.winner };
    }
    if (
      feeder2?.completed &&
      feeder2.winner &&
      match.team2?.id !== feeder2.winner.id
    ) {
      updated = { ...updated, team2: feeder2.winner };
    }
    return updated;
  });

  // Tournament is complete once the FINAL (not the 3rd-place match) is done.
  const finalMatch = newMatches.find(
    (m) => !m.groupId && m.round === maxRound && !m.isThirdPlace
  );
  const completed = !!finalMatch?.completed;

  // currentRound = furthest round that has both teams assigned (informational).
  const playableRounds = newMatches
    .filter((m) => !m.groupId && m.team1?.id && m.team2?.id)
    .map((m) => m.round);
  const currentRound = playableRounds.length
    ? Math.max(...playableRounds)
    : tournament.currentRound;

  return {
    ...tournament,
    matches: newMatches,
    completed,
    winner: completed ? finalMatch?.winner : tournament.winner,
    currentRound,
  };
}

export function calculateRoundRobinStandings(tournament: Tournament): Team[] {
  const standings = tournament.teams.map((team) => ({
    ...team,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
    pointsWon: 0,
    pointsLost: 0,
  }));

  tournament.matches.forEach((match) => {
    if (!match.completed || !match.winner) return;

    const winnerIsTeam1 = match.winner.id === match.team1.id;
    const winnerIndex = standings.findIndex((t) => t.id === match.winner!.id);
    const loserIndex = standings.findIndex(
      (t) => t.id === (winnerIsTeam1 ? match.team2.id : match.team1.id)
    );
    const winner = standings[winnerIndex];
    const loser = standings[loserIndex];

    if (winner) winner.wins = (winner.wins || 0) + 1;
    if (loser) loser.losses = (loser.losses || 0) + 1;

    if (match.scoringMode === 'race') {
      const winnerPts = winnerIsTeam1 ? (match.team1RaceScore || 0) : (match.team2RaceScore || 0);
      const loserPts = winnerIsTeam1 ? (match.team2RaceScore || 0) : (match.team1RaceScore || 0);
      if (winner) {
        winner.pointsWon = (winner.pointsWon || 0) + winnerPts;
        winner.pointsLost = (winner.pointsLost || 0) + loserPts;
      }
      if (loser) {
        loser.pointsWon = (loser.pointsWon || 0) + loserPts;
        loser.pointsLost = (loser.pointsLost || 0) + winnerPts;
      }
    } else {
      const winnerScore = winnerIsTeam1 ? match.team1Score : match.team2Score;
      const loserScore = winnerIsTeam1 ? match.team2Score : match.team1Score;
      if (winner) {
        winner.setsWon = (winner.setsWon || 0) + winnerScore.sets;
        winner.setsLost = (winner.setsLost || 0) + loserScore.sets;
        winner.gamesWon = (winner.gamesWon || 0) + winnerScore.games;
        winner.gamesLost = (winner.gamesLost || 0) + loserScore.games;
      }
      if (loser) {
        loser.setsWon = (loser.setsWon || 0) + loserScore.sets;
        loser.setsLost = (loser.setsLost || 0) + winnerScore.sets;
        loser.gamesWon = (loser.gamesWon || 0) + loserScore.games;
        loser.gamesLost = (loser.gamesLost || 0) + winnerScore.games;
      }
    }
  });

  return standings.sort(compareStandings);
}

export function getGroupByTeam(
  tournament: Tournament,
  teamId: string
): Group | undefined {
  return tournament.groups?.find((group) =>
    group.teams.some((team) => team.id === teamId)
  );
}

export function getGroupMatches(
  tournament: Tournament,
  groupId: string
): Match[] {
  return tournament.matches.filter((match) => match.groupId === groupId);
}

export function hasTeamQualified(
  tournament: Tournament,
  teamId: string
): boolean {
  // Only meaningful once the group stage is over and the bracket is seeded.
  if (!tournament.groups || tournament.groupStage) return false;
  // Source of truth: the team was actually placed into a first-round
  // knockout match (round 2, non-group), i.e. winner or best runner-up.
  return tournament.matches.some(
    (m) =>
      m.round === 2 &&
      !m.groupId &&
      (m.team1.id === teamId || m.team2.id === teamId)
  );
}
