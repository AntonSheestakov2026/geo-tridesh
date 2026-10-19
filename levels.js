// 50 unique levels — different layouts, colors, form focus
window.createGeoLevels = function createGeoLevels(GROUND_Y, CEILING_Y) {
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s));
    l = Math.max(0, Math.min(100, l));
    const c = (1 - Math.abs(2 * (l / 100) - 1)) * (s / 100);
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l / 100 - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return "#" + to(r) + to(g) + to(b);
  }

  function themeFromIndex(i, diff) {
    const hue = (i * 47 + (diff === "super" ? 280 : diff === "extreme" ? 350 : diff === "demon" ? 330 : i * 19)) % 360;
    const dark = diff === "super" || diff === "extreme" || diff === "demon";
    const line = hsl(hue, dark ? 90 : 70, dark ? 60 : 55);
    const block = hsl(hue + 20, 75, dark ? 45 : 50);
    const spike = hsl((hue + 180) % 360, 90, 55);
    const player = hsl(hue + 40, 85, 60);
    const skyTop = hsl(hue, 40, dark ? 10 : 12);
    const skyBot = hsl(hue + 20, 50, dark ? 4 : 6);
    return {
      skyTop, skyBot,
      ground: hsl(hue, 25, dark ? 8 : 10),
      line,
      grid: `rgba(${parseInt(line.slice(1, 3), 16)},${parseInt(line.slice(3, 5), 16)},${parseInt(line.slice(5, 7), 16)},0.08)`,
      block, blockEdge: hsl(hue + 20, 60, 75),
      spike, spikeEdge: hsl((hue + 180) % 360, 70, 75),
      player, playerEdge: hsl(hue + 40, 50, 85),
      pad: "#ffe66d",
      orb: hsl(hue + 160, 80, 65),
      card: `linear-gradient(135deg,${skyTop},${hsl(hue, 60, dark ? 25 : 30)})`,
    };
  }

  const DIFF_META = {
    easy: { label: "ЛЕГКО", music: "easy", speed: 250, gravity: 1900, jump: -820 },
    normal: { label: "НОРМА", music: "normal", speed: 290, gravity: 2000, jump: -840 },
    hard: { label: "СЛОЖНО", music: "hard", speed: 330, gravity: 2100, jump: -860 },
    insane: { label: "ИНСЕЙН", music: "insane", speed: 370, gravity: 2200, jump: -880 },
    demon: { label: "ДЕМОН", music: "demon", speed: 410, gravity: 2350, jump: -900 },
    extreme: { label: "ЭКСТРИМ", music: "extreme", speed: 455, gravity: 2500, jump: -920 },
    super: { label: "СУПЕР ДЕМОН", music: "super", speed: 500, gravity: 2650, jump: -940 },
  };

  // —— Distinct layout styles ——
  const STYLES = {
    classic(api, p, rnd) {
      const { addSpike, addBlock, addPad, addOrb, addGap, finish } = api;
      let x = 500;
      for (let i = 0; i < p.count; i++) {
        addSpike(x, 1 + (i % 4 === 3 ? p.multi - 1 : 0));
        x += p.space + (i % 3) * 20;
        if (i % 5 === 2) { addBlock(x, 0, 40, 40); x += p.space * 0.7; }
        if (i % 7 === 4) { addPad(x); x += 60; addSpike(x + 100, p.multi); x += p.space + 80; }
        if (i % 6 === 5) { addOrb(x, GROUND_Y - 100 - rnd() * 30); x += 140; addSpike(x + 80, 1); x += p.space; }
        if (i % 8 === 6) { addGap(x, p.gap); x += p.gap + 140; }
      }
      return finish(x + 200);
    },

    stairs(api, p) {
      const { addSpike, addBlock, addPad, finish } = api;
      let x = 480;
      for (let i = 0; i < p.count; i++) {
        const steps = 2 + (i % 3);
        for (let s = 0; s < steps; s++) addBlock(x + s * 40, s * 40, 40, 40);
        x += steps * 40 + 50;
        addSpike(x, 1 + (i % 2));
        x += p.space;
        if (i % 3 === 1) { addPad(x); x += 70; addSpike(x + 120, p.multi); x += p.space + 60; }
      }
      return finish(x + 180);
    },

    rhythm(api, p) {
      const { addSpike, addGap, finish } = api;
      let x = 520;
      const beat = p.space;
      for (let i = 0; i < p.count; i++) {
        addSpike(x, i % 5 === 4 ? p.multi : 1);
        x += beat;
        if (i % 4 === 3) { addGap(x, p.gap * 0.7); x += p.gap + beat; }
      }
      return finish(x + 200);
    },

    clusters(api, p, rnd) {
      const { addSpike, addPad, finish } = api;
      let x = 500;
      for (let i = 0; i < p.count; i++) {
        const n = 2 + Math.floor(rnd() * p.multi);
        addSpike(x, n);
        x += 40 * n + 30;
        // long calm
        x += p.space * 1.4 + rnd() * 60;
        if (i % 2) { addPad(x); x += 80; }
      }
      return finish(x + 200);
    },

    shipCruise(api, p, rnd) {
      const { addSpike, addPortal, addBlock, finish } = api;
      let x = 460;
      addSpike(x); x += p.space;
      addPortal(x, "ship"); x += 110;
      for (let i = 0; i < p.count; i++) {
        if (i % 2 === 0) { addSpike(x, 1 + (i % 3 === 0 ? 1 : 0)); x += p.space * 0.95; }
        else { addSpike(x, 1 + Math.floor(rnd() * Math.min(2, p.multi)), true); x += p.space * 0.95; }
        if (i % 5 === 4) { addBlock(x, 0, 40, 48); x += 90; }
      }
      addPortal(x, "cube"); x += 140;
      addSpike(x, p.multi); x += p.space;
      return finish(x + 180);
    },

    ufoHop(api, p) {
      const { addSpike, addPortal, addPad, finish } = api;
      let x = 470;
      addSpike(x, 1); x += p.space;
      addPortal(x, "ufo"); x += 110;
      for (let i = 0; i < p.count; i++) {
        addSpike(x, 1 + (i % 3 === 0 ? 1 : 0));
        x += p.space * 0.85;
        if (i % 2) { addSpike(x, 1, true); x += p.space * 0.8; }
        if (i % 4 === 3) { addPad(x); x += 60; }
      }
      addPortal(x, "cube"); x += 130;
      addSpike(x, 2); x += p.space;
      return finish(x + 180);
    },

    ballFlip(api, p) {
      const { addSpike, addPortal, finish } = api;
      let x = 460;
      addSpike(x); x += p.space;
      addPortal(x, "ball"); x += 110;
      for (let i = 0; i < p.count; i++) {
        // pairs: floor then ceiling — player flips between
        addSpike(x, 1 + (i % 2)); x += p.space * 0.9;
        addSpike(x, 1 + (i % 3 === 0 ? 1 : 0), true); x += p.space * 0.9;
      }
      addPortal(x, "cube"); x += 130;
      addSpike(x, p.multi); x += p.space;
      return finish(x + 180);
    },

    waveTunnel(api, p) {
      const { addSpike, addPortal, finish } = api;
      let x = 450;
      addSpike(x, 2); x += p.space * 0.9;
      addPortal(x, "wave"); x += 100;
      for (let i = 0; i < p.count; i++) {
        addSpike(x, 1 + (i % 4 === 0 ? 1 : 0)); x += p.space * 0.7;
        addSpike(x, 1 + (i % 3 === 0 ? 1 : 0), true); x += p.space * 0.7;
      }
      addPortal(x, "cube"); x += 120;
      addSpike(x, p.multi); x += p.space;
      return finish(x + 160);
    },

    gapRunner(api, p) {
      const { addSpike, addGap, addPad, addBlock, finish } = api;
      let x = 500;
      for (let i = 0; i < p.count; i++) {
        addSpike(x); x += p.space * 0.7;
        addGap(x, p.gap * (0.8 + (i % 3) * 0.15));
        x += p.gap + 100 + (i % 4) * 15;
        if (i % 3 === 1) { addBlock(x, 0, 40, 40); x += 80; }
        if (i % 4 === 2) { addPad(x); x += 70; addSpike(x + 90, 2); x += p.space; }
      }
      return finish(x + 200);
    },

    orbChain(api, p) {
      const { addSpike, addOrb, addPad, finish } = api;
      let x = 490;
      for (let i = 0; i < p.count; i++) {
        addSpike(x, 1); x += 100;
        addOrb(x, GROUND_Y - (90 + (i % 4) * 18));
        x += 130;
        addSpike(x + 40, 1 + (i % 2)); x += p.space;
        if (i % 3 === 2) { addPad(x); x += 60; addSpike(x + 110, p.multi); x += p.space + 40; }
      }
      return finish(x + 180);
    },

    mixedGauntlet(api, p, rnd) {
      const { addSpike, addPortal, addBlock, addGap, finish } = api;
      const forms = ["ship", "ufo", "ball", "wave"].slice(0, 2 + Math.min(2, p.multi));
      let x = 440;
      addSpike(x, 1); x += p.space;
      for (let f = 0; f < forms.length; f++) {
        addPortal(x, forms[f]); x += 100;
        const len = 3 + (p.count / forms.length) | 0;
        for (let i = 0; i < len; i++) {
          addSpike(x, 1 + (i % p.multi)); x += p.space * 0.85;
          if (rnd() > 0.4) { addSpike(x, 1, true); x += p.space * 0.8; }
        }
        addPortal(x, "cube"); x += 120;
        if (f < forms.length - 1) {
          addBlock(x, 0, 40, 40); x += 90;
          if (p.gap > 50) { addGap(x, p.gap * 0.6); x += p.gap + 100; }
        }
      }
      addSpike(x, p.multi); x += p.space;
      return finish(x + 160);
    },

    mirror(api, p) {
      const { addSpike, addPortal, finish } = api;
      let x = 480;
      for (let i = 0; i < Math.ceil(p.count / 2); i++) {
        addSpike(x, 1 + (i % 2)); x += p.space * 0.75;
        addSpike(x, 1 + (i % 2), true); x += p.space * 0.75;
      }
      if (p.multi >= 2) {
        addPortal(x, "ship"); x += 100;
        for (let i = 0; i < 4; i++) {
          addSpike(x); x += p.space * 0.8;
          addSpike(x, 1, true); x += p.space * 0.8;
        }
        addPortal(x, "cube"); x += 120;
      }
      return finish(x + 180);
    },

    deadlock(api, p) {
      // ship → ball → wave signature
      const { addSpike, addPortal, addBlock, finish } = api;
      let x = 450;
      addSpike(x, 2); x += p.space;
      addPortal(x, "ship"); x += 100;
      for (let i = 0; i < 5; i++) {
        addSpike(x, 1 + (i % 2)); x += p.space * 0.85;
        addSpike(x, 1, true); x += p.space * 0.85;
      }
      addPortal(x, "ball"); x += 100;
      for (let i = 0; i < 5; i++) {
        addSpike(x, 2); x += p.space * 0.9;
        addSpike(x, 2, true); x += p.space * 0.9;
      }
      addPortal(x, "wave"); x += 100;
      for (let i = 0; i < 6 + p.multi; i++) {
        addSpike(x, 1 + (i % 2)); x += p.space * 0.65;
        addSpike(x, 1 + (i % 2), true); x += p.space * 0.65;
      }
      addPortal(x, "cube"); x += 120;
      addBlock(x, 0, 40, 40); addBlock(x + 40, 40, 40, 40); x += 160;
      addSpike(x, p.multi); x += p.space;
      return finish(x + 160);
    },

    nineCircles(api, p) {
      // wave-heavy tight
      const { addSpike, addPortal, addOrb, finish } = api;
      let x = 440;
      addSpike(x, 2); x += p.space * 0.8;
      addOrb(x, GROUND_Y - 110); x += 100;
      addPortal(x, "wave"); x += 95;
      for (let i = 0; i < p.count + 4; i++) {
        addSpike(x, 1 + (i % 5 === 0 ? 1 : 0)); x += p.space * 0.55;
        addSpike(x, 1, true); x += p.space * 0.55;
      }
      addPortal(x, "cube"); x += 110;
      addSpike(x, p.multi + 1); x += p.space;
      return finish(x + 150);
    },

    ceilHell(api, p) {
      const { addSpike, addPortal, addBlock, finish } = api;
      let x = 470;
      addSpike(x); x += p.space;
      addPortal(x, "ship"); x += 100;
      for (let i = 0; i < p.count; i++) {
        addSpike(x, 1 + Math.min(2, p.multi - 1), true);
        x += p.space * 0.85;
        if (i % 3 === 1) { addSpike(x, 1); x += p.space * 0.8; }
        if (i % 4 === 3) { addBlock(x, 0, 40, 56); x += 85; }
      }
      addPortal(x, "cube"); x += 130;
      return finish(x + 180);
    },

    speedBridge(api, p) {
      const { addSpike, addBlock, addGap, addPad, finish } = api;
      let x = 490;
      for (let i = 0; i < p.count; i++) {
        addBlock(x, 0, 48, 40); x += 55;
        addBlock(x, 40, 48, 40); x += 100;
        addGap(x, p.gap * 0.75); x += p.gap + 90;
        addSpike(x, 1 + (i % 2)); x += p.space * 0.7;
        if (i % 2) { addPad(x); x += 70; }
      }
      return finish(x + 200);
    },

    portalSpam(api, p) {
      const { addSpike, addPortal, finish } = api;
      const cycle = ["ship", "cube", "ufo", "cube", "ball", "cube", "wave", "cube"];
      let x = 450;
      addSpike(x); x += p.space;
      for (let i = 0; i < p.count; i++) {
        const mode = cycle[i % cycle.length];
        if (mode !== "cube" || i === 0) {
          addPortal(x, mode === "cube" ? "cube" : mode);
          x += 95;
        }
        addSpike(x, 1 + (i % p.multi)); x += p.space * 0.75;
        if (mode === "ship" || mode === "wave" || mode === "ball") {
          addSpike(x, 1, true); x += p.space * 0.7;
        }
        if (mode !== "cube" && (i % cycle.length === cycle.indexOf(mode) || true)) {
          // return to cube often
          if (i % 2 === 1) { addPortal(x, "cube"); x += 100; }
        }
      }
      addPortal(x, "cube"); x += 120;
      addSpike(x, p.multi); x += p.space;
      return finish(x + 160);
    },

    zigZag(api, p) {
      const { addSpike, addBlock, addPad, finish } = api;
      let x = 500;
      for (let i = 0; i < p.count; i++) {
        if (i % 2 === 0) {
          addSpike(x); x += 90;
          addBlock(x, 0, 40, 72); x += 80;
          addSpike(x + 20, 1); x += p.space;
        } else {
          addPad(x); x += 50;
          addSpike(x + 130, 2); x += p.space + 80;
          addBlock(x, 0, 40, 40); addBlock(x + 40, 40, 40, 40); x += 140;
        }
      }
      return finish(x + 180);
    },

    burstWave(api, p) {
      const { addSpike, addPortal, addGap, finish } = api;
      let x = 440;
      addPortal(x, "wave"); x += 100;
      for (let g = 0; g < 4; g++) {
        for (let i = 0; i < 3 + p.multi; i++) {
          addSpike(x, 1); x += p.space * 0.5;
          addSpike(x, 1, true); x += p.space * 0.5;
        }
        addPortal(x, "cube"); x += 100;
        addGap(x, p.gap * 0.5); x += p.gap + 80;
        if (g < 3) { addPortal(x, "wave"); x += 95; }
      }
      addSpike(x, p.multi); x += p.space;
      return finish(x + 150);
    },
  };

  const STYLE_KEYS = Object.keys(STYLES);

  function paramsFor(diff, i) {
    const base = {
      easy: { space: 320, multi: 1, gap: 42, count: 10 },
      normal: { space: 280, multi: 1, gap: 50, count: 12 },
      hard: { space: 240, multi: 2, gap: 58, count: 14 },
      insane: { space: 200, multi: 2, gap: 68, count: 16 },
      demon: { space: 160, multi: 3, gap: 82, count: 18 },
      extreme: { space: 130, multi: 4, gap: 95, count: 22 },
      super: { space: 105, multi: 5, gap: 110, count: 26 },
    }[diff];
    const t = (i % 7) / 7;
    return {
      space: Math.max(90, base.space - t * 30),
      multi: base.multi + (t > 0.6 ? 1 : 0),
      gap: base.gap + t * 12,
      count: base.count + Math.floor(t * 5),
    };
  }

  // Each level: unique name, difficulty, AND forced unique style
  const NAMES = [
    ["Stereo Green", "easy", "classic"],
    ["Back On Track", "easy", "rhythm"],
    ["Polargeist", "easy", "stairs"],
    ["Dry Meadow", "easy", "gapRunner"],
    ["Pulse Starter", "easy", "orbChain"],
    ["Cube Garden", "easy", "zigZag"],
    ["Base Circuit", "normal", "clusters"],
    ["Sky Jumper", "normal", "ufoHop"],
    ["Neon Parade", "normal", "shipCruise"],
    ["Orbit Lane", "normal", "stairs"],
    ["Violet Dash", "normal", "mirror"],
    ["Echo Rush", "normal", "speedBridge"],
    ["Dry Out", "hard", "classic"],
    ["Cantina", "hard", "ballFlip"],
    ["Hexagon Force", "hard", "shipCruise"],
    ["Blast Processing", "hard", "clusters"],
    ["Geometrical Dominator", "hard", "zigZag"],
    ["Fingerdash", "hard", "portalSpam"],
    ["Clutterfunk", "insane", "mixedGauntlet"],
    ["Theory Of Fire", "insane", "orbChain"],
    ["Electrodynamix", "insane", "shipCruise"],
    ["Hexagon Hell", "insane", "ceilHell"],
    ["Base After Base", "insane", "stairs"],
    ["Time Machine", "insane", "gapRunner"],
    ["Clubstep Gate", "demon", "deadlock"],
    ["Theory Inferno", "demon", "shipCruise"],
    ["Deadlocked", "demon", "deadlock"],
    ["Nine Circles", "demon", "nineCircles"],
    ["Fairydust", "demon", "waveTunnel"],
    ["Jawbreaker", "demon", "ballFlip"],
    ["Problematic", "demon", "mirror"],
    ["Future Funk", "demon", "portalSpam"],
    ["Windfall", "demon", "ufoHop"],
    ["Allegiance", "demon", "mixedGauntlet"],
    ["Blood Pulse", "extreme", "burstWave"],
    ["Cataclysm Core", "extreme", "nineCircles"],
    ["Bloodbath", "extreme", "deadlock"],
    ["Sakupen Hell", "extreme", "ceilHell"],
    ["Athanatos", "extreme", "waveTunnel"],
    ["Phobos", "extreme", "portalSpam"],
    ["Artificial Ascent", "extreme", "stairs"],
    ["Zodiac", "extreme", "mixedGauntlet"],
    ["Sonic Superwave", "super", "burstWave"],
    ["Yatagarasu Void", "super", "nineCircles"],
    ["Plasma Pulse Finale", "super", "deadlock"],
    ["Bloodlust", "super", "ceilHell"],
    ["Tartarus", "super", "waveTunnel"],
    ["The Golden", "super", "portalSpam"],
    ["Firework", "super", "mixedGauntlet"],
    ["Acheron", "super", "burstWave"],
  ];

  // Ensure every style used; if duplicate style in same diff, remix with seed
  const LEVELS = NAMES.map(([name, diff, styleKey], i) => {
    const meta = DIFF_META[diff];
    const seed = 7777 + i * 7919 + styleKey.length * 313;
    const rnd = mulberry32(seed);
    const p = paramsFor(diff, i);
    // unique twist: offset space by style
    p.space = Math.max(85, p.space + (i % 5) * 8 - 16);
    p.count += (i % 3);

    const style = STYLES[styleKey] || STYLES.classic;
    const theme = themeFromIndex(i, diff);

    // secondary accent for card variety
    if (i % 3 === 0) theme.player = hsl(i * 53, 90, 58);

    return {
      id: "lv" + (i + 1),
      num: i + 1,
      name: (i + 1) + ". " + name,
      style: styleKey,
      diff,
      diffLabel: meta.label,
      music: meta.music,
      speed: meta.speed + Math.floor(i * 1.5),
      gravity: meta.gravity + i * 5,
      jump: meta.jump - Math.floor(i * 0.4),
      theme,
      coyoteScale: diff === "super" ? 0.35 : diff === "extreme" ? 0.5 : diff === "demon" ? 0.65 : 1,
      hitForgive: diff === "super" ? 0.3 : diff === "extreme" ? 0.5 : diff === "demon" ? 0.7 : 1,
      build: (api) => style(api, p, rnd),
    };
  });

  // sanity: all 50
  if (LEVELS.length !== 50) console.warn("Expected 50 levels, got", LEVELS.length);
  return LEVELS;
};
