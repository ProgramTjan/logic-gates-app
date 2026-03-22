import {
  bitwiseBinary,
  bitwiseUnary,
  bitsToBoolean,
  clampSplitWidth,
  clampWidth,
  ensureWidth,
  formatBits,
  normalizeBitString,
  parseBits,
  zeroBits,
} from "./src/sim/bits.js";
import { clamp, deepClone } from "./src/lib/utils.js";
import {
  createProject as createProjectState,
  loadProject as loadProjectState,
  normalizeProject as normalizeProjectState,
  normalizeWorkspace as normalizeWorkspaceState,
  normalizeWorkspaceMeta as normalizeWorkspaceMetaState,
  saveProject as saveProjectState,
} from "./src/state/project.js";
import { BUILTIN_PARTS } from "./src/data/builtinParts.js";
import { CHALLENGES } from "./src/data/challenges.js";
import { createChallengeVerifier } from "./src/challenges/verification.js";
import { createChipDefinitionsService } from "./src/chips/definitions.js";
import { createCanvasRenderers } from "./src/ui/canvas.js";
import { createInteractionHandlers } from "./src/ui/events.js";
import { createInspectorRenderers } from "./src/ui/inspector.js";
import { createWorkspaceActionHandlers } from "./src/ui/workspace-actions.js";

(function () {
  const WORKSPACE_BASE_WIDTH = 1800;
  const WORKSPACE_BASE_HEIGHT = 1200;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 2;
  const ZOOM_STEP = 0.25;
  const LONG_PRESS_DELAY = 450;
  const LONG_PRESS_MOVE_THRESHOLD = 8;

  const dom = {
    builtinPalette: document.getElementById("builtin-palette"),
    workspaceList: document.getElementById("workspace-list"),
    chipLibrary: document.getElementById("chip-library"),
    challengeList: document.getElementById("challenge-list"),
    challengeStartButton: document.getElementById("challenge-start-button"),
    challengeSubmitButton: document.getElementById("challenge-submit-button"),
    workspaceTitle: document.getElementById("workspace-title"),
    connectionStatus: document.getElementById("connection-status"),
    nodeLayer: document.getElementById("node-layer"),
    wireLayer: document.getElementById("wire-layer"),
    workspaceStage: document.getElementById("workspace-stage"),
    workspaceStageViewport: document.getElementById("workspace-stage-viewport"),
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
    zoomOutButton: document.getElementById("zoom-out-button"),
    zoomResetButton: document.getElementById("zoom-reset-button"),
    zoomInButton: document.getElementById("zoom-in-button"),
    zoomValue: document.getElementById("zoom-value"),
    undoButton: document.getElementById("undo-button"),
    redoButton: document.getElementById("redo-button"),
  };

  const UNDO_LIMIT = 50;

  const state = {
    project: loadProject(),
    selectedNodeId: null,
    quickDeleteNodeId: null,
    selectedChallengeId: null,
    pendingConnection: null,
    dragging: null,
    longPress: null,
    panningCanvas: null,
    lastEvaluation: null,
    zoom: 1,
    undoStack: [],
    redoStack: [],
    inspectorUndoPushed: false,
  };
  const chipDefinitionsService = createChipDefinitionsService({
    allocateId,
    createWorkspace,
    createNode,
    createChipInstance,
    normalizeNode,
    normalizeWorkspace,
    deepClone,
  });
  const challengeVerifier = createChallengeVerifier({
    deepClone,
    parseBits,
    formatBits,
    evaluateCircuit: (circuit, externalInputs, path, recursionTrail) =>
      evaluateCircuit(circuit, externalInputs, path, recursionTrail),
    collectRegisterUpdates: (circuit, externalInputs, path, recursionTrail) =>
      collectRegisterUpdates(circuit, externalInputs, path, recursionTrail),
    getRuntimeRegisterStates: () => state.project.runtime.registerStates,
    setRuntimeRegisterStates: (next) => {
      state.project.runtime.registerStates = next;
    },
  });
  const canvasRenderers = createCanvasRenderers({
    dom,
    state,
    getCurrentWorkspace,
    getNodeSpec,
    getPinWidth,
    makeRegisterStateKey,
    formatBits,
    parseBits,
    escapeHtml,
    escapeAttribute,
  });
  const interactionHandlers = createInteractionHandlers({
    dom,
    state,
    render: () => render(),
    pushUndo,
    getCurrentWorkspace,
    deleteNode,
    toggleSwitchNode,
    toggleClockNode,
    handlePinClick,
    evaluateWorkspace,
    canvasRenderers,
    longPressDelay: LONG_PRESS_DELAY,
    longPressMoveThreshold: LONG_PRESS_MOVE_THRESHOLD,
  });
  const inspectorRenderers = createInspectorRenderers({
    dom,
    state,
    getCurrentWorkspace,
    getNodeSpec,
    getNodeConnections,
    getChipDefinition,
    escapeHtml,
    escapeAttribute,
  });
  const workspaceActions = createWorkspaceActionHandlers({
    dom,
    state,
    challenges: CHALLENGES,
    render: () => render(),
    renderChallenges: () => renderChallenges(),
    getCurrentWorkspace,
    getActiveWorkspaceChallenge,
    setStatus,
    addPartToWorkspace,
    duplicateWorkspace,
    deleteWorkspace,
    editChipAsNewVersion,
    cloneChipToWorkspace,
    openChallengeWorkspace,
    submitChallenge,
  });
  let appStarted = false;

  window.ForgeLogicApp = {
    start() {
      if (appStarted) {
        return;
      }
      appStarted = true;
      initializeApp();
    },
  };

  function initializeApp() {
    try {
      render();
      bindEvents();
    } catch (error) {
      console.error("Forge Logic bootstrap failed, resetting project.", error);
      state.project = createProject();
      state.selectedNodeId = null;
      state.quickDeleteNodeId = null;
      state.pendingConnection = null;
      state.dragging = null;
      state.longPress = null;
      state.panningCanvas = null;
      state.lastEvaluation = null;
      render();
      bindEvents();
      setStatus("Project reset na laadfout. Je werkt nu in een schoon project.");
    }
  }

  // =============================================
  // UNDO / REDO
  // =============================================

  function pushUndo() {
    const workspace = getCurrentWorkspace();
    if (!workspace) return;
    state.undoStack.push({
      workspaceId: workspace.id,
      snapshot: deepClone(workspace),
    });
    if (state.undoStack.length > UNDO_LIMIT) {
      state.undoStack.shift();
    }
    state.redoStack = [];
    state.inspectorUndoPushed = false;
  }

  function undo() {
    if (!state.undoStack.length) return;
    const entry = state.undoStack.pop();
    const workspace = state.project.workspaces.find((w) => w.id === entry.workspaceId);
    if (!workspace) return;
    state.redoStack.push({
      workspaceId: workspace.id,
      snapshot: deepClone(workspace),
    });
    Object.assign(workspace, entry.snapshot);
    state.selectedNodeId = null;
    state.pendingConnection = null;
    state.quickDeleteNodeId = null;
    state.inspectorUndoPushed = false;
    setStatus("Ongedaan gemaakt.");
    render();
  }

  function redo() {
    if (!state.redoStack.length) return;
    const entry = state.redoStack.pop();
    const workspace = state.project.workspaces.find((w) => w.id === entry.workspaceId);
    if (!workspace) return;
    state.undoStack.push({
      workspaceId: workspace.id,
      snapshot: deepClone(workspace),
    });
    Object.assign(workspace, entry.snapshot);
    state.selectedNodeId = null;
    state.pendingConnection = null;
    state.quickDeleteNodeId = null;
    state.inspectorUndoPushed = false;
    setStatus("Opnieuw uitgevoerd.");
    render();
  }

  function updateUndoRedoButtons() {
    dom.undoButton.disabled = state.undoStack.length === 0;
    dom.redoButton.disabled = state.redoStack.length === 0;
  }

  function bindEvents() {
    dom.undoButton.addEventListener("click", undo);
    dom.redoButton.addEventListener("click", redo);
    dom.newWorkspaceButton.addEventListener("click", createWorkspaceFromPrompt);
    dom.duplicateWorkspaceButton.addEventListener("click", duplicateCurrentWorkspace);
    dom.saveChipButton.addEventListener("click", saveCurrentWorkspaceAsChip);
    dom.toggleClocksButton.addEventListener("click", toggleWorkspaceClocks);
    dom.stepRegistersButton.addEventListener("click", stepRegisters);
    dom.resetStateButton.addEventListener("click", resetRuntimeState);
    dom.exportButton.addEventListener("click", exportProject);
    dom.importButton.addEventListener("click", () => dom.importInput.click());
    dom.importInput.addEventListener("change", importProjectFromFile);
    dom.zoomOutButton.addEventListener("click", () => changeZoom(-ZOOM_STEP));
    dom.zoomResetButton.addEventListener("click", () => setZoom(1));
    dom.zoomInButton.addEventListener("click", () => changeZoom(ZOOM_STEP));
    dom.challengeStartButton.addEventListener("click", workspaceActions.startSelectedChallenge);
    dom.challengeSubmitButton.addEventListener("click", workspaceActions.submitCurrentChallenge);

    dom.builtinPalette.addEventListener("click", workspaceActions.handleBuiltinPaletteClick);
    dom.workspaceList.addEventListener("click", workspaceActions.handleWorkspaceListClick);
    dom.chipLibrary.addEventListener("click", workspaceActions.handleChipLibraryClick);
    dom.challengeList.addEventListener("click", workspaceActions.handleChallengeListClick);
    dom.nodeLayer.addEventListener("click", interactionHandlers.handleNodeLayerClick);
    dom.nodeLayer.addEventListener("pointerdown", interactionHandlers.handleNodeLayerPointerDown);
    dom.canvas.addEventListener("pointerdown", interactionHandlers.handleCanvasPointerDown);
    dom.inspector.addEventListener("focusin", handleInspectorFocusIn);
    dom.inspector.addEventListener("input", handleInspectorInput);
    dom.inspector.addEventListener("click", handleInspectorClick);

    document.addEventListener("pointermove", interactionHandlers.handleDragMove);
    document.addEventListener("pointerup", interactionHandlers.stopDragging);
    document.addEventListener("pointercancel", interactionHandlers.stopDragging);
    document.addEventListener("keydown", handleKeyboardShortcuts);
  }

  function loadProject() {
    return loadProjectState(getProjectStateDeps(), localStorage);
  }

  function saveProject() {
    saveProjectState(state.project, localStorage);
  }

  function createProject() {
    return createProjectState(getProjectStateDeps());
  }

  function normalizeProject(project) {
    return normalizeProjectState(project, getProjectStateDeps());
  }

  function normalizeWorkspace(workspace) {
    return normalizeWorkspaceState(workspace, { normalizeNode });
  }

  function normalizeWorkspaceMeta(meta) {
    return normalizeWorkspaceMetaState(meta);
  }

  function getProjectStateDeps() {
    return {
      createWorkspace,
      createNode,
      ensureStarterChips,
      normalizeNode,
    };
  }

  function ensureStarterChips(project) {
    // Avoid touching chipDefinitionsService during initial state bootstrap.
    createChipDefinitionsService({
      allocateId,
      createWorkspace,
      createNode,
      createChipInstance,
      normalizeNode,
      normalizeWorkspace,
      deepClone,
    }).ensureStarterChips(project);
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
      case "splitter":
        node.config = { label: "Split", width: 4, highWidth: 2 };
        break;
      case "joiner":
        node.config = { label: "Join", width: 4, highWidth: 2 };
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
    } else if (normalized.type === "splitter" || normalized.type === "joiner") {
      normalized.config.label = normalized.config.label || (normalized.type === "splitter" ? "Split" : "Join");
      normalized.config.width = Math.max(2, clampWidth(normalized.config.width));
      normalized.config.highWidth = clampSplitWidth(normalized.config.highWidth, normalized.config.width);
    } else if (normalized.type === "chip-instance") {
      normalized.config.label = normalized.config.label || "Chip";
      normalized.config.definitionId = normalized.config.definitionId || "";
    }

    return normalized;
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
    if (node.type === "splitter") {
      const lowWidth = node.config.width - node.config.highWidth;
      return {
        title: node.config.label,
        subtitle: `Bus Split • ${node.config.width}-bit`,
        inputs: [{ key: "IN", name: "IN", width: node.config.width }],
        outputs: [
          { key: "HI", name: `HI(${node.config.highWidth})`, width: node.config.highWidth },
          { key: "LO", name: `LO(${lowWidth})`, width: lowWidth },
        ],
      };
    }
    if (node.type === "joiner") {
      const lowWidth = node.config.width - node.config.highWidth;
      return {
        title: node.config.label,
        subtitle: `Bus Join • ${node.config.width}-bit`,
        inputs: [
          { key: "HI", name: `HI(${node.config.highWidth})`, width: node.config.highWidth },
          { key: "LO", name: `LO(${lowWidth})`, width: lowWidth },
        ],
        outputs: [{ key: "OUT", name: "OUT", width: node.config.width }],
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
    renderChallenges();

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
    inspectorRenderers.renderInspector();
    inspectorRenderers.renderErrors();
    updateUndoRedoButtons();
    saveProject();
  }

  function renderBuiltinPalette() {
    const builtinMarkup = BUILTIN_PARTS.map(
      (part) =>
        `<button class="palette-button" type="button" data-part-type="${part.type}">
          ${escapeHtml(part.label)}
          <small>${escapeHtml(part.copy)}</small>
        </button>`
    ).join("");

    const latestDefinitions = state.project.chipSeries
      .map((series) => getLatestChipDefinitionForSeries(series.id))
      .filter(Boolean)
      .sort((left, right) => left.name.localeCompare(right.name));

    const chipMarkup = latestDefinitions.length
      ? latestDefinitions
          .map(
            (definition) => `<button class="palette-button chip-palette-button" type="button" data-place-chip="${definition.id}">
              ${escapeHtml(definition.name)}
              <small>${escapeHtml(`${definition.inputs.length} in • ${definition.outputs.length} out • v${definition.version}`)}</small>
            </button>`
          )
          .join("")
      : '<div class="palette-section-empty">Sla eerst een chip op via `Snapshot`.</div>';

    dom.builtinPalette.innerHTML = `
      <div class="palette-section-title">Basic Parts</div>
      ${builtinMarkup}
      <div class="palette-section-title">Saved Chips</div>
      ${chipMarkup}
    `;
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

  function renderChallenges() {
    if (!state.selectedChallengeId && CHALLENGES.length) {
      state.selectedChallengeId = CHALLENGES[0].id;
    }
    const userDefinitions = state.project.chipDefinitions.filter(
      (definition) => !challengeVerifier.isStarterDefinition(definition)
    );
    const challengeStates = CHALLENGES.map((challenge) => ({
      challenge,
      result: challengeVerifier.evaluateChallengeResult(challenge, userDefinitions),
    }));
    const completedCount = challengeStates.filter((item) => item.result.done).length;
    dom.challengeList.innerHTML = [
      `<div class="challenge-card">
        <div class="challenge-head">
          <div>
            <h3>Progress</h3>
            <div class="challenge-kicker">${completedCount}/${CHALLENGES.length} klaar</div>
          </div>
          <span class="challenge-status">${Math.round((completedCount / CHALLENGES.length) * 100)}%</span>
        </div>
      </div>`,
      ...challengeStates.map(({ challenge, result }) => renderChallengeCard(challenge, result)),
    ].join("");
    workspaceActions.updateChallengeStartButton();
    workspaceActions.updateChallengeSubmitButton();
  }

  function renderChallengeCard(challenge, result) {
    const expanded = state.selectedChallengeId === challenge.id;
    return `<article class="challenge-card ${result.done ? "done" : ""} ${
      expanded ? "selected" : ""
    }" data-select-challenge="${challenge.id}">
      <div class="challenge-head">
        <div>
          <h3>${escapeHtml(challenge.title)}</h3>
          <div class="challenge-kicker">${escapeHtml(
            `${challenge.phase} • ${challenge.inputs} in / ${challenge.outputs} out`
          )}</div>
        </div>
        <span class="challenge-status">${escapeHtml(result.label)}</span>
      </div>
      <p class="challenge-copy">${escapeHtml(challenge.description)}</p>
      <p class="challenge-copy">${escapeHtml(result.summary)}</p>
      <div class="challenge-actions">
        <button class="ghost-button" type="button" data-open-challenge="${challenge.id}">Start</button>
        <button class="ghost-button" type="button" data-submit-challenge="${challenge.id}">Submit</button>
        <button class="ghost-button" type="button" data-toggle-challenge="${challenge.id}">${
          expanded ? "Hide Details" : "Show Details"
        }</button>
      </div>
      ${
        expanded
          ? `<div class="challenge-details">
              <div class="challenge-kicker">Hints</div>
              <ul class="challenge-hints">
                ${challenge.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }
    </article>`;
  }

  function renderCanvas() {
    const workspace = getCurrentWorkspace();
    const evaluation = state.lastEvaluation || { nodeSignals: {}, wireSignals: {}, errors: [] };
    const invalidNodeIds = new Set(evaluation.errors.flatMap((error) => error.nodeIds || []));
    applyWorkspaceZoom();
    dom.emptyState.hidden = workspace.nodes.length > 0;

    dom.nodeLayer.innerHTML = workspace.nodes
      .map((node) => canvasRenderers.renderNode(node, evaluation.nodeSignals[node.id], invalidNodeIds.has(node.id)))
      .join("");

    canvasRenderers.renderWires(workspace, evaluation);
    canvasRenderers.updateConnectionStatus();
  }

  function applyWorkspaceZoom() {
    dom.workspaceStage.style.transform = `scale(${state.zoom})`;
    dom.workspaceStageViewport.style.width = `${WORKSPACE_BASE_WIDTH * state.zoom}px`;
    dom.workspaceStageViewport.style.height = `${WORKSPACE_BASE_HEIGHT * state.zoom}px`;
    const percent = `${Math.round(state.zoom * 100)}%`;
    dom.zoomValue.textContent = percent;
    dom.zoomResetButton.textContent = percent;
  }

  function changeZoom(delta) {
    setZoom(state.zoom + delta);
  }

  function setZoom(nextZoom) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(nextZoom * 100) / 100));
    if (clamped === state.zoom) {
      return;
    }
    const previousZoom = state.zoom;
    const centerX = dom.canvas.scrollLeft + dom.canvas.clientWidth / 2;
    const centerY = dom.canvas.scrollTop + dom.canvas.clientHeight / 2;
    const logicalCenterX = centerX / previousZoom;
    const logicalCenterY = centerY / previousZoom;
    state.zoom = clamped;
    applyWorkspaceZoom();
    dom.canvas.scrollLeft = Math.max(0, logicalCenterX * state.zoom - dom.canvas.clientWidth / 2);
    dom.canvas.scrollTop = Math.max(0, logicalCenterY * state.zoom - dom.canvas.clientHeight / 2);
    canvasRenderers.renderWires(
      getCurrentWorkspace(),
      state.lastEvaluation || evaluateWorkspace(getCurrentWorkspace())
    );
  }

  function handleInspectorFocusIn(event) {
    const input = event.target.closest("[data-config-key]");
    if (!input) return;
    if (!state.inspectorUndoPushed) {
      pushUndo();
      state.inspectorUndoPushed = true;
    }
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
      if (node.type === "splitter" || node.type === "joiner") {
        node.config.width = Math.max(2, width);
        node.config.highWidth = clampSplitWidth(node.config.highWidth, node.config.width);
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
    if ((node.type === "splitter" || node.type === "joiner") && key === "highWidth") {
      node.config.highWidth = clampSplitWidth(node.config.highWidth, node.config.width);
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
    const tagName = document.activeElement ? document.activeElement.tagName : "";
    const inInput = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";

    const ctrl = event.ctrlKey || event.metaKey;

    if (ctrl && event.key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }

    if (ctrl && (event.key === "y" || (event.key === "z" && event.shiftKey))) {
      event.preventDefault();
      redo();
      return;
    }

    if (inInput) return;

    if (event.key === "Delete" || event.key === "Backspace") {
      if (state.selectedNodeId) {
        deleteNode(state.selectedNodeId);
      }
    }
  }

  function addPartToWorkspace(partType, definitionId) {
    const workspace = getCurrentWorkspace();
    const position = getSuggestedNodePosition(workspace);
    const node =
      partType === "chip-instance"
        ? createChipInstance(state.project, definitionId, position)
        : createNode(state.project, partType, position);
    pushUndo();
    workspace.nodes.push(node);
    state.selectedNodeId = node.id;
    setStatus(`${node.config.label || node.type} toegevoegd aan ${workspace.name}.`);
    render();
  }

  function getSuggestedNodePosition(workspace) {
    const margin = 24;
    const selectedNode = workspace.nodes.find((item) => item.id === state.selectedNodeId);
    const anchor = selectedNode
      ? { x: selectedNode.x + 110, y: selectedNode.y + 70 }
      : getWorkspaceClusterAnchor(workspace);
    const stagger = workspace.nodes.length % 4;
    return {
      x: clamp(anchor.x + stagger * 18, margin, WORKSPACE_BASE_WIDTH - 140),
      y: clamp(anchor.y + stagger * 14, margin, WORKSPACE_BASE_HEIGHT - 110),
    };
  }

  function getWorkspaceClusterAnchor(workspace) {
    if (!workspace.nodes.length) {
      return { x: 120, y: 110 };
    }

    const bounds = workspace.nodes.reduce(
      (result, node) => ({
        minX: Math.min(result.minX, node.x),
        minY: Math.min(result.minY, node.y),
        maxX: Math.max(result.maxX, node.x),
        maxY: Math.max(result.maxY, node.y),
      }),
      {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      }
    );

    return {
      x: Math.min(bounds.maxX + 110, WORKSPACE_BASE_WIDTH - 140),
      y: Math.min(bounds.maxY + 70, WORKSPACE_BASE_HEIGHT - 110),
    };
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

  function openChallengeWorkspace(challengeId) {
    const challenge = CHALLENGES.find((item) => item.id === challengeId);
    if (!challenge) {
      return;
    }
    const workspace = createWorkspace(state.project, `${challenge.title} Draft`, null, {
      challengeId,
    });
    populateChallengeWorkspace(workspace, challenge);
    state.project.workspaces.push(workspace);
    state.project.currentWorkspaceId = workspace.id;
    state.selectedNodeId = null;
    state.selectedChallengeId = challengeId;
    setStatus(`Challenge-sheet geopend voor ${challenge.title}.`);
    render();
  }

  function getActiveWorkspaceChallenge() {
    const workspace = getCurrentWorkspace();
    if (!workspace || !workspace.meta || !workspace.meta.challengeId) {
      return null;
    }
    return CHALLENGES.find((item) => item.id === workspace.meta.challengeId) || null;
  }

  function populateChallengeWorkspace(workspace, challenge) {
    const template = challenge.template || { inputs: [], outputs: [] };
    const inputStep = Math.max(90, Math.floor(420 / Math.max(1, template.inputs.length)));
    const outputStep = Math.max(90, Math.floor(420 / Math.max(1, template.outputs.length)));

    template.inputs.forEach((name, index) => {
      workspace.nodes.push(
        chipDefinitionsService.createConfiguredNode(
          state.project,
          "input-pin",
          { x: 120, y: 120 + index * inputStep },
          { label: name, width: 1, previewValue: "0" }
        )
      );
    });

    template.outputs.forEach((name, index) => {
      workspace.nodes.push(
        chipDefinitionsService.createConfiguredNode(
          state.project,
          "output-pin",
          { x: 760, y: 120 + index * outputStep },
          { label: name, width: 1 }
        )
      );
    });
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

  function saveCurrentWorkspaceAsChip(options = {}) {
    const workspace = getCurrentWorkspace();
    const interfaceResult = chipDefinitionsService.extractChipInterface(workspace);
    if (interfaceResult.errors.length) {
      setStatus(interfaceResult.errors[0].message);
      render();
      return null;
    }

    const sourceSeries =
      workspace.meta && workspace.meta.sourceChipSeriesId
        ? getChipSeries(workspace.meta.sourceChipSeriesId)
        : null;
    const {
      preferredName = "",
      preferredDescription = "",
      promptForName = true,
      promptForDescription = true,
    } = options;
    const suggestedName =
      preferredName ||
      (sourceSeries ? sourceSeries.name : workspace.name.replace(/\s+copy$/i, "").trim()) ||
      "Custom Chip";
    const chipName = promptForName ? window.prompt("Chip name", suggestedName) : suggestedName;
    if (!chipName) {
      return null;
    }
    const trimmedName = chipName.trim();
    if (!trimmedName) {
      return null;
    }
    const defaultDescription =
      preferredDescription || `Snapshot vanuit workspace "${workspace.name}"`;
    const description = promptForDescription
      ? window.prompt("Beschrijving van deze chip", defaultDescription) || ""
      : defaultDescription;

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
    return definition;
  }

  function submitChallenge(challengeId) {
    const challenge = CHALLENGES.find((item) => item.id === challengeId);
    const workspace = getCurrentWorkspace();
    if (!challenge || !workspace) {
      return;
    }
    if (!workspace.meta || workspace.meta.challengeId !== challengeId) {
      setStatus(`Open eerst de challenge-sheet voor ${challenge.title} en lever die daarna in.`);
      render();
      return;
    }

    const definition = saveCurrentWorkspaceAsChip({
      preferredName: challenge.names[0],
      preferredDescription: `Challenge submission for ${challenge.title}`,
      promptForName: false,
      promptForDescription: false,
    });
    if (!definition) {
      return;
    }

    const result = challengeVerifier.runChallengeVerification(challenge, definition);
    setStatus(
      result.done
        ? `Ingeleverd: ${challenge.title} is verified.`
        : `Ingeleverd: ${challenge.title} needs work. ${result.summary}`
    );
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

    pushUndo();
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
    pushUndo();
    workspace.nodes = workspace.nodes.filter((item) => item.id !== nodeId);
    workspace.wires = workspace.wires.filter(
      (wire) => wire.fromNodeId !== nodeId && wire.toNodeId !== nodeId
    );
    state.selectedNodeId = null;
    if (state.quickDeleteNodeId === nodeId) {
      state.quickDeleteNodeId = null;
    }
    state.pendingConnection = null;
    setStatus(`Node "${node.config.label || node.type}" verwijderd.`);
    render();
  }

  function removeWire(wireId) {
    const workspace = getCurrentWorkspace();
    pushUndo();
    workspace.wires = workspace.wires.filter((wire) => wire.id !== wireId);
    setStatus("Verbinding verwijderd.");
    render();
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
