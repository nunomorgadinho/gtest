"""Gera o ícone da app (desenho original, sem recursos externos)."""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def draw(size):
    k = 4
    n = size * k
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = n * 0.04
    d.rounded_rectangle([pad, pad, n - pad, n - pad], radius=n * 0.22, fill=(16, 22, 30, 255))
    # porta de laboratório entreaberta com luz a sair
    glow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.rectangle([n * 0.3, n * 0.2, n * 0.7, n * 0.62], fill=(67, 224, 176, 210))
    glow = glow.filter(ImageFilter.GaussianBlur(n * 0.05))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    d.rectangle([n * 0.26, n * 0.16, n * 0.74, n * 0.84], fill=(60, 70, 82, 255))
    d.rectangle([n * 0.3, n * 0.2, n * 0.7, n * 0.84], fill=(230, 255, 245, 255))
    d.rectangle([n * 0.3, n * 0.62, n * 0.7, n * 0.84], fill=(140, 150, 162, 255))  # porta a subir
    for i in range(5):
        x = n * (0.3 + i * 0.09)
        d.polygon([(x, n * 0.84), (x + n * 0.04, n * 0.84), (x + n * 0.08, n * 0.74), (x + n * 0.04, n * 0.74)], fill=(255, 214, 0, 255))
    # cartão de acesso
    d.rounded_rectangle([n * 0.5, n * 0.48, n * 0.86, n * 0.7], radius=n * 0.03, fill=(239, 68, 68, 255), outline=(255, 255, 255, 255), width=int(n * 0.012))
    d.rectangle([n * 0.55, n * 0.54, n * 0.62, n * 0.6], fill=(255, 210, 122, 255))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    res = sys.argv[1]
    for name, s in SIZES.items():
        out = os.path.join(res, "mipmap-" + name)
        os.makedirs(out, exist_ok=True)
        draw(s).save(os.path.join(out, "ic_launcher.png"))
    draw(512).save(os.path.join(os.path.dirname(res.rstrip("/")), "..", "dist", "icon-512.png"))
