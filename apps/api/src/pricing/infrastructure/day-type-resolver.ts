import type { DayType } from '../infrastructure/drizzle/schema/tariffs.schema';

export class DayTypeResolver {
  resolve(date: Date, orgTimezone = 'Europe/Kyiv'): DayType {
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: orgTimezone,
      weekday: 'short',
    });
    const weekday = weekdayFormatter.format(date);
    if (weekday === 'Sat' || weekday === 'Sun') {
      return 'WEEKEND';
    }
    return 'WEEKDAY';
  }
}
