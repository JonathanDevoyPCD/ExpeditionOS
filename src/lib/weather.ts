import "server-only";

import type {
  RouteWeatherCurrent,
  RouteWeatherDay,
  RouteWeatherHour,
  RouteWeatherLocation,
  RouteWeatherResponse,
  WeatherCondition,
  WeatherSampleRequest,
  WeatherWind,
} from "@/types/weather";

type GoogleMeasure = { value?: number; degrees?: number; quantity?: number; distance?: number };
type GoogleCondition = { description?: { text?: string }; type?: string };
type GoogleWind = {
  direction?: { degrees?: number; cardinal?: string };
  speed?: GoogleMeasure;
  gust?: GoogleMeasure;
};
type GooglePeriod = {
  weatherCondition?: GoogleCondition;
  precipitation?: { probability?: { percent?: number }; qpf?: GoogleMeasure };
  thunderstormProbability?: number;
  wind?: GoogleWind;
};
type GoogleCurrent = GooglePeriod & {
  currentTime?: string;
  isDaytime?: boolean;
  temperature?: GoogleMeasure;
  feelsLikeTemperature?: GoogleMeasure;
  relativeHumidity?: number;
  uvIndex?: number;
  visibility?: GoogleMeasure;
  cloudCover?: number;
};
type GoogleHour = GoogleCurrent & { interval?: { startTime?: string } };
type GoogleHourlyResponse = { forecastHours?: GoogleHour[]; timeZone?: { id?: string } };
type GoogleDaily = {
  displayDate?: { year?: number; month?: number; day?: number };
  daytimeForecast?: GooglePeriod;
  maxTemperature?: GoogleMeasure;
  minTemperature?: GoogleMeasure;
  sunEvents?: { sunriseTime?: string; sunsetTime?: string };
};
type GoogleDailyResponse = { forecastDays?: GoogleDaily[] };

type OpenMeteoResponse = {
  timezone?: string;
  current?: Record<string, number | string>;
  hourly?: Record<string, Array<number | string | null>>;
  daily?: Record<string, Array<number | string | null>>;
};

const WEATHER_BASE_URL = "https://weather.googleapis.com/v1";
const CACHE_TTL_MS = 20 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; value: RouteWeatherResponse }>();

function googleApiKey() {
  return process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function condition(value?: GoogleCondition): WeatherCondition {
  return {
    description: value?.description?.text?.trim() || "Conditions unavailable",
    type: value?.type ?? "UNSPECIFIED",
  };
}

function relativeWind(wind: GoogleWind | undefined, routeBearingDegrees: number): WeatherWind {
  const directionDegrees = number(wind?.direction?.degrees);
  const speedKph = number(wind?.speed?.value);
  const differenceRadians = ((directionDegrees - routeBearingDegrees) * Math.PI) / 180;
  return {
    directionDegrees,
    cardinal: wind?.direction?.cardinal ?? "VARIABLE",
    speedKph,
    gustKph: number(wind?.gust?.value),
    headwindKph: Number((speedKph * Math.cos(differenceRadians)).toFixed(1)),
    crosswindKph: Number(Math.abs(speedKph * Math.sin(differenceRadians)).toFixed(1)),
  };
}

function normalizeCurrent(value: GoogleCurrent, bearing: number): RouteWeatherCurrent {
  return {
    observedAt: value.currentTime ?? new Date().toISOString(),
    isDaytime: value.isDaytime ?? true,
    condition: condition(value.weatherCondition),
    temperatureC: number(value.temperature?.degrees),
    feelsLikeC: number(value.feelsLikeTemperature?.degrees),
    humidityPct: number(value.relativeHumidity),
    uvIndex: number(value.uvIndex),
    precipitationProbabilityPct: number(value.precipitation?.probability?.percent),
    thunderstormProbabilityPct: number(value.thunderstormProbability),
    precipitationMm: number(value.precipitation?.qpf?.quantity),
    visibilityKm: number(value.visibility?.distance),
    cloudCoverPct: number(value.cloudCover),
    wind: relativeWind(value.wind, bearing),
  };
}

function normalizeHour(value: GoogleHour, bearing: number): RouteWeatherHour {
  const current = normalizeCurrent(value, bearing);
  const startsAt = value.interval?.startTime ?? current.observedAt;
  return { ...current, observedAt: startsAt, startsAt };
}

function normalizeDay(value: GoogleDaily): RouteWeatherDay {
  const date = value.displayDate;
  const isoDate = date?.year && date.month && date.day
    ? `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`
    : "";
  const daytime = value.daytimeForecast;
  return {
    date: isoDate,
    condition: condition(daytime?.weatherCondition),
    minimumTemperatureC: number(value.minTemperature?.degrees),
    maximumTemperatureC: number(value.maxTemperature?.degrees),
    precipitationProbabilityPct: number(daytime?.precipitation?.probability?.percent),
    precipitationMm: number(daytime?.precipitation?.qpf?.quantity),
    thunderstormProbabilityPct: number(daytime?.thunderstormProbability),
    windSpeedKph: number(daytime?.wind?.speed?.value),
    windGustKph: number(daytime?.wind?.gust?.value),
    sunriseAt: value.sunEvents?.sunriseTime,
    sunsetAt: value.sunEvents?.sunsetTime,
  };
}

async function googleWeather<T>(path: string, sample: WeatherSampleRequest, parameters: Record<string, string> = {}) {
  const key = googleApiKey();
  if (!key) throw new Error("Google Weather is not configured.");
  const query = new URLSearchParams({
    key,
    "location.latitude": String(sample.lat),
    "location.longitude": String(sample.lon),
    unitsSystem: "METRIC",
    ...parameters,
  });
  const response = await fetch(`${WEATHER_BASE_URL}/${path}?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(details?.error?.message ?? `Google Weather returned ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

function cacheKey(samples: WeatherSampleRequest[]) {
  return samples.map((sample) => `${sample.id}:${sample.lat.toFixed(3)}:${sample.lon.toFixed(3)}:${Math.round(sample.routeBearingDegrees)}`).join("|");
}

export function hasGoogleWeather() {
  return Boolean(googleApiKey());
}

export async function getRouteWeather(samples: WeatherSampleRequest[]): Promise<RouteWeatherResponse> {
  const key = cacheKey(samples);
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (!hasGoogleWeather()) {
    const fallback = await getOpenMeteoRouteWeather(samples, "Google Weather is not configured; Open-Meteo fallback active.");
    responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: fallback });
    return fallback;
  }

  try {
    const value = await getGoogleRouteWeather(samples);
    responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    console.warn("Google Weather unavailable; using Open-Meteo fallback", error instanceof Error ? error.message : "Unknown error");
    const fallback = await getOpenMeteoRouteWeather(samples, "Google Weather is unavailable; Open-Meteo fallback active.");
    responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: fallback });
    return fallback;
  }
}

async function getGoogleRouteWeather(samples: WeatherSampleRequest[]): Promise<RouteWeatherResponse> {
  const locations = await Promise.all(samples.map(async (sample): Promise<RouteWeatherLocation> => {
    const [current, hourly] = await Promise.all([
      googleWeather<GoogleCurrent>("currentConditions:lookup", sample),
      googleWeather<GoogleHourlyResponse>("forecast/hours:lookup", sample, { hours: "24", pageSize: "24" }),
    ]);
    return {
      sample,
      timeZone: hourly.timeZone?.id ?? "UTC",
      current: normalizeCurrent(current, sample.routeBearingDegrees),
      hourly: (hourly.forecastHours ?? []).map((hour) => normalizeHour(hour, sample.routeBearingDegrees)),
    };
  }));

  const dailyResponse = await googleWeather<GoogleDailyResponse>("forecast/days:lookup", samples[0], { days: "10", pageSize: "10" });
  const value: RouteWeatherResponse = {
    provider: "google_weather",
    retrievedAt: new Date().toISOString(),
    locations,
    daily: (dailyResponse.forecastDays ?? []).map(normalizeDay).filter((day) => day.date),
  };
  return value;
}

const OPEN_HOURLY = [
  "temperature_2m", "apparent_temperature", "relative_humidity_2m", "precipitation_probability", "precipitation",
  "weather_code", "cloud_cover", "visibility", "uv_index", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
].join(",");
const OPEN_DAILY = [
  "weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "precipitation_probability_max",
  "wind_speed_10m_max", "wind_gusts_10m_max", "sunrise", "sunset",
].join(",");

async function openMeteo(sample: WeatherSampleRequest, includeDaily: boolean) {
  const query = new URLSearchParams({
    latitude: String(sample.lat),
    longitude: String(sample.lon),
    timezone: "auto",
    forecast_hours: "24",
    forecast_days: "10",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: OPEN_HOURLY,
    ...(includeDaily ? { daily: OPEN_DAILY } : {}),
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}.`);
  return response.json() as Promise<OpenMeteoResponse>;
}

function openValue(values: OpenMeteoResponse["hourly"] | OpenMeteoResponse["daily"], field: string, index: number) {
  return number(values?.[field]?.[index]);
}

function openText(values: OpenMeteoResponse["hourly"] | OpenMeteoResponse["daily"], field: string, index: number) {
  const value = values?.[field]?.[index];
  return typeof value === "string" ? value : "";
}

function openCondition(codeValue: unknown): WeatherCondition {
  const code = number(codeValue, -1);
  if (code === 0) return { description: "Clear sky", type: "CLEAR" };
  if ([1, 2].includes(code)) return { description: "Partly cloudy", type: "PARTLY_CLOUDY" };
  if (code === 3) return { description: "Overcast", type: "CLOUDY" };
  if ([45, 48].includes(code)) return { description: "Fog", type: "FOG" };
  if (code >= 51 && code <= 57) return { description: "Drizzle", type: "DRIZZLE" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { description: "Rain", type: "RAIN" };
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { description: "Snow", type: "SNOW" };
  if (code >= 95) return { description: "Thunderstorm", type: "THUNDERSTORM" };
  return { description: "Variable conditions", type: "UNSPECIFIED" };
}

function openCurrent(data: OpenMeteoResponse, sample: WeatherSampleRequest): RouteWeatherCurrent {
  const current = data.current ?? {};
  const code = current.weather_code;
  const direction = number(current.wind_direction_10m);
  const wind: GoogleWind = {
    direction: { degrees: direction, cardinal: cardinalDirection(direction) },
    speed: { value: number(current.wind_speed_10m) },
    gust: { value: number(current.wind_gusts_10m) },
  };
  return {
    observedAt: typeof current.time === "string" ? current.time : new Date().toISOString(),
    isDaytime: true,
    condition: openCondition(code),
    temperatureC: number(current.temperature_2m),
    feelsLikeC: number(current.apparent_temperature),
    humidityPct: number(current.relative_humidity_2m),
    uvIndex: 0,
    precipitationProbabilityPct: 0,
    thunderstormProbabilityPct: number(code) >= 95 ? 100 : 0,
    precipitationMm: number(current.precipitation),
    visibilityKm: 0,
    cloudCoverPct: number(current.cloud_cover),
    wind: relativeWind(wind, sample.routeBearingDegrees),
  };
}

function openHours(data: OpenMeteoResponse, sample: WeatherSampleRequest): RouteWeatherHour[] {
  const hourly = data.hourly ?? {};
  const times = hourly.time ?? [];
  return times.map((time, index) => {
    const code = openValue(hourly, "weather_code", index);
    const direction = openValue(hourly, "wind_direction_10m", index);
    const wind = relativeWind({
      direction: { degrees: direction, cardinal: cardinalDirection(direction) },
      speed: { value: openValue(hourly, "wind_speed_10m", index) },
      gust: { value: openValue(hourly, "wind_gusts_10m", index) },
    }, sample.routeBearingDegrees);
    const startsAt = typeof time === "string" ? time : new Date().toISOString();
    return {
      observedAt: startsAt,
      startsAt,
      isDaytime: true,
      condition: openCondition(code),
      temperatureC: openValue(hourly, "temperature_2m", index),
      feelsLikeC: openValue(hourly, "apparent_temperature", index),
      humidityPct: openValue(hourly, "relative_humidity_2m", index),
      uvIndex: openValue(hourly, "uv_index", index),
      precipitationProbabilityPct: openValue(hourly, "precipitation_probability", index),
      thunderstormProbabilityPct: code >= 95 ? 100 : 0,
      precipitationMm: openValue(hourly, "precipitation", index),
      visibilityKm: openValue(hourly, "visibility", index) / 1000,
      cloudCoverPct: openValue(hourly, "cloud_cover", index),
      wind,
    };
  });
}

function openDays(data: OpenMeteoResponse): RouteWeatherDay[] {
  const daily = data.daily ?? {};
  const dates = daily.time ?? [];
  return dates.flatMap((date, index) => typeof date === "string" ? [{
    date,
    condition: openCondition(openValue(daily, "weather_code", index)),
    minimumTemperatureC: openValue(daily, "temperature_2m_min", index),
    maximumTemperatureC: openValue(daily, "temperature_2m_max", index),
    precipitationProbabilityPct: openValue(daily, "precipitation_probability_max", index),
    precipitationMm: openValue(daily, "precipitation_sum", index),
    thunderstormProbabilityPct: openValue(daily, "weather_code", index) >= 95 ? 100 : 0,
    windSpeedKph: openValue(daily, "wind_speed_10m_max", index),
    windGustKph: openValue(daily, "wind_gusts_10m_max", index),
    sunriseAt: openText(daily, "sunrise", index),
    sunsetAt: openText(daily, "sunset", index),
  }] : []);
}

function cardinalDirection(degrees: number) {
  const directions = ["NORTH", "NORTHEAST", "EAST", "SOUTHEAST", "SOUTH", "SOUTHWEST", "WEST", "NORTHWEST"];
  return directions[Math.round(degrees / 45) % 8];
}

async function getOpenMeteoRouteWeather(samples: WeatherSampleRequest[], fallbackReason: string): Promise<RouteWeatherResponse> {
  const responses = await Promise.all(samples.map((sample, index) => openMeteo(sample, index === 0)));
  return {
    provider: "open_meteo",
    retrievedAt: new Date().toISOString(),
    fallbackReason,
    locations: responses.map((data, index) => ({
      sample: samples[index],
      timeZone: data.timezone ?? "UTC",
      current: openCurrent(data, samples[index]),
      hourly: openHours(data, samples[index]),
    })),
    daily: openDays(responses[0]),
  };
}
