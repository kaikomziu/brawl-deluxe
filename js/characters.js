// ===== ファイター(ブロウラー)定義 =====
// attack: 通常攻撃(弾を撃つ)。super: 必殺技(ゲージが溜まると発動可能)
// superChargeMax: ゲージ上限。ヒットで increase、被弾でも増える。

const BRAWLERS = [
  {
    id: "rex", name: "レックス", role: "オールラウンド", icon: "🎯",
    color: "#ff5b45", colorDark: "#a5301f",
    hp: 700, speed: 200, radius: 18,
    attack: {
      kind: "rifle", range: 320, damage: 34, count: 1, spread: 0,
      projSpeed: 620, projRadius: 6, cooldown: 0.42, ammo: 3, reloadTime: 1.7,
    },
    superCharge: { perHit: 24, perDamageTaken: 0.12 },
    superId: "rex_barrage",
    desc: "バランス型の万能アサルトライフル使い。中距離からの連射が得意。",
  },
  {
    id: "nova", name: "ノヴァ", role: "スナイパー", icon: "🔭",
    color: "#4fd1ff", colorDark: "#1f6f8a",
    hp: 500, speed: 190, radius: 17,
    attack: {
      kind: "sniper", range: 520, damage: 68, count: 1, spread: 0,
      projSpeed: 900, projRadius: 5, cooldown: 0.85, ammo: 2, reloadTime: 1.5, pierce: true,
    },
    superCharge: { perHit: 45, perDamageTaken: 0.12 },
    superId: "nova_laser",
    desc: "超長射程の一撃必殺スナイパー。必殺技は貫通レーザー。",
  },
  {
    id: "bomta", name: "ボム太", role: "壁越し攻撃", icon: "💣",
    color: "#ffb020", colorDark: "#8a5a10",
    hp: 800, speed: 175, radius: 20,
    attack: {
      kind: "lob", range: 280, damage: 46, count: 1, spread: 0, aoe: 55,
      projSpeed: 380, projRadius: 9, cooldown: 0.95, ammo: 3, reloadTime: 1.9, arc: true,
    },
    superCharge: { perHit: 34, perDamageTaken: 0.12 },
    superId: "bomta_bigbomb",
    desc: "放物線を描く爆弾で壁越しに攻撃。必殺技は大爆発の特大爆弾。",
  },
  {
    id: "heal", name: "ヒール", role: "サポート", icon: "💗",
    color: "#ff8fd6", colorDark: "#a2467e",
    hp: 600, speed: 205, radius: 17,
    attack: {
      kind: "heal", range: 230, damage: 14, count: 3, spread: 18,
      projSpeed: 460, projRadius: 6, cooldown: 0.55, ammo: 3, reloadTime: 1.6, healOnHitAlly: 22,
    },
    superCharge: { perHit: 26, perDamageTaken: 0.12 },
    superId: "heal_burst",
    desc: "回復オーブを撃つサポート。味方に当てると回復する。必殺技は範囲回復+加速。",
  },
  {
    id: "tanker", name: "タンカー", role: "タンク", icon: "🛡️",
    color: "#8b6bff", colorDark: "#463184",
    hp: 1100, speed: 165, radius: 22,
    attack: {
      kind: "shotgun", range: 190, damage: 20, count: 5, spread: 32,
      projSpeed: 560, projRadius: 5, cooldown: 0.75, ammo: 3, reloadTime: 1.8,
    },
    superCharge: { perHit: 30, perDamageTaken: 0.12 },
    superId: "tanker_charge",
    desc: "超高HPの近距離ショットガン使い。必殺技は突進スタン。",
  },
  {
    id: "wind", name: "ウィンド", role: "スピード", icon: "🌀",
    color: "#57e0a8", colorDark: "#1f7a54",
    hp: 560, speed: 250, radius: 16,
    attack: {
      kind: "boomerang", range: 300, damage: 30, count: 1, spread: 0,
      projSpeed: 480, projRadius: 7, cooldown: 0.6, ammo: 3, reloadTime: 1.6, returns: true,
    },
    superCharge: { perHit: 28, perDamageTaken: 0.12 },
    superId: "wind_dash",
    desc: "戻ってくるブーメラン刃で戦う俊足アタッカー。必殺技は無敵ダッシュ。",
  },
  {
    id: "shota", name: "ショウタ", role: "連射", icon: "🔫",
    color: "#ffe14f", colorDark: "#8a7710",
    hp: 620, speed: 215, radius: 17,
    attack: {
      kind: "dual", range: 260, damage: 16, count: 1, spread: 6,
      projSpeed: 700, projRadius: 4, cooldown: 0.16, ammo: 6, reloadTime: 1.4,
    },
    superCharge: { perHit: 14, perDamageTaken: 0.12 },
    superId: "shota_rapid",
    desc: "ツインピストルの高速連射屋。必殺技は数秒間の弾切れ無視連射。",
  },
  {
    id: "frost", name: "フロスト", role: "妨害", icon: "❄️",
    color: "#8fe8ff", colorDark: "#2b7d94",
    hp: 640, speed: 195, radius: 17,
    attack: {
      kind: "ice", range: 300, damage: 26, count: 1, spread: 0,
      projSpeed: 560, projRadius: 7, cooldown: 0.55, ammo: 3, reloadTime: 1.7, slow: 0.5, slowTime: 1.4,
    },
    superCharge: { perHit: 30, perDamageTaken: 0.12 },
    superId: "frost_freeze",
    desc: "命中相手を減速させる氷使い。必殺技は周囲を凍らせて行動不能に。",
  },
  {
    id: "venom", name: "ヴェノム", role: "妨害", icon: "☠️",
    color: "#7bd83a", colorDark: "#3d6e17",
    hp: 660, speed: 195, radius: 17,
    attack: {
      kind: "dart", range: 280, damage: 20, count: 1, spread: 0,
      projSpeed: 640, projRadius: 5, cooldown: 0.45, ammo: 4, reloadTime: 1.6, poison: 8, poisonTime: 2.5,
    },
    superCharge: { perHit: 26, perDamageTaken: 0.12 },
    superId: "venom_cloud",
    desc: "毒ダーツでじわじわ削るタイプ。必殺技は範囲毒霧。",
  },
  {
    id: "ghost", name: "ゴースト", role: "アサシン", icon: "🗡️",
    color: "#c9a6ff", colorDark: "#5a3a94",
    hp: 480, speed: 235, radius: 16,
    attack: {
      kind: "knife", range: 240, damage: 30, count: 3, spread: 14,
      projSpeed: 660, projRadius: 4, cooldown: 0.4, ammo: 3, reloadTime: 1.5,
    },
    superCharge: { perHit: 30, perDamageTaken: 0.12 },
    superId: "ghost_strike",
    desc: "茂みに隠れて奇襲する暗殺者。HPは低いが必殺技の瞬間火力が高い。",
    stealthInBush: true,
  },
];

function getBrawler(id) { return BRAWLERS.find(b => b.id === id); }

// 解放順(所持トロフィー合計でアンロック)。最初の3体は最初から使える。
const UNLOCK_ORDER = ["rex", "tanker", "shota", "bomta", "wind", "heal", "frost", "venom", "nova", "ghost"];
// 全ファイターを最初から解放(トロフィーによるロックは無し)。トロフィー表示・獲得自体はそのまま残す。
const UNLOCK_THRESHOLDS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
