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

---

## 2026-11-11 — UX fase F: canvas leesbaar en direct

**Uitgevoerd** (één commit per stap):
- F.1 Uit is grijs: `--pin-low-bg`, `--pin-low-border` en `--wire-low` in alle drie de themablokken; rood blijft alleen voor `--wire-invalid` en `--warning`.
- F.2 Grotere onderdelen: `.node` 132px (148px bij `pointer: coarse`), labels/pins/symbolen volgens plan, `.pin-badge` 10px; `inputStep`/`outputStep` minimaal 120. De coarse-overrides die onder de nieuwe minimumwaarden uitkwamen (label, pin-label, pin-value, pill/meta) zijn meeverhoogd; pins en tikzones niet verkleind.
- F.3 Rustiger onderdelen: `.node-state-pill` alleen als de tekst afwijkt van de titel en niet voor input-pin/output-pin/switch/lamp; poortsymbolen `1`, `&`, `≥1`, `=1`, `&`, `≥1` met inversiebolletje (`is-inverting`); 1-bit switch/input-pin/klok als pilschakelaar (`.node-switch-toggle`, zelfde `data-node-action`/`data-node-id`, `aria-pressed`, tekst 0/1); i18n-sleutel `toggle` is nu de aria-label ("Omschakelen" / "Toggle").
- F.4 `getSuggestedNodePosition`: zonder selectie en met minstens één input-pin en output-pin wordt de voorkeurspositie het midden tussen beide kolommen, op gemiddelde input-hoogte; zoekactie en obstakellogica ongewijzigd. E2E toegevoegd (DOOR.x < AND.x < LAMP.x, tweede onderdeel overlapt niet).
- F.5 Draad slepen: pointerdown op uitgang start pending + `is-wiring` op `#workspace-canvas`; `pointermove` tekent alleen `path.wire-preview` in `#wire-layer`; loslaten op een ingang gebruikt `handlePinClick` (dus `connectPins` + status); <8px blijft klik-klik; elders loslaten annuleert. Een tik op leeg canvas (zonder pan) annuleert nu ook (bestond nog niet), Escape werkte al. In `bindTouchGestures` telt een vinger op een pin niet mee voor pan/pinch. E2E toegevoegd (slepen, preview, annuleren). Met touch geverifieerd via CDP-touchevents op 820×1180 (slepen en tik-tik maken beide een draad).
- F.6 `openLesson` roept `fitToContent({ minZoom: 0.6, maxZoom: 1.25, centered: true })` aan; `centered` is nieuw (zet de inhoud in het midden en zoomt in stappen van 0,05 uit zolang nodes onder de zwevende kaarten uit `#inspector-card`/`.canvas-tools`/`.canvas-status` liggen). Op touch wordt daarvoor niet onder 100% uitgezoomd (pins moeten vingergroot blijven). De ⤢-knop en andere aanroepen gedragen zich als voorheen.

**Aannames/afwijkingen:**
- Brede (>1 bit) schakelbare onderdelen houden de tekstknop; de zichtbare tekst daarvan is een nieuwe sleutel `toggleShort` ("toggle" / "wissel"), omdat "Omschakelen" in de node niet paste. Dit is achteraf in de F.3-commit gefixupt.
- De opdracht noemde dat een klik op leeg canvas al annuleert; dat bleek niet zo en is in F.5 toegevoegd.

**Bevindingen (niet opgepakt):**
- 16-bit input-nodes (bv. X/Y in de ALU-les): de 16-cijferige waarde plus knop is breder dan de node (132px) en steekt over de OUT-pin heen. Past bij een vervolgstap (bv. waarde inkorten of node breder bij width > 1).
- Op 1440×900 loopt de ALU-les uit naar 62% zoom; de teksten zijn dan klein (0,6 is de ondergrens uit het plan).
- Statusregels linksonder ("Klik output, klik input." + laatste melding) liggen op tablet staand nog over de onderste input-node (ALARM); dat is ruis die fase H.3 oplost.
- Op tablet staand valt de eerste AND al tussen DOOR en LAMP; dat kwam al uit de bestaande fallback en blijft zo.
- De spec noemt `--challenge-card-bg` (bruine lestint) nog; staat in fase J/H.

**Resultaat:** groen, `npm test` 169/169, `npm run check` OK (52 bestanden), e2e 22/22 (20 bestaande + 2 nieuwe). Alle drie de thema's (dark, light, neon) visueel gecontroleerd op 1440×900, 1180×820 en 820×1180 (touch).

---

## 2026-11-11 — UX fase G: les, één stap tegelijk

### G.4 taak 4 — inventaris: lessen waarvan `theory[0]` de bouwwijze verklapt (NL, alleen genoteerd, niets herschreven)

Beoordeeld op: noemt de eerste theorie-alinea welke poorten/chips je gebruikt of hoe je ze verbindt.

Verklapt duidelijk (6):
- `add4` — "rijgt vier adders aaneen … ripple-carry adder, carry rimpelt van rechts naar links".
- `add16` — "dezelfde structuur als Add4: zestien Full Adders … met carry tussen de posities".
- `register16` — "Bit × 16: één LOAD en één CLK sturen alle bits tegelijk".
- `alu-with-registers` — "A en D voeden de ALU; de ALU-uitkomst kan terug naar D".
- `cpu` — noemt alle onderdelen (PC, registers, ALU, geheugen) en hun rol.
- `computer` — noemt de onderdelen (ROM, CPU, Screen).

Grensgevallen (3 groepen):
- `xor-nand-only` — noemt de beperking (alleen NAND), niet de opbouw.
- `half-adder`, `inc4` — "berekent beide bits apart" / "chain van carries van rechts naar links" geven een richting, geen onderdelen.
- `ram64`, `ram512`, `ram4k`, `ram16k` — "dezelfde LOAD/ADDR/CLK-interface als RAM8, maar meer adresbits"; verwijst naar de opbouw via RAM8 en bevat letterlijk de titel ("Build RAM64 is een grotere …", vier keer vrijwel dezelfde tekst).

Verklapt niet (rest): `intro-light`, `nand`, `not`, `and`, `or`, `xor` (de NAND-formule staat in alinea 3, nu achter "Meer uitleg"), `mux`, `dmux`, `not16`, `and16`, `or16`, `mux16`, `or4way`, `mux4way`, `dmux4way`, `or8way`, `mux4way16`, `mux8way16`, `dmux8way`, `full-adder`, `inc16`, `dff`, `register-chip`, `pc`, `alu`, `instruction-decoder`, `ram8`, `mod4-counter`.
Totaal 41 lessen bekeken (6 duidelijk, 7 grensgeval, 28 niet) (zelfde tekst als in `src/data/challenges.js`; de EN-teksten zijn niet apart beoordeeld).

### Uitgevoerd (één commit per stap)
- G.1 Vier stappen `intro`/`build`/`quiz`/`next` (`data-lesson-step`). Intro = doel + begrippen + theorie; Bouw = hints, "Laat zien hoe", live-tabel en feedback. `state.introSeen` (niet opgeslagen) wordt waar na "Aan de slag" (`data-intro-done`), zodra het werkblad meer nodes heeft dan het lessjabloon (ook sticky), of als de les klaar is. Alleen stappen vóór de huidige zijn afgevinkt. Sleutels `stepIntro`, `introStart`. Coach-scripts wijzen nu naar `[data-lesson-step="intro"]` i.p.v. goal/theory.
- G.2 `.lesson-progress` (bolletje + korte titel per stap), alleen de huidige stap toont inhoud; afgeronde stappen zijn één regel die opent (`data-expand-step`, `state.expandedStep[id] = {step, current}`), komende stappen één gedimde regel. Statuschip vervangen door ✓ (`.challenge-verified`). `syncLessonStep()` (aangeroepen vanuit `updateWorkspaceChrome`) laat het paneel de intro verlaten zodra er onderdelen op het canvas staan.
- G.3 `.lesson-actionbar` als laatste kind van `#challenge-list` (sticky, `margin-top:auto`), status links en één primaire knop rechts: Aan de slag (`data-intro-done`) / Controleer (`data-submit-challenge`) + live status "x van y rijen kloppen" / geen (quiz: "Beantwoord de vraag") / Volgende les → (`data-next-lesson`). Losse knoppen uit de stapinhoud gehaald. Onderpaneel (`data-peek-check`) toont dezelfde status en kopieert label en actie van de primaire knop. Knoplabel `lessonCheck` is nu "Controleer"/"Check"; verwijzingen in coach-, hulp- en introteksten meegenomen.
- G.4 Intro toont alleen `theory[0]`, de rest staat achter `<details>` "Meer uitleg" (`theoryMore`, standaard dicht, `state.theoryOpen`). `.lesson-interface` (A, B → OUT) weg. Inventaris hierboven.
- G.5 `positionCoach`: doel in lespaneel (breed) → ballon rechts naast het paneel op hoogte van het doel, `data-arrow="left"`; geen doel → midden van het canvas; smal → boven het onderpaneel (pijltje omlaag, ballon nooit eroverheen); ballon schuift omhoog als hij het doel of de primaire knop van de actiebalk zou raken; op breed blijft de ballon buiten het lespaneel.

### Aannames/afwijkingen
- "Alleen stappen vóór de huidige zijn is-done" + "Verder pas na de quiz": de quiz stuurt "Verder" aan. Een quiz telt als af zodra alle vragen beantwoord zijn (goed of fout). E2E beantwoordt de quiz nu vóór "Volgende les" (`answerQuiz` in `e2e/helpers.js`).
- Opnieuw controleren na een geslaagde les kan alleen door de afgeronde Bouw-stap uit te klappen; daar staat een ghost-knop "Controleer opnieuw" (`data-submit-challenge`). Dit is mijn toevoeging (anders is er geen manier meer, en een e2e-test toetst dat een tweede controle geen nieuwe chipversie maakt). De hook staat daarmee nooit tegelijk met de primaire knop in de balk zichtbaar (die toont dan Verder/quiz).
- Een geslaagde-melding ("Ingeleverd: …") en "Nieuw in je onderdelen" staan boven de stappen zodra de les geslaagd is (quiz/verder), omdat de Bouw-stap dan inklapt.
- Statusregel in de balk bij sequentiële lessen: "Test met Controleer" (nieuwe sleutels `barSequential`, `barNeedsInterface`, `barRows`, `barAllRows`, `barQuiz`, `barDone`, `lessonCheckAgain`, `lessonProgress`). `liveAllPass`/`liveSequential` noemen nu "Controleer". `stepGoal`, `stepTheory`, `theoryRead`, `theoryHide`, `stepCheck` zijn niet meer in gebruik en verwijderd.
- E2E aangepast met behoud van wat ze toetsen: `data-lesson-step="check"` → `build` (is-done), `.challenge-status` → `.challenge-verified`, intro eerst afronden in de "stappen"-test en de coach-opnieuw-test, quiz beantwoorden vóór `data-next-lesson`, afgeronde Bouw-stap uitklappen voor de tweede controle. Nieuw: intro toont één theorie-alinea (XOR), coach ligt naast het paneel.

### Bevindingen (niet opgepakt)
- Coach-stap 1 (welkom) staat naast het paneel en bedekt daarmee op 1440×900 deels het DOOR-blok op het canvas; stap 2 (canvas) legt de ballon bewust binnen het canvas (het doel is het hele canvas), daar is overlap met het "doel" onvermijdelijk.
- De voortgangsrij en de verticale staplijst tonen dezelfde vier stappen (volgt het plan letterlijk); op 372px breed wordt "Begrepen?" als huidige stap afgekapt ("Begre…").
- Quiz is nu verplicht (alleen beantwoorden, niet goed) om "Verder" te bereiken; wie de quiz wil overslaan kan niet naar de volgende les via het paneel (wel via Lessen).
- `introSeen` is sticky per sessie: "Opnieuw beginnen" op een les waarvan de intro al gezien is opent direct in Bouw.
- Lessen 1–5 (nand, not, and, or, xor) scrollen op 1440×900 in intro en bouw niet (gemeten); de quiz- en verder-stap is alleen voor les 0 gemeten (ook geen scroll).
- Palet is nog steeds de Parts-dropdown op breed (H.1), `Huidige sheet` en twee statusregels linksonder liggen op tablet nog over onderste nodes (H.2/H.3).
- Duplicaat in lesinhoud: `ram64`/`ram512`/`ram4k`/`ram16k` hebben bijna dezelfde `theory[0]` met de titel erin ("Build RAM64 is een grotere …").

### Resultaat
Groen: `npm test` 169/169, `npm run check` OK (52 bestanden), e2e 24/24 (22 bestaande + 2 nieuwe). Schermafdrukken op 1440×900, 1180×820 en 820×1180 (touch) van les 0 in alle stappen en de XOR-les; thema's dark, light en neon bekeken voor G.2/G.3/G.5; onderpaneel 820×1180 peek/half/full en alle 9 coachstappen (1440×900, 1180×820, 820×1180; dark, plus light/neon op desktop) gecontroleerd.

---

## 2026-11-11 — UX fase H: rust op het scherm

**Uitgevoerd** (één commit per stap):
- H.0 (extra stap, besluit eigenaar) `.lesson-progress` en `renderLessonProgress` weg (markup + CSS + sleutel `lessonProgress`). In de quiz-stap toont de actiebalk een ghost-knop "Sla over" / "Skip" (`data-quiz-skip`, sleutels `quizSkip`, `quizStillOpen`); `state.quizSkipped` (geheugen) maakt `next` de huidige stap. Een overgeslagen quiz is niet afgevinkt: stapstatus `is-pending`, één regel met "Nog te doen" die bij een klik openklapt (`data-expand-step`), na beantwoorden volgt het vinkje. `openLesson` zet `quizSkipped` bij het heropenen van een voltooide les met onbeantwoorde quiz. "Opnieuw beginnen" (`openLesson(..., {fresh:true})`) zet `introSeen[id] = false` en wist `quizSkipped[id]`; `renderChallengeDetail` leest `introSeen === false` als "intro nog niet gezien", ook bij een voltooide les. E2E: nieuwe test (quiz overslaan, "Nog te doen", alsnog beantwoorden) en een intro-check in de "Opnieuw beginnen"-test.
- H.1 `#parts-strip` is het enige palet. Knoppen: symbool (via `getNodeSymbol`, nu geëxporteerd uit `canvas.js`) boven het label, `title` = `partCopy.*`; groepen in/uit · poorten · bus/klok/geheugen · eigen chips · "leer je later" (uitgeschakeld, 🔒, `paletteLockedTitle`), gescheiden door `.parts-strip-sep`. ≥1024px verticaal (96px) links van het canvas (grid in `.workspace-frame`), daaronder horizontaal onderin; scrollt in beide richtingen. `.parts-dropdown` is `display:none`; DOM en `#builtin-palette` staan nog. Coach (`partButton`) wijst altijd de strook aan (valt terug op de eigen chip met dezelfde naam en op de strook zelf) en scrollt de knop in beeld. Teksten die "Parts" noemen verwijzen nu naar de onderdelenstrook (coach, buildInstruction, emptyState, help, onboarding, tutorial; NL en EN). `placePart` en de lokale kopieën in e2e klikken `#parts-strip [data-strip-part]`.
- H.2 `.workspace-heading` verborgen (DOM blijft), `.workspace-header` alleen zichtbaar met `has-sim` (gezet in `updateWorkspaceChrome`, naast `sim-controls.hidden`). Naam van het actieve werkblad staat in de app-balk naast de tabs (`#appbar-sheet`, alleen in Vrij bouwen).
- H.3 `setStatus` zet tekst en `is-visible`, na 4 s gaat de class eraf (opacity-fade); geen standaardtekst bij laden (`data-i18n` van `#status-line` weg); `#connection-status` krijgt `is-visible` alleen bij `state.pendingConnection`. Onzichtbare regels nemen geen ruimte in (position absolute), dus `.canvas-status` is in rust 0px hoog. De melding "nieuwe versie beschikbaar" (main.js) zet ook `is-visible` en blijft staan.
- H.4 In een les is `#inspector-card` alleen zichtbaar voor typen buiten gate, switch, lamp, input-pin, output-pin, chip-instance; Vrij bouwen ongewijzigd. E2E: Not16-les, NAND geplaatst (geen kaart), splitter geplaatst (kaart zichtbaar).

**Aannames/afwijkingen:**
- H.1: de strook staat op breed náást het canvas (grid-kolom), niet erover. Daardoor overlapt hij de schakeling nooit en rekenen `fitToContent`/plaatsing automatisch met de kleinere canvasbreedte. `getReservedStageRects` telt `#parts-strip` wel mee, maar alleen als hij het canvas daadwerkelijk overlapt (nu nooit).
- H.1: een kleine hover-fix (`.parts-strip-button:hover .parts-strip-symbol { color: inherit }`, symbool verdween op de blauwe hover) zit in de H.4-commit.
- H.1: lestekst in `src/data/challenges.js` en `src/data/locales/` ("Open Parts en plaats de AND-poort", "uit de Parts-balk") mocht niet worden aangepast en verwijst dus nog naar "Parts".
- H.0 e): voor een al voltooide les opent "Opnieuw beginnen" bij Intro; na "Aan de slag" valt de les terug op quiz/Verder omdat de les nog als voltooid telt (opgeslagen voortgang wordt niet gewist).
- Coach-welkomballon over het DOOR-blok op 1440×900 (open punt fase F): niet aangepast; de ballon ligt in stap 3 (AND plaatsen) nu onder de AND-knop in de strook en bedekt dan tijdelijk de onderkant van DOOR.
- Sleutel `statusDefault` (nl/en) is ongebruikt maar niet verwijderd.

**Bevindingen (niet opgepakt):**
- Lessen noemen in hints nog "Parts" (zie hierboven, buiten scope door harde grens).
- `emptyState` in NL toont letterlijk backticks rond `Input` en `Output` (bestond al).
- Op een telefoon (390px) wordt de werkbladnaam in de app-balk afgekapt ("Main…").
- Labels in de strook zijn Engels (Switch, Lamp, Bus Split, Clock): fase J.3.
- De strook is op tablet staand 48px hoog en laat op 820×1180 het onderpaneel en de canvasknoppen vrij.
- Brede 16-bit invoer en 62%-zoom in de ALU-les (uit fase F) ongewijzigd.

**Resultaat:** groen, `npm test` 169/169, `npm run check` OK (52 bestanden), e2e 26/26 (24 bestaande + 2 nieuwe: quiz overslaan in H.0, Inspector in les in H.4). Schermafdrukken op 1440×900, 1180×820, 820×1180 (touch) van start, les 0 (intro, bouw, bedraad, live ok, quiz met "Sla over", overgeslagen, heropend), een sequentiële les (Build Bit), Vrij bouwen en Not16 met de Inspector; dark op alle drie, light en neon op desktop/tablet steekproefsgewijs. Coach van les 0 volledig doorlopen op 1440×900 en 820×1180.

---

## 2026-11-11 — Kleurstelling: Grafiet & amber (donker) en Papier & inkt (licht)

**Besluit eigenaar:** uit vijf opties gekozen voor A (donker) en E (licht). Neon blijft zoals het was.

**Uitgevoerd:**
- `styles.css`: themablokken `dark` en `light` herschreven. Eén vlakke paneelkleur (geen verlopen, geen bruine les- en werkbladkaarten), alle onderdelen één neutrale kleur; toestand is alleen nog signaalkleur. Donker: stroom = amber `#f5b942`, hoofdknop gebroken wit. Licht: stroom = petrol `#0b7a75`, hoofdknop zwart.
- Twee nieuwe variabelen in alle drie de thema's: `--accent-ink` (tekst op de accentkleur; verving hardcoded wit) en `--ok` ("klopt"/afgerond; losgekoppeld van `--signal-high`, dat nu alleen op het canvas wordt gebruikt).
- `index.html` en `manifest.webmanifest`: `theme-color`/`background_color` naar `#141518`. Themaknoppen in ⚙ tonen de nieuwe kleuren.

**Gevolg voor fase J:** J.2 taak 1 (bruine tint weg) en taak 4 (één accent, groen alleen voor "klopt") zijn hiermee gedaan voor donker en licht. Rest van J.2 (geneste kaders, app-balk) en J.1/J.3 staan nog open.

**Resultaat:** groen, `npm test` 169/169, `npm run check` OK, e2e 26/26. Schermafdrukken bekeken: donker en licht op 1440×900 en 820×1180 (start, intro, gebouwd, quiz, Vrij bouwen), neon op 1440×900 (ongewijzigd).

---

## 2026-11-11 — UX fase I: startscherm als pad

**Uitgevoerd** (één commit per stap):
- I.1 Hero is één kaart (`.course-hero`, 720px): eyebrow ("1. Poorten · Les 5 van 19", nieuwe sleutel `homeHeroEyebrow`), lestitel als `h2`, beschrijving van de les, totaalbalk met "5 van 41 lessen" (`homeTotalProgress`; aantal uit `getOrderedLessonIds(CURRICULUM)`, niet hardcoded) en precies één `.primary-button` (`data-course-continue`). Nieuwe gebruiker: zelfde kaart met welkomsttitel/-lead; de lestitel staat alleen in de knop ("Start: Licht aan"), geen tweede titel. Alles voltooid: titel `courseEmptyDone`, knop uitgeschakeld.
- I.2 `.course-modules` is één kolom (max 720px, gecentreerd). Per module één `article.course-module-card[data-course-module]` met `details.course-lessons[data-course-module-lessons]` en `summary.course-module-row`: nummer, naam, ★ (bij badge, kleur `--ok`), "x/y" en een dunne balk (`renderProgressBar`, 4px, `--accent`; bij voltooide module `--ok`). De module met de volgende les staat open; de volgende les heeft `next` en een "→". Vergrendelde module: één gedimde rij met 🔒, zonder tekst "Vergrendeld" en zonder lessenlijst. `renderProgressRing`, alle ring-CSS, `.course-module-start`, de beschrijving/meta per module en `max-height` van de lessenlijst zijn weg. De modulebeschrijving staat als `title` op de rij. Kaarten gebruiken nu `--panel` (de oude `--panel-bg` bestond niet, waardoor de kaarten in licht donker waren).
- I.3 Het vinkje staat in ⚙ onder "Begeleiding" (`index.html`, `data-toggle-free-mode`, `data-i18n="freeMode"`). Eén handler: `handleFreeModeChange` (hernoemd uit `handleCourseChange`, `src/ui/course.js`), gebonden aan `#settings-menu` in `script.js`. De dode tweede handler (`handleChallengeListChange` + binding in `boot.js` + de `label.challenge-free-mode`-uitzondering in `handleChallengeListClick`) is verwijderd, evenals de CSS van `.challenge-free-mode` en `.course-free-mode`. `updateViewChrome` zet het vinkje bij elke render (`state.project.learner.unlockedAll`). Kaart "Vrij bouwen": vergrendeld = één gedimde regel met 🔒 en uitlegtekst zonder knop; ontgrendeld = gewone kaart met "Open werkbank" (ononderbroken rand, geen stippellijn meer). `enableFreeMode` in `e2e/helpers.js` opent `#settings-menu`, zet het vinkje en sluit het menu weer. Nieuwe e2e-test: vinkje alleen in ⚙, menu blijft open na klikken, modules ontgrendelen en vergrendelen weer.
- Extra, nodig voor de acceptatie: `.app[data-view="home"]` kreeg `grid-template-rows: auto 1fr` (was `auto auto`). Met `min-height: 100vh` kreeg de app-balk anders het overschot en werd 85px hoog zodra het startscherm korter dan het venster was.

**Aannames/afwijkingen:**
- e2e `smoke-check`: de test "vrije modus unlockt lessen" controleerde dat de les `computer` `disabled` is. Vergrendelde modules hebben nu geen lessenlijst, dus toetst hij dat de lesrij ontbreekt en dat `[data-course-module="computer"]` class `locked` heeft (zelfde bedoeling: de les is niet te starten).
- Nieuwe gebruiker: de knop heet "Start: Licht aan"; een aparte lestitel is er niet.
- Het nummer in de moduleregel komt uit de titel (`"1. Poorten"` wordt `1` + `Poorten`) via een regex in `course.js`; i18n-sleutels `curriculum.*.title` zijn ongewijzigd.
- Ongebruikt maar niet verwijderd: i18n-sleutels `homeTitle`, `homeLead`, `homeShowLessons` en `courseLessonsCount`.
- Het ⚙-menu sluit niet bij een klik binnenin (bestaande document-handler sluit alleen bij klik buiten of op een knop in `.settings-actions`), dus aan/uit zetten werkt met muis en tap (gecontroleerd op 1440 en 820 touch, ook via het label; de stand blijft na herladen).

**Bevindingen (niet opgepakt):**
- Open module met veel lessen (Poorten: 19) maakt het startscherm lang; scrollen is nodig vanaf "na les 0". Eventueel alleen de volgende ±5 lessen tonen of andere modules inklappen.
- Hero-beschrijvingen komen uit `src/data/locales/` en zijn deels Engels ("Build XOR"-titels, fase J.3).
- De vergrendelde-lesrij "🔒" gebruikt de emoji in amberkleur (emoji-render); niet gestileerd.
- Verse gebruiker op 1180×820, 390×844 en 820×1180 scrolt nog (1180×820: 15px, 390×844: 49px, 820×1180: geen); alleen 1440×900 was de acceptatie.
- Statuslijn (`#status-line`) is leeg bij wisselen, de melding van vrije modus is dus alleen kort als toast te zien.

**Resultaat:** groen, `npm test` 169/169, `npm run check` OK (52 bestanden), e2e 27/27 (26 bestaande + 1 nieuwe). Schermafdrukken (`/home/claude/shots/i3-*`) op 1440×900, 1180×820, 820×1180 (touch), 390×844 (touch) in vier toestanden (nieuw, na les 0, halverwege module 1, vrije modus) in donker en licht; neon steekproef op 1440×900 en 390×844. Verse gebruiker op 1440×900: kaart, alle moduleregels en Vrij bouwen zonder scrollen (documentscroll 0).


---

## 2026-11-13 — UX fase J: stijl en taal

**Uitgevoerd** (één commit per stap):
- J.1 Tokens `--fs-xs/sm/md/lg/xl` (0.75/0.875/1/1.25/1.75rem), `--radius` 12px, `--radius-sm` 8px, `--radius-pill` 999px in het `:root`-blok; `--font-display`/`--font-body` = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Elke `font-size` buiten de canvas-selectors staat op de schaal; `grep -o "font-size: [^;]*" styles.css | sort -u | wc -l` = 14 (was 40). Radii (8/10/12/14/999px) verwijzen naar de tokens. Hoofdletter-eyebrows alleen nog op `.course-hero .eyebrow` (start) en `.lesson-goal-label` (les); `letter-spacing` bij de rest weg. Geen kleurwaarden in de themablokken gewijzigd.
- J.2 `.appbar` zonder kader (alleen `border-bottom`, geen schaduw/radius/achtergrond). `.lesson-panel .challenge-detail-card` (ook `.done`) zonder rand, achtergrond en padding; de afgeronde les blijft zichtbaar via de ✓ (`.challenge-verified`) naast de titel. Sandbox-paneel: `.workspace-card`, `.chip-card` en `.chip-series-card` zonder rand en achtergrond; actief werkblad en geopende chipserie op `--accent-soft`.
- J.3 `partLabel.<type>` (17 typen, NL en EN) en `partLabel(type)` in `panels.js` voor strook, locked-lijst en "Nieuw in je onderdelen"; nieuwe `displayNodeLabel(node, title)` (`canvas.js`) vertaalt alleen de weergave van een standaardlabel op een onderdeel (exacte Engelse standaard: Switch, Lamp, Input, Output, Clock, Register, Screen, Keyboard, Split/Bus Split, Join/Bus Join); `config.label`, `BUILTIN_PARTS` en data blijven Engels (labels dienen als data voor coach, tutorial, `CLK`-detectie, I/O-matching). Ook gebruikt in Eigenschappen-titel, inspector-chip en de toast "… toegevoegd aan …". Nodespec-subtitels gebruiken `partLabel`; Screen/Keyboard-subtitel via `nodeSubtitle.*`. Tabel uit de roadmap doorgevoerd (parts, sheets, sheetsAndChips, snapshot, inspector, checks, workspaceOpen/Duplicate/Delete, toggleClocks, stepRegisters, play, resetState, connectionHint; `buildInstruction` bestond al goed en bleef staan). `connectionHint` ook in EN aangepast. `emptyState` NL zonder backticks. Verder in `nl.js` de zichtbare Engelse restanten vervangen (werkblad i.p.v. sheet/workspace, onderdeel i.p.v. node, Eigenschappen-velden, "Concept voor", "{n} onderdelen • {m} draden", statusmeldingen, tutorialtekst) en theme-/zoom-/undo-aria's vertaalbaar (`themeDark/Light/Neon`, `zoomOutAria`, `zoomInAria`). Lestitels NL: 39 titels "Build X" → "Bouw X" (alleen `title`). Verwijzingen naar Parts vervangen door "de onderdelenstrook" / "the parts strip". Gewijzigde les-id's voor die tekstwijziging (NL én EN): `intro-light` (hint 1) en `nand` (laatste theorieparagraaf); titelwijziging: alle 39 NL-lessen met titel "Build …" (alle lessen behalve `intro-light` en `computer`).
- J.4 (a) `.link-button` en `.lesson-theory > summary` onderstreept (`text-underline-offset: 3px`). (b) Verwijderd in nl+en: `homeTitle`, `homeLead`, `homeShowLessons`, `courseLessonsCount`, `statusDefault`. `currentSheet` blijft: `index.html` (verborgen `.workspace-heading`) gebruikt hem. (c) 16-bit pins: nieuwe klasse `.node-bits` (monospace, `overflow-wrap: anywhere`) en `.node-wide` (216px, op touch 236px) voor switch/lamp/input-pin/output-pin met breedte > 1. Roadmap: J.4 toegevoegd.
- Statusmarkering: "✅ gedaan 2026-11-13" bij FASE J, "uitgevoerd 2026-11-13" bij RONDE 2.

**Aannames/afwijkingen:**
- `scripts/extract-challenge-locales.js` schrijft `challenges-nl.js` uit `CHALLENGES` (Engelse titels). Het bestand is sindsdien met de hand vertaald en onderhouden; ik heb dus het bestand zelf aangepast en het script niet gedraaid (het zou de vertaling overschrijven). Ontgrendeling leunt niet op de vertaalde titel: `localizedRequiredTitle` zoekt eerst op id en dan op de basistitel in `CHALLENGES`.
- J.1: canvas-selectors (`.node*`, `.pin*`, `.gate*`, `.wire*`, `.register-readout`) bleven op hun eigen waarden, op `0.72`/`0.74rem` (→ `--fs-xs`) en `0.66rem` (→ `0.7rem`) na om het totaal op 14 te krijgen. `0.4rem`, `0.5rem` (desktop `.pin-value`, `.register-readout`) staan er nog; die vielen buiten de opdracht.
- J.3: de strook kreeg 104px (was 96px) en `.parts-strip-label` mag afbreken tussen woorden (was ellipsis) zodat "Bus samenvoegen" en "Schakelaar" volledig zichtbaar zijn (J.1-acceptatie).
- J.4 (b): `scripts/verify.js` testte `t("courseLessonsCount", {n: 5})`; de test toetst nu dezelfde interpolatie met `homeTotalProgress` (EN: "5 of 41 lessons").
- J.4 (c): gekozen voor "node breder" (de kleinste ingreep die hier werkt). Eerst geprobeerd: waarde op een eigen regel met wrapping; dat gaf op 820×1180 overlap tussen de gestapelde 16-bit ingangen in `mux4way16` en `mux8way16` (nodes werden hoger). Met de bredere node staan waarde en knop weer op één regel. Gecontroleerd met een script dat alle 41 lessen opent op 1440×900 en 820×1180 (touch): geen overlap tussen nodes, waarde binnen het onderdeel.
- Roadmap-regel "Elke kleurwijziging in alle drie de thema's": er is niets aan kleuren gewijzigd.

**Bevindingen (niet opgepakt):**
- `Main Workspace` (standaardnaam van het eerste werkblad) en starter-chipnamen (Full Adder, Half Adder) zijn data en blijven Engels in NL. Idem labels van onderdelen die de gebruiker zelf een naam gaf.
- Chip-meta "3 in • 2 out • v1" (strook-title, chiplijst) is hardcoded in `panels.js`; "in/out" is half vakterm, niet vertaald.
- `tipWireColors` (NL en EN) beschrijft nog groen/rood; sinds fase F is uit grijs en aan gekleurd.
- De werkbladkaart toont "0 onderdelen • 0 draden" op twee regels (smalle kolom naast de knop Openen).
- De hero-eyebrow op het startscherm en "DOEL"-label in de les zijn de enige hoofdletterteksten; `.palette-section-title` e.d. zijn kleine gewone tekst geworden.
- Telefoon 390px: werkbladnaam in de app-balk nog afgekapt (uit fase H); de strook staat nog op 48px hoog bij tablet staand.
- Hardcoded Engelse tekst in `tutorial.js`/coach niet gescand buiten de schermen hieronder; in NL bevatten de lesbeschrijvingen nog vaktermen als "play", "pins", "CLK-tick".
- Zoom 78% in de ALU-les (fase F) ongewijzigd; de bredere 16-bit nodes (216px) maken `fitToContent` iets krapper.

**Taalscan:** NL (start, les 0 intro/bouw, dff, alu, ram8, computer, Vrij bouwen met alle onderdelen geplaatst, ⚙-menu, hulp): geen Engels meer behalve vaktermen en data (zie bevindingen). EN (zelfde schermen): geen Nederlands gevonden (tekstdump + zoektermen).

**Resultaat:** groen, `npm test` 169/169, `npm run check` OK (52 bestanden), e2e 27/27 (geen nieuwe tests). Schermafdrukken in `/home/claude/shots/` (`j1-*` t/m `j4-*`, `jf-*` eindset).
