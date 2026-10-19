// Original GD-style procedural music (not copyrighted Geometry Dash tracks)
window.GeoMusic = (() => {
  let ac = null;
  let master = null;
  let playing = false;
  let timer = null;
  let step = 0;
  let muted = localStorage.getItem("geo_mute") === "1";
  let track = null;

  const TRACKS = {
    easy: { bpm: 128, root: 48, style: "happy" },
    normal: { bpm: 132, root: 50, style: "pulse" },
    hard: { bpm: 140, root: 45, style: "drive" },
    insane: { bpm: 150, root: 43, style: "night" },
    demon: { bpm: 160, root: 40, style: "demon" },
    extreme: { bpm: 170, root: 38, style: "extreme" },
    super: { bpm: 175, root: 36, style: "super" },
  };

  function ensure() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.22;
    master.connect(ac.destination);
    return ac;
  }

  function tone(freq, dur, type, vol, when) {
    if (!ac || !master) return;
    const t = when != null ? when : ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseHit(dur, vol, when) {
    if (!ac || !master) return;
    const t = when != null ? when : ac.currentTime;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g);
    g.connect(master);
    src.start(t);
  }

  function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function patternFor(style, root) {
    const scaleHappy = [0, 2, 4, 5, 7, 9, 11, 12];
    const scaleMinor = [0, 2, 3, 5, 7, 8, 10, 12];
    const scaleDemon = [0, 1, 3, 5, 6, 8, 10, 12];
    const scale = style === "happy" || style === "pulse" ? scaleHappy
      : style === "demon" || style === "extreme" || style === "super" ? scaleDemon
      : scaleMinor;

    const bass = [
      root, root, root + 7, root,
      root + 5, root + 5, root, root + 3,
    ];
    const lead = [];
    for (let i = 0; i < 16; i++) {
      const deg = scale[(i * 3 + (style === "super" ? 5 : 2)) % scale.length];
      lead.push(root + 12 + deg);
    }
    return { bass, lead, scale };
  }

  function tick() {
    if (!playing || !ac || !track) return;
    const { bpm, root, style } = track;
    const beat = 60 / bpm;
    const t = ac.currentTime + 0.05;
    const pat = patternFor(style, root);
    const s = step % 16;

    // kick
    if (s % 4 === 0) {
      tone(90, 0.12, "sine", 0.45, t);
      tone(55, 0.18, "triangle", 0.3, t);
      noiseHit(0.06, 0.12, t);
    }
    // snare / clap
    if (s % 8 === 4) noiseHit(0.1, style === "super" ? 0.28 : 0.18, t);

    // hihat
    if (s % 2 === 1) noiseHit(0.03, 0.06, t);
    if (style === "extreme" || style === "super") {
      if (s % 2 === 0) noiseHit(0.02, 0.04, t + beat * 0.25);
    }

    // bass
    const b = pat.bass[s % pat.bass.length];
    tone(midi(b), beat * 0.85, "sawtooth", 0.16, t);
    tone(midi(b) * 0.5, beat * 0.85, "square", 0.08, t);

    // lead arpeggio
    const l = pat.lead[s];
    const leadVol = style === "happy" ? 0.1 : 0.12;
    tone(midi(l), beat * 0.35, style === "demon" ? "sawtooth" : "square", leadVol, t);
    if (style === "super" || style === "extreme") {
      tone(midi(l + 7), beat * 0.25, "triangle", 0.06, t + beat * 0.15);
    }

    // chord stab every 8
    if (s % 8 === 0) {
      const c = [0, 3, 7].map((d) => midi(root + 12 + d));
      c.forEach((f, i) => tone(f, beat * 1.2, "triangle", 0.05, t + i * 0.01));
    }

    step++;
    timer = setTimeout(tick, beat * 1000);
  }

  function start(diffKey) {
    ensure();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    stopTimer();
    const key = TRACKS[diffKey] ? diffKey
      : diffKey === "easy" ? "easy"
      : diffKey === "normal" ? "normal"
      : diffKey === "hard" ? "hard"
      : diffKey === "insane" ? "insane"
      : diffKey === "demon" ? "demon"
      : diffKey === "extreme" ? "extreme"
      : diffKey === "super" ? "super"
      : "normal";
    track = TRACKS[key] || TRACKS.normal;
    step = 0;
    playing = true;
    if (master) master.gain.value = muted ? 0 : 0.22;
    tick();
  }

  function stopTimer() {
    playing = false;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  function stop() {
    stopTimer();
  }

  function setMuted(m) {
    muted = !!m;
    localStorage.setItem("geo_mute", muted ? "1" : "0");
    if (master) master.gain.value = muted ? 0 : 0.22;
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function isMuted() { return muted; }

  function sfx(kind) {
    ensure();
    if (!ac || muted) return;
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime;
    if (kind === "jump") tone(520, 0.06, "triangle", 0.12, t);
    else if (kind === "portal") {
      tone(400, 0.08, "square", 0.1, t);
      tone(700, 0.1, "square", 0.08, t + 0.06);
    } else if (kind === "die") {
      tone(120, 0.2, "sawtooth", 0.18, t);
      noiseHit(0.2, 0.2, t);
    } else if (kind === "win") {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.15, "triangle", 0.12, t + i * 0.1));
    } else if (kind === "pad") tone(700, 0.07, "triangle", 0.1, t);
  }

  return { start, stop, toggleMute, isMuted, setMuted, sfx, ensure };
})();
