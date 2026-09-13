// ===== CPU移動用のA*経路探索 =====
// 単純な「正面が壁なら斜めに逸れる」だけの回避では複雑な地形で行き詰まるため、
// タイル単位のA*で正しい経路を求め、それに沿って移動させる。

function tileKeyOf(tx, ty) { return ty * MAP_W + tx; }
function tileWalkable(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  const ch = map.grid[ty][tx];
  return ch !== "#" && ch !== "w";
}
function worldToTile(x, y) {
  return { tx: clamp(Math.floor(x / TILE), 0, MAP_W - 1), ty: clamp(Math.floor(y / TILE), 0, MAP_H - 1) };
}
function octileHeuristic(a, b) {
  const dx = Math.abs(a.tx - b.tx), dy = Math.abs(a.ty - b.ty);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}
// 目的地が壁の中などの場合、一番近い歩けるマスを探す(螺旋状に広げて探索)
function findNearestWalkableTile(map, tx, ty) {
  for (let r = 0; r <= Math.max(MAP_W, MAP_H); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (tileWalkable(map, nx, ny)) return { tx: nx, ty: ny };
      }
    }
  }
  return null;
}

const PATH_NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

// タイル単位のA*。見つからなければnullを返す。ワールド座標(タイル中心)の配列を返す。
function findPath(map, sx, sy, ex, ey) {
  let start = worldToTile(sx, sy);
  let end = worldToTile(ex, ey);
  if (!tileWalkable(map, start.tx, start.ty)) {
    const alt = findNearestWalkableTile(map, start.tx, start.ty);
    if (!alt) return null;
    start = alt;
  }
  if (!tileWalkable(map, end.tx, end.ty)) {
    const alt = findNearestWalkableTile(map, end.tx, end.ty);
    if (!alt) return null;
    end = alt;
  }
  const startKey = tileKeyOf(start.tx, start.ty), endKey = tileKeyOf(end.tx, end.ty);
  if (startKey === endKey) return [tileCenter(end.tx, end.ty)];

  const open = [{ tx: start.tx, ty: start.ty, g: 0, f: octileHeuristic(start, end), key: startKey }];
  const openIndex = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const closed = new Set();
  const MAX_NODES = 2500; // 安全弁(このマップ規模なら十分)
  let visited = 0;

  while (open.length && visited < MAX_NODES) {
    visited++;
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open[bi];
    const lastIdx = open.length - 1;
    open[bi] = open[lastIdx];
    open.pop();
    openIndex.delete(cur.key);
    if (bi < open.length) openIndex.set(open[bi].key, bi); // 詰めた要素のインデックスを更新
    if (cur.key === endKey) {
      const path = [];
      let k = cur.key;
      while (k !== undefined) {
        const ty = Math.floor(k / MAP_W), tx = k % MAP_W;
        path.push(tileCenter(tx, ty));
        k = cameFrom.get(k);
      }
      path.reverse();
      return path;
    }
    closed.add(cur.key);
    for (const [dx, dy, cost] of PATH_NEIGHBORS) {
      const nx = cur.tx + dx, ny = cur.ty + dy;
      if (!tileWalkable(map, nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        // 斜め移動は両脇のどちらかが壁なら角抜けになるので禁止
        if (!tileWalkable(map, cur.tx + dx, cur.ty) || !tileWalkable(map, cur.tx, cur.ty + dy)) continue;
      }
      const nKey = tileKeyOf(nx, ny);
      if (closed.has(nKey)) continue;
      const ng = cur.g + cost;
      if (!gScore.has(nKey) || ng < gScore.get(nKey)) {
        gScore.set(nKey, ng);
        cameFrom.set(nKey, cur.key);
        const f = ng + octileHeuristic({ tx: nx, ty: ny }, end);
        if (openIndex.has(nKey)) {
          open[openIndex.get(nKey)].g = ng; open[openIndex.get(nKey)].f = f;
        } else {
          openIndex.set(nKey, open.length);
          open.push({ tx: nx, ty: ny, g: ng, f, key: nKey });
        }
      }
    }
  }
  return null; // 到達不能
}

// 直線移動で壁に当たらないか(移動用。isSolidで水も含めて判定)
function clearWalkPath(map, x1, y1, x2, y2) {
  const d = dist(x1, y1, x2, y2);
  const steps = Math.max(1, Math.ceil(d / 16));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolid(map, lerp(x1, x2, t), lerp(y1, y2, t))) return false;
  }
  return true;
}

// 目的地まで、直線で届くならそのまま・届かないならA*経路のウェイポイントを追いかけて移動する。
// 長距離の目的地移動(採掘・帰還・巡回など)に使う。近距離の駆け引き移動は既存のsetMoveTowardのままでよい。
function moveSmart(f, mode, tx, ty, now) {
  if (clearWalkPath(mode.map, f.x, f.y, tx, ty)) {
    f._path = null;
    setMoveToward(f, mode, tx, ty);
    return;
  }
  const endTile = worldToTile(tx, ty);
  const endKey = tileKeyOf(endTile.tx, endTile.ty);
  const needsRecalc = !f._path || f._pathEndKey !== endKey || !f._pathRecalcAt || now > f._pathRecalcAt;
  if (needsRecalc) {
    f._path = findPath(mode.map, f.x, f.y, tx, ty);
    f._pathEndKey = endKey;
    f._pathIndex = 0;
    f._pathRecalcAt = now + 0.6 + Math.random() * 0.4;
  }
  if (!f._path || f._path.length === 0) { setMoveToward(f, mode, tx, ty); return; }
  let idx = f._pathIndex || 0;
  while (idx < f._path.length - 1 && dist(f.x, f.y, f._path[idx].x, f._path[idx].y) < 34) idx++;
  f._pathIndex = idx;
  const wp = f._path[idx];
  setMoveToward(f, mode, wp.x, wp.y);
}
