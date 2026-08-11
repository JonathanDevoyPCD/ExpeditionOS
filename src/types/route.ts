export type RoutePoint = {
  lat: number;
  lon: number;
  elevationM: number;
  distanceKm: number;
};

export type RouteMetrics = {
  distanceKm: number;
  ascentM: number;
  descentM: number;
  minElevationM: number;
  maxElevationM: number;
  maxGradePct: number;
  estimatedMovingMinutes: number;
};

export type RouteDataset = {
  id: string;
  name: string;
  source: string;
  points: RoutePoint[];
  elevationProfile: RoutePoint[];
  bounds: [[number, number], [number, number]];
  start: RoutePoint;
  finish: RoutePoint;
  metrics: RouteMetrics;
};
