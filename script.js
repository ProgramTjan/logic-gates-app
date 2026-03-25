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
import { createPanelRenderers } from "./src/ui/panels.js";
import { createSimulationEngine } from "./src/sim/evaluate.js";
import { normalizeNode, createNodeFactory } from "./src/model/nodes.js";
import { createChipsFactory } from "./src/model/chips.js";

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

  const { createNode } = createNodeFactory({ allocateId });
  const { createWorkspace, createChipInstance } = createChipsFactory({
    allocateId,
    getChipDefinition,
    normalizeNode,
    deepClone,
    normalizeWorkspaceMeta,
  });

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
  const simulationEngine = createSimulationEngine({
    getNodeSpec,
    getChipDefinition,
    getRegisterStates: () => state.project.runtime.registerStates,
    zeroBits,
    bitsToBoolean,
    formatBits,
    parseBits,
    ensureWidth,
    bitwiseUnary,
    bitwiseBinary,
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
  const panelRenderers = createPanelRenderers({
    dom,
    state,
    BUILTIN_PARTS,
    CHALLENGES,
    getChipSeries,
    getLatestChipDefinitionForSeries,
    countChipDependencies,
    challengeVerifier,
    workspaceActions,
    escapeHtml,
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
    panelRenderers.renderBuiltinPalette();
    panelRenderers.renderWorkspaceList(getCurrentWorkspace());
    panelRenderers.renderChipLibrary();
    panelRenderers.renderChallenges();

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
    return simulationEngine.collectRegisterUpdates(circuit, externalInputs, path, recursionTrail);
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
    return simulationEngine.evaluateWorkspace(workspace);
  }

  function evaluateCircuit(circuit, externalInputs, path, recursionTrail) {
    return simulationEngine.evaluateCircuit(circuit, externalInputs, path, recursionTrail);
  }

  function makeRegisterStateKey(path, nodeId) {
    return simulationEngine.makeRegisterStateKey(path, nodeId);
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
