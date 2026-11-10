#!/usr/bin/env python3
"""Junta a app num único ficheiro HTML (para a versão web e para dentro do APK da app)."""
import sys, re, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(root, 'app/index.html'), encoding='utf-8').read()
def inline(m):
    src = m.group(1)
    path = os.path.join(root, 'build', 'player-apk.js') if src == 'player-apk.js' else os.path.normpath(os.path.join(root, 'app', src))
    js = open(path, encoding='utf-8').read().replace('</script', '<\\/script')
    return '<script>\n' + js + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
open(sys.argv[1], 'w', encoding='utf-8').write(html)
print('HTML:', sys.argv[1], round(len(html.encode()) / 1024), 'KB')
