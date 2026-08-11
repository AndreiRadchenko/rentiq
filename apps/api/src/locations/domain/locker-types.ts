export const lockerStatus = [
  'AVAILABLE',
  'RESERVED',
  'AWAITING_PAYMENT',
  'AWAITING_PICKUP',
  'RENTED',
  'MAINTENANCE',
] as const;
export type LockerStatus = (typeof lockerStatus)[number];
