import { Money } from '../../shared-kernel/domain/value-objects/money';
import { Currency } from '../../shared-kernel/domain/value-objects/currency';
import type { DayType } from './day-type';

export interface TariffState {
  id: string;
  orgId: string;
  kitType: string;
  dayType: DayType;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CreateTariffInput {
  id: string;
  orgId: string;
  kitType: string;
  dayType: DayType;
  durationMinutes: number;
  priceMinor: number;
  currency?: string;
}

export class DuplicateTariffError extends Error {
  readonly existingTariffId: string;
  constructor(existingTariffId: string) {
    super('A non-deleted tariff with the same key already exists');
    this.name = 'DuplicateTariffError';
    this.existingTariffId = existingTariffId;
  }
}

export class Tariff {
  private constructor(private readonly state: TariffState) {}

  static create(input: CreateTariffInput): Tariff {
    if (!input.kitType.trim()) throw new Error('Tariff kitType must not be empty');
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
      throw new Error('Tariff durationMinutes must be a positive integer');
    }
    if (!Number.isInteger(input.priceMinor) || input.priceMinor < 0) {
      throw new Error('Tariff priceMinor must be a non-negative integer');
    }
    const currency = input.currency ?? Currency.UAH;
    if (!Object.values(Currency).includes(currency as Currency)) {
      throw new Error(`Invalid currency: ${currency}`);
    }
    return new Tariff({
      id: input.id,
      orgId: input.orgId,
      kitType: input.kitType.trim(),
      dayType: input.dayType,
      durationMinutes: input.durationMinutes,
      priceMinor: input.priceMinor,
      currency,
      createdAt: new Date(),
      deletedAt: null,
    });
  }

  static reconstitute(state: TariffState): Tariff {
    return new Tariff({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get orgId(): string {
    return this.state.orgId;
  }

  get currentState(): TariffState {
    return { ...this.state };
  }

  get kitType(): string {
    return this.state.kitType;
  }

  get dayType(): DayType {
    return this.state.dayType;
  }

  get durationMinutes(): number {
    return this.state.durationMinutes;
  }

  lockPrice(): Money {
    return Money.from(this.state.priceMinor, this.state.currency as Currency);
  }

  updatePrice(priceMinor: number, currency?: string): void {
    if (!Number.isInteger(priceMinor) || priceMinor < 0) {
      throw new Error('Tariff priceMinor must be a non-negative integer');
    }
    this.state.priceMinor = priceMinor;
    if (currency !== undefined) {
      if (!Object.values(Currency).includes(currency as Currency)) {
        throw new Error(`Invalid currency: ${currency}`);
      }
      this.state.currency = currency;
    }
  }

  softDelete(now: Date = new Date()): void {
    this.state.deletedAt = now;
  }

  get isDeleted(): boolean {
    return this.state.deletedAt !== null;
  }
}
