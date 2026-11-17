// Solar Bay — main.js
// The entrypoint: creates the world, runs the frame loop, and wires the
// screens together. With ?shot=<name>&seed=<n> in the URL it stages one
// deterministic screenshot scene instead of starting at the title.

import { createWorld, stepWorld, saveGame, loadSave, applySave, startMission, currentMission, STEP } from './world.js';
import { render, SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : (Date.now() % 2147483647);
const shotName = params.get('shot');

const world = createWorld(seed);
world.audio = createAudio();
const input = createInput(canvas);

let last = performance.now();
let accumulator = 0;

function aimAngle() {
  const rect = canvas.getBoundingClientRect();
  const screenX = world.player.x - (world.camera.x - canvas.width / 2);
  const screenY = world.player.y - (world.camera.y - canvas.height / 2);
  return Math.atan2(input.mouseY - screenY, input.mouseX - screenX);
}

function startPlaying(fresh) {
  if (fresh) {
    const save = loadSave();
    if (save) applySave(world, save);
  }
  world.screen = SCREEN_PLAY;
  world.audio.ensure();
  world.audio.stopMusic();
  if (!currentMission(world)) {
    // All missions done: free roam.
  } else if (world.missionState !== 'active') {
    startMission(world);
  }
  status.textContent = 'Playing Solar Bay.';
}

if (shotName) {
  // Screenshot mode: stage the scene deterministically, then render.
  world.screen = SCREEN_PLAY;
  stageShot(shotName, world, stepWorld);
  render(ctx, world);
  // Keep rendering so a slow screenshot still catches a live frame.
  setInterval(() => render(ctx, world), 100);
} else {
  world.audio.ensure();
  world.audio.startMusic();
  world.screen = SCREEN_TITLE;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (world.screen === SCREEN_TITLE) {
      world.time += dt;
      if (input.wasPressed('Enter')) {
        const save = loadSave();
        startPlaying(!!save);
      }
      render(ctx, world);
      input.endFrame();
      return;
    }
    if (world.screen === 'paused') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.wasPressed('Enter')) {
        world.screen = SCREEN_PLAY;
      }
      render(ctx, world);
      input.endFrame();
      return;
    }
    if (world.screen === 'dead' || world.screen === 'complete') {
      if (input.wasPressed('Enter')) {
        world.player.health = 100;
        world.player.dead = false;
        world.player.wanted = 0;
        world.policeCars = [];
        world.policeFoot = [];
        world.screen = SCREEN_PLAY;
        if (world.missionState !== 'active' && currentMission(world)) startMission(world);
      }
      render(ctx, world);
      input.endFrame();
      return;
    }
    accumulator += dt;
    while (accumulator >= STEP) {
      stepWorld(world, STEP, input, aimAngle());
      accumulator -= STEP;
    }
    if (world.screen === SCREEN_PLAY && input.wasPressed('Enter') && currentMission(world) && world.missionState !== 'active') {
      startMission(world);
    }
    render(ctx, world);
    input.endFrame();
  }
  requestAnimationFrame(frame);
}
