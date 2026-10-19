(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 90;
  const CEILING_Y = 56;
  const PLAYER_SIZE = 36;
  const COYOTE = 0.2;
  const JUMP_BUFFER = 0.22;
  const Music = window.GeoMusic;

  const PORTAL = {
    cube: { color: "#7cff3d", edge: "#d4ff9a", label: "КУБ" },
    ship: { color: "#ff66cc", edge: "#ffc0ea", label: "КОРАБЛЬ" },
    ball: { color: "#ffe66d", edge: "#fff6c2", label: "ШАР" },
    ufo: { color: "#ff9a3d", edge: "#ffd0a0", label: "НЛО" },
    wave: { color: "#3de8ff", edge: "#b6f4ff", label: "ВОЛНА" },
  };

  const DIFF_FACE = {
    easy: "🙂", normal: "😐", hard: "😠", insane: "😈",
    demon: "👿", extreme: "💀", super: "☠️",
  };

  const progressEl = document.getElementById("progress");
  const bestEl = document.getElementById("best");
  const attemptsEl = document.getElementById("attempts");
  const fail = document.getElementById("fail");
  const win = document.getElementById("win");
  const failMsg = document.getElementById("failMsg");
  const levelNameEl = document.getElementById("levelName");
  const levelGrid = document.getElementById("levelGrid");
  const winMsg = document.getElementById("winMsg");

  const LEVELS = window.createGeoLevels(GROUND_Y, CEILING_Y);
  let levelFilter = "all";

  function makeApi() {
    const objs = [];
    return {
      objs,
      addSpike: (x, n = 1, ceil = false) => {
        for (let i = 0; i < n; i++) {
          objs.push({ type: "spike", x: x + i * 34, y: ceil ? CEILING_Y : GROUND_Y, ceil });
        }
      },
      addBlock: (x, yOff = 0, w = 40, h = 40) => {
        objs.push({ type: "block", x, y: GROUND_Y - yOff - h, w, h });
      },
      addPad: (x) => objs.push({ type: "pad", x, y: GROUND_Y - 8, w: 44, h: 10 }),
      addOrb: (x, y) => objs.push({ type: "orb", x, y, r: 20 }),
      addGap: (x, w) => objs.push({ type: "gap", x, w }),
      addPortal: (x, mode) => {
        objs.push({ type: "portal", x, y: GROUND_Y - 140, w: 36, h: 140, mode });
      },
      finish: (x) => {
        objs.push({ type: "finish", x, y: GROUND_Y - 120, w: 20, h: 120 });
        return { objs, length: x + 400 };
      },
    };
  }

  let currentLevel = LEVELS[0];
  let levelData = null;
  let SPEED = currentLevel.speed;
  let GRAVITY = currentLevel.gravity;
  let JUMP_V = currentLevel.jump;
  let theme = currentLevel.theme;
  let coyoteNow = COYOTE;
  let hitForgive = 1;

  const state = {
    running: false, dead: false, won: false, attempts: 1,
    camX: 0, player: null, particles: [], trail: [],
    flash: 0, shake: 0, pulse: 0, raf: 0, holding: false, time: 0,
  };

  function saveKey(id) { return "geo_best_" + id; }
  function clearedKey(id) { return "geo_cleared_" + id; }
  function getBest(id) { return Number(localStorage.getItem(saveKey(id)) || 0); }
  function isCleared(id) { return localStorage.getItem(clearedKey(id)) === "1"; }

  function makePlayer() {
    return {
      x: 160, y: GROUND_Y - PLAYER_SIZE, vx: SPEED, vy: 0,
      onGround: true, rot: 0, buffer: 0, coyote: 0,
      mode: "cube", gravDir: 1, portalCd: 0, size: PLAYER_SIZE,
    };
  }

  function sfx(kind) { if (Music) Music.sfx(kind); }

  function setMode(p, mode) {
    if (p.mode === mode) return;
    p.mode = mode;
    p.gravDir = 1;
    p.vy = 0;
    p.onGround = false;
    p.buffer = 0;
    p.portalCd = 0.35;
    if (mode === "cube" || mode === "ufo") {
      if (p.y + p.size > GROUND_Y) p.y = GROUND_Y - p.size;
    }
    if (mode === "ship" || mode === "ufo" || mode === "wave") {
      p.y = Math.min(p.y, GROUND_Y - p.size - 40);
      p.y = Math.max(p.y, CEILING_Y + 20);
    }
    if (mode === "ball") { p.y = GROUND_Y - p.size; p.onGround = true; }
    spawnModeFx(p.x + p.size / 2, p.y + p.size / 2, mode);
    sfx("portal");
  }

  function spawnModeFx(x, y, mode) {
    const c = PORTAL[mode].color;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 90 + Math.random() * 220;
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, color: c, size: 3 + Math.random() * 3 });
    }
  }

  function syncMuteButtons() {
    const muted = Music && Music.isMuted();
    const label = muted ? "🔇" : "🔊";
    ["btnMute", "btnMuteGame"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = label;
    });
    const ml = document.getElementById("btnMuteLevels");
    if (ml) ml.textContent = (muted ? "🔇" : "🔊") + " МУЗЫКА";
  }

  function loadLevel(def) {
    currentLevel = def;
    SPEED = def.speed;
    GRAVITY = def.gravity;
    JUMP_V = def.jump;
    theme = def.theme;
    coyoteNow = COYOTE * (def.coyoteScale != null ? def.coyoteScale : 1);
    hitForgive = def.hitForgive != null ? def.hitForgive : 1;
    levelData = def.build(makeApi());
    levelNameEl.textContent = (DIFF_FACE[def.diff] || "") + " " + def.name;
    bestEl.textContent = "рекорд: " + getBest(def.id) + "%";
    progressEl.textContent = "0%";
    state.attempts = 1;
    attemptsEl.textContent = "попытка 1";
    document.getElementById("game").style.borderColor = theme.line;
  }

  function showScreen(id) {
    ["menu", "levels", "howto", "play"].forEach((s) => {
      document.getElementById(s).classList.toggle("hidden", s !== id);
    });
  }

  function goMenu() {
    state.running = false;
    state.holding = false;
    if (Music) Music.stop();
    fail.classList.add("hidden");
    win.classList.add("hidden");
    showScreen("menu");
  }

  function goLevels() {
    state.running = false;
    state.holding = false;
    if (Music) Music.stop();
    fail.classList.add("hidden");
    win.classList.add("hidden");
    renderLevelGrid();
    showScreen("levels");
  }

  function renderLevelGrid() {
    levelGrid.innerHTML = "";
    const list = levelFilter === "all" ? LEVELS : LEVELS.filter((l) => l.diff === levelFilter);
    list.forEach((lv) => {
      const best = getBest(lv.id);
      const cleared = isCleared(lv.id);
      const card = document.createElement("button");
      card.className = "level-card";
      if (lv.diff === "demon") card.classList.add("demon-card");
      if (lv.diff === "extreme") card.classList.add("extreme-card");
      if (lv.diff === "super") card.classList.add("super-card");
      card.type = "button";
      card.innerHTML = `
        <div class="preview" style="background:${lv.theme.card}">
          <span class="face">${DIFF_FACE[lv.diff] || ""}</span>
          <div class="spike" style="left:70px;border-bottom-color:${lv.theme.spike}"></div>
          <div class="spike" style="left:100px;border-bottom-color:${lv.theme.spike}"></div>
        </div>
        <div class="body">
          <div class="name">${lv.name}</div>
          <div class="meta">
            <span class="diff ${lv.diff}">${lv.diffLabel}</span>
            <span>${cleared ? "✓ 100%" : best + "%"}</span>
          </div>
          <div class="style-tag">${lv.style || ""}</div>
        </div>
        ${cleared ? '<span class="cleared">ПРОЙДЕН</span>' : ""}
      `;
      card.onclick = () => startLevel(lv);
      levelGrid.appendChild(card);
    });
  }

  function startLevel(def) {
    loadLevel(def);
    showScreen("play");
    state.running = true;
    resetRun();
    if (Music) {
      Music.ensure();
      Music.start(def.music || def.diff);
    }
    last = performance.now();
    cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(loop);
  }

  function resetRun() {
    state.dead = false;
    state.won = false;
    state.camX = 0;
    state.holding = false;
    state.player = makePlayer();
    state.particles = [];
    state.trail = [];
    state.flash = 0;
    state.shake = 0;
    fail.classList.add("hidden");
    win.classList.add("hidden");
    attemptsEl.textContent = "попытка " + state.attempts;
    progressEl.textContent = "0%";
  }

  function doCubeJump(p) {
    p.vy = JUMP_V * p.gravDir;
    p.onGround = false;
    p.coyote = 0;
    p.buffer = 0;
    spawnDust(p.x + p.size / 2, p.gravDir > 0 ? GROUND_Y : CEILING_Y);
    sfx("jump");
  }

  function pressAction() {
    if (!state.running || state.dead || state.won || !state.player) return;
    const p = state.player;
    if (p.mode === "cube") {
      if (p.onGround || p.coyote > 0) doCubeJump(p);
      else p.buffer = JUMP_BUFFER;
    } else if (p.mode === "ball") {
      p.gravDir *= -1;
      p.onGround = false;
      p.vy = -200 * p.gravDir;
      sfx("jump");
    } else if (p.mode === "ufo") {
      p.vy = JUMP_V * 0.78;
      p.onGround = false;
      sfx("jump");
      spawnDust(p.x + p.size / 2, p.y + p.size);
    }
  }

  function spawnDust(x, y) {
    for (let i = 0; i < 8; i++) {
      state.particles.push({
        x, y, vx: (Math.random() - 0.5) * 180, vy: -Math.random() * 220,
        life: 0.35 + Math.random() * 0.2, color: theme.player, size: 3,
      });
    }
  }

  function spawnCrash(x, y) {
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 140 + Math.random() * 320;
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.55 + Math.random() * 0.4, color: i % 2 ? theme.spike : theme.player, size: 4,
      });
    }
    state.flash = 0.4;
    state.shake = 0.45;
    sfx("die");
  }

  function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function spikeHit(px, py, pw, ph, sx, sy, ceil) {
    // hitForgive < 1 = bigger (harsher) hitbox on demon+
    const f = hitForgive;
    const inset = Math.floor(4 + 8 * f);
    const shrink = Math.floor(8 + 16 * f);
    if (ceil) return rectHit(px + inset, py + Math.floor(2 + 4 * f), pw - shrink, ph - Math.floor(8 + 8 * f), sx + Math.floor(6 + 4 * f), sy, Math.floor(22 - 8 * f), Math.floor(34 - 10 * f));
    const tipY = sy - 34;
    return rectHit(px + inset, py + inset, pw - shrink, ph - Math.floor(10 + 8 * f), sx + Math.floor(6 + 4 * f), tipY + Math.floor(2 + 6 * f), Math.floor(22 - 8 * f), sy - tipY - Math.floor(4 + 6 * f));
  }

  function die() {
    if (state.dead || state.won) return;
    state.dead = true;
    state.holding = false;
    const pct = Math.floor((state.camX / levelData.length) * 100);
    if (pct > getBest(currentLevel.id)) {
      localStorage.setItem(saveKey(currentLevel.id), String(pct));
      bestEl.textContent = "рекорд: " + pct + "%";
    }
    spawnCrash(state.player.x + state.player.size / 2, state.player.y + state.player.size / 2);
    failMsg.textContent = pct + "% пройдено";
    setTimeout(() => fail.classList.remove("hidden"), 280);
  }

  function doWin() {
    if (state.won) return;
    state.won = true;
    state.holding = false;
    localStorage.setItem(saveKey(currentLevel.id), "100");
    localStorage.setItem(clearedKey(currentLevel.id), "1");
    bestEl.textContent = "рекорд: 100%";
    const idx = LEVELS.findIndex((l) => l.id === currentLevel.id);
    const next = LEVELS[idx + 1];
    winMsg.textContent = next ? "Дальше: " + next.name : "Все локации пройдены!";
    document.getElementById("btnNext").style.display = next ? "" : "none";
    win.classList.remove("hidden");
    sfx("win");
  }

  function needsCeiling(mode) {
    return mode === "ship" || mode === "ball" || mode === "ufo" || mode === "wave";
  }

  function update(dt) {
    if (!state.running || !state.player) return;
    state.time += dt;
    state.pulse = 0.5 + 0.5 * Math.sin(state.time * (currentLevel.music === "super" ? 14 : 10));
    state.shake = Math.max(0, state.shake - dt);

    if (state.dead || state.won) {
      for (const p of state.particles) {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt;
      }
      state.particles = state.particles.filter((p) => p.life > 0);
      state.flash = Math.max(0, state.flash - dt);
      return;
    }

    const p = state.player;
    const mode = p.mode;
    p.portalCd = Math.max(0, p.portalCd - dt);
    p.x += p.vx * dt;
    p.buffer = Math.max(0, p.buffer - dt);

    // trail
    state.trail.push({ x: p.x + p.size / 2, y: p.y + p.size / 2, life: 0.28, mode });
    state.trail = state.trail.filter((t) => { t.life -= dt; return t.life > 0; });

    if (mode === "ship") {
      const thrust = state.holding ? -2600 : 0;
      p.vy += (GRAVITY * 0.42 + thrust) * dt;
      p.vy = Math.max(-680, Math.min(680, p.vy));
      p.y += p.vy * dt;
      p.rot = (p.vy / 680) * 0.65;
      if (p.y + p.size >= GROUND_Y) { p.y = GROUND_Y - p.size; p.vy = Math.min(0, p.vy); p.onGround = true; }
      else if (p.y <= CEILING_Y) { p.y = CEILING_Y; p.vy = Math.max(0, p.vy); }
      else p.onGround = false;
    } else if (mode === "wave") {
      const waveSpeed = mode === "wave" && (currentLevel.diff === "super" || currentLevel.diff === "extreme") ? 460 : 400;
      p.vy = state.holding ? -waveSpeed : waveSpeed;
      p.y += p.vy * dt;
      p.rot = state.holding ? -Math.PI / 4 : Math.PI / 4;
      if (p.y <= CEILING_Y || p.y + p.size >= GROUND_Y) { die(); return; }
      p.onGround = false;
    } else if (mode === "ball") {
      p.vy += GRAVITY * 0.9 * p.gravDir * dt;
      p.y += p.vy * dt;
      p.rot += 10 * dt * p.gravDir;
      if (p.gravDir > 0) {
        if (p.y + p.size >= GROUND_Y) { p.y = GROUND_Y - p.size; p.vy = 0; p.onGround = true; }
        else p.onGround = false;
        if (p.y < CEILING_Y) { p.y = CEILING_Y; p.vy = 0; }
      } else {
        if (p.y <= CEILING_Y) { p.y = CEILING_Y; p.vy = 0; p.onGround = true; }
        else p.onGround = false;
        if (p.y + p.size > GROUND_Y) { p.y = GROUND_Y - p.size; p.vy = 0; }
      }
    } else if (mode === "ufo") {
      p.vy += GRAVITY * 0.7 * dt;
      p.y += p.vy * dt;
      p.rot = Math.max(-0.4, Math.min(0.4, p.vy / 900));
      if (p.y + p.size >= GROUND_Y) { p.y = GROUND_Y - p.size; p.vy = 0; p.onGround = true; }
      else if (p.y <= CEILING_Y) { p.y = CEILING_Y; p.vy = Math.max(0, p.vy); }
      else p.onGround = false;
    } else {
      p.vy += GRAVITY * p.gravDir * dt;
      p.y += p.vy * dt;
      if (p.onGround) p.coyote = coyoteNow;
      else p.coyote = Math.max(0, p.coyote - dt);
      let overGap = false;
      for (const o of levelData.objs) {
        if (o.type === "gap" && p.x + p.size > o.x && p.x < o.x + o.w) overGap = true;
      }
      if (!overGap && p.y + p.size >= GROUND_Y) {
        p.y = GROUND_Y - p.size; p.vy = 0;
        if (!p.onGround) spawnDust(p.x + p.size / 2, GROUND_Y);
        p.onGround = true; p.coyote = coyoteNow;
        if (p.buffer > 0) doCubeJump(p);
      } else if (overGap && p.y + p.size >= GROUND_Y + 8) { die(); return; }
      else if (p.y + p.size < GROUND_Y - 1) p.onGround = false;
      if (!p.onGround) p.rot += 8.5 * dt;
      else p.rot = Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2);
    }

    state.camX = p.x - 160;

    for (const o of levelData.objs) {
      if (o.type === "spike") {
        if (spikeHit(p.x, p.y, p.size, p.size, o.x, o.y, o.ceil)) { die(); return; }
      } else if (o.type === "block") {
        if (rectHit(p.x + 4, p.y + 4, p.size - 8, p.size - 8, o.x, o.y, o.w, o.h)) {
          if (mode === "wave") { die(); return; }
          const prevBottom = p.y + p.size - p.vy * dt;
          if (p.vy >= 0 && prevBottom <= o.y + 10) {
            p.y = o.y - p.size; p.vy = 0; p.onGround = true;
          } else { die(); return; }
        }
      } else if (o.type === "pad" && (mode === "cube" || mode === "ufo")) {
        if (rectHit(p.x, p.y, p.size, p.size, o.x, o.y, o.w, o.h) && p.vy >= 0) {
          p.vy = JUMP_V * 1.25; p.onGround = false; sfx("pad"); spawnDust(o.x + 18, o.y);
        }
      } else if (o.type === "orb" && mode === "cube") {
        if (p.buffer > 0 && Math.hypot(p.x + p.size / 2 - o.x, p.y + p.size / 2 - o.y) < o.r + 18) {
          p.vy = JUMP_V * 1.05; p.onGround = false; p.buffer = 0; sfx("jump");
        }
      } else if (o.type === "portal") {
        if (p.portalCd <= 0 && rectHit(p.x, p.y, p.size, p.size, o.x, o.y, o.w, o.h)) setMode(p, o.mode);
      } else if (o.type === "finish") {
        if (p.x + p.size > o.x) doWin();
      }
    }

    if (p.y > H + 80 || p.y < -80) die();
    progressEl.textContent = Math.min(100, Math.floor((state.camX / levelData.length) * 100)) + "%";

    for (const part of state.particles) {
      part.life -= dt; part.x += part.vx * dt; part.y += part.vy * dt; part.vy += 900 * dt;
    }
    state.particles = state.particles.filter((part) => part.life > 0);
    state.flash = Math.max(0, state.flash - dt);
  }

  function drawBackground() {
    const pulseBoost = state.pulse * 0.04;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.skyTop);
    g.addColorStop(1, theme.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // beat glow
    ctx.fillStyle = theme.line;
    ctx.globalAlpha = 0.04 + pulseBoost;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    const off = -((state.camX * 0.3) % 48);
    for (let x = off; x < W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.shadowColor = theme.line;
    ctx.shadowBlur = 8 + state.pulse * 6;
    ctx.fillStyle = theme.line;
    ctx.fillRect(0, GROUND_Y, W, 3);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, GROUND_Y + 3, W, 8);
    ctx.globalAlpha = 1;

    if (state.player && needsCeiling(state.player.mode)) {
      ctx.fillStyle = theme.ground;
      ctx.fillRect(0, 0, W, CEILING_Y);
      ctx.fillStyle = theme.line;
      ctx.fillRect(0, CEILING_Y - 3, W, 3);
    }
  }

  function drawPortal(o, sx) {
    const meta = PORTAL[o.mode] || PORTAL.cube;
    ctx.save();
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 18 + state.pulse * 10;
    const grd = ctx.createLinearGradient(sx, o.y, sx + o.w, o.y);
    grd.addColorStop(0, meta.color);
    grd.addColorStop(0.5, meta.edge);
    grd.addColorStop(1, meta.color);
    ctx.fillStyle = grd;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(sx + 6, o.y);
    ctx.lineTo(sx + o.w - 6, o.y + 10);
    ctx.lineTo(sx + o.w - 6, o.y + o.h - 10);
    ctx.lineTo(sx + 6, o.y + o.h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px Russo One, sans-serif";
    ctx.save();
    ctx.translate(sx + o.w / 2, o.y + o.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(meta.label, 0, 4);
    ctx.restore();
    ctx.restore();
  }

  function drawPlayer(p, cam) {
    const px = p.x - cam;
    const py = p.y;
    const s = p.size;
    ctx.save();
    ctx.translate(px + s / 2, py + s / 2);
    ctx.rotate(p.rot);
    ctx.shadowColor = theme.player;
    ctx.shadowBlur = 12;

    if (p.mode === "ship") {
      ctx.fillStyle = theme.player;
      ctx.beginPath();
      ctx.moveTo(s / 2, 0); ctx.lineTo(-s / 2, -s / 3); ctx.lineTo(-s / 3, 0); ctx.lineTo(-s / 2, s / 3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = theme.playerEdge; ctx.lineWidth = 2; ctx.stroke();
      if (state.holding) { ctx.fillStyle = "#ff9a3d"; ctx.fillRect(-s / 2 - 10, -3, 10, 6); }
    } else if (p.mode === "ball") {
      ctx.fillStyle = theme.player;
      ctx.beginPath(); ctx.arc(0, 0, s / 2 - 1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = theme.playerEdge; ctx.lineWidth = 3; ctx.stroke();
    } else if (p.mode === "ufo") {
      ctx.fillStyle = theme.playerEdge;
      ctx.beginPath(); ctx.ellipse(0, -4, s / 3, s / 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = theme.player;
      ctx.beginPath(); ctx.ellipse(0, 4, s / 2, s / 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = theme.playerEdge; ctx.lineWidth = 2; ctx.stroke();
    } else if (p.mode === "wave") {
      ctx.fillStyle = theme.player;
      ctx.beginPath();
      ctx.moveTo(s / 2, 0); ctx.lineTo(-s / 2, -s / 2); ctx.lineTo(-s / 4, 0); ctx.lineTo(-s / 2, s / 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = theme.playerEdge; ctx.lineWidth = 2; ctx.stroke();
    } else {
      ctx.fillStyle = theme.player;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = theme.playerEdge; ctx.lineWidth = 2;
      ctx.strokeRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#06140c";
      ctx.fillRect(-8, -8, 7, 7); ctx.fillRect(2, -8, 7, 7);
    }
    ctx.restore();
  }

  function draw() {
    if (!levelData) {
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, W, H);
      return;
    }

    ctx.save();
    if (state.shake > 0) {
      const mag = state.shake * 14;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    drawBackground();
    const cam = state.camX;

    for (const o of levelData.objs) {
      if (o.type !== "gap") continue;
      const sx = o.x - cam;
      if (sx + o.w < -20 || sx > W + 20) continue;
      ctx.fillStyle = theme.skyBot;
      ctx.fillRect(sx, GROUND_Y - 1, o.w, H - GROUND_Y + 1);
      ctx.strokeStyle = theme.spike;
      ctx.strokeRect(sx, GROUND_Y, o.w, 2);
    }

    for (const o of levelData.objs) {
      const sx = o.x - cam;
      if (o.type === "spike") {
        if (sx < -40 || sx > W + 40) continue;
        ctx.beginPath();
        if (o.ceil) {
          ctx.moveTo(sx, o.y); ctx.lineTo(sx + 17, o.y + 34); ctx.lineTo(sx + 34, o.y);
        } else {
          ctx.moveTo(sx, o.y); ctx.lineTo(sx + 17, o.y - 34); ctx.lineTo(sx + 34, o.y);
        }
        ctx.closePath();
        ctx.fillStyle = theme.spike; ctx.fill();
        ctx.strokeStyle = theme.spikeEdge; ctx.stroke();
      } else if (o.type === "block") {
        if (sx + o.w < -20 || sx > W + 20) continue;
        ctx.shadowColor = theme.block; ctx.shadowBlur = 6;
        ctx.fillStyle = theme.block; ctx.fillRect(sx, o.y, o.w, o.h);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = theme.blockEdge; ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1, o.y + 1, o.w - 2, o.h - 2);
      } else if (o.type === "pad") {
        if (sx < -40 || sx > W + 40) continue;
        ctx.fillStyle = theme.pad; ctx.shadowColor = theme.pad; ctx.shadowBlur = 14;
        ctx.fillRect(sx, o.y, o.w, o.h); ctx.shadowBlur = 0;
      } else if (o.type === "orb") {
        if (sx < -40 || sx > W + 40) continue;
        ctx.shadowColor = theme.orb; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(sx, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = theme.orb; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (o.type === "portal") {
        if (sx < -50 || sx > W + 50) continue;
        drawPortal(o, sx);
      } else if (o.type === "finish") {
        if (sx < -40 || sx > W + 40) continue;
        ctx.fillStyle = theme.line; ctx.fillRect(sx, o.y, o.w, o.h);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 ? "#06140c" : theme.line;
          ctx.fillRect(sx + o.w, o.y + i * 30, 40, 30);
        }
      }
    }

    // trail
    for (const t of state.trail) {
      ctx.globalAlpha = Math.max(0, t.life * 1.5);
      ctx.fillStyle = theme.player;
      const sz = 10 * t.life;
      ctx.fillRect(t.x - cam - sz / 2, t.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;

    if (!state.dead && state.player) drawPlayer(state.player, cam);

    if (state.player && state.player.mode !== "cube") {
      const meta = PORTAL[state.player.mode];
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(W - 150, 30, 130, 28);
      ctx.fillStyle = meta.color;
      ctx.font = "14px Russo One, sans-serif";
      ctx.fillText(meta.label, W - 138, 50);
    }

    for (const part of state.particles) {
      ctx.globalAlpha = Math.max(0, part.life * 2);
      ctx.fillStyle = part.color;
      const sz = part.size || 4;
      ctx.fillRect(part.x - cam, part.y, sz, sz);
    }
    ctx.globalAlpha = 1;

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,70,100,${state.flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    const pct = Math.min(1, state.camX / levelData.length);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(20, 16, W - 40, 10);
    const bar = ctx.createLinearGradient(20, 0, W - 20, 0);
    bar.addColorStop(0, theme.line);
    bar.addColorStop(1, theme.player);
    ctx.fillStyle = bar;
    ctx.fillRect(20, 16, (W - 40) * pct, 10);

    ctx.restore();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    if (state.running) state.raf = requestAnimationFrame(loop);
  }

  function retry() {
    state.attempts++;
    resetRun();
  }

  function nextLevel() {
    const idx = LEVELS.findIndex((l) => l.id === currentLevel.id);
    const next = LEVELS[idx + 1];
    if (next) startLevel(next);
    else goLevels();
  }

  function toggleMute() {
    if (Music) Music.toggleMute();
    syncMuteButtons();
  }

  const starsEl = document.getElementById("menuStars");
  for (let i = 0; i < 36; i++) {
    const s = document.createElement("span");
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.animationDelay = Math.random() * 2 + "s";
    s.style.width = 2 + Math.random() * 4 + "px";
    s.style.height = s.style.width;
    starsEl.appendChild(s);
  }

  document.getElementById("btnPlay").onclick = () => startLevel(LEVELS[0]);
  document.getElementById("btnLevels").onclick = goLevels;
  document.getElementById("btnHow").onclick = () => showScreen("howto");
  document.getElementById("btnBackLevels").onclick = goMenu;
  document.getElementById("btnBackHow").onclick = goMenu;
  document.getElementById("btnMenuGame").onclick = goMenu;
  document.getElementById("btnLevelsGame").onclick = goLevels;
  document.getElementById("btnRetry").onclick = retry;
  document.getElementById("btnFailLevels").onclick = goLevels;
  document.getElementById("btnAgain").onclick = () => { state.attempts = 1; win.classList.add("hidden"); resetRun(); };
  document.getElementById("btnNext").onclick = nextLevel;
  document.getElementById("btnWinLevels").onclick = goLevels;
  document.getElementById("btnMute").onclick = toggleMute;
  document.getElementById("btnMuteGame").onclick = toggleMute;
  document.getElementById("btnMuteLevels").onclick = toggleMute;
  syncMuteButtons();

  document.querySelectorAll("#levelFilters .filter-btn").forEach((btn) => {
    btn.onclick = () => {
      levelFilter = btn.getAttribute("data-filter") || "all";
      document.querySelectorAll("#levelFilters .filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderLevelGrid();
    };
  });

  function inPlay() {
    return !document.getElementById("play").classList.contains("hidden");
  }
  function isUiButton(el) {
    return el && (el.tagName === "BUTTON" || (el.closest && el.closest("button")));
  }
  function onHoldStart(e) {
    if (!inPlay()) return;
    if (e && isUiButton(e.target)) return;
    if (e && e.preventDefault) e.preventDefault();
    if (!state.running) return;
    if (state.dead) { retry(); return; }
    if (state.won) return;
    state.holding = true;
    pressAction();
  }
  function onHoldEnd() { state.holding = false; }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") onHoldStart(e);
    if (e.code === "KeyM") toggleMute();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") onHoldEnd();
  });
  document.getElementById("play").addEventListener("pointerdown", onHoldStart, { capture: true });
  window.addEventListener("pointerup", onHoldEnd);
  window.addEventListener("pointercancel", onHoldEnd);
  window.addEventListener("blur", onHoldEnd);

  showScreen("menu");
})();
