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
