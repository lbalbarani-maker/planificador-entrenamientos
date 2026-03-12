export type PermissionKey = 
  | 'metrics.players'
  | 'metrics.teams'
  | 'metrics.attendance'
  | 'metrics.matches'
  | 'metrics.financial'
  | 'metrics.lottery'
  | 'charts.attendanceTrend'
  | 'charts.eventsDistribution'
  | 'charts.teamPerformance'
  | 'charts.financial'
  | 'charts.lotterySellers'
  | 'sections.nextMatch'
  | 'sections.recentEvents'
  | 'sections.teams'
  | 'sections.birthdays'
  | 'sections.trainingStats'
  | 'sections.lotterySellers'
  | 'filters.allTeams'
  | 'filters.ownTeam'
  | 'filters.playerView';

export type UserRole = 
  | 'admin'
  | 'admin_club'
  | 'entrenador'
  | 'preparador'
  | 'coordinador'
  | 'delegado'
  | 'tesorero'
  | 'jugador'
  | 'padre';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  admin_club: 'Admin Club',
  entrenador: 'Entrenador',
  preparador: 'Preparador Físico',
  coordinador: 'Coordinador',
  delegado: 'Delegado',
  tesorero: 'Tesorero',
  jugador: 'Jugador',
  padre: 'Padre/Tutor',
};

export const DASHBOARD_PERMISSIONS: Record<PermissionKey, UserRole[]> = {
  'metrics.players': ['admin', 'admin_club', 'entrenador', 'coordinador'],
  'metrics.teams': ['admin', 'admin_club', 'entrenador', 'coordinador'],
  'metrics.attendance': ['admin', 'admin_club', 'entrenador', 'preparador'],
  'metrics.matches': ['admin', 'admin_club', 'entrenador', 'coordinador', 'delegado'],
  'metrics.financial': ['admin', 'admin_club', 'tesorero'],
  'metrics.lottery': ['admin', 'admin_club', 'coordinador', 'tesorero'],
  
  'charts.attendanceTrend': ['admin', 'admin_club', 'entrenador', 'preparador'],
  'charts.eventsDistribution': ['admin', 'admin_club', 'entrenador', 'coordinador'],
  'charts.teamPerformance': ['admin', 'admin_club', 'entrenador'],
  'charts.financial': ['admin', 'admin_club', 'tesorero'],
  'charts.lotterySellers': ['admin', 'admin_club', 'coordinador', 'tesorero'],
  
  'sections.nextMatch': ['admin', 'admin_club', 'entrenador', 'coordinador', 'delegado', 'jugador', 'padre'],
  'sections.recentEvents': ['admin', 'admin_club', 'entrenador', 'coordinador', 'delegado'],
  'sections.teams': ['admin', 'admin_club', 'entrenador', 'coordinador'],
  'sections.birthdays': ['admin', 'admin_club', 'entrenador', 'coordinador'],
  'sections.trainingStats': ['admin', 'admin_club', 'entrenador', 'preparador'],
  'sections.lotterySellers': ['admin', 'admin_club', 'coordinador', 'tesorero'],
  
  'filters.allTeams': ['admin', 'admin_club', 'coordinador'],
  'filters.ownTeam': ['entrenador', 'delegado'],
  'filters.playerView': ['jugador', 'padre'],
};

export const hasPermission = (permission: PermissionKey, roles: string | string[]): boolean => {
  const roleArray = Array.isArray(roles) ? roles : roles.split(',');
  const allowedRoles = DASHBOARD_PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return roleArray.some(role => allowedRoles.includes(role as UserRole));
};
