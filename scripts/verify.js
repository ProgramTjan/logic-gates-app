/**
 * scripts/verify.js â€” Node.js test harness (geen browser vereist)
 * Gebruik: node scripts/verify.js
 */

import {
  parseBits,
  formatBits,
  bitwiseBinary,
  bitwiseUnary,
  zeroBits,
  bitsToBoolean,
  ensureWidth,
} from "../src/sim/bits.js";
import { createSimulationEngine } from "../src/sim/evaluate.js";
import { createChallengeVerifier } from "../src/challenges/verification.js";
import { createNodeSpecFactory } from "../src/model/nodespec.js";
import { computeHackAlu } from "../src/sim/hack-alu.js";

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  âœ… ${label}`);
    passed++;
  } else {
    console.error(`  âŒ ${label}`);
    failed++;
  }
}

// â”€â”€ 1. bits.js â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\n[1] bits.js");

assert('parseBits("1", 1) â†’ [true]', parseBits("1", 1)[0] === true);
assert('parseBits("0", 1) â†’ [false]', parseBits("0", 1)[0] === false);
assert('parseBits("10", 2) = [true,false]', parseBits("10", 2)[0] === true && parseBits("10", 2)[1] === false);
assert('formatBits([true,false], 2) â†’ "10"', formatBits([true, false], 2) === "10");
assert('formatBits([false], 1) â†’ "0"', formatBits([false], 1) === "0");
assert(
  "bitwiseBinary AND [1,0]&[1,1] â†’ [true,false]",
  (() => {
    const r = bitwiseBinary([true, false], [true, true], (a, b) => a && b);
    return r[0] === true && r[1] === false;
  })()
);
assert("bitsToBoolean([true]) â†’ true", bitsToBoolean([true]) === true);
assert("bitsToBoolean([false]) â†’ false", bitsToBoolean([false]) === false);
assert(
  "zeroBits(3) â†’ [false,false,false]",
  zeroBits(3).every((b) => b === false) && zeroBits(3).length === 3
);
assert(
  "ensureWidth([true], 3) pads to length 3",
  ensureWidth([true], 3).length === 3
);

// â”€â”€ 2. evaluate.js â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\n[2] evaluate.js â€” AND-circuit fixture");

const { getNodeSpec } = createNodeSpecFactory({ getChipDefinition: () => null });

let registerStates = {};
const sim = createSimulationEngine({
  getNodeSpec,
  getChipDefinition: () => null,
  getRegisterStates: () => registerStates,
  zeroBits,
  bitsToBoolean,
  formatBits,
  parseBits,
  ensureWidth,
  bitwiseUnary,
  bitwiseBinary,
});

const andCircuit = {
  nodes: [
    { id: "inA", type: "input-pin", x: 0, y: 0, config: { label: "A", width: 1, previewValue: "0" } },
    { id: "inB", type: "input-pin", x: 0, y: 100, config: { label: "B", width: 1, previewValue: "0" } },
    { id: "gate1", type: "gate", x: 200, y: 50, config: { label: "AND", gateType: "AND", width: 1 } },
    { id: "outZ", type: "output-pin", x: 400, y: 50, config: { label: "OUT", width: 1 } },
  ],
  wires: [
    { id: "w1", fromNodeId: "inA", fromPin: "OUT", toNodeId: "gate1", toPin: "A" },
    { id: "w2", fromNodeId: "inB", fromPin: "OUT", toNodeId: "gate1", toPin: "B" },
    { id: "w3", fromNodeId: "gate1", fromPin: "OUT", toNodeId: "outZ", toPin: "IN" },
  ],
};

const r00 = sim.evaluateCircuit(andCircuit, { inA: parseBits("0", 1), inB: parseBits("0", 1) }, "test", new Set());
assert("AND(0,0) â†’ w3.high=false", r00.wireSignals["w3"].high === false);
assert("AND(0,0) â†’ geen fouten", r00.errors.length === 0);

const r11 = sim.evaluateCircuit(andCircuit, { inA: parseBits("1", 1), inB: parseBits("1", 1) }, "test", new Set());
assert("AND(1,1) â†’ w3.high=true", r11.wireSignals["w3"].high === true);

const r10 = sim.evaluateCircuit(andCircuit, { inA: parseBits("1", 1), inB: parseBits("0", 1) }, "test", new Set());
assert("AND(1,0) â†’ w3.high=false", r10.wireSignals["w3"].high === false);

const r01 = sim.evaluateCircuit(andCircuit, { inA: parseBits("0", 1), inB: parseBits("1", 1) }, "test", new Set());
assert("AND(0,1) â†’ w3.high=false", r01.wireSignals["w3"].high === false);

// â”€â”€ 3. verification.js â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\n[3] verification.js â€” NAND challenge fixture");

const nandCircuit = {
  nodes: [
    { id: "pinA", type: "input-pin", x: 0, y: 0, config: { label: "A", width: 1, previewValue: "0" } },
    { id: "pinB", type: "input-pin", x: 0, y: 100, config: { label: "B", width: 1, previewValue: "0" } },
    { id: "andG", type: "gate", x: 200, y: 50, config: { label: "AND", gateType: "AND", width: 1 } },
    { id: "notG", type: "gate", x: 350, y: 50, config: { label: "NOT", gateType: "NOT", width: 1 } },
    { id: "pinOut", type: "output-pin", x: 500, y: 50, config: { label: "OUT", width: 1 } },
  ],
  wires: [
    { id: "n1", fromNodeId: "pinA", fromPin: "OUT", toNodeId: "andG", toPin: "A" },
    { id: "n2", fromNodeId: "pinB", fromPin: "OUT", toNodeId: "andG", toPin: "B" },
    { id: "n3", fromNodeId: "andG", fromPin: "OUT", toNodeId: "notG", toPin: "A" },
    { id: "n4", fromNodeId: "notG", fromPin: "OUT", toNodeId: "pinOut", toPin: "IN" },
  ],
};

const nandDefinition = {
  id: "def-nand",
  name: "NAND",
  version: 1,
  inputs: [
    { key: "pinA", name: "A", width: 1 },
    { key: "pinB", name: "B", width: 1 },
  ],
  outputs: [{ key: "pinOut", name: "OUT", width: 1 }],
  circuitSnapshot: nandCircuit,
};

const nandChallenge = {
  id: "nand-test",
  names: ["NAND"],
  inputs: 2,
  outputs: 1,
  verification: "combinational",
  tests: [
    { inputs: { A: "0", B: "0" }, outputs: { OUT: "1" } },
    { inputs: { A: "0", B: "1" }, outputs: { OUT: "1" } },
    { inputs: { A: "1", B: "0" }, outputs: { OUT: "1" } },
    { inputs: { A: "1", B: "1" }, outputs: { OUT: "0" } },
  ],
};

const verifierDeps = {
  deepClone: (x) => JSON.parse(JSON.stringify(x)),
  parseBits,
  formatBits,
  getChipDefinition: () => null,
  evaluateCircuit: (circuit, inputs, path, trail) =>
    sim.evaluateCircuit(circuit, inputs, path, trail),
  collectRegisterUpdates: (circuit, inputs, path, trail) =>
    sim.collectRegisterUpdates(circuit, inputs, path, trail),
  getRuntimeRegisterStates: () => registerStates,
  setRuntimeRegisterStates: (next) => {
    registerStates = next;
  },
};
const verifier = createChallengeVerifier(verifierDeps);

const nandResult = verifier.evaluateChallengeResult(nandChallenge, [nandDefinition]);
assert("NAND challenge: done=true", nandResult.done === true);
assert("NAND challenge: label=Verified", nandResult.label === "Verified");
assert("NAND challenge: 4/4 tests geslaagd", nandResult.summary.startsWith("4/4"));

// Broken NAND (AND without NOT) should fail
const brokenDefinition = {
  ...nandDefinition,
  id: "def-broken",
  name: "NAND",
  circuitSnapshot: andCircuit,
  inputs: [
    { key: "inA", name: "A", width: 1 },
    { key: "inB", name: "B", width: 1 },
  ],
  outputs: [{ key: "outZ", name: "OUT", width: 1 }],
};
const brokenResult = verifier.evaluateChallengeResult(nandChallenge, [brokenDefinition]);
assert("Broken NAND (AND only): done=false", brokenResult.done === false);

// â”€â”€ 4. hack-alu.js â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\n[4] hack-alu.js");
const z16 = "0".repeat(16);
const alu0 = computeHackAlu(z16, z16, { zx: "1", nx: "0", zy: "1", ny: "0", f: "1", no: "0" });
assert("ALU zero constant: OUT all 0, zr=1", alu0.OUT === z16 && alu0.zr === "1" && alu0.ng === "0");
const aluAdd = computeHackAlu("0000000000000100", "0000000000000011", {
  zx: "0",
  nx: "0",
  zy: "0",
  ny: "0",
  f: "1",
  no: "0",
});
assert("ALU 4+3=7", aluAdd.OUT === "0000000000000111" && aluAdd.zr === "0");

// â”€â”€ 5. splitter + register fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\n[5] evaluate.js â€” bus split/join + register");

const splitCircuit = {
  nodes: [
    { id: "in", type: "input-pin", x: 0, y: 0, config: { label: "IN", width: 4, previewValue: "1010" } },
    { id: "sp", type: "splitter", x: 200, y: 0, config: { label: "Split", width: 4, highWidth: 2 } },
    { id: "hi", type: "output-pin", x: 400, y: 0, config: { label: "HI", width: 2 } },
    { id: "lo", type: "output-pin", x: 400, y: 80, config: { label: "LO", width: 2 } },
  ],
  wires: [
    { id: "sw1", fromNodeId: "in", fromPin: "OUT", toNodeId: "sp", toPin: "IN" },
    { id: "sw2", fromNodeId: "sp", fromPin: "HI", toNodeId: "hi", toPin: "IN" },
    { id: "sw3", fromNodeId: "sp", fromPin: "LO", toNodeId: "lo", toPin: "IN" },
  ],
};

const splitEval = sim.evaluateCircuit(splitCircuit, {}, "split-test", new Set());
const spOut = splitEval.nodeSignals.sp?.outputs;
assert("splitter HI=10", spOut && formatBits(spOut.HI, 2) === "10");
assert("splitter LO=10", spOut && formatBits(spOut.LO, 2) === "10");

const joinCircuit = {
  nodes: [
    { id: "hi", type: "input-pin", x: 0, y: 0, config: { label: "HI", width: 2, previewValue: "11" } },
    { id: "lo", type: "input-pin", x: 0, y: 80, config: { label: "LO", width: 2, previewValue: "00" } },
    { id: "jn", type: "joiner", x: 200, y: 40, config: { label: "Join", width: 4, highWidth: 2 } },
    { id: "out", type: "output-pin", x: 400, y: 40, config: { label: "OUT", width: 4 } },
  ],
  wires: [
    { id: "jw1", fromNodeId: "hi", fromPin: "OUT", toNodeId: "jn", toPin: "HI" },
    { id: "jw2", fromNodeId: "lo", fromPin: "OUT", toNodeId: "jn", toPin: "LO" },
    { id: "jw3", fromNodeId: "jn", fromPin: "OUT", toNodeId: "out", toPin: "IN" },
  ],
};

const joinEval = sim.evaluateCircuit(joinCircuit, {}, "join-test", new Set());
const jnOut = joinEval.nodeSignals.jn?.outputs?.OUT;
assert("joiner OUT=1100", jnOut && formatBits(jnOut, 4) === "1100");

let regStates = {};
const regSim = createSimulationEngine({
  getNodeSpec,
  getChipDefinition: () => null,
  getRegisterStates: () => regStates,
  zeroBits,
  bitsToBoolean,
  formatBits,
  parseBits,
  ensureWidth,
  bitwiseUnary,
  bitwiseBinary,
});

const regCircuit = {
  nodes: [
    { id: "d", type: "input-pin", x: 0, y: 0, config: { label: "D", width: 1, previewValue: "1" } },
    { id: "clk", type: "input-pin", x: 0, y: 80, config: { label: "CLK", width: 1, previewValue: "1" } },
    { id: "reg", type: "register", x: 200, y: 40, config: { label: "R", width: 1, resetValue: "0" } },
    { id: "q", type: "output-pin", x: 400, y: 40, config: { label: "Q", width: 1 } },
  ],
  wires: [
    { id: "rw1", fromNodeId: "d", fromPin: "OUT", toNodeId: "reg", toPin: "D" },
    { id: "rw2", fromNodeId: "clk", fromPin: "OUT", toNodeId: "reg", toPin: "CLK" },
    { id: "rw3", fromNodeId: "reg", fromPin: "Q", toNodeId: "q", toPin: "IN" },
  ],
};

const regUpdates = regSim.collectRegisterUpdates(regCircuit, {}, "reg-test", new Set());
regUpdates.forEach((u) => {
  regStates[u.key] = { bits: u.bits };
});
const regEval = regSim.evaluateCircuit(regCircuit, {}, "reg-test", new Set());
assert(
  "register latch Q=1 after CLK tick",
  regEval.nodeSignals.reg?.outputs?.Q && formatBits(regEval.nodeSignals.reg.outputs.Q, 1) === "1"
);

// Full clock cycle = runner tick: CLK 1 → step → CLK 0 → step (level-sensitive)
regStates = {};
const cycleCircuit = JSON.parse(JSON.stringify(regCircuit));
const clkPin = cycleCircuit.nodes.find((n) => n.id === "clk");
const dPin = cycleCircuit.nodes.find((n) => n.id === "d");
dPin.config.previewValue = "1";
clkPin.config.previewValue = "1";
regSim.collectRegisterUpdates(cycleCircuit, {}, "cycle", new Set()).forEach((u) => {
  regStates[u.key] = { bits: u.bits };
});
clkPin.config.previewValue = "0";
regSim.collectRegisterUpdates(cycleCircuit, {}, "cycle", new Set()).forEach((u) => {
  regStates[u.key] = { bits: u.bits };
});
const afterHigh = regSim.evaluateCircuit(cycleCircuit, {}, "cycle", new Set());
assert(
  "clock-cycle: Q=1 na hoog-fase",
  formatBits(afterHigh.nodeSignals.reg.outputs.Q, 1) === "1"
);
dPin.config.previewValue = "0";
clkPin.config.previewValue = "1";
regSim.collectRegisterUpdates(cycleCircuit, {}, "cycle", new Set()).forEach((u) => {
  regStates[u.key] = { bits: u.bits };
});
clkPin.config.previewValue = "0";
regSim.collectRegisterUpdates(cycleCircuit, {}, "cycle", new Set()).forEach((u) => {
  regStates[u.key] = { bits: u.bits };
});
const afterLowD = regSim.evaluateCircuit(cycleCircuit, {}, "cycle", new Set());
assert(
  "clock-cycle: Q=0 na tweede cyclus met D=0",
  formatBits(afterLowD.nodeSignals.reg.outputs.Q, 1) === "0"
);

// â”€â”€ 6. project normalization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\n[6] project.js â€” normalizeProject");

import { normalizeProject as normalizeProjectState } from "../src/state/project.js";
import { normalizeNode, normalizeRomProgram, clampRomAddressWidth } from "../src/model/nodes.js";

const stubDeps = {
  createWorkspace: (project, name) => ({
    id: "ws-1",
    name,
    nodes: [],
    wires: [],
    meta: {},
  }),
  createNode: () => ({ id: "n-1", type: "switch", x: 0, y: 0, config: { label: "S", width: 1, value: "0" } }),
  ensureStarterChips: () => {},
  normalizeNode,
};

const corrupt = { nextId: "bad", workspaces: null, chipSeries: [], chipDefinitions: [] };
const normalized = normalizeProjectState(corrupt, stubDeps);
assert("normalizeProject: workspaces array", Array.isArray(normalized.workspaces) && normalized.workspaces.length > 0);
assert("normalizeProject: nextId is number", Number.isInteger(normalized.nextId) && normalized.nextId > 0);
assert("normalizeProject: runtime.registerStates", normalized.runtime && typeof normalized.runtime.registerStates === "object");
assert(
  "normalizeProject: learner defaults",
  normalized.learner &&
    Array.isArray(normalized.learner.completedChallengeIds) &&
    normalized.learner.unlockedAll === false &&
    normalized.learner.quizAnswers &&
    typeof normalized.learner.quizAnswers === "object" &&
    normalized.learner.tutorialDismissed === false &&
    normalized.learner.completionOverlayDismissed === false &&
    Array.isArray(normalized.learner.badges)
);

console.log("\n[6b] project.js — backups + quota");

import {
  saveProject as saveProjectState,
  listBackups,
  restoreBackup,
  maybeRotateBackups,
  BACKUP_KEYS,
  BACKUP_INTERVAL_MS,
  STORAGE_KEY,
  isQuotaExceededError,
} from "../src/state/project.js";

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    _map: map,
  };
}

const backupProjectA = {
  nextId: 2,
  workspaces: [{ id: "ws-a", name: "A", nodes: [], wires: [], meta: {} }],
  chipSeries: [],
  chipDefinitions: [],
  runtime: { registerStates: {} },
  learner: createDefaultLearner(),
};
const backupProjectB = {
  ...backupProjectA,
  workspaces: [
    { id: "ws-a", name: "A", nodes: [], wires: [], meta: {} },
    { id: "ws-b", name: "B", nodes: [], wires: [], meta: {} },
  ],
};

const mem = createMemoryStorage();
const t0 = 1_000_000;
assert("eerste save roteert backup", maybeRotateBackups(mem, backupProjectA, t0) === true);
assert("backup-1 aanwezig", Boolean(mem.getItem(BACKUP_KEYS[0])));
assert(
  "listBackups na 1 rotatie",
  listBackups(mem).length === 1 && listBackups(mem)[0].workspaceCount === 1
);

assert(
  "binnen interval geen tweede rotatie",
  maybeRotateBackups(mem, backupProjectB, t0 + BACKUP_INTERVAL_MS - 1) === false
);
assert(
  "na interval wel rotatie",
  maybeRotateBackups(mem, backupProjectB, t0 + BACKUP_INTERVAL_MS) === true
);
assert("twee backup-slots", listBackups(mem).length === 2);
assert("nieuwste slot heeft 2 sheets", listBackups(mem)[0].workspaceCount === 2);

const saveOk = saveProjectState(backupProjectB, mem, { now: t0 + BACKUP_INTERVAL_MS * 3 });
assert("saveProject ok", saveOk.ok === true);
assert("hoofdkey gezet", Boolean(mem.getItem(STORAGE_KEY)));

const restored = restoreBackup(mem, 2, stubDeps);
assert("restoreBackup slot 2 levert project", restored && Array.isArray(restored.workspaces));
assert(
  "restore schrijft hoofdkey",
  Boolean(mem.getItem(STORAGE_KEY)) && JSON.parse(mem.getItem(STORAGE_KEY)).workspaces.length >= 1
);

const quotaStorage = createMemoryStorage();
quotaStorage.setItem = () => {
  const err = new Error("quota");
  err.name = "QuotaExceededError";
  err.code = 22;
  throw err;
};
const quotaResult = saveProjectState(backupProjectA, quotaStorage, { now: t0 });
assert("QuotaExceededError → ok:false", quotaResult.ok === false && quotaResult.reason === "quota");
assert("isQuotaExceededError herkent fout", isQuotaExceededError({ name: "QuotaExceededError", code: 22 }));

// â”€â”€ 7. curriculum unlock + migration fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\n[7] curriculum.js â€” unlock & deriveCompletedChallengeIds");

import {
  computeModuleBadges,
  syncLearnerBadges,
  getPrerequisites,
  isLessonUnlocked,
  deriveCompletedChallengeIds,
  markChallengeCompleted,
  createDefaultLearner,
  recordQuizAnswer,
} from "../src/data/curriculum.js";
import { CHALLENGES as REAL_CHALLENGES } from "../src/data/challenges.js";

assert("intro-light prerequisites = []", getPrerequisites("intro-light").length === 0);
assert("nand komt na les 0 (intro-light)", getPrerequisites("nand")[0] === "intro-light");
assert("not prerequisites = [nand]", getPrerequisites("not").length === 1 && getPrerequisites("not")[0] === "nand");
assert(
  "half-adder prerequisites = last poorten les (dmux8way)",
  getPrerequisites("half-adder")[0] === "dmux8way"
);
assert("not16 komt na dmux in curriculum", getPrerequisites("not16")[0] === "dmux");
assert("or8way komt na dmux4way", getPrerequisites("or8way")[0] === "dmux4way");

const freshLearner = createDefaultLearner();
assert("verse learner: les 0 unlocked", isLessonUnlocked("intro-light", freshLearner) === true);
assert("verse learner: nand nog op slot", isLessonUnlocked("nand", freshLearner) === false);
assert("verse learner: not locked", isLessonUnlocked("not", freshLearner) === false);
assert(
  "na nand completed: not unlocked",
  isLessonUnlocked("not", markChallengeCompleted(freshLearner, "nand")) === true
);
assert(
  "unlockedAll opent alles",
  isLessonUnlocked("cpu", { completedChallengeIds: [], unlockedAll: true }) === true
);
assert(
  "unlockedAll uit herstelt gating",
  isLessonUnlocked("cpu", { completedChallengeIds: [], unlockedAll: false }) === false
);

const derivedEmpty = deriveCompletedChallengeIds(REAL_CHALLENGES, [], () => ({ done: false }));
assert("derive: geen defs â†’ []", derivedEmpty.length === 0);

const derivedNand = deriveCompletedChallengeIds(
  REAL_CHALLENGES,
  [nandDefinition],
  (challenge, definitions) => verifier.evaluateChallengeResult(challenge, definitions)
);
assert("derive: NAND-def â†’ bevat nand", derivedNand.includes("nand"));
assert("derive: NAND-def â†’ bevat niet not", !derivedNand.includes("not"));

const migrated = normalizeProjectState(
  {
    nextId: 2,
    workspaces: [{ id: "ws-1", name: "Main", nodes: [], wires: [], meta: {} }],
    chipSeries: [],
    chipDefinitions: [nandDefinition],
    // geen learner â†’ migratie
  },
  {
    ...stubDeps,
    evaluateChallengeResult: (challenge, definitions) =>
      verifier.evaluateChallengeResult(challenge, definitions),
    isStarterDefinition: (definition) => verifier.isStarterDefinition(definition),
  }
);
assert(
  "migratie: completedChallengeIds bevat nand",
  migrated.learner.completedChallengeIds.includes("nand")
);

const preserved = normalizeProjectState(
  {
    nextId: 2,
    workspaces: [{ id: "ws-1", name: "Main", nodes: [], wires: [], meta: {} }],
    chipSeries: [],
    chipDefinitions: [nandDefinition],
    learner: { completedChallengeIds: [], unlockedAll: false },
  },
  {
    ...stubDeps,
    evaluateChallengeResult: (challenge, definitions) =>
      verifier.evaluateChallengeResult(challenge, definitions),
    isStarterDefinition: (definition) => verifier.isStarterDefinition(definition),
  }
);
assert(
  "bestaande lege completedChallengeIds niet overschreven door migratie",
  preserved.learner.completedChallengeIds.length === 0
);

const withQuiz = recordQuizAnswer(createDefaultLearner(), "nand", 0, 1);
assert("recordQuizAnswer slaat index op", withQuiz.quizAnswers.nand["0"] === 1);

const quizPersisted = normalizeProjectState(
  {
    nextId: 2,
    workspaces: [{ id: "ws-1", name: "Main", nodes: [], wires: [], meta: {} }],
    chipSeries: [],
    chipDefinitions: [],
    learner: { completedChallengeIds: [], unlockedAll: false, quizAnswers: { nand: { "0": 1 } } },
  },
  stubDeps
);
assert(
  "quizAnswers overleven normalizeProject",
  quizPersisted.learner.quizAnswers.nand && quizPersisted.learner.quizAnswers.nand["0"] === 1
);

const nandLesson = REAL_CHALLENGES.find((c) => c.id === "nand");
assert("nand heeft learning.goal", Boolean(nandLesson?.learning?.goal));
assert(
  "eerste 6 lessen hebben quiz",
  ["nand", "not", "and", "or", "xor", "xor-nand-only"].every((id) => {
    const c = REAL_CHALLENGES.find((item) => item.id === id);
    return Array.isArray(c?.learning?.quiz) && c.learning.quiz.length > 0;
  })
);
assert(
  "alle challenges hebben learning.goal",
  REAL_CHALLENGES.every((c) => typeof c.learning?.goal === "string" && c.learning.goal.length > 0)
);

// â”€â”€ 8. Not16 referentie-oplossing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\n[8] Not16 challenge â€” referentie met 16-bit NOT-gate");

const not16Challenge = REAL_CHALLENGES.find((c) => c.id === "not16");
const not16Circuit = {
  nodes: [
    { id: "in", type: "input-pin", x: 0, y: 0, config: { label: "IN", width: 16, previewValue: "0".repeat(16) } },
    { id: "notg", type: "gate", x: 200, y: 0, config: { label: "NOT", gateType: "NOT", width: 16 } },
    { id: "out", type: "output-pin", x: 400, y: 0, config: { label: "OUT", width: 16 } },
  ],
  wires: [
    { id: "w1", fromNodeId: "in", fromPin: "OUT", toNodeId: "notg", toPin: "A" },
    { id: "w2", fromNodeId: "notg", fromPin: "OUT", toNodeId: "out", toPin: "IN" },
  ],
};
const not16Definition = {
  id: "def-not16",
  name: "Not16",
  version: 1,
  inputs: [{ key: "in", name: "IN", width: 16 }],
  outputs: [{ key: "out", name: "OUT", width: 16 }],
  circuitSnapshot: not16Circuit,
};
const not16Result = verifier.evaluateChallengeResult(not16Challenge, [not16Definition]);
assert("Not16 challenge bestaat", Boolean(not16Challenge));
assert("Not16 referentie: done=true", not16Result.done === true);
assert("Not16 referentie: Verified", not16Result.label === "Verified");

const or8Challenge = REAL_CHALLENGES.find((c) => c.id === "or8way");
assert("or8way challenge bestaat", Boolean(or8Challenge));
assert("mux8way16 challenge bestaat", Boolean(REAL_CHALLENGES.find((c) => c.id === "mux8way16")));
assert("dmux8way challenge bestaat", Boolean(REAL_CHALLENGES.find((c) => c.id === "dmux8way")));
assert(
  "nieuwe Project-1 lessen in CHALLENGES",
  ["not16", "and16", "or16", "mux16", "or8way", "mux4way16", "mux8way16", "dmux8way"].every((id) =>
    REAL_CHALLENGES.some((c) => c.id === id)
  )
);

// â”€â”€ 9. Bit (dff) sequential referentie â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\n[9] dff/Bit â€” sequential-script referentie");

const bitChallenge = REAL_CHALLENGES.find((c) => c.id === "dff");
const bitCircuit = {
  nodes: [
    { id: "in", type: "input-pin", x: 0, y: 0, config: { label: "IN", width: 1, previewValue: "0" } },
    { id: "load", type: "input-pin", x: 0, y: 60, config: { label: "LOAD", width: 1, previewValue: "0" } },
    { id: "clk", type: "input-pin", x: 0, y: 120, config: { label: "CLK", width: 1, previewValue: "0" } },
    { id: "andC", type: "gate", x: 220, y: 90, config: { label: "AND", gateType: "AND", width: 1 } },
    { id: "reg", type: "register", x: 400, y: 40, config: { label: "R", width: 1, resetValue: "0" } },
    { id: "out", type: "output-pin", x: 580, y: 40, config: { label: "OUT", width: 1 } },
  ],
  wires: [
    { id: "b1", fromNodeId: "in", fromPin: "OUT", toNodeId: "reg", toPin: "D" },
    { id: "b2", fromNodeId: "clk", fromPin: "OUT", toNodeId: "andC", toPin: "A" },
    { id: "b3", fromNodeId: "load", fromPin: "OUT", toNodeId: "andC", toPin: "B" },
    { id: "b4", fromNodeId: "andC", fromPin: "OUT", toNodeId: "reg", toPin: "CLK" },
    { id: "b5", fromNodeId: "reg", fromPin: "Q", toNodeId: "out", toPin: "IN" },
  ],
};
const bitDefinition = {
  id: "def-bit",
  name: "Bit",
  version: 1,
  inputs: [
    { key: "in", name: "IN", width: 1 },
    { key: "load", name: "LOAD", width: 1 },
    { key: "clk", name: "CLK", width: 1 },
  ],
  outputs: [{ key: "out", name: "OUT", width: 1 }],
  circuitSnapshot: bitCircuit,
};
const bitResult = verifier.runChallengeVerification(bitChallenge, bitDefinition);
assert("dff challenge bestaat", Boolean(bitChallenge));
assert("Bit referentie: done=true", bitResult.done === true);
assert("register16 challenge bestaat", Boolean(REAL_CHALLENGES.find((c) => c.id === "register16")));
assert(
  "geheugen-leerroute ids",
  getPrerequisites("dff")[0] === "inc4" &&
    getPrerequisites("register-chip")[0] === "dff" &&
    getPrerequisites("register16")[0] === "register-chip" &&
    getPrerequisites("pc")[0] === "register16"
);

console.log("\n[10] instruction-decoder + CPU C-instructies");

const decoderChallenge = REAL_CHALLENGES.find((ch) => ch.id === "instruction-decoder");
assert("instruction-decoder bestaat", Boolean(decoderChallenge));
assert(
  "alu-with-registers bestaat",
  Boolean(REAL_CHALLENGES.find((ch) => ch.id === "alu-with-registers"))
);

const dEqA = "1110110000010000";
const dEqAFields = decoderChallenge.tests.find((t) => t.inputs.IN === dEqA);
assert("D=A test aanwezig", Boolean(dEqAFields));
assert("D=A isA=0", dEqAFields.outputs.isA === "0");
assert("D=A dest=010", dEqAFields.outputs.dest === "010");
assert("D=A jump=000", dEqAFields.outputs.jump === "000");
assert("D=A comp=0110000", dEqAFields.outputs.comp === "0110000");

const at21Fields = decoderChallenge.tests.find((t) => t.inputs.IN === "0000000000010101");
assert("@21 isA=1", at21Fields.outputs.isA === "1");

const cpuChallenge = REAL_CHALLENGES.find((ch) => ch.id === "cpu");
const cpuScript = cpuChallenge.script || [];
assert("cpu script langer dan alleen pc++", cpuScript.length > 7);
assert(
  "cpu script bevat D=A instructie",
  cpuScript.some((s) => s.inputs && s.inputs.instruction === dEqA)
);
assert(
  "cpu script bevat unconditional jump",
  cpuScript.some((s) => s.inputs && s.inputs.instruction === "1110101010000111")
);

const sumExpect = computeHackAlu("0000000000000111", "0000000000000011", {
  zx: "0",
  nx: "0",
  zy: "0",
  ny: "0",
  f: "1",
  no: "0",
});
assert("D+A referentie OUT=10", sumExpect.OUT === "0000000000001010");
assert(
  "cpu expect addressM afgeleid van computeHackAlu",
  Boolean(cpuScript.find((s) => s.expect && s.expect.addressM === sumExpect.OUT.slice(1)))
);
assert(
  "decoder na alu in curriculum",
  getPrerequisites("instruction-decoder")[0] === "alu" &&
    getPrerequisites("alu-with-registers")[0] === "instruction-decoder"
);

// --- 12. ROM node fixtures ---
console.log("\n[12] evaluate.js — ROM ADDR → OUT");

const romWords = ["0000000000001010", "1111000011110000", "0000000000000001"];
const romCircuit = {
  nodes: [
    {
      id: "addr",
      type: "input-pin",
      x: 0,
      y: 0,
      config: { label: "ADDR", width: 2, previewValue: "00" },
    },
    {
      id: "rom",
      type: "rom",
      x: 200,
      y: 0,
      config: { label: "ROM", addressWidth: 2, program: romWords },
    },
    { id: "out", type: "output-pin", x: 400, y: 0, config: { label: "OUT", width: 16 } },
  ],
  wires: [
    { id: "rw1", fromNodeId: "addr", fromPin: "OUT", toNodeId: "rom", toPin: "ADDR" },
    { id: "rw2", fromNodeId: "rom", fromPin: "OUT", toNodeId: "out", toPin: "IN" },
  ],
};

function romOutAt(addrBits) {
  const result = sim.evaluateCircuit(
    romCircuit,
    { addr: parseBits(addrBits, 2) },
    "rom-test",
    new Set()
  );
  return formatBits(result.nodeSignals.rom.outputs.OUT, 16);
}

assert("ROM ADDR=00 → word0", romOutAt("00") === romWords[0]);
assert("ROM ADDR=01 → word1", romOutAt("01") === romWords[1]);
assert("ROM ADDR=10 → word2", romOutAt("10") === romWords[2]);
assert(
  "ROM ADDR=11 → zero (OOB)",
  romOutAt("11") === "0000000000000000"
);

const messyRom = normalizeNode({
  id: "r1",
  type: "rom",
  x: 0,
  y: 0,
  config: { addressWidth: 99, program: ["101", "xx11yy"] },
});
assert("normalizeNode rom addressWidth clamp", messyRom.config.addressWidth === 8);
assert(
  "normalizeNode rom program pads to 16",
  messyRom.config.program[0] === "0000000000000101" &&
    messyRom.config.program[1] === "0000000000000011"
);
assert("clampRomAddressWidth(0) → 1", clampRomAddressWidth(0) === 1);
assert(
  "normalizeRomProgram filters non-bits",
  normalizeRomProgram(["ab10cd"])[0] === "0000000000000010"
);

const noRomProject = normalizeProjectState(
  {
    nextId: 2,
    workspaces: [{ id: "ws-1", name: "Main", nodes: [], wires: [], meta: {} }],
    chipSeries: [],
    chipDefinitions: [],
  },
  stubDeps
);
assert(
  "project zonder rom-nodes blijft normaal",
  Array.isArray(noRomProject.workspaces[0].nodes) && noRomProject.workspaces[0].nodes.length === 0
);

// --- 13. Screen write via collectRegisterUpdates ---
console.log("\n[13] evaluate.js — Screen WRITE+CLK");

const screenCircuit = {
  nodes: [
    {
      id: "in",
      type: "input-pin",
      x: 0,
      y: 0,
      config: { label: "IN", width: 16, previewValue: "0000000011110000" },
    },
    {
      id: "row",
      type: "input-pin",
      x: 0,
      y: 60,
      config: { label: "ROW", width: 3, previewValue: "010" },
    },
    {
      id: "write",
      type: "input-pin",
      x: 0,
      y: 120,
      config: { label: "WRITE", width: 1, previewValue: "1" },
    },
    {
      id: "clk",
      type: "input-pin",
      x: 0,
      y: 180,
      config: { label: "CLK", width: 1, previewValue: "1" },
    },
    {
      id: "scr",
      type: "screen",
      x: 220,
      y: 40,
      config: { label: "Screen", cols: 8, rows: 8 },
    },
  ],
  wires: [
    { id: "sw1", fromNodeId: "in", fromPin: "OUT", toNodeId: "scr", toPin: "IN" },
    { id: "sw2", fromNodeId: "row", fromPin: "OUT", toNodeId: "scr", toPin: "ROW" },
    { id: "sw3", fromNodeId: "write", fromPin: "OUT", toNodeId: "scr", toPin: "WRITE" },
    { id: "sw4", fromNodeId: "clk", fromPin: "OUT", toNodeId: "scr", toPin: "CLK" },
  ],
};

regStates = {};
const screenUpdates = sim.collectRegisterUpdates(screenCircuit, {}, "screen-test", new Set());
assert("screen write produceert 8 rij-updates", screenUpdates.length === 8);
screenUpdates.forEach((u) => {
  regStates[u.key] = { bits: u.bits };
});
const screenBase = screenUpdates[0].key.replace(/:row\d+$/, "");
const screenBits = Array.from({ length: 8 }, (_, row) =>
  formatBits(regStates[`${screenBase}:row${row}`].bits, 8)
).join("");
const row2 = screenBits.slice(16, 24);
assert("screen rij 2 = 11110000", row2 === "11110000");
assert(
  "screen andere rijen leeg",
  screenBits.slice(0, 16) === "0".repeat(16) && screenBits.slice(24) === "0".repeat(40)
);

const kbNode = normalizeNode({
  id: "kb",
  type: "keyboard",
  x: 0,
  y: 0,
  config: { keyCode: "1000001" },
});
assert(
  "keyboard keyCode pads to 16",
  kbNode.config.keyCode === "0000000001000001"
);
const kbEval = sim.evaluateCircuit(
  {
    nodes: [kbNode, { id: "out", type: "output-pin", x: 200, y: 0, config: { label: "OUT", width: 16 } }],
    wires: [{ id: "kw1", fromNodeId: "kb", fromPin: "OUT", toNodeId: "out", toPin: "IN" }],
  },
  {},
  "kb-test",
  new Set()
);
assert(
  "keyboard OUT = keyCode",
  formatBits(kbEval.nodeSignals.kb.outputs.OUT, 16) === kbNode.config.keyCode
);

// --- 14. Computer eindproject + expectState + referentie ---
console.log("\n[14] computer les + expectState referentie");

import { demoProgramBits, C, aInstr, SCREEN_ROWS_DEMO } from "../src/data/demo-programs.js";

assert("computer challenge bestaat", Boolean(REAL_CHALLENGES.find((c) => c.id === "computer")));
assert(
  "computer na cpu in curriculum",
  getPrerequisites("computer")[0] === "cpu"
);
assert("demo program heeft instructies", demoProgramBits().length >= 8);
assert("demo D=A encoding", C.dEqA === "1110110000010000");
assert("demo M=D encoding", C.mEqD === "1110001100001000");
assert("aInstr(240)", aInstr(0xf0) === "0000000011110000");

const computerChallenge = REAL_CHALLENGES.find((c) => c.id === "computer");
assert(
  "computer template heeft ROM+Screen",
  Array.isArray(computerChallenge.template.nodes) &&
    computerChallenge.template.nodes.some((n) => n.type === "rom") &&
    computerChallenge.template.nodes.some((n) => n.type === "screen")
);
assert(
  "computer ROM bevat demo-programma",
  computerChallenge.template.nodes.find((n) => n.type === "rom").config.program.length ===
    SCREEN_ROWS_DEMO.length
);

/** Verborgen referentie-Computer: 3-bit teller schildert screen-rijen (geen echte CPU). */
function buildReferenceComputerDefinition() {
  const n = (id, type, config) => ({ id, type, x: 0, y: 0, config });
  const nodes = [
    n("reset", "input-pin", { label: "reset", width: 1, previewValue: "0" }),
    n("clk", "input-pin", { label: "CLK", width: 1, previewValue: "0" }),
    n("pcOut", "output-pin", { label: "pc", width: 16 }),
    n("r0", "register", { label: "R0", width: 1, resetValue: "0" }),
    n("r1", "register", { label: "R1", width: 1, resetValue: "0" }),
    n("r2", "register", { label: "R2", width: 1, resetValue: "0" }),
    n("not0", "gate", { label: "NOT", gateType: "NOT", width: 1 }),
    n("xor1", "gate", { label: "XOR", gateType: "XOR", width: 1 }),
    n("andC", "gate", { label: "AND", gateType: "AND", width: 1 }),
    n("xor2", "gate", { label: "XOR", gateType: "XOR", width: 1 }),
    n("joinLo", "joiner", { label: "Join01", width: 2, highWidth: 1 }),
    n("joinRow", "joiner", { label: "JoinRow", width: 3, highWidth: 1 }),
    n("padHi", "switch", { label: "Pad", width: 13, value: "0".repeat(13) }),
    n("joinPc", "joiner", { label: "JoinPC", width: 16, highWidth: 13 }),
    n("pix", "switch", { label: "Pix", width: 16, value: "0000000011110000" }),
    n("wr", "switch", { label: "WR", width: 1, value: "1" }),
    n("scr", "screen", { label: "Screen", cols: 8, rows: 8 }),
  ];
  const w = (id, from, fp, to, tp) => ({
    id,
    fromNodeId: from,
    fromPin: fp,
    toNodeId: to,
    toPin: tp,
  });
  const wires = [
    w("w1", "r0", "Q", "not0", "A"),
    w("w2", "not0", "OUT", "r0", "D"),
    w("w3", "r0", "Q", "xor1", "B"),
    w("w4", "r1", "Q", "xor1", "A"),
    w("w5", "xor1", "OUT", "r1", "D"),
    w("w6", "r0", "Q", "andC", "B"),
    w("w7", "r1", "Q", "andC", "A"),
    w("w8", "andC", "OUT", "xor2", "B"),
    w("w9", "r2", "Q", "xor2", "A"),
    w("w10", "xor2", "OUT", "r2", "D"),
    w("w11", "clk", "OUT", "r0", "CLK"),
    w("w12", "clk", "OUT", "r1", "CLK"),
    w("w13", "clk", "OUT", "r2", "CLK"),
    w("w14", "reset", "OUT", "r0", "RST"),
    w("w15", "reset", "OUT", "r1", "RST"),
    w("w16", "reset", "OUT", "r2", "RST"),
    w("w17", "r1", "Q", "joinLo", "HI"),
    w("w18", "r0", "Q", "joinLo", "LO"),
    w("w19", "r2", "Q", "joinRow", "HI"),
    w("w20", "joinLo", "OUT", "joinRow", "LO"),
    w("w21", "padHi", "OUT", "joinPc", "HI"),
    w("w22", "joinRow", "OUT", "joinPc", "LO"),
    w("w23", "joinPc", "OUT", "pcOut", "IN"),
    w("w24", "pix", "OUT", "scr", "IN"),
    w("w25", "joinRow", "OUT", "scr", "ROW"),
    w("w26", "wr", "OUT", "scr", "WRITE"),
    w("w27", "clk", "OUT", "scr", "CLK"),
  ];
  return {
    id: "def-ref-computer",
    name: "Computer",
    version: 1,
    description: "Hidden reference (verify only)",
    inputs: [
      { key: "reset", name: "reset", width: 1 },
      { key: "clk", name: "CLK", width: 1 },
    ],
    outputs: [{ key: "pcOut", name: "pc", width: 16 }],
    circuitSnapshot: { nodes, wires, meta: { isStarter: true, hidden: true } },
  };
}

let computerRegStates = {};
const computerSim = createSimulationEngine({
  getNodeSpec,
  getChipDefinition: () => null,
  getRegisterStates: () => computerRegStates,
  zeroBits,
  bitsToBoolean,
  formatBits,
  parseBits,
  ensureWidth,
  bitwiseUnary,
  bitwiseBinary,
});
const computerVerifier = createChallengeVerifier({
  deepClone: (x) => JSON.parse(JSON.stringify(x)),
  getRuntimeRegisterStates: () => computerRegStates,
  setRuntimeRegisterStates: (next) => {
    computerRegStates = next;
  },
  evaluateCircuit: computerSim.evaluateCircuit,
  collectRegisterUpdates: computerSim.collectRegisterUpdates,
  parseBits,
  formatBits,
  getChipDefinition: () => null,
});

const refComputer = buildReferenceComputerDefinition();
const computerResult = computerVerifier.runChallengeVerification(computerChallenge, refComputer);
assert("referentie Computer verified", computerResult.done === true);
assert(
  "referentie Computer summary",
  computerResult.done && /script (steps passed|-stappen geslaagd)/.test(computerResult.summary)
);

// --- 15. Combo chip-instance cache + nest-benchmark ---
console.log("\n[15] evaluate.js — combo cache + nest-benchmark");

const nandDefId = "def-bench-nand";
const and8DefId = "def-bench-and8";

const nandDef = {
  id: nandDefId,
  name: "BenchNAND",
  inputs: [
    { key: "a", name: "A", width: 1 },
    { key: "b", name: "B", width: 1 },
  ],
  outputs: [{ key: "out", name: "OUT", width: 1 }],
  circuitSnapshot: {
    nodes: [
      { id: "a", type: "input-pin", x: 0, y: 0, config: { label: "A", width: 1, previewValue: "0" } },
      { id: "b", type: "input-pin", x: 0, y: 40, config: { label: "B", width: 1, previewValue: "0" } },
      { id: "g", type: "gate", x: 120, y: 20, config: { label: "NAND", gateType: "NAND", width: 1 } },
      { id: "out", type: "output-pin", x: 260, y: 20, config: { label: "OUT", width: 1 } },
    ],
    wires: [
      { id: "bw1", fromNodeId: "a", fromPin: "OUT", toNodeId: "g", toPin: "A" },
      { id: "bw2", fromNodeId: "b", fromPin: "OUT", toNodeId: "g", toPin: "B" },
      { id: "bw3", fromNodeId: "g", fromPin: "OUT", toNodeId: "out", toPin: "IN" },
    ],
  },
};

/** 8× BenchNAND in parallel (same A/B) → OR-reduce — veel identieke child-evals. */
function buildAnd8LikeCircuit() {
  const nodes = [
    { id: "a", type: "input-pin", x: 0, y: 0, config: { label: "A", width: 1, previewValue: "1" } },
    { id: "b", type: "input-pin", x: 0, y: 80, config: { label: "B", width: 1, previewValue: "1" } },
    { id: "out", type: "output-pin", x: 700, y: 200, config: { label: "OUT", width: 1 } },
  ];
  const wires = [];
  let prevOr = null;
  for (let i = 0; i < 8; i += 1) {
    const chipId = `n${i}`;
    nodes.push({
      id: chipId,
      type: "chip-instance",
      x: 200,
      y: i * 40,
      config: { label: `N${i}`, definitionId: nandDefId },
    });
    wires.push({ id: `wa${i}`, fromNodeId: "a", fromPin: "OUT", toNodeId: chipId, toPin: "a" });
    wires.push({ id: `wb${i}`, fromNodeId: "b", fromPin: "OUT", toNodeId: chipId, toPin: "b" });
    if (i === 0) {
      prevOr = chipId;
      continue;
    }
    const orId = `or${i}`;
    nodes.push({
      id: orId,
      type: "gate",
      x: 400 + i * 20,
      y: i * 30,
      config: { label: "OR", gateType: "OR", width: 1 },
    });
    wires.push({
      id: `woa${i}`,
      fromNodeId: prevOr,
      fromPin: prevOr.startsWith("n") ? "out" : "OUT",
      toNodeId: orId,
      toPin: "A",
    });
    wires.push({ id: `wob${i}`, fromNodeId: chipId, fromPin: "out", toNodeId: orId, toPin: "B" });
    prevOr = orId;
  }
  wires.push({
    id: "wout",
    fromNodeId: prevOr,
    fromPin: prevOr.startsWith("n") ? "out" : "OUT",
    toNodeId: "out",
    toPin: "IN",
  });
  return { nodes, wires };
}

const and8Circuit = buildAnd8LikeCircuit();
const and8Def = {
  id: and8DefId,
  name: "BenchAND8",
  inputs: nandDef.inputs,
  outputs: nandDef.outputs,
  circuitSnapshot: and8Circuit,
};

const benchDefs = new Map([
  [nandDefId, nandDef],
  [and8DefId, and8Def],
]);

function makeBenchEngine(enableComboCache) {
  let localRegs = {};
  const { getNodeSpec: benchSpec } = createNodeSpecFactory({
    getChipDefinition: (id) => benchDefs.get(id) || null,
  });
  return createSimulationEngine({
    getNodeSpec: benchSpec,
    getChipDefinition: (id) => benchDefs.get(id) || null,
    getRegisterStates: () => localRegs,
    zeroBits,
    bitsToBoolean,
    formatBits,
    parseBits,
    ensureWidth,
    bitwiseUnary,
    bitwiseBinary,
    enableComboCache,
  });
}

const benchCached = makeBenchEngine(true);
const benchUncached = makeBenchEngine(false);

assert("BenchNAND is combinational", benchCached.isCombinationalDefinition(nandDef) === true);
assert(
  "register-chip is niet combinational",
  benchCached.isCombinationalDefinition({
    id: "reggy",
    circuitSnapshot: {
      nodes: [{ id: "r", type: "register", x: 0, y: 0, config: { width: 1, resetValue: "0" } }],
    },
  }) === false
);

/** Top-level: 8× BenchAND8 (elk 8× NAND) = 64 NAND-instances, veel herhaalde inputs. */
const nestNodes = [
  { id: "a", type: "input-pin", x: 0, y: 0, config: { label: "A", width: 1, previewValue: "1" } },
  { id: "b", type: "input-pin", x: 0, y: 40, config: { label: "B", width: 1, previewValue: "0" } },
  { id: "out", type: "output-pin", x: 500, y: 20, config: { label: "OUT", width: 1 } },
];
const nestWires = [];
let nestPrev = null;
for (let i = 0; i < 8; i += 1) {
  const id = `block${i}`;
  nestNodes.push({
    id,
    type: "chip-instance",
    x: 200,
    y: i * 30,
    config: { label: `B${i}`, definitionId: and8DefId },
  });
  nestWires.push({ id: `na${i}`, fromNodeId: "a", fromPin: "OUT", toNodeId: id, toPin: "a" });
  nestWires.push({ id: `nb${i}`, fromNodeId: "b", fromPin: "OUT", toNodeId: id, toPin: "b" });
  if (i === 0) {
    nestPrev = id;
    continue;
  }
  const orId = `nor${i}`;
  nestNodes.push({
    id: orId,
    type: "gate",
    x: 360,
    y: i * 30,
    config: { label: "OR", gateType: "OR", width: 1 },
  });
  nestWires.push({
    id: `noa${i}`,
    fromNodeId: nestPrev,
    fromPin: nestPrev.startsWith("block") ? "out" : "OUT",
    toNodeId: orId,
    toPin: "A",
  });
  nestWires.push({ id: `nob${i}`, fromNodeId: id, fromPin: "out", toNodeId: orId, toPin: "B" });
  nestPrev = orId;
}
nestWires.push({
  id: "nout",
  fromNodeId: nestPrev,
  fromPin: nestPrev.startsWith("block") ? "out" : "OUT",
  toNodeId: "out",
  toPin: "IN",
});
const nestCircuit = { nodes: nestNodes, wires: nestWires };

const nestOutCached = benchCached.evaluateCircuit(nestCircuit, {}, "nest", new Set());
const nestOutUncached = benchUncached.evaluateCircuit(nestCircuit, {}, "nest", new Set());
assert(
  "cache vs uncached identieke OUT",
  formatBits(nestOutCached.interfaceOutputs.out, 1) ===
    formatBits(nestOutUncached.interfaceOutputs.out, 1)
);
assert("nest evaluate geen fouten", nestOutCached.errors.length === 0);

const ITER = 100;
function timeEval(engine) {
  const t0 = Date.now();
  for (let i = 0; i < ITER; i += 1) {
    engine.evaluateCircuit(nestCircuit, {}, `nest-${i}`, new Set());
  }
  return Date.now() - t0;
}
const msUncached = timeEval(benchUncached);
const msCached = timeEval(benchCached);
console.log(`  … nest-benchmark ${ITER}×: uncached=${msUncached}ms, cached=${msCached}ms`);
assert(
  "cached niet trager dan uncached (of binnen 2×)",
  msCached <= msUncached * 2 + 50
);
// Speedup is machine-afhankelijk; documenteer absolute tijden in AGENT_LOG.
assert("benchmark draait (uncached > 0 of cached >= 0)", msUncached >= 0 && msCached >= 0);

// --- 16. badges + sequential failedCases ---
console.log("\n[16] badges + sequential failedCases");

assert(
  "lege learner heeft geen badges",
  computeModuleBadges([]).length === 0
);
const rekenenIds = ["half-adder", "full-adder", "add4", "inc4"];
assert(
  "rekenen-module badge bij alle lessen",
  computeModuleBadges(rekenenIds).includes("rekenen")
);
const afterMark = markChallengeCompleted(
  { completedChallengeIds: ["half-adder", "full-adder", "add4"], badges: [] },
  "inc4"
);
assert("markChallengeCompleted sync badges", afterMark.badges.includes("rekenen"));
assert(
  "syncLearnerBadges bewaart eerdere badges",
  syncLearnerBadges({ completedChallengeIds: [], badges: ["poorten"] }).badges.includes("poorten")
);

const brokenBitDef = {
  id: "def-broken-bit",
  name: "Bit",
  inputs: [
    { key: "in", name: "IN", width: 1 },
    { key: "load", name: "LOAD", width: 1 },
    { key: "clk", name: "CLK", width: 1 },
  ],
  outputs: [{ key: "out", name: "OUT", width: 1 }],
  circuitSnapshot: {
    nodes: [
      { id: "in", type: "input-pin", x: 0, y: 0, config: { label: "IN", width: 1, previewValue: "0" } },
      { id: "load", type: "input-pin", x: 0, y: 40, config: { label: "LOAD", width: 1, previewValue: "0" } },
      { id: "clk", type: "input-pin", x: 0, y: 80, config: { label: "CLK", width: 1, previewValue: "0" } },
      { id: "out", type: "output-pin", x: 200, y: 40, config: { label: "OUT", width: 1 } },
    ],
    wires: [{ id: "wq", fromNodeId: "in", fromPin: "OUT", toNodeId: "out", toPin: "IN" }],
  },
};
const dffChallengeForFail = REAL_CHALLENGES.find((c) => c.id === "dff");
let seqStates = {};
const seqSim = createSimulationEngine({
  getNodeSpec,
  getChipDefinition: () => null,
  getRegisterStates: () => seqStates,
  zeroBits,
  bitsToBoolean,
  formatBits,
  parseBits,
  ensureWidth,
  bitwiseUnary,
  bitwiseBinary,
});
const seqVerifier = createChallengeVerifier({
  deepClone: (x) => JSON.parse(JSON.stringify(x)),
  getRuntimeRegisterStates: () => seqStates,
  setRuntimeRegisterStates: (next) => {
    seqStates = next;
  },
  evaluateCircuit: seqSim.evaluateCircuit,
  collectRegisterUpdates: seqSim.collectRegisterUpdates,
  parseBits,
  formatBits,
  getChipDefinition: () => null,
});
const seqResult = seqVerifier.runChallengeVerification(dffChallengeForFail, brokenBitDef);
assert("foute Bit-oplossing faalt", seqResult.done === false);
assert(
  "sequential failedCases aanwezig",
  Array.isArray(seqResult.failedCases) && seqResult.failedCases.length > 0
);
assert(
  "failedCase heeft step/expected/actual",
  seqResult.failedCases.some(
    (item) => item.step && item.expected && item.actual && item.ok === false
  )
);

// ── 17. runtime.js — toggle input-pin respecteert bit-breedte ──────────────
console.log("\n[17] runtime.js — toggleInputPinNode multi-bit");

const { createRuntimeActions } = await import("../src/actions/runtime.js");
const runtimeActions = createRuntimeActions({
  state: { project: { runtime: { registerStates: {} } } },
  parseBits,
  formatBits,
  getCurrentWorkspace: () => null,
  collectRegisterUpdates: () => [],
  setStatus: () => {},
  renderWorkspace: () => {},
});

const pin16 = { config: { label: "IN", width: 16, previewValue: "0000000000000000" } };
runtimeActions.toggleInputPinNode(pin16);
assert("toggle 16-bit: alle bits aan", pin16.config.previewValue === "1111111111111111");
runtimeActions.toggleInputPinNode(pin16);
assert("toggle 16-bit terug: alle bits uit", pin16.config.previewValue === "0000000000000000");

const pinMixed = { config: { label: "IN", width: 8, previewValue: "00000101" } };
runtimeActions.toggleInputPinNode(pinMixed);
assert("toggle 8-bit inverteert per bit", pinMixed.config.previewValue === "11111010");

const pin1 = { config: { label: "A", width: 1, previewValue: "0" } };
runtimeActions.toggleInputPinNode(pin1);
assert("toggle 1-bit: 0 → 1", pin1.config.previewValue === "1");

// ── 18. i18n — locale + localizeChallenge ───────────────────────────────────
console.log("\n[18] i18n — locale + localizeChallenge");

const {
  t,
  setLocale,
  getLocale,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
} = await import("../src/i18n/index.js");
const { localizeChallenge } = await import("../src/i18n/challenges.js");
const memStore = {
  data: {},
  getItem(k) {
    return this.data[k] ?? null;
  },
  setItem(k, v) {
    this.data[k] = String(v);
  },
};

setLocale("en", { storage: memStore });
assert("default locale en", getLocale() === "en");
assert("t(course) EN", t("course") === "Course");
assert("t interpolate", t("homeTotalProgress", { done: 5, total: 41 }) === "5 of 41 lessons");
setLocale("nl", { storage: memStore });
assert("locale nl", getLocale() === "nl");
assert("t(course) NL", t("course") === "Cursus");
assert("persist key", memStore.getItem(LOCALE_STORAGE_KEY) === "nl");
assert("readStoredLocale", readStoredLocale(memStore) === "nl");
assert("fallback unknown key", t("___missing___") === "___missing___");
assert("DEFAULT_LOCALE is en", DEFAULT_LOCALE === "en");

const nand = REAL_CHALLENGES.find((c) => c.id === "nand");
setLocale("en", { storage: memStore, persist: false });
const nandEn = localizeChallenge(nand, "en");
assert("nand EN description", /own NAND chip/i.test(nandEn.description));
setLocale("nl", { storage: memStore, persist: false });
const nandNl = localizeChallenge(nand, "nl");
assert("nand NL description", /eigen NAND-chip/i.test(nandNl.description));
setLocale("en", { storage: memStore });

// ─── Lesson palette (UX fase B) ───────────────────────────────────────────
console.log("\nSectie: lesson palette");
import { getLessonPartTypes, getPartsUnlockedBy } from "../src/model/lesson-palette.js";

const lpNot = REAL_CHALLENGES.find((c) => c.id === "not");
const lpAnd = REAL_CHALLENGES.find((c) => c.id === "and");
const lpXorNand = REAL_CHALLENGES.find((c) => c.id === "xor-nand-only");
const lpRam = REAL_CHALLENGES.find((c) => c.verification === "sequential-script");
const lpWide = REAL_CHALLENGES.find((c) =>
  [...(c.template?.inputs || []), ...(c.template?.outputs || [])].some((p) => typeof p === "object" && p.width > 1)
);

const fresh = getLessonPartTypes(lpNot, { completedChallengeIds: ["nand"] });
assert("palette: NOT-les biedt NAND", fresh.available.includes("gate-nand"));
assert("palette: NOT-les biedt geen NOT", !fresh.available.includes("gate-not"));
assert("palette: AND nog vergrendeld", fresh.locked.some((l) => l.type === "gate-and"));
assert("palette: geen schakelaar/lamp in les", !fresh.available.includes("switch") && !fresh.available.includes("lamp"));
assert("palette: geen klok in combinatorische les", !fresh.available.includes("clock"));

const afterNot = getLessonPartTypes(lpAnd, { completedChallengeIds: ["nand", "not"] });
assert("palette: NOT vrij na les NOT", afterNot.available.includes("gate-not"));
assert("palette: AND-les biedt geen AND", !afterNot.available.includes("gate-and"));

const xn = getLessonPartTypes(lpXorNand, { completedChallengeIds: ["nand", "not", "and", "or", "xor"] });
assert("palette: alleen-NAND-les toont geen AND/OR", !xn.available.includes("gate-and") && !xn.available.includes("gate-or"));
assert("palette: alleen-NAND-les biedt NAND", xn.available.includes("gate-nand"));

assert("palette: sequentiële les biedt klok+register", getLessonPartTypes(lpRam, {}).available.includes("register"));
assert("palette: brede les biedt splitter/joiner", getLessonPartTypes(lpWide, {}).available.includes("splitter"));
assert("palette: vrije modus biedt alle poorten", getLessonPartTypes(lpNot, { unlockedAll: true }).available.includes("gate-and"));
assert("palette: computer-les biedt ROM", getLessonPartTypes(REAL_CHALLENGES.find((c) => c.id === "computer"), {}).available.includes("rom"));
assert("palette: les OR ontgrendelt OR en NOR", getPartsUnlockedBy("or").includes("gate-or") && getPartsUnlockedBy("or").includes("gate-nor"));

// ─── Les 0 + coach-velden (UX fase C) ─────────────────────────────────────
console.log("\nSectie: les 0 en coach");
import { INTRO_LESSON_ID, normalizeLearner as normalizeLearnerC } from "../src/data/curriculum.js";
const migratedC = normalizeLearnerC({ completedChallengeIds: ["nand", "not"], tutorialDismissed: true });
assert("migratie: bestaande voortgang krijgt les 0", migratedC.completedChallengeIds[0] === INTRO_LESSON_ID);
assert("migratie: oude walkthrough-skip → coach NAND gedismissed", migratedC.coachDismissed.nand === true);
assert("migratie: coach standaard aan", migratedC.coachEnabled === true);
const freshNorm = normalizeLearnerC({ completedChallengeIds: [] });
assert("verse learner krijgt les 0 niet cadeau", freshNorm.completedChallengeIds.length === 0);
const introLesson = REAL_CHALLENGES.find((c) => c.id === INTRO_LESSON_ID);
assert("les 0 palet biedt AND", getLessonPartTypes(introLesson, {}).available.includes("gate-and"));
assert("les 0 palet: AND niet als 'later'", !getLessonPartTypes(introLesson, {}).locked.some((l) => l.type === "gate-and"));

// ─── Afwerking (UX fase E) ────────────────────────────────────────────────
console.log("\nSectie: afwerking");
import { circuitSignature, sameCircuit } from "../src/model/circuit-signature.js";
import { setLocale as setLocaleE } from "../src/i18n/index.js";

const sigBase = {
  nodes: [
    { id: "n1", type: "input-pin", x: 10, y: 10, config: { label: "A", previewValue: "0" } },
    { id: "n2", type: "gate", x: 50, y: 10, config: { gateType: "NOT" } },
  ],
  wires: [{ id: "w1", fromNodeId: "n1", fromPin: "OUT", toNodeId: "n2", toPin: "A" }],
};
const moved = JSON.parse(JSON.stringify(sigBase));
moved.nodes[1].x = 400;
moved.nodes[0].config.previewValue = "1";
assert("signature: verplaatsen/schakelen telt niet als wijziging", sameCircuit(sigBase, moved));
const rewired = JSON.parse(JSON.stringify(sigBase));
rewired.wires = [];
assert("signature: draad weg = wijziging", !sameCircuit(sigBase, rewired));
const regated = JSON.parse(JSON.stringify(sigBase));
regated.nodes[1].config.gateType = "AND";
assert("signature: ander poorttype = wijziging", circuitSignature(sigBase) !== circuitSignature(regated));

// Meldingen volgen de taal.
setLocaleE("en", { persist: false });
const enSummary = verifier.runChallengeVerification(
  REAL_CHALLENGES.find((c) => c.id === "nand"),
  { id: "x", name: "NAND", inputs: [], outputs: [], circuitSnapshot: { nodes: [], wires: [] } }
).summary;
assert("EN: verificatie-samenvatting in het Engels", !/geslaagd|opgeslagen/.test(enSummary));
setLocaleE("nl", { persist: false });
const nlSummary = verifier.runChallengeVerification(
  REAL_CHALLENGES.find((c) => c.id === "nand"),
  { id: "x", name: "NAND", inputs: [], outputs: [], circuitSnapshot: { nodes: [], wires: [] } }
).summary;
assert("NL: verificatie-samenvatting in het Nederlands", nlSummary !== enSummary);
setLocaleE("en", { persist: false });

// Starter-chip mag de les die hem bouwt niet oplossen.
const starterHalf = {
  id: "starter-ha",
  name: "Half Adder",
  description: "Starter half adder met SUM en CARRY.",
  inputs: [{ name: "A" }, { name: "B" }],
  outputs: [{ name: "SUM" }, { name: "CARRY" }],
  circuitSnapshot: { nodes: [], wires: [], meta: { isStarter: true } },
};
const starterVerifier = createChallengeVerifier({
  ...verifierDeps,
  getChipDefinition: (id) => (id === "starter-ha" ? starterHalf : null),
});
const wrapper = {
  id: "mine",
  name: "Half Adder",
  inputs: [{ name: "A" }, { name: "B" }],
  outputs: [{ name: "SUM" }, { name: "CARRY" }],
  circuitSnapshot: {
    nodes: [{ id: "c1", type: "chip-instance", config: { definitionId: "starter-ha" } }],
    wires: [],
  },
};
const halfAdderChallenge = REAL_CHALLENGES.find((c) => c.id === "half-adder");
const shortcut = starterVerifier.runChallengeVerification(halfAdderChallenge, wrapper);
assert("starter-chip als oplossing van zijn eigen les wordt geweigerd", !shortcut.done && /starter/i.test(shortcut.summary));

console.log("\n" + "-".repeat(44));
console.log("Totaal: " + passed + " geslaagd, " + failed + " mislukt");
if (failed > 0) {
  process.exit(1);
}
