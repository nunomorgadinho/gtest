"""Gera o gráfico de funcionalidades da Google Play (1024×500) em cada língua."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from gerar_icone import AQUI, NAVY_TOP, NAVY_BOT, GOLD, foreground

W, H = 1024, 500
FONTES = "/usr/share/fonts/opentype/inter"
TEXTOS = {
    "pt": ("12 PORTAS · 3 VIDAS", ["Sala dos", "Enigmas"], "Resolve 12 enigmas para escapar."),
    "br": ("12 PORTAS · 3 VIDAS", ["Sala dos", "Enigmas"], "Resolva 12 enigmas para escapar."),
    "es": ("12 PUERTAS · 3 VIDAS", ["La Sala de", "los Enigmas"], "Resuelve 12 enigmas para escapar."),
    "en": ("12 DOORS · 3 LIVES", ["The Puzzle", "Room"], "Solve 12 puzzles to escape."),
}
WHITE, MUTED = (238, 243, 241), (157, 179, 189)
SHAPE_COLORS = [(239, 106, 91), (90, 169, 242), (79, 201, 138), (183, 124, 242)]


def font(name, size):
    try:
        return ImageFont.truetype(os.path.join(FONTES, f"Inter-{name}.otf"), size)
    except OSError:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size)


def fundo():
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    for x in range(W):
        k = x / (W - 1)
        d.line([(x, 0), (x, H)], fill=tuple(round(a + (b - a) * (1 - k)) for a, b in zip(NAVY_TOP, NAVY_BOT)))
    im = im.convert("RGBA")
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([800 - 230, 250 - 230, 800 + 230, 250 + 230], fill=GOLD + (80,))
    return Image.alpha_composite(im, glow.filter(ImageFilter.GaussianBlur(90)))


def formas(d, x, y, s):
    """Pequenas formas coloridas que lembram os vários enigmas."""
    c = SHAPE_COLORS
    d.ellipse([x, y, x + s, y + s], fill=c[0]); x += s + 14
    d.polygon([(x + s / 2, y), (x + s, y + s), (x, y + s)], fill=c[1]); x += s + 14
    d.rounded_rectangle([x, y, x + s, y + s], radius=4, fill=c[2]); x += s + 14
    d.polygon([(x + s / 2, y), (x + s, y + s / 2), (x + s / 2, y + s), (x, y + s / 2)], fill=c[3])


def destaque(lang):
    eyebrow, title, tag = TEXTOS[lang]
    im = fundo()
    im.alpha_composite(foreground(560), (800 - 280, 250 - 280 + 6))
    d = ImageDraw.Draw(im)
    x0, max_w, size = 72, 560, 92
    while size > 50 and max(d.textlength(line, font=font("ExtraBold", size)) for line in title) > max_w:
        size -= 2
    ft, fe = font("ExtraBold", size), font("Bold", 22)
    y, cx = 92, x0
    for ch in eyebrow:  # letras espaçadas
        d.text((cx, y), ch, font=fe, fill=GOLD)
        cx += d.textlength(ch, font=fe) + 3
    y += 46
    for line in title:
        d.text((x0 - 3, y), line, font=ft, fill=WHITE)
        y += int(size * 1.08)
    y += 22
    d.text((x0, y), tag, font=font("Medium", 30), fill=MUTED)
    formas(d, x0, y + 64, 26)
    out = os.path.join(AQUI, f"destaque-play-{lang}.png")
    im.convert("RGB").save(out)
    return out


if __name__ == "__main__":
    for lang in TEXTOS:
        print(destaque(lang))
