import { useActiveBusiness } from '@/stores/business';
import type { UserRole } from '@/api/types';

const APPROVER_ROLES: UserRole[] = ['OWNER', 'MANAGER', 'ACCOUNTANT'];
const MANAGER_ROLES: UserRole[] = ['OWNER', 'MANAGER'];

/** The signed-in user's role in the active business, plus permission flags. */
export function useRole() {
  const role = useActiveBusiness()?.role ?? null;
  return {
    role,
    /** Approve/reject expenses, manage recurring expenses, see reports. */
    canApprove: role !== null && APPROVER_ROLES.includes(role),
    /** Create and change budgets; delete expenses. */
    canManage: role !== null && MANAGER_ROLES.includes(role),
    /** Admins: owner, manager and accountant (they get the full dashboard). */
    isAdmin: role !== null && APPROVER_ROLES.includes(role),
    isEmployee: role === 'EMPLOYEE',
    /** A WiFi client using the client app: sees only their own package and payments. */
    isClient: role === 'CLIENT',
  };
}
