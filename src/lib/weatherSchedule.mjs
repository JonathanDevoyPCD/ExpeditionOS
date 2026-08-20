const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addIsoDays(value, amount) {
  const date = validDate(value);
  if (!date || !Number.isInteger(amount)) return undefined;
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function tripEndDate(startsOn, days) {
  if (!Number.isInteger(days) || days < 1) return undefined;
  return addIsoDays(startsOn, days - 1);
}

export function tripDaysBetween(startsOn, endsOn) {
  const start = validDate(startsOn);
  const end = validDate(endsOn);
  if (!start || !end || end < start) return undefined;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function forecastHoursToCover(endsOn, now = new Date()) {
  const end = validDate(endsOn);
  if (!end || Number.isNaN(now.getTime())) return 48;
  end.setUTCHours(23, 59, 59, 999);
  const hours = Math.ceil((end.getTime() - now.getTime()) / 3_600_000) + 1;
  return Math.max(24, Math.min(240, hours));
}

export function localForecastDate(startsAt, timeZone) {
  if (typeof startsAt !== "string") return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt)) return startsAt.slice(0, 10);
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return startsAt.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timeZone || "UTC",
  }).formatToParts(date);
  const part = (type) => parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
