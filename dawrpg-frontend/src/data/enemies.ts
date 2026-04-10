import { type Character } from "../types/game";

export const enemies: Character[] = [
  {
    id: 101,
    name: "Virus",
    hp: 70,
    attack: 12,
    defense: 5,
    speed: 3,
    abilities: [
      {
        name: "Infectar",
        type: "damage",
        power: 10,
        target: "enemy",
        effect: {
          type: "infected",
          value: 4,
          duration: 3,
        },
      },
    ],
  },
  {
    id: 102,
    name: "Troyano",
    hp: 90,
    attack: 15,
    defense: 8,
    speed: 2,
    abilities: [
      {
        name: "Backdoor",
        type: "damage",
        power: 12,
        target: "enemy",
      },
    ],
  },
  {
    id: 103,
    name: "Ransomware",
    hp: 120,
    attack: 18,
    defense: 10,
    speed: 1,
    abilities: [
      {
        name: "Secuestrar sistema",
        type: "damage",
        power: 14,
        target: "enemy",
        effect: {
          type: "stunned",
          value: 0,
          duration: 1,
        },
      },
    ],
  },
];