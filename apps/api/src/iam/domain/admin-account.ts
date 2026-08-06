export type AdminRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'STATION_OPERATOR';
export type AdminAccountStatus = 'ACTIVE' | 'DISABLED';

export interface RecoveryChannel {
  type: 'email' | 'sms' | 'phone';
  value: string;
}

export interface AdminAccountState {
  id: string;
  orgId: string | null;
  email: string;
  passwordHash: string;
  role: AdminRole;
  assignedStationIds: string[];
  locale: string;
  status: AdminAccountStatus;
  recoveryChannel: RecoveryChannel | null;
  createdAt: Date;
}

export interface CreateAdminAccountInput {
  id: string;
  orgId: string | null;
  email: string;
  passwordHash: string;
  role: AdminRole;
  locale?: string;
}

export class AdminAccount {
  private constructor(private readonly state: AdminAccountState) {}

  static create(input: CreateAdminAccountInput): AdminAccount {
    if (input.role === 'SUPER_ADMIN' && input.orgId !== null) {
      throw new Error('SUPER_ADMIN must not belong to an organization');
    }
    if (input.role !== 'SUPER_ADMIN' && input.orgId === null) {
      throw new Error('Non-super admin accounts must belong to an organization');
    }
    return new AdminAccount({
      id: input.id,
      orgId: input.orgId,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      assignedStationIds: [],
      locale: input.locale ?? 'uk',
      status: 'ACTIVE',
      recoveryChannel: null,
      createdAt: new Date(),
    });
  }

  static reconstitute(state: AdminAccountState): AdminAccount {
    return new AdminAccount({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get orgId(): string | null {
    return this.state.orgId;
  }

  get role(): AdminRole {
    return this.state.role;
  }

  get email(): string {
    return this.state.email;
  }

  get passwordHash(): string {
    return this.state.passwordHash;
  }

  get status(): AdminAccountStatus {
    return this.state.status;
  }

  get currentState(): AdminAccountState {
    return { ...this.state };
  }

  get isActive(): boolean {
    return this.state.status === 'ACTIVE';
  }

  disable(): void {
    this.state.status = 'DISABLED';
  }

  assignRole(role: AdminRole): void {
    this.state.role = role;
  }

  assignRecoveryChannel(channel: RecoveryChannel): void {
    this.state.recoveryChannel = channel;
  }
}
