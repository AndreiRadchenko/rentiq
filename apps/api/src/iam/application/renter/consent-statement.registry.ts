import { Injectable } from '@nestjs/common';

export interface ConsentStatement {
  version: string;
  materialChange: boolean;
  publishedAt: Date;
}

export interface PublishStatementInput {
  version: string;
  materialChange: boolean;
}

@Injectable()
export class ConsentStatementRegistry {
  private readonly statements = new Map<string, ConsentStatement>();
  private currentVersion: string;

  constructor() {
    this.currentVersion = 'v1';
    this.statements.set('v1', {
      version: 'v1',
      materialChange: false,
      publishedAt: new Date('2026-07-31T00:00:00.000Z'),
    });
  }

  getCurrent(): ConsentStatement {
    const statement = this.statements.get(this.currentVersion);
    if (!statement) {
      throw new Error(`Current consent statement ${this.currentVersion} not found`);
    }
    return statement;
  }

  findByVersion(version: string): ConsentStatement | null {
    return this.statements.get(version) ?? null;
  }

  publish(input: PublishStatementInput): ConsentStatement {
    const statement: ConsentStatement = {
      version: input.version,
      materialChange: input.materialChange,
      publishedAt: new Date(),
    };
    this.statements.set(input.version, statement);
    this.currentVersion = input.version;
    return statement;
  }

  isCurrent(version: string): boolean {
    return version === this.currentVersion;
  }

  requiresReConsent(renterConsentVersion: string): boolean {
    const current = this.getCurrent();
    if (!current.materialChange) {
      return false;
    }
    return !this.isCurrent(renterConsentVersion);
  }
}
