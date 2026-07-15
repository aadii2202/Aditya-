// ═══════════════════════════════════════════════════════════════
// AURION — cinematic hero scene (particles + turntable car)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCar, createMaterialKit } from './cars.js';

export function initHero() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080c);
  scene.fog = new THREE.Fog(0x07080c, 14, 40);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(7.5, 2.4, 8.5);
  camera.lookAt(0, 0.7, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

  // lights
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(6, 9, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -7;
  key.shadow.camera.right = key.shadow.camera.top = 7;
  scene.add(key);
  scene.add(new THREE.DirectionalLight(0x38e8ff, 1.4).translateX(-7).translateY(3).translateZ(-6));
  scene.add(new THREE.DirectionalLight(0x7b5cff, 1.0).translateX(2).translateY(2).translateZ(-8));
  scene.add(new THREE.HemisphereLight(0x445577, 0x0a0b10, 0.5));

  // reflective floor
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: 0x0a0c12, metalness: 0.6, roughness: 0.32 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // grid lines fading into fog
  const grid = new THREE.GridHelper(60, 60, 0x1c2942, 0x121a2c);
  grid.position.y = 0.002;
  scene.add(grid);

  // hero car
  const mats = createMaterialKit();
  mats.paint.color.set(0x3d4a63);
  mats.paint.metalness = 0.85;
  mats.paint.roughness = 0.22;
  scene.environmentIntensity = 0.55;
  const car = buildCar({ model: 'coupe', wheel: 'turbine' }, mats);
  scene.add(car);
  // glowing underglow for drama
  car.userData.glowMesh.visible = true;
  car.userData.glowMesh.material.color.set(0x38e8ff);
  mats.headlight.emissiveIntensity = 3.0;
  mats.taillight.emissiveIntensity = 2.0;

  // particle field
  const N = 900;
  const pgeo = new THREE.BufferGeometry();
  const ppos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    ppos[i * 3] = (Math.random() - 0.5) * 46;
    ppos[i * 3 + 1] = Math.random() * 14;
    ppos[i * 3 + 2] = (Math.random() - 0.5) * 46;
  }
  pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const particles = new THREE.Points(pgeo, new THREE.PointsMaterial({
    color: 0x5fb9d8, size: 0.05, transparent: true, opacity: 0.75, depthWrite: false,
  }));
  scene.add(particles);

  // mouse parallax + scroll dolly
  let mx = 0, my = 0, scrollK = 0;
  addEventListener('pointermove', (e) => {
    mx = (e.clientX / innerWidth - 0.5) * 2;
    my = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
  addEventListener('scroll', () => {
    scrollK = Math.min(scrollY / innerHeight, 1);
  }, { passive: true });

  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(canvas);

  function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = clock.getElapsedTime();

    car.rotation.y = t * 0.24;
    car.position.y = Math.sin(t * 1.4) * 0.02;

    particles.rotation.y = t * 0.015;

    // camera drift: orbit + mouse parallax + scroll pull-back
    const baseR = 12.5 + scrollK * 4;
    const a = Math.sin(t * 0.07) * 0.35;
    camera.position.x += ((Math.sin(a) * baseR * 0.8 + 6.8 + mx * 1.1) - camera.position.x) * 0.04;
    camera.position.y += ((2.0 - my * 0.6 + scrollK * 2.2) - camera.position.y) * 0.04;
    camera.position.z += ((Math.cos(a) * baseR * 0.85) - camera.position.z) * 0.04;
    // aim above the car so it settles into the lower third of the frame
    camera.lookAt(0, 2.1, 0);

    renderer.render(scene, camera);
  }
  loop();
}
