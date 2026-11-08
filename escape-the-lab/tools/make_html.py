"""Junta a página, o jogo e as licenças (three.js e letra) num único ficheiro HTML.

Uso: python3 tools/make_html.py                 -> dist/EscapeTheLab.html (os dois capítulos)
     python3 tools/make_html.py --chapter 1     -> dist/EscapeTheLab-Cap1.html (só o Capítulo 1; antes: npm run build:all)
     ... --fragment SAIDA.html                  (sem <html>/<head>/<body>, para alojamentos que os acrescentam)
"""
import base64
import os
import sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
page = open(os.path.join(root, "web", "index.html"), encoding="utf-8").read()
args = sys.argv[1:]
chapter = args[args.index("--chapter") + 1] if "--chapter" in args else None
fragment = args[args.index("--fragment") + 1] if "--fragment" in args else None
game_path = os.path.join(root, "build-web", "game-c" + chapter + ".js") if chapter else os.path.join(root, "web", "game.js")
game = open(game_path, encoding="utf-8").read().replace("</script", "<\\/script")
lic = open(os.path.join(root, "web", "THREE-LICENSE.txt"), encoding="utf-8").read()
font_lic = open(os.path.join(root, "web", "FONTE-LICENCA.txt"), encoding="utf-8").read()
font = base64.b64encode(open(os.path.join(root, "web", "fonte-capitulos.woff2"), "rb").read()).decode()

page = page.replace("<script src=\"game.js\"></script>", "<script>\n" + game + "\n</script>")
page = page.replace("<title>Escape the Lab</title>", "<title>Escape the Lab</title>\n<!-- Inclui three.js (https://threejs.org), licença MIT:\n" + lic + "-->\n<!-- Inclui a letra Saira Stencil One:\n" + font_lic.replace("--", "- -") + "-->")
page = page.replace("url('fonte-capitulos.woff2')", "url(data:font/woff2;base64," + font + ")")
page = page.replace(":root { --", ":root { color-scheme: dark; --", 1)

if chapter:
    page = page.replace("<title>Escape the Lab</title>", "<title>Escape the Lab " + chapter + "</title>")
if fragment:
    head = page[page.index("<title>"):page.index("</head>")]
    body = page[page.index("<body>") + len("<body>"):page.index("</body>")]
    open(fragment, "w", encoding="utf-8").write(head + body)
else:
    os.makedirs(os.path.join(root, "dist"), exist_ok=True)
    name = "EscapeTheLab-Cap" + chapter + ".html" if chapter else "EscapeTheLab.html"
    open(os.path.join(root, "dist", name), "w", encoding="utf-8").write(page)
