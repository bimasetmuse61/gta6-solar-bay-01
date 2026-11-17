// Solar Bay — world.js
// The simulation: one state object, one fixed step. The player walks or
// drives, steals cars, fights, earns wanted stars, and the police answer.
// Missions advance here; rendering only reads the state, never changes it.

import { WORLD, PLAYER, CAR, TRAFFIC, PEDS, POLICE, WANTED, CAR_COLORS } from './config.js';
import { mulberry32, pick } from './random.js';
import { buildCity, hitsBuilding, resolveBuildingCollision, nearestRoadPoint } from './city.js';
import { makeCar, makePed, spawnTraffic, spawnPeds, stepTrafficCar, stepPed, stepPoliceCar, stepPoliceFoot, circleHitsCar } from './entities.js';
import { missionById, missionCount } from './missions.js';

export const STEP = 1 / 60;
export const SAVE_KEY = 'solarbay-save-v1';

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const city = buildCity(seed);
  const world = {
    seed,
    rng,
    city,
    time: 0,
    screen: 'title', // title | play | paused | dead | complete
    player: {
      x: 620, y: 1380, angle: -Math.PI / 2,
      health: PLAYER.maxHealth, cash: 0, ammo: PLAYER.maxAmmo,
      wanted: 0, wantedTimer: 0, driving: null,
      fireCooldown: 0, reloadTimer: 0, dead: false,
    },
    traffic: spawnTraffic(city, rng, TRAFFIC.count),
    peds: spawnPeds(city, rng, PEDS.count),
    policeCars: [],
    policeFoot: [],
    enforcers: [],
    bullets: [],
    particles: [],
    pickups: [],
    missionIndex: 0, // 0-based into MISSIONS; missionCount() means done
    missionState: 'idle', // idle | active | done
    missionTimer: 0,
    courierStage: 0, // 0 pickup, 1 drop A, 2 drop B
    enforcersLeft: 0,
    message: '',
    messageTimer: 0,
    stats: { carsStolen: 0, shotsFired: 0, arrests: 0, missionsDone: 0 },
    camera: { x: 620, y: 1380 },
    saveFlash: 0,
    ramCooldown: 0,
    shotMode: null,
  };
  return world;
}

export function currentMission(world) {
  if (world.missionIndex >= missionCount()) return null;
  return missionById(world.missionIndex + 1);
}

export function missionTarget(world) {
  const mission = currentMission(world);
  if (!mission) return null;
  if (mission.type === 'courier') {
    if (world.courierStage === 0) return world.city.places.depot;
    if (world.courierStage === 1) return world.city.places.dropA;
    return world.city.places.dropB;
  }
  if (mission.type === 'combat') return world.city.places.warehouse;
  if (mission.type === 'heist') {
    return world.missionState === 'active' && world.player.driving && world.player.driving.gold
      ? world.city.places.hideout
      : world.city.places.marina;
  }
  return world.city.places[mission.target];
}

export function showMessage(world, text, seconds) {
  world.message = text;
  world.messageTimer = seconds || 3.5;
}

export function addWanted(world, stars, reason) {
  const before = world.player.wanted;
  world.player.wanted = Math.min(WANTED.max, world.player.wanted + stars);
  world.player.wantedTimer = WANTED.decaySeconds;
  if (world.player.wanted > before) {
    showMessage(world, `WANTED LEVEL ${world.player.wanted} — ${reason}`, 3);
  }
}

export function startMission(world) {
  const mission = currentMission(world);
  if (!mission) return;
  world.missionState = 'active';
  world.missionTimer = mission.timeLimit || 0;
  world.courierStage = 0;
  world.enforcersLeft = 0;
  if (mission.type === 'loseHeat') {
    world.player.wanted = 3;
    world.player.wantedTimer = WANTED.decaySeconds;
    showMessage(world, 'The police are onto you! Lose the heat!', 4);
  }
  if (mission.type === 'combat') {
    const spot = world.city.places.warehouse;
    world.enforcers = [];
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      world.enforcers.push({
        x: spot.x + Math.cos(angle) * 70,
        y: spot.y + Math.sin(angle) * 70,
        health: 100, angle, fireTimer: 1 + i * 0.4, alive: true,
      });
    }
    world.enforcersLeft = 4;
  }
  if (mission.type === 'heist') {
    const spot = world.city.places.goldCar;
    const gold = makeCar(spot.x, spot.y, Math.PI / 2, '#ffd700', 'parked');
    gold.gold = true;
    gold.targetSpeed = 0;
    world.traffic.push(gold);
  }
  showMessage(world, `MISSION ${mission.id}: ${mission.title} — ${mission.objective}`, 5);
}

export function completeMission(world) {
  const mission = currentMission(world);
  if (!mission) return;
  world.player.cash += mission.reward;
  world.stats.missionsDone += 1;
  world.missionIndex += 1;
  world.missionState = 'idle';
  world.missionTimer = 0;
  showMessage(world, `MISSION COMPLETE — ${mission.title}! +$${mission.reward}`, 5);
  if (world.missionIndex >= missionCount()) {
    world.screen = 'complete';
  } else {
    showMessage(world, `MISSION COMPLETE — ${mission.title}! +$${mission.reward}  (Enter: next job)`, 5);
  }
}

function spawnParticles(world, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.rng() * Math.PI * 2;
    const vel = speed * (0.4 + world.rng() * 0.8);
    world.particles.push({ x, y, vx: Math.cos(angle) * vel, vy: Math.sin(angle) * vel, life: 0.5 + world.rng() * 0.4, color });
  }
}

function fireBullet(world, fromX, fromY, angle, friendly) {
  world.bullets.push({ x: fromX, y: fromY, vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720, life: 0.9, friendly: !!friendly });
}

function playerShoot(world, aimAngle) {
  const player = world.player;
  if (player.fireCooldown > 0 || player.reloadTimer > 0) return;
  if (player.ammo <= 0) {
    player.reloadTimer = PLAYER.reloadTime;
    showMessage(world, 'Reloading…', 1.2);
    return;
  }
  player.ammo -= 1;
  player.fireCooldown = PLAYER.fireCooldown;
  world.stats.shotsFired += 1;
  const gunX = player.x + Math.cos(aimAngle) * 18;
  const gunY = player.y + Math.sin(aimAngle) * 18;
  fireBullet(world, gunX, gunY, aimAngle, true);
  spawnParticles(world, gunX, gunY, '#ffcf4d', 4, 120);
  if (world.audio) world.audio.shoot();
  if (player.wanted === 0) addWanted(world, WANTED.shoot, 'Shots fired in public');
}

function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of world.traffic) {
    const dist = Math.hypot(car.x - x, car.y - y);
    if (dist < bestDist) { best = car; bestDist = dist; }
  }
  for (const car of world.policeCars) {
    const dist = Math.hypot(car.x - x, car.y - y);
    if (dist < bestDist) { best = car; bestDist = dist; }
  }
  return best;
}

function stepPlayerOnFoot(world, dt, input, aimAngle) {
  const player = world.player;
  let mx = 0;
  let my = 0;
  if (input.held('up')) my -= 1;
  if (input.held('down')) my += 1;
  if (input.held('left')) mx -= 1;
  if (input.held('right')) mx += 1;
  const moving = mx !== 0 || my !== 0;
  if (moving) {
    const len = Math.hypot(mx, my);
    const speed = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.angle = Math.atan2(my, mx);
  }
  const fixed = resolveBuildingCollision(world.city, player.x, player.y, PLAYER.radius);
  player.x = fixed.x;
  player.y = fixed.y;

  if (input.wasPressed('KeyE')) {
    const car = nearestCar(world, player.x, player.y, 64);
    if (car) enterCar(world, car);
  }
  if (input.mouseClicked || input.mouseDown) playerShoot(world, aimAngle);
  if (input.wasPressed('KeyR') && player.reloadTimer <= 0) {
    player.reloadTimer = PLAYER.reloadTime;
    player.ammo = PLAYER.maxAmmo;
  }
}

function enterCar(world, car) {
  const player = world.player;
  player.driving = car;
  car.kind = 'player';
  car.speed = 0;
  world.stats.carsStolen += 1;
  if (!car.gold) {
    addWanted(world, WANTED.stealCar, 'Grand theft auto');
    showMessage(world, 'Car stolen! The owner called it in.', 3);
  } else {
    addWanted(world, 2, 'You stole the gold Comet!');
    showMessage(world, 'THE GOLD COMET IS YOURS — run!', 4);
  }
  if (world.audio) world.audio.pickup();
}

function exitCar(world) {
  const player = world.player;
  const car = player.driving;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 34;
  player.y = car.y + Math.sin(side) * 34;
  const fixed = resolveBuildingCollision(world.city, player.x, player.y, PLAYER.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  player.driving = null;
  car.kind = 'traffic';
  car.targetSpeed = 0;
}

function stepPlayerDriving(world, dt, input) {
  const player = world.player;
  const car = player.driving;
  if (!car) return;
  const forward = input.held('up');
  const reverse = input.held('down');
  const left = input.held('left');
  const right = input.held('right');
  if (forward) car.speed += CAR.accel * dt;
  if (reverse) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  if (!forward && !reverse) car.speed -= car.speed * CAR.drag * dt;
  if (input.keys.has('Space')) car.speed -= car.speed * 3.2 * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 2 && !forward && !reverse) car.speed = 0;
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const direction = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 90) * direction;
  // Move one axis at a time so the car slides along a building instead of
  // wedging into its corner and bouncing there forever.
  const stepX = Math.cos(car.angle) * car.speed * dt;
  const stepY = Math.sin(car.angle) * car.speed * dt;
  const hitX = hitsBuilding(world.city, car.x + stepX, car.y, CAR.length / 2);
  const hitY = hitsBuilding(world.city, car.x, car.y + stepY, CAR.length / 2);
  if (!hitX) car.x += stepX;
  if (!hitY) car.y += stepY;
  if ((hitX || hitY) && Math.abs(car.speed) > 180) {
    if (world.audio) world.audio.crash();
    spawnParticles(world, car.x, car.y, '#ff9f1c', 6, 160);
    car.speed *= 0.55;
  }
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;

  // Running over a pedestrian is a crime, and it hurts.
  for (const ped of world.peds) {
    if (circleHitsCar(car, ped.x, ped.y, 6) && Math.abs(car.speed) > 60) {
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      const dist = Math.hypot(dx, dy) || 1;
      ped.x += (dx / dist) * 60;
      ped.y += (dy / dist) * 60;
      ped.state = 'flee';
      ped.stateTime = 2;
      addWanted(world, WANTED.hitPed, 'Hit and run!');
      spawnParticles(world, ped.x, ped.y, '#ff6b6b', 8, 140);
      car.speed *= 0.7;
    }
  }
  // Bumping traffic cars.
  for (const other of world.traffic) {
    if (other === car || other.kind === 'player') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    if (dx * dx + dy * dy < 52 * 52) {
      other.x += dx * 0.4;
      other.y += dy * 0.4;
      other.speed = car.speed * 0.4;
      if (Math.abs(car.speed) > 120) car.speed *= 0.75;
    }
  }

  if (input.wasPressed('KeyE')) exitCar(world);
}

function updateWanted(world, dt) {
  const player = world.player;
  if (player.wanted === 0) return;
  player.wantedTimer -= dt;
  if (player.wantedTimer <= 0) {
    player.wanted -= 1;
    player.wantedTimer = WANTED.decaySeconds;
    showMessage(world, `Heat cooling… wanted level ${player.wanted}`, 2.5);
  }
  // Police presence scales with the stars.
  const wantCars = Math.min(POLICE.maxCars, player.wanted + 1);
  while (world.policeCars.length < wantCars) {
    const angle = world.rng() * Math.PI * 2;
    const dist = 700 + world.rng() * 300;
    const car = makeCar(
      Math.max(60, Math.min(WORLD.width - 60, player.x + Math.cos(angle) * dist)),
      Math.max(60, Math.min(WORLD.height - 60, player.y + Math.sin(angle) * dist)),
      0, '#2b6cb0', 'police',
    );
    world.policeCars.push(car);
  }
  const wantFoot = Math.min(POLICE.maxFoot, player.wanted * 2);
  while (world.policeFoot.length < wantFoot) {
    const angle = world.rng() * Math.PI * 2;
    const dist = 260 + world.rng() * 160;
    world.policeFoot.push({
      x: player.x + Math.cos(angle) * dist,
      y: player.y + Math.sin(angle) * dist,
      angle: 0, health: 50,
    });
  }
  if (player.wanted === 0) {
    world.policeCars = [];
    world.policeFoot = [];
  }
}

function stepBullets(world, dt) {
  for (const bullet of world.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }
  world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.width && b.y > 0 && b.y < WORLD.height);
  for (const bullet of world.bullets) {
    if (bullet.life <= 0) continue;
    if (bullet.friendly) {
      for (const ped of world.peds) {
        if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 12) {
          bullet.life = 0;
          ped.state = 'flee';
          ped.stateTime = 3;
          spawnParticles(world, ped.x, ped.y, '#ff6b6b', 6, 120);
        }
      }
      for (const cop of world.policeFoot) {
        if (Math.hypot(cop.x - bullet.x, cop.y - bullet.y) < 13) {
          bullet.life = 0;
          cop.health -= PLAYER.pistolDamage;
          spawnParticles(world, cop.x, cop.y, '#ff6b6b', 8, 140);
          if (cop.health <= 0) {
            world.policeFoot = world.policeFoot.filter((c) => c !== cop);
            addWanted(world, 1, 'Officer down!');
          }
        }
      }
      for (const foe of world.enforcers) {
        if (!foe.alive) continue;
        if (Math.hypot(foe.x - bullet.x, foe.y - bullet.y) < 14) {
          bullet.life = 0;
          foe.health -= PLAYER.pistolDamage;
          spawnParticles(world, foe.x, foe.y, '#ff6b6b', 8, 140);
          if (foe.health <= 0) {
            foe.alive = false;
            world.enforcersLeft -= 1;
            showMessage(world, `Enforcer down! ${world.enforcersLeft} left.`, 2.5);
          }
        }
      }
    } else {
      const player = world.player;
      if (!player.driving && Math.hypot(player.x - bullet.x, player.y - bullet.y) < 13) {
        bullet.life = 0;
        hurtPlayer(world, 8);
      }
    }
  }
}

function hurtPlayer(world, amount) {
  const player = world.player;
  player.health -= amount;
  spawnParticles(world, player.x, player.y, '#ff6b6b', 6, 120);
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    world.screen = 'dead';
    world.stats.arrests += 1;
  }
}

function stepEnforcers(world, dt) {
  const player = world.player;
  for (const foe of world.enforcers) {
    if (!foe.alive) continue;
    const dx = player.x - foe.x;
    const dy = player.y - foe.y;
    const dist = Math.hypot(dx, dy) || 1;
    foe.angle = Math.atan2(dy, dx);
    if (dist > 180) {
      foe.x += (dx / dist) * 90 * dt;
      foe.y += (dy / dist) * 90 * dt;
    }
    foe.fireTimer -= dt;
    if (foe.fireTimer <= 0 && dist < 340) {
      foe.fireTimer = 2.0 + world.rng() * 1.0;
      fireBullet(world, foe.x, foe.y, foe.angle + (world.rng() - 0.5) * 0.35, false);
      if (world.audio) world.audio.shoot();
    }
  }
}

function checkMissionProgress(world, dt) {
  const mission = currentMission(world);
  if (!mission || world.missionState !== 'active') return;
  const player = world.player;
  if (mission.timeLimit) {
    world.missionTimer -= dt;
    if (world.missionTimer <= 0) {
      world.missionState = 'idle';
      showMessage(world, 'Too slow — the job fell through. Press Enter to retry.', 4);
      return;
    }
  }
  const target = missionTarget(world);
  if (mission.type === 'deliverCar') {
    if (player.driving && target && Math.hypot(player.x - target.x, player.y - target.y) < 90) {
      completeMission(world);
    }
  } else if (mission.type === 'courier') {
    if (target && Math.hypot(player.x - target.x, player.y - target.y) < 80) {
      if (world.courierStage === 0) {
        world.courierStage = 1;
        showMessage(world, 'Parcel collected! Drop 1: South Beach Kiosk.', 3);
        if (world.audio) world.audio.pickup();
      } else if (world.courierStage === 1) {
        world.courierStage = 2;
        showMessage(world, 'Drop 1 done! Drop 2: Docks Gate.', 3);
        if (world.audio) world.audio.pickup();
      } else {
        completeMission(world);
      }
    }
  } else if (mission.type === 'loseHeat') {
    if (player.wanted === 0) completeMission(world);
    else if (target && Math.hypot(player.x - target.x, player.y - target.y) < 90) {
      player.wanted = 0;
      world.policeCars = [];
      world.policeFoot = [];
      completeMission(world);
    }
  } else if (mission.type === 'combat') {
    if (world.enforcersLeft <= 0) completeMission(world);
  } else if (mission.type === 'heist') {
    if (player.driving && player.driving.gold && target === world.city.places.hideout
      && Math.hypot(player.x - target.x, player.y - target.y) < 90) {
      player.wanted = 0;
      world.policeCars = [];
      world.policeFoot = [];
      completeMission(world);
    }
  }
}

/** One fixed simulation step. input may be null for a headless step. */
export function stepWorld(world, dt, input, aimAngle) {
  if (world.screen !== 'play') return;
  world.time += dt;
  const player = world.player;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) player.ammo = PLAYER.maxAmmo;
  }
  if (world.messageTimer > 0) world.messageTimer -= dt;
  if (world.saveFlash > 0) world.saveFlash -= dt;
  if (world.ramCooldown > 0) world.ramCooldown -= dt;

  if (input) {
    if (player.driving) stepPlayerDriving(world, dt, input);
    else stepPlayerOnFoot(world, dt, input, aimAngle || 0);
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) world.screen = 'paused';
    if (input.wasPressed('KeyQ') && !player.driving) saveGame(world);
    if (input.wasPressed('KeyM') && world.audio) world.audio.setMuted(!world.audio.muted);
  }

  for (const car of world.traffic) {
    if (car.kind === 'player') continue;
    stepTrafficCar(car, dt, world.rng, [...world.traffic, ...world.policeCars]);
  }
  const dangerX = player.x;
  const dangerY = player.y;
  const dangerActive = world.bullets.length > 0 || player.wanted > 0;
  for (const ped of world.peds) stepPed(ped, dt, world.rng, dangerX, dangerY, dangerActive);

  updateWanted(world, dt);
  for (const car of world.policeCars) {
    stepPoliceCar(car, dt, player.x, player.y);
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 54) {
      // Push the cars apart so the police cannot pin the player forever.
      const push = (54 - dist) / 2;
      car.x += (dx / dist) * push;
      car.y += (dy / dist) * push;
      if (player.driving) {
        player.driving.x -= (dx / dist) * push * 0.5;
        player.driving.y -= (dy / dist) * push * 0.5;
      }
      if (world.ramCooldown <= 0) {
        if (player.driving) {
          player.driving.speed *= 0.85;
          car.speed *= 0.85;
          hurtPlayer(world, 4);
        } else {
          hurtPlayer(world, POLICE.ramDamage);
        }
        world.ramCooldown = 1.2;
      }
    }
  }
  for (const cop of world.policeFoot) {
    const dist = stepPoliceFoot(cop, dt, player.x, player.y);
    if (dist < POLICE.arrestRange && !player.driving) {
      hurtPlayer(world, 30 * dt);
      if (world.rng() < dt * 0.5) showMessage(world, 'The police are arresting you — run!', 2);
    }
  }

  stepEnforcers(world, dt);
  stepBullets(world, dt);
  for (const particle of world.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);

  checkMissionProgress(world, dt);

  // Camera eases toward the player.
  world.camera.x += (player.x - world.camera.x) * Math.min(1, dt * 5);
  world.camera.y += (player.y - world.camera.y) * Math.min(1, dt * 5);

  if (world.audio) {
    const driving = !!player.driving;
    const ratio = driving ? Math.abs(player.driving.speed) / CAR.maxSpeed : 0;
    world.audio.setEngine(ratio, driving);
    world.audio.setSiren(player.wanted > 0, dt);
  }
}

export function saveGame(world) {
  try {
    const data = {
      cash: world.player.cash,
      health: world.player.health,
      missionIndex: world.missionIndex,
      carsStolen: world.stats.carsStolen,
      missionsDone: world.stats.missionsDone,
      x: world.player.x,
      y: world.player.y,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    world.saveFlash = 2;
    showMessage(world, 'Game saved.', 2);
  } catch {
    showMessage(world, 'Save failed (storage unavailable).', 2);
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applySave(world, save) {
  world.player.cash = save.cash || 0;
  world.player.health = save.health || PLAYER.maxHealth;
  world.missionIndex = save.missionIndex || 0;
  world.stats.carsStolen = save.carsStolen || 0;
  world.stats.missionsDone = save.missionsDone || 0;
  if (typeof save.x === 'number') {
    world.player.x = save.x;
    world.player.y = save.y;
    world.camera.x = save.x;
    world.camera.y = save.y;
  }
}
