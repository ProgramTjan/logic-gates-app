# NEXT_STEPS — Forge Logic Refactor

**Huidige staat (2026-03-25)**
Tasks 1-3 officieel compleet. Modules voor Tasks 4-7 zijn al gecreëerd en geïmporteerd in script.js. script.js is nog 1846 regels. Geen testharness. Geen cleanup.

---

## ~~Stap 1: Sync de roadmap met werkelijke staat~~ ✅ gedaan 2026-03-25

## ~~Stap 2: Extracteer simulatie-engine → src/sim/evaluate.js~~ ✅ gedaan 2026-03-25

## ~~Stap 3: Extracteer node-model → src/model/nodes.js + src/model/chips.js~~ ✅ gedaan 2026-03-25

## ~~Stap 4: Voeg test harness toe voor pure modules (Task 8)~~ ✅ gedaan 2026-03-25

## Stap 1: Sync de roadmap met werkelijke staat

**Bestand:** `docs/refactor-roadmap.md`

- Update de progress marker: tasks 4-7 UI-modules zijn gecreëerd (canvas, events, inspector, workspace-actions, verification, chip-definitions)
- Inventariseer per module: is script.js nog de owner van die logica, of delegeert het correct?
- Noteer wat er letterlijk nog in script.js zit dat geëxtraheerd moet worden:
  - `evaluateCircuit` / `evaluateWorkspace` / `collectRegisterUpdates` (simulatie-engine)
  - `createNode` / `normalizeNode` / `createChipInstance` (node-model)
  - `render()` orchestratie en alle sub-renders (panels, chip library, challenges)
  - Event-registratie en toolbar-binding
- Verification baseline: `node --check` op alle src/-modules

**Acceptatiecriteria:**
- Roadmap klopt met de werkelijke bestandsstructuur
- Lijst van resterende extracties is concreet en afgebakend

---

## Stap 2: Extracteer simulatie-engine → src/sim/evaluate.js

**Bestanden:** `src/sim/evaluate.js` (nieuw), `script.js` (aanpassing)

- Verplaats `evaluateCircuit(snapshot, externalInputs, path, visited)` naar `src/sim/evaluate.js`
- Verplaats `evaluateWorkspace(workspace)` als wrapperexport
- Verplaats `collectRegisterUpdates(snapshot, externalInputs, path, visited)` mee
- Pas script.js aan: importeer uit `src/sim/evaluate.js`, verwijder inline-definities
- Pas `src/challenges/verification.js` deps-contract aan: `deps.evaluateCircuit` en `deps.collectRegisterUpdates` moeten nu uit het nieuwe module komen
- Smoke-check: app boot, challenge submit, wires renderen correct

**Acceptatiecriteria:**
1. `node --check src/sim/evaluate.js` slaagt
2. Werkruimte-evaluatie drijft wires, outputs en register-gedrag correct aan
3. Challenge submit geeft dezelfde verified/needs-work uitkomst als voor de extractie
4. Simulatielogica bevat geen directe DOM-queries

---

## Stap 3: Extracteer node-model → src/model/nodes.js + src/model/chips.js

**Bestanden:** `src/model/nodes.js` (nieuw), `src/model/chips.js` (nieuw), `script.js`

- Verplaats `createNode(project, type, position)` naar `src/model/nodes.js`
- Verplaats `normalizeNode(node)` naar `src/model/nodes.js`
- Verplaats `createChipInstance(project, definitionId, position)` naar `src/model/chips.js`
- Verplaats `createWorkspace(project, name, id, meta)` naar `src/model/chips.js` of een aparte `src/model/workspace.js`
- Update alle deps-injectie in chipDefinitionsService, canvasRenderers, etc.
- Smoke-check: parts toevoegen, chip-instance plaatsen, chip snapshot opslaan

**Acceptatiecriteria:**
1. Built-in parts en chip-instances toevoegen werkt
2. Chip snapshotting en starter chip loading werken
3. script.js bezit geen object-constructie-details meer voor nodes en chips

---

## Stap 4: Voeg test harness toe voor pure modules (Task 8)

**Bestand:** `scripts/verify.js` (nieuw)

- Schrijf een Node.js-script dat zonder browser draait:
  - Import `src/sim/bits.js`: test parseBits, formatBits, bitwiseBinary op fixtures
  - Import `src/sim/evaluate.js`: test evaluateCircuit op een minimal AND-circuit fixture
  - Import `src/challenges/verification.js`: test runCombinationalChallengeVerification op een NAND-definitie fixture
- Voeg een één-commando runner toe: `node scripts/verify.js`
- Documenteer het commando in `docs/refactor-roadmap.md`

**Acceptatiecriteria:**
1. `node scripts/verify.js` draait zonder browser en rapporteert pass/fail
2. Minimaal: bits-helpers, circuit-evaluatie, en challenge-verificatie hebben elk één fixture-test
3. Het commando staat gedocumenteerd in de roadmap

---

## Stap 5: Render-orchestratie en event-registratie uit script.js halen

**Bestanden:** `src/ui/render.js` (nieuw), `script.js`

- Verplaats de hoofd-`render()` functie en alle sub-render calls naar `src/ui/render.js`
- Verplaats event-registratie (addEventListener calls voor toolbar, canvas, inspector) naar een `src/ui/boot.js` of `src/main.js` uitbreiding
- script.js wordt nu een dunne bootstrap die modules instantieert en wired

**Acceptatiecriteria:**
1. Render-output blijft visueel equivalent voor workspace, inspector, chips en challenges
2. Drag, connect, zoom, submit en quick delete werken nog steeds
3. script.js is materieel kleiner dan 1846 regels

---

## Stap 6: Dead code cleanup (Task 9)

**Bestanden:** `script.js`, alle src/-modules

- Verwijder alle inline duplicaten die in eerdere stappen zijn geëxtraheerd
- Verwijder tijdelijke compatibility-wrappers
- Controleer imports: geen ongebruikte imports, geen circulaire deps
- Voer `node --check` uit op alle JS-bestanden
- Voer de volledige smoke-checklist uit: boot, part toevoegen, verbinden, chip snapshot, challenge start/submit, drag, zoom, quick delete

**Acceptatiecriteria:**
1. Geen dood gedupliceerde implementatie meer in script.js
2. Imports zijn stabiel en leesbaar
3. App passeert syntax checks en de volledige smoke-checklist

---

## Smoke-checklist (na elke stap uitvoeren)

- [ ] App boot: pagina laadt, workspace zichtbaar
- [ ] Part toevoegen via Parts-menu
- [ ] Twee nodes verbinden via pinnen
- [ ] Chip snapshot opslaan
- [ ] Challenge starten en indienen
- [ ] Node drag
- [ ] Zoom in/out/reset
- [ ] Quick delete (long press)
- [ ] Undo/Redo
- [ ] Import/Export JSON
