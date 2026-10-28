"""Gera o ícone da app (desenho original, sem recursos externos)."""
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def draw(size):
    k = 4  # desenhar em alta resolução e reduzir para suavizar
    n = size * k
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = n * 0.04
    d.rounded_rectangle([pad, pad, n - pad, n - pad], radius=n * 0.22, fill=(12, 14, 40, 255))
    c = n / 2
    glow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([c - n * 0.2, c - n * 0.2, c + n * 0.2, c + n * 0.2], fill=(255, 190, 90, 200))
    glow = glow.filter(ImageFilter.GaussianBlur(n * 0.06))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    for r, a in ((0.2, 90), (0.31, 140)):
        d.ellipse([c - n * r, c - n * r, c + n * r, c + n * r], outline=(160, 200, 255, a), width=max(2, int(n * 0.012)))
    d.ellipse([c - n * 0.075, c - n * 0.075, c + n * 0.075, c + n * 0.075], fill=(255, 245, 220, 255))
    ang = -math.pi / 4
    px, py = c + math.cos(ang) * n * 0.31, c + math.sin(ang) * n * 0.31
    for i in range(6):
        a2 = ang - (i + 1) * 0.09
        tx, ty = c + math.cos(a2) * n * 0.31, c + math.sin(a2) * n * 0.31
        r = n * 0.05 * (1 - i / 7)
        d.ellipse([tx - r, ty - r, tx + r, ty + r], fill=(127, 227, 255, int(150 * (1 - i / 6))))
    r = n * 0.06
    d.ellipse([px - r, py - r, px + r, py + r], fill=(234, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    res = sys.argv[1]
    for name, s in SIZES.items():
        out = os.path.join(res, "mipmap-" + name)
        os.makedirs(out, exist_ok=True)
        draw(s).save(os.path.join(out, "ic_launcher.png"))
    draw(512).save(os.path.join(os.path.dirname(res.rstrip("/")), "..", "dist", "icon-512.png"))
