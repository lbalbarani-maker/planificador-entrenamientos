import { useMemo } from 'react';
import { PermissionKey, UserRole, hasPermission, DASHBOARD_PERMISSIONS } from '../config/dashboardPermissions';

export const useRolePermissions = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const roles = user.role || 'jugador';

  const can = useMemo(() => {
    return {
      view: (permission: PermissionKey): boolean => {
        return hasPermission(permission, roles);
      },
      viewAny: (permissions: PermissionKey[]): boolean => {
        return permissions.some(p => hasPermission(p, roles));
      },
      getFilteredSections: <T extends { permission?: PermissionKey }>(items: T[]): T[] => {
        return items.filter(item => !item.permission || hasPermission(item.permission, roles));
      },
      getAllowedPermissions: (): PermissionKey[] => {
        return Object.entries(DASHBOARD_PERMISSIONS)
          .filter(([, allowedRoles]) => {
            const roleArray = roles.split(',');
            return roleArray.some((role: string) => allowedRoles.includes(role as UserRole));
          })
          .map(([key]) => key as PermissionKey);
      },
    };
  }, [roles]);

  return {
    can,
    roles,
    isAdmin: hasPermission('filters.allTeams', roles),
    isPlayer: hasPermission('filters.playerView', roles),
  };
};
