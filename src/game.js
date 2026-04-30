(() => {
  const MASTER = 139;
  const WORLD = 9400;
  const GRAVITY = 1680;
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const frame = document.querySelector(".game-frame");
  const audio = document.getElementById("track");
  const startOverlay = document.getElementById("startOverlay");
  const startButton = document.getElementById("startButton");
  const replayButton = document.getElementById("replayButton");
  const blackout = document.getElementById("blackout");
  const timerText = document.getElementById("timerText");
  const vibeFill = document.getElementById("vibeFill");
  const distanceText = document.getElementById("distanceText");
  const sectorText = document.getElementById("sectorText");
  const pressureText = document.getElementById("pressureText");
  const lyricText = document.getElementById("lyricText");
  const lyricCard = document.getElementById("lyricCard");
  const touchControls = document.getElementById("touchControls");

  const keys = new Set();
  const sectors = [
    { id: "school", label: "SCHOOLYARD", start: 0, end: 3050, sky: "#9fc7d3", floor: "#434a4f", line: "#f1e8c7" },
    { id: "street", label: "NEIGHBORHOOD", start: 3050, end: 6250, sky: "#627c91", floor: "#252a2e", line: "#f0bd4f" },
    { id: "mall", label: "MALL", start: 6250, end: WORLD, sky: "#d7d4c8", floor: "#c9b990", line: "#fff7df" },
  ];
  const lyrics = [
    [0, "WHO RAISED YOU?"],
    [8.2, "DODGE, DON'T FIGHT"],
    [17.4, "MAKE THE BLOCK SHOW ITS RULES"],
    [29.1, "ONE CALL TURNS INTO A CROWD"],
    [41.5, "MOVE CLEAN THROUGH THE PRESSURE"],
    [55.2, "THEY CHASE WHAT THEY CAN'T CATCH"],
    [68.6, "BLIND SPOTS DON'T STAY QUIET"],
    [82.4, "LET MOMENTUM TELL ON THEM"],
    [96.3, "THE MALL FLOOR REMEMBERS"],
    [111.1, "NO HANDS. NO SWING. NO BULLY WIN."],
    [127.4, "2:19 IS THE WALL"],
  ];
  const spawns = [
    [5.8, 2, 780], [18.6, 3, 1880], [34.4, 2, 2840], [50.2, 2, 3850],
    [63.1, 4, 5120], [78.5, 2, 6080], [92.8, 3, 7040], [109.4, 4, 8130], [124.8, 3, 8910],
  ];
  const blind = [980, 2280, 3720, 4890, 6425, 7250, 8360];
  const stats = {
    kid: { w: 42, h: 92, duck: 52, speed: 245, jump: -640, color: "#e44838" },
    acea: { w: 68, h: 58, duck: 44, speed: 270, jump: -560, color: "#111217" },
    fixer: { w: 44, h: 98, duck: 50, speed: 232, jump: -610, color: "#20242b" },
  };

  const view = { w: 1280, h: 720, dpr: 1, ground: 548 };
  const player = { x: 180, y: 0, vy: 0, vibe: 100, duck: false, onGround: true, inv: 0, face: 1 };
  let character = "kid";
  let state = "ready";
  let camera = 0;
  let lastFrame = performance.now();
  let startMs = 0;
  let fallbackClock = false;
  let audioBroken = false;
  let lyricIndex = -1;
  let bullies = [];
  let spawnState = [];
  let jumpQueued = false;
  let dog = { x: 1510, armed: true, pulse: 0 };
  let puddle = { x: 7550, pulse: 0 };
  let bike = { active: false, x: 4300, y: 0, vx: 380 };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const clock = () => fallbackClock ? clamp((performance.now() - startMs) / 1000, 0, MASTER) : clamp(audio.currentTime || 0, 0, MASTER);
  const sectorAt = (x) => sectors.find((s) => x >= s.start && x < s.end) || sectors[2];
  const screen = (x) => x - camera;

  function resize() {
    const r = canvas.getBoundingClientRect();
    view.w = Math.max(320, r.width);
    view.h = Math.max(240, r.height);
    view.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    view.ground = Math.round(view.h * 0.76);
    if (player.onGround || !player.y) player.y = view.ground;
    bike.y = view.ground;
  }

  function reset(resetAudio = true) {
    bullies = [];
    spawnState = spawns.map((s) => ({ t: s[0], count: s[1], x: s[2], done: false }));
    dog = { x: 1510, armed: true, pulse: 0 };
    puddle = { x: 7550, pulse: 0 };
    bike = { active: false, x: 4300, y: view.ground, vx: 380 };
    Object.assign(player, { x: 180, y: view.ground, vy: 0, vibe: 100, duck: false, onGround: true, inv: 1.1, face: 1 });
    camera = 0;
    lyricIndex = -1;
    startMs = performance.now();
    fallbackClock = false;
    if (resetAudio) {
      audio.pause();
      try { audio.currentTime = 0; } catch {}
    }
    blackout.classList.remove("is-visible");
    updateLyric(0, true);
    updateHud();
  }

  function start() {
    reset(false);
    state = "playing";
    startMs = performance.now();
    fallbackClock = true;
    startOverlay.classList.add("is-hidden");
    blackout.classList.remove("is-visible");
    if (!audioBroken) {
      try { audio.currentTime = 0; audio.playbackRate = 1; } catch {}
      audio.play().then(() => { fallbackClock = false; }).catch(() => { fallbackClock = true; });
    }
  }

  function finalCut() {
    if (state === "gameover") return;
    state = "gameover";
    audio.pause();
    timerText.textContent = "0:00";
    pressureText.textContent = "CUT";
    blackout.classList.add("is-visible");
  }

  function blinkReset() {
    const s = sectorAt(player.x);
    player.vibe = Math.max(8, player.vibe - 18);
    player.x = s.start + 190;
    player.y = view.ground;
    player.vy = 0;
    player.duck = false;
    player.inv = 1.25;
    camera = clamp(s.start, 0, WORLD - view.w);
    frame.classList.remove("blink");
    void frame.offsetWidth;
    frame.classList.add("blink");
    setTimeout(() => frame.classList.remove("blink"), 380);
    bullies.forEach((b) => {
      if (sectorAt(b.x).id === s.id) Object.assign(b, { x: s.start + 560 + Math.random() * 620, vx: 0, state: "search", scatter: 0 });
    });
  }

  function spawnBully(x, i) {
    bullies.push({ x: x + i * 130, y: view.ground, vx: -20, anchor: x + i * 130, state: "search", t: 0, seed: Math.random() * 9, scatter: 0, slip: 0 });
  }

  function playerBox() {
    const s = stats[character];
    const h = player.duck ? s.duck : s.h;
    return { l: player.x - s.w * 0.45, r: player.x + s.w * 0.45, t: player.y - h, b: player.y - 4 };
  }
  const bullyBox = (b) => ({ l: b.x - 28, r: b.x + 28, t: b.y - 88, b: b.y - 5 });
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

  function update(dt) {
    const now = clock();
    if (now >= MASTER || (!fallbackClock && audio.ended)) return finalCut();

    const s = stats[character];
    const left = keys.has("ArrowLeft") || keys.has("KeyA");
    const right = keys.has("ArrowRight") || keys.has("KeyD");
    player.duck = (keys.has("ArrowDown") || keys.has("KeyS")) && player.onGround;
    const accel = player.duck ? 0.55 : 1;
    if (left) { player.x -= s.speed * accel * dt; player.face = -1; }
    if (right) { player.x += s.speed * accel * dt; player.face = 1; }
    player.x = clamp(player.x, 70, WORLD - 120);
    if (jumpQueued && player.onGround && !player.duck) { player.vy = s.jump; player.onGround = false; }
    jumpQueued = false;
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= view.ground) { player.y = view.ground; player.vy = 0; player.onGround = true; }
    player.inv = Math.max(0, player.inv - dt);
    camera += (clamp(player.x - view.w * 0.38, 0, WORLD - view.w) - camera) * clamp(6 * dt, 0, 1);

    spawnState.forEach((e) => {
      if (!e.done && now >= e.t) { e.done = true; for (let i = 0; i < e.count; i++) spawnBully(e.x, i); }
    });

    if (!bike.active && now > 56 && now < 92 && player.x > 3500) bike.active = true;
    if (bike.active) {
      bike.x += bike.vx * dt;
      if (bike.x > 6100) bike.x = 3850;
    }

    const pBox = playerBox();
    bullies.forEach((b) => {
      b.t += dt;
      b.slip = Math.max(0, b.slip - dt);
      const close = Math.abs(b.x - player.x);
      const hidden = blind.some((x) => Math.abs(x - b.x) < 110 && Math.abs(x - player.x) > 95);
      if (b.scatter > 0) { b.scatter -= dt; b.vx += (b.x < player.x ? -1 : 1) * 320 * dt; b.state = "scattered"; }
      else if (close < 360 && !hidden) b.state = "swarm";
      else if (close < 620 && !hidden) b.state = "notice";
      else b.state = "search";

      if (b.state === "search") b.x = b.anchor + Math.sin(now * 1.3 + b.seed) * 52;
      if (b.state === "notice") b.x += Math.sign(player.x - b.x) * 92 * dt;
      if (b.state === "swarm") b.x += Math.sign(player.x - b.x) * 176 * dt;
      if (b.state === "scattered") b.x += b.vx * dt;

      if (dog.armed && Math.abs(b.x - dog.x) < 155 && player.x > dog.x - 220) { dog.armed = false; dog.pulse = 1; b.scatter = 1.4; b.vx = b.x < dog.x ? -320 : 320; }
      if (Math.abs(b.x - puddle.x) < 105 && Math.abs(b.x - player.x) < 520 && b.slip <= 0) { puddle.pulse = 1; b.scatter = 1.1; b.slip = 3; b.vx = 420 * Math.sign(b.x - player.x || 1); }
      if (bike.active && Math.abs(b.x - bike.x) < 70) { b.scatter = 0.8; b.vx = 260 * Math.sign(b.x - bike.x || 1); }
      if (player.inv <= 0 && hit(pBox, bullyBox(b))) blinkReset();
    });
    bullies = bullies.filter((b) => b.x > camera - 500 && b.x < camera + view.w + 900);
    dog.pulse = Math.max(0, dog.pulse - dt * 1.7);
    puddle.pulse = Math.max(0, puddle.pulse - dt * 2);
    updateLyric(now);
    updateHud();
  }

  function updateLyric(now, force = false) {
    let next = 0;
    for (let i = 0; i < lyrics.length; i++) if (now >= lyrics[i][0]) next = i;
    if (force || next !== lyricIndex) {
      lyricIndex = next;
      lyricText.textContent = lyrics[next][1];
      lyricCard.classList.remove("is-pulsing");
      void lyricCard.offsetWidth;
      lyricCard.classList.add("is-pulsing");
    }
  }

  function updateHud() {
    const remain = Math.max(0, MASTER - clock());
    timerText.textContent = `${Math.floor(remain / 60)}:${Math.ceil(remain % 60).toString().padStart(2, "0")}`;
    vibeFill.style.transform = `scaleX(${clamp(player.vibe / 100, 0, 1)})`;
    distanceText.textContent = `${Math.round((player.x / (WORLD - 140)) * 100)}%`;
    sectorText.textContent = sectorAt(player.x).label;
    const states = bullies.filter((b) => Math.abs(b.x - player.x) < 900).map((b) => b.state.toUpperCase());
    pressureText.textContent = ["SWARM", "NOTICE", "SCATTERED", "SEARCH"].find((x) => states.includes(x)) || "SEARCH";
  }

  function draw() {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    const s = sectorAt(camera + view.w * 0.5);
    ctx.fillStyle = s.sky;
    ctx.fillRect(0, 0, view.w, view.h);
    drawBackdrops(s);
    drawTraps();
    bullies.forEach(drawBully);
    if (bike.active) drawBike();
    drawPlayer();
    drawBlindSpots();
    if (player.inv > 0) drawStatic();
  }

  function drawBackdrops(s) {
    const gx = -camera * 0.42;
    ctx.fillStyle = s.id === "mall" ? "#eee9d7" : s.id === "street" ? "#31404a" : "#d6b56a";
    for (let x = (gx % 240) - 240; x < view.w + 240; x += 240) ctx.fillRect(x, view.ground - 270, 170, 270);
    if (s.id === "school") { ctx.fillStyle = "#7c9b70"; ctx.fillRect(0, view.ground - 80, view.w, 80); }
    if (s.id === "mall") { ctx.fillStyle = "rgba(255,255,255,.34)"; for (let x = 70; x < view.w; x += 210) ctx.fillRect(x, 70, 90, view.ground - 105); }
    ctx.fillStyle = s.floor;
    ctx.fillRect(0, view.ground, view.w, view.h - view.ground);
    ctx.fillStyle = s.line;
    for (let x = (-camera % 220) - 220; x < view.w + 220; x += 220) ctx.fillRect(x, view.ground + 32, 118, 7);
  }

  function drawTraps() {
    const dx = screen(dog.x), px = screen(puddle.x);
    if (dx > -180 && dx < view.w + 180) {
      ctx.fillStyle = "#111217"; ctx.fillRect(dx - 54, view.ground - 44, 88, 38);
      ctx.fillStyle = "#d99a54"; ctx.fillRect(dx - 16 + dog.pulse * 30, view.ground - 58, 62, 36);
      if (dog.pulse > 0) { ctx.strokeStyle = `rgba(228,72,56,${dog.pulse})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(dx + 20, view.ground - 45, 60 + dog.pulse * 70, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (px > -180 && px < view.w + 180) {
      ctx.fillStyle = "rgba(42,167,160,.7)"; ctx.beginPath(); ctx.ellipse(px, view.ground - 5, 92 + puddle.pulse * 30, 16, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlayer() {
    const x = screen(player.x), s = stats[character], h = player.duck ? s.duck : s.h;
    shadow(x, view.ground, s.w * 0.72, 0.22);
    ctx.save(); ctx.translate(x, player.y); ctx.scale(player.face, 1);
    if (character === "acea") {
      ctx.fillStyle = "#111217"; round(-36, -h, 76, 36, 18); ctx.fillStyle = "#d99a54"; round(2, -h - 10, 34, 30, 12); ctx.fillStyle = "#111217"; ctx.fillRect(-30, -28, 9, 28); ctx.fillRect(20, -28, 9, 28);
    } else {
      ctx.fillStyle = s.color; round(-22, -h + 34, 44, h - 26, 8); ctx.fillStyle = "#7f513a"; ctx.beginPath(); ctx.arc(0, -h + 18, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#111217"; ctx.fillRect(-20, -h + 3, 40, 12); ctx.strokeStyle = "#111217"; ctx.lineWidth = 7; ctx.lineCap = "round"; const step = Math.sin(clock() * 18) * 10; ctx.beginPath(); ctx.moveTo(-10, -24); ctx.lineTo(-14 + step, -2); ctx.moveTo(12, -24); ctx.lineTo(15 - step, -2); ctx.moveTo(-20, -h + 50); ctx.lineTo(-36, -h + 62); ctx.moveTo(20, -h + 50); ctx.lineTo(36, -h + 62); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBully(b) {
    const x = screen(b.x); if (x < -120 || x > view.w + 120) return;
    shadow(x, view.ground, 34, 0.22);
    ctx.save(); ctx.translate(x, b.y); ctx.scale(b.x < player.x ? 1 : -1, 1);
    ctx.fillStyle = b.state === "swarm" ? "#e44838" : b.state === "notice" ? "#f0bd4f" : "#20242b";
    round(-24, -88, 48, 82, 10); ctx.fillStyle = "#0d0f12"; ctx.beginPath(); ctx.arc(0, -98, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff7df"; ctx.fillRect(4, -101, 10, 4);
    ctx.restore();
  }

  function drawBike() {
    const x = screen(bike.x); if (x < -120 || x > view.w + 120) return;
    ctx.strokeStyle = "#111217"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x - 24, view.ground - 20, 18, 0, Math.PI * 2); ctx.arc(x + 26, view.ground - 20, 18, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#e44838"; ctx.fillRect(x - 10, view.ground - 70, 22, 36); ctx.fillStyle = "#d99a54"; ctx.beginPath(); ctx.arc(x + 2, view.ground - 82, 11, 0, Math.PI * 2); ctx.fill();
  }

  function drawBlindSpots() {
    blind.forEach((wx, i) => {
      const x = screen(wx); if (x < -180 || x > view.w + 180) return;
      ctx.fillStyle = i % 3 === 0 ? "#224d4b" : i % 3 === 1 ? "#111217" : "#eee9d7";
      round(x - 45, view.ground - (130 + (i % 2) * 70), 90, 130 + (i % 2) * 70, 8);
    });
  }

  function drawStatic() { ctx.globalAlpha = 0.18; ctx.fillStyle = "#fff7df"; for (let y = 0; y < view.h; y += 8) ctx.fillRect(0, y, view.w, 1); ctx.globalAlpha = 1; }
  function shadow(x, y, w, a) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y + 4, w, 10, 0, 0, Math.PI * 2); ctx.fill(); }
  function round(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); }

  function loop(now) { const dt = Math.min(0.034, (now - lastFrame) / 1000 || 0); lastFrame = now; if (state === "playing") update(dt); draw(); requestAnimationFrame(loop); }

  function touch(control, active, button) {
    const map = { left: "ArrowLeft", right: "ArrowRight", duck: "ArrowDown" };
    if (map[control]) active ? keys.add(map[control]) : keys.delete(map[control]);
    if (control === "jump" && active) jumpQueued = true;
    button?.classList.toggle("is-active", active);
  }

  touchControls?.querySelectorAll("[data-touch]").forEach((button) => {
    button.addEventListener("pointerdown", (e) => { e.preventDefault(); button.setPointerCapture?.(e.pointerId); touch(button.dataset.touch, true, button); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => button.addEventListener(name, (e) => { e.preventDefault(); touch(button.dataset.touch, false, button); }));
  });
  document.querySelectorAll(".character-card").forEach((button) => button.addEventListener("click", () => {
    character = button.dataset.character;
    document.querySelectorAll(".character-card").forEach((other) => { const on = other === button; other.classList.toggle("is-selected", on); other.setAttribute("aria-pressed", String(on)); });
  }));
  window.addEventListener("keydown", (e) => { keys.add(e.code); if (["Space", "ArrowUp", "KeyW"].includes(e.code)) { jumpQueued = true; e.preventDefault(); } });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("resize", resize);
  startButton.addEventListener("click", start);
  replayButton.addEventListener("click", start);
  audio.addEventListener("ended", finalCut);
  audio.addEventListener("error", () => { audioBroken = true; if (state === "playing") fallbackClock = true; });
  resize(); reset(true); requestAnimationFrame(loop);
})();
