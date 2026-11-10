#!/usr/bin/env python3
"""Reescreve o APK do leitor para servir de modelo: os ficheiros que a app troca ficam sem compressão."""
import sys, zipfile, re
src, dst = sys.argv[1], sys.argv[2]
STORE = re.compile(r'^(AndroidManifest\.xml|resources\.arsc|assets/game\.js|res/mipmap[^/]*/ic_launcher\.png)$')
with zipfile.ZipFile(src) as zi, zipfile.ZipFile(dst, 'w') as zo:
    for info in zi.infolist():
        data = zi.read(info)
        ni = zipfile.ZipInfo(info.filename, date_time=(2026, 1, 1, 0, 0, 0))
        ni.compress_type = zipfile.ZIP_STORED if STORE.match(info.filename) or info.compress_type == zipfile.ZIP_STORED else zipfile.ZIP_DEFLATED
        ni.external_attr = 0
        zo.writestr(ni, data)
print('modelo:', dst)
