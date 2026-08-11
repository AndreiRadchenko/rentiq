export const dayTypeValues = ['WEEKDAY', 'WEEKEND'] as const;
export type DayType = (typeof dayTypeValues)[number];
