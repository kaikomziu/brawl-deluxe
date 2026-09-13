// ===== CPU(ボット)AI =====
const AI_DIFF = {
  weak: { aimJitter: 0.4, fireChance: 0.55, superChance: 0.5, dodge: false, reaction: 0.5, aggro: 0.6 },
  normal: { aimJitter: 0.2, fireChance: 0.78, superChance: 0.75, dodge: false, reaction: 0.28, aggro: 0.85 },
  strong: { aimJitter: 0.09, fireChance: 0.92, superChance: 0.9, dodge: true, reaction: 0.14, aggro: 1.05 },
  pro: { aimJitter: 0.03, fireChance: 1.0, superChance: 1.0, dodge: true, reaction: 0.06, aggro: 1.25 },
};

function bushRevealDist() { return 95; }

function isVisibleTo(map, vx, vy, tx, ty, targetInBush) {
  const d = dist(vx, vy, tx, ty);
  if (targetInBush && d > bushRevealDist()) return false;
  return clearLineOfSight(map, vx, vy, tx, ty);
}

// CPUの索敵範囲はプレイヤーの画面と同じ「自分の周り(VIEW_W x VIEW_H)」だけ。
// マップ全体を見渡せる索敵はしない=画面外の相手は見えない/狙えない。
function inVisionRange(vx, vy, tx, ty) {
  return Math.abs(tx - vx) <= VIEW_W / 2 && Math.abs(ty - vy) <= VIEW_H / 2;
}

function findNearestEnemy(f, mode, now) {
  let best = null, bestD = 1e9;
  for (const t of mode.fighters) {
    if (!t.alive || t.team === f.team) continue;
    if (now != null && now < t.stealthUntil) continue; // ゴースト必殺技中は狙えない
    if (!inVisionRange(f.x, f.y, t.x, t.y)) continue; // 画面外(索敵範囲外)
    const d = dist(f.x, f.y, t.x, t.y);
    if (d > bestD) continue;
    const tBush = isBush(mode.map, t.x, t.y);
    if (!isVisibleTo(mode.map, f.x, f.y, t.x, t.y, tBush)) continue;
    best = t; bestD = d;
  }
  return best;
}

function steerAvoidingWalls(f, mode, tx, ty) {
  let ang = Math.atan2(ty - f.y, tx - f.x);
  const probe = f.radius + 26;
  const px = f.x + Math.cos(ang) * probe, py = f.y + Math.sin(ang) * probe;
  if (isSolid(mode.map, px, py)) {
    const left = ang - 0.9, right = ang + 0.9;
    const lx = f.x + Math.cos(left) * probe, ly = f.y + Math.sin(left) * probe;
    const rx = f.x + Math.cos(right) * probe, ry = f.y + Math.sin(right) * probe;
    if (!isSolid(mode.map, lx, ly)) ang = left;
    else if (!isSolid(mode.map, rx, ry)) ang = right;
    else ang += Math.PI * 0.5;
  }
  return ang;
}

function setMoveToward(f, mode, tx, ty) {
  const ang = steerAvoidingWalls(f, mode, tx, ty);
  f.moveX = Math.cos(ang); f.moveY = Math.sin(ang);
}
function stopMove(f) { f.moveX = 0; f.moveY = 0; }

function updateBotAI(f, mode, now, dt) {
  if (!f.alive) return;
  const diff = AI_DIFF[f.difficulty] || AI_DIFF.normal;
  f._aiThink = (f._aiThink || 0) - dt;
  if (f._aiThink === undefined || f._aiThink <= 0) f._aiThink = diff.reaction;

  const enemy = findNearestEnemy(f, mode, now);
  const atk = f.brawler.attack;
  const preferredRange = atk.range * (atk.kind === "shotgun" ? 0.45 : 0.72);

  let engaging = false;
  if (enemy) {
    const d = dist(f.x, f.y, enemy.x, enemy.y);
    const jitter = (Math.random() - 0.5) * diff.aimJitter * 2;
    f.aimAngle = Math.atan2(enemy.y - f.y, enemy.x - f.x) + jitter;
    engaging = true;
    // 距離維持: 遠ければ寄る、近すぎれば離れる
    let desiredAng;
    if (d > preferredRange * 1.15) desiredAng = Math.atan2(enemy.y - f.y, enemy.x - f.x);
    else if (d < preferredRange * 0.75) desiredAng = Math.atan2(f.y - enemy.y, f.x - enemy.x);
    else {
      const strafe = f._strafeDir || (f._strafeDir = Math.random() < 0.5 ? 1 : -1);
      if (Math.random() < 0.01) f._strafeDir *= -1;
      desiredAng = Math.atan2(enemy.y - f.y, enemy.x - f.x) + (Math.PI / 2) * f._strafeDir;
    }
    if (diff.dodge && Math.random() < 0.02) f._strafeDir = (f._strafeDir || 1) * -1;
    setMoveToward(f, mode, f.x + Math.cos(desiredAng) * 60, f.y + Math.sin(desiredAng) * 60);
    const los = clearLineOfSight(mode.map, f.x, f.y, enemy.x, enemy.y);
    if (los && d <= atk.range && Math.random() < diff.fireChance) tryFire(f, mode, now);
    if (f.superCharge >= f.superMax && Math.random() < diff.superChance * dt * 3) fireSuper(f, mode, now);
  }

  if (!engaging || f.hp / f.maxHp < 0.3) {
    runObjectiveAI(f, mode, now, diff, engaging);
  } else {
    runCombatObjective(f, mode, now, diff);
  }
}

function runCombatObjective(f, mode, now, diff) {
  if (mode.id === "gemgrab") {
    if (f.carryingGems >= 3 && f.hp / f.maxHp < 0.55) {
      const home = f.team === "A" ? mode.map.spawnsA[0] : mode.map.spawnsB[0];
      setMoveToward(f, mode, home.x, home.y);
    }
  }
}

function runObjectiveAI(f, mode, now, diff, hasEnemyNearby) {
  if (mode.id === "gemgrab") {
    if (f.hp / f.maxHp < 0.32 && !hasEnemyNearby) {
      const bush = findNearestBushTile(mode, f);
      if (bush) { setMoveToward(f, mode, bush.x, bush.y); return; }
    }
    if (f.carryingGems >= 3) {
      const home = f.team === "A" ? mode.map.spawnsA[0] : mode.map.spawnsB[0];
      setMoveToward(f, mode, home.x, home.y);
      return;
    }
    const gem = findNearestGem(f, mode);
    if (gem) { setMoveToward(f, mode, gem.x, gem.y); return; }
    setMoveToward(f, mode, mode.map.gemMine.x, mode.map.gemMine.y);
    return;
  }
  if (mode.id === "showdown") {
    const zd = dist(f.x, f.y, mode.zone.x, mode.zone.y);
    if (zd > mode.zone.r - 30) { setMoveToward(f, mode, mode.zone.x, mode.zone.y); return; }
    if (f.hp / f.maxHp < 0.35 && !hasEnemyNearby) {
      const bush = findNearestBushTile(mode, f);
      if (bush) { setMoveToward(f, mode, bush.x, bush.y); return; }
    }
    const cube = mode.powerCubes.find(c => !c.taken);
    if (cube && !hasEnemyNearby) { setMoveToward(f, mode, cube.x, cube.y); return; }
    setMoveToward(f, mode, mode.zone.x + rand(-60, 60), mode.zone.y + rand(-60, 60));
    return;
  }
  if (mode.id === "brawlball") {
    const ball = mode.ball;
    const enemyGoal = f.team === "A" ? mode.map.goalB : mode.map.goalA;
    const ownGoal = f.team === "A" ? mode.map.goalA : mode.map.goalB;
    if (ball.carrier === f) {
      const gx = enemyGoal.x + enemyGoal.w / 2, gy = enemyGoal.y + enemyGoal.h / 2;
      setMoveToward(f, mode, gx, gy);
      f.aimAngle = Math.atan2(gy - f.y, gx - f.x);
      return;
    }
    if (ball.carrier && ball.carrier.team !== f.team) {
      setMoveToward(f, mode, ball.carrier.x, ball.carrier.y);
      f.aimAngle = Math.atan2(ball.carrier.y - f.y, ball.carrier.x - f.x);
      return;
    }
    if (!ball.carrier) { setMoveToward(f, mode, ball.x, ball.y); return; }
    const gx = ownGoal.x + ownGoal.w / 2, gy = ownGoal.y + ownGoal.h / 2;
    setMoveToward(f, mode, lerp(gx, mode.map.ballSpawn.x, 0.5), gy + rand(-40, 40));
    return;
  }
  stopMove(f);
}

function findNearestGem(f, mode) {
  let best = null, bestD = 1e9;
  for (const g of mode.gems) {
    const d = dist(f.x, f.y, g.x, g.y);
    if (d < bestD) { bestD = d; best = g; }
  }
  return best;
}
function findNearestBushTile(mode, f) {
  let best = null, bestD = 1e9;
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (mode.map.grid[ty][tx] !== "b") continue;
    const c = tileCenter(tx, ty);
    const d = dist(f.x, f.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
