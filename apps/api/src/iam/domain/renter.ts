export type RenterStatus = 'ACTIVE' | 'DISABLED';
export type DisableReason = 'ADMIN' | 'DELETION_REQUEST';

export interface RenterState {
  id: string;
  orgId: string;
  telegramId: number | null;
  phone: string;
  name: string;
  consentGivenAt: Date;
  consentVersion: string;
  locale: string;
  status: RenterStatus;
  disableReason: DisableReason | null;
  createdAt: Date;
}

export interface RegisterRenterInput {
  id: string;
  orgId: string;
  telegramId?: number | null;
  phone: string;
  name: string;
  consentGivenAt: Date;
  consentVersion: string;
  locale: string;
}

export class Renter {
  private constructor(private readonly state: RenterState) {}

  static register(input: RegisterRenterInput): Renter {
    return new Renter({
      id: input.id,
      orgId: input.orgId,
      telegramId: input.telegramId ?? null,
      phone: input.phone,
      name: input.name,
      consentGivenAt: input.consentGivenAt,
      consentVersion: input.consentVersion,
      locale: input.locale,
      status: 'ACTIVE',
      disableReason: null,
      createdAt: new Date(),
    });
  }

  static reconstitute(state: RenterState): Renter {
    return new Renter({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get orgId(): string {
    return this.state.orgId;
  }

  get status(): RenterStatus {
    return this.state.status;
  }

  get disableReason(): DisableReason | null {
    return this.state.disableReason;
  }

  get consentVersion(): string {
    return this.state.consentVersion;
  }

  get currentState(): RenterState {
    return { ...this.state };
  }

  changeLocale(locale: string): void {
    this.state.locale = locale;
  }

  disableByAdmin(): void {
    this.state.status = 'DISABLED';
    this.state.disableReason = 'ADMIN';
  }

  disableByDeletionRequest(): void {
    this.state.status = 'DISABLED';
    this.state.disableReason = 'DELETION_REQUEST';
  }

  reEnable(): void {
    if (this.state.disableReason === 'DELETION_REQUEST') {
      throw new Error('Renter disabled via deletion request cannot be re-enabled');
    }
    this.state.status = 'ACTIVE';
    this.state.disableReason = null;
  }

  reConsent(consentVersion: string): void {
    this.state.consentVersion = consentVersion;
    this.state.consentGivenAt = new Date();
  }

  anonymize(anonymousName: string, anonymousPhone: string): void {
    this.state.name = anonymousName;
    this.state.phone = anonymousPhone;
  }

  canBook(requiresReConsent: boolean): boolean {
    return this.state.status === 'ACTIVE' && !requiresReConsent;
  }
}
