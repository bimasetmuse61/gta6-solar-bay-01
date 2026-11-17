// Solar Bay — missions.js
// The story: Maya "Rook" Alvarez, a courier fresh out of luck, takes jobs
// from Rosa at the garage to pay off a debt to the Harbor Crew. Five
// missions, each with an objective, a target on the map and a cash reward.
// The mission system only describes goals — world.js decides when they
// are done — so the story stays data, not tangled logic.

export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    giver: 'Rosa',
    brief: 'Rosa needs a driver, and drivers need wheels. Borrow any car on the street — press E beside one — then bring it to Rosa\u2019s Garage.',
    objective: 'Steal a car and drive it to Rosa\u2019s Garage',
    reward: 150,
    target: 'hideout',
    type: 'deliverCar',
  },
  {
    id: 2,
    title: 'Courier Run',
    giver: 'Rosa',
    brief: 'Two packages, two drops, one very impatient clock. Pick up the parcel at the Courier Depot, then hit South Beach Kiosk and the Docks Gate before the timer runs out.',
    objective: 'Pick up the parcel, then deliver to both drop points',
    reward: 300,
    target: 'depot',
    type: 'courier',
    timeLimit: 150,
  },
  {
    id: 3,
    title: 'Heat',
    giver: 'Rosa',
    brief: 'The Harbor Crew tipped off the police. You are hot — three stars and climbing. Lose the heat: get your wanted level back to zero, or lay low at the hideout until it cools.',
    objective: 'Lose your wanted level (or reach the hideout)',
    reward: 250,
    target: 'hideout',
    type: 'loseHeat',
  },
  {
    id: 4,
    title: 'The Shakedown',
    giver: 'Rosa',
    brief: 'Four Harbor Crew enforcers are shaking down the warehouse. Take them down — aim with the mouse, click to shoot — and the docks are yours again.',
    objective: 'Defeat the 4 enforcers at the Harbor Warehouse',
    reward: 500,
    target: 'warehouse',
    type: 'combat',
  },
  {
    id: 5,
    title: 'Bay Heist',
    giver: 'Rosa',
    brief: 'The gold Comet at the Marina belongs to the Crew\u2019s boss. Take it, and bring it home to Rosa\u2019s Garage. The whole city will be watching — expect a chase.',
    objective: 'Steal the gold Comet and bring it to Rosa\u2019s Garage',
    reward: 1200,
    target: 'marina',
    type: 'heist',
  },
];

export const STORY_INTRO = [
  'SOLAR BAY — a sun-soaked city on the coast, where the palm trees',
  'are tall, the cars are fast, and everybody owes somebody.',
  '',
  'Maya "Rook" Alvarez came here with a courier bag and a debt.',
  'Rosa, who runs the garage on Canal Street, has work for a driver',
  'with nerve. Five jobs. Pay the debt. Own the city.',
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

export function missionCount() {
  return MISSIONS.length;
}
