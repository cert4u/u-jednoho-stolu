import type { Dungeon, Point } from '../dungeon';
import type { LightingSettings } from '../lighting';

export type Location = { levelId: string; x: number; y: number };

export type Level = {
  id: string;
  name: string;
  map: Dungeon;
  history: Dungeon[];
  memory: Dungeon;
  visible: string[];
};

export type Stair = { id: string; a: Location; b: Location };

export type BattlePositioning = {
  id: string;
  levelId: string;
  origin: Point;
  revision: number;
};

export type Atlas = {
  lighting?: LightingSettings;
  battle?: BattlePositioning;
  levels: Level[];
  leaderId: string;
  order: string[];
  radius: number;
  location?: Location;
  stairs: Stair[];
  operations: string[];
};

export type ExplorationView = {
  lighting?: LightingSettings & { activeLights: number };
  battle?: BattlePositioning;
  enabled: boolean;
  entrance?: Point;
  leaderId: string;
  order: string[];
  radius: number;
  location?: Location;
  levelId: string;
  levelName: string;
  levels: { id: string; name: string }[];
  visible: string[];
  playerMap: Dungeon;
  stairs: {
    id: string;
    x: number;
    y: number;
    destination?: Location;
    destinationName?: string;
  }[];
};
