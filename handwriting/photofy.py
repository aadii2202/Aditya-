#!/usr/bin/env python3
"""Turn flat rendered pages into realistic phone-photo scans on a wooden desk."""
import glob
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

BASE = os.path.dirname(os.path.abspath(__file__))
W, H = 1240, 1754


def find_coeffs(dst, src):
    matrix = []
    for (x, y), (X, Y) in zip(dst, src):
        matrix.append([X, Y, 1, 0, 0, 0, -x * X, -x * Y])
        matrix.append([0, 0, 0, X, Y, 1, -y * X, -y * Y])
    A = np.array(matrix, dtype=np.float64)
    b = np.array([c for pt in dst for c in pt], dtype=np.float64)
    res = np.linalg.solve(A, b)
    return res.tolist()


def wood_background(rng, w, h):
    base = np.zeros((h, w, 3), dtype=np.float32)
    tone = np.array([182 + rng.uniform(-12, 8), 145 + rng.uniform(-10, 8), 103 + rng.uniform(-10, 10)])
    base[:, :] = tone
    # horizontal grain streaks
    streak = np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 1, (h // 60, w // 6))
    streak_img = np.array(Image.fromarray(((streak - streak.min()) / (np.ptp(streak) + 1e-6) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float32)
    base += (streak_img[..., None] - 128) * 0.14
    # a few darker grain lines
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for _ in range(rng.randint(4, 8)):
        y = rng.uniform(0, h)
        amp = rng.uniform(2, 9)
        pts = [(x, y + amp * np.sin(x / rng.uniform(180, 420) + rng.uniform(0, 6))) for x in range(0, w, 24)]
        shade = rng.randint(15, 40)
        d.line(pts, fill=(int(tone[0]) - shade, int(tone[1]) - shade, int(tone[2]) - shade), width=rng.randint(1, 3))
    return img.filter(ImageFilter.GaussianBlur(1.2))


def lighting_gradient(rng, w, h):
    """Soft directional light across the paper."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = rng.uniform(0.15, 0.85) * w, rng.uniform(0.0, 0.4) * h
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    dist /= dist.max()
    grad = 1.04 - dist * rng.uniform(0.10, 0.16)
    return grad[..., None]


def warp_mesh(img, rng):
    """Gentle paper curvature via horizontal strip shifts."""
    w, h = img.size
    strips = 28
    sh = h // strips + 1
    amp = rng.uniform(2.0, 5.0)
    phase = rng.uniform(0, 6.28)
    mesh = []
    for i in range(strips):
        y0, y1 = i * sh, min((i + 1) * sh, h)
        dx = amp * np.sin(i / strips * 3.1415 * rng.uniform(0.7, 1.3) + phase)
        # quad order: NW, SW, SE, NE (source coords)
        mesh.append(((0, y0, w, y1), (dx, y0, dx, y1, w + dx, y1, w + dx, y0)))
    return img.transform((w, h), Image.MESH, mesh, resample=Image.BICUBIC, fillcolor=(255, 255, 255))


def photofy(path, out, seed):
    rng = random.Random(seed)
    page = Image.open(path).convert("RGB")

    # paper curvature + per-page tone
    page = warp_mesh(page, rng)
    page = ImageEnhance.Color(page).enhance(rng.uniform(0.96, 1.04))
    page = ImageEnhance.Brightness(page).enhance(rng.uniform(0.97, 1.02))

    # directional lighting on the paper
    arr = np.asarray(page, dtype=np.float32)
    arr = np.clip(arr * lighting_gradient(rng, page.width, page.height), 0, 255)
    page = Image.fromarray(arr.astype(np.uint8))

    # canvas with wood
    cw, ch = W, H
    canvas = wood_background(rng, cw, ch)

    # page quad: slightly shrunken, perspective-perturbed
    m = rng.uniform(0.965, 0.985)
    pw, ph = int(cw * m), int(ch * m)
    ox, oy = (cw - pw) // 2 + rng.randint(-10, 10), (ch - ph) // 2 + rng.randint(-8, 8)
    j = lambda: rng.uniform(-16, 16)
    quad = [(ox + j(), oy + j()), (ox + pw + j(), oy + j()),
            (ox + pw + j(), oy + ph + j()), (ox + j(), oy + ph + j())]

    # shadow under the page
    shadow = Image.new("L", (cw, ch), 0)
    sd = ImageDraw.Draw(shadow)
    off = (rng.uniform(6, 14), rng.uniform(8, 16))
    sd.polygon([(x + off[0], y + off[1]) for x, y in quad], fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(9))
    black = Image.new("RGB", (cw, ch), (40, 30, 20))
    canvas = Image.composite(black, canvas, shadow.point(lambda v: v // 2))

    # warp page into quad
    coeffs = find_coeffs(quad, [(0, 0), (page.width, 0), (page.width, page.height), (0, page.height)])
    mask = Image.new("L", page.size, 255).transform((cw, ch), Image.PERSPECTIVE, coeffs,
                                                    resample=Image.BICUBIC, fillcolor=0)
    warped = page.transform((cw, ch), Image.PERSPECTIVE, coeffs,
                            resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    canvas.paste(warped, (0, 0), mask)

    # whole-photo effects: slight rotation, noise, vignette, softness
    canvas = canvas.rotate(rng.uniform(-1.2, 1.2), resample=Image.BICUBIC,
                           fillcolor=(150, 118, 84))
    arr = np.asarray(canvas, dtype=np.float32)
    noise = np.random.default_rng(seed).normal(0, 2.6, arr.shape)
    yy, xx = np.mgrid[0:ch, 0:cw].astype(np.float32)
    vign = 1 - (((xx / cw - 0.5) ** 2 + (yy / ch - 0.5) ** 2) * rng.uniform(0.16, 0.26))
    arr = np.clip((arr + noise) * vign[..., None], 0, 255)
    out_img = Image.fromarray(arr.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.35))
    out_img = ImageEnhance.Contrast(out_img).enhance(1.02)
    out_img.save(out, quality=86)


def main():
    os.makedirs(os.path.join(BASE, "photo"), exist_ok=True)
    for path in sorted(glob.glob(os.path.join(BASE, "pages", "page*.jpg"))):
        num = int(os.path.basename(path)[4:7])
        out = os.path.join(BASE, "photo", f"page{num:03d}.jpg")
        photofy(path, out, seed=7000 + num)
        print("photofied", os.path.basename(path))


if __name__ == "__main__":
    main()
