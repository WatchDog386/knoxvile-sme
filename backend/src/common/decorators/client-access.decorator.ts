import { SetMetadata } from '@nestjs/common';

export const CLIENT_ACCESS_KEY = 'clientAccess';

/**
 * Lets CLIENT logins (WiFi clients) through BusinessGuard. Everything without
 * it is staff-only: a client can never reach business data by accident.
 */
export const ClientAccess = () => SetMetadata(CLIENT_ACCESS_KEY, true);
