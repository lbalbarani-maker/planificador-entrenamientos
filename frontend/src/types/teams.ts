export interface Club {
  id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  address?: string;
  google_maps_url?: string;
  website?: string;
  created_at: string;
}

export interface Team {
  id: string;
  club_id: string;
  season_id?: string;
  name: string;
  category?: string;
  gender?: string;
  created_at: string;
  club?: Club;
}

export interface Player {
  id: string;
  club_id: string;
  full_name: string;
  birth_date?: string;
  dorsal?: number;
  gender?: string;
  position?: string;
  is_minor: boolean;
  is_self_managed: boolean;
  is_active?: boolean;
  parent_id?: string;
  created_at: string;
  teams?: Team[];
}

export interface TeamPlayer {
  id: string;
  team_id: string;
  player_id: string;
  shirt_number?: number;
  position?: string;
  is_active: boolean;
  created_at: string;
  player?: Player;
}

export interface Training {
  id: string;
  name: string;
  categories: string[];
  exercises: any[];
  totalTime: number;
  observations: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  shareId: string;
}

export interface Event {
  id: string;
  team_id: string;
  type: 'match' | 'training' | 'meeting';
  title?: string;
  start_datetime: string;
  location?: string;
  location_link?: string;
  kit_color?: string;
  notes?: string;
  opponent?: string;
  training_id?: string;
  final_convocation?: string;
  created_at: string;
  team?: Team;
  training?: Training;
}

export interface Convocation {
  id: string;
  event_id: string;
  player_id: string;
  status: 'pending' | 'accepted' | 'declined';
  response_note?: string;
  dorsal?: number;
  player_name?: string;
  created_at: string;
  updated_at: string;
  player?: Player;
}

export interface CreateTeamInput {
  name: string;
  category?: string;
  gender?: string;
}

export interface CreateEventInput {
  team_id: string;
  type: 'match' | 'training' | 'meeting';
  title?: string;
  start_datetime: string;
  convocation_time?: string | null;
  location?: string;
  location_link?: string;
  kit_color?: string;
  notes?: string;
  opponent?: string;
  training_id?: string;
}

export interface CreateConvocationInput {
  event_id: string;
  player_id: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  google_maps_url?: string;
  surface?: string;
  has_parking?: boolean;
  has_locker_rooms?: boolean;
  notes?: string;
  is_active?: boolean;
  created_at: string;
}

export interface Field {
  id: string;
  club_id: string;
  name: string;
  address?: string;
  google_maps_url?: string;
  surface?: string;
  has_parking: boolean;
  has_locker_rooms: boolean;
  notes?: string;
  created_at: string;
}

export interface OpponentTeam {
  id: string;
  club_id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  category?: string;
  created_at: string;
}
