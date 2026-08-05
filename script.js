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
import { clamp, deepClone, debounce } from "./src/lib/utils.js";
import {
  createProject as createProjectState,
  loadProject as loadProjectState,
  normalizeProject as normalizeProjectState,
  normalizeWorkspace as normalizeWorkspaceState,
  normalizeWorkspaceMeta as normalizeWorkspaceMetaState,
  saveProject as saveProjectState,
  listBackups,
  restoreBackup,
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
import {
  normalizeNode,
  createNodeFactory,
  clampRomAddressWidth,
  normalizeRomProgram,
} from "./src/model/nodes.js";
import { createChipsFactory } from "./src/model/chips.js";
import { createNodeSpecFactory } from "./src/model/nodespec.js";
import { createRenderOrchestrator } from "./src/ui/render.js";
import { createEventBinder } from "./src/ui/boot.js";
import { createAppModals } from "./src/ui/app-modal.js";
import { createTutorial } from "./src/ui/tutorial.js";
import { createCourseRenderers } from "./src/ui/course.js";
import { S } from "./src/data/strings.js";
import { createUndoManager } from "./src/actions/undo.js";
import { createCircuitMutations } from "./src/actions/circuit-mutations.js";
import { createWorkspaceMutations } from "./src/actions/workspace-mutations.js";
import { createRuntimeActions } from "./src/actions/runtime.js";
import { createProjectIoActions } from "./src/actions/project-io.js";
import { createInspectorHandlers } from "./src/actions/inspector.js";
import { createKeyboardHandlers } from "./src/actions/keyboard.js";
import { createSelectionClipboard } from "./src/actions/clipboard.js";
import {
  encodeProjectForUrlHash,
  decodeProjectFromUrlHashPayload,
  parseSharePayloadFromHash,
} from "./src/lib/project-share.js";

(function () {
  const WORKSPACE_BASE_WIDTH = 1800;
  const WORKSPACE_BASE_HEIGHT = 1200;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 2;
  const ZOOM_STEP = 0.25;
  const LONG_PRESS_DELAY = 450;
  const LONG_PRESS_MOVE_THRESHOLD = 8;
  const SAVE_DEBOUNCE_MS = 300;

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
    clockPlayButton: document.getElementById("clock-play-button"),
    clockSpeedSelect: document.getElementById("clock-speed-select"),
    resetStateButton: document.getElementById("reset-state-button"),
    exportButton: document.getElementById("export-button"),
    importButton: document.getElementById("import-button"),
    restoreBackupButton: document.getElementById("restore-backup-button"),
    zoomOutButton: document.getElementById("zoom-out-button"),
    zoomResetButton: document.getElementById("zoom-reset-button"),
    zoomInButton: document.getElementById("zoom-in-button"),
    zoomValue: document.getElementById("zoom-value"),
    undoButton: document.getElementById("undo-button"),
    redoButton: document.getElementById("redo-button"),
    shareLinkButton: document.getElementById("share-link-button"),
    sharePasteButton: document.getElementById("share-paste-button"),
    onboardingOverlay: document.getElementById("onboarding-overlay"),
    onboardingDismiss: document.getElementById("onboarding-dismiss"),
    completionOverlay: document.getElementById("completion-overlay"),
    completionDismiss: document.getElementById("completion-dismiss"),
    completionSummary: document.getElementById("completion-summary"),
    courseView: document.getElementById("course-view"),
    workspaceFrame: document.querySelector(".workspace-frame"),
    appViewTabs: document.querySelectorAll("[data-app-view]"),
  };

  const { createNode } = createNodeFactory({ allocateId });
  const { createWorkspace, createChipInstance } = createChipsFactory({
    allocateId,
    getChipDefinition,
    normalizeNode,
    deepClone,
    normalizeWorkspaceMeta,
  });

  // Project wordt geladen ná challengeVerifier (nodig voor learner-migratie).
  const state = {
    project: null,
    selectedNodeId: null,
    selectedNodeIds: [],
    keyboardCaptureNodeId: null,
    clipboard: null,
    quickDeleteNodeId: null,
    quickDeleteWireId: null,
    selectedChallengeId: null,
    pendingConnection: null,
    dragging: null,
    longPress: null,
    longPressWire: null,
    panningCanvas: null,
    marquee: null,
    lastEvaluation: null,
    zoom: 1,
    undoStack: [],
    redoStack: [],
    inspectorUndoPushed: false,
    appView: "workspace",
    challengeDetailTab: "theorie",
    lastSubmitFeedback: null,
    openChipSeries: new Set(),
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
  const nodeSpecService = createNodeSpecFactory({ getChipDefinition });
  const simulationEngine = createSimulationEngine({
    getNodeSpec: nodeSpecService.getNodeSpec,
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
    getChipDefinition,
    evaluateCircuit: (circuit, externalInputs, path, recursionTrail) =>
      evaluateCircuit(circuit, externalInputs, path, recursionTrail),
    collectRegisterUpdates: (circuit, externalInputs, path, recursionTrail) =>
      collectRegisterUpdates(circuit, externalInputs, path, recursionTrail),
    getRuntimeRegisterStates: () => state.project.runtime.registerStates,
    setRuntimeRegisterStates: (next) => {
      state.project.runtime.registerStates = next;
    },
  });

  state.project = loadProject();

  const appModals = createAppModals({ dom });

  function setStatus(message) {
    dom.statusLine.textContent = message;
  }

  const tutorial = createTutorial({
    state,
    getCurrentWorkspace,
    setStatus,
  });

  let renderOrchestrator;

  function render() {
    renderOrchestrator.render();
  }

  function renderWorkspace(options) {
    renderOrchestrator.renderWorkspaceView(options);
  }

  function renderFull() {
    render();
  }

  const undoManager = createUndoManager({
    state,
    deepClone,
    getCurrentWorkspace,
    setStatus,
    renderWorkspace,
    dom,
  });
  const { pushUndo, undo, redo, updateUndoRedoButtons } = undoManager;

  const circuitMutations = createCircuitMutations({
    state,
    getCurrentWorkspace,
    getNodeSpec,
    allocateId,
    pushUndo,
    setStatus,
    renderWorkspace,
  });
  const {
    deleteNode,
    removeWire,
    getNodeConnections,
    handlePinClick,
  } = circuitMutations;

  const runtimeActions = createRuntimeActions({
    state,
    parseBits,
    formatBits,
    getCurrentWorkspace,
    collectRegisterUpdates,
    setStatus,
    renderWorkspace,
    saveProject,
    onRunnerStateChange: syncClockRunnerUi,
  });

  function syncClockRunnerUi({ running, hz }) {
    if (dom.clockPlayButton) {
      dom.clockPlayButton.textContent = running ? S.pause : S.play;
      dom.clockPlayButton.classList.toggle("is-running", running);
    }
    if (dom.clockSpeedSelect && String(dom.clockSpeedSelect.value) !== String(hz)) {
      dom.clockSpeedSelect.value = String(hz);
    }
  }

  const workspaceMutationDeps = {
    state,
    CHALLENGES,
    challengeVerifier,
    chipDefinitionsService,
    appModals,
    allocateId,
    createWorkspace,
    createNode,
    createChipInstance,
    deepClone,
    normalizeWorkspace,
    getCurrentWorkspace,
    getWorkspace,
    getChipDefinition,
    getChipSeries,
    pushUndo,
    setStatus,
    renderFull,
    renderWorkspace,
    WORKSPACE_BASE_WIDTH,
    WORKSPACE_BASE_HEIGHT,
    clamp,
    tutorial,
    stopClockRunner: () => runtimeActions.clockRunner.stop(),
    showCompletionOverlay: null,
  };
  const workspaceMutations = createWorkspaceMutations(workspaceMutationDeps);

  const selectionClipboard = createSelectionClipboard({
    state,
    getCurrentWorkspace,
    allocateId,
    deepClone,
    pushUndo,
    getSuggestedNodePosition: workspaceMutations.getSuggestedNodePosition,
    clamp,
    WORKSPACE_BASE_WIDTH,
    WORKSPACE_BASE_HEIGHT,
    setStatus,
    renderWorkspace,
  });

  const projectIo = createProjectIoActions({
    state,
    dom,
    normalizeProject,
    saveProject,
    setStatus,
    render: renderFull,
    encodeProjectForUrlHash,
    decodeProjectFromUrlHashPayload,
    parseSharePayloadFromHash,
    stopClockRunner: () => runtimeActions.clockRunner.stop(),
    listBackups,
    restoreBackup,
    getProjectStateDeps,
    appModals,
  });
  workspaceMutationDeps.showCompletionOverlay = projectIo.showCompletionOverlay;

  const inspectorHandlers = createInspectorHandlers({
    state,
    clampWidth,
    clampSplitWidth,
    normalizeBitString,
    clampRomAddressWidth,
    normalizeRomProgram,
    getCurrentWorkspace,
    pushUndo,
    deleteNode,
    removeWire,
    renderWorkspace,
  });

  const keyboardHandlers = createKeyboardHandlers({
    state,
    getCurrentWorkspace,
    pushUndo,
    undo,
    redo,
    duplicateSelectedNode: workspaceMutations.duplicateSelectedNode,
    deleteNode,
    copySelection: selectionClipboard.copySelection,
    pasteClipboard: selectionClipboard.pasteClipboard,
    setSelection: selectionClipboard.setSelection,
    setStatus,
    renderWorkspace,
    clamp,
    normalizeBitString,
    WORKSPACE_BASE_WIDTH,
    WORKSPACE_BASE_HEIGHT,
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
    renderWorkspace,
    pushUndo,
    getCurrentWorkspace,
    deleteNode,
    removeWire,
    toggleSwitchNode: runtimeActions.toggleSwitchNode,
    toggleClockNode: runtimeActions.toggleClockNode,
    toggleInputPinNode: runtimeActions.toggleInputPinNode,
    handlePinClick,
    evaluateWorkspace,
    canvasRenderers,
    longPressDelay: LONG_PRESS_DELAY,
    longPressMoveThreshold: LONG_PRESS_MOVE_THRESHOLD,
    selectSingleNode: selectionClipboard.selectSingleNode,
    toggleSelectionNode: selectionClipboard.toggleSelectionNode,
    clearSelection: selectionClipboard.clearSelection,
    setSelection: selectionClipboard.setSelection,
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

  function setAppView(view) {
    state.appView = view === "course" ? "course" : "workspace";
    if (dom.courseView) {
      dom.courseView.hidden = state.appView !== "course";
    }
    if (dom.workspaceFrame) {
      dom.workspaceFrame.hidden = state.appView !== "workspace";
    }
    document.querySelectorAll(".app-view-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.appView === state.appView);
    });
    if (state.appView === "course" && courseRenderers) {
      courseRenderers.renderCourse();
    }
    if (state.appView === "workspace") {
      renderWorkspace();
    }
  }

  let courseRenderers;

  const workspaceActions = createWorkspaceActionHandlers({
    dom,
    state,
    challenges: CHALLENGES,
    challengeVerifier,
    render: renderFull,
    renderChallenges: () => panelRenderers.renderChallenges(),
    getCurrentWorkspace,
    getActiveWorkspaceChallenge: workspaceMutations.getActiveWorkspaceChallenge,
    setStatus,
    addPartToWorkspace: workspaceMutations.addPartToWorkspace,
    duplicateWorkspace: workspaceMutations.duplicateWorkspace,
    deleteWorkspace: workspaceMutations.deleteWorkspace,
    editChipAsNewVersion: workspaceMutations.editChipAsNewVersion,
    cloneChipToWorkspace: workspaceMutations.cloneChipToWorkspace,
    openChallengeWorkspace: (id) => {
      setAppView("workspace");
      workspaceMutations.openChallengeWorkspace(id);
    },
    submitChallenge: workspaceMutations.submitChallenge,
    showCompletionOverlay: projectIo.showCompletionOverlay,
    stopClockRunner: () => runtimeActions.clockRunner.stop(),
  });

  const panelRenderers = createPanelRenderers({
    dom,
    state,
    BUILTIN_PARTS,
    CHALLENGES,
    getChipSeries,
    getLatestChipDefinitionForSeries: workspaceMutations.getLatestChipDefinitionForSeries,
    countChipDependencies: workspaceMutations.countChipDependencies,
    challengeVerifier,
    workspaceActions,
    escapeHtml,
  });

  courseRenderers = createCourseRenderers({
    dom,
    state,
    CHALLENGES,
    escapeHtml,
    getLearner: () => state.project.learner || { completedChallengeIds: [], badges: [] },
    openChallengeWorkspace: (id) => {
      setAppView("workspace");
      workspaceMutations.openChallengeWorkspace(id);
    },
    setAppView,
  });

  renderOrchestrator = createRenderOrchestrator({
    dom,
    state,
    canvasRenderers,
    inspectorRenderers,
    panelRenderers,
    courseRenderers,
    getCurrentWorkspace,
    evaluateWorkspace,
    updateUndoRedoButtons,
    saveProject,
    debouncedSaveProject: debounce(saveProject, SAVE_DEBOUNCE_MS),
    WORKSPACE_BASE_WIDTH,
    WORKSPACE_BASE_HEIGHT,
    tutorial,
    getAppView: () => state.appView,
  });

  const eventBinder = createEventBinder({
    dom,
    workspaceActions,
    interactionHandlers,
    courseRenderers,
    setAppView,
    handlers: {
      undo,
      redo,
      createWorkspaceFromPrompt: workspaceMutations.createWorkspaceFromPrompt,
      duplicateCurrentWorkspace: workspaceMutations.duplicateCurrentWorkspace,
      saveCurrentWorkspaceAsChip: () => workspaceMutations.saveCurrentWorkspaceAsChip(),
      toggleWorkspaceClocks: runtimeActions.toggleWorkspaceClocks,
      stepRegisters: runtimeActions.stepRegisters,
      toggleClockPlay: () => runtimeActions.clockRunner.togglePlay(),
      changeClockSpeed: () => {
        const value = dom.clockSpeedSelect ? dom.clockSpeedSelect.value : "4";
        runtimeActions.clockRunner.setSpeed(value === "max" ? "max" : Number(value));
      },
      resetRuntimeState: runtimeActions.resetRuntimeState,
      exportProject: projectIo.exportProject,
      importClick: () => dom.importInput.click(),
      importProjectFromFile: projectIo.importProjectFromFile,
      restoreBackup: projectIo.restoreBackupFromUi,
      copyShareLink: projectIo.copyShareLink,
      importShareFromPrompt: projectIo.importShareFromPrompt,
      dismissOnboarding: projectIo.dismissOnboarding,
      dismissCompletionOverlay: projectIo.dismissCompletionOverlay,
      zoomOut: () => changeZoom(-ZOOM_STEP),
      zoomReset: () => setZoom(1),
      zoomIn: () => changeZoom(ZOOM_STEP),
      inspectorFocusIn: inspectorHandlers.handleInspectorFocusIn,
      inspectorInput: inspectorHandlers.handleInspectorInput,
      inspectorClick: inspectorHandlers.handleInspectorClick,
      keydown: keyboardHandlers.handleKeyboardShortcuts,
    },
  });

  let appStarted = false;

  window.ForgeLogicApp = {
    start() {
      if (appStarted) {
        return;
      }
      appStarted = true;
      void initializeApp();
    },
  };

  async function initializeApp() {
    try {
      await projectIo.tryLoadProjectFromShareHash();
      const fresh =
        !state.project.learner?.completedChallengeIds ||
        state.project.learner.completedChallengeIds.length === 0;
      setAppView(fresh ? "course" : "workspace");
      render();
      eventBinder.bindEvents();
      projectIo.showOnboardingIfNeeded();
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
      setAppView("course");
      render();
      eventBinder.bindEvents();
      projectIo.showOnboardingIfNeeded();
      setStatus("Project reset na laadfout. Je werkt nu in een schoon project.");
    }
  }

  function loadProject() {
    return loadProjectState(getProjectStateDeps(), localStorage);
  }

  function saveProject() {
    const result = saveProjectState(state.project, localStorage);
    if (result && result.ok === false && result.reason === "quota") {
      setStatus("Opslaan mislukt — exporteer je project als backup");
    }
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
      evaluateChallengeResult: (challenge, definitions) =>
        challengeVerifier.evaluateChallengeResult(challenge, definitions),
      isStarterDefinition: (definition) => challengeVerifier.isStarterDefinition(definition),
    };
  }

  function ensureStarterChips(project) {
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
    return nodeSpecService.getNodeSpec(node);
  }

  function applyWorkspaceZoom() {
    renderOrchestrator.applyWorkspaceZoom();
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

  function collectRegisterUpdates(circuit, externalInputs, path, recursionTrail) {
    return simulationEngine.collectRegisterUpdates(circuit, externalInputs, path, recursionTrail);
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
