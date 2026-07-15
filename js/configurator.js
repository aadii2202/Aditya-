// ═══════════════════════════════════════════════════════════════
// AURION — real-time 3D configurator
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  MODELS, PAINTS, FINISHES, TRIMS, WHEELS, RIMS, TINTS, GLOWS, OPTIONS, ENVIRONMENTS, SHOWCASES,
  buildCar, attachSpoiler, attachQuadExhaust, createMaterialKit,
} from './cars.js';

// ── State ──────────────────────────────────────────────────────
const state = {
  model: 'coupe', paint: 'red', finish: 'gloss', trim: 'gblack',
  wheel: 'sport', rim: 'silver', tint: 'clear', glow: 'off',
  env: 'showroom',
  options: { spoiler: false, exhaust: false, carbonroof: false, chrome: false },
  headlights: false, autoRotate: true, motion: false,
};

// ── Tween helper ───────────────────────────────────────────────
const tweens = [];
function tween(from, to, dur, onUpdate, ease = easeOutCubic, onDone) {
  const t = { start: performance.now(), from, to, dur, onUpdate, ease, onDone, dead: false };
  tweens.push(t);
  return t;
}
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function stepTweens(now) {
  for (const t of tweens) {
    if (t.dead) continue;
    const k = Math.min((now - t.start) / t.dur, 1);
    t.onUpdate(t.from + (t.to - t.from) * t.ease(k));
    if (k >= 1) { t.dead = true; t.onDone && t.onDone(); }
  }
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].dead) tweens.splice(i, 1);
}

// ── Scene setup ────────────────────────────────────────────────
const canvas = document.getElementById('configCanvas');
const stage = canvas.parentElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
camera.position.set(6.4, 2.3, 6.0);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 0.55, 0);
controls.minDistance = 3.4;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI / 2 - 0.04;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.1;
controls.enablePan = false;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;

// lights
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(5, 8, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -7;
keyLight.shadow.camera.right = keyLight.shadow.camera.top = 7;
keyLight.shadow.bias = -0.0004;
const rimLight = new THREE.DirectionalLight(0x88aaff, 1.1);
rimLight.position.set(-6, 4, -5);
const ambLight = new THREE.HemisphereLight(0x8899bb, 0x111318, 0.5);
scene.add(keyLight, rimLight, ambLight);

// floor
const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c0e14, metalness: 0.45, roughness: 0.4 });
const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// glowing dais ring under the car
const ring = new THREE.Mesh(
  new THREE.RingGeometry(3.4, 3.52, 96),
  new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.012;
scene.add(ring);

// motion-mode road stripes
const stripes = new THREE.Group();
for (let i = 0; i < 26; i++) {
  const s = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.09),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
  );
  s.rotation.x = -Math.PI / 2;
  s.position.set(-26 + i * 2.1, 0.015, (i % 2 ? 1 : -1) * 2.6);
  stripes.add(s);
}
scene.add(stripes);

// speed-line particles for motion mode
const speedGeo = new THREE.BufferGeometry();
const SPEED_N = 260;
{
  const pos = new Float32Array(SPEED_N * 3);
  for (let i = 0; i < SPEED_N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 40;
    pos[i * 3 + 1] = Math.random() * 4 + 0.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 24;
  }
  speedGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const speedPts = new THREE.Points(speedGeo, new THREE.PointsMaterial({
  color: 0x9fd8ff, size: 0.05, transparent: true, opacity: 0, depthWrite: false,
}));
scene.add(speedPts);

// headlight beams
const beamL = new THREE.SpotLight(0xdff0ff, 0, 30, 0.5, 0.5, 1.2);
const beamR = beamL.clone();
const beamTargetL = new THREE.Object3D();
const beamTargetR = new THREE.Object3D();
beamL.target = beamTargetL; beamR.target = beamTargetR;
scene.add(beamL, beamR, beamTargetL, beamTargetR);

const glowLight = new THREE.PointLight(0x25e8ff, 0, 7, 1.6);
glowLight.position.set(0, 0.25, 0);
scene.add(glowLight);

// ── Car management ─────────────────────────────────────────────
const mats = createMaterialKit();
let car = null;
let spoilerNode = null;
let quadPipes = [];
let motionSpeed = 0; // eased 0..1

function priceTable() {
  const find = (arr, id) => arr.find((e) => e.id === id);
  const rows = [
    ['Model', find(MODELS, state.model).name, find(MODELS, state.model).price],
    ['Paint', find(PAINTS, state.paint).name, find(PAINTS, state.paint).price],
    ['Finish', find(FINISHES, state.finish).name, find(FINISHES, state.finish).price],
    ['Trim', find(TRIMS, state.trim).name, find(TRIMS, state.trim).price],
    ['Wheels', find(WHEELS, state.wheel).name, find(WHEELS, state.wheel).price],
    ['Rims', find(RIMS, state.rim).name, find(RIMS, state.rim).price],
    ['Tint', find(TINTS, state.tint).name, find(TINTS, state.tint).price],
  ];
  const glow = find(GLOWS, state.glow);
  if (glow.hex) rows.push(['Underglow', glow.name, glow.price]);
  for (const o of OPTIONS) if (state.options[o.id]) rows.push(['Option', o.name, o.price]);
  return rows;
}
function totalPrice() { return priceTable().reduce((s, r) => s + r[2], 0); }

function rebuildCar(animated = true) {
  if (showcase.active) closeShowcase();
  const spawn = () => {
    if (car) {
      scene.remove(car);
      car.traverse((o) => o.geometry && o.geometry.dispose());
    }
    car = buildCar(state, mats);
    scene.add(car);
    spoilerNode = state.options.spoiler ? attachSpoiler(car, mats) : null;
    quadPipes = state.options.exhaust ? attachQuadExhaust(car, mats) : [];
    applyRoof();
    applyGlow();
    applyHeadlights();
    document.getElementById('hudModelName').textContent = MODELS.find((m) => m.id === state.model).name;
    if (animated) {
      car.scale.setScalar(0.001);
      car.rotation.y = -0.7;
      tween(0, 1, 750, (v) => {
        car.scale.setScalar(0.001 + 0.999 * v);
        car.rotation.y = -0.7 * (1 - v);
        car.position.y = Math.sin(v * Math.PI) * 0.25;
      }, easeOutCubic, () => { car.position.y = 0; });
    }
  };
  if (animated && car) {
    const old = car;
    tween(1, 0, 320, (v) => { old.scale.setScalar(Math.max(v, 0.001)); old.rotation.y += 0.04; }, undefined, spawn);
  } else spawn();
  updatePrice();
}

// live material updates (no rebuild needed)
function applyPaint(animated = true) {
  const p = PAINTS.find((e) => e.id === state.paint);
  const target = new THREE.Color(p.hex);
  if (!animated) { mats.paint.color.copy(target); return; }
  const from = mats.paint.color.clone();
  tween(0, 1, 480, (v) => mats.paint.color.copy(from).lerp(target, v));
  updatePrice();
}
function applyFinish() {
  const f = FINISHES.find((e) => e.id === state.finish);
  mats.paint.metalness = f.metalness;
  mats.paint.roughness = f.roughness;
  mats.paint.clearcoat = f.clearcoat;
  mats.paint.needsUpdate = true;
  updatePrice();
}
function applyTrim() {
  const t = TRIMS.find((e) => e.id === state.trim);
  mats.trim.color.set(t.hex);
  updatePrice();
}
function applyRim() {
  const r = RIMS.find((e) => e.id === state.rim);
  mats.rim.color.set(r.hex);
  updatePrice();
}
function applyTint() {
  const t = TINTS.find((e) => e.id === state.tint);
  const from = mats.glass.opacity;
  const fromC = mats.glass.color.clone();
  const toC = new THREE.Color(t.hex);
  tween(0, 1, 400, (v) => {
    mats.glass.opacity = from + (t.opacity - from) * v;
    mats.glass.color.copy(fromC).lerp(toC, v);
  });
  updatePrice();
}
function applyGlow() {
  const g = GLOWS.find((e) => e.id === state.glow);
  const mesh = car && car.userData.glowMesh;
  if (!mesh) return;
  if (!g.hex) {
    mesh.visible = false;
    glowLight.intensity = 0;
  } else {
    mesh.visible = true;
    mesh.material.color.set(g.hex);
    glowLight.color.set(g.hex);
    glowLight.intensity = 2.4;
  }
  updatePrice();
}
function applyRoof() {
  const roof = car && car.userData.roofMesh;
  if (roof) roof.material = state.options.carbonroof ? mats.dark : mats.paint;
}
function applyChrome() {
  mats.chrome.color.set(state.options.chrome ? 0x15161a : 0xd9dde4);
  mats.chrome.metalness = state.options.chrome ? 0.6 : 1.0;
}
function applyHeadlights() {
  const on = state.headlights;
  mats.headlight.emissiveIntensity = on ? 3.2 : 0.35;
  mats.taillight.emissiveIntensity = on ? 2.4 : 0.5;
  beamL.intensity = beamR.intensity = on ? 40 : 0;
}
function applyEnvironment() {
  const e = ENVIRONMENTS.find((x) => x.id === state.env);
  scene.background = makeGradientTexture(e.bgTop, e.bgBot);
  scene.environmentIntensity = e.envInt;
  scene.fog = new THREE.Fog(e.fog, 18, 46);
  floorMat.color.set(e.floor);
  keyLight.color.set(e.key);
  keyLight.intensity = e.keyInt;
  ambLight.color.set(e.amb);
  ambLight.intensity = e.ambInt;
  const dark = state.env !== 'studio';
  ring.material.opacity = dark ? 0.5 : 0.22;
  speedPts.material.color.set(dark ? 0x9fd8ff : 0x445566);
}

function makeGradientTexture(top, bot) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#' + new THREE.Color(top).getHexString());
  g.addColorStop(1, '#' + new THREE.Color(bot).getHexString());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Camera presets ─────────────────────────────────────────────
const VIEWS = {
  beauty: { pos: [6.4, 2.3, 6.0], tgt: [0, 0.55, 0] },
  front:  { pos: [7.6, 1.2, 0.01], tgt: [0, 0.6, 0] },
  side:   { pos: [0.01, 1.3, 7.8], tgt: [0, 0.6, 0] },
  rear:   { pos: [-7.6, 1.5, 0.01], tgt: [0, 0.6, 0] },
  top:    { pos: [0.02, 9.5, 0.02], tgt: [0, 0, 0] },
};
function flyTo(viewId) {
  const v = VIEWS[viewId];
  const p0 = camera.position.clone();
  const t0 = controls.target.clone();
  const p1 = new THREE.Vector3(...v.pos);
  const t1 = new THREE.Vector3(...v.tgt);
  tween(0, 1, 900, (k) => {
    camera.position.lerpVectors(p0, p1, k);
    controls.target.lerpVectors(t0, t1, k);
  });
}

// ── Price UI ───────────────────────────────────────────────────
const priceEl = document.getElementById('priceValue');
let shownPrice = 0;
function updatePrice() {
  const target = totalPrice();
  const from = shownPrice;
  tween(0, 1, 600, (v) => {
    shownPrice = Math.round(from + (target - from) * v);
    priceEl.textContent = '$' + shownPrice.toLocaleString();
  });
}

// ── UI builders ────────────────────────────────────────────────
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function mount(containerId, items, render, onPick, activeId) {
  const box = document.getElementById(containerId);
  items.forEach((item) => {
    const node = render(item);
    if (item.id === activeId) node.classList.add('is-active');
    node.addEventListener('click', () => {
      box.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
      node.classList.add('is-active');
      onPick(item);
    });
    box.appendChild(node);
  });
}

const fmt = (n) => (n ? `+$${n.toLocaleString()}` : 'Included');

mount('modelGrid', MODELS, (m) => el(
  `<button class="model-card">
     <span class="model-card__icon">${m.icon}</span>
     <span><span class="model-card__name">${m.name}</span><br/><span class="model-card__meta">${m.meta}</span></span>
     <span class="model-card__price">$${m.price.toLocaleString()}</span>
   </button>`
), (m) => { state.model = m.id; rebuildCar(); }, state.model);

mount('paintGrid', PAINTS, (p) => el(
  `<button class="swatch" data-name="${p.name} ${p.price ? '· +$' + p.price.toLocaleString() : ''}" style="--sw:#${p.hex.toString(16).padStart(6, '0')}"></button>`
), (p) => { state.paint = p.id; applyPaint(); }, state.paint);

mount('finishRow', FINISHES, (f) => el(
  `<button class="chip">${f.name} <small>${fmt(f.price)}</small></button>`
), (f) => { state.finish = f.id; applyFinish(); }, state.finish);

mount('trimGrid', TRIMS, (t) => el(
  `<button class="swatch" data-name="${t.name}" style="--sw:#${t.hex.toString(16).padStart(6, '0')}"></button>`
), (t) => { state.trim = t.id; applyTrim(); }, state.trim);

mount('wheelGrid', WHEELS, (w) => el(
  `<button class="chip">${w.name} — ${w.desc} <small>${fmt(w.price)}</small></button>`
), (w) => { state.wheel = w.id; rebuildCar(); }, state.wheel);

mount('rimRow', RIMS, (r) => el(
  `<button class="chip">${r.name} <small>${fmt(r.price)}</small></button>`
), (r) => { state.rim = r.id; applyRim(); }, state.rim);

mount('tintRow', TINTS, (t) => el(
  `<button class="chip">${t.name} <small>${fmt(t.price)}</small></button>`
), (t) => { state.tint = t.id; applyTint(); }, state.tint);

mount('glowRow', GLOWS, (g) => el(
  `<button class="chip">${g.name} <small>${fmt(g.price)}</small></button>`
), (g) => { state.glow = g.id; applyGlow(); }, state.glow);

mount('envGrid', ENVIRONMENTS, (e) => el(
  `<button class="env-card" style="--env-bg:${e.css}"><span>${e.name}</span></button>`
), (e) => { state.env = e.id; applyEnvironment(); }, state.env);

// option toggles
{
  const box = document.getElementById('optList');
  OPTIONS.forEach((o) => {
    const node = el(
      `<button class="opt">
         <span><span class="opt__name">${o.name}</span><br/><span class="opt__price">${fmt(o.price)}</span></span>
         <span class="opt__switch"></span>
       </button>`
    );
    node.addEventListener('click', () => {
      state.options[o.id] = !state.options[o.id];
      node.classList.toggle('is-active', state.options[o.id]);
      if (o.id === 'spoiler') {
        if (state.options.spoiler) {
          spoilerNode = attachSpoiler(car, mats);
          spoilerNode.scale.setScalar(0.001);
          tween(0.001, 1, 450, (v) => spoilerNode.scale.setScalar(v));
        } else if (spoilerNode) { car.remove(spoilerNode); spoilerNode = null; }
      }
      if (o.id === 'exhaust') {
        if (state.options.exhaust) quadPipes = attachQuadExhaust(car, mats);
        else { quadPipes.forEach((p) => car.remove(p)); quadPipes = []; }
        // remove stock pipes when quad fitted
        car.traverse((c) => { if (c.name === 'exhaust') c.visible = !state.options.exhaust; });
      }
      if (o.id === 'carbonroof') applyRoof();
      if (o.id === 'chrome') applyChrome();
      updatePrice();
    });
    box.appendChild(node);
  });
}

// ── 360° real-footage showcase ─────────────────────────────────
const showcaseEl = document.getElementById('showcase');
const showcaseImg = document.getElementById('showcaseImg');
const showcase = { active: null, frame: 0, images: [], loaded: 0, spin: true, lastSpin: 0 };

function showcaseSrc(sc, i) { return `${sc.dir}/f${String(i).padStart(2, '0')}.webp`; }

function openShowcase(sc, cardEl) {
  document.querySelectorAll('.show-card').forEach((n) => n.classList.remove('is-active'));
  cardEl.classList.add('is-active');
  showcase.active = sc;
  showcase.frame = 0;
  showcase.spin = true;
  showcase.images = new Array(sc.frames);
  showcase.loaded = 0;
  for (let i = 0; i < sc.frames; i++) {
    const im = new Image();
    im.src = showcaseSrc(sc, i);
    im.onload = () => { showcase.loaded++; };
    showcase.images[i] = im;
  }
  showcaseImg.src = showcaseSrc(sc, 0);
  showcaseEl.hidden = false;
  if (car) car.visible = false;
  controls.autoRotate = false;
  document.getElementById('hudModelName').textContent = sc.name + ' · 360°';
}

function closeShowcase() {
  showcase.active = null;
  showcaseEl.hidden = true;
  document.querySelectorAll('.show-card').forEach((n) => n.classList.remove('is-active'));
  if (car) car.visible = true;
  controls.autoRotate = state.autoRotate;
  document.getElementById('hudModelName').textContent = MODELS.find((m) => m.id === state.model).name;
}

function setShowcaseFrame(i) {
  const sc = showcase.active;
  if (!sc) return;
  showcase.frame = ((i % sc.frames) + sc.frames) % sc.frames;
  const im = showcase.images[showcase.frame];
  if (im && im.complete) showcaseImg.src = im.src;
}

mount('showGrid', SHOWCASES, (s) => el(
  `<button class="show-card">
     <img class="show-card__thumb" src="${showcaseSrc(s, 0)}" alt="" loading="lazy" draggable="false"/>
     <span><span class="show-card__name">${s.name}</span><br/><span class="show-card__meta">${s.desc}</span></span>
     <span class="show-card__badge">360°</span>
   </button>`
), () => {}, null);
// mount() handles active-state styling; attach open handlers with card refs
document.querySelectorAll('#showGrid .show-card').forEach((cardEl, idx) => {
  cardEl.addEventListener('click', () => openShowcase(SHOWCASES[idx], cardEl));
});

document.getElementById('showcaseClose').addEventListener('click', closeShowcase);

// drag to rotate (pointer events cover mouse + touch)
{
  let dragging = false, startX = 0, startFrame = 0;
  showcaseEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.showcase__close')) return; // don't capture the close button's click
    dragging = true; startX = e.clientX; startFrame = showcase.frame;
    showcase.spin = false;
    showcaseEl.classList.add('is-dragging');
    showcaseEl.setPointerCapture(e.pointerId);
  });
  showcaseEl.addEventListener('pointermove', (e) => {
    if (!dragging || !showcase.active) return;
    const perFrame = showcaseEl.clientWidth / showcase.active.frames / 1.6;
    setShowcaseFrame(startFrame + Math.round((e.clientX - startX) / perFrame));
  });
  const end = () => {
    dragging = false;
    showcaseEl.classList.remove('is-dragging');
    setTimeout(() => { if (!dragging) showcase.spin = true; }, 2200);
  };
  showcaseEl.addEventListener('pointerup', end);
  showcaseEl.addEventListener('pointercancel', end);
}

// ── Tabs ───────────────────────────────────────────────────────
document.querySelectorAll('.panel__tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.panel__tab').forEach((t) => t.classList.remove('is-active'));
    document.querySelectorAll('.panel__page').forEach((p) => p.classList.remove('is-active'));
    tab.classList.add('is-active');
    document.querySelector(`[data-page="${tab.dataset.tab}"]`).classList.add('is-active');
  });
});

// ── Toolbar ────────────────────────────────────────────────────
const btnRotate = document.getElementById('btnAutoRotate');
btnRotate.addEventListener('click', () => {
  state.autoRotate = !state.autoRotate;
  controls.autoRotate = state.autoRotate;
  btnRotate.classList.toggle('is-active', state.autoRotate);
});

const btnMotion = document.getElementById('btnMotion');
btnMotion.addEventListener('click', () => {
  state.motion = !state.motion;
  btnMotion.classList.toggle('is-active', state.motion);
  if (state.motion && state.autoRotate) btnRotate.click();
});

const btnLights = document.getElementById('btnLights');
btnLights.addEventListener('click', () => {
  state.headlights = !state.headlights;
  btnLights.classList.toggle('is-active', state.headlights);
  applyHeadlights();
});

document.getElementById('btnSnapshot').addEventListener('click', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.download = `aurion-${state.model}-${state.paint}.png`;
  a.href = renderer.domElement.toDataURL('image/png');
  a.click();
});

// camera view buttons
document.querySelectorAll('.hud__view').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.hud__view').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
    flyTo(b.dataset.view);
  });
});

// ── Summary modal ──────────────────────────────────────────────
const modal = document.getElementById('summaryModal');
document.getElementById('btnSummary').addEventListener('click', () => {
  const list = document.getElementById('summaryList');
  list.innerHTML = '';
  for (const [cat, name, price] of priceTable()) {
    list.appendChild(el(`<li><span>${cat} — <strong>${name}</strong></span><span>${price ? '$' + price.toLocaleString() : '—'}</span></li>`));
  }
  document.getElementById('summaryTotal').textContent = '$' + totalPrice().toLocaleString();
  modal.setAttribute('aria-hidden', 'false');
});
modal.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', () => modal.setAttribute('aria-hidden', 'true')));

// ── Resize ─────────────────────────────────────────────────────
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

// ── Render loop ────────────────────────────────────────────────
const clock = new THREE.Clock();
let ready = false;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  stepTweens(now);
  controls.update();

  // ease motion factor
  motionSpeed += ((state.motion ? 1 : 0) - motionSpeed) * Math.min(dt * 2.4, 1);

  if (car) {
    // wheel spin + steer
    const spin = motionSpeed * dt * 22 / (car.userData.wheelRadius * 2);
    for (const w of car.userData.wheels) {
      w.rotation.z -= spin * (w.rotation.y > 1 ? -1 : 1);
      if (w.userData.isFront) w.rotation.y = (w.position.z > 0 ? 0 : Math.PI) + Math.sin(now * 0.0012) * 0.05 * motionSpeed;
    }
    // subtle body float
    car.position.y = Math.sin(now * 0.0045) * 0.012 * motionSpeed;
    car.rotation.z = Math.sin(now * 0.003) * 0.004 * motionSpeed;

    // headlight beams follow the car nose
    const noseWorld = new THREE.Vector3(2.4, 0.55, 0).applyMatrix4(car.matrixWorld);
    const aheadWorld = new THREE.Vector3(12, 0.2, 0).applyMatrix4(car.matrixWorld);
    beamL.position.copy(noseWorld).add(new THREE.Vector3(0, 0, 0.5));
    beamR.position.copy(noseWorld).add(new THREE.Vector3(0, 0, -0.5));
    beamTargetL.position.copy(aheadWorld);
    beamTargetR.position.copy(aheadWorld);
  }

  // road stripes + speed lines
  stripes.children.forEach((s) => {
    s.material.opacity = 0.22 * motionSpeed;
    s.position.x -= dt * 20 * motionSpeed;
    if (s.position.x < -27) s.position.x += 54.6;
  });
  speedPts.material.opacity = 0.65 * motionSpeed;
  if (motionSpeed > 0.01) {
    const pos = speedGeo.attributes.position;
    for (let i = 0; i < SPEED_N; i++) {
      let x = pos.getX(i) - dt * 34 * motionSpeed;
      if (x < -20) x += 40;
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  }

  // dais ring pulse
  ring.material.opacity = (state.env !== 'studio' ? 0.4 : 0.18) + Math.sin(now * 0.002) * 0.12;

  // 360° showcase idle spin
  if (showcase.active && showcase.spin && now - showcase.lastSpin > 110) {
    showcase.lastSpin = now;
    setShowcaseFrame(showcase.frame + 1);
  }

  renderer.render(scene, camera);

  if (!ready) {
    ready = true;
    document.getElementById('stageLoading').classList.add('is-done');
  }
}

// ── Boot ───────────────────────────────────────────────────────
applyEnvironment();
applyPaint(false);
applyFinish();
resize();
rebuildCar(true);
animate();
