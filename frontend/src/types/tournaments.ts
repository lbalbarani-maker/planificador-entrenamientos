export interface Season {
  id: string;
  club_id?: string;
  name: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  created_at: string;
}

export interface Tournament {
  id: string;
  season_id: string;
  name: string;
  modality: 'field' | 'indoor';
  competition_type: 'league' | 'cup' | 'friendly';
  is_system?: boolean;
  created_at: string;
  season?: Season;
}

export interface Matchday {
  id: string;
  tournament_id: string;
  round_number?: number;
  name?: string;
  start_date?: string;
  created_at: string;
  matches?: any[];
}

export interface Standing {
  id: string;
  tournament_id: string;
  team_id: string;
  team_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export interface MatchEvent {
  id: string;
  event_id: string;
  player_id?: string;
  team_id?: string;
  event_type: 'goal' | 'green_card' | 'yellow_card' | 'red_card' | 'blue_card';
  minute: number;
  is_own_goal?: boolean;
  is_penalty?: boolean;
  created_at: string;
  player?: {
    id: string;
    full_name: string;
  };
  team?: {
    id: string;
    name: string;
  };
}
