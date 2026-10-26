import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export function dataSourceOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  const driver = config.get<string>('database.driver');
  const isPostgres = driver === 'postgres';

  const common = {
    autoLoadEntities: true,
    synchronize: config.get<boolean>('database.synchronize') ?? true,
    logging: config.get<string>('nodeEnv') === 'development',
  };

  if (isPostgres) {
    const rawUrl = config.get<string>('database.url');
    if (rawUrl) {
      // Fail fast with a readable message instead of endless
      // "getaddrinfo ENOTFOUND ..." retries when the connection
      // string is truncated or has unencoded special characters.
      let host: string | null = null;
      try {
        host = new URL(rawUrl).hostname || null;
      } catch {
        host = null;
      }
      if (!host) {
        throw new Error(
          'DATABASE_URL is not a valid PostgreSQL connection string. ' +
            'Expected format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE ' +
            '(URL-encode @ # ? / : in the password).',
        );
      }
    }
    return {
      ...common,
      type: 'postgres' as const,
      url: config.get<string>('database.url') || undefined,
      host: config.get<string>('database.host'),
      port: config.get<number>('database.port'),
      username: config.get<string>('database.user'),
      password: config.get<string>('database.password'),
      database: config.get<string>('database.name'),
      ssl: config.get<boolean>('database.ssl')
        ? { rejectUnauthorized: false }
        : undefined,
    };
  }

  const dir = join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true });
  return {
    ...common,
    type: 'sqljs' as const,
    location: join(dir, 'dev.sqlite'),
    autoSave: true,
  };
}