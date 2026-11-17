// Solar Bay — shots.js
// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps with a simple autopilot, so the frame is what a short real game
// looks like and the same seed always gives the same frame. No scene
// draws anything the game itself cannot draw.

import { STEP, startMission } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { ROAD_LINES } from './city.js';

const SAMPLE = STEP;

/** Drive the player's car forward, steering toward the road's centre line. */
function driveAutopilot(world) {
  const car = world.player.driving;
  if (!car) return { up: false, down: false, left: false, right: false };
  const ahead = 160;
  // Stay on the road the car is travelling along: snap the aim point to
  // the nearest road line on the axis of travel.
  const horizontal = Math.abs(Math.cos(car.angle)) > Math.abs(Math.sin(car.angle));
  let targetX = car.x + Math.cos(car.angle) * ahead;
  let targetY = car.y + Math.sin(car.angle) * ahead;
  if (horizontal) {
    let line = ROAD_LINES[0];
    for (const candidate of ROAD_LINES) {
      if (Math.abs(candidate - car.y) < Math.abs(line - car.y)) line = candidate;
    }
    targetY = line;
  } else {
    let line = ROAD_LINES[0];
    for (const candidate of ROAD_LINES) {
      if (Math.abs(candidate - car.x) < Math.abs(line - car.x)) line = candidate;
    }
    targetX = line;
  }
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { up: true, down: false, left: diff < -0.05, right: diff > 0.05 };
}

/** A fake input object the world step reads, built from the autopilot. */
function fakeInput(drive, shooting) {
  return {
    keys: new Set(drive.up ? ['KeyW'] : []),
    pressed: new Set(),
    mouseX: 0, mouseY: 0, mouseDown: !!shooting, mouseClicked: false,
    held(group) {
      if (group === 'up') return drive.up;
      if (group === 'down') return drive.down;
      if (group === 'left') return drive.left;
      if (group === 'right') return drive.right;
      return false;
    },
    wasPressed() { return false; },
    endFrame() {},
  };
}

function stageDrive(world, seconds, wanted) {
  // Put the player in a car on a downtown road, then drive.
  const car = world.traffic[0];
  car.x = 1800;
  car.y = 600;
  car.angle = 0;
  car.kind = 'player';
  world.player.driving = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.player.health = 100;
  world.camera.x = car.x;
  world.camera.y = car.y;
  startMission(world);
  if (wanted > 0) {
    world.player.wanted = wanted;
    world.player.wantedTimer = 26;
  }
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const drive = driveAutopilot(world);
    stepWorldShim(world, drive);
  }
}

function stepWorldShim(world, drive) {
  // Step the world with the autopilot's keys, without real input events.
  const input = fakeInput(drive);
  const { stepWorld } = worldShim;
  stepWorld(world, SAMPLE, input, world.player.angle);
}

// Imported lazily to avoid a cycle at module load; set by main.js.
export const worldShim = { stepWorld: null };

/**
 * Set `world` to the named scene and return the screen to draw.
 * start: the title screen over the city. drive: cruising downtown with
 * traffic and the HUD. chase: a three-star police chase. mission: the
 * warehouse shakedown, mid-fight, with the objective on screen.
 */
export function stageShot(name, world, stepWorldFn) {
  worldShim.stepWorld = stepWorldFn;
  world.screen = SCREEN_PLAY;
  if (name === 'start') {
    world.screen = SCREEN_TITLE;
    world.time = 3;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'chase') {
    stageDrive(world, 7, 3);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Jump straight to the shakedown (mission 4) for the combat scene.
    // The player fights back: each step aims at the nearest live
    // enforcer and holds the trigger, so the scene shows a real fight.
    world.missionIndex = 3;
    startMission(world);
    world.player.x = 2560;
    world.player.y = 2160;
    world.player.health = 100;
    world.camera.x = 2560;
    world.camera.y = 2160;
    world.player.wanted = 1;
    world.player.wantedTimer = 26;
    for (let i = 0; i < 2.5 / SAMPLE; i += 1) {
      let target = null;
      let best = Infinity;
      for (const foe of world.enforcers) {
        if (!foe.alive) continue;
        const dist = Math.hypot(foe.x - world.player.x, foe.y - world.player.y);
        if (dist < best) { best = dist; target = foe; }
      }
      const aim = target ? Math.atan2(target.y - world.player.y, target.x - world.player.x) : -Math.PI / 4;
      const input = fakeInput({ up: false, down: false, left: false, right: false }, true);
      stepWorldFn(world, SAMPLE, input, aim);
      if (world.screen !== SCREEN_PLAY) break;
    }
    return { screen: SCREEN_PLAY };
  }
  // Default: drive.
  stageDrive(world, 6, 0);
  return { screen: SCREEN_PLAY };
}
