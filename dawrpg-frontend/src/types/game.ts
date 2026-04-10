export type AbilityType = "damage" | "heal" | "buff" | "debuff";
export type StatusEffectType = "infected" | "stunned" | "shield";

export interface StatusEffect {
  type: StatusEffectType;
  value: number;
  duration: number;
}

export interface Ability {
  name: string;
  type: AbilityType;
  power: number;
  target: "enemy" | "ally";
  effect?: StatusEffect;
}

export interface Character {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  abilities: Ability[];
}

export interface BattleUnit extends Character {
  currentHp: number;
  isAlive: boolean;
  team: "player" | "enemy";
  statusEffects: StatusEffect[];
}

export interface Stage {
  id: number;
  name: string;
  enemies: number[];
}