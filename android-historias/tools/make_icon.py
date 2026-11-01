"""Gera os ícones do launcher (livro aberto com uma pena) em várias densidades."""
import os, sys
from PIL import Image, ImageDraw

res = sys.argv[1]
S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.ellipse((32, 32, S - 32, S - 32), fill=(91, 58, 41, 255))
# páginas do livro
page = (251, 247, 240, 255)
d.polygon([(200, 330), (500, 380), (500, 760), (200, 710)], fill=page)
d.polygon([(824, 330), (524, 380), (524, 760), (824, 710)], fill=page)
d.rectangle((500, 380, 524, 760), fill=(217, 130, 43, 255))
for i in range(5):
    y = 440 + i * 55
    d.line([(250, y), (450, y + 30)], fill=(200, 185, 168, 255), width=14)
    d.line([(574, y + 30), (774, y)], fill=(200, 185, 168, 255), width=14)
# pena
d.polygon([(640, 610), (860, 190), (900, 230), (680, 640)], fill=(217, 130, 43, 255))
d.line([(640, 640), (600, 700)], fill=(217, 130, 43, 255), width=18)

for name, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    out = os.path.join(res, "mipmap-" + name)
    os.makedirs(out, exist_ok=True)
    img.resize((px, px), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
