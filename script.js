(function () {
  const STORAGE_KEY = "forge-logic-project-v1";
  const BUILTIN_PARTS = [
    { type: "switch", label: "Switch", copy: "Handmatige input" },
    { type: "lamp", label: "Lamp", copy: "Zichtbare output" },
    { type: "gate-not", label: "NOT", copy: "Unary inverter" },
    { type: "gate-and", label: "AND", copy: "Bitwise AND" },
    { type: "gate-or", label: "OR", copy: "Bitwise OR" },
    { type: "gate-xor", label: "XOR", copy: "Bitwise XOR" },
    { type: "gate-nand", label: "NAND", copy: "Inverse AND" },
    { type: "gate-nor", label: "NOR", copy: "Inverse OR" },
    { type: "input-pin", label: "Input", copy: "Publieke chipinput" },
    { type: "output-pin", label: "Output", copy: "Publieke chipoutput" },
    { type: "clock", label: "Clock", copy: "1-bit klokbron" },
    { type: "register", label: "Register", copy: "Latched opslag" },
  ];

  const dom = {
    builtinPalette: document.getElementById("builtin-palette"),
    workspaceList: document.getElementById("workspace-list"),
    chipLibrary: document.getElementById("chip-library"),
    workspaceTitle: document.getElementById("workspace-title"),
    connectionStatus: document.getElementById("connection-status"),
    nodeLayer: document.getElementById("node-layer"),
    wireLayer: document.getElementById("wire-layer"),
    emptyState: document.getElementById("empty-state"),
    inspector: document.getElementById("inspector"),
    errorList: document.getElementById("error-list"),
    statusLine: document.getElementById("status-line"),
    canvas: document.getElementById("workspace-canvas"),
    importInput: document.getElementById("import-input"),
    newWorkspaceButton: document.getElementById("new-workspace-button"),
    duplicateWorkspaceButton: document.getElementById("duplicate-workspace-button"),
    saveChipButton: document.getElementById("save-chip-button"),
    toggleClocksButton: document.getElementById("toggle-clocks-button"),
    stepRegistersButton: document.getElementById("step-registers-button"),
    resetStateButton: document.getElementById("reset-state-button"),
    exportButton: document.getElementById("export-button"),
    importButton: document.getElementById("import-button"),
  };

  const state = {
    project: loadProject(),
    selectedNodeId: null,
    pendingConnection: null,
    dragging: null,
    panningCanvas: null,
    lastEvaluation: null,
  };

  initializeApp();

  function initializeApp() {
    try {
      render();
      bindEvents();
    } catch (error) {
      console.error("Forge Logic bootstrap failed, resetting project.", error);
      state.project = createProject();
      state.selectedNodeId = null;
      state.pendingConnection = null;
      state.dragging = null;
      state.panningCanvas = null;
      state.lastEvaluation = null;
      render();
      bindEvents();
      setStatus("Project reset na laadfout. Je werkt nu in een schoon project.");
    }
  }

  function bindEvents() {
    dom.newWorkspaceButton.addEventListener("click", createWorkspaceFromPrompt);
    dom.duplicateWorkspaceButton.addEventListener("click", duplicateCurrentWorkspace);
    dom.saveChipButton.addEventListener("click", saveCurrentWorkspaceAsChip);
    dom.toggleClocksButton.addEventListener("click", toggleWorkspaceClocks);
    dom.stepRegistersButton.addEventListener("click", stepRegisters);
    dom.resetStateButton.addEventListener("click", resetRuntimeState);
    dom.exportButton.addEventListener("click", exportProject);
    dom.importButton.addEventListener("click", () => dom.importInput.click());
    dom.importInput.addEventListener("change", importProjectFromFile);

    dom.builtinPalette.addEventListener("click", handleBuiltinPaletteClick);
    dom.workspaceList.addEventListener("click", handleWorkspaceListClick);
    dom.chipLibrary.addEventListener("click", handleChipLibraryClick);
    dom.nodeLayer.addEventListener("click", handleNodeLayerClick);
    dom.nodeLayer.addEventListener("pointerdown", handleNodeLayerPointerDown);
    dom.canvas.addEventListener("pointerdown", handleCanvasPointerDown);
    dom.inspector.addEventListener("input", handleInspectorInput);
    dom.inspector.addEventListener("click", handleInspectorClick);

    document.addEventListener("pointermove", handleDragMove);
    document.addEventListener("pointerup", stopDragging);
    document.addEventListener("pointercancel", stopDragging);
    document.addEventListener("keydown", handleKeyboardShortcuts);
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createProject();
      }
      return normalizeProject(JSON.parse(raw));
    } catch (error) {
      console.error(error);
      return createProject();
    }
  }

  function saveProject() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
  }

  function createProject() {
    const project = {
      version: 1,
      nextId: 1,
      workspaces: [],
      currentWorkspaceId: null,
      chipSeries: [],
      chipDefinitions: [],
      runtime: {
        registerStates: {},
      },
    };
    const workspace = createWorkspace(project, "Main Workspace");
    workspace.nodes.push(createNode(project, "switch", { x: 120, y: 140 }));
    workspace.nodes.push(createNode(project, "lamp", { x: 470, y: 150 }));
    project.workspaces.push(workspace);
    project.currentWorkspaceId = workspace.id;
    ensureStarterChips(project);
    return project;
  }

  function normalizeProject(project) {
    if (!project || typeof project !== "object") {
      return createProject();
    }
    const normalized = {
      version: 1,
      nextId: Number(project.nextId) || 1,
      workspaces: Array.isArray(project.workspaces) ? project.workspaces.map(normalizeWorkspace) : [],
      currentWorkspaceId: project.currentWorkspaceId || null,
      chipSeries: Array.isArray(project.chipSeries) ? project.chipSeries : [],
      chipDefinitions: Array.isArray(project.chipDefinitions)
        ? project.chipDefinitions.map(normalizeChipDefinition)
        : [],
      runtime: {
        registerStates:
          project.runtime && typeof project.runtime.registerStates === "object"
            ? project.runtime.registerStates
            : {},
      },
    };

    if (!normalized.workspaces.length) {
      const workspace = createWorkspace(normalized, "Main Workspace");
      normalized.workspaces.push(workspace);
      normalized.currentWorkspaceId = workspace.id;
    }

    if (!normalized.workspaces.some((workspace) => workspace.id === normalized.currentWorkspaceId)) {
      normalized.currentWorkspaceId = normalized.workspaces[0].id;
    }

    ensureStarterChips(normalized);
    return normalized;
  }

  function normalizeWorkspace(workspace) {
    return {
      id: workspace.id || `ws-${Date.now()}`,
      name: workspace.name || "Workspace",
      nodes: Array.isArray(workspace.nodes) ? workspace.nodes.map(normalizeNode) : [],
      wires: Array.isArray(workspace.wires)
        ? workspace.wires
            .filter((wire) => wire && wire.id && wire.fromNodeId && wire.fromPin && wire.toNodeId && wire.toPin)
            .map((wire) => ({ ...wire }))
        : [],
      createdAt: workspace.createdAt || new Date().toISOString(),
      meta: normalizeWorkspaceMeta(workspace.meta),
    };
  }

  function normalizeWorkspaceMeta(meta) {
    return {
      sourceChipDefinitionId: meta && meta.sourceChipDefinitionId ? meta.sourceChipDefinitionId : null,
      sourceChipSeriesId: meta && meta.sourceChipSeriesId ? meta.sourceChipSeriesId : null,
      sourceChipVersion: meta && Number(meta.sourceChipVersion) ? Number(meta.sourceChipVersion) : null,
      draftMode: meta && meta.draftMode ? String(meta.draftMode) : null,
      isStarter: Boolean(meta && meta.isStarter),
    };
  }

  function normalizeChipDefinition(definition) {
    return {
      id: definition.id,
      seriesId: definition.seriesId,
      name: definition.name || "Chip",
      version: Number(definition.version) || 1,
      description: definition.description || "",
      inputs: Array.isArray(definition.inputs) ? definition.inputs : [],
      outputs: Array.isArray(definition.outputs) ? definition.outputs : [],
      createdAt: definition.createdAt || new Date().toISOString(),
      circuitSnapshot: normalizeWorkspace({
        id: `snapshot-${definition.id}`,
        name: definition.name || "Chip Snapshot",
        nodes: definition.circuitSnapshot ? definition.circuitSnapshot.nodes : [],
        wires: definition.circuitSnapshot ? definition.circuitSnapshot.wires : [],
      }),
    };
  }

  function allocateId(project, prefix) {
    const id = `${prefix}-${project.nextId}`;
    project.nextId += 1;
    return id;
  }

  function createWorkspace(project, name, source, metaOverrides) {
    if (source) {
      return {
        id: allocateId(project, "ws"),
        name,
        nodes: deepClone(source.nodes).map(normalizeNode),
        wires: deepClone(source.wires),
        createdAt: new Date().toISOString(),
        meta: {
          ...normalizeWorkspaceMeta(source.meta),
          ...normalizeWorkspaceMeta(metaOverrides),
        },
      };
    }
    return {
      id: allocateId(project, "ws"),
      name,
      nodes: [],
      wires: [],
      createdAt: new Date().toISOString(),
      meta: normalizeWorkspaceMeta(metaOverrides),
    };
  }

  function createNode(project, type, position) {
    const baseX = position && typeof position.x === "number" ? position.x : 140;
    const baseY = position && typeof position.y === "number" ? position.y : 120;
    const node = {
      id: allocateId(project, "node"),
      type,
      x: baseX,
      y: baseY,
      config: {},
    };

    switch (type) {
      case "switch":
        node.config = { label: "Switch", width: 1, value: "0" };
        break;
      case "lamp":
        node.config = { label: "Lamp", width: 1 };
        break;
      case "input-pin":
        node.config = { label: "Input", width: 1, previewValue: "0" };
        break;
      case "output-pin":
        node.config = { label: "Output", width: 1 };
        break;
      case "clock":
        node.config = { label: "Clock", value: "0" };
        break;
      case "register":
        node.config = { label: "Register", width: 1, resetValue: "0" };
        break;
      default:
        if (type.startsWith("gate-")) {
          node.type = "gate";
          node.config = {
            label: type.replace("gate-", "").toUpperCase(),
            gateType: type.replace("gate-", "").toUpperCase(),
            width: 1,
          };
        }
        break;
    }

    return normalizeNode(node);
  }

  function createChipInstance(project, definitionId, position) {
    const definition =
      (project && Array.isArray(project.chipDefinitions)
        ? project.chipDefinitions.find((item) => item.id === definitionId)
        : null) || getChipDefinition(definitionId);
    return normalizeNode({
      id: allocateId(project, "node"),
      type: "chip-instance",
      x: position && typeof position.x === "number" ? position.x : 180,
      y: position && typeof position.y === "number" ? position.y : 160,
      config: {
        definitionId,
        label: definition ? `${definition.name} v${definition.version}` : "Chip",
      },
    });
  }

  function normalizeNode(node) {
    const normalized = {
      id: node.id,
      type: node.type,
      x: Number(node.x) || 100,
      y: Number(node.y) || 100,
      config: { ...(node.config || {}) },
    };

    if (normalized.type === "switch") {
      normalized.config.label = normalized.config.label || "Switch";
      normalized.config.width = clampWidth(normalized.config.width);
      normalized.config.value = normalizeBitString(normalized.config.value, normalized.config.width);
    } else if (normalized.type === "lamp") {
      normalized.config.label = normalized.config.label || "Lamp";
      normalized.config.width = clampWidth(normalized.config.width);
    } else if (normalized.type === "gate") {
      normalized.config.label = normalized.config.label || "Gate";
      normalized.config.gateType = String(normalized.config.gateType || "AND").toUpperCase();
      normalized.config.width = clampWidth(normalized.config.width);
    } else if (normalized.type === "input-pin") {
      normalized.config.label = normalized.config.label || "Input";
      normalized.config.width = clampWidth(normalized.config.width);
      normalized.config.previewValue = normalizeBitString(
        normalized.config.previewValue,
        normalized.config.width
      );
    } else if (normalized.type === "output-pin") {
      normalized.config.label = normalized.config.label || "Output";
      normalized.config.width = clampWidth(normalized.config.width);
    } else if (normalized.type === "clock") {
      normalized.config.label = normalized.config.label || "Clock";
      normalized.config.value = normalizeBitString(normalized.config.value, 1);
    } else if (normalized.type === "register") {
      normalized.config.label = normalized.config.label || "Register";
      normalized.config.width = clampWidth(normalized.config.width);
      normalized.config.resetValue = normalizeBitString(
        normalized.config.resetValue,
        normalized.config.width
      );
    } else if (normalized.type === "chip-instance") {
      normalized.config.label = normalized.config.label || "Chip";
      normalized.config.definitionId = normalized.config.definitionId || "";
    }

    return normalized;
  }

  function clampWidth(width) {
    const numeric = Number(width) || 1;
    return Math.max(1, Math.min(16, Math.round(numeric)));
  }

  function normalizeBitString(value, width) {
    const cleaned = String(value == null ? "" : value).replace(/[^01]/g, "");
    const fallback = cleaned.length ? cleaned : "0";
    return fallback.slice(-width).padStart(width, "0");
  }

  function parseBits(value, width) {
    return normalizeBitString(value, width).split("").map((bit) => bit === "1");
  }

  function formatBits(bits, width) {
    if (!bits) {
      return "0".padStart(width || 1, "0");
    }
    return bits.map((bit) => (bit ? "1" : "0")).join("");
  }

  function zeroBits(width) {
    return Array.from({ length: width }, () => false);
  }

  function ensureWidth(bits, width) {
    if (!Array.isArray(bits)) {
      return zeroBits(width);
    }
    return parseBits(formatBits(bits, width), width);
  }

  function bitwiseBinary(a, b, operation) {
    return a.map((bit, index) => Boolean(operation(bit, b[index])));
  }

  function bitwiseUnary(bits, operation) {
    return bits.map((bit) => Boolean(operation(bit)));
  }

  function bitsToBoolean(bits) {
    return Boolean(bits && bits[bits.length - 1]);
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getCurrentWorkspace() {
    return state.project.workspaces.find((workspace) => workspace.id === state.project.currentWorkspaceId);
  }

  function getWorkspace(workspaceId) {
    return state.project.workspaces.find((workspace) => workspace.id === workspaceId);
  }

  function getChipDefinition(definitionId) {
    return state.project.chipDefinitions.find((definition) => definition.id === definitionId);
  }

  function getChipSeries(seriesId) {
    return state.project.chipSeries.find((series) => series.id === seriesId);
  }

  function getNodeSpec(node) {
    if (!node) {
      return { title: "Missing", subtitle: "", inputs: [], outputs: [] };
    }
    if (node.type === "switch") {
      return {
        title: node.config.label,
        subtitle: `Switch • ${node.config.width}-bit`,
        inputs: [],
        outputs: [{ key: "OUT", name: "OUT", width: node.config.width }],
      };
    }
    if (node.type === "lamp") {
      return {
        title: node.config.label,
        subtitle: `Lamp • ${node.config.width}-bit`,
        inputs: [{ key: "IN", name: "IN", width: node.config.width }],
        outputs: [],
      };
    }
    if (node.type === "gate") {
      const isUnary = node.config.gateType === "NOT";
      return {
        title: node.config.label,
        subtitle: `${node.config.gateType} Gate • ${node.config.width}-bit`,
        inputs: isUnary
          ? [{ key: "A", name: "A", width: node.config.width }]
          : [
              { key: "A", name: "A", width: node.config.width },
              { key: "B", name: "B", width: node.config.width },
            ],
        outputs: [{ key: "OUT", name: "OUT", width: node.config.width }],
      };
    }
    if (node.type === "input-pin") {
      return {
        title: node.config.label,
        subtitle: `Chip Input • ${node.config.width}-bit`,
        inputs: [],
        outputs: [{ key: "OUT", name: "OUT", width: node.config.width }],
      };
    }
    if (node.type === "output-pin") {
      return {
        title: node.config.label,
        subtitle: `Chip Output • ${node.config.width}-bit`,
        inputs: [{ key: "IN", name: "IN", width: node.config.width }],
        outputs: [],
      };
    }
    if (node.type === "clock") {
      return {
        title: node.config.label,
        subtitle: "Clock • 1-bit",
        inputs: [],
        outputs: [{ key: "OUT", name: "OUT", width: 1 }],
      };
    }
    if (node.type === "register") {
      return {
        title: node.config.label,
        subtitle: `Register • ${node.config.width}-bit`,
        inputs: [
          { key: "D", name: "D", width: node.config.width },
          { key: "CLK", name: "CLK", width: 1 },
          { key: "RST", name: "RST", width: 1 },
        ],
        outputs: [{ key: "Q", name: "Q", width: node.config.width }],
      };
    }
    if (node.type === "chip-instance") {
      const definition = getChipDefinition(node.config.definitionId);
      if (!definition) {
        return {
          title: node.config.label || "Missing Chip",
          subtitle: "Chip ontbreekt",
          inputs: [],
          outputs: [],
        };
      }
      return {
        title: node.config.label || definition.name,
        subtitle: `${definition.name} v${definition.version}`,
        inputs: definition.inputs.map((pin) => ({
          key: pin.key,
          name: pin.name,
          width: clampWidth(pin.width),
        })),
        outputs: definition.outputs.map((pin) => ({
          key: pin.key,
          name: pin.name,
          width: clampWidth(pin.width),
        })),
      };
    }
    return { title: "Unknown", subtitle: "", inputs: [], outputs: [] };
  }

  function render() {
    renderBuiltinPalette();
    renderWorkspaceList();
    renderChipLibrary();

    try {
      state.lastEvaluation = evaluateWorkspace(getCurrentWorkspace());
    } catch (error) {
      console.error("Workspace evaluation failed.", error);
      state.lastEvaluation = {
        nodeSignals: {},
        wireSignals: {},
        errors: [{ message: "Kon deze sheet niet evalueren. Controleer opgeslagen projectdata." }],
      };
    }

    renderCanvas();
    renderInspector();
    renderErrors();
    saveProject();
  }

  function renderBuiltinPalette() {
    dom.builtinPalette.innerHTML = BUILTIN_PARTS.map(
      (part) =>
        `<button class="palette-button" type="button" data-part-type="${part.type}">
          ${escapeHtml(part.label)}
          <small>${escapeHtml(part.copy)}</small>
        </button>`
    ).join("");
  }

  function renderWorkspaceList() {
    const workspace = getCurrentWorkspace();
    dom.workspaceTitle.textContent = workspace.name;
    dom.workspaceList.innerHTML = state.project.workspaces
      .map((item) => {
        const nodeCount = item.nodes.length;
        const wireCount = item.wires.length;
        const sourceSeries =
          item.meta && item.meta.sourceChipSeriesId ? getChipSeries(item.meta.sourceChipSeriesId) : null;
        const draftMeta = sourceSeries
          ? `Draft for ${sourceSeries.name}${item.meta.sourceChipVersion ? ` v${item.meta.sourceChipVersion}` : ""}`
          : item.meta && item.meta.isStarter
            ? "Starter sheet"
            : "";
        return `<div class="workspace-card ${item.id === workspace.id ? "active" : ""}">
          <div class="workspace-row">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <div class="workspace-meta">${nodeCount} nodes • ${wireCount} wires${
                draftMeta ? ` • ${escapeHtml(draftMeta)}` : ""
              }</div>
            </div>
            <button class="ghost-button" type="button" data-open-workspace="${item.id}">Open</button>
          </div>
          <div class="workspace-actions">
            <button class="ghost-button" type="button" data-duplicate-workspace="${item.id}">Duplicate</button>
            <button class="ghost-button" type="button" data-delete-workspace="${item.id}" ${
              state.project.workspaces.length === 1 ? "disabled" : ""
            }>Delete</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderChipLibrary() {
    if (!state.project.chipDefinitions.length) {
      dom.chipLibrary.innerHTML =
        '<div class="chip-card"><div class="chip-meta">Nog geen chips opgeslagen. Gebruik `Input` en `Output` nodes in een workspace en klik daarna op `Snapshot`.</div></div>';
      return;
    }

    const definitions = [...state.project.chipDefinitions].sort((a, b) => {
      if (a.name === b.name) {
        return a.version - b.version;
      }
      return a.name.localeCompare(b.name);
    });

    dom.chipLibrary.innerHTML = definitions
      .map((definition) => {
        const series = getChipSeries(definition.seriesId);
        const dependencyCount = countChipDependencies(definition.circuitSnapshot);
        const latestVersion = series ? getLatestChipDefinitionForSeries(series.id) : definition;
        const isLatest = latestVersion && latestVersion.id === definition.id;
        return `<div class="chip-card">
          <div class="chip-row">
            <div>
              <h3>${escapeHtml(definition.name)} v${definition.version}${isLatest ? " • latest" : ""}</h3>
              <div class="chip-meta">
                ${definition.inputs.length} in • ${definition.outputs.length} out • ${dependencyCount} nested chips
              </div>
            </div>
            <button class="ghost-button" type="button" data-place-chip="${definition.id}">Add</button>
          </div>
          <p class="chip-meta">${escapeHtml(definition.description || `Series: ${series ? series.name : definition.name}`)}</p>
          <div class="chip-actions">
            <button class="ghost-button" type="button" data-edit-chip="${definition.id}">Edit as New Version</button>
            <button class="ghost-button" type="button" data-clone-chip="${definition.id}">Clone to Workspace</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderCanvas() {
    const workspace = getCurrentWorkspace();
    const evaluation = state.lastEvaluation || { nodeSignals: {}, wireSignals: {}, errors: [] };
    const invalidNodeIds = new Set(evaluation.errors.flatMap((error) => error.nodeIds || []));
    dom.emptyState.hidden = workspace.nodes.length > 0;

    dom.nodeLayer.innerHTML = workspace.nodes
      .map((node) => renderNode(node, evaluation.nodeSignals[node.id], invalidNodeIds.has(node.id)))
      .join("");

    renderWires(workspace, evaluation);
    updateConnectionStatus();
  }

  function renderNode(node, signalState, invalid) {
    const spec = getNodeSpec(node);
    const selected = node.id === state.selectedNodeId;
    const lampValue = signalState && signalState.inputs && signalState.inputs.IN
      ? formatBits(signalState.inputs.IN, getPinWidth(spec.inputs, "IN"))
      : "0";
    const registerKey = makeRegisterStateKey(`workspace:${getCurrentWorkspace().id}`, node.id);
    const registerState = state.project.runtime.registerStates[registerKey];
    const registerText =
      node.type === "register"
        ? formatBits(
            registerState ? registerState.bits : parseBits(node.config.resetValue, node.config.width),
            node.config.width
          )
        : "";
    const body = renderNodeBody(node, spec, lampValue, registerText);

    return `<article class="node ${selected ? "selected" : ""} ${invalid ? "invalid" : ""}" data-node-id="${node.id}" style="left:${node.x}px; top:${node.y}px;">
      <div class="node-shell" data-drag-surface="true" data-node-id="${node.id}">
        <div class="node-caption">
          <span class="node-label">${escapeHtml(spec.title)}</span>
          <span class="node-state-pill">${escapeHtml(getNodeTag(node))}</span>
        </div>
        <div class="node-core">
          <div class="pin-stack">
            ${spec.inputs
              .map((pin) =>
                renderPin(
                  node.id,
                  pin,
                  "input",
                  signalState && signalState.inputs ? signalState.inputs[pin.key] : null
                )
              )
              .join("")}
          </div>
          ${body}
          <div class="pin-stack right">
            ${spec.outputs
              .map((pin) =>
                renderPin(
                  node.id,
                  pin,
                  "output",
                  signalState && signalState.outputs ? signalState.outputs[pin.key] : null
                )
              )
              .join("")}
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderNodeBody(node, spec, lampValue, registerText) {
    const symbol = getNodeSymbol(node);
    if (node.type === "switch") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta">
        <span>${escapeHtml(node.config.value)}</span>
        <button class="ghost-button node-mini-button" type="button" data-node-action="toggle-switch" data-node-id="${node.id}">toggle</button>
      </div></div>`;
    }
    if (node.type === "clock") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta">
        <span>${escapeHtml(node.config.value)}</span>
        <button class="ghost-button node-mini-button" type="button" data-node-action="toggle-clock" data-node-id="${node.id}">toggle</button>
      </div></div>`;
    }
    if (node.type === "lamp") {
      const isOn = /1/.test(lampValue);
      return `<div class="node-center"><div class="gate-face">
        <span class="lamp-indicator ${isOn ? "on" : ""}"></span>
      </div>
      <div class="gate-meta"><span>${escapeHtml(lampValue)}</span></div></div>`;
    }
    if (node.type === "register") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta"><span class="register-readout">${escapeHtml(registerText)}</span></div></div>`;
    }
    if (node.type === "chip-instance") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta"><span>${escapeHtml(
        `${spec.inputs.length}:${spec.outputs.length}`
      )}</span></div></div>`;
    }
    if (node.type === "input-pin") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta"><span>${escapeHtml(node.config.previewValue)}</span></div></div>`;
    }
    if (node.type === "output-pin") {
      return `<div class="node-center"><div class="gate-face">
        <span class="gate-symbol">${escapeHtml(symbol)}</span>
      </div>
      <div class="gate-meta"><span>${escapeHtml(node.config.width)}b</span></div></div>`;
    }
    return `<div class="node-center"><div class="gate-face">
      <span class="gate-symbol">${escapeHtml(symbol)}</span>
    </div>
    <div class="gate-meta"><span>${escapeHtml(node.config.width)}b</span></div></div>`;
  }

  function renderPin(nodeId, pin, direction, bits) {
    const bitString = bits ? formatBits(bits, pin.width) : "0".padStart(pin.width, "0");
    const signalClass = /1/.test(bitString) ? "high" : "low";
    const pending =
      state.pendingConnection &&
      state.pendingConnection.nodeId === nodeId &&
      state.pendingConnection.pinKey === pin.key &&
      state.pendingConnection.direction === direction;

    return `<button class="pin direction-${direction} ${signalClass} ${pending ? "pending" : ""}" type="button"
      data-pin-direction="${direction}"
      data-node-id="${nodeId}"
      data-pin-key="${pin.key}">
      ${direction === "input" ? `<span class="pin-label">${escapeHtml(pin.name)}</span>` : ""}
      <span class="pin-badge"></span>
      ${direction === "output" ? `<span class="pin-label">${escapeHtml(pin.name)}</span>` : ""}
    </button>`;
  }

  function getNodeTag(node) {
    if (node.type === "gate") {
      return node.config.gateType;
    }
    if (node.type === "chip-instance") {
      return "CHIP";
    }
    if (node.type === "input-pin") {
      return "IN";
    }
    if (node.type === "output-pin") {
      return "OUT";
    }
    if (node.type === "switch") {
      return "SW";
    }
    if (node.type === "lamp") {
      return "L";
    }
    if (node.type === "clock") {
      return "CLK";
    }
    if (node.type === "register") {
      return "REG";
    }
    return node.type.toUpperCase();
  }

  function getNodeSymbol(node) {
    if (node.type === "gate") {
      return {
        NOT: "!",
        AND: "&",
        OR: "1+",
        XOR: "=1",
        NAND: "!&",
        NOR: "!|",
      }[node.config.gateType] || node.config.gateType;
    }
    if (node.type === "switch") {
      return "S";
    }
    if (node.type === "lamp") {
      return "O";
    }
    if (node.type === "clock") {
      return "CLK";
    }
    if (node.type === "register") {
      return "D";
    }
    if (node.type === "input-pin") {
      return ">";
    }
    if (node.type === "output-pin") {
      return "<";
    }
    if (node.type === "chip-instance") {
      return "[]";
    }
    return "?";
  }

  function renderWires(workspace, evaluation) {
    const canvasRect = dom.canvas.getBoundingClientRect();
    const nodeLookup = new Map(workspace.nodes.map((node) => [node.id, node]));

    dom.wireLayer.innerHTML = workspace.wires
      .map((wire) => {
        const fromElement = dom.nodeLayer.querySelector(
          `[data-node-id="${wire.fromNodeId}"][data-pin-key="${wire.fromPin}"][data-pin-direction="output"]`
        );
        const toElement = dom.nodeLayer.querySelector(
          `[data-node-id="${wire.toNodeId}"][data-pin-key="${wire.toPin}"][data-pin-direction="input"]`
        );

        if (!fromElement || !toElement) {
          return "";
        }

        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();
        const x1 = fromRect.left - canvasRect.left + fromRect.width / 2 + dom.canvas.scrollLeft;
        const y1 = fromRect.top - canvasRect.top + fromRect.height / 2 + dom.canvas.scrollTop;
        const x2 = toRect.left - canvasRect.left + toRect.width / 2 + dom.canvas.scrollLeft;
        const y2 = toRect.top - canvasRect.top + toRect.height / 2 + dom.canvas.scrollTop;
        const delta = Math.max(60, Math.abs(x2 - x1) * 0.55);
        const path = `M ${x1} ${y1} C ${x1 + delta} ${y1}, ${x2 - delta} ${y2}, ${x2} ${y2}`;
        const wireSignal = evaluation.wireSignals[wire.id];
        const wireClass = wireSignal ? (wireSignal.invalid ? "invalid" : wireSignal.high ? "high" : "low") : "";
        const invalidNode = !nodeLookup.has(wire.fromNodeId) || !nodeLookup.has(wire.toNodeId);
        return `<path class="wire ${wireClass} ${invalidNode ? "invalid" : ""}" d="${path}" />`;
      })
      .join("");
  }

  function renderInspector() {
    const workspace = getCurrentWorkspace();
    const node = workspace.nodes.find((item) => item.id === state.selectedNodeId);
    if (!node) {
      dom.inspector.className = "inspector empty";
      dom.inspector.innerHTML = "Selecteer een node om de eigenschappen te bewerken.";
      return;
    }

    const spec = getNodeSpec(node);
    const connections = getNodeConnections(workspace, node.id);
    dom.inspector.className = "inspector";
    dom.inspector.innerHTML = `
      <div>
        <h3>${escapeHtml(spec.title)}</h3>
        <p class="micro-copy">${escapeHtml(spec.subtitle)}</p>
      </div>
      ${renderInspectorFields(node)}
      <div class="inspector-section">
        <h3>Connections</h3>
        ${
          connections.length
            ? connections
                .map(
                  (connection) => `<div class="connection-chip">
                    <span>${escapeHtml(connection.label)}</span>
                    <button class="ghost-button" type="button" data-remove-wire="${connection.wireId}">Remove</button>
                  </div>`
                )
                .join("")
            : '<p class="micro-copy">Nog geen verbindingen voor deze node.</p>'
        }
      </div>
      <div class="inspector-section">
        <button type="button" data-delete-node="${node.id}">Delete Node</button>
      </div>
    `;
  }

  function renderInspectorFields(node) {
    const commonLabel = `<div class="field-group">
      <label for="node-label-input">Label</label>
      <input id="node-label-input" type="text" data-config-key="label" value="${escapeAttribute(node.config.label || "")}" />
    </div>`;

    if (node.type === "switch") {
      return `${commonLabel}
        ${renderWidthField(node)}
        <div class="field-group">
          <label for="node-value-input">Bit value</label>
          <input id="node-value-input" type="text" data-config-key="value" value="${escapeAttribute(node.config.value)}" />
        </div>`;
    }

    if (node.type === "lamp") {
      return `${commonLabel}${renderWidthField(node)}`;
    }

    if (node.type === "gate") {
      return `${commonLabel}
        <div class="field-group">
          <label for="gate-type-select">Gate type</label>
          <select id="gate-type-select" data-config-key="gateType">
            ${["NOT", "AND", "OR", "XOR", "NAND", "NOR"]
              .map(
                (option) =>
                  `<option value="${option}" ${node.config.gateType === option ? "selected" : ""}>${option}</option>`
              )
              .join("")}
          </select>
        </div>
        ${renderWidthField(node)}`;
    }

    if (node.type === "input-pin") {
      return `${commonLabel}
        ${renderWidthField(node)}
        <div class="field-group">
          <label for="preview-value-input">Preview value</label>
          <input id="preview-value-input" type="text" data-config-key="previewValue" value="${escapeAttribute(
            node.config.previewValue
          )}" />
        </div>`;
    }

    if (node.type === "output-pin") {
      return `${commonLabel}${renderWidthField(node)}`;
    }

    if (node.type === "clock") {
      return `${commonLabel}
        <div class="field-group">
          <label for="clock-level-input">Clock level</label>
          <input id="clock-level-input" type="text" data-config-key="value" value="${escapeAttribute(node.config.value)}" />
        </div>`;
    }

    if (node.type === "register") {
      return `${commonLabel}
        ${renderWidthField(node)}
        <div class="field-group">
          <label for="reset-value-input">Reset value</label>
          <input id="reset-value-input" type="text" data-config-key="resetValue" value="${escapeAttribute(
            node.config.resetValue
          )}" />
        </div>`;
    }

    if (node.type === "chip-instance") {
      const definition = getChipDefinition(node.config.definitionId);
      return `${commonLabel}
        <div class="field-group">
          <label>Definition</label>
          <div class="micro-copy">${escapeHtml(
            definition ? `${definition.name} v${definition.version}` : "Missing chip definition"
          )}</div>
        </div>`;
    }

    return commonLabel;
  }

  function renderWidthField(node) {
    return `<div class="field-group">
      <label for="node-width-input">Bit width</label>
      <input id="node-width-input" type="number" min="1" max="16" step="1" data-config-key="width" value="${escapeAttribute(
        String(node.config.width || 1)
      )}" />
    </div>`;
  }

  function renderErrors() {
    const errors = state.lastEvaluation ? state.lastEvaluation.errors : [];
    if (!errors.length) {
      dom.errorList.innerHTML = "Geen fouten in de actieve workspace.";
      return;
    }
    dom.errorList.innerHTML = errors
      .map((error) => `<div class="error-item">${escapeHtml(error.message)}</div>`)
      .join("");
  }

  function updateConnectionStatus(message) {
    if (message) {
      dom.connectionStatus.textContent = message;
      return;
    }
    if (state.pendingConnection) {
      dom.connectionStatus.textContent =
        "Verbinding gestart. Klik nu op een input-pin met dezelfde bitbreedte.";
      return;
    }
    dom.connectionStatus.textContent =
      "Klik eerst op een output-pin en daarna op een input-pin om een verbinding te maken.";
  }

  function handleBuiltinPaletteClick(event) {
    const button = event.target.closest("[data-part-type]");
    if (!button) {
      return;
    }
    addPartToWorkspace(button.dataset.partType);
  }

  function handleWorkspaceListClick(event) {
    const openButton = event.target.closest("[data-open-workspace]");
    if (openButton) {
      state.project.currentWorkspaceId = openButton.dataset.openWorkspace;
      state.selectedNodeId = null;
      state.pendingConnection = null;
      setStatus(`Workspace "${getCurrentWorkspace().name}" geopend.`);
      render();
      return;
    }

    const duplicateButton = event.target.closest("[data-duplicate-workspace]");
    if (duplicateButton) {
      duplicateWorkspace(duplicateButton.dataset.duplicateWorkspace);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-workspace]");
    if (deleteButton) {
      deleteWorkspace(deleteButton.dataset.deleteWorkspace);
    }
  }

  function handleChipLibraryClick(event) {
    const addButton = event.target.closest("[data-place-chip]");
    if (addButton) {
      addPartToWorkspace("chip-instance", addButton.dataset.placeChip);
      return;
    }

    const editButton = event.target.closest("[data-edit-chip]");
    if (editButton) {
      editChipAsNewVersion(editButton.dataset.editChip);
      return;
    }

    const cloneButton = event.target.closest("[data-clone-chip]");
    if (cloneButton) {
      cloneChipToWorkspace(cloneButton.dataset.cloneChip);
    }
  }

  function handleNodeLayerClick(event) {
    const actionButton = event.target.closest("[data-node-action]");
    if (actionButton) {
      const node = getCurrentWorkspace().nodes.find((item) => item.id === actionButton.dataset.nodeId);
      if (!node) {
        return;
      }
      if (actionButton.dataset.nodeAction === "toggle-switch") {
        toggleSwitchNode(node);
      } else if (actionButton.dataset.nodeAction === "toggle-clock") {
        toggleClockNode(node);
      }
      render();
      return;
    }

    const pin = event.target.closest("[data-pin-direction]");
    if (pin) {
      handlePinClick(pin);
      return;
    }

    const nodeElement = event.target.closest("[data-node-id]");
    if (nodeElement) {
      state.selectedNodeId = nodeElement.dataset.nodeId;
      render();
      return;
    }

    state.selectedNodeId = null;
    render();
  }

  function handleNodeLayerPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    if (event.target.closest("[data-pin-direction]") || event.target.closest("[data-node-action]")) {
      return;
    }
    const surface = event.target.closest("[data-drag-surface]");
    if (!surface) {
      return;
    }
    const nodeId = surface.dataset.nodeId;
    const node = getCurrentWorkspace().nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    state.selectedNodeId = nodeId;
    state.dragging = {
      nodeId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
    };
    if (surface.setPointerCapture) {
      surface.setPointerCapture(event.pointerId);
    }
  }

  function handleCanvasPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    if (event.target.closest("[data-node-id]") || event.target.closest("[data-pin-direction]")) {
      return;
    }
    event.preventDefault();
    state.panningCanvas = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: dom.canvas.scrollLeft,
      startScrollTop: dom.canvas.scrollTop,
    };
  }

  function handleInspectorInput(event) {
    const input = event.target.closest("[data-config-key]");
    if (!input) {
      return;
    }
    const workspace = getCurrentWorkspace();
    const node = workspace.nodes.find((item) => item.id === state.selectedNodeId);
    if (!node) {
      return;
    }

    const key = input.dataset.configKey;
    node.config[key] = input.value;

    if (key === "width") {
      const width = clampWidth(input.value);
      node.config.width = width;
      if (node.type === "switch") {
        node.config.value = normalizeBitString(node.config.value, width);
      }
      if (node.type === "input-pin") {
        node.config.previewValue = normalizeBitString(node.config.previewValue, width);
      }
      if (node.type === "register") {
        node.config.resetValue = normalizeBitString(node.config.resetValue, width);
      }
    }

    if (node.type === "switch" && key === "value") {
      node.config.value = normalizeBitString(node.config.value, node.config.width);
    }
    if (node.type === "input-pin" && key === "previewValue") {
      node.config.previewValue = normalizeBitString(node.config.previewValue, node.config.width);
    }
    if (node.type === "clock" && key === "value") {
      node.config.value = normalizeBitString(node.config.value, 1);
    }
    if (node.type === "register" && key === "resetValue") {
      node.config.resetValue = normalizeBitString(node.config.resetValue, node.config.width);
    }
    if (node.type === "gate" && key === "gateType") {
      node.config.label = node.config.gateType;
    }

    render();
  }

  function handleInspectorClick(event) {
    const deleteButton = event.target.closest("[data-delete-node]");
    if (deleteButton) {
      deleteNode(deleteButton.dataset.deleteNode);
      return;
    }

    const removeWireButton = event.target.closest("[data-remove-wire]");
    if (removeWireButton) {
      removeWire(removeWireButton.dataset.removeWire);
    }
  }

  function handleKeyboardShortcuts(event) {
    if (event.key !== "Delete" && event.key !== "Backspace") {
      return;
    }

    const tagName = document.activeElement ? document.activeElement.tagName : "";
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return;
    }

    if (state.selectedNodeId) {
      deleteNode(state.selectedNodeId);
    }
  }

  function addPartToWorkspace(partType, definitionId) {
    const workspace = getCurrentWorkspace();
    const position = {
      x: 120 + (workspace.nodes.length % 5) * 250,
      y: 110 + Math.floor(workspace.nodes.length / 5) * 190,
    };
    const node =
      partType === "chip-instance"
        ? createChipInstance(state.project, definitionId, position)
        : createNode(state.project, partType, position);
    workspace.nodes.push(node);
    state.selectedNodeId = node.id;
    setStatus(`${node.config.label || node.type} toegevoegd aan ${workspace.name}.`);
    render();
  }

  function createWorkspaceFromPrompt() {
    const name = window.prompt("Naam van de nieuwe workspace", `Workspace ${state.project.workspaces.length + 1}`);
    if (!name) {
      return;
    }
    const workspace = createWorkspace(state.project, name.trim() || "Workspace");
    state.project.workspaces.push(workspace);
    state.project.currentWorkspaceId = workspace.id;
    state.selectedNodeId = null;
    setStatus(`Workspace "${workspace.name}" aangemaakt.`);
    render();
  }

  function duplicateCurrentWorkspace() {
    duplicateWorkspace(getCurrentWorkspace().id);
  }

  function duplicateWorkspace(workspaceId) {
    const source = getWorkspace(workspaceId);
    if (!source) {
      return;
    }
    const name = `${source.name} Copy`;
    const duplicate = createWorkspace(state.project, name, source);
    state.project.workspaces.push(duplicate);
    state.project.currentWorkspaceId = duplicate.id;
    state.selectedNodeId = null;
    setStatus(`Workspace "${duplicate.name}" aangemaakt.`);
    render();
  }

  function deleteWorkspace(workspaceId) {
    if (state.project.workspaces.length === 1) {
      return;
    }
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return;
    }
    if (!window.confirm(`Delete workspace "${workspace.name}"?`)) {
      return;
    }
    state.project.workspaces = state.project.workspaces.filter((item) => item.id !== workspaceId);
    if (state.project.currentWorkspaceId === workspaceId) {
      state.project.currentWorkspaceId = state.project.workspaces[0].id;
    }
    state.selectedNodeId = null;
    state.pendingConnection = null;
    setStatus(`Workspace "${workspace.name}" verwijderd.`);
    render();
  }

  function saveCurrentWorkspaceAsChip() {
    const workspace = getCurrentWorkspace();
    const interfaceResult = extractChipInterface(workspace);
    if (interfaceResult.errors.length) {
      setStatus(interfaceResult.errors[0].message);
      render();
      return;
    }

    const sourceSeries =
      workspace.meta && workspace.meta.sourceChipSeriesId
        ? getChipSeries(workspace.meta.sourceChipSeriesId)
        : null;
    const suggestedName = sourceSeries
      ? sourceSeries.name
      : workspace.name.replace(/\s+copy$/i, "").trim() || "Custom Chip";
    const chipName = window.prompt("Chip name", suggestedName);
    if (!chipName) {
      return;
    }
    const trimmedName = chipName.trim();
    if (!trimmedName) {
      return;
    }
    const description =
      window.prompt("Beschrijving van deze chip", `Snapshot vanuit workspace "${workspace.name}"`) || "";

    let series =
      sourceSeries && sourceSeries.name.toLowerCase() === trimmedName.toLowerCase()
        ? sourceSeries
        : state.project.chipSeries.find((entry) => entry.name.toLowerCase() === trimmedName.toLowerCase());
    if (!series) {
      series = { id: allocateId(state.project, "chip-series"), name: trimmedName, definitionIds: [] };
      state.project.chipSeries.push(series);
    }

    const version = series.definitionIds.length + 1;
    const definition = {
      id: allocateId(state.project, "chip-def"),
      seriesId: series.id,
      name: trimmedName,
      version,
      description,
      inputs: interfaceResult.inputs,
      outputs: interfaceResult.outputs,
      createdAt: new Date().toISOString(),
      circuitSnapshot: normalizeWorkspace({
        id: `snapshot-${Date.now()}`,
        name: `${trimmedName} Snapshot`,
        nodes: deepClone(workspace.nodes),
        wires: deepClone(workspace.wires),
      }),
    };

    state.project.chipDefinitions.push(definition);
    series.definitionIds.push(definition.id);
    workspace.meta = {
      ...workspace.meta,
      sourceChipSeriesId: series.id,
      sourceChipDefinitionId: definition.id,
      sourceChipVersion: definition.version,
      draftMode: "new-version",
    };
    setStatus(`Chip "${trimmedName} v${version}" opgeslagen in de bibliotheek.`);
    render();
  }

  function cloneChipToWorkspace(definitionId) {
    const definition = getChipDefinition(definitionId);
    if (!definition) {
      return;
    }
    const workspace = createWorkspace(
      state.project,
      `${definition.name} v${definition.version} Draft`,
      definition.circuitSnapshot,
      {
        sourceChipDefinitionId: definition.id,
        sourceChipSeriesId: definition.seriesId,
        sourceChipVersion: definition.version,
        draftMode: "clone",
      }
    );
    state.project.workspaces.push(workspace);
    state.project.currentWorkspaceId = workspace.id;
    state.selectedNodeId = null;
    setStatus(`Chip "${definition.name} v${definition.version}" gekloond naar een nieuwe workspace.`);
    render();
  }

  function editChipAsNewVersion(definitionId) {
    const definition = getChipDefinition(definitionId);
    if (!definition) {
      return;
    }
    const workspace = createWorkspace(
      state.project,
      `${definition.name} v${definition.version + 1} Draft`,
      definition.circuitSnapshot,
      {
        sourceChipDefinitionId: definition.id,
        sourceChipSeriesId: definition.seriesId,
        sourceChipVersion: definition.version,
        draftMode: "new-version",
      }
    );
    state.project.workspaces.push(workspace);
    state.project.currentWorkspaceId = workspace.id;
    state.selectedNodeId = null;
    setStatus(`Draft geopend voor ${definition.name} v${definition.version + 1}.`);
    render();
  }

  function getLatestChipDefinitionForSeries(seriesId) {
    const series = getChipSeries(seriesId);
    if (!series) {
      return null;
    }
    const definitions = series.definitionIds
      .map((definitionId) => getChipDefinition(definitionId))
      .filter(Boolean)
      .sort((left, right) => right.version - left.version);
    return definitions[0] || null;
  }

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
    const workspace = createWorkspace(project, "NAND Starter", null, { isStarter: true });
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
    const workspace = createWorkspace(project, "Half Adder Starter", null, { isStarter: true });
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
    const workspace = createWorkspace(project, "Full Adder Starter", null, { isStarter: true });
    const inputA = createConfiguredNode(project, "input-pin", { x: 90, y: 70 }, { label: "A", width: 1, previewValue: "0" });
    const inputB = createConfiguredNode(project, "input-pin", { x: 90, y: 190 }, { label: "B", width: 1, previewValue: "0" });
    const inputCin = createConfiguredNode(project, "input-pin", { x: 90, y: 310 }, { label: "CIN", width: 1, previewValue: "0" });
    const halfAdder1 = createChipInstance(project, halfAdder.id, { x: 280, y: 110 });
    const halfAdder2 = createChipInstance(project, halfAdder.id, { x: 500, y: 190 });
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
    const node = createNode(project, type, position);
    node.config = {
      ...node.config,
      ...(configOverrides || {}),
    };
    return normalizeNode(node);
  }

  function addWire(project, workspace, fromNode, fromPin, toNode, toPin) {
    workspace.wires.push({
      id: allocateId(project, "wire"),
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
      series = { id: allocateId(project, "chip-series"), name, definitionIds: [] };
      project.chipSeries.push(series);
    }
    const definition = {
      id: allocateId(project, "chip-def"),
      seriesId: series.id,
      name,
      version: series.definitionIds.length + 1,
      description,
      inputs: interfaceResult.inputs,
      outputs: interfaceResult.outputs,
      createdAt: new Date().toISOString(),
      circuitSnapshot: normalizeWorkspace({
        id: `snapshot-${Date.now()}-${name}`,
        name: `${name} Snapshot`,
        nodes: deepClone(workspace.nodes),
        wires: deepClone(workspace.wires),
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

  function toggleSwitchNode(node) {
    const current = parseBits(node.config.value, node.config.width);
    const toggled = current.map((bit) => !bit);
    node.config.value = formatBits(toggled, node.config.width);
    setStatus(`${node.config.label} is nu ${node.config.value}.`);
  }

  function toggleClockNode(node) {
    node.config.value = node.config.value === "1" ? "0" : "1";
    setStatus(`${node.config.label} is nu ${node.config.value}.`);
  }

  function toggleWorkspaceClocks() {
    const workspace = getCurrentWorkspace();
    let toggled = 0;
    workspace.nodes.forEach((node) => {
      if (node.type === "clock") {
        node.config.value = node.config.value === "1" ? "0" : "1";
        toggled += 1;
      }
    });
    setStatus(toggled ? `${toggled} clock node(s) omgezet.` : "Geen clock nodes in deze workspace.");
    render();
  }

  function stepRegisters() {
    const workspace = getCurrentWorkspace();
    const updates = collectRegisterUpdates(
      workspace,
      {},
      `workspace:${workspace.id}`,
      new Set()
    );
    updates.forEach((update) => {
      state.project.runtime.registerStates[update.key] = { bits: update.bits };
    });
    setStatus(updates.length ? `${updates.length} register(s) bijgewerkt.` : "Geen registers gevonden.");
    render();
  }

  function collectRegisterUpdates(circuit, externalInputs, path, recursionTrail) {
    const evaluation = evaluateCircuit(circuit, externalInputs, path, recursionTrail);
    const updates = [];
    circuit.nodes.forEach((node) => {
      if (node.type === "register") {
        const nodeInputs = evaluation.nodeSignals[node.id] ? evaluation.nodeSignals[node.id].inputs : {};
        const clockHigh = bitsToBoolean(nodeInputs.CLK || zeroBits(1));
        const resetHigh = bitsToBoolean(nodeInputs.RST || zeroBits(1));
        const storedKey = makeRegisterStateKey(path, node.id);
        const currentBits = state.project.runtime.registerStates[storedKey]
          ? ensureWidth(state.project.runtime.registerStates[storedKey].bits, node.config.width)
          : parseBits(node.config.resetValue, node.config.width);
        let nextBits = currentBits;
        if (resetHigh) {
          nextBits = parseBits(node.config.resetValue, node.config.width);
        } else if (clockHigh) {
          nextBits = ensureWidth(nodeInputs.D || zeroBits(node.config.width), node.config.width);
        }
        updates.push({ key: storedKey, bits: nextBits });
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

  function resetRuntimeState() {
    state.project.runtime.registerStates = {};
    state.project.workspaces.forEach((workspace) => {
      workspace.nodes.forEach((node) => {
        if (node.type === "clock") {
          node.config.value = "0";
        }
      });
    });
    setStatus("Runtime state gereset. Clocks staan weer op 0 en registers op hun resetwaarde.");
    render();
  }

  function exportProject() {
    const blob = new Blob([JSON.stringify(state.project, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "forge-logic-project.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Project geëxporteerd als JSON.");
  }

  function importProjectFromFile(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = normalizeProject(JSON.parse(reader.result));
        state.project = imported;
        state.selectedNodeId = null;
        state.pendingConnection = null;
        setStatus(`Project "${file.name}" geïmporteerd.`);
        render();
      } catch (error) {
        console.error(error);
        setStatus("Import mislukt: ongeldig JSON-projectbestand.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handlePinClick(pinElement) {
    const direction = pinElement.dataset.pinDirection;
    const nodeId = pinElement.dataset.nodeId;
    const pinKey = pinElement.dataset.pinKey;

    if (direction === "output") {
      state.pendingConnection = { nodeId, pinKey, direction };
      render();
      return;
    }

    if (direction === "input" && state.pendingConnection) {
      const result = connectPins(
        state.pendingConnection.nodeId,
        state.pendingConnection.pinKey,
        nodeId,
        pinKey
      );
      state.pendingConnection = null;
      if (result.ok) {
        setStatus(result.message);
      } else {
        setStatus(result.message);
      }
      render();
      return;
    }

    state.pendingConnection = null;
    render();
  }

  function connectPins(fromNodeId, fromPin, toNodeId, toPin) {
    const workspace = getCurrentWorkspace();
    if (fromNodeId === toNodeId) {
      return { ok: false, message: "Een node kan niet op zichzelf worden aangesloten." };
    }

    const sourceNode = workspace.nodes.find((node) => node.id === fromNodeId);
    const targetNode = workspace.nodes.find((node) => node.id === toNodeId);
    if (!sourceNode || !targetNode) {
      return { ok: false, message: "Kon de nodes voor deze verbinding niet vinden." };
    }

    const sourcePin = getNodeSpec(sourceNode).outputs.find((pin) => pin.key === fromPin);
    const targetPin = getNodeSpec(targetNode).inputs.find((pin) => pin.key === toPin);
    if (!sourcePin || !targetPin) {
      return { ok: false, message: "Ongeldige pinselectie." };
    }

    if (sourcePin.width !== targetPin.width) {
      return {
        ok: false,
        message: `Bitbreedte mismatch: ${sourcePin.width}-bit kan niet naar ${targetPin.width}-bit.`,
      };
    }

    const existing = workspace.wires.find((wire) => wire.toNodeId === toNodeId && wire.toPin === toPin);
    if (existing) {
      return { ok: false, message: "Deze input-pin heeft al een driver." };
    }

    workspace.wires.push({
      id: allocateId(state.project, "wire"),
      fromNodeId,
      fromPin,
      toNodeId,
      toPin,
    });
    return { ok: true, message: "Verbinding toegevoegd." };
  }

  function deleteNode(nodeId) {
    const workspace = getCurrentWorkspace();
    const node = workspace.nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    workspace.nodes = workspace.nodes.filter((item) => item.id !== nodeId);
    workspace.wires = workspace.wires.filter(
      (wire) => wire.fromNodeId !== nodeId && wire.toNodeId !== nodeId
    );
    state.selectedNodeId = null;
    state.pendingConnection = null;
    setStatus(`Node "${node.config.label || node.type}" verwijderd.`);
    render();
  }

  function removeWire(wireId) {
    const workspace = getCurrentWorkspace();
    workspace.wires = workspace.wires.filter((wire) => wire.id !== wireId);
    setStatus("Verbinding verwijderd.");
    render();
  }

  function handleDragMove(event) {
    if (state.dragging && event.pointerId === state.dragging.pointerId) {
      const workspace = getCurrentWorkspace();
      const node = workspace.nodes.find((item) => item.id === state.dragging.nodeId);
      if (!node) {
        return;
      }
      event.preventDefault();
      const deltaX = event.clientX - state.dragging.startClientX;
      const deltaY = event.clientY - state.dragging.startClientY;
      node.x = Math.max(20, state.dragging.startNodeX + deltaX);
      node.y = Math.max(20, state.dragging.startNodeY + deltaY);
      syncDraggedNodePosition(node);
      renderWires(getCurrentWorkspace(), state.lastEvaluation || evaluateWorkspace(getCurrentWorkspace()));
      return;
    }

    if (state.panningCanvas && event.pointerId === state.panningCanvas.pointerId) {
      event.preventDefault();
      const deltaX = event.clientX - state.panningCanvas.startClientX;
      const deltaY = event.clientY - state.panningCanvas.startClientY;
      dom.canvas.scrollLeft = state.panningCanvas.startScrollLeft - deltaX;
      dom.canvas.scrollTop = state.panningCanvas.startScrollTop - deltaY;
    }
  }

  function stopDragging(event) {
    if (state.dragging) {
      if (event && event.pointerId != null && event.pointerId !== state.dragging.pointerId) {
        return;
      }
      state.dragging = null;
      render();
      return;
    }

    if (state.panningCanvas) {
      if (event && event.pointerId != null && event.pointerId !== state.panningCanvas.pointerId) {
        return;
      }
      state.panningCanvas = null;
    }
  }

  function syncDraggedNodePosition(node) {
    const element = dom.nodeLayer.querySelector(`article[data-node-id="${node.id}"]`);
    if (!element) {
      return;
    }
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
  }

  function getNodeConnections(workspace, nodeId) {
    return workspace.wires
      .filter((wire) => wire.fromNodeId === nodeId || wire.toNodeId === nodeId)
      .map((wire) => {
        const source = workspace.nodes.find((node) => node.id === wire.fromNodeId);
        const target = workspace.nodes.find((node) => node.id === wire.toNodeId);
        return {
          wireId: wire.id,
          label: `${source ? source.config.label || source.type : wire.fromNodeId}.${wire.fromPin} → ${
            target ? target.config.label || target.type : wire.toNodeId
          }.${wire.toPin}`,
        };
      });
  }

  function countChipDependencies(circuit) {
    return circuit.nodes.filter((node) => node.type === "chip-instance").length;
  }

  function evaluateWorkspace(workspace) {
    return evaluateCircuit(workspace, {}, `workspace:${workspace.id}`, new Set());
  }

  function evaluateCircuit(circuit, externalInputs, path, recursionTrail) {
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
          message: "Een verbinding verwijst naar een ontbrekende node.",
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
          message: "Een verbinding gebruikt een ongeldige pin.",
          wireIds: [wire.id],
          nodeIds: [wire.fromNodeId, wire.toNodeId],
        });
        wireSignals[wire.id] = { invalid: true, high: false };
        return;
      }
      if (sourcePin.width !== targetPin.width) {
        errors.push({
          message: `Bitbreedte mismatch tussen ${sourceNode.config.label || sourceNode.type} en ${
            targetNode.config.label || targetNode.type
          }.`,
          wireIds: [wire.id],
          nodeIds: [wire.fromNodeId, wire.toNodeId],
        });
        wireSignals[wire.id] = { invalid: true, high: false };
      }
      const inputKey = `${wire.toNodeId}:${wire.toPin}`;
      if (incomingWireByPin.has(inputKey)) {
        errors.push({
          message: `Input ${wire.toPin} van ${targetNode.config.label || targetNode.type} heeft meerdere drivers.`,
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
          message: `Combinatorische lus gedetecteerd rond ${node.config.label || node.type}.`,
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
        const stored = state.project.runtime.registerStates[registerKey];
        outputs.Q = stored
          ? ensureWidth(stored.bits, node.config.width)
          : parseBits(node.config.resetValue, node.config.width);
      } else if (node.type === "chip-instance") {
        const definition = getChipDefinition(node.config.definitionId);
        if (!definition) {
          errors.push({
            message: `Chipdefinitie ontbreekt voor ${node.config.label || node.type}.`,
            nodeIds: [node.id],
          });
          outputs = makeZeroOutputs(spec.outputs);
        } else if (recursionTrail.has(definition.id)) {
          errors.push({
            message: `Recursieve chipdependency gedetecteerd bij ${definition.name}.`,
            nodeIds: [node.id],
          });
          outputs = makeZeroOutputs(spec.outputs);
        } else {
          const childInputs = {};
          spec.inputs.forEach((pin) => {
            childInputs[pin.key] = ensureWidth(inputValues[pin.key], pin.width);
          });
          const childEvaluation = evaluateCircuit(
            definition.circuitSnapshot,
            childInputs,
            `${path}/${node.id}`,
            new Set([...recursionTrail, definition.id])
          );
          childEvaluation.errors.forEach((error) => {
            errors.push(error);
          });
          outputs = {};
          spec.outputs.forEach((pin) => {
            outputs[pin.key] = ensureWidth(childEvaluation.interfaceOutputs[pin.key], pin.width);
          });
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
          nodeSignals[node.id] && nodeSignals[node.id].inputs ? nodeSignals[node.id].inputs.IN : zeroBits(node.config.width),
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
          nodeSignals[node.id].outputs[pin.key] = ensureWidth(resolveNodeOutputs(node.id)[pin.key], pin.width);
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

  function makeRegisterStateKey(path, nodeId) {
    return `${path}/register:${nodeId}`;
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

  function getPinWidth(pins, key) {
    const pin = pins.find((item) => item.key === key);
    return pin ? pin.width : 1;
  }

  function setStatus(message) {
    dom.statusLine.textContent = message;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
