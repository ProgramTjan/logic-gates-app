export function createChipDefinitionsService(deps) {
  function ensureStarterChips(project) {
    ensureStarterChip(project, "NAND", buildStarterNandDefinition);
    ensureStarterChip(project, "Half Adder", buildStarterHalfAdderDefinition);
    ensureStarterChip(project, "Full Adder", buildStarterFullAdderDefinition);
  }

  function ensureStarterChip(project, seriesName, factory) {
    const existingSeries = project.chipSeries.find(
      (series) => series.name.toLowerCase() === seriesName.toLowerCase()
    );
    if (existingSeries && existingSeries.definitionIds.length) {
      return getLatestChipDefinitionForProject(project, existingSeries.id);
    }
    return factory(project, existingSeries || null);
  }

  function getLatestChipDefinitionForProject(project, seriesId) {
    const series = project.chipSeries.find((entry) => entry.id === seriesId);
    if (!series) {
      return null;
    }
    return (
      series.definitionIds
        .map((definitionId) => project.chipDefinitions.find((definition) => definition.id === definitionId))
        .filter(Boolean)
        .sort((left, right) => right.version - left.version)[0] || null
    );
  }

  function buildStarterNandDefinition(project, existingSeries) {
    const workspace = deps.createWorkspace(project, "NAND Starter", null, { isStarter: true });
    const inputA = createConfiguredNode(project, "input-pin", { x: 90, y: 100 }, { label: "A", width: 1, previewValue: "0" });
    const inputB = createConfiguredNode(project, "input-pin", { x: 90, y: 210 }, { label: "B", width: 1, previewValue: "0" });
    const andGate = createConfiguredNode(project, "gate-and", { x: 280, y: 150 }, { label: "AND", width: 1 });
    const notGate = createConfiguredNode(project, "gate-not", { x: 450, y: 150 }, { label: "NOT", width: 1 });
    const output = createConfiguredNode(project, "output-pin", { x: 620, y: 150 }, { label: "OUT", width: 1 });
    workspace.nodes.push(inputA, inputB, andGate, notGate, output);
    addWire(project, workspace, inputA, "OUT", andGate, "A");
    addWire(project, workspace, inputB, "OUT", andGate, "B");
    addWire(project, workspace, andGate, "OUT", notGate, "A");
    addWire(project, workspace, notGate, "OUT", output, "IN");
    return addDefinitionFromWorkspace(project, existingSeries, "NAND", "Starter NAND opgebouwd uit AND + NOT.", workspace);
  }

  function buildStarterHalfAdderDefinition(project, existingSeries) {
    const workspace = deps.createWorkspace(project, "Half Adder Starter", null, { isStarter: true });
    const inputA = createConfiguredNode(project, "input-pin", { x: 90, y: 90 }, { label: "A", width: 1, previewValue: "0" });
    const inputB = createConfiguredNode(project, "input-pin", { x: 90, y: 220 }, { label: "B", width: 1, previewValue: "0" });
    const xorGate = createConfiguredNode(project, "gate-xor", { x: 280, y: 110 }, { label: "XOR", width: 1 });
    const andGate = createConfiguredNode(project, "gate-and", { x: 280, y: 240 }, { label: "AND", width: 1 });
    const sumOut = createConfiguredNode(project, "output-pin", { x: 500, y: 110 }, { label: "SUM", width: 1 });
    const carryOut = createConfiguredNode(project, "output-pin", { x: 500, y: 240 }, { label: "CARRY", width: 1 });
    workspace.nodes.push(inputA, inputB, xorGate, andGate, sumOut, carryOut);
    addWire(project, workspace, inputA, "OUT", xorGate, "A");
    addWire(project, workspace, inputB, "OUT", xorGate, "B");
    addWire(project, workspace, xorGate, "OUT", sumOut, "IN");
    addWire(project, workspace, inputA, "OUT", andGate, "A");
    addWire(project, workspace, inputB, "OUT", andGate, "B");
    addWire(project, workspace, andGate, "OUT", carryOut, "IN");
    return addDefinitionFromWorkspace(
      project,
      existingSeries,
      "Half Adder",
      "Starter half adder met SUM en CARRY.",
      workspace
    );
  }

  function buildStarterFullAdderDefinition(project, existingSeries) {
    const halfAdder = ensureStarterChip(project, "Half Adder", buildStarterHalfAdderDefinition);
    const workspace = deps.createWorkspace(project, "Full Adder Starter", null, { isStarter: true });
    const inputA = createConfiguredNode(project, "input-pin", { x: 90, y: 70 }, { label: "A", width: 1, previewValue: "0" });
    const inputB = createConfiguredNode(project, "input-pin", { x: 90, y: 190 }, { label: "B", width: 1, previewValue: "0" });
    const inputCin = createConfiguredNode(project, "input-pin", { x: 90, y: 310 }, { label: "CIN", width: 1, previewValue: "0" });
    const halfAdder1 = deps.createChipInstance(project, halfAdder.id, { x: 280, y: 110 });
    const halfAdder2 = deps.createChipInstance(project, halfAdder.id, { x: 500, y: 190 });
    const orGate = createConfiguredNode(project, "gate-or", { x: 710, y: 210 }, { label: "OR", width: 1 });
    const outputSum = createConfiguredNode(project, "output-pin", { x: 930, y: 150 }, { label: "SUM", width: 1 });
    const outputCarry = createConfiguredNode(project, "output-pin", { x: 930, y: 280 }, { label: "COUT", width: 1 });
    const firstPins = getDefinitionPinsByName(halfAdder);
    const secondPins = getDefinitionPinsByName(halfAdder);
    workspace.nodes.push(inputA, inputB, inputCin, halfAdder1, halfAdder2, orGate, outputSum, outputCarry);
    addWire(project, workspace, inputA, "OUT", halfAdder1, firstPins.inputs.A.key);
    addWire(project, workspace, inputB, "OUT", halfAdder1, firstPins.inputs.B.key);
    addWire(project, workspace, halfAdder1, firstPins.outputs.SUM.key, halfAdder2, secondPins.inputs.A.key);
    addWire(project, workspace, inputCin, "OUT", halfAdder2, secondPins.inputs.B.key);
    addWire(project, workspace, halfAdder2, secondPins.outputs.SUM.key, outputSum, "IN");
    addWire(project, workspace, halfAdder1, firstPins.outputs.CARRY.key, orGate, "A");
    addWire(project, workspace, halfAdder2, secondPins.outputs.CARRY.key, orGate, "B");
    addWire(project, workspace, orGate, "OUT", outputCarry, "IN");
    return addDefinitionFromWorkspace(
      project,
      existingSeries,
      "Full Adder",
      "Starter full adder opgebouwd uit twee Half Adders en een OR.",
      workspace
    );
  }

  function createConfiguredNode(project, type, position, configOverrides) {
    const node = deps.createNode(project, type, position);
    node.config = {
      ...node.config,
      ...(configOverrides || {}),
    };
    return deps.normalizeNode(node);
  }

  function addWire(project, workspace, fromNode, fromPin, toNode, toPin) {
    workspace.wires.push({
      id: deps.allocateId(project, "wire"),
      fromNodeId: fromNode.id,
      fromPin,
      toNodeId: toNode.id,
      toPin,
    });
  }

  function addDefinitionFromWorkspace(project, existingSeries, name, description, workspace) {
    const interfaceResult = extractChipInterface(workspace);
    let series = existingSeries;
    if (!series) {
      series = { id: deps.allocateId(project, "chip-series"), name, definitionIds: [] };
      project.chipSeries.push(series);
    }
    const definition = {
      id: deps.allocateId(project, "chip-def"),
      seriesId: series.id,
      name,
      version: series.definitionIds.length + 1,
      description,
      inputs: interfaceResult.inputs,
      outputs: interfaceResult.outputs,
      createdAt: new Date().toISOString(),
      circuitSnapshot: deps.normalizeWorkspace({
        id: `snapshot-${Date.now()}-${name}`,
        name: `${name} Snapshot`,
        nodes: deps.deepClone(workspace.nodes),
        wires: deps.deepClone(workspace.wires),
        meta: { isStarter: true },
      }),
    };
    project.chipDefinitions.push(definition);
    series.definitionIds.push(definition.id);
    return definition;
  }

  function getDefinitionPinsByName(definition) {
    const inputs = {};
    const outputs = {};
    definition.inputs.forEach((pin) => {
      inputs[pin.name] = pin;
    });
    definition.outputs.forEach((pin) => {
      outputs[pin.name] = pin;
    });
    return { inputs, outputs };
  }

  function extractChipInterface(workspace) {
    const inputs = workspace.nodes
      .filter((node) => node.type === "input-pin")
      .map((node) => ({ key: node.id, name: node.config.label.trim(), width: node.config.width }));
    const outputs = workspace.nodes
      .filter((node) => node.type === "output-pin")
      .map((node) => ({ key: node.id, name: node.config.label.trim(), width: node.config.width }));
    const errors = [];

    if (!inputs.length) {
      errors.push({ message: "Een chip heeft minimaal één Input node nodig." });
    }
    if (!outputs.length) {
      errors.push({ message: "Een chip heeft minimaal één Output node nodig." });
    }

    const duplicateInputNames = findDuplicateNames(inputs.map((item) => item.name));
    const duplicateOutputNames = findDuplicateNames(outputs.map((item) => item.name));
    if (duplicateInputNames.length) {
      errors.push({ message: `Dubbele inputnamen: ${duplicateInputNames.join(", ")}` });
    }
    if (duplicateOutputNames.length) {
      errors.push({ message: `Dubbele outputnamen: ${duplicateOutputNames.join(", ")}` });
    }
    if (inputs.some((item) => !item.name)) {
      errors.push({ message: "Elke Input node heeft een naam nodig." });
    }
    if (outputs.some((item) => !item.name)) {
      errors.push({ message: "Elke Output node heeft een naam nodig." });
    }

    return { inputs, outputs, errors };
  }

  function findDuplicateNames(names) {
    const counts = new Map();
    names.forEach((name) => {
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].filter((entry) => entry[1] > 1).map((entry) => entry[0]);
  }

  return {
    createConfiguredNode,
    ensureStarterChips,
    extractChipInterface,
  };
}
