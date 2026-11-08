import { z } from 'zod';
import { MAP_WIDTH, MAP_HEIGHT } from './map-limits';

/** Shared editing/backup coordinates; versioned generators keep their own bounds. */
export const mapX = z
  .number()
  .int()
  .min(0)
  .max(MAP_WIDTH - 1);
export const mapY = z
  .number()
  .int()
  .min(0)
  .max(MAP_HEIGHT - 1);
export const mapPoint = z.tuple([mapX, mapY]);

export const mapCellKey = z
  .string()
  .regex(/^\d{1,2},\d{1,2}$/)
  .refine((key) => {
    const [x, y] = key.split(',').map(Number);
    return x < MAP_WIDTH && y < MAP_HEIGHT;
  });

export const mapEdgeKey = z
  .string()
  .regex(/^[hv]:\d{1,2}:\d{1,2}$/)
  .refine((key) => {
    const [axis, x, y] = key.split(':');
    return (
      +x < (axis === 'h' ? MAP_WIDTH : MAP_WIDTH + 1) &&
      +y < (axis === 'h' ? MAP_HEIGHT + 1 : MAP_HEIGHT)
    );
  });
