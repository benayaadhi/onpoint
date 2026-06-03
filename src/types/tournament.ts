export interface Team {
  id: string;
  name: string;
  wins?: number;
  losses?: number;
  setsWon?: number;
  setsLost?: number;
  gamesWon?: number;
  gamesLost?: number;
  // Race-mode standings (games/points accumulated across matches)
  pointsWon?: number;
  pointsLost?: number;
}

export interface Court {
  id: string;
  name: string;
  slug?: string; // URL-safe version of name, e.g. "court-7"
  isAvailable: boolean;
  currentMatch?: string; // Match ID
  location?: string;
  surface?: 'clay' | 'artificial-grass' | 'concrete' | 'indoor';
}

export type MatchStatus =
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export interface MatchSchedule {
  scheduledTime?: string;
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number; // minutes
}

export interface PadelScore {
  games: number;
  points: number;
  sets: number;
}

export interface MatchRules {
  setsToWin: number; // sets needed to win the match (best of 1/3/5 → 1/2/3)
  gamesToWinSet: number; // games needed to win a set (e.g. 6 full, 4 short)
  tiebreakAt: number; // games-each that triggers a tiebreak (6 full, 3 short)
  tiebreakPoints: number; // points to win the tiebreak game (win by 2)
  goldenPoint: boolean; // true = sudden death at 40-40, false = advantage
}

export const DEFAULT_MATCH_RULES: MatchRules = {
  setsToWin: 2,
  gamesToWinSet: 6,
  tiebreakAt: 6,
  tiebreakPoints: 7,
  goldenPoint: false,
};

export interface Match {
  id: string;
  team1: Team;
  team2: Team;
  team1Score: PadelScore;
  team2Score: PadelScore;
  winner?: Team;
  completed: boolean;
  round: number;
  position: number;
  currentSet: number;
  currentGame: number;
  servingTeam: 'team1' | 'team2';
  isDeuce: boolean;
  advantage?: 'team1' | 'team2';
  isTiebreaker: boolean;
  tiebreakPoints?: { team1: number; team2: number };
  pointsInGame: number;
  // Court system additions
  courtId?: string;
  status: MatchStatus;
  schedule: MatchSchedule;
  // Group system additions
  groupId?: string;
  setHistory?: SetHistory[];
  // Scoring mode (set on match from tournament config)
  scoringMode?: 'padel' | 'race';
  raceTarget?: number;
  team1RaceScore?: number;
  team2RaceScore?: number;
  isGoldenPoint?: boolean;
  // Configurable padel rules (falls back to DEFAULT_MATCH_RULES when absent)
  rules?: MatchRules;
}

export interface SetHistory {
  setNumber: number;
  team1Games: number;
  team2Games: number;
  winner: 'team1' | 'team2';
  completed: boolean;
}

export interface Group {
  id: string;
  name: string; // "Group A", "Group B", etc.
  teams: Team[];
  preferredCourtId?: string;
  completed: boolean;
  matches: Match[];
  standings: Team[];
}

export interface Tournament {
  id: string;
  name: string;
  slug?: string; // URL-safe version of name, e.g. "wepadl-2025"
  format: 'round-robin' | 'single-elimination' | 'group-knockout';
  teams: Team[];
  matches: Match[];
  courts: Court[];
  currentRound: number;
  completed: boolean;
  winner?: Team;
  createdAt: string;
  // Tournament scheduling settings
  matchDuration: number; // default match duration in minutes
  breakBetweenMatches: number; // break time between matches in minutes
  // Group system additions
  groups?: Group[];
  groupStage?: boolean; // true if still in group stage
  scoringMode?: 'padel' | 'race';
  raceTarget?: number;
  showSponsorBar?: boolean;
  // Configurable rules (padel scoring + group structure)
  matchRules?: MatchRules;
  teamsPerGroup?: number; // default 4
  qualifiersPerGroup?: number; // teams advancing from each group, default 2
}

export interface TournamentConfig {
  matchRules: MatchRules;
  teamsPerGroup: number;
  qualifiersPerGroup: number;
}

export type TournamentFormat =
  | 'round-robin'
  | 'single-elimination'
  | 'group-knockout';
