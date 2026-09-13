// ===== マップ定義 =====
// グリッドベース。'#'=壁(移動・弾を防ぐ) 'b'=茂み(隠れられる、移動は可) 'w'=水(移動不可・弾は通る)
const TILE = 40;
const MAP_W = 36;
const MAP_H = 24;
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
  // 左右対称の障害物。通路はどこも2マス以上あけて、詰まらないようにする
  rectSym(g, 7, 5, 3, 3, "#");
  rectSym(g, 7, 16, 3, 3, "#");
  rectSym(g, 13, 3, 2, 2, "b");
  rectSym(g, 13, 19, 2, 2, "b");
  rectSym(g, 4, 10, 2, 1, "b");
  rectSym(g, 4, 13, 2, 1, "b");
  rectSym(g, 9, 9, 1, 6, "#");
  // 中央ジェム鉱山まわり(視界は塞がないよう茂みは隅だけ)
  rect(g, 16, 10, 1, 1, "b");
  rect(g, 19, 10, 1, 1, "b");
  rect(g, 16, 13, 1, 1, "b");
  rect(g, 19, 13, 1, 1, "b");
  rect(g, 17, 8, 2, 1, "#");
  rect(g, 17, 15, 2, 1, "#");
  return {
    id: "gemvalley", name: "ジェムの谷", mode: "gemgrab", grid: g,
    spawnsA: [tileCenter(3, 9), tileCenter(3, 12), tileCenter(3, 15)],
    spawnsB: [tileCenter(32, 9), tileCenter(32, 12), tileCenter(32, 15)],
    gemMine: tileCenter(18, 12),
  };
}

function buildCrystalRuins() {
  const g = emptyGrid();
  border(g);
  rectSym(g, 4, 4, 4, 1, "#");
  rectSym(g, 4, 19, 4, 1, "#");
  rectSym(g, 3, 11, 2, 2, "b");
  rectSym(g, 13, 3, 1, 4, "#");
  rectSym(g, 13, 17, 1, 4, "#");
  rectSym(g, 9, 8, 1, 1, "b");
  rectSym(g, 9, 15, 1, 1, "b");
  rect(g, 16, 9, 1, 1, "b");
  rect(g, 19, 9, 1, 1, "b");
  rect(g, 16, 14, 1, 1, "b");
  rect(g, 19, 14, 1, 1, "b");
  rect(g, 17, 7, 2, 1, "#");
  rect(g, 17, 16, 2, 1, "#");
  return {
    id: "crystalruins", name: "水晶廃墟", mode: "gemgrab", grid: g,
    spawnsA: [tileCenter(3, 7), tileCenter(3, 12), tileCenter(3, 17)],
    spawnsB: [tileCenter(32, 7), tileCenter(32, 12), tileCenter(32, 17)],
    gemMine: tileCenter(18, 12),
  };
}

function buildRuinsArena() {
  const g = emptyGrid();
  border(g);
  rect(g, 7, 5, 2, 2, "#");
  rect(g, 27, 5, 2, 2, "#");
  rect(g, 7, 17, 2, 2, "#");
  rect(g, 27, 17, 2, 2, "#");
  rect(g, 17, 2, 2, 2, "b");
  rect(g, 17, 20, 2, 2, "b");
  rect(g, 2, 11, 2, 2, "b");
  rect(g, 32, 11, 2, 2, "b");
  rect(g, 12, 11, 1, 3, "#");
  rect(g, 23, 10, 1, 3, "#");
  rect(g, 16, 10, 1, 1, "b");
  rect(g, 19, 10, 1, 1, "b");
  rect(g, 16, 13, 1, 1, "b");
  rect(g, 19, 13, 1, 1, "b");
  rect(g, 9, 8, 2, 1, "b");
  rect(g, 25, 15, 2, 1, "b");
  rect(g, 5, 3, 1, 1, "w");
  rect(g, 30, 20, 1, 1, "w");
  const spawns = [];
  const cx = MAP_W / 2, cy = MAP_H / 2;
  const R = 14;
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    spawns.push({ x: cx * TILE + Math.cos(a) * R * TILE, y: cy * TILE + Math.sin(a) * R * TILE * (MAP_H / MAP_W) });
  }
  return {
    id: "ruinsarena", name: "廃墟アリーナ", mode: "showdown", grid: g,
    showdownSpawns: spawns,
    zoneCenter: { x: cx * TILE, y: cy * TILE },
    zoneStartR: 620, zoneEndR: 80,
    cubeSpots: [tileCenter(10, 6), tileCenter(26, 6), tileCenter(10, 18), tileCenter(26, 18), tileCenter(18, 12)],
  };
}

function buildGoalLine() {
  const g = emptyGrid();
  border(g);
  rectSym(g, 6, 7, 1, 3, "#");
  rectSym(g, 6, 14, 1, 3, "#");
  rectSym(g, 13, 2, 2, 2, "b");
  rectSym(g, 13, 20, 2, 2, "b");
  rectSym(g, 16, 10, 1, 4, "#");
  // ゴール口(壁の切れ目)
  rect(g, 0, 9, 1, 6, ".");
  rect(g, MAP_W - 1, 9, 1, 6, ".");
  return {
    id: "goalline", name: "ゴールライン", mode: "brawlball", grid: g,
    spawnsA: [tileCenter(5, 9), tileCenter(5, 12), tileCenter(5, 15)],
    spawnsB: [tileCenter(30, 9), tileCenter(30, 12), tileCenter(30, 15)],
    ballSpawn: tileCenter(18, 12),
    goalA: { x: 0, y: 9 * TILE, w: TILE, h: 6 * TILE }, // 味方Aが守る(Bが決める)
    goalB: { x: (MAP_W - 1) * TILE, y: 9 * TILE, w: TILE, h: 6 * TILE }, // 味方Bが守る(Aが決める)
  };
}

function buildSkyPitch() {
  const g = emptyGrid();
  border(g);
  rect(g, 9, 5, 2, 2, "#");
  rect(g, 25, 5, 2, 2, "#");
  rect(g, 9, 17, 2, 2, "#");
  rect(g, 25, 17, 2, 2, "#");
  rect(g, 17, 3, 2, 1, "b");
  rect(g, 17, 20, 2, 1, "b");
  rect(g, 6, 11, 1, 2, "b");
  rect(g, 29, 11, 1, 2, "b");
  rect(g, 0, 9, 1, 6, ".");
  rect(g, MAP_W - 1, 9, 1, 6, ".");
  return {
    id: "skypitch", name: "スカイピッチ", mode: "brawlball", grid: g,
    spawnsA: [tileCenter(5, 9), tileCenter(5, 12), tileCenter(5, 15)],
    spawnsB: [tileCenter(30, 9), tileCenter(30, 12), tileCenter(30, 15)],
    ballSpawn: tileCenter(18, 12),
    goalA: { x: 0, y: 9 * TILE, w: TILE, h: 6 * TILE },
    goalB: { x: (MAP_W - 1) * TILE, y: 9 * TILE, w: TILE, h: 6 * TILE },
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
