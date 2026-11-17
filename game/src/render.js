// Solar Bay — render.js
// Everything the player sees: the sun-soaked city from above, the cars
// and crowds, the police lights, and the HUD — cash, health, wanted
// stars, mission objective and the minimap. Menus are drawn on the same
// canvas so screenshots show the whole game.

import { WORLD, PALETTE, CAR } from './config.js';
import { ROAD_LINES, districtAt } from './city.js';
import { currentMission, missionTarget } from './world.js';
import { STORY_INTRO, MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_DEAD = 'dead';
export const SCREEN_COMPLETE = 'complete';

function drawBuilding(ctx, b) {
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  const cellW = b.w / b.cols;
  const cellH = b.h / b.rows;
  for (let cx = 0; cx < b.cols; cx += 1) {
    for (let cy = 0; cy < b.rows; cy += 1) {
      if ((cx + cy * 3) % 3 === 0) {
        ctx.fillRect(b.x + 6 + cx * cellW, b.y + 6 + cy * cellH, cellW - 10, cellH - 10);
      }
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 3, car.length, car.width);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  roundRect(ctx, -car.length / 2 + 9, -car.width / 2 + 4, car.length - 22, car.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-4, -car.width / 2 + 2, 8, 3);
  ctx.fillRect(-4, car.width / 2 - 5, 8, 3);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(car.length / 2 - 3, -car.width / 2 + 3, 3, 5);
  ctx.fillRect(car.length / 2 - 3, car.width / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(-car.length / 2, -car.width / 2 + 3, 3, 5);
  ctx.fillRect(-car.length / 2, car.width / 2 - 8, 3, 5);
  if (car.kind === 'police') {
    const phase = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = phase ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
    ctx.fillRect(-6, -car.width / 2 - 2, 12, 5);
    ctx.fillStyle = phase ? PALETTE.policeLightBlue : PALETTE.policeLightRed;
    ctx.fillRect(-6, car.width / 2 - 3, 12, 5);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (car.gold) {
    ctx.strokeStyle = '#fff7ae';
    ctx.lineWidth = 2;
    roundRect(ctx, -car.length / 2 - 2, -car.width / 2 - 2, car.length + 4, car.width + 4, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCop(ctx, cop, time) {
  ctx.save();
  ctx.translate(cop.x, cop.y);
  ctx.rotate(cop.angle);
  ctx.fillStyle = '#1d3557';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a8dadc';
  ctx.fillRect(4, -3, 8, 6);
  ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#ff2e2e' : '#2e7dff';
  ctx.beginPath();
  ctx.arc(0, -9, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnforcer(ctx, foe) {
  ctx.save();
  ctx.translate(foe.x, foe.y);
  ctx.rotate(foe.angle);
  ctx.fillStyle = '#3d0c11';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.fillRect(6, -3, 10, 6);
  ctx.restore();
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(foe.x - 14, foe.y - 20, 28, 4);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(foe.x - 14, foe.y - 20, 28 * Math.max(0, foe.health / 100), 4);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCity(ctx, world, view) {
  const { city } = world;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Water and beach on the east edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(view.x, city.water.x0), view.y, Math.max(0, view.x + view.w - city.water.x0), view.h);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let i = 0; i < 5; i += 1) {
    const waveY = 200 + i * 640 + ((world.time * 12) % 640);
    ctx.fillRect(city.water.x0 + 10, waveY, 60, 4);
  }
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(view.x, city.beach.x0), view.y, Math.max(0, Math.min(view.x + view.w, city.beach.x1) - Math.max(view.x, city.beach.x0)), view.h);
  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Plaza.
  ctx.fillStyle = PALETTE.plaza;
  ctx.fillRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
  ctx.fillStyle = '#8a6d3b';
  ctx.beginPath();
  ctx.arc(city.plaza.x + city.plaza.w / 2, city.plaza.y + city.plaza.h / 2, 26, 0, Math.PI * 2);
  ctx.fill();
  // Trees.
  for (const tree of city.trees) {
    ctx.fillStyle = '#2f7d32';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#43a047';
    ctx.beginPath();
    ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roads: asphalt, then sidewalks, then dashes.
  ctx.fillStyle = PALETTE.road;
  for (const line of ROAD_LINES) {
    ctx.fillRect(view.x, line - WORLD.roadWidth / 2, view.w, WORLD.roadWidth);
    ctx.fillRect(line - WORLD.roadWidth / 2, view.y, WORLD.roadWidth, view.h);
  }
  ctx.fillStyle = PALETTE.sidewalk;
  for (const line of ROAD_LINES) {
    ctx.fillRect(view.x, line - WORLD.roadWidth / 2 - WORLD.sidewalk, view.w, WORLD.sidewalk);
    ctx.fillRect(view.x, line + WORLD.roadWidth / 2, view.w, WORLD.sidewalk);
    ctx.fillRect(line - WORLD.roadWidth / 2 - WORLD.sidewalk, view.y, WORLD.sidewalk, view.h);
    ctx.fillRect(line + WORLD.roadWidth / 2, view.y, WORLD.sidewalk, view.h);
  }
  ctx.fillStyle = PALETTE.road;
  for (const line of ROAD_LINES) {
    ctx.fillRect(view.x, line - WORLD.roadWidth / 2, view.w, WORLD.roadWidth);
    ctx.fillRect(line - WORLD.roadWidth / 2, view.y, WORLD.roadWidth, view.h);
  }
  ctx.fillStyle = PALETTE.roadLine;
  for (const line of ROAD_LINES) {
    for (let d = 0; d < WORLD.width; d += 64) {
      ctx.fillRect(d, line - 2, 30, 4);
      ctx.fillRect(line - 2, d, 4, 30);
    }
  }
  // District labels on the roads.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const district of [
    { name: 'DOWNTOWN', x: 2000, y: 600 },
    { name: 'PALM COURT', x: 1200, y: 1400 },
    { name: 'THE DOCKS', x: 2800, y: 2200 },
    { name: 'SOUTH BEACH', x: 400, y: 3000 },
    { name: 'MARINA ROW', x: 1200, y: 200 },
  ]) {
    ctx.fillText(district.name, district.x, district.y);
  }
  for (const b of city.buildings) drawBuilding(ctx, b);
  // Mission target marker.
  const target = missionTarget(world);
  if (target && world.missionState === 'active') {
    const pulse = 1 + Math.sin(world.time * 4) * 0.15;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 26);
    ctx.lineTo(target.x - 10, target.y - 44);
    ctx.lineTo(target.x + 10, target.y - 44);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWorld(ctx, world) {
  const canvas = ctx.canvas;
  const view = {
    x: Math.max(0, Math.min(WORLD.width - canvas.width, world.camera.x - canvas.width / 2)),
    y: Math.max(0, Math.min(WORLD.height - canvas.height, world.camera.y - canvas.height / 2)),
    w: canvas.width,
    h: canvas.height,
  };
  ctx.save();
  ctx.translate(-view.x, -view.y);
  drawCity(ctx, world, view);
  for (const ped of world.peds) drawPed(ctx, ped);
  for (const car of world.traffic) drawCar(ctx, car, world.time);
  for (const car of world.policeCars) drawCar(ctx, car, world.time);
  for (const cop of world.policeFoot) drawCop(ctx, cop, world.time);
  for (const foe of world.enforcers) if (foe.alive) drawEnforcer(ctx, foe);
  // Bullets and particles.
  for (const bullet of world.bullets) {
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const particle of world.particles) {
    ctx.globalAlpha = Math.max(0, particle.life * 2);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - 3, particle.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
  // The player on foot.
  const player = world.player;
  if (!player.driving) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d3557';
    ctx.beginPath();
    ctx.arc(Math.cos(player.angle) * 5, Math.sin(player.angle) * 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(Math.cos(player.angle) * 10 - 2, Math.sin(player.angle) * 10 - 2, 12, 4);
    ctx.restore();
  }
  ctx.restore();
  return view;
}

function drawMinimap(ctx, world, canvas) {
  const size = 190;
  const x0 = canvas.width - size - 14;
  const y0 = canvas.height - size - 14;
  const scale = size / WORLD.width;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,24,0.82)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#3d7a4d';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2f9db4';
  ctx.fillRect(x0 + 2920 * scale, y0, size - 2920 * scale, size);
  ctx.fillStyle = '#3d3a38';
  for (const line of ROAD_LINES) {
    ctx.fillRect(x0, y0 + line * scale - 1, size, 3);
    ctx.fillRect(x0 + line * scale - 1, y0, 3, size);
  }
  const target = missionTarget(world);
  if (target && world.missionState === 'active') {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of world.policeCars) {
    ctx.fillStyle = '#2e7dff';
    ctx.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(x0 + world.player.x * scale, y0 + world.player.y * scale, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x0 + world.player.x * scale, y0 + world.player.y * scale, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(districtAt(world.player.x, world.player.y).toUpperCase(), x0, y0 + size + 2);
  ctx.restore();
}

function drawHud(ctx, world, canvas) {
  const player = world.player;
  ctx.save();
  ctx.textAlign = 'left';
  // Top-left: cash, health, ammo.
  ctx.fillStyle = 'rgba(10,16,24,0.78)';
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = '#7CFC98';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, 26, 42);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`HEALTH ${Math.ceil(player.health)}`, 26, 64);
  ctx.fillStyle = '#333';
  ctx.fillRect(26, 72, 180, 10);
  ctx.fillStyle = player.health > 30 ? '#7CFC98' : '#ff4d4d';
  ctx.fillRect(26, 72, 180 * Math.max(0, player.health / 100), 10);
  ctx.fillStyle = '#fff';
  ctx.fillText(player.driving ? `SPEED ${Math.round(Math.abs(player.driving.speed) * 0.36)} km/h` : `AMMO ${player.ammo}`, 26, 98);
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,16,24,0.78)';
  roundRect(ctx, canvas.width - 190, 12, 178, 46, 10);
  ctx.fill();
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < player.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', canvas.width - 168 + i * 32, 44);
  }
  // Bottom-left: mission objective.
  const mission = currentMission(world);
  if (mission) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(10,16,24,0.78)';
    roundRect(ctx, 12, canvas.height - 96, 420, 82, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`MISSION ${mission.id}/${MISSIONS.length}: ${mission.title.toUpperCase()}`, 26, canvas.height - 70);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    const status = world.missionState === 'active' ? mission.objective : 'Press ENTER to start the job';
    ctx.fillText(status, 26, canvas.height - 48);
    if (mission.timeLimit && world.missionState === 'active') {
      ctx.fillStyle = world.missionTimer < 30 ? '#ff6b6b' : '#fff';
      ctx.fillText(`TIME LEFT: ${Math.max(0, Math.ceil(world.missionTimer))}s`, 26, canvas.height - 28);
    }
  }
  // Centre message.
  if (world.messageTimer > 0 && world.message) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px sans-serif';
    const width = ctx.measureText(world.message).width + 36;
    ctx.fillStyle = 'rgba(10,16,24,0.82)';
    roundRect(ctx, canvas.width / 2 - width / 2, 84, width, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(world.message, canvas.width / 2, 111);
  }
  // Controls hint.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive · E enter car · Mouse aim · Click shoot · R reload · Q save · P pause · M mute', canvas.width - 220, canvas.height - 22);
  if (world.saveFlash > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7CFC98';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('SAVED', canvas.width / 2, canvas.height - 130);
  }
  ctx.restore();
}

function drawTitle(ctx, world, canvas) {
  drawWorld(ctx, world);
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 92px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('SOLAR BAY', canvas.width / 2, 190);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', canvas.width / 2, 228);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  STORY_INTRO.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, 280 + i * 22);
  });
  ctx.fillStyle = 'rgba(10,16,24,0.85)';
  roundRect(ctx, canvas.width / 2 - 330, 470, 660, 150, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move / drive    ·    E steal & enter a car    ·    Mouse aim, Click shoot', canvas.width / 2, 505);
  ctx.fillText('Shift run    ·    Space handbrake    ·    R reload    ·    Q save    ·    P pause', canvas.width / 2, 532);
  ctx.fillText('5 story missions · traffic & pedestrians · wanted stars & police · minimap', canvas.width / 2, 559);
  ctx.fillText('Steal cars, lose the heat, take the gold Comet home.', canvas.width / 2, 586);
  const blink = Math.floor(world.time * 2) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('PRESS ENTER TO PLAY', canvas.width / 2, 680);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('100% original: its own city, characters, cars and story — nothing from any commercial game.', canvas.width / 2, canvas.height - 24);
  ctx.restore();
}

function drawPaused(ctx, world, canvas) {
  drawWorld(ctx, world);
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press P to keep playing · Q to save · M to mute', canvas.width / 2, canvas.height / 2 + 24);
  ctx.restore();
}

function drawDead(ctx, world, canvas) {
  drawWorld(ctx, world);
  ctx.save();
  ctx.fillStyle = 'rgba(40,4,8,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('BUSTED', canvas.width / 2, canvas.height / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('The Solar Bay police caught up with Maya.', canvas.width / 2, canvas.height / 2 + 12);
  ctx.fillText('Press ENTER to try again — your cash and missions are kept.', canvas.width / 2, canvas.height / 2 + 44);
  ctx.restore();
}

function drawComplete(ctx, world, canvas) {
  drawWorld(ctx, world);
  ctx.save();
  ctx.fillStyle = 'rgba(8,20,12,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 60px sans-serif';
  ctx.fillText('SOLAR BAY IS YOURS', canvas.width / 2, canvas.height / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(`All 5 missions done. Final take: $${world.player.cash.toLocaleString('en-US')}.`, canvas.width / 2, canvas.height / 2 + 8);
  ctx.fillText('Press ENTER to keep cruising the city.', canvas.width / 2, canvas.height / 2 + 44);
  ctx.restore();
}

/** Draw one frame for the world's current screen. */
export function render(ctx, world) {
  const canvas = ctx.canvas;
  if (world.screen === SCREEN_TITLE) {
    drawTitle(ctx, world, canvas);
    return;
  }
  drawWorld(ctx, world);
  drawHud(ctx, world, canvas);
  drawMinimap(ctx, world, canvas);
  if (world.screen === SCREEN_PAUSED) drawPaused(ctx, world, canvas);
  if (world.screen === SCREEN_DEAD) drawDead(ctx, world, canvas);
  if (world.screen === SCREEN_COMPLETE) drawComplete(ctx, world, canvas);
}
