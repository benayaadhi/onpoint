import { Match } from '../types/tournament';

/**
 * Race-to-N Scoring Engine
 *
 * Each game uses standard tennis-style points: 0, 15, 30, 40.
 * At 40-40: GOLDEN POINT (no deuce, single deciding point).
 * Race to N = first team to win N games wins the match.
 *
 * Fields used on Match:
 * - team1RaceScore / team2RaceScore: games won by each team
 * - raceTarget: number of games to win (4 for group-semi, 6 for final)
 * - team1Score.points / team2Score.points: current game points (reused from PadelScore)
 * - isGoldenPoint: true when both teams are at 40 (3 points each)
 */

export function addRacePoint(match: Match, team: 'team1' | 'team2'): Match {
  const updated = { ...match };
  const target = updated.raceTarget || 4;

  // Increment point
  if (team === 'team1') {
    updated.team1Score = { ...updated.team1Score, points: updated.team1Score.points + 1 };
  } else {
    updated.team2Score = { ...updated.team2Score, points: updated.team2Score.points + 1 };
  }

  const p1 = updated.team1Score.points;
  const p2 = updated.team2Score.points;

  // Check golden point state (both at 40 = 3 points each)
  updated.isGoldenPoint = p1 >= 3 && p2 >= 3 && p1 === p2;

  // Check if game is won
  let gameWinner: 'team1' | 'team2' | null = null;

  if (p1 >= 3 && p2 >= 3) {
    // At 40-40 or beyond: golden point — next point wins
    if (p1 > p2) {
      gameWinner = 'team1';
    } else if (p2 > p1) {
      gameWinner = 'team2';
    }
    // If equal (just reached 40-40), no winner yet — golden point
  } else if (p1 >= 4) {
    gameWinner = 'team1';
  } else if (p2 >= 4) {
    gameWinner = 'team2';
  }

  if (gameWinner) {
    // Reset points for next game
    updated.team1Score = { ...updated.team1Score, points: 0 };
    updated.team2Score = { ...updated.team2Score, points: 0 };
    updated.isGoldenPoint = false;

    // Increment games won
    if (gameWinner === 'team1') {
      updated.team1RaceScore = (updated.team1RaceScore || 0) + 1;
    } else {
      updated.team2RaceScore = (updated.team2RaceScore || 0) + 1;
    }

    // Check match win
    if ((updated.team1RaceScore || 0) >= target) {
      updated.winner = updated.team1;
      updated.completed = true;
      updated.status = 'completed';
    } else if ((updated.team2RaceScore || 0) >= target) {
      updated.winner = updated.team2;
      updated.completed = true;
      updated.status = 'completed';
    } else {
      // Rotate serve after each game win (padel rule)
      updated.servingTeam = updated.servingTeam === 'team1' ? 'team2' : 'team1';
    }
  }

  return updated;
}

export function isGoldenPoint(match: Match): boolean {
  const p1 = match.team1Score.points;
  const p2 = match.team2Score.points;
  return p1 >= 3 && p2 >= 3 && p1 === p2;
}

export function getRacePointDisplay(points: number): string {
  switch (points) {
    case 0: return '0';
    case 1: return '15';
    case 2: return '30';
    case 3: return '40';
    default: return '40';
  }
}

export function getRaceDisplayScore(match: Match): {
  team1Games: number;
  team2Games: number;
  team1Points: string;
  team2Points: string;
  target: number;
  isGolden: boolean;
} {
  return {
    team1Games: match.team1RaceScore || 0,
    team2Games: match.team2RaceScore || 0,
    team1Points: getRacePointDisplay(match.team1Score.points),
    team2Points: getRacePointDisplay(match.team2Score.points),
    target: match.raceTarget || 4,
    isGolden: isGoldenPoint(match),
  };
}
