export const Currency = {
  UAH: 'UAH',
  EUR: 'EUR',
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];
