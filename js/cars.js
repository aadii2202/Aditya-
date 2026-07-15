// ═══════════════════════════════════════════════════════════════
// AURION — procedural vehicle factory
// Builds every vehicle from parametric geometry so the configurator
// renders the real configured car (no static dummy images).
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ── Catalogue data ─────────────────────────────────────────────
export const MODELS = [
  { id: 'coupe',    name: 'Velocity GT',  icon: '🏎️', meta: 'Twin-motor sports coupé · 780 hp', price: 98000 },
  { id: 'roadster', name: 'Zephyr R',     icon: '🌤️', meta: 'Open-top roadster · 610 hp',       price: 112000 },
  { id: 'sedan',    name: 'Eclipse S',    icon: '🚘', meta: 'Executive sedan · 520 hp',         price: 74000 },
  { id: 'suv',      name: 'Apex X',       icon: '🚙', meta: 'Performance SUV · 640 hp',         price: 86000 },
  { id: 'pickup',   name: 'Titan T',      icon: '🛻', meta: 'Electric pickup · 700 hp',         price: 79000 },
];

export const PAINTS = [
  { id: 'black',   name: 'Midnight Black',  hex: 0x0d0d12, price: 0 },
  { id: 'white',   name: 'Arctic White',    hex: 0xe8eaee, price: 0 },
  { id: 'silver',  name: 'Liquid Silver',   hex: 0xb8bec8, price: 900 },
  { id: 'grey',    name: 'Graphite Grey',   hex: 0x4a4e57, price: 900 },
  { id: 'red',     name: 'Velocity Red',    hex: 0xd81e2c, price: 1400 },
  { id: 'orange',  name: 'Sunburst Orange', hex: 0xf26722, price: 1400 },
  { id: 'yellow',  name: 'Solar Yellow',    hex: 0xf5c518, price: 1400 },
  { id: 'green',   name: 'British Green',   hex: 0x0d5c37, price: 1400 },
  { id: 'blue',    name: 'Ocean Blue',      hex: 0x1441a0, price: 1400 },
  { id: 'cyan',    name: 'Electric Cyan',   hex: 0x19c4d8, price: 1900 },
  { id: 'violet',  name: 'Ultraviolet',     hex: 0x6a2fd0, price: 1900 },
  { id: 'magenta', name: 'Rose Magenta',    hex: 0xc22a6c, price: 1900 },
];

export const FINISHES = [
  { id: 'gloss', name: 'Gloss',    price: 0,    metalness: 0.35, roughness: 0.18, clearcoat: 1.0 },
  { id: 'metal', name: 'Metallic', price: 1200, metalness: 0.85, roughness: 0.28, clearcoat: 1.0 },
  { id: 'satin', name: 'Satin',    price: 1600, metalness: 0.55, roughness: 0.45, clearcoat: 0.4 },
  { id: 'matte', name: 'Matte',    price: 2200, metalness: 0.25, roughness: 0.78, clearcoat: 0.0 },
];

export const TRIMS = [
  { id: 'gblack',  name: 'Gloss Black', hex: 0x0a0a0c, price: 0 },
  { id: 'carbon',  name: 'Carbon',      hex: 0x1c1e22, price: 850 },
  { id: 'silver',  name: 'Silver',      hex: 0xb9bfc9, price: 450 },
  { id: 'gold',    name: 'Gold',        hex: 0xc9a227, price: 950 },
  { id: 'cyan',    name: 'Cyan Line',   hex: 0x19c4d8, price: 650 },
  { id: 'red',     name: 'Red Line',    hex: 0xc41f2c, price: 650 },
];

export const WHEELS = [
  { id: 'sport',   name: 'Sport 5-Spoke',   desc: '20″ forged alloy',  price: 0 },
  { id: 'turbine', name: 'Turbine 9',       desc: '21″ aero turbine',  price: 1800 },
  { id: 'mesh',    name: 'Classic Mesh',    desc: '20″ 12-spoke mesh', price: 1200 },
  { id: 'aero',    name: 'Aero Disc',       desc: '21″ full aero disc', price: 2400 },
];

export const RIMS = [
  { id: 'silver', name: 'Silver',      hex: 0xc7ccd6, price: 0 },
  { id: 'black',  name: 'Gloss Black', hex: 0x111114, price: 350 },
  { id: 'gun',    name: 'Gunmetal',    hex: 0x565b64, price: 350 },
  { id: 'gold',   name: 'Gold',        hex: 0xd0a52c, price: 700 },
  { id: 'bronze', name: 'Bronze',      hex: 0x9c6b3a, price: 700 },
];

export const TINTS = [
  { id: 'clear', name: 'Clear',  price: 0,   opacity: 0.30, hex: 0x9fc4d8 },
  { id: 'smoke', name: 'Smoke',  price: 300, opacity: 0.55, hex: 0x51616e },
  { id: 'dark',  name: 'Dark',   price: 450, opacity: 0.74, hex: 0x28323b },
  { id: 'limo',  name: 'Limo',   price: 600, opacity: 0.90, hex: 0x0d1216 },
];

export const GLOWS = [
  { id: 'off',    name: 'Off',    price: 0,   hex: null },
  { id: 'cyan',   name: 'Cyan',   price: 750, hex: 0x25e8ff },
  { id: 'violet', name: 'Violet', price: 750, hex: 0x8b45ff },
  { id: 'red',    name: 'Red',    price: 750, hex: 0xff2d3e },
  { id: 'green',  name: 'Green',  price: 750, hex: 0x2dff7c },
];

export const OPTIONS = [
  { id: 'spoiler', name: 'Aero Rear Wing',   price: 1800 },
  { id: 'exhaust', name: 'Quad Sport Exhaust', price: 1300 },
  { id: 'carbonroof', name: 'Carbon Roof',   price: 2100 },
  { id: 'chrome',  name: 'Chrome Delete',    price: 600 },
];

// Real-footage 360° showcases (frame sequences with removed backgrounds)
export const SHOWCASES = [
  { id: 'taycan',   name: 'Taycan Electric',   desc: 'Electric blue · studio orbit', dir: 'assets/showcase/taycan',   frames: 36 },
  { id: 'panamera', name: 'Panamera Grand',    desc: 'Executive grey · city set',    dir: 'assets/showcase/panamera', frames: 36 },
  { id: 'coastal',  name: 'Carrera Coastal',   desc: 'Guards red · coastal run',     dir: 'assets/showcase/coastal',  frames: 36 },
];

export const ENVIRONMENTS = [
  { id: 'showroom', name: 'Showroom',   bgTop: 0x11141d, bgBot: 0x05060a, floor: 0x0c0e14, fog: 0x05060a, key: 0xffffff, keyInt: 2.6, amb: 0x8899bb, ambInt: 0.5, envInt: 0.45, css: 'linear-gradient(160deg,#1a1e2c,#05060a)' },
  { id: 'studio',   name: 'Studio',     bgTop: 0xe9ebef, bgBot: 0xb9bec9, floor: 0xd6d9df, fog: 0xc4c8d1, key: 0xffffff, keyInt: 3.2, amb: 0xffffff, ambInt: 0.9, envInt: 1.0,  css: 'linear-gradient(160deg,#f2f3f6,#b9bec9)' },
  { id: 'sunset',   name: 'Sunset',     bgTop: 0x3d2a55, bgBot: 0xd96b3c, floor: 0x241a20, fog: 0x8f4a3a, key: 0xffb37a, keyInt: 3.0, amb: 0xff9a66, ambInt: 0.55, envInt: 0.5, css: 'linear-gradient(160deg,#3d2a55,#d96b3c)' },
  { id: 'night',    name: 'Night City', bgTop: 0x060a18, bgBot: 0x0b1230, floor: 0x070a14, fog: 0x060a18, key: 0x9db8ff, keyInt: 1.7, amb: 0x4455aa, ambInt: 0.45, envInt: 0.16, css: 'linear-gradient(160deg,#0b1230,#060a18)' },
];

// ── Small helpers ──────────────────────────────────────────────
function rbox(w, h, d, r, mat) {
  const g = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2));
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

// ── Wheels ─────────────────────────────────────────────────────
export function buildWheel(styleId, radius, width, mats) {
  const g = new THREE.Group();
  const rimR = radius * 0.58;

  // tire — torus so the rim face stays visible from the side
  const tire = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.76, radius * 0.24, 16, 44), mats.tire);
  tire.castShadow = true;
  g.add(tire);

  // recessed dark backing disc behind the spokes
  const back = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 1.04, rimR * 1.04, width * 0.3, 32), mats.dark);
  back.rotation.x = Math.PI / 2;
  back.position.z = -width * 0.04;
  g.add(back);

  // rim lip
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, radius * 0.05, 10, 36), mats.rim);
  lip.position.z = width * 0.2;
  g.add(lip);

  const face = new THREE.Group();
  face.position.z = width * 0.17;

  const addSpokes = (count, sw, twist = 0) => {
    const sl = rimR * 1.04;
    for (let i = 0; i < count; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(sw, sl, width * 0.18), mats.rim);
      const a = (i / count) * Math.PI * 2;
      s.position.set(Math.sin(a) * sl * 0.5, Math.cos(a) * sl * 0.5, 0);
      s.rotation.z = -a + twist;
      face.add(s);
    }
  };

  if (styleId === 'sport')        addSpokes(5, radius * 0.17);
  else if (styleId === 'turbine') addSpokes(9, radius * 0.1, 0.4);
  else if (styleId === 'mesh')    addSpokes(12, radius * 0.055);
  else { // aero — solid disc
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, width * 0.12, 32), mats.rim);
    disc.rotation.x = Math.PI / 2;
    face.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rimR * 0.6, radius * 0.028, 10, 32), mats.trim);
    ring.position.z = width * 0.07;
    face.add(ring);
  }

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.11, radius * 0.11, width * 0.6, 16), mats.chrome);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = width * 0.1;
  g.add(cap, face);
  return g;
}

// ── Shared vehicle pieces ──────────────────────────────────────
function addLights(car, mats, { x, y, w, z = 0.62, rear = true }) {
  // headlights
  for (const s of [-1, 1]) {
    const h = at(rbox(0.08, 0.09, w, 0.03, mats.headlight), x, y, s * z);
    h.name = 'headlight';
    car.add(h);
  }
  if (rear) {
    const t = at(rbox(0.07, 0.09, z * 2 + w, 0.03, mats.taillight), -x - 0.02, y + 0.02, 0);
    t.name = 'taillight';
    car.add(t);
  }
}

function addMirrors(car, mats, x, y, z) {
  for (const s of [-1, 1]) {
    const m = at(rbox(0.16, 0.09, 0.22, 0.03, mats.trim), x, y, s * z);
    m.name = 'trimpart';
    car.add(m);
  }
}

function addExhaust(car, mats, x, y, spread, quad) {
  const n = quad ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.16, 14), mats.chrome);
    p.rotation.z = Math.PI / 2;
    const off = quad ? (i - 1.5) * spread * 0.5 : (i - 0.5) * spread;
    p.position.set(x, y, off);
    p.name = quad ? 'exhaust-quad' : 'exhaust';
    car.add(p);
  }
}

function addSpoiler(car, mats, x, y, width) {
  const grp = new THREE.Group();
  grp.name = 'spoiler';
  const wing = at(rbox(0.34, 0.05, width, 0.02, mats.trim), 0, 0.18, 0);
  wing.rotation.z = 0.12;
  for (const s of [-1, 1]) {
    grp.add(at(rbox(0.06, 0.2, 0.05, 0.01, mats.trim), 0.02, 0.03, s * width * 0.36));
  }
  grp.add(wing);
  grp.position.set(x, y, 0);
  car.add(grp);
  return grp;
}

// ── Vehicle builders ───────────────────────────────────────────
// Each returns { group, wheelInfo:{radius,width,positions[[x,y,z,steer]]}, roofMesh }

function buildCoupe(mats, open = false) {
  const car = new THREE.Group();

  // main body — low wedge
  const body = at(rbox(4.35, 0.52, 1.88, 0.2, mats.paint), 0, 0.5, 0);
  body.name = 'paint';
  // nose
  const nose = at(rbox(1.1, 0.34, 1.7, 0.14, mats.paint), 1.85, 0.42, 0);
  nose.name = 'paint';
  // rear haunches
  const rear = at(rbox(1.0, 0.6, 1.92, 0.2, mats.paint), -1.7, 0.56, 0);
  rear.name = 'paint';
  car.add(body, nose, rear);

  // cabin — painted shell with a wraparound glass band
  let roofMesh = null;
  if (!open) {
    const shell = at(rbox(1.85, 0.44, 1.55, 0.2, mats.paint), -0.25, 0.95, 0);
    shell.name = 'paint';
    const band = at(rbox(1.93, 0.3, 1.58, 0.14, mats.glass), -0.25, 1.04, 0);
    band.name = 'glass';
    roofMesh = at(rbox(1.34, 0.06, 1.46, 0.03, mats.paint), -0.28, 1.22, 0);
    roofMesh.name = 'roof';
    car.add(shell, band, roofMesh);
  } else {
    const shield = at(rbox(0.09, 0.42, 1.45, 0.04, mats.glass), 0.62, 0.95, 0);
    shield.rotation.z = -0.42;
    shield.name = 'glass';
    const tonneau = at(rbox(1.15, 0.12, 1.5, 0.05, mats.trim), -0.85, 0.82, 0);
    tonneau.name = 'trimpart';
    for (const s of [-1, 1]) {
      const hump = at(rbox(0.5, 0.18, 0.34, 0.08, mats.paint), -0.8, 0.9, s * 0.42);
      hump.name = 'paint';
      car.add(hump);
    }
    car.add(shield, tonneau);
  }

  // hood + fastback slopes so the cabin flows into the body
  const hood = at(rbox(1.24, 0.07, 1.6, 0.03, mats.paint), 1.26, 0.74, 0);
  hood.rotation.z = -0.245;
  hood.name = 'paint';
  car.add(hood);
  if (!open) {
    const fastback = at(rbox(0.85, 0.07, 1.48, 0.03, mats.paint), -1.32, 1.02, 0);
    fastback.rotation.z = 0.415;
    fastback.name = 'paint';
    car.add(fastback);
  }

  // splitter, skirts, diffuser
  const splitter = at(rbox(0.5, 0.08, 1.9, 0.03, mats.trim), 2.2, 0.24, 0);
  splitter.name = 'trimpart';
  const diffuser = at(rbox(0.4, 0.14, 1.8, 0.04, mats.trim), -2.2, 0.26, 0);
  diffuser.name = 'trimpart';
  car.add(splitter, diffuser);
  for (const s of [-1, 1]) {
    const skirt = at(rbox(2.2, 0.1, 0.12, 0.03, mats.trim), 0, 0.24, s * 0.92);
    skirt.name = 'trimpart';
    car.add(skirt);
  }

  addLights(car, mats, { x: 2.34, y: 0.5, w: 0.5 });
  addMirrors(car, mats, 0.75, 1.02, 1.0);
  addExhaust(car, mats, -2.42, 0.32, 0.5, false);

  return {
    group: car, roofMesh,
    spoilerAnchor: { x: -2.05, y: 0.86, width: 1.6 },
    exhaustAnchor: { x: -2.42, y: 0.32, spread: 0.5 },
    wheelInfo: { radius: 0.34, width: 0.26, positions: [[1.42, 0.34, 0.86], [1.42, 0.34, -0.86], [-1.45, 0.34, 0.86], [-1.45, 0.34, -0.86]] },
  };
}

function buildSedan(mats) {
  const car = new THREE.Group();
  const body = at(rbox(4.65, 0.6, 1.84, 0.18, mats.paint), 0, 0.55, 0);
  body.name = 'paint';
  const hood = at(rbox(1.2, 0.4, 1.66, 0.12, mats.paint), 1.85, 0.5, 0);
  hood.name = 'paint';
  const trunk = at(rbox(0.9, 0.46, 1.7, 0.12, mats.paint), -1.95, 0.55, 0);
  trunk.name = 'paint';
  const shell = at(rbox(2.35, 0.48, 1.6, 0.22, mats.paint), -0.25, 1.05, 0);
  shell.name = 'paint';
  const band = at(rbox(2.43, 0.32, 1.63, 0.15, mats.glass), -0.25, 1.16, 0);
  band.name = 'glass';
  const roof = at(rbox(1.7, 0.07, 1.5, 0.03, mats.paint), -0.27, 1.35, 0);
  roof.name = 'roof';
  car.add(body, hood, trunk, shell, band, roof);

  const chin = at(rbox(0.3, 0.1, 1.7, 0.03, mats.trim), 2.42, 0.3, 0);
  chin.name = 'trimpart';
  car.add(chin);
  for (const s of [-1, 1]) {
    const skirt = at(rbox(2.4, 0.09, 0.1, 0.03, mats.trim), 0, 0.27, s * 0.9);
    skirt.name = 'trimpart';
    car.add(skirt);
  }

  addLights(car, mats, { x: 2.46, y: 0.56, w: 0.44 });
  addMirrors(car, mats, 0.85, 1.12, 0.98);
  addExhaust(car, mats, -2.52, 0.34, 0.55, false);

  return {
    group: car, roofMesh: roof,
    spoilerAnchor: { x: -2.25, y: 0.84, width: 1.5 },
    exhaustAnchor: { x: -2.52, y: 0.34, spread: 0.55 },
    wheelInfo: { radius: 0.35, width: 0.25, positions: [[1.5, 0.35, 0.84], [1.5, 0.35, -0.84], [-1.5, 0.35, 0.84], [-1.5, 0.35, -0.84]] },
  };
}

function buildSUV(mats) {
  const car = new THREE.Group();
  const body = at(rbox(4.55, 0.92, 1.96, 0.22, mats.paint), 0, 0.86, 0);
  body.name = 'paint';
  const shell = at(rbox(2.7, 0.56, 1.8, 0.24, mats.paint), -0.15, 1.55, 0);
  shell.name = 'paint';
  const band = at(rbox(2.78, 0.36, 1.85, 0.16, mats.glass), -0.15, 1.68, 0);
  band.name = 'glass';
  const roof = at(rbox(2.32, 0.08, 1.68, 0.04, mats.paint), -0.15, 1.9, 0);
  roof.name = 'roof';
  car.add(body, shell, band, roof);

  // roof rails + cladding
  for (const s of [-1, 1]) {
    const rail = at(rbox(2.2, 0.06, 0.07, 0.02, mats.trim), -0.15, 1.97, s * 0.72);
    rail.name = 'trimpart';
    const clad = at(rbox(4.35, 0.16, 0.1, 0.04, mats.trim), 0, 0.44, s * 0.99);
    clad.name = 'trimpart';
    car.add(rail, clad);
  }
  const bumperF = at(rbox(0.4, 0.3, 1.85, 0.08, mats.trim), 2.3, 0.44, 0);
  bumperF.name = 'trimpart';
  const bumperR = at(rbox(0.3, 0.3, 1.85, 0.08, mats.trim), -2.3, 0.44, 0);
  bumperR.name = 'trimpart';
  car.add(bumperF, bumperR);

  addLights(car, mats, { x: 2.26, y: 0.95, w: 0.42, z: 0.66 });
  addMirrors(car, mats, 0.95, 1.5, 1.04);
  addExhaust(car, mats, -2.42, 0.4, 0.6, false);

  return {
    group: car, roofMesh: roof,
    spoilerAnchor: { x: -1.32, y: 1.92, width: 1.5 },
    exhaustAnchor: { x: -2.42, y: 0.4, spread: 0.6 },
    wheelInfo: { radius: 0.42, width: 0.3, positions: [[1.48, 0.42, 0.88], [1.48, 0.42, -0.88], [-1.48, 0.42, 0.88], [-1.48, 0.42, -0.88]] },
  };
}

function buildPickup(mats) {
  const car = new THREE.Group();
  const chassis = at(rbox(4.95, 0.7, 1.94, 0.16, mats.paint), 0, 0.72, 0);
  chassis.name = 'paint';
  // cab — painted shell + glass band
  const shell = at(rbox(1.5, 0.56, 1.78, 0.22, mats.paint), 0.75, 1.28, 0);
  shell.name = 'paint';
  const band = at(rbox(1.58, 0.34, 1.81, 0.15, mats.glass), 0.75, 1.42, 0);
  band.name = 'glass';
  const roof = at(rbox(1.22, 0.08, 1.66, 0.04, mats.paint), 0.74, 1.63, 0);
  roof.name = 'roof';
  car.add(chassis, shell, band, roof);

  // open bed (three walls; interior dark)
  const bedFloor = at(rbox(1.9, 0.08, 1.7, 0.02, mats.dark), -1.35, 1.02, 0);
  const bedFront = at(rbox(0.08, 0.34, 1.7, 0.02, mats.paint), -0.42, 1.18, 0);
  bedFront.name = 'paint';
  const tailgate = at(rbox(0.09, 0.34, 1.7, 0.02, mats.paint), -2.36, 1.18, 0);
  tailgate.name = 'paint';
  car.add(bedFloor, bedFront, tailgate);
  for (const s of [-1, 1]) {
    const wall = at(rbox(2.0, 0.34, 0.1, 0.02, mats.paint), -1.38, 1.18, s * 0.88);
    wall.name = 'paint';
    car.add(wall);
    const step = at(rbox(1.6, 0.09, 0.16, 0.03, mats.trim), 0.4, 0.32, s * 1.0);
    step.name = 'trimpart';
    car.add(step);
  }
  const bullbar = at(rbox(0.34, 0.4, 1.8, 0.1, mats.trim), 2.55, 0.6, 0);
  bullbar.name = 'trimpart';
  car.add(bullbar);

  addLights(car, mats, { x: 2.44, y: 0.85, w: 0.4, z: 0.68 });
  addMirrors(car, mats, 1.45, 1.3, 1.02);
  addExhaust(car, mats, -2.62, 0.38, 0.62, false);

  return {
    group: car, roofMesh: roof,
    spoilerAnchor: { x: -2.3, y: 1.4, width: 1.5 },
    exhaustAnchor: { x: -2.62, y: 0.38, spread: 0.62 },
    wheelInfo: { radius: 0.44, width: 0.32, positions: [[1.62, 0.44, 0.9], [1.62, 0.44, -0.9], [-1.55, 0.44, 0.9], [-1.55, 0.44, -0.9]] },
  };
}

const BUILDERS = {
  coupe:    (m) => buildCoupe(m, false),
  roadster: (m) => buildCoupe(m, true),
  sedan:    buildSedan,
  suv:      buildSUV,
  pickup:   buildPickup,
};

// ── Public factory ─────────────────────────────────────────────
// state: { model, wheel } — materials are shared & live-updated.
export function buildCar(state, mats) {
  const spec = BUILDERS[state.model](mats);
  const car = spec.group;

  // wheels
  const { radius, width, positions } = spec.wheelInfo;
  const wheels = [];
  positions.forEach(([x, y, z], i) => {
    const w = buildWheel(state.wheel, radius, width, mats);
    w.position.set(x, y, z);
    w.rotation.y = z > 0 ? 0 : Math.PI;
    w.userData.isFront = i < 2;
    car.add(w);
    wheels.push(w);
  });

  // wheel arches (dark, open-ended so the wheels stay visible)
  positions.forEach(([x, , z]) => {
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.16, radius * 1.16, width * 1.12, 24, 1, true, 0, Math.PI),
      mats.dark
    );
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(x, radius * 1.06, z);
    car.add(arch);
  });

  // underbody
  const under = at(rbox(3.6, 0.14, 1.55, 0.04, mats.dark), 0, 0.22, 0);
  car.add(under);

  // underglow plane (hidden unless enabled)
  const glowTex = makeGlowTexture();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.2),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.02;
  glow.name = 'underglow';
  glow.visible = false;
  car.add(glow);

  car.userData = {
    wheels,
    wheelRadius: radius,
    roofMesh: spec.roofMesh,
    spoilerAnchor: spec.spoilerAnchor,
    exhaustAnchor: spec.exhaustAnchor,
    glowMesh: glow,
  };
  return car;
}

export function attachSpoiler(car, mats) {
  const a = car.userData.spoilerAnchor;
  return addSpoiler(car, mats, a.x, a.y, a.width);
}
export function attachQuadExhaust(car, mats) {
  const a = car.userData.exhaustAnchor;
  addExhaust(car, mats, a.x, a.y, a.spread, true);
  const added = [];
  car.traverse((o) => { if (o.name === 'exhaust-quad') added.push(o); });
  return added;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Shared material kit — configurator mutates these live.
export function createMaterialKit() {
  return {
    paint: new THREE.MeshPhysicalMaterial({
      color: PAINTS[4].hex, metalness: 0.35, roughness: 0.18,
      clearcoat: 1, clearcoatRoughness: 0.06,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: TINTS[0].hex, metalness: 0.1, roughness: 0.05,
      transparent: true, opacity: TINTS[0].opacity,
    }),
    trim: new THREE.MeshStandardMaterial({ color: TRIMS[0].hex, metalness: 0.6, roughness: 0.35 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: 0.05, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: RIMS[0].hex, metalness: 0.9, roughness: 0.25 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd9dde4, metalness: 1.0, roughness: 0.12 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0.2, roughness: 0.85, side: THREE.DoubleSide }),
    headlight: new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: 0xbfe3ff, emissiveIntensity: 0.35 }),
    taillight: new THREE.MeshStandardMaterial({ color: 0x53060c, emissive: 0xff1a2a, emissiveIntensity: 0.5 }),
  };
}
