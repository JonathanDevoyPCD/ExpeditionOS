export function addIsoDays(value: string | undefined, amount: number): string | undefined;
export function tripEndDate(startsOn: string | undefined, days: number): string | undefined;
export function tripDaysBetween(startsOn: string | undefined, endsOn: string | undefined): number | undefined;
export function forecastHoursToCover(endsOn: string | undefined, now?: Date): number;
export function localForecastDate(startsAt: string, timeZone: string): string;
