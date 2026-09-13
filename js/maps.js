// ===== マップ定義 =====
// グリッドベース。'#'=壁(移動・弾を防ぐ) 'b'=茂み(隠れられる、移動は可) 'w'=水(移動不可・弾は通る)
const TILE = 40;
const MAP_W = 24;
const MAP_H = 16;
// カメラ(画面に映る範囲)のワールド座標サイズ。マップ全体ではなく自分の周囲だけを表示する。
const VIEW_W = 480;
const VIEW_H = 320;

function emptyGrid(fill = ".") {
  const g = [];
  for (let y = 0; y < MAP_H; y++) g.push(new Array(MAP_W).fill(fill));
  return g;
}
function rect(g, x, y, w, h, ch) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++)
      if (yy >= 0 && yy < MAP_H && xx >= 0 && xx < MAP_W) g[yy][xx] = ch;
}
function rectSym(g, x, y, w, h, ch) {
  rect(g, x, y, w, h, ch);
  rect(g, MAP_W - x - w, y, w, h, ch);
}
function border(g) {
  rect(g, 0, 0, MAP_W, 1, "#");
  rect(g, 0, MAP_H - 1, MAP_W, 1, "#");
  rect(g, 0, 0, 1, MAP_H, "#");
  rect(g, MAP_W - 1, 0, 1, MAP_H, "#");
}
function tileCenter(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }

function buildGemValley() {
  const g = emptyGrid();
  border(g);
  // 左右対称の障害物
  rectSym(g, 2, 2, 2, 2, "#");
  rectSym(g, 2, 12, 2, 2, "#");
  rectSym(g, 5, 6, 1, 4, "#");
  rectSym(g, 8, 1, 2, 2, "b");
  rectSym(g, 8, 13, 2, 2, "b");
  rectSym(g, 4, 4, 3, 1, "b");
  rectSym(g, 4, 11, 3, 1, "b");
  rectSym(g, 9, 7, 1, 2, "#");
  // 中央ジェム鉱山まわり
  rect(g, 10, 6, 4, 1, "b");
  rect(g, 10, 9, 4, 1, "b");
  rect(g, 11, 3, 2, 1, "#");
  rect(g, 11, 12, 2, 1, "#");
  return {
    id: "gemvalley", name: "ジェムの谷", mode: "gemgrab", grid: g,
    spawnsA: [tileCenter(2, 6), tileCenter(2, 8), tileCenter(2, 10)],
    spawnsB: [tileCenter(21, 6), tileCenter(21, 8), tileCenter(21, 10)],
    gemMine: tileCenter(12, 8),
  };
}

function buildCrystalRuins() {
  const g = emptyGrid();
  border(g);
  rectSym(g, 3, 3, 3, 1, "#");
  rectSym(g, 3, 12, 3, 1, "#");
  rectSym(g, 6, 6, 1, 1, "b");
  rectSym(g, 6, 9, 1, 1, "b");
  rectSym(g, 2, 7, 2, 2, "b");
  rectSym(g, 9, 2, 1, 3, "#");
  rectSym(g, 9, 11, 1, 3, "#");
  rect(g, 10, 7, 4, 2, "b");
  rect(g, 11, 5, 2, 1, "#");
  rect(g, 11, 10, 2, 1, "#");
  return {
    id: "crystalruins", name: "水晶廃墟", mode: "gemgrab", grid: g,
    spawnsA: [tileCenter(2, 5), tileCenter(2, 8), tileCenter(2, 11)],
    spawnsB: [tileCenter(21, 5), tileCenter(21, 8), tileCenter(21, 11)],
    gemMine: tileCenter(12, 8),
  };
}

function buildRuinsArena() {
  const g = emptyGrid();
  border(g);
  rect(g, 4, 3, 2, 2, "#");
  rect(g, 18, 3, 2, 2, "#");
  rect(g, 4, 11, 2, 2, "#");
  rect(g, 18, 11, 2, 2, "#");
  rect(g, 11, 1, 2, 2, "b");
  rect(g, 11, 13, 2, 2, "b");
  rect(g, 1, 7, 2, 2, "b");
  rect(g, 21, 7, 2, 2, "b");
  rect(g, 8, 7, 1, 3, "#");
  rect(g, 15, 6, 1, 3, "#");
  rect(g, 11, 7, 2, 2, "b");
  rect(g, 6, 5, 2, 1, "b");
  rect(g, 16, 10, 2, 1, "b");
  rect(g, 3, 2, 1, 1, "w");
  rect(g, 20, 13, 1, 1, "w");
  const spawns = [];
  const cx = MAP_W / 2, cy = MAP_H / 2;
  const R = 8.5;
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    spawns.push({ x: cx * TILE + Math.cos(a) * R * TILE, y: cy * TILE + Math.sin(a) * R * TILE * 0.62 });
  }
  return {
    id: "ruinsarena", name: "廃墟アリーナ", mode: "showdown", grid: g,
    showdownSpawns: spawns,
    zoneCenter: { x: cx * TILE, y: cy * TILE },
    zoneStartR: 480, zoneEndR: 60,
    cubeSpots: [tileCenter(6, 4), tileCenter(17, 4), tileCenter(6, 12), tileCenter(17, 12), tileCenter(12, 8)],
  };
}

function buildGoalLine() {
  const g = emptyGrid();
  border(g);
  rectSym(g, 3, 4, 1, 2, "#");
  rectSym(g, 3, 10, 1, 2, "#");
  rectSym(g, 7, 1, 2, 1, "b");
  rectSym(g, 7, 14, 2, 1, "b");
  rectSym(g, 9, 6, 1, 4, "#");
  rect(g, 11, 4, 2, 1, "b");
  rect(g, 11, 11, 2, 1, "b");
  // ゴール口(壁の切れ目)
  rect(g, 0, 6, 1, 4, ".");
  rect(g, MAP_W - 1, 6, 1, 4, ".");
  return {
    id: "goalline", name: "ゴールライン", mode: "brawlball", grid: g,
    spawnsA: [tileCenter(4, 6), tileCenter(4, 8), tileCenter(4, 10)],
    spawnsB: [tileCenter(19, 6), tileCenter(19, 8), tileCenter(19, 10)],
    ballSpawn: tileCenter(12, 8),
    goalA: { x: 0, y: 6 * TILE, w: TILE, h: 4 * TILE }, // 味方Aが守る(Bが決める)
    goalB: { x: (MAP_W - 1) * TILE, y: 6 * TILE, w: TILE, h: 4 * TILE }, // 味方Bが守る(Aが決める)
  };
}

function buildSkyPitch() {
  const g = emptyGrid();
  border(g);
  rect(g, 6, 3, 2, 2, "#");
  rect(g, 16, 3, 2, 2, "#");
  rect(g, 6, 11, 2, 2, "#");
  rect(g, 16, 11, 2, 2, "#");
  rect(g, 11, 2, 2, 1, "b");
  rect(g, 11, 13, 2, 1, "b");
  rect(g, 4, 7, 1, 2, "b");
  rect(g, 19, 7, 1, 2, "b");
  rect(g, 0, 6, 1, 4, ".");
  rect(g, MAP_W - 1, 6, 1, 4, ".");
  return {
    id: "skypitch", name: "スカイピッチ", mode: "brawlball", grid: g,
    spawnsA: [tileCenter(4, 6), tileCenter(4, 8), tileCenter(4, 10)],
    spawnsB: [tileCenter(19, 6), tileCenter(19, 8), tileCenter(19, 10)],
    ballSpawn: tileCenter(12, 8),
    goalA: { x: 0, y: 6 * TILE, w: TILE, h: 4 * TILE },
    goalB: { x: (MAP_W - 1) * TILE, y: 6 * TILE, w: TILE, h: 4 * TILE },
  };
}

const MAPS = {
  gemgrab: [buildGemValley(), buildCrystalRuins()],
  showdown: [buildRuinsArena()],
  brawlball: [buildGoalLine(), buildSkyPitch()],
};

function pickMap(mode) { return choice(MAPS[mode]); }

function tileAt(map, px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return "#";
  return map.grid[ty][tx];
}
function isSolid(map, px, py) {
  const t = tileAt(map, px, py);
  return t === "#" || t === "w";
}
function blocksBullet(map, px, py) { return tileAt(map, px, py) === "#"; }
function isBush(map, px, py) { return tileAt(map, px, py) === "b"; }
