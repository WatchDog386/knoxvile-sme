import { Request } from 'express';

export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  ACCOUNTANT = 'ACCOUNTANT',
  /** A WiFi client with an app login: sees only their own package, payments and receipts. */
  CLIENT = 'CLIENT',
}

/** Roles that run the business (everyone except clients). */
export const STAFF_ROLES = [UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.EMPLOYEE] as const;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

export interface RequestWithUser extends Request {
  user: AuthUser;
  membership: {
    id: string;
    businessId: string;
    role: UserRole;
    /** Set for CLIENT logins: the client record they belong to. */
    customerId?: string | null;
  };
  business: {
    id: string;
    name: string;
    timezone: string;
    currency: string;
  };
}