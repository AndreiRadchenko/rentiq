import { Currency } from './currency';

export class Money {
  private constructor(
    private readonly amountMinor: number,
    private readonly currency: Currency,
  ) {}

  static from(amountMinor: number, currency: Currency): Money {
    if (!Object.values(Currency).includes(currency)) {
      throw new Error(`Invalid currency: ${currency}. Allowed: ${Object.values(Currency).join(', ')}`);
    }
    if (!Number.isInteger(amountMinor) || amountMinor < 0) {
      throw new Error(`Invalid amount: ${amountMinor}. Amount must be a non-negative integer`);
    }
    return new Money(amountMinor, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot add ${this.currency} and ${other.currency}`);
    }
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot subtract ${other.currency} from ${this.currency}`);
    }
    const result = this.amountMinor - other.amountMinor;
    if (result < 0) {
      throw new Error(`Insufficient funds: ${this.amountMinor} - ${other.amountMinor} = ${result}`);
    }
    return new Money(result, this.currency);
  }

  equals(other: Money): boolean {
    return this.amountMinor === other.amountMinor && this.currency === other.currency;
  }

  isGreaterThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot compare ${this.currency} and ${other.currency}`);
    }
    return this.amountMinor > other.amountMinor;
  }

  isLessThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot compare ${this.currency} and ${other.currency}`);
    }
    return this.amountMinor < other.amountMinor;
  }

  getAmountMinor(): number {
    return this.amountMinor;
  }

  getCurrency(): Currency {
    return this.currency;
  }
}
