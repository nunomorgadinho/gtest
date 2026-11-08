# Life RPG ⚔️

Transforma a vida real num RPG. Objetivos, XP, níveis, missões e conquistas.

## O que tem

- **Dashboard** em estilo escuro com vidro e néon: anel de progresso de nível, vida, ouro, dias seguidos, grelha de hábitos dos últimos 7 dias e gráfico de evolução do XP.
- **Oráculo 🔮:** assistente que dá conselhos com base no teu progresso (o que fazer agora, resumo da semana, quanto falta para subir). Funciona offline, com regras fixas, sem inteligência artificial.
- **Herói:** nome, avatar e classe (Guerreiro(a), Mago(a), Bardo, Paladino ou Druida). A classe dá +10% XP no seu atributo.
- **5 atributos** com nível próprio: 💪 Força, 🧠 Mente, 💬 Carisma, 🛡️ Disciplina e 🧘 Espírito.
- **Diárias:** hábitos que se repetem todos os dias, com sequências 🔥 e bónus de XP por sequência.
- **Missões:** tarefas únicas com dificuldade Fácil (10 XP), Média (20), Difícil (40) ou Épica (80).
- **Objetivos:** metas de longo prazo divididas em passos (25 XP cada), com bónus ao concluir (100, 250 ou 500 XP).
- **XP e níveis:** subir de nível restaura a vida e aumenta o máximo. Os títulos vão de "Recruta" a "Imortal".
- **Vida (HP):** cada diária por fazer tira 10 HP no dia seguinte. Se chegar a zero, desmaias e perdes 25% do ouro.
- **Ouro e loja:** ganhas ouro com as missões e gasta-lo em Poções de Vida ou em recompensas reais criadas por ti.
- **20 conquistas**, cada uma vale +25 de ouro.
- Gráfico de XP dos últimos 7 dias, botão "Desfazer", efeitos sonoros e cópia de segurança (exportar e importar).
- Funciona sem internet. O progresso fica guardado no telemóvel.

## Instalar

Descarrega `dist/LifeRPG-v1.1.apk` para o telemóvel Android (7.0 ou superior) e abre-o.
Pode ser preciso permitir "instalar apps de origem desconhecida".

O APK está assinado com uma chave de debug. Para publicar na Play Store é preciso assiná-lo com uma chave própria.

## Compilar

Requer JDK 17+ e o Android SDK (plataforma 34).

```sh
echo "sdk.dir=/caminho/para/android-sdk" > local.properties
./gradlew assembleRelease
```

O APK fica em `app/build/outputs/apk/release/app-release.apk`.

A app está em `app/src/main/assets/` (`index.html` com o aspeto e `app.js` com a lógica). Para testar rapidamente, basta abrir `index.html` num browser.
