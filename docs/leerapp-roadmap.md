# Leerapp-roadmap — Van NAND tot werkende computer

**Doel:** Forge Logic ombouwen van een challenge-sandbox naar een volwaardige leerapp waarin een leerling stap voor stap — beginnend bij losse logic gates — een gesimuleerde werkende computer bouwt (Nand2Tetris hoofdstuk 1–5).

**Voor wie is dit document:** een coding-LLM die zelfstandig stappen uitvoert. Elke stap is self-contained: context, bestanden, taken, acceptatiecriteria en verificatie. Voer stappen in volgorde uit; elke stap laat de app werkend achter.

---

## Huidige staat (referentie, gecontroleerd 2026-08-03)

- **Stack:** statische ES-modules app, geen bundler. Entry: `index.html` → `src/main.js` → `script.js` (bootstrap, ~570 regels wiring).
- **Modules:** `src/sim/` (bits, evaluate, hack-alu), `src/model/` (nodes, chips, nodespec), `src/state/project.js` (localStorage), `src/challenges/verification.js`, `src/actions/*` (undo, mutations, clipboard, io, keyboard), `src/ui/*` (canvas, panels, render, events, app-modal, boot).
- **Challenges:** 24 stuks in `src/data/challenges.js`, fases "Project 1" t/m "Project 5" (nand → cpu). Verificatietypes: `combinational`, `sequential-register`, `sequential-counter`, `sequential-script`.
- **Builtin parts** (`src/data/builtinParts.js`): switch, lamp, NOT/AND/OR/XOR/NAND/NOR gates (1–16 bit), splitter, joiner, input-pin, output-pin, clock, register.
- **Starter chips:** NAND, Half Adder, Full Adder (in `src/chips/definitions.js`).
- **Wat al werkt:** chips snapshotten en hergebruiken, challenge submit met per-test feedback, truth-probe tabel, theorie + hints per challenge, voortgangsbalk (x/24), undo/redo, copy/paste, share-links, 3 thema's.
- **Tests:** `npm test` → `scripts/verify.js` (28 fixtures). `npm run check` → syntax-check.
- **Belangrijkste gaten voor een leerapp:**
  1. Geen leerpad: alle challenges staan open, geen volgorde of unlock-logica.
  2. Geen les-structuur: theorie hangt aan challenges, er is geen "eerst begrijpen, dan bouwen"-flow.
  3. Curriculum incompleet: 16-bit varianten (Not16/And16/Mux16/Or8Way/Mux8Way16/DMux8Way), DFF-verhaal, Screen/Keyboard/ROM en het eindproject "Computer" ontbreken.
  4. Geen doorlopende klok: alleen handmatig "Toggle Clocks" + "Step Registers"; een draaiende computer vereist een play/pauze-runner.
  5. Geen ROM/Screen/Keyboard-nodes: zonder programma-geheugen en output kan er geen computer "draaien".
  6. Performance-risico: de recursieve evaluator herberekent per tick alles; CPU+RAM16K wordt traag.
  7. Geen guided onboarding per les; de bestaande onboarding is één statische overlay.

---

## FASE 1 — Leerpad-fundament

### Stap 1.1: Curriculum-datamodel + unlock-gating

**Doel:** challenges worden lessen in een vaste leerroute; een les is pas beschikbaar als de vorige is afgerond.

**Bestanden:** `src/data/curriculum.js` (nieuw), `src/data/challenges.js`, `src/ui/panels.js`, `src/state/project.js`.

**Taken:**
1. Maak `src/data/curriculum.js` met een `CURRICULUM`-export: een geordende lijst modules (`id`, `title`, `description`, `lessonIds`), waarbij `lessonIds` verwijzen naar bestaande challenge-ids. Gebruik de bestaande fase-indeling als modules: "1. Poorten", "2. Rekenen", "3. Geheugen", "4. ALU", "5. Computer-architectuur".
2. Voeg per challenge een `prerequisites`-veld toe (array van challenge-ids). Default: de vorige les in dezelfde module; eerste les van een module vereist de laatste les van de vorige module.
3. Voeg in `src/state/project.js` een genormaliseerd `project.learner`-veld toe: `{ completedChallengeIds: string[], unlockedAll: boolean }`. `unlockedAll` is een instelling om gating uit te zetten (vrije modus).
4. Bij een geslaagde submit (`src/actions/workspace-mutations.js` → `submitChallenge`): voeg challenge-id toe aan `completedChallengeIds`.
5. In `src/ui/panels.js` → `renderChallenges`: toon vergrendelde lessen met slotje + "Vereist: <titel vorige les>"; klikken selecteert wel (theorie leesbaar) maar Start/Submit disabled tenzij unlocked of `unlockedAll`.
6. Voeg een toggle "Vrije modus" toe in het challenge-panel die `learner.unlockedAll` omzet.

**Acceptatiecriteria:**
- Nieuwe gebruiker ziet alleen les 1 (nand) als startbaar; les 2 unlockt na verified submit van les 1.
- Bestaande projecten met al-verified chips: bij load worden `completedChallengeIds` éénmalig afgeleid uit `challengeVerifier.evaluateChallengeResult` per challenge (migratie in `normalizeProject`).
- Vrije modus maakt alles startbaar; uitzetten herstelt gating.
- `npm test` en `npm run check` blijven groen; voeg minimaal 2 fixtures toe voor de unlock-afleiding (pure functie, testbaar zonder DOM).

### Stap 1.2: Les-flow — theorie eerst, dan bouwen

**Doel:** elke les krijgt een expliciete flow: (1) theorie lezen, (2) doel begrijpen, (3) bouwen, (4) submitten.

**Bestanden:** `src/data/challenges.js`, `src/ui/panels.js`, `styles.css`.

**Taken:**
1. Breid het challenge-schema uit met `learning`: `{ goal: string, concepts: string[], quiz?: { question, options: string[], answerIndex }[] }`. Vul `goal` en `concepts` voor alle 24 lessen (1–2 zinnen per goal; concepts zijn trefwoorden zoals "universele poort", "carry"). Quiz is optioneel; vul minimaal voor de eerste 6 lessen 1–2 meerkeuzevragen.
2. In het challenge-detailpaneel: toon de theorie standaard **open** (nu een dichtgeklapte `<details>`) zolang de les niet voltooid is; toon `goal` prominent boven de knoppen.
3. Render de quiz (indien aanwezig) onder de theorie: antwoord kiezen → direct goed/fout-feedback + korte uitleg. Quizresultaat opslaan in `project.learner.quizAnswers[challengeId]`. Quiz is niet blokkerend voor Start.
4. Style: onderscheid "theorie"-blok (leesmodus) visueel van "bouw"-blok (actieknoppen).

**Acceptatiecriteria:**
- Elke les toont goal + open theorie vóór de eerste voltooiing; na voltooiing klapt theorie standaard dicht.
- Quizvragen werken en onthouden het gegeven antwoord na herladen.
- Geen regressie in bestaande submit-flow.

### Stap 1.3: Guided walkthrough voor les 1

**Doel:** de allereerste les (NAND) begeleidt de leerling klik-voor-klik.

**Bestanden:** `src/ui/tutorial.js` (nieuw), `src/ui/render.js`, `styles.css`, `script.js`.

**Taken:**
1. Maak `createTutorial(deps)` met een stappenscript voor les 1: (a) "Open Parts en plaats een NAND-gate", (b) "Verbind Input A met de gate" (klik output-pin, dan input-pin), (c) "Verbind de gate met OUT", (d) "Toggle Input A en zie het lampje veranderen", (e) "Klik Submit".
2. Elke stap: een tooltip/coach-mark gepositioneerd bij het relevante DOM-element (CSS absolute overlay, geen library), met "volgende"-detectie op basis van state-veranderingen (bijv. node toegevoegd van type gate-nand, wire toegevoegd, submit gedaan). Poll niet; hook in op de bestaande render-cyclus (roep `tutorial.onStateChanged()` aan in `renderWorkspaceView`).
3. Tutorial start automatisch als: les 1 nog niet voltooid én de challenge-sheet van les 1 wordt geopend. "Overslaan"-knop aanwezig; keuze opslaan in `project.learner.tutorialDismissed`.

**Acceptatiecriteria:**
- Verse gebruiker die les 1 start ziet de walkthrough; elke actie doet de volgende stap verschijnen.
- Overslaan werkt en blijft onthouden.
- Tutorial-code raakt de simulatie-modules niet aan (alleen UI + state-observatie).

---

## FASE 2 — Curriculum compleet maken (Nand2Tetris-dekking)

### Stap 2.1: Ontbrekende combinationele chips (hoofdstuk 1–2)

**Doel:** het leerpad dekt alle chips uit Nand2Tetris Project 1–2.

**Bestanden:** `src/data/challenges.js`, `src/data/curriculum.js`.

**Taken:** voeg challenges toe (met tests, hints, theory, goal — volg het bestaande schema exact):
1. `not16`, `and16`, `or16`, `mux16` — 16-bit varianten (combinational, ~6 tests elk; gebruik bestaande 16-bit teststijl van `add16`).
2. `or8way` — 8-bit input, 1-bit output.
3. `mux4way16`, `mux8way16` — 16-bit databussen met 2/3-bit selector.
4. `dmux8way` — 1 input, 3-bit selector, 8 outputs.
5. Plaats ze in de curriculum-volgorde: 16-bit poorten na `xor-nand-only`, way-chips na `dmux4way`.

**Acceptatiecriteria:**
- Elke nieuwe challenge is met de bestaande builtin parts + eerder gebouwde chips oplosbaar (verifieer mentaal het datapad: splitter/joiner ondersteunen max 16 bit — check `MAX_WIDTH` in `src/sim/bits.js`).
- `npm test` groen; voeg minimaal 1 verify-fixture toe die een nieuwe challenge met een referentie-oplossing verifieert.

### Stap 2.2: DFF-les en geheugen-verdieping (hoofdstuk 3)

**Doel:** het geheugenverhaal klopt didactisch: DFF → Bit → Register → RAM.

**Bestanden:** `src/data/challenges.js`, `src/data/curriculum.js`.

**Taken:**
1. Voeg een `dff`-les toe vóór `register-chip`: theorie over de flip-flop als primitieve (de builtin Register-node ís de DFF-primitieve van deze app — leg dat expliciet uit), met een kleine sequentiële opdracht (bouw een 1-bit Bit-chip met load-gedrag: `IN`, `LOAD`, `CLK` → `OUT`; alleen bij LOAD=1 en tick neemt hij over). Verificatie: `sequential-script`.
2. Voeg een `register16`-les toe (16-bit register met LOAD) tussen `register-chip` en `ram8`.
3. Herschrijf de theorie van `ram8` zodat hij verwijst naar de nieuwe voorgaande lessen.

**Acceptatiecriteria:**
- Leerroute geheugen: dff → register-chip → register16 → pc → ram8 → ram64 → … → ram16k.
- Sequentiële scripts geverifieerd met een referentie-oplossing in een verify-fixture.

### Stap 2.3: Instructie-decoder en CPU-verdieping (hoofdstuk 4–5)

**Doel:** de sprong van ALU naar CPU wordt behapbaar via tussenstappen.

**Bestanden:** `src/data/challenges.js`, `src/data/curriculum.js`, `src/sim/hack-alu.js` (alleen lezen als referentie).

**Taken:**
1. Les `instruction-decoder`: combinational chip die een 16-bit HACK-instructie splitst in stuurbits (`isA` (msb=0), `comp`-bits, `dest`-bits, `jump`-bits). Tests met 6–8 representatieve instructies (@21, D=A, D=D+M, 0;JMP, etc.).
2. Les `alu-with-registers`: mini-datapad — A-register, D-register, ALU; sequential-script die 2–3 instructies simuleert.
3. Breid de bestaande `cpu`-challenge uit met C-instructie tests: minimaal `D=A` gevolgd door `D=D+A`, en één jump (`0;JMP` naar adres uit A). Gebruik `computeHackAlu` als referentie om verwachte outputs te berekenen (script in `challenges.js` mag helpers gebruiken, zie bestaande `aluTestRow`).

**Acceptatiecriteria:**
- CPU-les faalt op een implementatie die alleen pc-increment doet (de huidige tests zijn te zwak — de nieuwe tests moeten een echte datapath vereisen).
- Verify-fixture met een referentie-CPU is niet vereist (te groot), maar de scriptverwachtingen moeten met `computeHackAlu` afgeleid zijn, niet met de hand.

---

## FASE 3 — De computer laten draaien

### Stap 3.1: Klok-runner (play/pauze/snelheid)

**Doel:** doorlopende simulatie i.p.v. handmatig klikken.

**Bestanden:** `src/actions/runtime.js`, `src/ui/boot.js`, `index.html`, `script.js`, `styles.css`.

**Taken:**
1. Voeg aan `runtime.js` een `clockRunner` toe: `start(hz)`, `stop()`, `isRunning()`. Eén tick = clocks togglen naar 1 → registers stappen → clocks naar 0 → registers stappen (of volg de bestaande semantiek van `stepRegisters` — controleer hoe `collectRegisterUpdates` CLK interpreteert en houd één consistente tick-definitie aan; documenteer die in een comment).
2. Gebruik `setInterval` met instelbare snelheid: 1 Hz, 4 Hz, 16 Hz, "max" (requestAnimationFrame, één tick per frame).
3. Tijdens het draaien: alleen `renderWorkspaceView` aanroepen (geen panel-rerenders), en de debounced save niet per tick laten vuren (save pas bij stop).
4. Toolbar-UI: ▶/⏸-knop + snelheidskeuze naast "Step Registers". Runner stopt automatisch bij workspace-wissel of import.

**Acceptatiecriteria:**
- Mod4-teller workspace: play op 4 Hz laat OUT zichtbaar 00→01→10→11→00 lopen.
- CPU-sheet met pc-increment: pc telt zichtbaar op.
- Geen localStorage-write per tick (controleer met devtools of via code-review van de save-paden).

### Stap 3.2: ROM-node (programmageheugen)

**Doel:** een chip kan instructies uit een programma lezen.

**Bestanden:** `src/data/builtinParts.js`, `src/model/nodes.js`, `src/model/nodespec.js`, `src/sim/evaluate.js`, `src/ui/inspector.js`, `src/ui/canvas.js`.

**Taken:**
1. Nieuw node-type `rom`: config `{ label, addressWidth (max 8 in UI), program: string[] }` waarbij `program` een array 16-bit bitstrings is. Spec: input `ADDR` (addressWidth bits), output `OUT` (16 bits). Evaluatie: combinationeel `OUT = program[ADDR] ?? "0…0"`.
2. Inspector: textarea waarin het programma regel-per-regel als binaire strings bewerkt kan worden (valideer: alleen 0/1, max 16 tekens, pad links met nullen). Toon regelnummers (= adressen).
3. Normalisatie in `normalizeNode`: program altijd array van genormaliseerde bitstrings.
4. Canvas: toon in de node-face het aantal regels ("ROM · 12 instr").
5. Voeg 2 verify-fixtures toe: ROM met 3 instructies, ADDR=0/1/2 geeft de juiste OUT.

**Acceptatiecriteria:**
- ROM plaatsen, programma invullen, ADDR aansluiten op een switch → OUT verandert mee.
- Bestaat een project zonder rom-nodes, dan verandert er niets aan gedrag (normalisatie-regressietest).

### Stap 3.3: Screen-node en Keyboard-node (memory-mapped I/O, versimpeld)

**Doel:** zichtbare output en input, zodat "de computer werkt" ervaarbaar is.

**Bestanden:** zelfde set als 3.2, plus `styles.css`.

**Taken:**
1. Node-type `screen`: config `{ label, cols: 8, rows: 8 }` (vast 8×8 om het simpel en snel te houden). Inputs: `IN` (16 bit, alleen de laagste 8 bits gebruikt als pixelrij), `ROW` (3 bit), `WRITE` (1 bit), `CLK` (1 bit). Gedrag: sequentieel — bij WRITE=1 en tick wordt rij `ROW` gezet naar de laagste 8 bits van IN. Interne state via hetzelfde mechanisme als registers (`collectRegisterUpdates`-pad; gebruik een state-key per rij of één key met alle rijen).
2. Canvas-rendering: teken het 8×8 raster in de node (div-grid of klein canvas-element), pixels lichten op in de accentkleur. Rendering leest uit `registerStates` net als de Register-node.
3. Node-type `keyboard`: output `OUT` (16 bit) = code van de laatst ingedrukte toets terwijl de node "focus" heeft (klik op de node = luisteren, Esc = loslaten). Alleen op canvas-niveau (geen echte focus-traps); toon de actuele code in de node-face.
4. Documenteer in de nodespec-subtitles wat elke pin doet.

**Acceptatiecriteria:**
- Demo handmatig te bouwen: switches op IN/ROW/WRITE + clock → pixels verschijnen per rij na ticks.
- Keyboard-node toont toetscode en levert die op OUT.
- `npm test`: fixture voor screen-write via `collectRegisterUpdates` (rij schrijven, daarna uitlezen).

### Stap 3.4: Eindproject "Bouw je computer" + demo-programma

**Doel:** de culminatie: ROM + CPU + RAM + Screen in één sheet; een meegeleverd programma draait zichtbaar.

**Bestanden:** `src/data/challenges.js`, `src/data/curriculum.js`, `src/chips/definitions.js` (starter), `src/data/demo-programs.js` (nieuw).

**Taken:**
1. Maak `src/data/demo-programs.js` met minstens één handgeschreven HACK-achtig programma als binaire strings, afgestemd op wat de leerling-CPU aankan (bijv. teller die opeenvolgende rijen op de Screen zet). Documenteer elke instructie met een comment.
2. Nieuwe les `computer` (laatste les): template-workspace met ROM (voorgevuld demo-programma), Screen en aansluitpunten; opdracht: sluit jouw CPU-chip en RAM aan zodat het programma bij play zichtbaar de screen vult. Verificatie: `sequential-script` die na N ticks bepaalde screen-rijen verwacht (leesbaar via de register-state van de screen-node — breid `verification.js` uit met een `expectState`-optie die register-states op key-patroon kan checken).
3. Voltooiingsscherm: als de `computer`-les verified is → overlay "🎉 Je hebt een computer gebouwd — van NAND tot machine" met een samenvatting van het pad (aantal chips, lessen).

**Acceptatiecriteria:**
- Met een referentie-oplossing (mag als starter-chip "Reference CPU" verborgen blijven — NIET in de parts-lijst; alleen voor de verify-fixture) slaagt de `computer`-les.
- Play-knop op de eindsheet laat het demo-programma zichtbaar pixels zetten.
- Voltooiingsoverlay verschijnt precies één keer en is herroepbaar via het challenge-paneel.

---

## FASE 4 — Prestaties en robuustheid (nodig voor Fase 3 op grotere circuits)

### Stap 4.1: Evaluatie-cache per chip-definitie

**Doel:** CPU + RAM-sheets blijven vlot bij de klok-runner.

**Bestanden:** `src/sim/evaluate.js`, `scripts/verify.js`.

**Taken:**
1. Profileer eerst: bouw een verify-fixture die een genest circuit (bijv. 8× RAM8-achtige structuur) 100× evalueert en logt hoe lang het duurt (baseline vastleggen in het AGENT_LOG).
2. Implementeer memoization voor **combinationele** chip-instances: cache key = `definitionId + serialized childInputs`; cache invalideren zodra een definitie muteert (definities zijn snapshots — muteren niet, dus een `Map` per evaluate-run met een globale `WeakMap` per definitie kan). Registers/sequentiële paden NIET cachen.
3. Alternatief indien meting het rechtvaardigt: sla per node een topologische volgorde op per definitie zodat de resolver niet recursief hoeft te zoeken.
4. Meet opnieuw en documenteer de winst.

**Acceptatiecriteria:**
- Alle 28+ bestaande fixtures blijven groen (gedrag identiek).
- Gemeten versnelling gedocumenteerd; klok-runner op 16 Hz haalbaar op een sheet met CPU + RAM64.

### Stap 4.2: E2E-smoke met Playwright

**Doel:** de kritieke leerflow is automatisch getest in een echte browser.

**Bestanden:** `package.json`, `e2e/` (nieuw), `README.md`.

**Taken:**
1. `npm i -D playwright` + `npx playwright install chromium`. Voeg `npm run e2e` toe (start `npx serve` als webServer in de Playwright-config).
2. Eén spec met de happy path: app boot → les 1 starten → NAND-gate plaatsen via Parts → 3 wires verbinden (klik output-pin, klik input-pin — gebruik data-attributen die al in de DOM staan) → Submit → verwacht "Verified" en unlock van les 2.
3. Documenteer in README.

**Acceptatiecriteria:**
- `npm run e2e` slaagt lokaal headless.
- Test faalt aantoonbaar als de submit-flow breekt (bijv. even een handler uitzetten om het te controleren, daarna terugzetten).

---

## FASE 5 — Leerervaring afwerken

### Stap 5.1: Cursusoverzicht als startscherm

**Bestanden:** `index.html`, `src/ui/panels.js` of nieuw `src/ui/course.js`, `styles.css`.

**Taken:**
1. Nieuwe weergave "Cursus": modulekaarten (5 modules) met voortgangsring, beschrijving en "Ga verder"-knop die de eerstvolgende open les start.
2. Toon dit als eerste scherm bij een verse gebruiker (in plaats van een lege workspace); een tab/knop wisselt tussen "Cursus" en "Werkplaats".
3. De bestaande rechterpaneel-challengelijst blijft bestaan als detailnavigatie.

**Acceptatiecriteria:**
- Verse gebruiker: cursusoverzicht → klik "Start" → les 1 met walkthrough.
- Terugkerende gebruiker: "Ga verder" springt naar de eerstvolgende onvoltooide les.

### Stap 5.2: Badges en consistente taal

**Bestanden:** `src/ui/panels.js`, `src/data/curriculum.js`, alle UI-strings.

**Taken:**
1. Badge per voltooide module (opslag in `project.learner.badges`), tonen in het cursusoverzicht.
2. Maak alle UI-teksten consistent Nederlands (knoppen als "Duplicate Workspace", "Snapshot" etc. vertalen); technische chipnamen (NAND, MUX) blijven Engels. Verzamel strings waar praktisch in `src/data/strings.js` — geen volledige i18n-laag, wel één vindplaats.

**Acceptatiecriteria:**
- Geen zichtbare Engels/Nederlands-mix meer in knoppen en meldingen.
- Badges verschijnen bij modulevoltooiing en overleven een reload.

### Stap 5.3: Betere sequentiële feedback

**Bestanden:** `src/challenges/verification.js`, `src/ui/panels.js`.

**Taken:**
1. Laat `sequential-script`-verificatie per stap loggen: `{ step, inputs, expected, actual, ok }` in `result.failedCases` (zelfde vorm als combinational).
2. Toon bij een gefaalde sequentiële submit een stap-tabel in het challenge-detail (welke tick, wat verwacht, wat gekregen).

**Acceptatiecriteria:**
- Een bewust foute register-oplossing toont exact bij welke tick het misgaat.
- Combinationale feedback (bestaand) blijft ongewijzigd.

---

## Uitvoeringsregels voor de uitvoerende LLM

1. **Volgorde:** fases in nummervolgorde; binnen een fase mogen stappen sequentieel. Fase 4.1 mag eerder als de klok-runner (3.1) merkbaar traag is.
2. **Na elke stap:** `npm run check` en `npm test` groen; handmatige smoke: boot, part toevoegen, verbinden, submit les 1, undo, zoom.
3. **Log:** werk `AGENT_LOG.md` bij per stap (wat gedaan, aannames, resultaat) — volg het bestaande format.
4. **Geen bundler introduceren**; de app blijft een statische site (uitzondering: Playwright als devDependency).
5. **Storage-compatibiliteit:** bestaande projecten moeten blijven laden; nieuwe velden altijd via `normalizeProject` met defaults.
6. **Nieuwe pure logica** (curriculum-afleiding, ROM-evaluatie, screen-state) krijgt altijd fixtures in `scripts/verify.js`.
7. **Bij twijfel over de tick-semantiek** van clock/register: lees `src/sim/evaluate.js` → `collectRegisterUpdates` en `src/challenges/verification.js` → `applyDefinitionStep` en houd één definitie aan; documenteer die keuze.
