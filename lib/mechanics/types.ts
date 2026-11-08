export type ActorRef = { type: 'member' | 'monster'; id: string };
export type MechanicsRoll = {
  kind: 'ability' | 'attack' | 'defense';
  actor: ActorRef;
  target?: ActorRef;
  dice: number[];
  base: number;
  modifier: number;
  total: number;
  damageBonus?: number;
  attackId?: string;
  defenseId?: string;
  proposedDamage?: number;
  applied?: boolean;
  cancelled?: boolean;
};
