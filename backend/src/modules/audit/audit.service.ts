import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditPayload {
  businessId?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(payload: AuditPayload): Promise<void> {
    try {
      await this.repo.save(this.repo.create(payload));
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${payload.action} ${payload.entity}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}