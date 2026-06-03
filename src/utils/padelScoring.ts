import { Match, PadelScore, MatchRules, DEFAULT_MATCH_RULES } from '../types/tournament';

export const PADEL_POINTS = ['0', '15', '30', '40'];

export function createEmptyScore(): PadelScore {
  return { games: 0, points: 0, sets: 0 };
}

// Resolve the rules for a match, falling back to standard padel defaults.
function rulesOf(match: Match): MatchRules {
  return { ...DEFAULT_MATCH_RULES, ...(match.rules || {}) };
}

export function addPoint(match: Match, team: 'team1' | 'team2'): Match {
  const updatedMatch = { ...match };
  const scoringTeam = team;
  const otherTeam = team === 'team1' ? 'team2' : 'team1';
  
  if (updatedMatch.isTiebreaker) {
    return handleTiebreakPoint(updatedMatch, scoringTeam);
  }
  
  // Handle regular game scoring
  if (scoringTeam === 'team1') {
    updatedMatch.team1Score.points++;
  } else {
    updatedMatch.team2Score.points++;
  }
  
  updatedMatch.pointsInGame++;
  
  // Switch serve every 2 points in tiebreaker or every game in regular play
  if (updatedMatch.isTiebreaker && updatedMatch.pointsInGame % 2 === 0) {
    updatedMatch.servingTeam = updatedMatch.servingTeam === 'team1' ? 'team2' : 'team1';
  }
  
  return checkGameEnd(updatedMatch);
}

function handleTiebreakPoint(match: Match, scoringTeam: 'team1' | 'team2'): Match {
  const updatedMatch = { ...match };
  
  if (!updatedMatch.tiebreakPoints) {
    updatedMatch.tiebreakPoints = { team1: 0, team2: 0 };
  }
  
  if (scoringTeam === 'team1') {
    updatedMatch.tiebreakPoints.team1++;
  } else {
    updatedMatch.tiebreakPoints.team2++;
  }
  
  updatedMatch.pointsInGame++;
  
  // Switch serve every 2 points in tiebreaker
  if (updatedMatch.pointsInGame % 2 === 0) {
    updatedMatch.servingTeam = updatedMatch.servingTeam === 'team1' ? 'team2' : 'team1';
  }
  
  // Check if tiebreaker is won
  const team1Points = updatedMatch.tiebreakPoints.team1;
  const team2Points = updatedMatch.tiebreakPoints.team2;
  const { tiebreakAt, tiebreakPoints } = rulesOf(updatedMatch);

  if ((team1Points >= tiebreakPoints && team1Points - team2Points >= 2) ||
      (team2Points >= tiebreakPoints && team2Points - team1Points >= 2)) {

    // Winner takes the set by one game over the tiebreak trigger (e.g. 7-6, 4-3)
    if (team1Points > team2Points) {
      updatedMatch.team1Score.games = tiebreakAt + 1;
      updatedMatch.team2Score.games = tiebreakAt;
    } else {
      updatedMatch.team1Score.games = tiebreakAt;
      updatedMatch.team2Score.games = tiebreakAt + 1;
    }

    return endSet(updatedMatch);
  }
  
  return updatedMatch;
}

function checkGameEnd(match: Match): Match {
  const team1Points = match.team1Score.points;
  const team2Points = match.team2Score.points;
  const { goldenPoint } = rulesOf(match);

  // Handle deuce and advantage
  if (team1Points >= 3 && team2Points >= 3) {
    if (team1Points === team2Points) {
      // 40-40: deuce (advantage mode) or golden point (sudden death)
      match.isDeuce = true;
      match.advantage = undefined;
    } else if (goldenPoint) {
      // Golden point: whoever wins the point after 40-40 takes the game
      return endGame(match, team1Points > team2Points ? 'team1' : 'team2');
    } else if (team1Points > team2Points) {
      if (match.advantage === 'team1') {
        // Team1 wins the game
        return endGame(match, 'team1');
      } else {
        match.isDeuce = false;
        match.advantage = 'team1';
      }
    } else {
      if (match.advantage === 'team2') {
        // Team2 wins the game
        return endGame(match, 'team2');
      } else {
        match.isDeuce = false;
        match.advantage = 'team2';
      }
    }
  } else if (team1Points >= 3 && team1Points - team2Points >= 2) {
    return endGame(match, 'team1');
  } else if (team2Points >= 3 && team2Points - team1Points >= 2) {
    return endGame(match, 'team2');
  }
  
  return match;
}

function endGame(match: Match, winner: 'team1' | 'team2'): Match {
  const updatedMatch = { ...match };
  
  // Reset points and game state
  updatedMatch.team1Score.points = 0;
  updatedMatch.team2Score.points = 0;
  updatedMatch.isDeuce = false;
  updatedMatch.advantage = undefined;
  updatedMatch.pointsInGame = 0;
  
  // Add game to winner
  if (winner === 'team1') {
    updatedMatch.team1Score.games++;
  } else {
    updatedMatch.team2Score.games++;
  }
  
  // Switch serve
  updatedMatch.servingTeam = updatedMatch.servingTeam === 'team1' ? 'team2' : 'team1';
  
  return checkSetEnd(updatedMatch);
}

function checkSetEnd(match: Match): Match {
  const team1Games = match.team1Score.games;
  const team2Games = match.team2Score.games;
  const { gamesToWinSet, tiebreakAt } = rulesOf(match);

  // Check for tiebreaker (e.g. 6-6 full set, 3-3 short set)
  if (team1Games === tiebreakAt && team2Games === tiebreakAt) {
    match.isTiebreaker = true;
    match.tiebreakPoints = { team1: 0, team2: 0 };
    match.pointsInGame = 0;
    return match;
  }

  // Check if set is won (target games minimum, win by 2)
  if ((team1Games >= gamesToWinSet && team1Games - team2Games >= 2) ||
      (team2Games >= gamesToWinSet && team2Games - team1Games >= 2)) {
    return endSet(match);
  }

  return match;
}

function endSet(match: Match): Match {
  const updatedMatch = { ...match };
  const team1Games = updatedMatch.team1Score.games;
  const team2Games = updatedMatch.team2Score.games;
  
  // Determine set winner
  if (team1Games > team2Games) {
    updatedMatch.team1Score.sets++;
  } else {
    updatedMatch.team2Score.sets++;
  }
  
  // Reset for next set
  updatedMatch.team1Score.games = 0;
  updatedMatch.team2Score.games = 0;
  updatedMatch.team1Score.points = 0;
  updatedMatch.team2Score.points = 0;
  updatedMatch.currentSet++;
  updatedMatch.isDeuce = false;
  updatedMatch.advantage = undefined;
  updatedMatch.isTiebreaker = false;
  updatedMatch.tiebreakPoints = undefined;
  updatedMatch.pointsInGame = 0;
  
  // Check if match is complete (configurable sets to win, default best of 3)
  const { setsToWin } = rulesOf(updatedMatch);
  if (updatedMatch.team1Score.sets >= setsToWin) {
    updatedMatch.winner = updatedMatch.team1;
    updatedMatch.completed = true;
  } else if (updatedMatch.team2Score.sets >= setsToWin) {
    updatedMatch.winner = updatedMatch.team2;
    updatedMatch.completed = true;
  }

  return updatedMatch;
}

export function getDisplayScore(score: PadelScore, isDeuce: boolean, advantage?: 'team1' | 'team2', teamSide?: 'team1' | 'team2'): string {
  if (isDeuce) {
    if (advantage) {
      return advantage === teamSide ? 'ADV' : '40';
    }
    return 'DEUCE';
  }
  
  return PADEL_POINTS[score.points] || '40';
}

export function simulateMatch(match: Match): Match {
  const updatedMatch = { ...match };
  
  // Simulate a random winner
  const winner = Math.random() < 0.5 ? updatedMatch.team1 : updatedMatch.team2;
  
  // Generate realistic score
  const sets = Math.random() < 0.7 ? 2 : 3; // 70% chance of 2-0, 30% chance of 2-1
  
  if (winner === updatedMatch.team1) {
    updatedMatch.team1Score.sets = 2;
    updatedMatch.team2Score.sets = sets === 3 ? 1 : 0;
  } else {
    updatedMatch.team2Score.sets = 2;
    updatedMatch.team1Score.sets = sets === 3 ? 1 : 0;
  }
  
  // Random final games for last set
  const finalGames = Math.random() < 0.5 ? [6, 4] : [6, 3];
  updatedMatch.team1Score.games = winner === updatedMatch.team1 ? finalGames[0] : finalGames[1];
  updatedMatch.team2Score.games = winner === updatedMatch.team1 ? finalGames[1] : finalGames[0];
  
  updatedMatch.winner = winner;
  updatedMatch.completed = true;
  
  return updatedMatch;
}