export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  nationality: string;
  elo: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

export interface SetScore {
  p1: number;
  p2: number;
}

export type MatchFormat = 'singles' | 'doubles';
export type MatchType = 'best_of_3' | 'tiebreaker_to_7';

export interface Match {
  id: string;
  match_format: MatchFormat;
  match_type: MatchType;
  player1_id: string;
  player2_id: string;
  player3_id: string | null;
  player4_id: string | null;
  score: SetScore[];
  winner_side: 1 | 2;
  player1_elo_before: number | null;
  player2_elo_before: number | null;
  player1_elo_after: number | null;
  player2_elo_after: number | null;
  played_at: string;
  created_by: string;
  created_at: string;
  // Joined profiles
  player1?: Profile;
  player2?: Profile;
  player3?: Profile;
  player4?: Profile;
}

export interface Achievement {
  id: string;
  profile_id: string;
  achievement_key: string;
  unlocked_at: string;
}

export interface PlayerOfTheWeek {
  id: string;
  profile_id: string;
  week_start: string;
  wins_count: number;
  tiebreaker_elo: number;
  created_at: string;
  profile?: Profile;
}

export interface AchievementDef {
  key: string;
  name: string;
  emoji: string;
  description: string;
  check: (stats: PlayerStats) => boolean;
}

export interface PlayerStats {
  wins: number;
  losses: number;
  currentStreak: number;
  maxStreak: number;
  elo: number;
  matchesPlayed: number;
  biggestUpset: number; // largest Elo diff where player won as underdog
  comebacks: number; // won after losing first set
}
