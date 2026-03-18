export interface HockeyMatch {
  id: string;
  event_id?: string;
  quarter: number;
  quarter_duration: number;
  remaining_time: number;
  running: boolean;
  status: 'pending' | 'active' | 'paused' | 'finished';
  team1_name: string;
  team1_color: string;
  team1_logo_url?: string;
  team2_name: string;
  team2_color: string;
  team2_logo_url?: string;
  score_team1: number;
  score_team2: number;
  sponsor_logo_url?: string;
  sponsor_name?: string;
  sponsor_text?: string;
  youtube_url?: string;
  admin_pin_hash?: string;
  share_token: string;
  created_at: string;
  updated_at: string;
  start_time?: number | null;
  location?: string;
  location_link?: string;
}

export interface HockeyPlayer {
  id: string;
  match_id: string;
  team: 'team1' | 'team2';
  player_name: string;
  dorsal?: string;
  position?: string;
  is_goalkeeper: boolean;
}

export interface HockeyGoal {
  id: string;
  match_id: string;
  team: 'team1' | 'team2';
  player_id?: string;
  player_name?: string;
  dorsal?: string;
  quarter: number;
  elapsed_in_quarter: number;
  match_minute: number;
  is_penalty: boolean;
  timestamp: string;
}

export interface HockeySave {
  id: string;
  match_id: string;
  team: 'team1' | 'team2';
  player_id?: string;
  player_name?: string;
  dorsal?: string;
  quarter: number;
  elapsed_in_quarter?: number;
  match_minute: number;
  timestamp: string;
}

export interface HockeyMatchWithDetails extends HockeyMatch {
  players?: HockeyPlayer[];
  goals?: HockeyGoal[];
  saves?: HockeySave[];
}

export interface CreateMatchInput {
  team1_name: string;
  team1_color: string;
  team1_logo_url?: string;
  team2_name: string;
  team2_color: string;
  team2_logo_url?: string;
  quarter_duration?: number;
  sponsor_logo_url?: string;
  sponsor_name?: string;
  sponsor_text?: string;
  youtube_url?: string;
  admin_pin?: string;
  event_id?: string;
}

export interface UpdateMatchInput {
  quarter?: number;
  remaining_time?: number;
  running?: boolean;
  status?: 'pending' | 'active' | 'paused' | 'finished';
  score_team1?: number;
  score_team2?: number;
  youtube_url?: string;
  sponsor_logo_url?: string;
  sponsor_name?: string;
  sponsor_text?: string;
  start_time?: number | null;
}

export interface EditMatchInput {
  team1_name?: string;
  team1_color?: string;
  team1_logo_url?: string;
  team2_name?: string;
  team2_color?: string;
  team2_logo_url?: string;
  quarter_duration?: number;
  youtube_url?: string;
  sponsor_logo_url?: string;
  sponsor_name?: string;
  sponsor_text?: string;
  location?: string;
  location_link?: string;
  admin_pin?: string;
}

export interface AddGoalInput {
  team: 'team1' | 'team2';
  player_id?: string;
  player_name: string;
  dorsal?: string;
  quarter: number;
  elapsed_in_quarter: number;
  match_minute: number;
  is_penalty?: boolean;
}

export interface AddSaveInput {
  team: 'team1' | 'team2';
  player_id?: string;
  player_name?: string;
  dorsal?: string;
  quarter: number;
  elapsed_in_quarter?: number;
  match_minute: number;
}

export interface TeamSetupData {
  team1: {
    name: string;
    color: string;
    logo?: string;
    players: PlayerData[];
  };
  team2: {
    name: string;
    color: string;
    logo?: string;
    players: PlayerData[];
  };
  sponsorLogo?: string;
  sponsorName?: string;
  sponsorText?: string;
  adminPin: string;
  quarterDuration: number;
  youtubeUrl?: string;
}

export interface PlayerData {
  id: string;
  name: string;
  number: string;
  position: string;
  selected: boolean;
}
