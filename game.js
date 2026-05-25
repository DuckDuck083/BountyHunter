const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  coins: document.querySelector("#coins"),
  hp: document.querySelector("#hp"),
  day: document.querySelector("#day"),
  weapon: document.querySelector("#weapon"),
  place: document.querySelector("#placeLabel"),
  log: document.querySelector("#log"),
  bountyList: document.querySelector("#bountyList"),
  rideOut: document.querySelector("#rideOut"),
  claimReward: document.querySelector("#claimReward"),
  sheriffText: document.querySelector("#sheriffText"),
  shopList: document.querySelector("#shopList"),
};

const weapons = [
  { name: "Rusty Revolver", damage: 14, rate: 460, spread: 0.22, speed: 8.6, range: 62, kick: 1.35, cost: 0 },
  { name: "Cattleman Iron", damage: 24, rate: 350, spread: 0.15, speed: 9.4, range: 70, kick: 1.15, cost: 115 },
  { name: "Coach Shotgun", damage: 13, pellets: 6, rate: 720, spread: 0.5, speed: 8.2, range: 38, kick: 2.5, cost: 185 },
  { name: "Repeater Rifle", damage: 34, rate: 260, spread: 0.09, speed: 11.2, range: 88, kick: 0.8, cost: 290 },
  { name: "Buffalo Rifle", damage: 78, rate: 960, spread: 0.035, speed: 14, range: 120, kick: 3.2, cost: 430 },
  { name: "Pepperbox Volley", damage: 20, pellets: 4, rate: 390, spread: 0.32, speed: 9.6, range: 58, kick: 1.7, cost: 560 },
  { name: "Ghost Lantern Carbine", damage: 56, rate: 210, spread: 0.06, speed: 12.5, range: 96, kick: 0.65, cost: 850 },
];

const storeItems = [
  { id: "boots", name: "Spur Boots", cost: 120, text: "+12% movement control", apply: () => state.items.boots = true },
  { id: "armor", name: "Tin Star Vest", cost: 180, text: "Incoming damage -18%", apply: () => state.items.armor = true },
  { id: "tonic", name: "Snake Oil Tonic", cost: 70, text: "Heal 55 HP instantly", repeat: true, apply: () => state.player.hp = Math.min(state.player.maxHp, state.player.hp + 55) },
  { id: "bedroll", name: "Ironwood Bedroll", cost: 160, text: "Camp nights are shorter", apply: () => state.items.bedroll = true },
  { id: "lantern", name: "Bluefire Lantern", cost: 210, text: "Night monsters spawn slower", apply: () => state.items.lantern = true },
  { id: "dynamite", name: "Dynamite Bundle", cost: 95, text: "Press Space to blast enemies", repeat: true, stack: "dynamite", apply: () => state.items.dynamite += 1 },
  { id: "bait", name: "Blood Jerky Bait", cost: 80, text: "Press E to distract monsters", repeat: true, stack: "bait", apply: () => state.items.bait += 1 },
  { id: "charm", name: "Coyote Tooth Charm", cost: 260, text: "Bounty rewards +20%", apply: () => state.items.charm = true },
];

const names = [
  ["Rattleskull Bandit", "criminal"],
  ["Cinder Coyote", "monster"],
  ["Red Mesa Ghoul", "monster"],
  ["Black Hat Boone", "criminal"],
  ["Sawtooth Bruiser", "criminal"],
  ["Dust Witch", "monster"],
  ["The Bone Prospector", "monster"],
  ["Velvet Viper Gang", "criminal"],
];

const state = {
  mode: "town",
  coins: 40,
  day: 1,
  time: 10,
  selectedBounty: null,
  completedBounty: null,
  weaponIndex: 0,
  player: {
    x: 160,
    y: 300,
    vx: 0,
    vy: 0,
    r: 14,
    hp: 90,
    maxHp: 90,
    invincible: 0,
  },
  horse: { y: 280, vy: 0, progress: 0, damageCooldown: 0 },
  enemies: [],
  bullets: [],
  enemyShots: [],
  obstacles: [],
  trailHazards: [],
  particles: [],
  baits: [],
  keys: new Set(),
  mouse: { x: 480, y: 300, down: false },
  lastShot: 0,
  lastSpawn: 0,
  campRemaining: 0,
  campRequired: 0,
  nightAnnounced: false,
  items: { boots: false, armor: false, bedroll: false, lantern: false, charm: false, dynamite: 0, bait: 0 },
  lastTime: performance.now(),
  dust: Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    s: 0.35 + Math.random() * 1.8,
  })),
};

let currentBounties = bountyOptions();

function bountyOptions() {
  return Array.from({ length: 3 }, (_, i) => {
    const base = state.day + i + 1;
    const pick = names[(state.day + i) % names.length];
    const monster = pick[1] === "monster";
    return {
      id: `${state.day}-${i}`,
      name: pick[0],
      type: pick[1],
      reward: 80 + base * 34,
      danger: base,
      hp: 130 + base * 44 + (monster ? 35 : 0),
      damage: 14 + base * 4,
      speed: 1.45 + base * 0.1,
      minions: Math.min(12, 3 + Math.floor(base * 0.85)),
      travel: 760 + base * 120,
    };
  });
}

function renderBounties() {
  ui.bountyList.innerHTML = "";
  currentBounties.forEach((bounty) => {
    const item = document.createElement("article");
    item.className = `bounty ${state.selectedBounty?.id === bounty.id ? "selected" : ""}`;
    item.innerHTML = `
      <strong>${bounty.name}</strong>
      <span>${bounty.type.toUpperCase()} | Danger ${bounty.danger} | ${bounty.reward} coins</span>
      <span>${bounty.minions} guards | Long trail | Night risk</span>
      <button type="button">Pin Bounty</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      state.selectedBounty = bounty;
      renderBounties();
      log(`${bounty.name} pinned. The trail will be rough.`);
      updateUi();
    });
    ui.bountyList.appendChild(item);
  });
}

function renderShop() {
  ui.shopList.innerHTML = "";
  weapons.slice(1).forEach((weapon, index) => {
    const realIndex = index + 1;
    const owned = state.weaponIndex >= realIndex;
    addShopCard(weapon.name, `${weapon.damage} damage | ${weapon.cost} coins`, owned ? "Owned" : "Buy", owned || state.coins < weapon.cost, () => {
      state.coins -= weapon.cost;
      state.weaponIndex = realIndex;
      log(`${weapon.name} bought. Stronger bounties will still punish bad aim.`);
      refreshShop();
    });
  });
  storeItems.forEach((item) => {
    const owned = !item.repeat && Boolean(state.items[item.id]);
    const count = item.stack ? ` (${state.items[item.stack]})` : "";
    addShopCard(`${item.name}${count}`, `${item.text} | ${item.cost} coins`, owned ? "Owned" : "Buy", owned || state.coins < item.cost, () => {
      state.coins -= item.cost;
      item.apply();
      log(`${item.name} purchased.`);
      refreshShop();
    });
  });
}

function addShopCard(name, text, label, disabled, onClick) {
  const item = document.createElement("article");
  item.className = "shop-item";
  item.innerHTML = `
    <strong>${name}</strong>
    <span>${text}</span>
    <button type="button" ${disabled ? "disabled" : ""}>${label}</button>
  `;
  item.querySelector("button").addEventListener("click", onClick);
  ui.shopList.appendChild(item);
}

function refreshShop() {
  updateUi();
  renderShop();
}

function updateUi() {
  ui.coins.textContent = Math.floor(state.coins);
  ui.hp.textContent = Math.max(0, Math.ceil(state.player.hp));
  ui.day.textContent = state.day;
  ui.weapon.textContent = weapons[state.weaponIndex].name;
  const timeText = state.time >= 19 || state.time < 6 ? "Night" : state.time >= 17 ? "Dusk" : "Day";
  ui.place.textContent = state.mode === "town"
    ? "Town: choose a bounty, shop, or claim a reward."
    : `${labelForMode()} | ${timeText} ${String(Math.floor(state.time)).padStart(2, "0")}:00`;
  ui.rideOut.disabled = !state.selectedBounty || state.mode !== "town";
  ui.claimReward.disabled = !state.completedBounty || state.mode !== "town";
  ui.sheriffText.textContent = state.completedBounty
    ? `${state.completedBounty.name} is down. Claim ${rewardValue(state.completedBounty)} coins.`
    : "Bring proof of a completed bounty to claim coins.";
}

function labelForMode() {
  if (state.mode === "trail") return "Trail hazards";
  if (state.mode === "camp") return "Night camp";
  return "Wilderness hunt";
}

function rewardValue(bounty) {
  return Math.floor(bounty.reward * (state.items.charm ? 1.2 : 1));
}

function log(message) {
  ui.log.textContent = message;
}

function switchTab(view) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `${view}View`));
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.view));
});

ui.rideOut.addEventListener("click", () => {
  if (state.selectedBounty) enterTrail();
});

ui.claimReward.addEventListener("click", () => {
  if (!state.completedBounty) return;
  state.coins += rewardValue(state.completedBounty);
  state.day += 1;
  state.player.maxHp += 4;
  state.player.hp = state.player.maxHp;
  state.time = 9;
  log(`${state.completedBounty.name} paid out. Harder posters just went up.`);
  state.completedBounty = null;
  state.selectedBounty = null;
  currentBounties = bountyOptions();
  renderBounties();
  refreshShop();
  switchTab("board");
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  state.keys.add(key);
  if (key === " " && state.mode !== "town") useDynamite();
  if (key === "e" && state.mode !== "town") useBait();
});
window.addEventListener("keyup", (event) => state.keys.delete(event.key.toLowerCase()));
canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
  state.mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
});
canvas.addEventListener("mousedown", () => state.mouse.down = true);
window.addEventListener("mouseup", () => state.mouse.down = false);

function enterTrail() {
  state.mode = "trail";
  state.time = 10;
  state.horse = { y: 280, vy: 0, progress: 0, damageCooldown: 0 };
  state.trailHazards = [];
  state.particles = [];
  log("Ride the trail. Dodge rocks, wagons, ravines, and thorn scrub before the fight.");
  updateUi();
}

function enterWilderness() {
  state.mode = "wild";
  state.player.x = 120;
  state.player.y = 285;
  state.player.vx = 0;
  state.player.vy = 0;
  state.bullets = [];
  state.enemyShots = [];
  state.baits = [];
  state.obstacles = makeObstacles();
  state.nightAnnounced = false;
  spawnBountyFight();
  log(`You found ${state.selectedBounty.name}. Keep moving and use cover.`);
  updateUi();
}

function spawnBountyFight() {
  const bounty = state.selectedBounty;
  state.enemies = [{
    boss: true,
    type: bounty.type,
    name: bounty.name,
    x: 790,
    y: 285,
    vx: 0,
    vy: 0,
    r: bounty.type === "monster" ? 25 : 21,
    hp: bounty.hp,
    maxHp: bounty.hp,
    damage: bounty.damage,
    speed: bounty.speed,
    cooldown: 450,
    mood: "hunt",
  }];
  for (let i = 0; i < bounty.minions; i += 1) {
    spawnEnemy(i % 3 === 0 ? "rifleman" : i % 3 === 1 ? "charger" : "monster", false);
  }
}

function spawnEnemy(kind, night) {
  const edge = Math.random() < 0.5 ? -30 : canvas.width + 30;
  const hp = (night ? 38 : 48) + state.day * (night ? 10 : 14);
  state.enemies.push({
    boss: false,
    type: kind,
    name: night ? "Night Stalker" : kind === "rifleman" ? "Rifle Guard" : kind === "charger" ? "Knife Rider" : "Dust Fiend",
    x: edge,
    y: 70 + Math.random() * 430,
    vx: 0,
    vy: 0,
    r: kind === "charger" ? 13 : 15,
    hp,
    maxHp: hp,
    damage: (night ? 11 : 9) + state.day * 2.4,
    speed: (kind === "charger" ? 2.35 : 1.55) + state.day * 0.075 + (night ? 0.25 : 0),
    cooldown: 500 + Math.random() * 1000,
    mood: kind === "rifleman" ? "kite" : "hunt",
  });
}

function makeObstacles() {
  return [
    { x: 245, y: 128, w: 86, h: 62, kind: "boulder" },
    { x: 404, y: 342, w: 118, h: 46, kind: "wagon" },
    { x: 615, y: 160, w: 72, h: 116, kind: "cactus" },
    { x: 190, y: 424, w: 95, h: 42, kind: "scrub" },
    { x: 735, y: 385, w: 112, h: 58, kind: "boulder" },
  ];
}

function updateTrail(dt) {
  const seconds = dt / 1000;
  state.time += seconds * 0.85;
  state.horse.progress += 82 * seconds;
  state.horse.damageCooldown = Math.max(0, state.horse.damageCooldown - dt);
  let input = 0;
  if (state.keys.has("w") || state.keys.has("arrowup")) input -= 1;
  if (state.keys.has("s") || state.keys.has("arrowdown")) input += 1;
  state.horse.vy += input * 0.44;
  state.horse.vy *= 0.9;
  state.horse.y = clamp(state.horse.y + state.horse.vy * 5, 86, 492);

  if (Math.random() < 0.035 + state.day * 0.004) spawnTrailHazard();
  state.trailHazards.forEach((hazard) => {
    hazard.x -= hazard.speed * seconds;
    if (circleRect({ x: 150, y: state.horse.y, r: 18 }, hazard) && state.horse.damageCooldown <= 0) {
      state.horse.damageCooldown = 700;
      hurtPlayer(hazard.damage, false);
      burst(150, state.horse.y, "#f2c36c", 14);
    }
  });
  state.trailHazards = state.trailHazards.filter((hazard) => hazard.x + hazard.w > -40);

  if (state.horse.progress >= state.selectedBounty.travel) enterWilderness();
  if (state.time >= 19) startCamp();
}

function spawnTrailHazard() {
  const kinds = [
    { kind: "rock", w: 42, h: 36, damage: 11 },
    { kind: "wagon", w: 82, h: 48, damage: 18 },
    { kind: "ravine", w: 58, h: 118, damage: 24 },
    { kind: "thorn", w: 70, h: 34, damage: 13 },
  ];
  const pick = kinds[Math.floor(Math.random() * kinds.length)];
  state.trailHazards.push({
    ...pick,
    x: canvas.width + 40,
    y: 80 + Math.random() * 400,
    speed: 255 + state.day * 18 + Math.random() * 80,
  });
}

function startCamp() {
  state.mode = "camp";
  state.campRequired = state.items.bedroll ? 15000 : 22000;
  state.campRemaining = state.campRequired;
  state.player.x = 480;
  state.player.y = 300;
  state.player.vx = 0;
  state.player.vy = 0;
  state.enemies = [];
  state.bullets = [];
  state.enemyShots = [];
  state.obstacles = makeObstacles();
  state.lastSpawn = 0;
  log("Night caught you on the trail. Hold camp until sunrise.");
  updateUi();
}

function updateWild(now, dt) {
  advanceTime(dt);
  movePlayer(dt);
  shoot(now);
  updateProjectiles();
  updateEnemies(now, dt);
  updateBaits(dt);
  updateParticles();
  resolveHits();
  cleanupCombat();
  if (state.time >= 19 && !state.completedBounty) startCamp();
  if (state.enemies.every((enemy) => !enemy.boss) && state.mode === "wild") completeBounty();
}

function updateCamp(now, dt) {
  state.time = 23;
  state.campRemaining -= dt;
  movePlayer(dt);
  shoot(now);
  updateProjectiles();
  updateEnemies(now, dt);
  updateBaits(dt);
  updateParticles();
  resolveHits();
  cleanupCombat();
  const spawnRate = state.items.lantern ? 1450 : 980;
  if (now - state.lastSpawn > Math.max(420, spawnRate - state.day * 45)) {
    state.lastSpawn = now;
    spawnEnemy(Math.random() < 0.55 ? "charger" : "monster", true);
  }
  if (state.campRemaining <= 0) {
    state.mode = state.horse.progress >= state.selectedBounty.travel ? "wild" : "trail";
    state.time = 6;
    state.enemies = [];
    state.bullets = [];
    state.enemyShots = [];
    log("Sunrise. The trail is open again.");
    updateUi();
  }
}

function advanceTime(dt) {
  state.time += (dt / 1000) * 0.33;
  if (state.time >= 18 && !state.nightAnnounced) {
    state.nightAnnounced = true;
    log("Dusk is falling. Finish fast or you will have to camp.");
  }
}

function movePlayer(dt) {
  const p = state.player;
  const seconds = dt / 16.67;
  let ax = 0;
  let ay = 0;
  if (state.keys.has("w") || state.keys.has("arrowup")) ay -= 1;
  if (state.keys.has("s") || state.keys.has("arrowdown")) ay += 1;
  if (state.keys.has("a") || state.keys.has("arrowleft")) ax -= 1;
  if (state.keys.has("d") || state.keys.has("arrowright")) ax += 1;
  const len = Math.hypot(ax, ay) || 1;
  const accel = state.items.boots ? 0.62 : 0.54;
  p.vx += (ax / len) * accel * seconds;
  p.vy += (ay / len) * accel * seconds;
  p.vx *= state.items.boots ? 0.86 : 0.82;
  p.vy *= state.items.boots ? 0.86 : 0.82;
  const max = state.items.boots ? 4.9 : 4.25;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > max) {
    p.vx = (p.vx / speed) * max;
    p.vy = (p.vy / speed) * max;
  }
  p.x += p.vx * seconds;
  p.y += p.vy * seconds;
  p.x = clamp(p.x, 24, canvas.width - 24);
  p.y = clamp(p.y, 52, canvas.height - 28);
  collideObstacles(p);
  p.invincible = Math.max(0, p.invincible - dt);
}

function shoot(now) {
  const weapon = weapons[state.weaponIndex];
  if (!state.mouse.down || now - state.lastShot < weapon.rate) return;
  state.lastShot = now;
  const shots = weapon.pellets || 1;
  for (let i = 0; i < shots; i += 1) {
    const angle = Math.atan2(state.mouse.y - state.player.y, state.mouse.x - state.player.x)
      + (Math.random() - 0.5) * weapon.spread;
    state.bullets.push({
      x: state.player.x,
      y: state.player.y,
      vx: Math.cos(angle) * weapon.speed + state.player.vx * 0.25,
      vy: Math.sin(angle) * weapon.speed + state.player.vy * 0.25,
      r: shots > 1 ? 3 : 4,
      damage: weapon.damage,
      life: weapon.range,
    });
  }
  const recoil = Math.atan2(state.mouse.y - state.player.y, state.mouse.x - state.player.x) + Math.PI;
  state.player.vx += Math.cos(recoil) * weapon.kick;
  state.player.vy += Math.sin(recoil) * weapon.kick;
}

function enemyShoot(enemy) {
  const lead = 13 + state.day * 0.8;
  const targetX = state.player.x + state.player.vx * lead;
  const targetY = state.player.y + state.player.vy * lead;
  const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x) + (Math.random() - 0.5) * 0.12;
  state.enemyShots.push({
    x: enemy.x,
    y: enemy.y,
    vx: Math.cos(angle) * (enemy.boss ? 5.3 : 4.4),
    vy: Math.sin(angle) * (enemy.boss ? 5.3 : 4.4),
    r: enemy.boss ? 6 : 5,
    damage: enemy.damage,
    life: 130,
  });
}

function updateProjectiles() {
  [...state.bullets, ...state.enemyShots].forEach((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.vx *= 0.996;
    bullet.vy *= 0.996;
    bullet.life -= 1;
    if (state.obstacles.some((obstacle) => circleRect(bullet, obstacle))) {
      bullet.life = 0;
      burst(bullet.x, bullet.y, "#d8b070", 5);
    }
  });
}

function updateEnemies(now, dt) {
  state.enemies.forEach((enemy) => {
    const bait = nearestBait(enemy);
    const target = bait || state.player;
    const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
    const desired = enemy.mood === "kite" && distance < 210 ? -0.65 : 1;
    enemy.vx += Math.cos(angle) * enemy.speed * 0.04 * desired;
    enemy.vy += Math.sin(angle) * enemy.speed * 0.04 * desired;
    enemy.vx *= 0.88;
    enemy.vy *= 0.88;
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;
    enemy.x = clamp(enemy.x, 24, canvas.width - 24);
    enemy.y = clamp(enemy.y, 52, canvas.height - 28);
    collideObstacles(enemy);
    enemy.cooldown -= dt;
    const canShoot = enemy.type !== "charger" && distance < 430 && !bait;
    if (canShoot && enemy.cooldown <= 0) {
      enemyShoot(enemy);
      enemy.cooldown = enemy.boss ? Math.max(360, 760 - state.day * 35) : Math.max(600, 1150 - state.day * 45);
    }
    if (distance < enemy.r + state.player.r + 3 && !bait) hurtPlayer(enemy.damage, true);
  });
}

function updateBaits(dt) {
  state.baits.forEach((bait) => bait.life -= dt);
  state.baits = state.baits.filter((bait) => bait.life > 0);
}

function resolveHits() {
  state.bullets.forEach((bullet) => {
    state.enemies.forEach((enemy) => {
      if (bullet.life > 0 && enemy.hp > 0 && hit(bullet, enemy)) {
        enemy.hp -= bullet.damage;
        bullet.life = 0;
        enemy.vx += bullet.vx * 0.1;
        enemy.vy += bullet.vy * 0.1;
        burst(bullet.x, bullet.y, enemy.boss ? "#e7cf73" : "#b84538", 7);
      }
    });
  });
  state.enemyShots.forEach((shot) => {
    if (shot.life > 0 && hit(shot, state.player)) {
      shot.life = 0;
      hurtPlayer(shot.damage, true);
    }
  });
}

function cleanupCombat() {
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  state.bullets = state.bullets.filter((bullet) => bullet.life > 0 && inBounds(bullet));
  state.enemyShots = state.enemyShots.filter((shot) => shot.life > 0 && inBounds(shot));
}

function completeBounty() {
  state.completedBounty = state.selectedBounty;
  state.mode = "town";
  state.enemies = [];
  state.bullets = [];
  state.enemyShots = [];
  state.baits = [];
  log(`${state.completedBounty.name} is defeated. Report to the sheriff before spending the reward.`);
  updateUi();
  switchTab("sheriff");
}

function hurtPlayer(amount, invincible) {
  if (invincible && state.player.invincible > 0) return;
  const damage = amount * (state.items.armor ? 0.82 : 1);
  state.player.hp -= damage;
  state.player.invincible = invincible ? 460 : 0;
  updateUi();
  if (state.player.hp <= 0) {
    state.mode = "town";
    state.player.hp = Math.max(28, Math.floor(state.player.maxHp * 0.45));
    state.coins = Math.max(0, state.coins - 35);
    state.enemies = [];
    state.bullets = [];
    state.enemyShots = [];
    state.trailHazards = [];
    state.completedBounty = null;
    log("You barely made it back alive. Lost 35 coins and the bounty escaped.");
    updateUi();
  }
}

function useDynamite() {
  if (state.items.dynamite <= 0) return;
  state.items.dynamite -= 1;
  const x = state.mouse.x;
  const y = state.mouse.y;
  state.enemies.forEach((enemy) => {
    const distance = Math.hypot(enemy.x - x, enemy.y - y);
    if (distance < 118) {
      enemy.hp -= 120 * (1 - distance / 140);
      enemy.vx += (enemy.x - x) * 0.045;
      enemy.vy += (enemy.y - y) * 0.045;
    }
  });
  burst(x, y, "#ffb13b", 36);
  log("Dynamite thrown.");
  refreshShop();
}

function useBait() {
  if (state.items.bait <= 0) return;
  state.items.bait -= 1;
  state.baits.push({ x: state.player.x, y: state.player.y, r: 18, life: 6500 });
  log("Bait dropped. Monsters will chase it for a moment.");
  refreshShop();
}

function collideObstacles(entity) {
  state.obstacles.forEach((obstacle) => {
    if (!circleRect(entity, obstacle)) return;
    const cx = clamp(entity.x, obstacle.x, obstacle.x + obstacle.w);
    const cy = clamp(entity.y, obstacle.y, obstacle.y + obstacle.h);
    const angle = Math.atan2(entity.y - cy, entity.x - cx) || 0.1;
    entity.x = cx + Math.cos(angle) * (entity.r + 1);
    entity.y = cy + Math.sin(angle) * (entity.r + 1);
    entity.vx *= -0.22;
    entity.vy *= -0.22;
  });
}

function nearestBait(enemy) {
  let best = null;
  let bestDistance = Infinity;
  state.baits.forEach((bait) => {
    const distance = Math.hypot(enemy.x - bait.x, enemy.y - bait.y);
    if (distance < bestDistance && distance < 260) {
      best = bait;
      bestDistance = distance;
    }
  });
  return best;
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 25 + Math.random() * 25, color });
  }
}

function updateParticles() {
  state.particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.94;
    particle.vy *= 0.94;
    particle.life -= 1;
  });
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function drawTown() {
  drawSky(false);
  drawGround();
  drawBuilding(70, 255, 215, 175, "SHERIFF", "#7e3f24");
  drawBuilding(348, 225, 252, 205, "BOUNTIES", "#9b5b2d");
  drawBuilding(675, 265, 215, 165, "GUNSMITH", "#5f4731");
  drawHorse(515, 480, 1);
  drawHunter(480, 455, 1);
  drawTextPlate("Choose carefully. The trail and night are deadlier now.", 250, 42, 500);
}

function drawTrail() {
  drawSky(state.time >= 18);
  drawGround();
  drawTrailRoad();
  state.trailHazards.forEach(drawTrailHazard);
  drawHorse(150, state.horse.y, state.horse.damageCooldown > 0 ? 0.55 : 1);
  drawTextPlate(`Trail progress ${Math.floor((state.horse.progress / state.selectedBounty.travel) * 100)}%`, 36, 34, 250);
}

function drawWild() {
  drawSky(state.time >= 18 || state.mode === "camp");
  drawGround();
  drawCacti();
  drawDust();
  drawObstacles();
  state.baits.forEach((bait) => drawCircle(bait.x, bait.y, bait.r, "rgba(140, 35, 32, 0.65)"));
  state.bullets.forEach((bullet) => drawCircle(bullet.x, bullet.y, bullet.r, "#ffd15a"));
  state.enemyShots.forEach((shot) => drawCircle(shot.x, shot.y, shot.r, "#8fd6ff"));
  state.enemies.forEach(drawEnemy);
  drawHunter(state.player.x, state.player.y, state.player.invincible > 0 ? 0.55 : 1);
  drawParticles();
  drawReticle();
  if (state.mode === "camp") drawTextPlate(`Camp until sunrise: ${Math.ceil(state.campRemaining / 1000)}s`, 36, 34, 260);
  else drawTextPlate("Use rocks and wagons for cover. Do not let dusk catch you.", 36, 34, 505);
}

function drawSky(night) {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (night) {
    sky.addColorStop(0, "#101827");
    sky.addColorStop(0.55, "#26394b");
    sky.addColorStop(1, "#744727");
  } else {
    sky.addColorStop(0, "#6fa6b6");
    sky.addColorStop(0.42, "#e7a665");
    sky.addColorStop(1, "#b66c36");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = night ? "#ddd8bc" : "#f7d472";
  ctx.beginPath();
  ctx.arc(790, 85, night ? 30 : 42, 0, Math.PI * 2);
  ctx.fill();
  if (night) drawStars();
  drawMesas();
}

function drawStars() {
  ctx.fillStyle = "rgba(255, 246, 223, 0.8)";
  for (let i = 0; i < 55; i += 1) {
    const x = (i * 79) % canvas.width;
    const y = 18 + ((i * 41) % 165);
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawMesas() {
  ctx.fillStyle = "#633a25";
  ctx.beginPath();
  ctx.moveTo(0, 295);
  ctx.lineTo(120, 178);
  ctx.lineTo(245, 178);
  ctx.lineTo(300, 295);
  ctx.lineTo(460, 190);
  ctx.lineTo(630, 295);
  ctx.lineTo(780, 158);
  ctx.lineTo(960, 295);
  ctx.closePath();
  ctx.fill();
}

function drawGround() {
  ctx.fillStyle = "#b87536";
  ctx.fillRect(0, 300, canvas.width, 260);
  ctx.strokeStyle = "rgba(66, 38, 23, 0.34)";
  ctx.lineWidth = 2;
  for (let y = 320; y < 560; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(220, y + 20, 480, y - 22, 960, y + 9);
    ctx.stroke();
  }
}

function drawTrailRoad() {
  ctx.fillStyle = "rgba(78, 45, 27, 0.35)";
  ctx.beginPath();
  ctx.moveTo(0, 96);
  ctx.lineTo(960, 64);
  ctx.lineTo(960, 520);
  ctx.lineTo(0, 492);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 231, 184, 0.45)";
  ctx.setLineDash([18, 18]);
  ctx.beginPath();
  ctx.moveTo(0, 280);
  ctx.lineTo(960, 280);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBuilding(x, y, w, h, label, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#3b2011";
  ctx.fillRect(x - 12, y - 18, w + 24, 24);
  ctx.fillStyle = "#f5ce8a";
  ctx.fillRect(x + 24, y + 40, 52, 52);
  ctx.fillRect(x + w - 76, y + 40, 52, 52);
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(x + w / 2 - 25, y + h - 78, 50, 78);
  ctx.fillStyle = "#f7dca8";
  ctx.font = "bold 22px Georgia";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + 5);
}

function drawObstacles() {
  state.obstacles.forEach((o) => {
    if (o.kind === "wagon") {
      ctx.fillStyle = "#674024";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      drawCircle(o.x + 18, o.y + o.h + 3, 12, "#21130d");
      drawCircle(o.x + o.w - 18, o.y + o.h + 3, 12, "#21130d");
    } else if (o.kind === "cactus") {
      ctx.fillStyle = "#2c6f48";
      ctx.fillRect(o.x + 25, o.y, 22, o.h);
      ctx.fillRect(o.x, o.y + 35, o.w, 20);
    } else {
      ctx.fillStyle = o.kind === "scrub" ? "#59612d" : "#6a5846";
      roundRect(o.x, o.y, o.w, o.h, 16);
      ctx.fill();
    }
  });
}

function drawTrailHazard(h) {
  if (h.kind === "ravine") {
    ctx.fillStyle = "#2a1810";
    roundRect(h.x, h.y, h.w, h.h, 18);
    ctx.fill();
    ctx.strokeStyle = "#d09a5d";
    ctx.lineWidth = 3;
    ctx.stroke();
    return;
  }
  if (h.kind === "wagon") {
    ctx.fillStyle = "#5c3820";
    ctx.fillRect(h.x, h.y, h.w, h.h);
    drawCircle(h.x + 15, h.y + h.h, 11, "#1d120c");
    drawCircle(h.x + h.w - 15, h.y + h.h, 11, "#1d120c");
    return;
  }
  ctx.fillStyle = h.kind === "thorn" ? "#53652d" : "#67533f";
  roundRect(h.x, h.y, h.w, h.h, 12);
  ctx.fill();
}

function drawCacti() {
  [[128, 365], [860, 345], [710, 445]].forEach(([x, y]) => {
    ctx.strokeStyle = "#286543";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + 60);
    ctx.lineTo(x, y);
    ctx.moveTo(x, y + 32);
    ctx.lineTo(x - 28, y + 32);
    ctx.lineTo(x - 28, y + 12);
    ctx.moveTo(x, y + 42);
    ctx.lineTo(x + 28, y + 42);
    ctx.lineTo(x + 28, y + 20);
    ctx.stroke();
  });
  ctx.lineCap = "butt";
}

function drawDust() {
  ctx.fillStyle = "rgba(255, 223, 157, 0.3)";
  state.dust.forEach((dust) => {
    dust.x -= dust.s;
    if (dust.x < -8) dust.x = canvas.width + 8;
    ctx.fillRect(dust.x, dust.y, 18, 2);
  });
}

function drawHorse(x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#4b2a19";
  roundRect(x - 34, y - 16, 68, 32, 16);
  ctx.fill();
  drawCircle(x + 38, y - 20, 14, "#4b2a19");
  ctx.strokeStyle = "#2b180f";
  ctx.lineWidth = 5;
  for (const lx of [-22, -8, 14, 28]) {
    ctx.beginPath();
    ctx.moveTo(x + lx, y + 12);
    ctx.lineTo(x + lx + Math.sin(performance.now() / 110 + lx) * 9, y + 35);
    ctx.stroke();
  }
  drawHunter(x - 2, y - 28, alpha);
  ctx.restore();
}

function drawHunter(x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#1d1510";
  ctx.beginPath();
  ctx.arc(x, y - 12, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7b431e";
  ctx.fillRect(x - 19, y - 29, 38, 7);
  ctx.fillStyle = "#263b52";
  roundRect(x - 11, y, 22, 28, 6);
  ctx.fill();
  ctx.fillStyle = "#f0c08a";
  ctx.beginPath();
  ctx.arc(x, y - 8, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#21130d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 8);
  ctx.lineTo(x + 27, y + 3);
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(enemy) {
  const color = enemy.boss ? "#813139" : enemy.type === "monster" || enemy.type === "charger" ? "#3c4731" : "#3c2c28";
  drawCircle(enemy.x, enemy.y, enemy.r, color);
  ctx.fillStyle = enemy.type === "rifleman" ? "#19100c" : "#141b15";
  ctx.fillRect(enemy.x - enemy.r * 0.8, enemy.y - enemy.r * 0.2, enemy.r * 1.6, enemy.r * 0.5);
  ctx.fillStyle = "#19100c";
  ctx.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 15, enemy.r * 2, 5);
  ctx.fillStyle = enemy.boss ? "#e8d16b" : "#bf5b43";
  ctx.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 15, enemy.r * 2 * Math.max(0, enemy.hp / enemy.maxHp), 5);
  if (enemy.boss) {
    ctx.fillStyle = "#f7dca8";
    ctx.font = "bold 13px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(enemy.name, enemy.x, enemy.y - enemy.r - 23);
  }
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life / 45);
    drawCircle(particle.x, particle.y, 2.5, particle.color);
    ctx.globalAlpha = 1;
  });
}

function drawReticle() {
  ctx.strokeStyle = "#fff6df";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(state.mouse.x, state.mouse.y, 11, 0, Math.PI * 2);
  ctx.moveTo(state.mouse.x - 16, state.mouse.y);
  ctx.lineTo(state.mouse.x - 7, state.mouse.y);
  ctx.moveTo(state.mouse.x + 7, state.mouse.y);
  ctx.lineTo(state.mouse.x + 16, state.mouse.y);
  ctx.stroke();
}

function drawTextPlate(text, x, y, width) {
  ctx.fillStyle = "rgba(35, 21, 13, 0.78)";
  roundRect(x, y, width, 38, 5);
  ctx.fill();
  ctx.fillStyle = "#fff6df";
  ctx.font = "bold 18px Georgia";
  ctx.textAlign = "left";
  ctx.fillText(text, x + 14, y + 25);
}

function drawCircle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hit(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
}

function circleRect(circle, rect) {
  const x = clamp(circle.x, rect.x, rect.x + rect.w);
  const y = clamp(circle.y, rect.y, rect.y + rect.h);
  return Math.hypot(circle.x - x, circle.y - y) < circle.r;
}

function inBounds(entity) {
  return entity.x > -60 && entity.x < canvas.width + 60 && entity.y > -60 && entity.y < canvas.height + 60;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loop(now) {
  const dt = Math.min(34, now - state.lastTime);
  state.lastTime = now;
  if (state.mode === "trail") updateTrail(dt);
  if (state.mode === "wild") updateWild(now, dt);
  if (state.mode === "camp") updateCamp(now, dt);
  if (state.mode === "town") drawTown();
  if (state.mode === "trail") drawTrail();
  if (state.mode === "wild" || state.mode === "camp") drawWild();
  requestAnimationFrame(loop);
}

renderBounties();
renderShop();
updateUi();
log("The board is meaner now. Buy gear before you ride.");
requestAnimationFrame(loop);
