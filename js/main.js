// ═══════════════════════════════════════════════════════════════
// AURION — page interactions: reveals, counters, nav, gallery
// ═══════════════════════════════════════════════════════════════
import { initHero } from './hero.js';
import './configurator.js';

initHero();
document.body.classList.add('is-loaded');

// stagger the hero line reveals
document.querySelectorAll('.reveal-line').forEach((el, i) => el.style.setProperty('--d', i));

// ── Nav ────────────────────────────────────────────────────────
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('is-scrolled', scrollY > 30), { passive: true });

const burger = document.getElementById('navBurger');
const links = document.getElementById('navLinks');
burger.addEventListener('click', () => links.classList.toggle('is-open'));
links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => links.classList.remove('is-open')));

// active section highlighting
const sections = [...document.querySelectorAll('section[id]')];
const navAnchors = [...links.querySelectorAll('a')];
const activeObs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    navAnchors.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
  });
}, { rootMargin: '-40% 0px -50% 0px' });
sections.forEach((s) => activeObs.observe(s));

// ── Scroll reveals ─────────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.setProperty('--rd', (i % 4) * 0.08 + 's');
  revealObs.observe(el);
});

// ── Animated counters ──────────────────────────────────────────
const counterObs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    counterObs.unobserve(e.target);
    const target = parseFloat(e.target.dataset.target);
    const decimals = parseInt(e.target.dataset.decimals || '0', 10);
    const start = performance.now();
    const dur = 1800;
    (function tick(now) {
      const k = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      e.target.textContent = (target * eased).toFixed(decimals);
      if (k < 1) requestAnimationFrame(tick);
    })(start);
  });
}, { threshold: 0.6 });
document.querySelectorAll('.counter').forEach((el) => counterObs.observe(el));

// ── Gallery: 3D tilt + graceful image fallback ────────────────
document.querySelectorAll('.tilt').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
  });
  card.addEventListener('pointerleave', () => { card.style.transform = ''; });
});

// If a Canva export isn't present in assets/images yet, draw a
// stylised placeholder so the gallery never shows a broken image.
document.querySelectorAll('.gallery__item img').forEach((img) => {
  img.addEventListener('error', () => {
    const fig = img.closest('.gallery__item');
    fig.classList.add('is-fallback');
    const label = fig.dataset.fallback || 'Aurion';
    const hue = 180 + Math.random() * 100;
    const art = document.createElement('div');
    art.className = 'fallback-art';
    art.style.background = `
      radial-gradient(ellipse 80% 60% at 70% 30%, hsla(${hue}, 90%, 60%, 0.25), transparent 60%),
      radial-gradient(ellipse 60% 50% at 20% 80%, hsla(${hue + 60}, 80%, 55%, 0.2), transparent 60%),
      linear-gradient(150deg, #10131c, #07080c)`;
    art.innerHTML = `<svg viewBox="0 0 200 100" style="position:absolute;inset:0;width:100%;height:100%;opacity:.5">
      <path d="M20 70 Q50 40 95 42 T175 68 L175 74 Q170 80 160 80 a10 10 0 0 1-20 0 L65 80 a10 10 0 0 1-20 0 Q28 80 24 75 Z"
            fill="none" stroke="hsl(${hue},90%,65%)" stroke-width="1.6"/>
      <circle cx="55" cy="80" r="7" fill="none" stroke="hsl(${hue},90%,65%)" stroke-width="1.6"/>
      <circle cx="165" cy="80" r="7" fill="none" stroke="hsl(${hue},90%,65%)" stroke-width="1.6"/>
    </svg>`;
    fig.prepend(art);
    void label;
  });
});
