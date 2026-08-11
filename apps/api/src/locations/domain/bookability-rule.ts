export interface BookabilityStationView {
  isActive: boolean;
  isVisibleToClients: boolean;
  workingStatus: string;
}

export interface BookabilityLockerView {
  inventoryKitId: string | null;
  status: string;
  currentRentalId: string | null;
}

export interface BookabilityInput {
  station: BookabilityStationView;
  locker: BookabilityLockerView;
  tariffsForToday: unknown[];
}

export class BookabilityRule {
  static evaluate(input: BookabilityInput): boolean {
    if (!input.station.isActive) return false;
    if (!input.station.isVisibleToClients) return false;
    if (input.station.workingStatus !== 'WORKING') return false;
    if (input.locker.inventoryKitId == null) return false;
    if (!input.tariffsForToday || input.tariffsForToday.length === 0) return false;
    if (input.locker.status !== 'AVAILABLE') return false;
    if (input.locker.currentRentalId !== null) return false;
    return true;
  }
}
