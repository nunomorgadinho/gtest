"""Gera o ícone da app (desenho original, sem recursos externos)."""
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
GOLD = (255, 217, 138, 255)
PINK = (255, 159, 194, 255)


def flower(d, x, y, r):
    for i in range(5):
        a = i / 5 * math.pi * 2 - math.pi / 2
        px, py = x + math.cos(a) * r * 1.3, y + math.sin(a) * r * 1.3
        d.ellipse([px - r, py - r, px + r, py + r], fill=PINK)
    d.ellipse([x - r * 0.8, y - r * 0.8, x + r * 0.8, y + r * 0.8], fill=(255, 226, 138, 255))


def draw(size):
    k = 4
    n = size * k
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = n * 0.04
    d.rounded_rectangle([pad, pad, n - pad, n - pad], radius=n * 0.22, fill=(14, 28, 20, 255))
    c = n / 2
    sy = c + n * 0.14  # semente
    ends = [(c - n * 0.24, c - n * 0.2), (c + n * 0.24, c - n * 0.2), (c, c - n * 0.3)]
    w = int(n * 0.055)
    glow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.line([(c, sy), (c, c - n * 0.3)], fill=(255, 190, 90, 160), width=w * 3)
    g.line([(c - n * 0.24, c - n * 0.2), (c - n * 0.24, c - n * 0.05), (c + n * 0.24, c - n * 0.05), (c + n * 0.24, c - n * 0.2)],
           fill=(255, 190, 90, 160), width=w * 3)
    g.ellipse([c - n * 0.2, sy - n * 0.2, c + n * 0.2, sy + n * 0.2], fill=(255, 200, 100, 200))
    glow = glow.filter(ImageFilter.GaussianBlur(n * 0.04))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    d.line([(c, sy), (c, c - n * 0.3)], fill=GOLD, width=w)
    d.line([(c - n * 0.24, c - n * 0.2), (c - n * 0.24, c - n * 0.05), (c + n * 0.24, c - n * 0.05), (c + n * 0.24, c - n * 0.2)],
           fill=GOLD, width=w, joint="curve")
    for x, y in ends:
        flower(d, x, y, n * 0.045)
    d.ellipse([c - n * 0.09, sy - n * 0.09, c + n * 0.09, sy + n * 0.09], fill=(255, 241, 196, 255))
    d.ellipse([c - n * 0.045, sy - n * 0.045, c + n * 0.045, sy + n * 0.045], fill=(255, 191, 74, 255))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    res = sys.argv[1]
    for name, s in SIZES.items():
        out = os.path.join(res, "mipmap-" + name)
        os.makedirs(out, exist_ok=True)
        draw(s).save(os.path.join(out, "ic_launcher.png"))
    draw(512).save(os.path.join(os.path.dirname(res.rstrip("/")), "..", "dist", "icon-512.png"))
