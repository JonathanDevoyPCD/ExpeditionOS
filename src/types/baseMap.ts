export const BASE_MAP_LAYERS = ["default", "topographic", "terrain", "satellite", "global"] as const;
export type BaseMapLayer = (typeof BASE_MAP_LAYERS)[number];

export type MapLayerAvailability = {
  googleTiles: boolean;
  reason?: string;
};
