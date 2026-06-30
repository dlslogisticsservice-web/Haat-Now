import React, { useEffect, useState } from 'react';
import { rbacService } from '../services/rbac.service';

/** Live "acting role" + permission check. Re-renders when the acting role changes. */
export function useRbac() {
  const [acting, setActing] = useState(rbacService.getActingRole());
  useEffect(() => {
    const h = () => setActing(rbacService.getActingRole());
    window.addEventListener('rbac-acting-changed', h);
    return () => window.removeEventListener('rbac-acting-changed', h);
  }, []);
  return {
    acting,
    can: (perm: string) => rbacService.hasPermission(acting, perm),
    setActing: (id: string) => rbacService.setActingRole(id),
  };
}

/** Feature guard — renders children only if the acting role holds the permission. */
export const Can: React.FC<{ perm: string; children: React.ReactNode; fallback?: React.ReactNode }> = ({ perm, children, fallback = null }) => {
  const { can } = useRbac();
  return <>{can(perm) ? children : fallback}</>;
};
