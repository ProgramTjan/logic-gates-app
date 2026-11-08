# AGENT_LOG — Forge Logic Refactor

## 2026-03-25 — Stap 1: Sync roadmap met werkelijke staat

**Uitgevoerd:**
- `node --check` gedraaid op alle 13 JS-bronbestanden — allemaal groen
- Geïnventariseerd wat er nog in script.js zit:
  - Simulatie-engine: `evaluateWorkspace` (r.1555), `evaluateCircuit` (r.1559), `collectRegisterUpdates` (r.1340), `stepRegisters` (r.1325), `makeRegisterStateKey` (r.1800), `evaluateGate` (r.1804)
  - Node-model: `createWorkspace` (r.346), `createNode` (r.370), `createChipInstance` (r.421), `normalizeNode` (r.438)
  - Render: `render` (r.628) + alle sub-renders (r.652-825)
- `docs/refactor-roadmap.md` bijgewerkt met actuele status en resterende extracties
- NEXT_STEPS.md Stap 1 afgevinkt

**Aanname:** modules src/challenges/verification.js etc. zijn gecreëerd maar bevatten nog geen geëxtraheerde logica uit script.js — ze zijn scaffolds. script.js is nog de owner van alle executielogica.

**Resultaat:** groen — syntax checks geslaagd, roadmap synchroon met werkelijke staat

---

## 2026-03-25 — Stap 2: Simulatie-engine extraheren → src/sim/evaluate.js

**Uitgevoerd:**
- `src/sim/evaluate.js` aangemaakt met `createSimulationEngine(deps)` factory
- Geëxtraheerd: `evaluateCircuit`, `evaluateWorkspace`, `collectRegisterUpdates`, `makeRegisterStateKey`, `evaluateGate`, `dedupeErrors`, `makeZeroOutputs`
- Deps-injectie: `getNodeSpec`, `getChipDefinition`, `getRegisterStates`, alle bit-helpers uit bits.js
- In script.js: import toegevoegd, engine aangemaakt na chipDefinitionsService
- Oude implementaties vervangen door delegerende stubs (4 functies)
- script.js: 1846 → 1559 regels (−287)
- Alle syntax checks groen

**Aanname:** `stepRegisters` in script.js blijft een actie-functie (schrijft state + roept render aan) — niet geëxtraheerd naar evaluate.js. De engine levert de berekening, script.js past de state toe.

**Resultaat:** groen — node --check OK op alle bestanden

---

## 2026-03-25 — Stap 5 (deel): Panel-renderers → src/ui/panels.js

**Uitgevoerd:**
- `src/ui/panels.js` aangemaakt met `createPanelRenderers(deps)` factory
- Geëxtraheerd: `renderBuiltinPalette`, `renderWorkspaceList`, `renderChipLibrary`, `renderChallenges`, `renderChallengeCard`
- `renderWorkspaceList` krijgt `currentWorkspace` als expliciete parameter (was: `getCurrentWorkspace()` intern)
- script.js: `render()` gebruikt nu `panelRenderers.*`; inline declaraties verwijderd
- script.js: 1426 → 1267 regels (−159)
- `node scripts/verify.js` → 19/19 nog steeds groen

**Resultaat:** groen

---

## 2026-03-25 — Stap 4: Test harness → scripts/verify.js

**Uitgevoerd:**
- `package.json` aangemaakt met `"type": "module"` voor Node.js ES module support
- `scripts/verify.js` aangemaakt: 19 fixture-tests in 3 secties
  - Sectie 1 (bits.js): parseBits, formatBits, bitwiseBinary, bitsToBoolean, zeroBits, ensureWidth
  - Sectie 2 (evaluate.js): AND-circuit fixture — alle 4 inputcombinaties getest
  - Sectie 3 (verification.js): NAND challenge fixture — correcte NAND verified, kapotte AND-only fails
- `node scripts/verify.js` → 19/19 geslaagd
- Roadmap bijgewerkt met verify-commando en actuele status

**Resultaat:** groen — 19/19 tests geslaagd

---

## 2026-03-25 — Stap 5 (afsluiting): boot.js + dead code cleanup

**Uitgevoerd:**
- `src/ui/boot.js` aangemaakt: `createEventBinder({ dom, handlers, workspaceActions, interactionHandlers })`
- Handlers gegroepeerd in een `handlers`-object: undo/redo, workspace-acties, zoom, inspector, keyboard
- In script.js: import toegevoegd, `eventBinder` aangemaakt na `renderOrchestrator`; `bindEvents` body → 1-regel wrapper
- Dead code removed: `renderCanvas()` wrapper in script.js (nooit aangeroepen — render.js heeft eigen interne versie)
- script.js: 1267 → 1120 regels (cumulatief, t.o.v. vorige sessie)
- node scripts/verify.js → 19/19 groen

**Aanname:** Handlers (`handleInspectorFocusIn` etc.) blijven in script.js — te diep gekoppeld aan state/pushUndo. `createEventBinder` registreert alleen; logica blijft waar ze hoort.

**Resultaat:** groen — Stap 5 volledig, Stap 6 dead-code sweep klaar

---

## 2026-03-25 — Stap 5 (vervolg): nodespec + render-orchestrator geëxtraheerd

**Uitgevoerd:**
- `src/model/nodespec.js` aangemaakt met `createNodeSpecFactory({ getChipDefinition })` factory
- `src/ui/render.js` aangemaakt met `createRenderOrchestrator(deps)` factory
- In script.js: imports toegevoegd voor beide modules; `nodeSpecService` aangemaakt vóór `simulationEngine`
- `simulationEngine` gebruikt nu `nodeSpecService.getNodeSpec` i.p.v. inline-declaratie
- `renderOrchestrator` aangemaakt na `panelRenderers`; `render`, `renderCanvas`, `applyWorkspaceZoom` zijn nu 1-regel wrappers
- Bug gefixed: `renderChallenges: () => renderChallenges()` → `() => panelRenderers.renderChallenges()`
- `scripts/verify.js` bijgewerkt: lokale mini-getNodeSpec vervangen door echte `createNodeSpecFactory` import
- script.js: 1267 → 1129 regels (−138)
- `node scripts/verify.js` → 19/19 groen

**Aanname:** `nodeSpecService` aangemaakt voor `simulationEngine` omdat die `getNodeSpec` als dep krijgt. `getChipDefinition` is hoisted function declaration, dus veilig als lazy dep voor `nodeSpecService` vóór `const state`.

**Resultaat:** groen

---

## 2026-03-25 — Stap 3: Node-model extraheren → src/model/nodes.js + src/model/chips.js

**Uitgevoerd:**
- `src/model/nodes.js` aangemaakt: `normalizeNode` als directe export (imports bit-helpers), `createNodeFactory(deps)` returning `{ createNode }`
- `src/model/chips.js` aangemaakt: `createChipsFactory(deps)` returning `{ createWorkspace, createChipInstance }`
- In script.js: imports toegevoegd voor `normalizeNode`, `createNodeFactory`, `createChipsFactory`
- Factory-instantiaties aangemaakt VOOR `const state = { project: loadProject() }` (zodat hoisting niet nodig is)
- Inline declaraties `normalizeNode`, `createNode`, `createWorkspace`, `createChipInstance` verwijderd uit script.js
- script.js: 1559 → 1426 regels (−133)
- Alle syntax checks groen

**Aanname:** `getChipDefinition` wordt doorgegeven als lazy-ref aan `createChipsFactory`. Wordt niet aangeroepen tijdens initialisatie — alleen bij `createChipInstance` via user-interactie. Veilig.

**Resultaat:** groen — node --check OK op alle bestanden

---

## 2026-08-03 — Leerapp Stap 1.1: Curriculum-datamodel + unlock-gating

**Uitgevoerd:**
- `src/data/curriculum.js` nieuw: `CURRICULUM` (5 modules), `getPrerequisites`, `isLessonUnlocked`, `deriveCompletedChallengeIds`, `normalizeLearner`, `markChallengeCompleted`
- Prerequisites op alle 24 challenges via `applyPrerequisitesToChallenges` (vorige les in curriculum-volgorde)
- `project.learner`: `{ completedChallengeIds, unlockedAll }` in create/normalize; migratie leidt completions af uit verified chips als `completedChallengeIds` ontbrak
- Bootstrap: project laden ná `challengeVerifier` zodat migratie `evaluateChallengeResult` kan gebruiken
- Submit schrijft challenge-id naar `completedChallengeIds` bij geslaagde verify
- Challenge-panel: modules i.p.v. Project-fases, slotje + “Vereist: …”, Start/Submit disabled als locked; toggle “Vrije modus”
- Fixtures in `scripts/verify.js` sectie 7 (unlock + derive + migratie) — 42/42 groen

**Aannames:**
- Curriculum-volgorde volgt bestaande challenge-volgorde gegroepeerd in roadmap-modules (RAM na ALU, zoals huidige Project 5).
- Voortgangsbalk telt `learner.completedChallengeIds` (niet alleen live chip-verify), zodat gating en progress synchroon blijven.

**Resultaat:** groen — `npm run check` + `npm test` (42 fixtures)

---

## 2026-08-03 — Leerapp Stap 1.2: Les-flow — theorie eerst, dan bouwen

**Uitgevoerd:**
- `learning: { goal, concepts, quiz? }` op alle 24 challenges (`LEARNING_BY_ID` in `challenges.js`)
- Quiz (1–2 vragen) voor eerste 6 lessen; antwoorden in `learner.quizAnswers[challengeId]`
- Challenge-detail: theorie standaard open tot voltooiing; goal + concepts in apart “Bouwen”-blok; quiz met direct feedback
- Styles: `.lesson-theory-block` vs `.lesson-build-block`
- Fixtures uitgebreid — 47/47 groen

**Aannames:**
- Quiz blokkeert Start niet (zoals gevraagd).
- `explain` op quizvragen is UI-only (geen schema-breaking veld).

**Resultaat:** groen — `npm run check` + `npm test` (47 fixtures)

---

## 2026-08-03 — Leerapp Stap 1.3: Guided walkthrough voor les 1

**Uitgevoerd:**
- `src/ui/tutorial.js`: `createTutorial` met 5 stappen (Parts→NAND, wire A, wire OUT, toggle A, Submit)
- Coach-mark + spotlight (CSS overlay, geen library); voortgang via `onStateChanged()` in `renderWorkspaceView`
- Auto-start bij openen NAND-sheet als les niet voltooid en `tutorialDismissed` false; Overslaan zet `learner.tutorialDismissed`
- Geen toegang tot `src/sim/` — alleen workspace-state + DOM-ankers
- `npm run check` + `npm test` groen (47 fixtures)

**Aannames:**
- Stap “toggle A” is compleet wanneer `previewValue` van Input A een `1` bevat.
- Tutorial noemt B als tip bij Submit; B-aansluiting is geen aparte tutorialstap (roadmap noemt alleen A).

**Resultaat:** groen — Fase 1 afgerond; volgende sessie start bij Fase 2.1

---

## 2026-08-03 — Leerapp Stap 2.1: Ontbrekende combinationele chips

**Uitgevoerd:**
- 8 nieuwe combinationele lessen: not16, and16, or16, mux16, or8way, mux4way16, mux8way16, dmux8way
- Curriculum poorten: mux/dmux → 16-bit poorten → or4way/mux4way/dmux4way → way-chips
- Learning goals/concepts voor alle nieuwe lessen
- Verify-fixture: Not16 met 16-bit NOT-gate referentie — 56/56 groen

**Aannames:**
- mux/dmux vóór not16/mux16 gezet (nodig om Mux16 te kunnen bouwen); way-chips na dmux4way zoals roadmap.
- MAX_WIDTH=16: splitter/joiner dekken 16-bit bussen; builtin gates met width=16 volstaan als referentie.

**Resultaat:** groen — `npm run check` + `npm test` (56 fixtures)

---

## 2026-08-03 — Leerapp Stap 2.2: DFF-les en geheugen-verdieping

**Uitgevoerd:**
- Nieuwe les `dff` (Bit met LOAD): sequential-script; theorie dat builtin Register = DFF-primitieve
- Nieuwe les `register16` tussen register-chip en pc
- Curriculum geheugen: dff → register-chip → register16 → pc
- `register-chip` namen: `Register`/`Reg1` (was Bit/Register — Bit is nu van dff)
- ram8-theorie herschreven met verwijzing naar DFF/Bit/Register16/Mux8Way
- Hint: clock-gating (CLK AND LOAD) i.p.v. MUX-feedback (combinatorische lus breekt hold in deze evaluator)
- Verify-fixture Bit met clock-gating; `sim.getRegisterStates` deelt nu state met verifier
- 60/60 groen

**Aannames / tick-semantiek:**
- Tick = `applyDefinitionStep` met huidige inputs; register neemt D over als CLK-input van de node hoog is (`collectRegisterUpdates`).
- Bit-referentie gebruikt CLK_reg = CLK∧LOAD, D=IN (gedragsequivalent aan LOAD-MUX zonder Q-feedbacklus).

**Resultaat:** groen — `npm run check` + `npm test` (60 fixtures)

---

## 2026-08-03 — Leerapp Stap 2.3: Instructie-decoder en CPU-verdieping

**Uitgevoerd:**
- Les `instruction-decoder`: splits IN[16] → isA/comp/dest/jump; 8 tests (@21, D=A, D=D+M, 0;JMP, …)
- Les `alu-with-registers`: A/D + ALU mini-datapad; sequential-script met D=A en D=D+A via `computeHackAlu`
- Curriculum ALU-module: add16 → inc16 → alu → instruction-decoder → alu-with-registers
- CPU-script uitgebreid: @7; D=A; @3; D=D+A; A=D (addressM uit ALU-som) + @100; 0;JMP (pc)
- Fixtures sectie 10 — 74/74 groen

**Aannames:**
- Instructiebitvelden MSB-links: isA=¬bit15, comp=bits12–6, dest=bits5–3, jump=bits2–0.
- CPU-tests observeren addressM/pc (geen directe D-output); som 7+3 via computeHackAlu → addressM.

**Resultaat:** groen — Fase 2 afgerond; volgende sessie start bij Fase 3.1 (klok-runner)

---

## 2026-08-03 — Leerapp Stap 3.1: Klok-runner

**Uitgevoerd:**
- `clockRunner` in `runtime.js`: start/stop/isRunning/setSpeed/togglePlay
- Tick = CLK-bronnen hoog → register-step → laag → register-step (clock-nodes + input-pins genaamd CLK)
- Snelheden 1 / 4 / 16 Hz + max (rAF); tijdens run alleen `renderWorkspaceView({ save: false })`, save bij stop
- Toolbar: ▶ Play / ⏸ Pause + Hz-select; stopt bij workspace-wissel, challenge-open, import
- Fixtures clock-cycle — 76/76 groen

**Tick-semantiek (keuze):** level-sensitive zoals `collectRegisterUpdates` (CLK hoog ⇒ D overnemen). Geen edge-detectie.

**Resultaat:** groen — `npm run check` + `npm test` (76 fixtures)

---

## 2026-08-03 — Leerapp Stap 3.2: ROM-node

**Uitgevoerd:**
- Node-type `rom`: ADDR (addressWidth ≤8) → OUT 16-bit; `program: string[]`
- Normalisatie `normalizeRomProgram` / `clampRomAddressWidth` in `nodes.js`
- Evaluatie combinationeel: `OUT = program[ADDR] ?? zeros`
- Inspector: address width + textarea met regelnummers; parts-lijst + canvas “ROM · N instr”
- Fixtures ADDR 0/1/2/OOB + normalisatie-regressie

**Resultaat:** groen — `npm run check` + `npm test` (85 fixtures)

---

## 2026-08-03 — Leerapp Stap 3.3: Screen + Keyboard

**Uitgevoerd:**
- `screen` 8×8: IN(16)/ROW(3)/WRITE/CLK; latched via `collectRegisterUpdates` (8 rij-keys × 8 bit — clampWidth max 16)
- Canvas pixelgrid; `keyboard` OUT=keyCode, klik=luister, Esc=stop
- Fixtures screen-write + keyboard OUT

**Resultaat:** groen — `npm run check` + `npm test` (90 fixtures)

---

## 2026-08-03 — Leerapp Stap 3.4: Eindproject Computer

**Uitgevoerd:**
- `src/data/demo-programs.js` — SCREEN_ROWS_DEMO (HACK-achtig, rijen schilderen)
- Les `computer` na `cpu`: template met ROM (demo) + Screen; pins reset/CLK → pc
- `expectState` in sequential-script (key-suffix match op registerStates)
- `populateChallengeWorkspace` ondersteunt `template.nodes`
- Voltooiingsoverlay + `learner.completionOverlayDismissed`; knop “Toon voltooiing”
- Referentie-Computer alleen in verify-fixture (3-bit teller → Screen); niet in chip-bibliotheek/starters
- Starter-chips gefilterd uit chip-library place-lijst

**Resultaat:** groen — `npm run check` + `npm test` (100 fixtures)

---

## 2026-08-03 — Leerapp Stap 4.1: Evaluatie-cache

**Uitgevoerd:**
- Memoization voor combinationele chip-instances: key = `definitionId::serializedInputs`
- Alleen als `isCombinationalDefinition` (geen register/screen, ook nested); sequentiële chips niet gecached
- Cache-scope: één `Map` gedeeld over de hele evaluateCircuit-boom per top-level call
- `enableComboCache: false` voor baseline-benchmarks

**Benchmark (100× nest: 8×(8×NAND)):**
- uncached: **195 ms**
- cached: **17 ms** (~11× sneller)

**Resultaat:** groen — `npm run check` + `npm test` (106 fixtures)

---

## 2026-08-03 — Leerapp Stap 4.2: Playwright E2E

**Uitgevoerd:**
- `playwright` + `@playwright/test` (devDependency); Chromium geïnstalleerd
- `playwright.config.js` met webServer `serve` op :4173
- `e2e/nand-flow.spec.js`: boot → NAND start → place → 3 wires → Submit → Verified + les `not` unlocked
- Failure-check: zonder submit-klik → status blijft "Open" (test faalt) → submit hersteld
- README bijgewerkt; `.gitignore` voor test-results/node_modules

**Resultaat:** groen — `npm run e2e` + `npm test`

---

## 2026-08-03 — Leerapp Fase 5: Cursus, badges, feedback

**Uitgevoerd:**
- **5.1** Cursus/Werkplaats-tabs; `#course-view` met modulekaarten + voortgangsring + “Ga verder”; verse gebruiker start op Cursus
- **5.2** `learner.badges` + `computeModuleBadges`/`syncLearnerBadges`; `src/data/strings.js`; NL knoppen/labels (status “Gehaald”)
- **5.3** sequential-script `failedCases` met step/inputs/expected/actual; tabel in challenge-detail

**Resultaat:** groen — `npm run check` + `npm test` (113) + `npm run e2e`

---

## 2026-08-04 — Distributie 1.1: Manifest + icons

**Uitgevoerd:**
- `manifest.webmanifest` met name/short_name, `start_url`/`scope` `"./"`, `display: standalone`, `lang: nl`, theme `#58a6ff`, background `#0d1117`
- `icons/icon.svg` (NAND-symbool) + `scripts/generate-icons.js` (sharp) → PNG 192/512/maskable + apple-touch-icon
- `index.html`: `<link rel="manifest">`, `theme-color`, `apple-touch-icon`
- npm-script `icons`

**Aanname:** apple-touch 180×180 meegenomen naast roadmap-icons voor iOS beginscherm.

**Resultaat:** groen — `npm run check` + `npm test` + `npm run e2e`

---

## 2026-08-04 — Distributie 1.2: Service worker + offline

**Uitgevoerd:**
- `sw.js`: precache bij install, oude caches opruimen bij activate, stale-while-revalidate voor same-origin GET; geen `skipWaiting`; `clients.claim`
- `scripts/generate-sw-precache.js` → `sw-precache.js` (`self.__PRECACHE` + content-hash `__CACHE_VERSION`); npm-script `build:sw`
- Registratie in `src/main.js` (https/localhost; ook als document al `complete` is); update-melding via `#status-line`
- `serve.json` voor manifest MIME; `sw.js` in syntax-check

**Aanname:** precache bevat app-shell + icons + hele `src/`; opnieuw `npm run build:sw` na toevoegen/hernoemen van bronbestanden.

**Resultaat:** groen — `npm run check` + `npm test` + `npm run e2e`

---

## 2026-08-04 — Distributie 1.3: E2E PWA offline + manifest

**Uitgevoerd:**
- `e2e/pwa.spec.js`: wacht op SW `activated` + controller; `setOffline` + SW-controlled fetch van shell; manifest 200/JSON
- Offline document-navigation (`page.reload`) faalt betrouwbaar in Chromium+Playwright (`net::ERR_FAILED`); shell-fetch dekt dezelfde SW-cache

**Resultaat:** groen — `npm run check` + `npm test` + `npm run e2e` (14 specs)

---

## 2026-08-04 — Distributie 2.1: GitHub Pages workflow

**Uitgevoerd:**
- `.github/workflows/deploy.yml`: push `main` → `npm ci` → check → test → `build:sw` → Pages-artifact (excl. node_modules/e2e/docs/scripts/…) → `deploy-pages`
- Relatieve paden in `index.html` geverifieerd (geen `src="/` / `href="/`)
- README: handmatige stap Pages source = GitHub Actions

**Aanname:** live-URL verschijnt na eerste succesvolle workflow + Pages-instelling door repo-eigenaar.

**Resultaat:** groen — `npm run check` + `npm test` + `npm run e2e`

---

## 2026-08-04 — Distributie 2.2: README installeren & delen

**Uitgevoerd:**
- README-secties: publieke URL, installeren (Chrome/Edge, Android, iOS), lokaal opslagmodel, apparaat wisselen via link/export, `build:sw` / `icons`

**Resultaat:** groen — `npm run check` + `npm test` + `npm run e2e`

---

## 2026-08-04 — Distributie 3.1: Roterende backups + herstel

**Uitgevoerd:**
- `project.js`: keys `forge-logic-backup-1..3` + meta; rotatie max. 1× / 2 minuten bij save; `listBackups` / `restoreBackup`; `QuotaExceededError` → `{ ok:false, reason:"quota" }`
- Statusmelding bij quota; knop **Herstel back-up** + `appModals` select-dialoog
- Fixtures in `verify.js` (§6b) met memory-storage mock

**Keuze:** rotatie begrensd op 2 minuten zodat debounced saves niet drie slots vullen bij elke tip.

**Resultaat:** groen — `npm run check` + `npm test` (130) + `npm run e2e`

---

## 2026-08-04 — Distributie 3.2: iOS-kanttekening

**Uitgevoerd:**
- Onboarding + README: tip om op iPhone/iPad af en toe te exporteren (Safari site-data)

**Resultaat:** groen — `npm run check` + `npm test` + `npm run e2e`

---

## 2026-08-05 — i18n: EN default + NL switch

**Uitgevoerd:**
- `src/i18n/`: `t` / `setLocale` / `applyStaticI18n`, dictionaries `en.js` + `nl.js`, key `forge-logic-locale` (default `en`)
- `index.html`: `data-i18n*` + EN/NL toggle; early `html lang` from localStorage
- Challenge prose in `src/data/locales/challenges-en.js` + `challenges-nl.js`; `localizeChallenge` / `localizeCurriculumModule`
- UI/actions/tutorial/modals/inspector/canvas gemigreerd naar `t()`
- Fixtures §18; E2E asserts op EN (+ locale smoke EN→NL); manifest `lang: en`

**Aanname:** chip-/poortnamen blijven Engels; project-JSON bevat geen locale (apparaatvoorkeur zoals thema).

**Resultaat:** groen — `npm run check` + `npm test` (141) + `npm run e2e` (15, incl. locale smoke)

---

## 2026-11-04 — UX fase A: schermindeling home · les · vrij bouwen

**Uitgevoerd:**
- `docs/ux-roadmap.md` aangemaakt (fases A–E, ontwerpbesluiten eigenaar).
- `index.html`: drie-koloms dashboard vervangen door `.app[data-view]` met app-balk (Lessen / Vrij bouwen / ⚙), startpagina, lespaneel, sandbox-paneel en canvas. Beheerknoppen (export, import, back-up, links, taal, thema) in het ⚙-menu.
- `script.js`: `state.appView ∈ {home, lesson, sandbox}`, `openLesson()` hervat de bestaande les-sheet ("Opnieuw beginnen" maakt een verse), `ensureSandboxWorkspace()`, vrij bouwen vergrendeld tot de eerste les van het curriculum af is (of vrije modus), contextuele chrome: klokknoppen alleen bij sequentiële les of sheet met klok/register/ROM/screen/keyboard (ook via chips), inspector/checks als zwevende kaarten, scrollpositie per sheet.
- `src/ui/course.js`: startpagina met modules, lessenlijst per module, vrij-bouwen-kaart en vrije modus.
- `src/ui/panels.js`: lespaneel toont alleen de actieve les (terug, positie, "Controleer mijn schakeling", "Volgende les"); sheetlijst toont geen les-drafts.
- `styles.css`: `[hidden]`-lek gerepareerd; layout per view; onder 1024px wordt het lespaneel een inklapbaar onderpaneel.
- Onboarding-tekst ingekort en in lijn met de nieuwe flow (volledige vervanging in fase C).
- E2E bijgewerkt naar de nieuwe flow + `e2e/helpers.js`; nieuwe tests: vergrendeling vrij bouwen, klokknoppen contextueel, les hervatten.

**Aannames:** "les 0" bestaat nog niet; tot fase C geldt de eerste les van het curriculum als ontgrendelvoorwaarde. Simulatie/verificatie niet aangeraakt.

**Resultaat:** groen — `npm test` 141/141, `npm run check` OK, e2e 15/15; geen horizontale overflow op 390/820/1180/1440px.

---

## 2026-11-04 — UX fase B: lespaneel als stappenflow

**Uitgevoerd:**
- `src/ui/panels.js`: tabs (Theory/Hints/Tests) vervangen door verticale stappen Doel → Snap het → Bouw → Controleer → Begrepen? → Verder, met status per stap (✓ / huidig / komt nog). Theorie inklapbaar (open tot de les af is, keuze onthouden), hintladder (één hint per klik), interface-regel (`A, B → OUT`), "Nieuw in je onderdelen" na afronden, "Opnieuw beginnen" als subtiele link.
- Live controle: voor combinatorische lessen wordt de huidige sheet als tijdelijke chip doorgerekend (zonder opslaan) en toont een testtabel met ✓/✗ per rij; eerste foute rij uitgelicht. Pas zichtbaar als alle outputs verbonden zijn. Debounced ververst bij elke wijziging op het canvas.
- `src/model/lesson-palette.js` (nieuw): onderdelen per les; poorten komen vrij na de les die ze bouwt. Starter-chips verborgen in lessen.
- `src/actions/workspace-mutations.js`: nieuwe onderdelen op een vrije plek binnen het zichtbare canvas.
- Truth-probe-tabel (op basis van opgeslagen chip) vervangen door de live controle.
- Tests: 14 nieuwe unit-tests (palet), e2e-test voor stappen/hints/palet/live controle.

**Aannames:** poort-ontgrendeling is een UX-filter, geen verificatie-eis; vrije modus biedt alle poorten.

**Resultaat:** groen — `npm test` 155/155, `npm run check` OK, e2e 15/15.

---

## 2026-11-05 — UX fase C: begeleiding en les 0

**Uitgevoerd:**
- Les 0 "Licht aan" (`intro-light`): casus buitenlamp (DOOR AND ALARM → LAMP), eigen module "0. Start", EN/NL-teksten en quiz. `extraParts` in het lesschema om AND in deze les aan te bieden.
- Coach data-gedreven: `src/data/coach-scripts.js` (les 0–5) + generieke engine `src/ui/tutorial.js` (predicaten has/wire/fed/high/completed/ack/all; doelen part/out/toggle/check/selector; tweefasige draadbegeleiding; volgt menu's en scroll; scrollt doel in beeld).
- Learner: `coachEnabled`, `coachDismissed` per les; migratie van het oude `tutorialDismissed` en automatisch les 0 voor bestaande voortgang.
- UI: "Laat zien hoe"-knop in de Bouw-stap, ⚙ → Begeleiding, `?`-hulpmenu met herschreven uitleg en sneltoetsen, welkomst-hero op het startscherm i.p.v. overlay, inklapbare inspector (dicht in lessen), gelokaliseerde sheetnamen.
- Tests: unit (prerequisites, migratie, palet les 0) en e2e (volledige les 0 met coach → les 1; coach opnieuw starten; coach uitzetten; hulpmenu).

**Resultaat:** groen — `npm test` 163/163, `npm run check` OK, e2e 17/17.

---

## 2026-11-05 — UX fase D: tablet en touch

**Uitgevoerd:**
- Touch-maten via `@media (pointer: coarse)` (nodes, pins + tikzones, toggles, draden, canvasknoppen).
- Gebaren: pinch-zoom + twee-vinger-pan rond het middelpunt, Ctrl/⌘+wheel-zoom rond de cursor (`bindTouchGestures` in `script.js`); `setZoom` kreeg een focuspunt; `fitToContent` + knop ⤢.
- Onderpaneel met drie standen (peek/half/full), sleepbaar, voor les- en sandbox-paneel; peek toont live-status en Controleer.
- Onderdelenstrip op smalle schermen (`#parts-strip`, aparte data-attributen zodat bestaande selectors uniek blijven); coach wijst de strip aan.
- Plaatsing: echte node-maten, obstakels = nodes + zwevende kaarten, dichtstbijzijnde vrije plek, buiten beeld → canvas scrollt mee (`pendingReveal`).
- Compacte les-indeling op smal canvas + automatisch passend maken bij openen; lesscherm wordt getoond vóór de sheet wordt aangemaakt zodat de maat bekend is.
- E2E `touch.spec.js` (3 viewports); pinch handmatig geverifieerd met synthetische pointer-events (100% → 200%).

**Resultaat:** groen — `npm test` 163/163, `npm run check` OK, e2e 20/20.

---

## 2026-11-08 — UX fase E: afwerking

**Uitgevoerd:**
- i18n: ~45 hardcoded NL-teksten naar sleutels (`msg.*`, `sim.*`, `chip.*`, `verify.*`, `share.*`, `partCopy.*`, `starterDescription.*`) in o.a. `circuit-mutations.js`, `sim/evaluate.js`, `chips/definitions.js`, `challenges/verification.js`, `project-io.js`, `lib/project-share.js`, `builtinParts.js`.
- `src/model/circuit-signature.js` (nieuw): logische handtekening van een schakeling; `saveCurrentWorkspaceAsChip` hergebruikt de laatste versie bij een ongewijzigde schakeling.
- `checkStarterShortcut` in de verificatie.
- Lege staten en knophiërarchie (overzicht, Parts, chipbibliotheek).
- Tests: 6 nieuwe unit-tests (handtekening, taal van meldingen, starter-regel), e2e: opnieuw controleren maakt geen nieuwe chipversie. Handmatige scan van alle schermen in EN: 0 Nederlandse regels (zelfde scan in NL: 146).

**Aanname:** de taal van foutmeldingen volgt de taal op het moment van evalueren; na een taalwissel rekent de app opnieuw en kloppen de meldingen weer.

**Resultaat:** groen — `npm test` 169/169, `npm run check` OK, e2e 20/20.
