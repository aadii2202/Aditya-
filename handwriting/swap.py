#!/usr/bin/env python3
"""Swap handwriting in original scanned photos: erase original ink, draw ours
aligned to the photo's own ruled lines, keep everything else untouched."""
import os
import sys

import cv2
import numpy as np
from PIL import Image

import render

BASE = os.path.dirname(os.path.abspath(__file__))
RW, RH = 2480, 3508          # rectified paper size (2x renderer scale)


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
    rect = cv2.minAreaRect(cnt)
    return order_quad(cv2.boxPoints(rect))


def ink_mask(rect_bgr):
    hsv = cv2.cvtColor(rect_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    # blue ballpoint only (printed box/rules/logo are gray -> low saturation)
    m = ((h > 85) & (h < 165) & (s > 25) & (v > 10) & (v < 245)).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((7, 7), np.uint8), iterations=2)
    # never touch the outermost paper border
    m[:30, :] = 0
    m[-30:, :] = 0
    m[:, :30] = 0
    m[:, -30:] = 0
    return m


def find_box_band(norm, ink):
    """Locate the printed Topic/Date box: its borders are continuous AND much
    darker than ruled lines; handwriting (blue ink) is excluded first."""
    darkv = np.clip(1.0 - norm, 0, 1)
    darkv[ink > 0] = 0
    dark = darkv > 0.06
    x0, x1 = int(RW * 0.12), int(RW * 0.90)
    frac = dark[:, x0:x1].mean(axis=1)
    prof = darkv[:, x0:x1].mean(axis=1)
    lo, hi = int(RH * 0.02), int(RH * 0.22)
    rows = np.where((frac[lo:hi] > 0.5) & (prof[lo:hi] > 0.07))[0]
    if len(rows):
        top = int(rows.min())
        band = rows[rows - top <= 320]
        bot = int(band.max())
        line_rows = [lo + int(r) for r in band]
        # left/right borders: dark-dense columns within the band rows
        seg = dark[lo + top: lo + bot + 1, :]
        colfrac = seg.mean(axis=1 == 2 and 0 or 0)
        colfrac = seg.mean(axis=0)
        cand = np.where(colfrac > 0.5)[0]
        left = int(cand.min()) if len(cand) else None
        right = int(cand.max()) if len(cand) else None
        return lo + top, lo + bot, left, right, line_rows
    return int(RH * 0.05), int(RH * 0.13), None, None, []


def detect_rules(rect_bgr, mask, box_bottom):
    """Return (rule_ys, margin_x) on the rectified image."""
    gray = cv2.cvtColor(rect_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    # flatten illumination
    bg = cv2.GaussianBlur(gray, (0, 0), 45)
    norm = gray / (bg + 1e-6)
    dark = np.clip(1.0 - norm, 0, 1)
    dark[mask > 0] = 0
    x0, x1 = int(RW * 0.25), int(RW * 0.92)
    prof = dark[:, x0:x1].mean(axis=1)
    prof = cv2.GaussianBlur(prof.reshape(-1, 1), (1, 9), 0).ravel()
    # period of the ruling via autocorrelation of the darkness profile
    seg = prof[box_bottom + 30: RH - 60].copy()
    seg -= seg.mean()
    ac = np.correlate(seg, seg, mode="full")[len(seg) - 1:]
    lags = np.arange(len(ac))
    lo, hi = 70, 130
    g = float(lo + np.argmax(ac[lo:hi]))
    # phase: shift that best matches high-profile rows
    best_phase, best_score = 0, -1
    for phase in range(int(g)):
        rows = np.arange(box_bottom + 30 + phase, RH - 60, g).astype(int)
        score = prof[rows].sum() / len(rows)
        if score > best_score:
            best_score, best_phase = score, phase
    grid = list(np.arange(box_bottom + 30 + best_phase, RH - 50, g).astype(int))
    # margin line: vertical dark column on left
    dark2 = np.clip(1.0 - norm, 0, 1)
    dark2[mask > 0] = 0
    col = dark2[box_bottom + 60: int(RH * 0.95), int(RW * 0.08): int(RW * 0.35)].mean(axis=0)
    margin_x = int(RW * 0.08) + int(np.argmax(cv2.GaussianBlur(col.reshape(-1, 1), (1, 7), 0).ravel()))
    return grid, margin_x


def swap_page(orig_path, txt_path, num, out_path, debug=False):
    img = cv2.imread(orig_path)
    quad = find_paper_quad(img)
    dst = np.array([[0, 0], [RW, 0], [RW, RH], [0, RH]], dtype=np.float32)
    Hm = cv2.getPerspectiveTransform(quad, dst)
    rect = cv2.warpPerspective(img, Hm, (RW, RH), flags=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(rect, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bg = cv2.GaussianBlur(gray, (0, 0), 35)
    norm = gray / (bg + 1e-6)

    # detect rules/margin on the ORIGINAL rectified photo, masking only true ink
    sat = cv2.cvtColor(rect, cv2.COLOR_BGR2HSV)[:, :, 1]
    ink_excl = cv2.dilate(((sat > 25) & (norm < 0.95)).astype(np.uint8) * 255,
                          np.ones((5, 5), np.uint8), iterations=1)
    ink_only = ink_mask(rect) | ink_excl
    # the printed Topic/Date box is at a fixed position on this notebook;
    # per-page detection is fragile, so use a fixed band
    box_top, box_bot = 100, 370
    grid, margin_x = detect_rules(rect, ink_only, box_bot)
    hsv_ink = cv2.cvtColor(rect, cv2.COLOR_BGR2HSV)
    hh, ss, vv = cv2.split(hsv_ink)
    raw_ink = ((hh > 85) & (hh < 165) & (ss > 25) & (vv < 245)).astype(np.uint8) * 255
    _, _, box_left, _, _ = find_box_band(norm, raw_ink)
    if box_left is not None and RW * 0.08 < box_left < RW * 0.35:
        margin_x = box_left

    dark = (norm < 0.88).astype(np.uint8) * 255
    m = dark | ink_mask(rect)
    # protect printed things: header box band, punch-hole strip, corner logo, borders
    b0, b1 = max(0, box_top - 15), box_bot + 15
    m[b0:b1, :] = 0
    # lower sliver of the band: only the box's bottom border (continuous) or
    # stray handwriting (broken rows) can be here -- erase the broken rows
    sub0 = box_top + 180
    darkbin = (norm < 0.90)
    x0f, x1f = int(RW * 0.12), int(RW * 0.90)
    band = darkbin[sub0:b1]
    rowfrac = band[:, x0f:x1f].mean(axis=1)
    allow = rowfrac < 0.45
    m[sub0:b1, :] |= (band & allow[:, None]).astype(np.uint8) * 255
    border_rows = np.where(~allow)[0] + sub0
    m[:, :55] = 0
    m[RH - 170:, RW - 420:] = 0
    m[:30, :] = 0; m[-30:, :] = 0; m[:, -30:] = 0
    # find punch holes in the left strip: round, solid dark blobs
    hole_boxes = []
    strip = (norm[:, 40:180] < 0.85).astype(np.uint8)
    nlab, lab, stats, cent = cv2.connectedComponentsWithStats(strip)
    for i in range(1, nlab):
        x, y, w, h, area = stats[i]
        if 250 < area < 5000 and w < 120 and h < 120 and area / (w * h + 1e-6) > 0.4:
            hole_boxes.append((max(0, y - 12), y + h + 12, max(0, 40 + x - 12), 40 + x + w + 12))
    m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2)
    for y0, y1, x0, x1 in hole_boxes:
        m[y0:y1, x0:x1] = 0
    # keep the box's bottom border safe from dilation bleed
    for r in border_rows:
        m[max(0, r - 4): r + 5, :] = 0
    clean = cv2.inpaint(rect, m, 7, cv2.INPAINT_TELEA)

    # redraw ruled lines + margin line (erased with the ink) as a multiply layer,
    # so they dim naturally with the photo's lighting
    rl = np.full((RH, RW, 3), 255, np.uint8)
    for y in grid:
        cv2.line(rl, (58, y), (RW - 42, y), (206, 202, 200), 3, cv2.LINE_AA)
    cv2.line(rl, (margin_x, box_bot + 25), (margin_x, RH - 40), (196, 192, 192), 3, cv2.LINE_AA)
    clean = np.clip(clean.astype(np.float32) * rl.astype(np.float32) / 255.0, 0, 255).astype(np.uint8)
    if os.environ.get("SWAP_DEBUG"):
        cv2.imwrite(out_path.replace(".jpg", "_clean.jpg"), clean)
    if debug:
        dbg = clean.copy()
        for y in grid:
            cv2.line(dbg, (0, y), (RW, y), (0, 0, 255), 3)
        cv2.line(dbg, (margin_x, 0), (margin_x, RH), (0, 255, 0), 3)
        cv2.line(dbg, (0, box_bot), (RW, box_bot), (255, 0, 0), 5)
        cv2.imwrite(out_path.replace(".jpg", "_debug.jpg"), dbg)

    # render our writing aligned to the detected rules (renderer works at 1/2 scale)
    rule_ys = [y // 2 for y in grid]
    layer = render.render_layer(num, txt_path, rule_ys, margin_x // 2)
    layer = layer.resize((RW, RH), Image.BICUBIC)
    lay = np.asarray(layer, dtype=np.float32)[:, :, ::-1]  # RGB->BGR

    out_rect = np.clip(clean.astype(np.float32) * lay / 255.0, 0, 255).astype(np.uint8)

    # warp back into the original photo
    Hinv = np.linalg.inv(Hm)
    back = cv2.warpPerspective(out_rect, Hinv, (img.shape[1], img.shape[0]),
                               flags=cv2.INTER_CUBIC)
    pmask = cv2.warpPerspective(np.full((RH, RW), 255, np.uint8), Hinv,
                                (img.shape[1], img.shape[0]))
    pmask = cv2.erode(pmask, np.ones((9, 9), np.uint8))
    pmask = cv2.GaussianBlur(pmask, (11, 11), 0).astype(np.float32) / 255.0
    final = (img.astype(np.float32) * (1 - pmask[..., None]) +
             back.astype(np.float32) * pmask[..., None]).astype(np.uint8)
    cv2.imwrite(out_path, final, [cv2.IMWRITE_JPEG_QUALITY, 90])
    print(f"swapped page {num}: rules={len(grid)} grid0={grid[0]} box=({box_top},{box_bot}) gap~{grid[1]-grid[0] if len(grid)>1 else 0} margin={margin_x}")


def main():
    os.makedirs(os.path.join(BASE, "swapped"), exist_ok=True)
    nums = [int(a) for a in sys.argv[1:]] or range(1, 11)
    for n in nums:
        swap_page(os.path.join(BASE, "orig", f"p-{n-1:03d}.jpg"),
                  os.path.join(BASE, "text", f"p{n:03d}.txt"),
                  n,
                  os.path.join(BASE, "swapped", f"page{n:03d}.jpg"),
                  debug=("--debug" in os.environ.get("SWAP_DEBUG", "")) or True)


if __name__ == "__main__":
    main()
