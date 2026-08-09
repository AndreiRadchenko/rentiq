import { Injectable } from '@nestjs/common';

export const RENTER_RETENTION_YEARS = 3;
export const ANONYMOUS_RENTER_NAME = 'ANONYMIZED';
export const ANONYMOUS_PHONE_PREFIX = '+00000000000';

export interface RenterAnonymizationTarget {
  id: string;
  orgId: string;
  status: string;
  consentGivenAt: Date;
  name: string;
  phone: string;
}

export interface RenterAnonymizerWriter {
  anonymize(targetId: string, orgId: string, anonymousName: string, anonymousPhone: string): Promise<void>;
}

@Injectable()
export class RenterAnonymizer {
  constructor(private readonly writer: RenterAnonymizerWriter) {}

  isRetentionElapsed(consentGivenAt: Date, now: Date): boolean {
    const retentionDeadline = new Date(consentGivenAt);
    retentionDeadline.setUTCFullYear(
      retentionDeadline.getUTCFullYear() + RENTER_RETENTION_YEARS,
    );
    return now >= retentionDeadline;
  }

  async anonymizeIfEligible(target: RenterAnonymizationTarget, now: Date): Promise<boolean> {
    if (target.status !== 'DISABLED') {
      return false;
    }
    if (!this.isRetentionElapsed(target.consentGivenAt, now)) {
      return false;
    }
    await this.writer.anonymize(
      target.id,
      target.orgId,
      ANONYMOUS_RENTER_NAME,
      ANONYMOUS_PHONE_PREFIX,
    );
    return true;
  }
}
