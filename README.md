# AURION — Real-Time 3D Car Configurator

A cinematic car-brand website with a **true 3D configurator**: every choice you make
(model, paint, finish, wheels, rims, tint, underglow, options, environment) updates a
live Three.js render — no dummy preview images.

## Run it

```bash
node server.js
# → http://localhost:3000
```

No install step needed — Three.js is vendored in `vendor/` and the server has zero
dependencies. Any static file server also works (`npx serve -l 3000`, `python3 -m http.server 3000`, …).

## What's inside

| Area | Details |
|---|---|
| **Configurator** | 5 vehicle types (coupé, roadster, sedan, SUV, pickup) built procedurally in 3D |
| **Paint studio** | 12 colours × 4 finishes (gloss / metallic / satin / matte) with animated colour transitions |
| **Wheels** | 4 wheel designs × 5 rim colours |
| **Extras** | Rear wing, quad exhaust, carbon roof, chrome delete, 4 window tints, 5 underglow colours |
| **Scenes** | Showroom, studio, sunset, night-city lighting environments |
| **Camera** | Orbit / auto-rotate, 5 preset angles, cinematic fly-to transitions |
| **Motion mode** | Spinning wheels, steering wobble, scrolling road, speed-line particles |
| **Extras** | Live price with animated totals, build summary modal, PNG snapshot download |
| **Hero** | Full-screen 3D scene: turntable car, particle field, mouse parallax, scroll dolly |
| **Page FX** | Line-mask hero reveals, scroll-triggered section reveals, animated spec counters, 3D-tilt gallery cards, glassmorphism UI |

## Gallery images (from Canva)

The gallery loads photos from `assets/images/`:

- `hero-hybrid-night.jpg` — *Futuristic Hybrid Race Car at Night*
- `gallery-racing-dusk.jpg` — *Dynamic Racing Car in Dusk Movement*
- `gallery-electric-urban.jpg` — *Sleek Electric Race Car in Urban Circuit at Dusk*
- `gallery-endurance-night.jpg` — *Endurance Race Car in Dramatic Night Illumination*

These are designs in your Canva account. Export each as JPG (≈1600×900) and drop
them into `assets/images/` with the filenames above. Until then the gallery shows a
styled generated placeholder automatically — nothing breaks.

## Structure

```
index.html          page markup (importmap maps "three" → vendor/)
css/style.css       design system, animations, responsive layout
js/main.js          nav, scroll reveals, counters, gallery tilt + fallbacks
js/hero.js          hero Three.js scene
js/configurator.js  configurator scene, state, pricing, UI wiring
js/cars.js          procedural vehicle factory + option catalogue
vendor/             three.module.js, OrbitControls, RoundedBoxGeometry, RoomEnvironment
server.js           zero-dependency static server (port 3000)
```
