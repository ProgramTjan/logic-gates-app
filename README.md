# Forge Logic

Bouw logische poorten, maak herbruikbare chips en werk Nand2Tetris-challenges af — lokaal in de browser, zonder backend.

## Publieke app

Live (GitHub Pages): [https://ProgramTjan.github.io/logic-gates-app/](https://ProgramTjan.github.io/logic-gates-app/)

> **Handmatig (eenmalig):** in de GitHub-repo → Settings → Pages → Source = **GitHub Actions**. De workflow `.github/workflows/deploy.yml` publiceert bij elke push naar `main` (na `check` + `test` + SW-precache).

## Als app installeren

1. Open de publieke URL hierboven (of lokaal via `npm run dev`).
2. **Chrome / Edge (desktop):** klik het install-icoon in de adresbalk → “Installeren”.
3. **Android (Chrome):** menu ⋮ → “App installeren” / “Toevoegen aan startscherm”.
4. **iOS (Safari):** Deel-knop → “Zet op beginscherm”.

Na de eerste visit werkt de app ook offline (service worker). Voortgang blijft **lokaal op dit apparaat** in `localStorage` (`forge-logic-project-v2`); er is geen account.

**Apparaat wisselen:** gebruik **Kopieer link** of **Exporteren / Importeren**. Op iPhone/iPad: exporteer af en toe je project als bestand — Safari kan site-data van weinig gebruikte sites opruimen. Lokale back-ups: knop **Herstel back-up** (roterend, max. 3 slots).

## Starten (lokaal)

Open `index.html` in een browser, of gebruik een statische server:

```bash
npx --yes serve .
```

Entrypoint: `src/main.js` → `script.js` (app bootstrap). Alle asset-paden zijn relatief (`./…`), zodat de app onder `/logic-gates-app/` op GitHub Pages werkt.

## Scripts

```bash
npm test        # Node-fixture tests (bits, simulatie, challenges)
npm run check   # Syntax-check op alle JS-bestanden
npm run e2e     # Playwright smoke + PWA (Chromium, static server :4173)
npm run dev     # Static server op poort 3000
npm run icons   # PNG-icons genereren uit icons/icon.svg (sharp)
npm run build:sw  # Vernieuw sw-precache.js na toevoegen/hernoemen van bronbestanden
```

E2E: o.a. NAND-leerflow en `e2e/pwa.spec.js` (service worker + offline shell + manifest).

```bash
npx playwright install chromium   # eenmalig, na clone
npm run e2e
```

Config: `playwright.config.js` (webServer via `serve` op poort 4173).

## Architectuur

```
index.html          UI shell + thema's + PWA-meta
manifest.webmanifest
sw.js / sw-precache.js
script.js           Dunne bootstrap (state wiring)
src/
  main.js           Module entry + service worker-registratie
  sim/              Bit-helpers, circuit-evaluatie, HACK-ALU
  model/            Nodes, chips, node-specs
  state/            Project laden/opslaan (localStorage + backups)
  challenges/       Challenge-verificatie
  chips/            Chip-definitie helpers
  data/             Builtin parts + challenge-definities
  ui/               Canvas, panels, events, render, boot
  actions/          Undo, workspace/chip/circuit acties
  lib/              Utils, project-share, debounce
```

## Gebruik

1. **Cursus** — verse gebruikers zien eerst het leerpad; **Ga verder** opent de volgende les.
2. **Parts** — voeg poorten of opgeslagen chips toe in de Werkplaats.
3. Klik **output-pin** → **input-pin** om te verbinden.
4. **Snapshot** — sla een sheet op als chip (Input/Output-pins vormen de interface).
5. **Lessen** (rechterpaneel) — start, bouw, dien in; badges per voltooide module.

Sneltoetsen: `Ctrl+Z` undo · `Ctrl+A` alles selecteren · `Ctrl+C`/`Ctrl+V` kopiëren/plakken · `Ctrl+D` dupliceren · `Shift+klik` multi-select · `Shift+slepen` selectiekader · `Delete` node verwijderen · `Esc` verbinden stoppen.

Een multi-selectie kun je in één keer verslepen, kopiëren (`Ctrl+C`) en op een andere sheet plakken (`Ctrl+V`) — inclusief de draden tussen de geselecteerde nodes.

## Delen

- **Kopieer link** — project in URL-hash (klembord); werkt ook op de publieke Pages-URL.
- **Exporteren / Importeren** — JSON-bestand.
- **Herstel back-up** — lokale roterende back-ups (elke ≤2 minuten bij opslaan).

Projectdata wordt automatisch opgeslagen in `localStorage` (`forge-logic-project-v2`).
