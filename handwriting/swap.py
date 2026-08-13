#!/usr/bin/env python3
"""Swap handwriting in original scanned photos with a fully rebuilt, clean
paper surface: one set of straight rules, aligned text, uniform texture.
The photo outside the paper interior (desk, page edges, lighting) stays real.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

import render

BASE = os.path.dirname(os.path.abspath(__file__))
RW, RH = 2480, 3508          # rectified paper size (2x renderer scale)
BOX_TOP, BOX_BOT = 100, 370  # printed Topic/Date box band (fixed for this notebook)


def order_quad(pts):
    pts = np.array(pts, dtype=np.float32).reshape(-1, 2)
    s = pts.sum(1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)],
                     pts[np.argmax(s)], pts[np.argmax(d)]], dtype=np.float32)


def find_paper_quad(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (9, 9), 0)
    _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnt = max(cnts, key=cv2.contourArea)
    peri = cv2.arcLength(cnt, True)
    approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
    if len(approx) == 4:
        return order_quad(approx)
    return order_quad(cv2.boxPoints(cv2.minAreaRect(cnt)))


def ink_mask(rect_bgr):
    hsv = cv2.cvtColor(rect_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    m = ((h > 85) & (h < 165) & (s > 25) & (v > 10) & (v < 245)).astype(np.uint8) * 255
    return cv2.dilate(m, np.ones((7, 7), np.uint8), iterations=2)


def detect_rules(norm, mask, box_bottom):
    """Straight ruling: period + phase from the darkness profile."""
    dark = np.clip(1.0 - norm, 0, 1)
    dark[mask > 0] = 0
    x0, x1 = int(RW * 0.25), int(RW * 0.92)
    prof = dark[:, x0:x1].mean(axis=1)
    prof = cv2.GaussianBlur(prof.reshape(-1, 1), (1, 9), 0).ravel()
    seg = prof[box_bottom + 30: RH - 60].copy()
    seg -= seg.mean()
    ac = np.correlate(seg, seg, mode="full")[len(seg) - 1:]
    g = float(70 + np.argmax(ac[70:130]))
    best_phase, best_score = 0, -1
    for phase in range(int(g)):
        rows = np.arange(box_bottom + 30 + phase, RH - 60, g).astype(int)
        score = prof[rows].sum() / len(rows)
        if score > best_score:
            best_score, best_phase = score, phase
    grid = list(np.arange(box_bottom + 30 + best_phase, RH - 50, g).astype(int))
    # margin line: darkest vertical column on the left
    dark2 = np.clip(1.0 - norm, 0, 1)
    dark2[mask > 0] = 0
    col = dark2[box_bottom + 60: int(RH * 0.95), int(RW * 0.09): int(RW * 0.30)].mean(axis=0)
    margin_x = int(RW * 0.09) + int(np.argmax(cv2.GaussianBlur(col.reshape(-1, 1), (1, 7), 0).ravel()))
    return grid, margin_x


def swap_page(orig_path, txt_path, num, out_path):
    img = cv2.imread(orig_path)
    quad = find_paper_quad(img)
    dst = np.array([[0, 0], [RW, 0], [RW, RH], [0, RH]], dtype=np.float32)
    Hm = cv2.getPerspectiveTransform(quad, dst)
    rect = cv2.warpPerspective(img, Hm, (RW, RH), flags=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(rect, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bg = cv2.GaussianBlur(gray, (0, 0), 35)
    norm = gray / (bg + 1e-6)
    sat = cv2.cvtColor(rect, cv2.COLOR_BGR2HSV)[:, :, 1]
    ink_only = ink_mask(rect) | cv2.dilate(((sat > 25) & (norm < 0.95)).astype(np.uint8) * 255,
                                           np.ones((5, 5), np.uint8), iterations=1)
    grid, margin_x = detect_rules(norm, ink_only, BOX_BOT)

    # erase EVERYTHING dark on the paper except the printed box band, punch
    # holes and the corner logo -- rules and margin will be redrawn cleanly
    m = ((norm < 0.90).astype(np.uint8) * 255) | ink_mask(rect)
    b0, b1 = BOX_TOP - 15, BOX_BOT + 15
    m[b0:b1, :] = 0
    # inside the band's lower part, erase stray handwriting AND faint rule
    # fragments; keep only rows that are continuous AND print-dark (box border)
    darkv2 = np.clip(1.0 - norm, 0, 1)
    darkbin = (norm < 0.90)
    x0f, x1f = int(RW * 0.12), int(RW * 0.90)
    band = darkbin[BOX_TOP + 180: b1]
    rowfrac = band[:, x0f:x1f].mean(axis=1)
    rowdark = darkv2[BOX_TOP + 180: b1, x0f:x1f].mean(axis=1)
    keep = (rowfrac >= 0.45) & (rowdark >= 0.09)
    m[BOX_TOP + 180: b1, :] |= (band & (~keep)[:, None]).astype(np.uint8) * 255
    border_rows = np.where(keep)[0] + BOX_TOP + 180
    m[RH - 170:, RW - 420:] = 0
    m[:30, :] = 0; m[-30:, :] = 0; m[:, -30:] = 0
    # punch holes: round solid blobs in the left strip
    hole_boxes = []
    strip = (norm[:, 40:180] < 0.85).astype(np.uint8)
    nlab, lab, stats, cent = cv2.connectedComponentsWithStats(strip)
    for i in range(1, nlab):
        x, y, w, h, area = stats[i]
        if 250 < area < 5000 and w < 120 and h < 120 and area / (w * h + 1e-6) > 0.4:
            hole_boxes.append((max(0, y - 5), y + h + 5, max(0, 40 + x - 5), 40 + x + w + 5))
    m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2)
    for y0, y1, x0, x1 in hole_boxes:
        m[y0:y1, x0:x1] = 0
    for r in border_rows:
        m[max(0, r - 4): r + 5, :] = 0
    clean = cv2.inpaint(rect, m, 7, cv2.INPAINT_TELEA)

    # rebuild a uniform paper surface: smooth away inpaint streaks but keep
    # the real lighting; keep the printed box, holes and logo crisp
    paper = cv2.GaussianBlur(clean, (0, 0), 3.0)
    paper[b0:b1, :] = clean[b0:b1, :]
    for y0, y1, x0, x1 in hole_boxes:
        paper[y0:y1, x0:x1] = clean[y0:y1, x0:x1]
    paper[RH - 170:, RW - 420:] = clean[RH - 170:, RW - 420:]

    # ONE clean set of straight rules + margin line (multiply keeps lighting)
    rl = np.full((RH, RW, 3), 255, np.uint8)
    for y in grid:
        cv2.line(rl, (45, y), (RW - 40, y), (204, 200, 198), 3, cv2.LINE_AA)
    cv2.line(rl, (margin_x, BOX_BOT - 20), (margin_x, RH - 40), (194, 190, 190), 3, cv2.LINE_AA)
    paper = np.clip(paper.astype(np.float32) * rl.astype(np.float32) / 255.0, 0, 255).astype(np.uint8)

    # render the writing aligned exactly on those straight rules
    rule_ys = [y // 2 for y in grid]
    layer = render.render_layer(num, txt_path, rule_ys, margin_x // 2)
    layer = layer.resize((RW, RH), Image.BICUBIC)
    lay = np.asarray(layer, dtype=np.float32)[:, :, ::-1].copy()
    # gentle pen-pressure variation
    rng2 = np.random.default_rng(4000 + num)
    low = cv2.resize(rng2.uniform(0.75, 1.04, (RH // 96, RW // 96)).astype(np.float32),
                     (RW, RH), interpolation=cv2.INTER_CUBIC)
    lay = 255.0 - (255.0 - lay) * np.clip(low, 0.7, 1.04)[..., None]

    out_rect = np.clip(paper.astype(np.float32) * lay / 255.0, 0, 255).astype(np.uint8)
    # uniform fine grain over the whole interior so nothing looks smoother
    grain = rng2.normal(0, 2.0, out_rect.shape).astype(np.float32)
    out_rect = np.clip(out_rect.astype(np.float32) + grain, 0, 255).astype(np.uint8)

    # warp the rebuilt paper interior back; the photo's paper edges and desk
    # stay original outside the eroded mask
    Hinv = np.linalg.inv(Hm)
    back = cv2.warpPerspective(out_rect, Hinv, (img.shape[1], img.shape[0]),
                               flags=cv2.INTER_CUBIC)
    pmask = cv2.warpPerspective(np.full((RH, RW), 255, np.uint8), Hinv,
                                (img.shape[1], img.shape[0]))
    pmask = cv2.erode(pmask, np.ones((31, 31), np.uint8))
    pmask = cv2.GaussianBlur(pmask, (21, 21), 0).astype(np.float32) / 255.0
    final = (img.astype(np.float32) * (1 - pmask[..., None]) +
             back.astype(np.float32) * pmask[..., None]).astype(np.uint8)
    cv2.imwrite(out_path, final, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(f"swapped page {num}: rules={len(grid)} grid0={grid[0]} gap~{grid[1]-grid[0] if len(grid)>1 else 0} margin={margin_x}")


def main():
    os.makedirs(os.path.join(BASE, "swapped"), exist_ok=True)
    nums = [int(a) for a in sys.argv[1:]] or range(1, 11)
    for n in nums:
        swap_page(os.path.join(BASE, "orig", f"p-{n-1:03d}.jpg"),
                  os.path.join(BASE, "text", f"p{n:03d}.txt"),
                  n,
                  os.path.join(BASE, "swapped", f"page{n:03d}.jpg"))


if __name__ == "__main__":
    main()
