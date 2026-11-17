// Solar Bay — entities.js
// The living city: traffic cars that follow the road grid, pedestrians
// who stroll the sidewalks and flee from gunfire, and the Solar Bay
// police — patrol cars that chase the player and foot officers who try
// to make the arrest. All movement is deterministic given the seed.

import { WORLD, CAR, TRAFFIC, PEDS, POLICE, CAR_COLORS, PED_COLORS } from './config.js';
import { mulberry32, randInt, pick } from './random.js';
import { ROAD_LINES, isOnRoad, nearestRoadPoint, resolveBuildingCollision } from './city.js';

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color,
    kind: kind || 'traffic',
    length: CAR.length, width: CAR.width,
    targetSpeed: 0,
    // Traffic state: which road line it follows and which way.
    roadAxis: 'x',
    roadLine: 0,
    direction: 1,
    stuck: 0,
  };
}

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    color: pick(rng, PED_COLORS),
    speed: PEDS.walkSpeed * (0.8 + rng() * 0.5),
    state: 'walk',
    stateTime: 0,
    targetX: x,
    targetY: y,
  };
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const line = pick(rng, ROAD_LINES);
    const along = 100 + rng() * (WORLD.width - 200);
    const horizontal = rng() < 0.5;
    const car = makeCar(
      horizontal ? along : line,
      horizontal ? line : along,
      horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      pick(rng, CAR_COLORS),
      'traffic',
    );
    car.roadAxis = horizontal ? 'x' : 'y';
    car.roadLine = line;
    car.direction = Math.cos(car.angle) > 0 || Math.sin(car.angle) > 0 ? 1 : -1;
    if (car.roadAxis === 'x') car.direction = Math.cos(car.angle) > 0 ? 1 : -1;
    else car.direction = Math.sin(car.angle) > 0 ? 1 : -1;
    car.targetSpeed = TRAFFIC.cruiseSpeed * (0.85 + rng() * 0.3);
    cars.push(car);
  }
  return cars;
}

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const line = pick(rng, ROAD_LINES);
    const along = 100 + rng() * (WORLD.width - 200);
    const offset = (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 + 12);
    const horizontal = rng() < 0.5;
    peds.push(makePed(
      horizontal ? along : line + offset,
      horizontal ? line + offset : along,
      rng,
    ));
  }
  return peds;
}

/** Steer a traffic car along its road; it turns at intersections. */
export function stepTrafficCar(car, dt, rng, allCars) {
  const ahead = 46;
  const frontX = car.x + Math.cos(car.angle) * ahead;
  const frontY = car.y + Math.sin(car.angle) * ahead;
  let blocked = false;
  for (const other of allCars) {
    if (other === car) continue;
    const dx = other.x - frontX;
    const dy = other.y - frontY;
    if (dx * dx + dy * dy < TRAFFIC.minGap * TRAFFIC.minGap) { blocked = true; break; }
  }
  const speedTarget = blocked ? 0 : car.targetSpeed;
  car.speed += (speedTarget - car.speed) * Math.min(1, dt * 1.6);
  if (car.speed < 1) car.speed = 0;

  // At an intersection, sometimes turn onto the crossing road.
  const near = nearestRoadPoint(car.x, car.y);
  const onCross = Math.abs(car.x - near.x) < 14 && Math.abs(car.y - near.y) < 14;
  if (onCross && rng() < dt * 0.25) {
    const horizontal = car.roadAxis === 'x';
    car.roadAxis = horizontal ? 'y' : 'x';
    car.roadLine = horizontal ? near.y : near.x;
    const turnLeft = rng() < 0.5;
    if (car.roadAxis === 'x') {
      car.angle = turnLeft ? Math.PI : 0;
      car.direction = turnLeft ? -1 : 1;
    } else {
      car.angle = turnLeft ? -Math.PI / 2 : Math.PI / 2;
      car.direction = turnLeft ? -1 : 1;
    }
  }
  // Stay glued to the lane: ease back toward the road line.
  if (car.roadAxis === 'x') {
    car.y += (car.roadLine - car.y) * Math.min(1, dt * 2.5);
  } else {
    car.x += (car.roadLine - car.x) * Math.min(1, dt * 2.5);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (car.x < 60 || car.x > WORLD.width - 60 || car.y < 60 || car.y > WORLD.height - 60) {
    car.angle += Math.PI;
    car.x = Math.max(60, Math.min(WORLD.width - 60, car.x));
    car.y = Math.max(60, Math.min(WORLD.height - 60, car.y));
  }
}

/** Pedestrians stroll, pause, and run away from nearby danger. */
export function stepPed(ped, dt, rng, dangerX, dangerY, dangerActive) {
  ped.stateTime -= dt;
  const dx = ped.x - dangerX;
  const dy = ped.y - dangerY;
  const dangerNear = dangerActive && dx * dx + dy * dy < 260 * 260;
  if (dangerNear && ped.state !== 'flee') {
    ped.state = 'flee';
    ped.stateTime = 1.5 + rng() * 1.5;
    ped.angle = Math.atan2(dy, dx);
  }
  if (ped.state === 'flee') {
    ped.x += Math.cos(ped.angle) * PEDS.fleeSpeed * dt;
    ped.y += Math.sin(ped.angle) * PEDS.fleeSpeed * dt;
    if (ped.stateTime <= 0) ped.state = 'walk';
  } else {
    if (ped.stateTime <= 0) {
      ped.stateTime = 2 + rng() * 4;
      ped.angle = rng() * Math.PI * 2;
      // Prefer walking along a road: snap the heading to the grid.
      const quarter = Math.round(ped.angle / (Math.PI / 2)) * (Math.PI / 2);
      ped.angle = quarter + (rng() - 0.5) * 0.2;
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
  if (!isOnRoad(ped.x, ped.y)) {
    // Drift back toward the nearest road instead of walking through blocks.
    const near = nearestRoadPoint(ped.x, ped.y);
    ped.angle = Math.atan2(near.y - ped.y, near.x - ped.x);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
  ped.x = Math.max(30, Math.min(WORLD.width - 30, ped.x));
  ped.y = Math.max(30, Math.min(WORLD.height - 30, ped.y));
}

/** A police car chases the player with simple pursuit steering. */
export function stepPoliceCar(car, dt, playerX, playerY) {
  const dx = playerX - car.x;
  const dy = playerY - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wanted = Math.atan2(dy, dx);
  let diff = wanted - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
  const target = dist > 120 ? POLICE.carSpeed : POLICE.carSpeed * 0.55;
  car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.height - 40, car.y));
}

/** A foot officer runs at the player and tries to make the arrest. */
export function stepPoliceFoot(cop, dt, playerX, playerY) {
  const dx = playerX - cop.x;
  const dy = playerY - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  cop.x += (dx / dist) * POLICE.footSpeed * dt;
  cop.y += (dy / dist) * POLICE.footSpeed * dt;
  cop.angle = Math.atan2(dy, dx);
  return dist;
}

export function circleHitsCar(car, x, y, radius) {
  const dx = x - car.x;
  const dy = y - car.y;
  const cos = Math.cos(-car.angle);
  const sin = Math.sin(-car.angle);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return Math.abs(localX) < car.length / 2 + radius && Math.abs(localY) < car.width / 2 + radius;
}
