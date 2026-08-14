export type StravaStreamInsight = {
  sampleCount: number;
  heartRateSampleCount: number;
  powerSampleCount: number;
  heartRateDriftPct: number | null;
  powerFadePct: number | null;
  aerobicDecouplingPct: number | null;
};

export function analyzeActivityStreams(value: unknown): StravaStreamInsight;
