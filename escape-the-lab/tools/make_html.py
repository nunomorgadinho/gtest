"""Junta a página, o jogo e a licença do three.js num único ficheiro HTML.

Uso: python3 tools/make_html.py            -> dist/EscapeTheLab.html (documento completo)
     python3 tools/make_html.py --fragment SAIDA.html  (sem <html>/<head>/<body>, para alojamentos que os acrescentam)
"""
import os
import sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
page = open(os.path.join(root, "web", "index.html"), encoding="utf-8").read()
game = open(os.path.join(root, "web", "game.js"), encoding="utf-8").read().replace("</script", "<\\/script")
lic = open(os.path.join(root, "web", "THREE-LICENSE.txt"), encoding="utf-8").read()

page = page.replace("<script src=\"game.js\"></script>", "<script>\n" + game + "\n</script>")
page = page.replace("<title>Escape the Lab</title>", "<title>Escape the Lab</title>\n<!-- Inclui three.js (https://threejs.org), licença MIT:\n" + lic + "-->")
page = page.replace(":root { --ui:", ":root { color-scheme: dark; --ui:")

if len(sys.argv) > 2 and sys.argv[1] == "--fragment":
    head = page[page.index("<title>"):page.index("</head>")]
    body = page[page.index("<body>") + len("<body>"):page.index("</body>")]
    open(sys.argv[2], "w", encoding="utf-8").write(head + body)
else:
    os.makedirs(os.path.join(root, "dist"), exist_ok=True)
    open(os.path.join(root, "dist", "EscapeTheLab.html"), "w", encoding="utf-8").write(page)
