import type { DayType } from '../infrastructure/drizzle/schema/tariffs.schema';

export interface OvertimeTariffBand {
  durationMinutes: number;
  priceMinor: number;
}

export interface OvertimeResult {
  bandDurationMinutes: number;
  totalPrice: number;
  surchargeAmount: number;
}

export interface OvertimeCalculatorInput {
  bookingDayType: DayType;
  paidDurationMinutes: number;
  actualDurationMinutes: number;
  tariffs: OvertimeTariffBand[];
}

export class OvertimeCalculator {
  calculate(input: OvertimeCalculatorInput): OvertimeResult {
    const { paidDurationMinutes, actualDurationMinutes, tariffs } = input;

    if (actualDurationMinutes <= paidDurationMinutes) {
      const paidBand = this.roundUpToBand(actualDurationMinutes, tariffs);
      const paidTariff = this.findBand(paidBand, tariffs);
      return {
        bandDurationMinutes: paidBand,
        totalPrice: paidTariff?.priceMinor ?? 0,
        surchargeAmount: 0,
      };
    }

    const actualBand = this.roundUpToBand(actualDurationMinutes, tariffs);
    const actualTariff = this.findBand(actualBand, tariffs);
    const paidTariff = this.findBand(paidDurationMinutes, tariffs);
    const totalPrice = actualTariff?.priceMinor ?? 0;
    const paidPrice = paidTariff?.priceMinor ?? 0;
    return {
      bandDurationMinutes: actualBand,
      totalPrice,
      surchargeAmount: Math.max(0, totalPrice - paidPrice),
    };
  }

  private roundUpToBand(minutes: number, tariffs: OvertimeTariffBand[]): number {
    const sorted = [...tariffs].sort((a, b) => a.durationMinutes - b.durationMinutes);
    for (const band of sorted) {
      if (minutes <= band.durationMinutes) {
        return band.durationMinutes;
      }
    }
    return sorted.length > 0 ? sorted[sorted.length - 1].durationMinutes : minutes;
  }

  private findBand(durationMinutes: number, tariffs: OvertimeTariffBand[]): OvertimeTariffBand | undefined {
    return tariffs.find((t) => t.durationMinutes === durationMinutes);
  }
}
