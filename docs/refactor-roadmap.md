# Forge Logic Refactor Roadmap

## Progress marker

- Status: Task 4 modules scaffolded; simulation extraction in progress (2026-03-25)
- Completed:
  - browser entrypoint moved to [src/main.js](/root/logic-gates-app/src/main.js)
  - HTML switched to module loading in [index.html](/root/logic-gates-app/index.html)
  - legacy bootstrap in [script.js](/root/logic-gates-app/script.js) now starts through `window.ForgeLogicApp.start()`
  - pure bit helpers moved to [src/sim/bits.js](/root/logic-gates-app/src/sim/bits.js)
  - small pure utilities moved to [src/lib/utils.js](/root/logic-gates-app/src/lib/utils.js)
  - [script.js](/root/logic-gates-app/script.js) now imports extracted helpers instead of defining them inline
  - project loading, saving, creation, and normalization moved to [src/state/project.js](/root/logic-gates-app/src/state/project.js)
  - [script.js](/root/logic-gates-app/script.js) now uses thin local wrappers around the state module so the rest of the app stays stable
  - Task 4-7 UI/logic modules scaffolded: src/challenges/verification.js, src/chips/definitions.js, src/ui/canvas.js, src/ui/events.js, src/ui/inspector.js, src/ui/workspace-actions.js, src/data/builtinParts.js, src/data/challenges.js
  - All src/ modules pass `node --check` (verified 2026-03-25)
- Next recommended step: extract simulation engine (evaluateCircuit, evaluateWorkspace, collectRegisterUpdates, stepRegisters, makeRegisterStateKey, evaluateGate) from script.js into src/sim/evaluate.js
- Resume rule: keep simulation extraction isolated from render or pointer-handler extraction in the same session
- Remaining in script.js (to extract):
  - Lines 1325-1340: `stepRegisters`, `collectRegisterUpdates`
  - Lines 1555-1840: `evaluateWorkspace`, `evaluateCircuit`, `makeRegisterStateKey`, `evaluateGate`
  - Lines 346-460: `createWorkspace`, `createNode`, `createChipInstance`, `normalizeNode`
  - Lines 628-825: `render` and all sub-render functions
- Verification baseline after Tasks 1-3 + scaffold inventory (2026-03-25):
  - module entrypoint loads
  - app boot still succeeds
  - `node --check` passes for all 13 JS source files
  - script.js is 1846 lines

## SECTION 1: SPEC

**One-line purpose**
Preserve the current Forge Logic behavior while refactoring the app into smaller, testable modules that are easier to extend and maintain.

**Users and use cases**
- As a maintainer, I want the codebase split by responsibility so that future features do not require editing one 3,000+ line script.
- As a maintainer, I want the simulation logic separated from the DOM logic so that behavior changes can be tested without the full UI.
- As a maintainer, I want the interaction logic isolated so that drag, connect, zoom, challenge, and delete behavior can evolve without regressions.
- As a future coding agent, I want a phased roadmap with stop criteria so that I can continue the refactor later without rediscovering intent.

**Requirements**
1. The refactor must preserve current user-visible behavior for workspace editing, simulation, chip snapshotting, challenge flow, zoom, and quick delete.
2. The refactor must replace the single monolithic browser script with smaller modules organized by responsibility.
3. The refactor must keep the app runnable as a simple static site. [ASSUMPTION: no bundler is introduced in the first refactor pass.]
4. The refactor must introduce a minimal automated verification layer for critical flows before large structural moves begin.
5. The refactor must make pure logic reusable without direct DOM access.
6. The refactor must keep local storage compatibility or provide a safe migration path. [ASSUMPTION: existing project data in browser storage should remain readable.]
7. The refactor must document the phase sequence, acceptance criteria, and next recommended continuation point inside the repository.

**Edge cases**
- If a module extraction changes runtime order, the app should still boot without missing globals or initialization errors.
- If old local-storage data is missing new fields, normalization should still produce a valid in-memory project.
- If a phase is stopped halfway, the app should remain in a deployable, testable state.
- If a UI feature depends on simulation internals, the refactor should extract the shared contract first instead of duplicating logic.
- If automated tests are still partial, manual smoke checks should remain explicit for each phase.

**Acceptance criteria**
Given the current app behavior
When the refactor phases are executed in order
Then each phase leaves the app runnable and manually verifiable before the next phase starts

Given the codebase after phase 1
When a maintainer opens the repository
Then a written roadmap exists in the repo with phase goals, task order, and continuation guidance

Given the codebase after the modularization phases
When a maintainer needs to change simulation behavior
Then the relevant logic is located outside the UI rendering module

Given the codebase after the modularization phases
When a maintainer needs to change drag or selection behavior
Then the relevant logic is located outside the circuit evaluation module

Given a browser that already contains saved Forge Logic data
When the refactored app loads
Then the saved project still opens successfully [ASSUMPTION: storage schema changes remain backward-compatible during the refactor.]

## SECTION 2: PLAN

**Stack and architecture**
Current stack is a dependency-free static web app with `index.html`, `styles.css`, and one large browser script at [script.js](/root/logic-gates-app/script.js). The refactor should move toward ES modules loaded directly by the browser. [ASSUMPTION: we keep a no-build static workflow instead of introducing a bundler.]

**Data model changes**
- No product-level data model changes are required in the first refactor pass.
- Introduce module boundaries around existing structures:
  - `project` state normalization and persistence
  - `workspace`, `node`, `chip definition`, `chip series`, `runtime register state`
- Preserve the current storage key and normalization path. [ASSUMPTION: storage format remains compatible during phases 1-3.]

**API contracts**
- `state/project` module
  - `loadProject()`
  - `saveProject(project)`
  - `createProject()`
  - `normalizeProject(project)`
- `model/nodes` module
  - `createNode(project, type, position)`
  - `normalizeNode(node)`
  - `getNodeSpec(node)`
- `model/chips` module
  - `createChipInstance(project, definitionId, position)`
  - `extractChipInterface(workspace)`
  - chip definition helpers
- `sim/bits` module
  - bit parsing, formatting, width normalization, boolean conversion
- `sim/evaluate` module
  - `evaluateCircuit(...)`
  - `evaluateWorkspace(...)`
  - register update helpers
- `ui/render` module
  - high-level render entrypoint and DOM rendering helpers
- `ui/interactions` module
  - pointer, keyboard, connect, delete, quick-delete, zoom, and panel actions

**Patterns to follow**
- Preserve the current plain-browser style and incremental rendering approach.
- Move pure helpers first, then stateful business logic, then DOM rendering, then event orchestration.
- Keep one thin app entrypoint that wires state, DOM refs, render, and actions together.
- [ASSUMPTION: following the current “single mutable state + full render trigger” pattern is acceptable for this refactor; state management redesign is deferred until after modularization.]

**Testing strategy**
- Add smoke-level verification before heavy moves:
  - app boot
  - add part
  - connect pins
  - save chip
  - submit challenge
  - quick delete node
- Add unit-level checks for extracted pure logic:
  - bit helpers
  - width normalization
  - challenge verification
  - circuit evaluation on small fixtures
- Keep `node --check` on all JS modules in every phase.
- Keep a short manual browser checklist per phase for drag, zoom, wires, challenge start/submit, and chip snapshot behavior.

**Security and performance constraints**
- No auth or network concerns exist in the current local-first app. [ASSUMPTION: refactor scope remains local-only and does not introduce remote persistence.]
- Module boundaries should reduce accidental regressions but must not materially slow rendering for medium-sized circuits.
- No phase should increase initial boot complexity to the point that the app requires a dev server beyond simple static hosting. [ASSUMPTION: browser-native ES modules are acceptable.]

**Resume point**
- Recommended first execution step: create a `src/` structure and move pure bit/state helpers out of `script.js` while keeping behavior identical.
- Do not move DOM rendering and pointer handlers in the same step as the first module extraction.
- Stop each phase only after:
  - all files pass syntax check
  - the app boots
  - the phase-specific smoke checklist passes

## SECTION 3: TASKS

## Task 1: Create refactor-safe entrypoint

**What to build:** Convert the current app bootstrap into a thin entrypoint and prepare the repo for browser-native module loading without changing behavior.
**Files likely affected:** `index.html`, `script.js` or `src/main.js` (new), `docs/refactor-roadmap.md`
**Acceptance criteria:**
1. The app still boots in the browser with no visible regression in existing behavior
2. The runtime entrypoint is clearly separated from most implementation code
3. `node --check` passes for the updated JavaScript files
**Dependencies:** none

## Task 2: Extract pure bit and utility helpers

**What to build:** Move bit parsing, formatting, width normalization, cloning, and small pure helpers into dedicated modules with no DOM access.
**Files likely affected:** `src/sim/bits.js` (new), `src/lib/utils.js` (new), `src/main.js` or bootstrap module
**Acceptance criteria:**
1. Extracted helpers are imported from modules instead of defined inline in the main script
2. Circuit behavior for gates, buses, and register values remains unchanged
3. Smoke checks for adding parts and connecting pins still pass
**Dependencies:** Task 1

## Task 3: Extract project normalization and persistence

**What to build:** Move project creation, normalization, storage loading, and storage saving into a dedicated state module.
**Files likely affected:** `src/state/project.js` (new), bootstrap module
**Acceptance criteria:**
1. Loading an existing saved project still succeeds
2. Creating a new project and saving updates still works
3. Browser storage compatibility is preserved
**Dependencies:** Task 2

## Task 4: Extract simulation and challenge verification

**What to build:** Move circuit evaluation, register update collection, and challenge verification into simulation-focused modules with explicit inputs and outputs.
**Files likely affected:** `src/sim/evaluate.js` (new), `src/challenges/verify.js` (new), bootstrap module
**Acceptance criteria:**
1. Workspace evaluation still drives wires, outputs, and register behavior correctly
2. Challenge submit still returns the same verified or needs-work outcomes
3. Simulation logic no longer depends on direct DOM queries
**Dependencies:** Task 3

## Task 5: Extract model helpers for nodes, chips, and interfaces

**What to build:** Move node factory logic, chip instance logic, starter chip creation, and chip interface extraction into model modules.
**Files likely affected:** `src/model/nodes.js` (new), `src/model/chips.js` (new), bootstrap module
**Acceptance criteria:**
1. Adding built-in parts and chip instances still works
2. Snapshotting and starter chip loading still work
3. The main entrypoint no longer owns object-construction details
**Dependencies:** Task 4

## Task 6: Extract UI rendering modules

**What to build:** Split rendering into focused modules for workspace canvas, inspector, chip library, workspace list, and challenge panel.
**Files likely affected:** `src/ui/render.js` (new), `src/ui/renderCanvas.js` (new), `src/ui/renderPanels.js` (new), bootstrap module
**Acceptance criteria:**
1. Render output remains visually equivalent for workspace, inspector, chips, and challenges
2. Render helpers no longer contain storage or simulation mutations
3. The main entrypoint becomes materially smaller
**Dependencies:** Task 5

## Task 7: Extract interactions and actions

**What to build:** Move event handlers and action-style mutations into dedicated interaction and action modules.
**Files likely affected:** `src/ui/interactions.js` (new), `src/actions/workspace.js` (new), `src/actions/challenges.js` (new), bootstrap module
**Acceptance criteria:**
1. Dragging, connecting, zooming, submitting, and quick delete still work
2. UI event registration is isolated from rendering and simulation logic
3. Deleting a node still removes connected wires and updates status correctly
**Dependencies:** Task 6

## Task 8: Add smoke-test harness for critical flows

**What to build:** Create a lightweight test or verification harness for the most fragile pure logic and UI-adjacent flows.
**Files likely affected:** `tests/` or `scripts/` verification files [ASSUMPTION: lightweight Node-based checks are acceptable], extracted modules
**Acceptance criteria:**
1. There is a repeatable way to verify app boot and key logic paths outside manual clicking
2. Challenge verification and circuit evaluation have at least one fixture-based check
3. The test harness documents how to run it in one command
**Dependencies:** Task 4

## Task 9: Final cleanup and delete dead code

**What to build:** Remove duplicated helpers, stale inline code, and transitional glue left behind by earlier phases.
**Files likely affected:** `src/` modules, old bootstrap file, any temporary compatibility wrappers
**Acceptance criteria:**
1. No dead duplicated implementation remains in the legacy script
2. Imports are stable and readable
3. The app still passes syntax checks and the smoke checklist
**Dependencies:** Task 7, Task 8

**Review checkpoint**
Before continuing with any future refactor session, verify that the current phase leaves the app booting, challenge submit working, wires rendering correctly, and node drag plus quick delete behaving the same as before the phase started.

## Assumptions to review

1. No bundler is introduced in the first refactor pass. — Impact: HIGH
   Correct this if: you want Vite, webpack, or another build step as part of the refactor
2. Existing project data in browser storage should remain readable. — Impact: HIGH
   Correct this if: you are willing to invalidate or migrate saved local projects
3. Storage format remains compatible during phases 1-3. — Impact: HIGH
   Correct this if: you want to redesign persistence immediately
4. Following the current “single mutable state + full render trigger” pattern is acceptable for this refactor. — Impact: MEDIUM
   Correct this if: you want a larger architectural rewrite during the same effort
5. Refactor scope remains local-only and does not introduce remote persistence. — Impact: LOW
   Correct this if: you want accounts, sync, or backend persistence folded into the same roadmap
6. Browser-native ES modules are acceptable. — Impact: MEDIUM
   Correct this if: you need legacy browser support or want a bundler-managed build
7. Lightweight Node-based checks are acceptable for the first test harness. — Impact: MEDIUM
   Correct this if: you want a browser-driven E2E harness from the start
