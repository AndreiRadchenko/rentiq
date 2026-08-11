import { SetMetadata } from '@nestjs/common';
import { Logger } from '@nestjs/common';

export const AUDITABLE_ACTION = 'auditableAction';

export interface AuditableActionMetadata {
  action: string;
}

export const AuditableAction = (action: string): MethodDecorator =>
  SetMetadata(AUDITABLE_ACTION, { action } as AuditableActionMetadata);

export class AuditableLogger {
  private readonly logger = new Logger('AuditableAction');

  log(action: string, actorId: string | undefined, orgId: string | undefined, payload: Record<string, unknown>): void {
    this.logger.log({
      action,
      actorId: actorId ?? null,
      orgId: orgId ?? null,
      payload,
    });
  }
}
