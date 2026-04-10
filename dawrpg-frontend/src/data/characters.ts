import { type Character } from "../types/game";

export const characters: Character[] = [
  {
    id: 1,
    name: "Cursor",
    hp: 80,
    attack: 15,
    defense: 5,
    speed: 5,
    abilities: [
      {
        name: "Click rápido",
        type: "damage",
        power: 20,
        target: "enemy",
      },
      {
        name: "SQL Injection",
        type: "damage",
        power: 15,
        target: "enemy",
        effect: { type: "infected", value: 5, duration: 3 },
      },
    ],
  },
  {
    id: 2,
    name: "Windows Defender",
    hp: 140,
    attack: 10,
    defense: 20,
    speed: 2,
    abilities: [
      {
        name: "Scan",
        type: "damage",
        power: 15,
        target: "enemy",
      },
      {
        name: "Firewall",
        type: "heal",
        power: 25,
        target: "ally",
        effect: { type: "shield", value: 5, duration: 3 },
      },
    ],
  },
  {
    id: 3,
    name: "Firewall",
    hp: 120,
    attack: 12,
    defense: 18,
    speed: 2,
    abilities: [
      {
        name: "Bloqueo",
        type: "buff",
        power: 0,
        target: "ally",
        effect: { type: "shield", value: 8, duration: 3 },
      },
      {
        name: "DDoS",
        type: "damage",
        power: 10,
        target: "enemy",
        effect: { type: "stunned", value: 0, duration: 1 },
      },
    ],
  },
];