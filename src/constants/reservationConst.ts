export const TABLE_SIZE = 96;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.1;
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;
export const STORAGE_KEY = "neutro-reserve.canvas-state";
export const STORAGE_VERSION = 1;


export const TIME_SLOTS = [
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

export const TABLE_BOUNDS = {
  left: 0,
  top: 0,
  right: WORLD_WIDTH - TABLE_SIZE,
  bottom: WORLD_HEIGHT - TABLE_SIZE,
};
