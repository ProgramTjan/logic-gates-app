/**
 * scripts/verify.js — Node.js test harness (geen browser vereist)
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

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// ── 1. bits.js ────────────────────────────────────────────────────────────────
console.log("\n[1] bits.js");

assert('parseBits("1", 1) → [true]', parseBits("1", 1)[0] === true);
assert('parseBits("0", 1) → [false]', parseBits("0", 1)[0] === false);
assert('parseBits("10", 2) = [true,false]', parseBits("10", 2)[0] === true && parseBits("10", 2)[1] === false);
assert('formatBits([true,false], 2) → "10"', formatBits([true, false], 2) === "10");
assert('formatBits([false], 1) → "0"', formatBits([false], 1) === "0");
assert(
  "bitwiseBinary AND [1,0]&[1,1] → [true,false]",
  (() => {
    const r = bitwiseBinary([true, false], [true, true], (a, b) => a && b);
    return r[0] === true && r[1] === false;
  })()
);
assert("bitsToBoolean([true]) → true", bitsToBoolean([true]) === true);
assert("bitsToBoolean([false]) → false", bitsToBoolean([false]) === false);
assert(
  "zeroBits(3) → [false,false,false]",
  zeroBits(3).every((b) => b === false) && zeroBits(3).length === 3
);
assert(
  "ensureWidth([true], 3) pads to length 3",
  ensureWidth([true], 3).length === 3
);

// ── 2. evaluate.js ────────────────────────────────────────────────────────────
console.log("\n[2] evaluate.js — AND-circuit fixture");

function getNodeSpec(node) {
  if (!node) return { inputs: [], outputs: [] };
  if (node.type === "input-pin")
    return { inputs: [], outputs: [{ key: "OUT", width: node.config.width || 1 }] };
  if (node.type === "output-pin")
    return { inputs: [{ key: "IN", width: node.config.width || 1 }], outputs: [] };
  if (node.type === "gate" && node.config.gateType === "AND")
    return {
      inputs: [
        { key: "A", width: node.config.width || 1 },
        { key: "B", width: node.config.width || 1 },
      ],
      outputs: [{ key: "OUT", width: node.config.width || 1 }],
    };
  if (node.type === "gate" && node.config.gateType === "NOT")
    return {
      inputs: [{ key: "A", width: node.config.width || 1 }],
      outputs: [{ key: "OUT", width: node.config.width || 1 }],
    };
  return { inputs: [], outputs: [] };
}

const sim = createSimulationEngine({
  getNodeSpec,
  getChipDefinition: () => null,
  getRegisterStates: () => ({}),
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
assert("AND(0,0) → w3.high=false", r00.wireSignals["w3"].high === false);
assert("AND(0,0) → geen fouten", r00.errors.length === 0);

const r11 = sim.evaluateCircuit(andCircuit, { inA: parseBits("1", 1), inB: parseBits("1", 1) }, "test", new Set());
assert("AND(1,1) → w3.high=true", r11.wireSignals["w3"].high === true);

const r10 = sim.evaluateCircuit(andCircuit, { inA: parseBits("1", 1), inB: parseBits("0", 1) }, "test", new Set());
assert("AND(1,0) → w3.high=false", r10.wireSignals["w3"].high === false);

const r01 = sim.evaluateCircuit(andCircuit, { inA: parseBits("0", 1), inB: parseBits("1", 1) }, "test", new Set());
assert("AND(0,1) → w3.high=false", r01.wireSignals["w3"].high === false);

// ── 3. verification.js ────────────────────────────────────────────────────────
console.log("\n[3] verification.js — NAND challenge fixture");

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

let registerStates = {};
const verifier = createChallengeVerifier({
  deepClone: (x) => JSON.parse(JSON.stringify(x)),
  parseBits,
  formatBits,
  evaluateCircuit: (circuit, inputs, path, trail) =>
    sim.evaluateCircuit(circuit, inputs, path, trail),
  collectRegisterUpdates: (circuit, inputs, path, trail) =>
    sim.collectRegisterUpdates(circuit, inputs, path, trail),
  getRuntimeRegisterStates: () => registerStates,
  setRuntimeRegisterStates: (next) => {
    registerStates = next;
  },
});

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

// ── Samenvatting ──────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(44)}`);
console.log(`Totaal: ${passed} geslaagd, ${failed} mislukt`);
if (failed > 0) {
  process.exit(1);
}
