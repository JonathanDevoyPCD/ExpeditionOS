export type WeatherSampleKind = "start" | "high_point" | "overnight" | "finish";

export type WeatherSampleRequest = {
  id: string;
  label: string;
  kind: WeatherSampleKind;
  lat: number;
  lon: number;
  distanceKm: number;
  routeBearingDegrees: number;
};

export type WeatherCondition = {
  description: string;
  type: string;
};

export type WeatherWind = {
  directionDegrees: number;
  cardinal: string;
  speedKph: number;
  gustKph: number;
  headwindKph: number;
  crosswindKph: number;
};

export type RouteWeatherCurrent = {
  observedAt: string;
  isDaytime: boolean;
  condition: WeatherCondition;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  uvIndex: number;
  precipitationProbabilityPct: number;
  thunderstormProbabilityPct: number;
  precipitationMm: number;
  visibilityKm: number;
  cloudCoverPct: number;
  wind: WeatherWind;
};

export type RouteWeatherHour = RouteWeatherCurrent & {
  startsAt: string;
};

export type RouteWeatherDay = {
  date: string;
  condition: WeatherCondition;
  minimumTemperatureC: number;
  maximumTemperatureC: number;
  precipitationProbabilityPct: number;
  precipitationMm: number;
  thunderstormProbabilityPct: number;
  windSpeedKph: number;
  windGustKph: number;
  sunriseAt?: string;
  sunsetAt?: string;
};

export type RouteWeatherLocation = {
  sample: WeatherSampleRequest;
  timeZone: string;
  current: RouteWeatherCurrent;
  hourly: RouteWeatherHour[];
};

export type RouteWeatherResponse = {
  provider: "google_weather" | "open_meteo";
  retrievedAt: string;
  fallbackReason?: string;
  locations: RouteWeatherLocation[];
  daily: RouteWeatherDay[];
};

export type WeatherRisk = {
  id: string;
  severity: "watch" | "high";
  title: string;
  detail: string;
  startsAt: string;
};
