// Solar Bay — config.js
// Every tunable number for the city, the player, the traffic, the police
// and the missions lives here, so balancing never means hunting through
// the simulation code.

export const WORLD = {
  width: 3200,
  height: 3200,
  roadSpacing: 400,
  roadWidth: 96,
  sidewalk: 26,
};

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 265,
  radius: 13,
  maxHealth: 100,
  maxAmmo: 48,
  pistolDamage: 34,
  fireCooldown: 0.22,
  reloadTime: 1.1,
};

export const CAR = {
  accel: 420,
  brake: 620,
  reverseAccel: 220,
  maxSpeed: 430,
  maxReverse: 140,
  turnRate: 2.6,
  drag: 0.55,
  length: 46,
  width: 22,
};

export const TRAFFIC = {
  count: 26,
  cruiseSpeed: 130,
  minGap: 70,
};

export const PEDS = {
  count: 46,
  walkSpeed: 52,
  fleeSpeed: 130,
};

export const POLICE = {
  maxCars: 6,
  maxFoot: 8,
  carSpeed: 470,
  footSpeed: 200,
  ramDamage: 8,
  arrestRange: 26,
};

export const WANTED = {
  decaySeconds: 26,
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
  max: 5,
};

// Palette: a sun-soaked coastal city at golden hour — warm asphalt,
// pastel buildings, turquoise bay water, deep green parks.
export const PALETTE = {
  grass: '#7fae5a',
  park: '#5f9e4d',
  sand: '#e8d29a',
  water: '#2f9db4',
  waterDeep: '#1f7f9e',
  road: '#3d3a38',
  roadLine: '#e8d44f',
  sidewalk: '#b9b3a4',
  buildingRoof: '#c98a5e',
  buildingWall: '#e8b48a',
  plaza: '#cbb98f',
  player: '#ffd23f',
  playerCar: '#e63946',
  policeCar: '#2b6cb0',
  policeLightRed: '#ff2e2e',
  policeLightBlue: '#2e7dff',
  hud: '#101820',
};

export const DISTRICTS = [
  { name: 'Old Pier', x0: 0, y0: 0, x1: 800, y1: 800 },
  { name: 'Marina Row', x0: 800, y0: 0, x1: 1600, y1: 800 },
  { name: 'Downtown', x0: 1600, y0: 0, x1: 2400, y1: 800 },
  { name: 'Northgate', x0: 2400, y0: 0, x1: 3200, y1: 800 },
  { name: 'Canal District', x0: 0, y0: 800, x1: 800, y1: 1600 },
  { name: 'Palm Court', x0: 800, y0: 800, x1: 1600, y1: 1600 },
  { name: 'Midtown', x0: 1600, y0: 800, x1: 2400, y1: 1600 },
  { name: 'Eastside', x0: 2400, y0: 800, x1: 3200, y1: 1600 },
  { name: 'Sunset Yards', x0: 0, y0: 1600, x1: 800, y1: 2400 },
  { name: 'Bayview', x0: 800, y0: 1600, x1: 1600, y1: 2400 },
  { name: 'Harbor Lights', x0: 1600, y0: 1600, x1: 2400, y1: 2400 },
  { name: 'The Docks', x0: 2400, y0: 1600, x1: 3200, y1: 2400 },
  { name: 'South Beach', x0: 0, y0: 2400, x1: 800, y1: 3200 },
  { name: 'Coral Row', x0: 800, y0: 2400, x1: 1600, y1: 3200 },
  { name: 'Little Havana', x0: 1600, y0: 2400, x1: 2400, y1: 3200 },
  { name: 'Solar Bay', x0: 2400, y0: 2400, x1: 3200, y1: 3200 },
];

export const CAR_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a',
  '#8d99ae', '#ef476f', '#06d6a0', '#118ab2', '#ffd166',
  '#7b2cbf', '#c0c0c0', '#ff7b00', '#3a86ff',
];

export const PED_COLORS = [
  '#f1fa8c', '#ff9f1c', '#e07a5f', '#81b29a', '#f2cc8f',
  '#6d6875', '#b5838d', '#90be6d', '#4cc9f0', '#f72585',
];
