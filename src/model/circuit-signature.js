/**
 * Signature of a circuit's logic: which nodes exist (type + configuration) and how they are
 * wired. Ignores layout (x/y) and live state (input toggles), so moving a node or flipping a
 * switch doesn't count as a change. Used to avoid a new chip version for an unchanged circuit.
 */

const VOLATILE_CONFIG_KEYS = new Set(["previewValue"]);

function stableConfig(config) {
  if (!config || typeof config !== "object") {
    return {};
  }
  return Object.keys(config)
    .filter((key) => !VOLATILE_CONFIG_KEYS.has(key))
    .sort()
    .reduce((acc, key) => {
      acc[key] = config[key];
      return acc;
    }, {});
}

/** @param {{nodes?: object[], wires?: object[]}} circuit */
export function circuitSignature(circuit) {
  const nodes = (circuit?.nodes || [])
    .map((node) => [node.id, node.type, stableConfig(node.config)])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const wires = (circuit?.wires || [])
    .map((wire) => [wire.fromNodeId, wire.fromPin, wire.toNodeId, wire.toPin])
    .sort((a, b) => a.join("|").localeCompare(b.join("|")));
  return JSON.stringify({ nodes, wires });
}

export function sameCircuit(left, right) {
  return circuitSignature(left) === circuitSignature(right);
}
