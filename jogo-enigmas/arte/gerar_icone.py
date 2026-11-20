"""Gera o ícone da Sala dos Enigmas: porta em arco com uma fechadura em forma de ponto de interrogação.
Saídas: ícones adaptativos (Android 8+), monocromático (Android 13+), clássicos por densidade
e o ícone de 512 px para a Google Play."""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(AQUI, "..", "app", "src", "main", "res")
NAVY_TOP, NAVY_BOT = (31, 54, 69), (12, 22, 29)
DOOR, DOOR_DARK = (36, 64, 80), (27, 47, 60)
GOLD, GOLD_DEEP = (242, 181, 68), (214, 148, 38)
SS = 4  # supersampling


def gradient(size, top, bot):
    im = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(im)
    for y in range(size):
        k = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * k) for a, b in zip(top, bot)))
    return im


def background(size):
    """Fundo azul-noite com um brilho dourado atrás da porta."""
    im = gradient(size, NAVY_TOP, NAVY_BOT).convert("RGBA")
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    r = size * 0.36
    ImageDraw.Draw(glow).ellipse([size / 2 - r, size * 0.52 - r, size / 2 + r, size * 0.52 + r], fill=GOLD + (70,))
    return Image.alpha_composite(im, glow.filter(ImageFilter.GaussianBlur(size * 0.12)))


def stroke_path(d, pts, width, fill):
    """Traço grosso com pontas redondas: carimba círculos ao longo do caminho."""
    r = width / 2
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 / (r * 0.25)))
        for j in range(n + 1):
            x, y = x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n
            d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def foreground(size, mono=False):
    """Porta, fechadura e luz por baixo da porta, dentro da zona segura (66/108 do lado).
    Em mono, só o contorno (para os ícones temáticos do Android 13+)."""
    S = size * SS
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    u = S / 108.0  # 1 dp do ícone adaptativo
    cx = S / 2
    w, top, bot = 38 * u, 24 * u, 82 * u
    x0, x1 = cx - w / 2, cx + w / 2
    stroke = 3.6 * u
    gold = (255, 255, 255, 255) if mono else GOLD + (255,)
    if not mono:
        light = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(light).polygon([(x0 + 2 * u, bot), (x1 - 2 * u, bot), (x1 + 10 * u, bot + 8 * u), (x0 - 10 * u, bot + 8 * u)], fill=GOLD + (150,))
        im = Image.alpha_composite(im, light.filter(ImageFilter.GaussianBlur(2.2 * u)))
    d = ImageDraw.Draw(im)
    arc_r = w / 2
    d.rounded_rectangle([x0 - stroke, top + arc_r - stroke, x1 + stroke, bot + stroke * 0.3], radius=1.5 * u, fill=gold)
    d.ellipse([x0 - stroke, top - stroke, x1 + stroke, top + 2 * arc_r + stroke], fill=gold)
    panel = (0, 0, 0, 0) if mono else DOOR + (255,)
    d.rectangle([x0, top + arc_r, x1, bot], fill=panel)
    d.ellipse([x0, top, x1, top + 2 * arc_r], fill=panel)
    if not mono:
        pw = w * 0.30
        for px in (cx - w * 0.36, cx + w * 0.06):
            d.rounded_rectangle([px, bot - 17 * u, px + pw, bot - 4 * u], radius=1.2 * u, fill=DOOR_DARK + (255,))
    d.rounded_rectangle([x0 - 6 * u, bot, x1 + 6 * u, bot + 3.2 * u], radius=1.4 * u, fill=gold)
    # ponto de interrogação
    qx, qy, qr, qs = cx, top + 20 * u, 7.5 * u, 4.2 * u
    pts = [(qx + qr * math.cos(math.radians(a)), qy + qr * math.sin(math.radians(a))) for a in range(195, 395, 5)]
    pts += [(qx, qy + qr * 1.05), (qx, qy + qr * 1.55)]
    stroke_path(d, pts, qs, gold)
    dy = qy + qr * 1.55 + 5.2 * u
    d.ellipse([qx - qs * 0.62, dy - qs * 0.62, qx + qs * 0.62, dy + qs * 0.62], fill=gold)
    if not mono:
        d.ellipse([x1 - 8 * u, (top + bot) / 2 + 3 * u, x1 - 4 * u, (top + bot) / 2 + 7 * u], fill=gold)
    return im.resize((size, size), Image.LANCZOS)


def full(size, rounded):
    """Fundo + porta. Para os ícones clássicos (cantos redondos) e para a Play (quadrado)."""
    big = size * 2
    im = Image.alpha_composite(background(big), foreground(big)).resize((size, size), Image.LANCZOS)
    if rounded:
        m = Image.new("L", (size * SS, size * SS), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, size * SS - 1, size * SS - 1], radius=size * SS * 0.22, fill=255)
        im.putalpha(m.resize((size, size), Image.LANCZOS))
    return im


def main():
    for name, k in {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}.items():
        folder = os.path.join(RES, f"mipmap-{name}")
        os.makedirs(folder, exist_ok=True)
        full(int(48 * k), True).save(os.path.join(folder, "ic_launcher.png"))
        a = int(108 * k)
        foreground(a).save(os.path.join(folder, "ic_launcher_foreground.png"))
        background(a).convert("RGB").save(os.path.join(folder, "ic_launcher_background.png"))
        foreground(a, mono=True).save(os.path.join(folder, "ic_launcher_monochrome.png"))
    os.makedirs(os.path.join(RES, "mipmap-anydpi-v26"), exist_ok=True)
    with open(os.path.join(RES, "mipmap-anydpi-v26", "ic_launcher.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@mipmap/ic_launcher_background" />\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
                '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />\n'
                '</adaptive-icon>\n')
    full(512, False).convert("RGB").save(os.path.join(AQUI, "icone-play-512.png"))
    print("ok")


if __name__ == "__main__":
    main()
