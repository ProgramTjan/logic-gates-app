# Roadmap: Forge Logic als deelbare, installeerbare app

**Doel:** de bestaande leerapp omzetten naar "app-vorm" zodat hij (1) via een publieke URL gedeeld kan worden, (2) installeerbaar is als app (eigen icoon, eigen venster, werkt offline) en (3) alle voortgang **lokaal op het apparaat van de gebruiker** blijft — precies zoals nu (localStorage), er komt géén backend of account.

**Strategie:** Progressive Web App (PWA) + statische hosting via GitHub Pages. De app is al 100% client-side (geen backend, geen bundler, pure ES-modules), dus dit vergt geen architectuurwijziging. Een desktop-download (Tauri) is een optionele vervolgfase.

---

## Werkwijze (verplicht voor de uitvoerende agent)

1. Werk de fasen **in volgorde** af; stappen binnen een fase zijn ook geordend.
2. Na elke stap: `npm run check` én `npm test` én `npm run e2e` — alles moet groen zijn vóór je verdergaat.
3. Log elke afgeronde stap in `AGENT_LOG.md` (datum, wat gedaan, aannames, resultaat) — zelfde format als de bestaande entries.
4. **Architectuurregels:**
   - Géén bundler introduceren (geen Vite/webpack). De app draait als statische bestanden met native ES-modules; dat moet zo blijven.
   - Niets wijzigen aan `src/sim/` (simulatie-engine) of de challenge-verificatie.
   - `localStorage`-key `forge-logic-project-v2` en het bestaande save/load-mechanisme (`src/state/project.js`) blijven de bron van waarheid voor voortgang.
   - Alle UI-teksten in het Nederlands.
5. Alle paden in `index.html`, manifest en service worker moeten **relatief** zijn (`./…`), zodat de app zowel lokaal als onder een subpad (GitHub Pages: `https://<user>.github.io/<repo>/`) werkt.

**Huidige feiten (verifieer bij start):**
- Statische app: `index.html` + `styles.css` + `script.js` + `src/**/*.js`; entry `src/main.js`.
- Scripts: `npm test` (Node-fixtures, `scripts/verify.js`), `npm run check` (syntax), `npm run e2e` (Playwright, webServer `serve` op :4173), `npm run dev` (serve op :3000).
- Persistentie: localStorage; delen kan al via URL-hash ("Kopieer link") en JSON export/import.
- Git-repo met remote `origin/main`.

---

## Fase 1 — PWA-basis: manifest, icons, service worker

### 1.1 Web app manifest + icons

- Maak `manifest.webmanifest` in de projectroot:
  - `name`: "Forge Logic — bouw een computer vanaf NAND", `short_name`: "Forge Logic"
  - `start_url`: `"./"`, `scope`: `"./"`, `display`: `"standalone"`
  - `background_color` en `theme_color` passend bij het dark-thema (haal de waarden uit `styles.css`, o.a. `--accent`)
  - `lang`: `"nl"`, `description` kort in het NL
  - `icons`: 192×192 en 512×512 PNG + een `maskable` variant van 512×512
- Icons: maak eerst één `icons/icon.svg` (simpel, herkenbaar: bijv. een NAND-gate-symbool of "FL"-monogram op donkere achtergrond met de accentkleur). Genereer daaruit de PNG's met een Node-script `scripts/generate-icons.js` (gebruik een canvas-library als devDependency, bijv. `sharp`; PNG's committen zodat het genereren geen build-stap wordt).
- Link het manifest in `index.html` (`<link rel="manifest" …>`) plus `<meta name="theme-color">` en een `apple-touch-icon` (iOS negeert het manifest grotendeels).

**Acceptatie:** Chrome DevTools → Application → Manifest toont geen fouten; installprompt-criteria (op localhost) op groen na 1.2.

### 1.2 Service worker met offline-ondersteuning

- Maak `sw.js` in de projectroot. Strategie:
  - **Precache bij install**: de volledige app-shell — `index.html`, `styles.css`, `script.js`, `manifest.webmanifest`, icons én alle bestanden onder `src/`. Omdat er geen bundler is, genereer je de lijst met een Node-script `scripts/generate-sw-precache.js` dat de bestanden opsomt en wegschrijft naar `sw-precache.js` (een `self.__PRECACHE = [ … ]`-array die `sw.js` importScripts't). Voeg een npm-script `build:sw` toe en documenteer dat dit gedraaid moet worden na het toevoegen/hernoemen van bronbestanden.
  - **Cache-versie**: gebruik in `sw.js` een `CACHE_VERSION`-constante die `generate-sw-precache.js` vult met een content-hash over alle precache-bestanden. Bij `activate`: oude caches opruimen.
  - **Runtime**: same-origin GET-requests → cache-first met achtergrond-refresh (stale-while-revalidate). Nooit non-GET of cross-origin cachen.
- Registreer de SW in `src/main.js`: feature-detect (`"serviceWorker" in navigator`), alleen registreren op `https:` of localhost, en registratiefouten stil loggen (mag de app nooit blokkeren).
- **Update-melding:** luister op een nieuwe waiting SW; toon dan via de bestaande statusregel (of een klein banner) "Nieuwe versie beschikbaar — ververs de pagina." Geen automatische `skipWaiting` (voorkomt halfgeladen mixes van oude/nieuwe modules).

**Belangrijk:** localStorage staat volledig los van de SW-cache; voortgang blijft dus automatisch behouden. Raak het save-mechanisme niet aan.

**Acceptatie:** app laden op localhost → DevTools offline zetten → harde reload → app boot volledig en de voortgang is er nog.

### 1.3 E2E-test voor offline + installeerbaarheid

- Nieuwe spec `e2e/pwa.spec.js`:
  1. Laad de app, wacht tot de SW `activated` is (poll `navigator.serviceWorker.ready` in `page.evaluate`).
  2. Zet de context offline (`context.setOffline(true)`), reload, verwacht dat `h1` weer "Forge Logic" toont en er geen page errors zijn.
  3. Check dat `manifest.webmanifest` een 200 gaf en geldig JSON is.
- Let op: `serve` moet `sw.js` en het manifest met de juiste content-types leveren; zo niet, voeg een `serve.json` toe.

**Acceptatie:** `npm run e2e` groen, inclusief de nieuwe PWA-spec.

---

## Fase 2 — Publiek deelbaar: hosting + deploy-pijplijn

### 2.1 GitHub Pages via GitHub Actions

- Workflow `.github/workflows/deploy.yml`:
  - Trigger: push naar `main`.
  - Stappen: checkout → `npm ci` → `npm run check` → `npm test` → `node scripts/generate-sw-precache.js` → upload hele repo-root als Pages-artifact (exclusief `node_modules`, `e2e`, `test-results`, `docs`, `scripts`) → deploy met `actions/deploy-pages`.
  - E2E in CI is optioneel (Playwright-install is zwaar); minimaal check + unit-tests als poort.
- Verifieer dat álle asset-verwijzingen relatief zijn (grep op `src=\"/` en `href=\"/` in `index.html`); GitHub Pages serveert onder `/<repo>/`.
- Zet in de repo-settings Pages op "GitHub Actions" (documenteer dit als handmatige stap voor de gebruiker als API-toegang ontbreekt).

**Acceptatie:** publieke URL werkt; les starten, node plaatsen, herladen → voortgang staat er nog (localStorage per origin). "Kopieer link"-delen werkt op de publieke URL.

### 2.2 Documentatie voor delen & installeren

- README-sectie "Als app installeren":
  - Link naar de publieke URL.
  - Chrome/Edge desktop: installeer-icoon in de adresbalk.
  - Android: menu → "App installeren".
  - iOS/Safari: deelmenu → "Zet op beginscherm".
- Vermeld expliciet: voortgang wordt lokaal op het apparaat opgeslagen; wisselen van apparaat = project meenemen via "Kopieer link" of Export/Import.

---

## Fase 3 — Lokale voortgang robuuster maken

Voortgang blijft in localStorage, maar bescherm de gebruiker tegen dataverlies:

### 3.1 Roterende backups + herstel

- Bij elke save (in `src/state/project.js`): schrijf naast de hoofdkey ook een roterende backup (bijv. `forge-logic-backup-1..3`, roteer per sessie of per N minuten — kies simpel en documenteer de keuze).
- Vang `QuotaExceededError` af: statusmelding "Opslaan mislukt — exporteer je project als backup" i.p.v. stille crash.
- UI: knop "Herstel back-up" (bijv. naast Export/Import) die de beschikbare backups toont (tijdstip + aantal sheets) en na bevestiging terugzet. Gebruik de bestaande `appModals`.
- Unit-fixtures in `scripts/verify.js` voor de rotatie- en herstellogica (pure functies, localStorage mocken met een plain object).

### 3.2 iOS-kanttekening

- Safari kan site-data van weinig gebruikte sites opruimen. Neem in de onboarding of README één zin op: "Gebruik je de app op iPhone/iPad, exporteer af en toe je project als bestand."

**Acceptatie:** fixtures groen; handmatige check: backup terugzetten werkt; quota-fout toont nette melding.

---

## Fase 4 (optioneel) — Desktop-download met Tauri

Alleen uitvoeren als de gebruiker expliciet een echte download (.exe/.msi) wil naast de PWA:

- Tauri v2-wrapper om de bestaande statische bestanden (geen code-wijzigingen aan de app zelf; localStorage werkt in de webview en blijft lokaal).
- Iconen hergebruiken uit Fase 1.
- GitHub Actions release-workflow die installers bouwt per platform en aan een GitHub Release hangt.
- Voeg de downloadlink toe aan de README.

---

## Definition of done (hele roadmap, fase 1–3)

1. `npm run check`, `npm test`, `npm run e2e` — allemaal groen, inclusief nieuwe PWA-spec.
2. App is installeerbaar (manifest + SW zonder fouten) en werkt volledig offline na eerste bezoek.
3. Publieke URL live via GitHub Pages; delen via URL-hash werkt daar.
4. Voortgang blijft lokaal (localStorage), met roterende backups en herstel-knop.
5. README beschrijft installeren, delen en het lokale-opslag-model.
6. `AGENT_LOG.md` bevat een entry per afgeronde stap.
