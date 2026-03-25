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
