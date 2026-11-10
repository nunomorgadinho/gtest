#!/usr/bin/env python3
"""Desenha os ícones: o mascote (robô feiticeiro) para a app, e um ícone neutro para o leitor modelo."""
import sys, os
from PIL import Image, ImageDraw

SIZES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}

def mascot(S):
    k = 4; W = S * k
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    # fundo em degradê roxo -> rosa
    for y in range(W):
        t = y / W
        c = (int(70 + 150 * t), int(30 + 40 * t), int(160 + 40 * t), 255)
        d.line([(0, y), (W, y)], fill=c)
    mask = Image.new('L', (W, W), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * 0.22), fill=255)
    bg = Image.new('RGBA', (W, W), (0, 0, 0, 0)); bg.paste(im, (0, 0), mask); im = bg; d = ImageDraw.Draw(im)
    u = W / 100
    # brilho
    d.ellipse([18 * u, 30 * u, 82 * u, 94 * u], fill=(255, 255, 255, 40))
    # cabeça do robô
    d.rounded_rectangle([26 * u, 46 * u, 74 * u, 82 * u], radius=10 * u, fill=(232, 236, 255, 255), outline=(60, 40, 120, 255), width=int(2 * u))
    d.rounded_rectangle([32 * u, 53 * u, 68 * u, 72 * u], radius=7 * u, fill=(30, 26, 70, 255))
    for cx in (42, 58):
        d.ellipse([(cx - 4.5) * u, 58 * u, (cx + 4.5) * u, 67 * u], fill=(94, 240, 255, 255))
        d.ellipse([(cx - 1.5) * u, 59.5 * u, (cx + 1) * u, 62 * u], fill=(255, 255, 255, 255))
    d.arc([43 * u, 66 * u, 57 * u, 72 * u], 20, 160, fill=(94, 240, 255, 255), width=int(1.6 * u))
    d.rounded_rectangle([20 * u, 58 * u, 27 * u, 70 * u], radius=2 * u, fill=(180, 170, 230, 255))
    d.rounded_rectangle([73 * u, 58 * u, 80 * u, 70 * u], radius=2 * u, fill=(180, 170, 230, 255))
    # chapéu de feiticeiro
    d.polygon([(22 * u, 49 * u), (78 * u, 49 * u), (56 * u, 10 * u)], fill=(92, 52, 200, 255))
    d.rounded_rectangle([18 * u, 45 * u, 82 * u, 52 * u], radius=3 * u, fill=(120, 78, 230, 255))
    # estrela
    import math
    cx, cy, R, r = 49 * u, 32 * u, 8 * u, 3.4 * u
    pts = [(cx + (R if i % 2 == 0 else r) * math.sin(i * math.pi / 5), cy - (R if i % 2 == 0 else r) * math.cos(i * math.pi / 5)) for i in range(10)]
    d.polygon(pts, fill=(255, 210, 58, 255))
    for (x, y) in [(70, 20), (28, 26), (80, 36)]:
        d.ellipse([(x - 1.5) * u, (y - 1.5) * u, (x + 1.5) * u, (y + 1.5) * u], fill=(255, 240, 180, 255))
    return im.resize((S, S), Image.LANCZOS)

def plain(S):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=(90, 60, 200, 255))
    d.polygon([(S * 0.38, S * 0.3), (S * 0.38, S * 0.7), (S * 0.72, S * 0.5)], fill=(255, 255, 255, 255))
    return im

for res_dir, fn in ((sys.argv[1], mascot), (sys.argv[2], plain)):
    for k, s in SIZES.items():
        os.makedirs(f'{res_dir}/mipmap-{k}', exist_ok=True)
        fn(s).save(f'{res_dir}/mipmap-{k}/ic_launcher.png', optimize=True)
if len(sys.argv) > 3:
    mascot(512).save(sys.argv[3])
print('ícones prontos')
