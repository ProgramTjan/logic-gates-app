import { t } from "../i18n/index.js";
export function createSimulationEngine(deps) {
  const {
    getNodeSpec,
    getChipDefinition,
    getRegisterStates,
    zeroBits,
    bitsToBoolean,
    formatBits,
    parseBits,
    ensureWidth,
    bitwiseUnary,
    bitwiseBinary,
  } = deps;

  /** When false, skip combo chip-instance memoization (for benchmarks). Default true. */
  const enableComboCache = deps.enableComboCache !== false;

  /** WeakMap<definition, boolean> — definitions are immutable snapshots. */
  const combinationalMemo = new WeakMap();

  function makeRegisterStateKey(path, nodeId) {
    return `${path}/register:${nodeId}`;
  }

  function serializeChildInputs(childInputs) {
    return Object.keys(childInputs || {})
      .sort()
      .map((key) => `${key}:${formatBits(childInputs[key])}`)
      .join("|");
  }

  /**
   * True iff the chip has no register/screen state (and no nested sequential chips).
   * Safe to memoize evaluateCircuit results by inputs alone.
   */
  function isCombinationalDefinition(definition, visiting = new Set()) {
    if (!definition) {
      return false;
    }
    if (combinationalMemo.has(definition)) {
      return combinationalMemo.get(definition);
    }
    if (visiting.has(definition.id)) {
      return true;
    }
    visiting.add(definition.id);
    let combo = true;
    const nodes = definition.circuitSnapshot && definition.circuitSnapshot.nodes;
    if (Array.isArray(nodes)) {
      for (const node of nodes) {
        if (node.type === "register" || node.type === "screen") {
          combo = false;
          break;
        }
        if (node.type === "chip-instance") {
          const child = getChipDefinition(node.config.definitionId);
          if (child && !isCombinationalDefinition(child, visiting)) {
            combo = false;
            break;
          }
        }
      }
    }
    visiting.delete(definition.id);
    combinationalMemo.set(definition, combo);
    return combo;
  }

  function evaluateGate(gateType, inputs, width) {
    const a = ensureWidth(inputs.A, width);
    const b = ensureWidth(inputs.B, width);
    switch (gateType) {
      case "NOT":
        return bitwiseUnary(a, (bit) => !bit);
      case "AND":
        return bitwiseBinary(a, b, (left, right) => left && right);
      case "OR":
        return bitwiseBinary(a, b, (left, right) => left || right);
      case "XOR":
        return bitwiseBinary(a, b, (left, right) => left !== right);
      case "NAND":
        return bitwiseUnary(bitwiseBinary(a, b, (left, right) => left && right), (bit) => !bit);
      case "NOR":
        return bitwiseUnary(bitwiseBinary(a, b, (left, right) => left || right), (bit) => !bit);
      default:
        return zeroBits(width);
    }
  }

  function dedupeErrors(errors) {
    const seen = new Set();
    return errors.filter((error) => {
      const key = `${error.message}|${(error.nodeIds || []).join(",")}|${(error.wireIds || []).join(",")}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function makeZeroOutputs(outputs) {
    const values = {};
    outputs.forEach((pin) => {
      values[pin.key] = zeroBits(pin.width);
    });
    return values;
  }

  function evaluateWorkspace(workspace) {
    return evaluateCircuit(workspace, {}, `workspace:${workspace.id}`, new Set());
  }

  function evaluateCircuit(circuit, externalInputs, path, recursionTrail, comboCache) {
    const sharedComboCache = comboCache || (enableComboCache ? new Map() : null);
    const nodeMap = new Map(circuit.nodes.map((node) => [node.id, node]));
    const incomingWireByPin = new Map();
    const errors = [];
    const nodeSignals = {};
    const wireSignals = {};

    circuit.wires.forEach((wire) => {
      const sourceNode = nodeMap.get(wire.fromNodeId);
      const targetNode = nodeMap.get(wire.toNodeId);
      if (!sourceNode || !targetNode) {
        errors.push({
          message: t("sim.missingNode"),
          wireIds: [wire.id],
          nodeIds: [wire.fromNodeId, wire.toNodeId].filter(Boolean),
        });
        wireSignals[wire.id] = { invalid: true, high: false };
        return;
      }
      const sourcePin = getNodeSpec(sourceNode).outputs.find((pin) => pin.key === wire.fromPin);
      const targetPin = getNodeSpec(targetNode).inputs.find((pin) => pin.key === wire.toPin);
      if (!sourcePin || !targetPin) {
        errors.push({
          message: t("sim.invalidPin"),
          wireIds: [wire.id],
          nodeIds: [wire.fromNodeId, wire.toNodeId],
        });
        wireSignals[wire.id] = { invalid: true, high: false };
        return;
      }
      if (sourcePin.width !== targetPin.width) {
        errors.push({
          message: t("sim.widthMismatch", {
            from: sourceNode.config.label || sourceNode.type,
            to: targetNode.config.label || targetNode.type,
          }),
          wireIds: [wire.id],
          nodeIds: [wire.fromNodeId, wire.toNodeId],
        });
        wireSignals[wire.id] = { invalid: true, high: false };
      }
      const inputKey = `${wire.toNodeId}:${wire.toPin}`;
      if (incomingWireByPin.has(inputKey)) {
        errors.push({
          message: t("sim.multipleDrivers", { pin: wire.toPin, node: targetNode.config.label || targetNode.type }),
          wireIds: [wire.id, incomingWireByPin.get(inputKey).id],
          nodeIds: [wire.toNodeId],
        });
        wireSignals[wire.id] = { invalid: true, high: false };
      } else {
        incomingWireByPin.set(inputKey, wire);
      }
    });

    const nodeOutputCache = new Map();
    const resolvingNodes = new Set();

    function resolveInputValue(node, pin) {
      const cache = nodeSignals[node.id] || { inputs: {}, outputs: {} };
      nodeSignals[node.id] = cache;
      if (cache.inputs[pin.key]) {
        return cache.inputs[pin.key];
      }

      const incoming = incomingWireByPin.get(`${node.id}:${pin.key}`);
      if (!incoming) {
        const fallback = zeroBits(pin.width);
        cache.inputs[pin.key] = fallback;
        return fallback;
      }

      const sourceOutputs = resolveNodeOutputs(incoming.fromNodeId);
      const resolved = ensureWidth(sourceOutputs[incoming.fromPin], pin.width);
      cache.inputs[pin.key] = resolved;
      wireSignals[incoming.id] = { invalid: false, high: bitsToBoolean(resolved) || /1/.test(formatBits(resolved)) };
      return resolved;
    }

    function resolveNodeOutputs(nodeId) {
      if (nodeOutputCache.has(nodeId)) {
        return nodeOutputCache.get(nodeId);
      }
      const node = nodeMap.get(nodeId);
      const spec = getNodeSpec(node);
      const signalEntry = nodeSignals[nodeId] || { inputs: {}, outputs: {} };
      nodeSignals[nodeId] = signalEntry;

      if (!node) {
        return {};
      }

      if (resolvingNodes.has(nodeId) && node.type !== "register") {
        errors.push({
          message: t("sim.loop", { node: node.config.label || node.type }),
          nodeIds: [nodeId],
        });
        const safeOutputs = makeZeroOutputs(spec.outputs);
        nodeOutputCache.set(nodeId, safeOutputs);
        return safeOutputs;
      }

      resolvingNodes.add(nodeId);
      const inputValues = {};
      spec.inputs.forEach((pin) => {
        inputValues[pin.key] = resolveInputValue(node, pin);
      });
      signalEntry.inputs = inputValues;

      let outputs = {};
      if (node.type === "switch") {
        outputs.OUT = parseBits(node.config.value, node.config.width);
      } else if (node.type === "lamp") {
        outputs = {};
      } else if (node.type === "gate") {
        outputs.OUT = evaluateGate(node.config.gateType, inputValues, node.config.width);
      } else if (node.type === "input-pin") {
        const sourceBits =
          externalInputs && externalInputs[node.id]
            ? ensureWidth(externalInputs[node.id], node.config.width)
            : parseBits(node.config.previewValue, node.config.width);
        outputs.OUT = sourceBits;
      } else if (node.type === "output-pin") {
        outputs = {};
      } else if (node.type === "clock") {
        outputs.OUT = parseBits(node.config.value, 1);
      } else if (node.type === "register") {
        const registerKey = makeRegisterStateKey(path, node.id);
        const registerStates = getRegisterStates();
        const stored = registerStates[registerKey];
        outputs.Q = stored
          ? ensureWidth(stored.bits, node.config.width)
          : parseBits(node.config.resetValue, node.config.width);
      } else if (node.type === "rom") {
        const addressWidth = Math.max(1, Math.min(8, Number(node.config.addressWidth) || 4));
        const addrBits = ensureWidth(inputValues.ADDR || zeroBits(addressWidth), addressWidth);
        let address = 0;
        for (let i = 0; i < addressWidth; i += 1) {
          address = (address << 1) | (addrBits[i] ? 1 : 0);
        }
        const program = Array.isArray(node.config.program) ? node.config.program : [];
        const word = program[address] != null ? program[address] : "0".repeat(16);
        outputs.OUT = parseBits(word, 16);
      } else if (node.type === "screen") {
        outputs = {};
      } else if (node.type === "keyboard") {
        outputs.OUT = parseBits(node.config.keyCode || "0".repeat(16), 16);
      } else if (node.type === "splitter") {
        const sourceBits = ensureWidth(inputValues.IN, node.config.width);
        outputs.HI = sourceBits.slice(0, node.config.highWidth);
        outputs.LO = sourceBits.slice(node.config.highWidth);
      } else if (node.type === "joiner") {
        const highBits = ensureWidth(inputValues.HI, node.config.highWidth);
        const lowBits = ensureWidth(inputValues.LO, node.config.width - node.config.highWidth);
        outputs.OUT = [...highBits, ...lowBits];
      } else if (node.type === "chip-instance") {
        const definition = getChipDefinition(node.config.definitionId);
        if (!definition) {
          errors.push({
            message: t("sim.missingDefinition", { node: node.config.label || node.type }),
            nodeIds: [node.id],
          });
          outputs = makeZeroOutputs(spec.outputs);
        } else if (recursionTrail.has(definition.id)) {
          errors.push({
            message: t("sim.recursive", { name: definition.name }),
            nodeIds: [node.id],
          });
          outputs = makeZeroOutputs(spec.outputs);
        } else {
          const childInputs = {};
          spec.inputs.forEach((pin) => {
            childInputs[pin.key] = ensureWidth(inputValues[pin.key], pin.width);
          });
          const canCache = sharedComboCache && isCombinationalDefinition(definition);
          const cacheKey = canCache
            ? `${definition.id}::${serializeChildInputs(childInputs)}`
            : null;
          if (cacheKey && sharedComboCache.has(cacheKey)) {
            const cached = sharedComboCache.get(cacheKey);
            outputs = {};
            Object.keys(cached).forEach((key) => {
              outputs[key] = Array.isArray(cached[key]) ? cached[key].slice() : cached[key];
            });
          } else {
            const childEvaluation = evaluateCircuit(
              definition.circuitSnapshot,
              childInputs,
              `${path}/${node.id}`,
              new Set([...recursionTrail, definition.id]),
              sharedComboCache
            );
            childEvaluation.errors.forEach((error) => {
              errors.push(error);
            });
            outputs = {};
            spec.outputs.forEach((pin) => {
              outputs[pin.key] = ensureWidth(childEvaluation.interfaceOutputs[pin.key], pin.width);
            });
            if (cacheKey) {
              const stored = {};
              Object.keys(outputs).forEach((key) => {
                stored[key] = Array.isArray(outputs[key]) ? outputs[key].slice() : outputs[key];
              });
              sharedComboCache.set(cacheKey, stored);
            }
          }
        }
      }

      signalEntry.outputs = outputs;
      nodeOutputCache.set(nodeId, outputs);
      resolvingNodes.delete(nodeId);
      return outputs;
    }

    circuit.nodes.forEach((node) => {
      resolveNodeOutputs(node.id);
    });

    const interfaceOutputs = {};
    circuit.nodes.forEach((node) => {
      const spec = getNodeSpec(node);
      if (node.type === "output-pin") {
        interfaceOutputs[node.id] = ensureWidth(
          nodeSignals[node.id] && nodeSignals[node.id].inputs
            ? nodeSignals[node.id].inputs.IN
            : zeroBits(node.config.width),
          node.config.width
        );
      }
      spec.inputs.forEach((pin) => {
        if (!nodeSignals[node.id].inputs[pin.key]) {
          nodeSignals[node.id].inputs[pin.key] = resolveInputValue(node, pin);
        }
      });
      spec.outputs.forEach((pin) => {
        if (!nodeSignals[node.id].outputs[pin.key]) {
          nodeSignals[node.id].outputs[pin.key] = ensureWidth(
            resolveNodeOutputs(node.id)[pin.key],
            pin.width
          );
        }
      });
    });

    circuit.wires.forEach((wire) => {
      if (wireSignals[wire.id]) {
        return;
      }
      const sourceOutputs = nodeSignals[wire.fromNodeId] ? nodeSignals[wire.fromNodeId].outputs : null;
      const bits = sourceOutputs ? sourceOutputs[wire.fromPin] : zeroBits(1);
      wireSignals[wire.id] = { invalid: false, high: bitsToBoolean(bits) || /1/.test(formatBits(bits)) };
    });

    return {
      nodeSignals,
      wireSignals,
      errors: dedupeErrors(errors),
      interfaceOutputs,
    };
  }

  function collectRegisterUpdates(circuit, externalInputs, path, recursionTrail) {
    const evaluation = evaluateCircuit(circuit, externalInputs, path, recursionTrail);
    const registerStates = getRegisterStates();
    const updates = [];
    circuit.nodes.forEach((node) => {
      if (node.type === "register") {
        const nodeInputs = evaluation.nodeSignals[node.id] ? evaluation.nodeSignals[node.id].inputs : {};
        const clockHigh = bitsToBoolean(nodeInputs.CLK || zeroBits(1));
        const resetHigh = bitsToBoolean(nodeInputs.RST || zeroBits(1));
        const storedKey = makeRegisterStateKey(path, node.id);
        const currentBits = registerStates[storedKey]
          ? ensureWidth(registerStates[storedKey].bits, node.config.width)
          : parseBits(node.config.resetValue, node.config.width);
        let nextBits = currentBits;
        if (resetHigh) {
          nextBits = parseBits(node.config.resetValue, node.config.width);
        } else if (clockHigh) {
          nextBits = ensureWidth(nodeInputs.D || zeroBits(node.config.width), node.config.width);
        }
        updates.push({ key: storedKey, bits: nextBits });
      }

      if (node.type === "screen") {
        const cols = 8;
        const rows = 8;
        const nodeInputs = evaluation.nodeSignals[node.id] ? evaluation.nodeSignals[node.id].inputs : {};
        const baseKey = makeRegisterStateKey(path, node.id);
        const clockHigh = bitsToBoolean(nodeInputs.CLK || zeroBits(1));
        const writeHigh = bitsToBoolean(nodeInputs.WRITE || zeroBits(1));
        let writeRow = -1;
        let pixelRow = null;
        if (clockHigh && writeHigh) {
          const rowBits = ensureWidth(nodeInputs.ROW || zeroBits(3), 3);
          writeRow = 0;
          for (let i = 0; i < 3; i += 1) {
            writeRow = (writeRow << 1) | (rowBits[i] ? 1 : 0);
          }
          writeRow = Math.min(rows - 1, Math.max(0, writeRow));
          const inBits = ensureWidth(nodeInputs.IN || zeroBits(16), 16);
          pixelRow = inBits.slice(8);
        }
        for (let row = 0; row < rows; row += 1) {
          const storedKey = `${baseKey}:row${row}`;
          const currentBits = registerStates[storedKey]
            ? ensureWidth(registerStates[storedKey].bits, cols)
            : zeroBits(cols);
          const nextBits =
            writeRow === row && pixelRow
              ? pixelRow.map((bit) => Boolean(bit))
              : currentBits.slice();
          updates.push({ key: storedKey, bits: nextBits });
        }
      }

      if (node.type === "chip-instance") {
        const definition = getChipDefinition(node.config.definitionId);
        if (!definition || recursionTrail.has(definition.id)) {
          return;
        }
        const childInputs = {};
        const spec = getNodeSpec(node);
        spec.inputs.forEach((pin) => {
          childInputs[pin.key] = evaluation.nodeSignals[node.id]
            ? ensureWidth(evaluation.nodeSignals[node.id].inputs[pin.key], pin.width)
            : zeroBits(pin.width);
        });
        updates.push(
          ...collectRegisterUpdates(
            definition.circuitSnapshot,
            childInputs,
            `${path}/${node.id}`,
            new Set([...recursionTrail, definition.id])
          )
        );
      }
    });
    return updates;
  }

  return {
    evaluateWorkspace,
    evaluateCircuit,
    collectRegisterUpdates,
    makeRegisterStateKey,
    isCombinationalDefinition,
  };
}
