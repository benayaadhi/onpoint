import {
  Tournament,
  Team,
  Match,
  TournamentFormat,
  Court,
  MatchStatus,
  Group,
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

  const tournament: Tournament = {
    id: `tournament-${Date.now()}`,
    name,
    format,
    teams,
    matches: [],
    courts,
    currentRound: 1,
    completed: false,
    createdAt: new Date().toISOString(),
    matchDuration: 90,
    breakBetweenMatches: 15,
    groups: format === 'group-knockout' ? [] : undefined,
    groupStage: format === 'group-knockout',
    scoringMode,
    raceTarget,
    matchRules,
    teamsPerGroup,
    qualifiersPerGroup,
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
      return generateEliminationMatches(tournament.teams, tournament.scoringMode, tournament.raceTarget);
    case 'group-knockout':
      return generateGroupKnockoutMatches(tournament);
    default:
      return [];
  }
}

function generateRoundRobinMatches(teams: Team[]): Match[] {
  return generateFairRoundRobinMatches(teams, 1);
}

function generateEliminationMatches(
  teams: Team[],
  scoringMode?: 'padel' | 'race',
  raceTarget?: number
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
    tournament.raceTarget
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
  raceTarget?: number
): void {
  let matchId = startingMatchId;
  let teamsInRound = qualifiedTeamsCount;
  for (let round = 2; round <= knockoutRounds + 1; round++) {
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
  const currentRoundMatches = tournament.matches.filter(
    (m) => m.round === tournament.currentRound
  );
  const allCompleted = currentRoundMatches.every((m) => m.completed);
  if (!allCompleted) return tournament;
  const nextRoundMatches = tournament.matches.filter(
    (m) => m.round === tournament.currentRound + 1
  );
  if (nextRoundMatches.length === 0) {
    return {
      ...tournament,
      completed: true,
      winner: currentRoundMatches[0]?.winner,
    };
  }

  const newMatches = tournament.matches.map((match) => {
    if (match.round === tournament.currentRound + 1) {
      const newMatch = { ...match };
      const prevRoundPos1 = newMatch.position * 2;
      const prevRoundPos2 = prevRoundPos1 + 1;
      const winner1 = currentRoundMatches.find(
        (m) => m.position === prevRoundPos1
      )?.winner;
      const winner2 = currentRoundMatches.find(
        (m) => m.position === prevRoundPos2
      )?.winner;

      if (winner1) newMatch.team1 = winner1;
      if (winner2) newMatch.team2 = winner2;

      return newMatch;
    }
    return match;
  });

  return {
    ...tournament,
    matches: newMatches,
    currentRound: tournament.currentRound + 1,
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
