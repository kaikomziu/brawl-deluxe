// ===== CPU(ボット)AI =====
const AI_DIFF = {
  weak: { aimJitter: 0.5, fireChance: 0.35, superChance: 0.35, dodge: false, reaction: 0.5, aggro: 0.5 },
  normal: { aimJitter: 0.28, fireChance: 0.55, superChance: 0.6, dodge: false, reaction: 0.28, aggro: 0.75 },
  strong: { aimJitter: 0.12, fireChance: 0.8, superChance: 0.85, dodge: true, reaction: 0.14, aggro: 1.0 },
  pro: { aimJitter: 0.04, fireChance: 0.95, superChance: 1.0, dodge: true, reaction: 0.06, aggro: 1.2 },
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
    // fireChanceは「1秒あたりの発砲判断確率」として毎フレームdt換算で判定する
    // (毎フレーム同じ確率で判定すると、クールダウンが空くたびほぼ確実に撃ってしまい難易度差が出ない)
    if (los && d <= atk.range && Math.random() < diff.fireChance * dt * 3) tryFire(f, mode, now);
    if (f.superCharge >= f.superMax && Math.random() < diff.superChance * dt * 3) fireSuper(f, mode, now);
  }

  if (!engaging || f.hp / f.maxHp < 0.3) {
    runObjectiveAI(f, mode, now, diff, engaging);
  } else {
    runCombatObjective(f, mode, now, diff);
  }
  applyStuckEscape(f, now);
}

// 上記のどの移動ロジックを通っても壁の角などに引っかかって進めていない場合の保険。
// 一定時間ほとんど動けていなければ、ランダムな方向へ短時間逃がしてから経路を計算し直させる。
function applyStuckEscape(f, now) {
  if (!f._stuckCheckAt || now > f._stuckCheckAt) {
    if (f._stuckPos) {
      const moved = dist(f.x, f.y, f._stuckPos.x, f._stuckPos.y);
      if (moved < 14 && (f.moveX || f.moveY)) {
        f._unstuckUntil = now + 0.4;
        f._unstuckAngle = rand(0, Math.PI * 2);
        f._path = null; // キャッシュ済み経路も破棄して再計算させる
      }
    }
    f._stuckPos = { x: f.x, y: f.y };
    f._stuckCheckAt = now + 0.8;
  }
  if (f._unstuckUntil && now < f._unstuckUntil) {
    f.moveX = Math.cos(f._unstuckAngle); f.moveY = Math.sin(f._unstuckAngle);
  }
}

function runCombatObjective(f, mode, now, diff) {
  if (mode.id === "gemgrab") {
    if (f.carryingGems >= 3 && f.hp / f.maxHp < 0.55) {
      const home = f.team === "A" ? mode.map.spawnsA[0] : mode.map.spawnsB[0];
      moveSmart(f, mode, home.x, home.y, now);
    }
  }
}

function runObjectiveAI(f, mode, now, diff, hasEnemyNearby) {
  if (mode.id === "duel") {
    // 相手が見えていない間は、最初は相手のスポーン方面へ、それ以降はマップ内を巡回して捜す
    if (f.hp / f.maxHp < 0.3 && !hasEnemyNearby) {
      const bush = findNearestBushTile(mode, f);
      if (bush) { moveSmart(f, mode, bush.x, bush.y, now); return; }
    }
    if (!f._wanderPt || (f._wanderUntil && now > f._wanderUntil) || dist(f.x, f.y, f._wanderPt.x, f._wanderPt.y) < 50) {
      if (!f._wanderPt) {
        f._wanderPt = f.team === "A" ? mode.map.spawnsB[0] : mode.map.spawnsA[0];
      } else {
        let px, py, tries = 0;
        do { px = rand(TILE * 2, MAP_W * TILE - TILE * 2); py = rand(TILE * 2, MAP_H * TILE - TILE * 2); tries++; }
        while (isSolid(mode.map, px, py) && tries < 10);
        f._wanderPt = { x: px, y: py };
      }
      f._wanderUntil = now + 6;
    }
    moveSmart(f, mode, f._wanderPt.x, f._wanderPt.y, now);
    return;
  }
  if (mode.id === "gemgrab") {
    if (f.hp / f.maxHp < 0.32 && !hasEnemyNearby) {
      const bush = findNearestBushTile(mode, f);
      if (bush) { moveSmart(f, mode, bush.x, bush.y, now); return; }
    }
    if (f.carryingGems >= 3) {
      const home = f.team === "A" ? mode.map.spawnsA[0] : mode.map.spawnsB[0];
      moveSmart(f, mode, home.x, home.y, now);
      return;
    }
    const gem = findNearestGem(f, mode);
    if (gem) { moveSmart(f, mode, gem.x, gem.y, now); return; }
    moveSmart(f, mode, mode.map.gemMine.x, mode.map.gemMine.y, now);
    return;
  }
  if (mode.id === "showdown") {
    const zd = dist(f.x, f.y, mode.zone.x, mode.zone.y);
    if (zd > mode.zone.r - 30) { moveSmart(f, mode, mode.zone.x, mode.zone.y, now); return; }
    if (f.hp / f.maxHp < 0.35 && !hasEnemyNearby) {
      const bush = findNearestBushTile(mode, f);
      if (bush) { moveSmart(f, mode, bush.x, bush.y, now); return; }
    }
    const cube = mode.powerCubes.find(c => !c.taken);
    if (cube && !hasEnemyNearby) { moveSmart(f, mode, cube.x, cube.y, now); return; }
    moveSmart(f, mode, mode.zone.x + rand(-60, 60), mode.zone.y + rand(-60, 60), now);
    return;
  }
  if (mode.id === "brawlball") {
    const ball = mode.ball;
    const enemyGoal = f.team === "A" ? mode.map.goalB : mode.map.goalA;
    const ownGoal = f.team === "A" ? mode.map.goalA : mode.map.goalB;
    if (ball.carrier === f) {
      const gx = enemyGoal.x + enemyGoal.w / 2, gy = enemyGoal.y + enemyGoal.h / 2;
      moveSmart(f, mode, gx, gy, now);
      f.aimAngle = Math.atan2(gy - f.y, gx - f.x);
      return;
    }
    if (ball.carrier && ball.carrier.team !== f.team) {
      moveSmart(f, mode, ball.carrier.x, ball.carrier.y, now);
      f.aimAngle = Math.atan2(ball.carrier.y - f.y, ball.carrier.x - f.x);
      return;
    }
    if (!ball.carrier) { moveSmart(f, mode, ball.x, ball.y, now); return; }
    const gx = ownGoal.x + ownGoal.w / 2, gy = ownGoal.y + ownGoal.h / 2;
    moveSmart(f, mode, lerp(gx, mode.map.ballSpawn.x, 0.5), gy + rand(-40, 40), now);
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
