#!/usr/bin/env python3
"""Render transcript markup files as realistic handwritten notebook pages."""
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(BASE, "fonts", "LaBelleAurore.ttf")

W, H = 1240, 1754
RULE_TOP = 200          # y of first writing rule
RULE_BOT = 1700
MARGIN_X = 170          # vertical margin line
LEFT_EDGE = 50          # where margin labels start
BODY_X = 225            # default body start
RIGHT_X = 1170          # right edge of writing
INK = (32, 44, 148)     # blue ballpoint
INK_BLACK = (44, 44, 52)  # black ballpoint

FONT_SIZE = 46

_font_cache = {}


def get_font(size):
    size = int(round(size))
    if size not in _font_cache:
        _font_cache[size] = ImageFont.truetype(FONT_PATH, size)
    return _font_cache[size]


def paper_background(rng, rule_gap):
    img = Image.new("RGB", (W, H), (250, 249, 246))
    # subtle paper noise
    noise = Image.effect_noise((W // 4, H // 4), 12).resize((W, H))
    img = Image.composite(img, Image.new("RGB", (W, H), (241, 240, 236)), noise.point(lambda v: 255 - (255 - v) // 3))
    d = ImageDraw.Draw(img)
    # ruled lines
    y = RULE_TOP
    while y <= RULE_BOT:
        shade = rng.randint(0, 8)
        d.line([(0, y), (W, y)], fill=(178 + shade, 182 + shade, 192 + shade), width=2)
        y += rule_gap
    # double pink horizontal line at top
    ty = RULE_TOP - int(rule_gap * 1.6)
    pink = (222, 120, 140)
    d.line([(0, ty), (W, ty)], fill=pink, width=2)
    d.line([(0, ty + 9), (W, ty + 9)], fill=pink, width=2)
    # double pink vertical margin line
    d.line([(MARGIN_X, 0), (MARGIN_X, H)], fill=pink, width=2)
    d.line([(MARGIN_X + 9, 0), (MARGIN_X + 9, H)], fill=pink, width=2)
    return img


class Page:
    def __init__(self, num, rule_gap):
        self.num = num
        self.rng = random.Random(1000 + num)
        self.rule_gap = rule_gap
        self.img = paper_background(self.rng, rule_gap)
        self.line_idx = 0
        self.slant = self.rng.uniform(-0.4, 0.4)  # degrees, whole-page slant tendency
        self.last_node_center = None
        self.last_node_bottom = None
        self.pen = "blue"

    def baseline(self, idx):
        return RULE_TOP + idx * self.rule_gap - 5

    @property
    def max_lines(self):
        return (RULE_BOT - RULE_TOP) // self.rule_gap + 1

    def ink(self):
        r = self.rng
        base = INK_BLACK if self.pen == "black" else INK
        return (base[0] + r.randint(-8, 10), base[1] + r.randint(-8, 10), base[2] + r.randint(-14, 10))

    def draw_char(self, ch, x, base_y, size):
        """Draw one character with jitter; return advance width."""
        r = self.rng
        sz = size * r.uniform(0.95, 1.06)
        font = get_font(sz)
        # measure
        try:
            bbox = font.getbbox(ch)
        except Exception:
            return 0
        if bbox is None:
            return size * 0.3
        adv = font.getlength(ch)
        if ch == " ":
            return size * r.uniform(0.24, 0.34)
        pad = 22
        tile = Image.new("L", (int(adv) + pad * 2 + 6, int(sz * 1.8) + pad * 2), 0)
        td = ImageDraw.Draw(tile)
        td.text((pad - bbox[0], pad), ch, font=font, fill=255)
        rot = self.slant + r.uniform(-2.4, 2.4)
        tile = tile.rotate(rot, resample=Image.BICUBIC, expand=False)
        # slight blur for ink bleed
        tile = tile.filter(ImageFilter.GaussianBlur(0.4))
        ascent, _ = font.getmetrics()
        yy = int(base_y - ascent - pad + r.uniform(-2.2, 2.2))
        xx = int(x - pad + r.uniform(-1.0, 1.0))
        color = Image.new("RGB", tile.size, self.ink())
        self.img.paste(color, (xx, yy), tile.point(lambda v: min(255, int(v * 1.15))))
        return adv * r.uniform(0.97, 1.03)

    def draw_arrow(self, x, base_y, length=44):
        r = self.rng
        d = ImageDraw.Draw(self.img)
        y = base_y - FONT_SIZE * 0.32 + r.uniform(-2, 2)
        x0, x1 = x + 4, x + length
        mid = (x0 + x1) / 2
        bow = r.uniform(-2.5, 2.5)
        col = self.ink()
        d.line([(x0, y), (mid, y + bow), (x1, y + r.uniform(-1.5, 1.5))], fill=col, width=3, joint="curve")
        # head
        hy = y + r.uniform(-1.5, 1.5)
        d.line([(x1, hy), (x1 - 12 + r.uniform(-2, 2), hy - 8 + r.uniform(-1, 1))], fill=col, width=3)
        d.line([(x1, hy), (x1 - 12 + r.uniform(-2, 2), hy + 7 + r.uniform(-1, 1))], fill=col, width=3)
        return length + 8

    def measure_word(self, word, size):
        font = get_font(size)
        if word == "->":
            return 52
        return font.getlength(word)

    def draw_word(self, word, x, base_y, size):
        """Draw a whole word in one stroke so cursive letters stay joined."""
        if word == "->":
            return self.draw_arrow(x, base_y)
        r = self.rng
        sz = size * r.uniform(0.96, 1.05)
        font = get_font(sz)
        adv = font.getlength(word)
        if adv <= 0:
            return size * 0.3
        ascent, descent = font.getmetrics()
        pad = 26
        tile = Image.new("L", (int(adv) + pad * 2 + 8, ascent + descent + pad * 2), 0)
        td = ImageDraw.Draw(tile)
        td.text((pad, pad), word, font=font, fill=255)
        rot = self.slant + r.uniform(-1.6, 1.6)
        tile = tile.rotate(rot, resample=Image.BICUBIC, expand=False,
                           center=(pad, pad + ascent))
        tile = tile.filter(ImageFilter.GaussianBlur(0.4))
        yy = int(base_y - ascent - pad + r.uniform(-2.0, 2.0))
        xx = int(x - pad + r.uniform(-1.0, 1.0))
        color = Image.new("RGB", tile.size, self.ink())
        self.img.paste(color, (xx, yy), tile.point(lambda v: min(255, int(v * 1.2))))
        return adv * r.uniform(0.98, 1.02)

    def wrap(self, text, first_x, cont_x, size=FONT_SIZE):
        """Yield (x, [words]) lines wrapped to RIGHT_X."""
        words = text.split()
        lines = []
        cur, cx, startx = [], first_x, first_x
        space = size * 0.30
        for wd in words:
            ww = self.measure_word(wd, size)
            if cur and cx + ww > RIGHT_X:
                lines.append((startx, cur))
                cur, cx, startx = [], cont_x, cont_x
            cur.append(wd)
            cx += ww + space
        if cur:
            lines.append((startx, cur))
        return lines

    def draw_text_line(self, words, x, base_y, size=FONT_SIZE, underline=False):
        cx = x
        r = self.rng
        drift = r.uniform(-0.008, 0.006)  # baseline drift across the line
        start = cx
        for wd in words:
            by = base_y + (cx - start) * drift
            cx += self.draw_word(wd, cx, by, size) + size * r.uniform(0.26, 0.36)
        end_x = cx - size * 0.3
        if underline:
            d = ImageDraw.Draw(self.img)
            y = base_y + 8 + r.uniform(-1, 1)
            pts = []
            xx = x - 4
            while xx < end_x + 4:
                pts.append((xx, y + r.uniform(-1.6, 1.6)))
                xx += 12
            d.line(pts, fill=self.ink(), width=2)
        return end_x

    # ---- paragraph-level ----
    def para(self, label, text, first_x=None, cont_x=None, underline=False, center=False):
        size = FONT_SIZE
        if center:
            lines = self.wrap(text, MARGIN_X + 40, MARGIN_X + 40, size)
            for _, words in lines:
                width = sum(self.measure_word(w, size) for w in words) + size * 0.3 * (len(words) - 1)
                x = MARGIN_X + (RIGHT_X - MARGIN_X - width) / 2
                self.draw_text_line(words, x, self.baseline(self.line_idx), size, underline=underline)
                self.line_idx += 1
            return
        fx = first_x if first_x is not None else BODY_X
        cx = cont_x if cont_x is not None else fx
        if label:
            lx = LEFT_EDGE if not label.startswith("-") else LEFT_EDGE + 60
            end = self.draw_text_line(label.split(), lx, self.baseline(self.line_idx), size)
            fx = max(fx, end + 18)
        lines = self.wrap(text, fx, cx, size)
        first = True
        for sx, words in lines:
            self.draw_text_line(words, sx, self.baseline(self.line_idx), size, underline=underline and first)
            self.line_idx += 1
            first = False

    def vchain(self, text):
        """Centered node with a short vertical connector drawn above it."""
        size = FONT_SIZE
        w = sum(self.measure_word(wd, size) for wd in text.split()) + size * 0.3 * (len(text.split()) - 1)
        x = MARGIN_X + (RIGHT_X - MARGIN_X - w) / 2
        base = self.baseline(self.line_idx)
        if self.last_node_center is not None:
            d = ImageDraw.Draw(self.img)
            cx = (self.last_node_center + (x + w / 2)) / 2 + self.rng.uniform(-4, 4)
            d.line([(cx, self.last_node_bottom), (cx + self.rng.uniform(-3, 3), base - size * 0.85)],
                   fill=self.ink(), width=3)
        self.draw_text_line(text.split(), x, base, size)
        self.last_node_center = x + w / 2
        self.last_node_bottom = base + 10
        self.line_idx += 2

    def fan(self, children):
        """Fan lines from the last vchain node down to children laid across."""
        size = FONT_SIZE
        d = ImageDraw.Draw(self.img)
        n = len(children)
        usable = RIGHT_X - MARGIN_X - 30
        colw = usable / n
        child_line = self.line_idx
        maxl = 1
        ox = self.last_node_center or (MARGIN_X + usable / 2)
        oy = self.last_node_bottom or self.baseline(self.line_idx - 2) + 10
        for i, child in enumerate(children):
            cx0 = MARGIN_X + 15 + i * colw
            words = child.split()
            lines, cur, w = [], [], 0
            for wd in words:
                ww = self.measure_word(wd, size * 0.92)
                if cur and w + ww > colw - 14:
                    lines.append(cur)
                    cur, w = [], 0
                cur.append(wd)
                w += ww + size * 0.28
            if cur:
                lines.append(cur)
            maxl = max(maxl, len(lines))
            for j, ln in enumerate(lines):
                self.draw_text_line(ln, cx0 + 4, self.baseline(child_line + j), size * 0.92)
            d.line([(ox, oy), (cx0 + 40, self.baseline(child_line) - size * 0.75)],
                   fill=self.ink(), width=3)
        self.last_node_center = None
        self.line_idx = child_line + maxl

    def tree(self, root, children):
        size = FONT_SIZE
        d = ImageDraw.Draw(self.img)
        # root centered
        rw = sum(self.measure_word(w, size) for w in root.split()) + size * 0.3 * (len(root.split()) - 1)
        rx = MARGIN_X + (RIGHT_X - MARGIN_X - rw) / 2
        root_base = self.baseline(self.line_idx)
        self.draw_text_line(root.split(), rx, root_base, size)
        n = len(children)
        usable = RIGHT_X - MARGIN_X - 30
        colw = usable / n
        child_top_line = self.line_idx + 2
        max_child_lines = 1
        for i, child in enumerate(children):
            cx0 = MARGIN_X + 15 + i * colw
            # wrap child text within column
            words = child.split()
            lines, cur, w = [], [], 0
            for wd in words:
                ww = self.measure_word(wd, size * 0.92)
                if cur and w + ww > colw - 14:
                    lines.append(cur)
                    cur, w = [], 0
                cur.append(wd)
                w += ww + size * 0.28
            if cur:
                lines.append(cur)
            max_child_lines = max(max_child_lines, len(lines))
            for j, ln in enumerate(lines):
                self.draw_text_line(ln, cx0 + 4, self.baseline(child_top_line + j), size * 0.92)
            # connector line from root underside to child top
            x_child = cx0 + 30
            y0 = root_base + 10
            x_root = rx + rw / 2 + self.rng.uniform(-30, 30)
            y1 = self.baseline(child_top_line) - size * 0.75
            d.line([(x_root, y0), (x_child, y1)], fill=self.ink(), width=3)
        self.line_idx = child_top_line + max_child_lines


def estimate_lines(page, entries):
    """Count rule lines a transcript would need (approx, by dry-run wrap)."""
    count = 0
    for kind, a, b, pen in entries:
        if kind == "blank":
            count += 1
        elif kind == "tree":
            count += 2 + 2  # root + gap + approx child lines
        else:
            label, text, fx, cxx = a
            lines = page.wrap(text, fx, cxx)
            count += len(lines)
    return count


def parse(path):
    entries = []
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n")
        if not line.strip():
            entries.append(("blank", None, None, "blue"))
            continue
        pen = "blue"
        if line.startswith("@"):
            pen = "black"
            line = line[1:]
        parts = line.split("|")
        tag = parts[0]
        if tag == "C":
            entries.append(("center", ("", parts[1], False), None, pen))
        elif tag == "CU":
            entries.append(("center", ("", parts[1], True), None, pen))
        elif tag == "U":
            entries.append(("para", ("", parts[1], BODY_X, BODY_X, True), None, pen))
        elif tag == "P":
            label, text = parts[1], "|".join(parts[2:])
            entries.append(("para", (label, text, BODY_X, BODY_X, False), None, pen))
        elif tag == "I":
            depth = int(parts[1])
            text = "|".join(parts[2:])
            x = BODY_X + depth * 55
            entries.append(("para", ("", text, x, x, False), None, pen))
        elif tag == "T":
            entries.append(("tree", parts[1], parts[2:], pen))
        elif tag == "VC":
            entries.append(("vchain", parts[1], None, pen))
        elif tag == "F":
            entries.append(("fan", parts[1:], None, pen))
        else:
            raise ValueError(f"bad tag {tag!r} in {path}")
    return entries


def render_page(num, txt_path, out_path):
    entries = parse(txt_path)
    for gap in (46, 44, 42, 40, 38, 36):
        page = Page(num, gap)
        # dry estimate
        need = 0
        for kind, a, b, pen in entries:
            if kind == "blank":
                need += 1
            elif kind == "tree":
                need += 4
            elif kind == "vchain":
                need += 2
            elif kind == "fan":
                need += 2
            elif kind == "center":
                need += len(page.wrap(a[1], MARGIN_X + 40, MARGIN_X + 40))
            else:
                label, text, fx, cxx, _ = a
                if label:
                    fx = max(fx, LEFT_EDGE + page.measure_word(label, FONT_SIZE) + 20)
                need += len(page.wrap(text, fx, cxx))
        if need <= page.max_lines:
            break
    else:
        print(f"  WARNING p{num}: content overflows even at tightest spacing ({need} lines)")
    page = Page(num, gap)
    for kind, a, b, pen in entries:
        page.pen = pen
        if kind == "blank":
            page.line_idx += 1
        elif kind == "center":
            _, text, ul = a
            page.para("", text, center=True, underline=ul)
        elif kind == "tree":
            page.tree(a, b)
        elif kind == "vchain":
            page.vchain(a)
        elif kind == "fan":
            page.fan(a)
        else:
            label, text, fx, cxx, ul = a
            page.para(label, text, first_x=fx, cont_x=cxx, underline=ul)
        if page.line_idx > page.max_lines + 1:
            print(f"  WARNING p{num}: overflowed page ({page.line_idx} lines used)")
    # slight overall page rotation like a scan
    rot = random.Random(500 + num).uniform(-0.35, 0.35)
    img = page.img.rotate(rot, resample=Image.BICUBIC, expand=False, fillcolor=(242, 240, 236))
    img.save(out_path, quality=90)


def main():
    text_dir = os.path.join(BASE, "text")
    out_dir = os.path.join(BASE, "pages")
    os.makedirs(out_dir, exist_ok=True)
    targets = sys.argv[1:]
    files = sorted(f for f in os.listdir(text_dir) if f.endswith(".txt"))
    if targets:
        files = [f for f in files if f in targets or f.replace(".txt", "") in targets]
    for f in files:
        num = int(f[1:4])
        out = os.path.join(out_dir, f"page{num:03d}.jpg")
        render_page(num, os.path.join(text_dir, f), out)
        print(f"rendered {f} -> {out}")


if __name__ == "__main__":
    main()
