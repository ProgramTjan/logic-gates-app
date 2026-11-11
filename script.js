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
import { S, t, initLocale, setLocale, applyStaticI18n } from "./src/i18n/index.js";
import { localizeChallenge } from "./src/i18n/challenges.js";
import { INTRO_LESSON_ID } from "./src/data/curriculum.js";
import { getCoachScript } from "./src/data/coach-scripts.js";
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
    duplicateWorkspaceButton: null,
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
    app: document.getElementById("app"),
    lessonPanel: document.getElementById("lesson-panel"),
    lessonPanelHandle: document.getElementById("lesson-panel-handle"),
    lessonPeekStatus: document.getElementById("lesson-peek-status"),
    sandboxPanel: document.getElementById("sandbox-panel"),
    partsStrip: document.getElementById("parts-strip"),
    lessonPanelHandleLabel: document.getElementById("lesson-panel-handle-label"),
    navSandbox: document.getElementById("nav-sandbox"),
    settingsMenu: document.getElementById("settings-menu"),
    simControls: document.getElementById("sim-controls"),
    appbarSheet: document.getElementById("appbar-sheet"),
    inspectorCard: document.getElementById("inspector-card"),
    checksCard: document.getElementById("checks-card"),
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
    appView: "home",
    lastSandboxWorkspaceId: null,
    renderedWorkspaceId: null,
    canvasScroll: {},
    sheetListSignature: "",
    hintsShown: {},
    inspectorOpenByView: { lesson: false, sandbox: window.innerWidth >= 1024 },
    theoryOpen: {},
    introSeen: {},
    quizSkipped: {},
    expandedStep: {},
    sheetByView: { lesson: "half", sandbox: "peek" },
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

  // The status line is a toast: the text stays in the DOM, the class fades it in for 4 seconds.
  let statusTimer = null;
  function setStatus(message) {
    dom.statusLine.textContent = message;
    clearTimeout(statusTimer);
    if (!message) {
      dom.statusLine.classList.remove("is-visible");
      return;
    }
    dom.statusLine.classList.add("is-visible");
    statusTimer = setTimeout(() => dom.statusLine.classList.remove("is-visible"), 4000);
  }

  const tutorial = createTutorial({
    state,
    getCurrentWorkspace,
    getChipDefinition,
    setStatus,
    getScript: getCoachScript,
  });

  let renderOrchestrator;

  function render() {
    reconcileViewWithWorkspace();
    renderOrchestrator.render();
    updateViewChrome();
    restoreCanvasScrollOnSheetSwitch();
  }

  /** Each sheet keeps its own scroll position; a sheet seen for the first time starts top-left. */
  function restoreCanvasScrollOnSheetSwitch() {
    const workspace = getCurrentWorkspace();
    if (!workspace || workspace.id === state.renderedWorkspaceId) {
      return;
    }
    state.renderedWorkspaceId = workspace.id;
    const saved = state.canvasScroll[workspace.id] || { left: 0, top: 0 };
    dom.canvas.scrollLeft = saved.left;
    dom.canvas.scrollTop = saved.top;
  }

  function renderWorkspace(options) {
    renderOrchestrator.renderWorkspaceView(options);
    revealPendingNode();
  }

  /** Scroll a just-placed part into view when no free spot was visible. */
  function revealPendingNode() {
    const target = state.pendingReveal;
    if (!target) {
      return;
    }
    state.pendingReveal = null;
    const pad = 40;
    const left = target.x * state.zoom;
    const top = target.y * state.zoom;
    const right = (target.x + target.w) * state.zoom;
    const bottom = (target.y + target.h) * state.zoom;
    if (left < dom.canvas.scrollLeft || right > dom.canvas.scrollLeft + dom.canvas.clientWidth) {
      dom.canvas.scrollLeft = Math.max(0, left - pad);
    }
    if (top < dom.canvas.scrollTop || bottom > dom.canvas.scrollTop + dom.canvas.clientHeight) {
      dom.canvas.scrollTop = Math.max(0, top - pad);
    }
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
    getVisibleStageRect: () => ({
      x: dom.canvas.scrollLeft / state.zoom,
      y: dom.canvas.scrollTop / state.zoom,
      width: dom.canvas.clientWidth / state.zoom,
      height: dom.canvas.clientHeight / state.zoom,
    }),
    getNodeSize: (nodeId) => {
      const el = dom.nodeLayer.querySelector(`article[data-node-id="${nodeId}"]`);
      return el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
    },
    getNewNodeSize: () =>
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches ? { w: 130, h: 100 } : { w: 100, h: 72 },
    /** Floating overlays (inspector, tools, status) in stage coordinates, so parts aren't placed under them. */
    getReservedStageRects: () => {
      const canvasRect = dom.canvas.getBoundingClientRect();
      // The parts strip sits beside/below the canvas; it only counts when it actually overlaps it.
      const overlapsCanvas = (el) => {
        const r = el.getBoundingClientRect();
        return r.left < canvasRect.right && r.right > canvasRect.left && r.top < canvasRect.bottom && r.bottom > canvasRect.top;
      };
      return ["#inspector-card", ".canvas-tools", ".canvas-status", "#parts-strip"]
        .map((selector) => document.querySelector(selector))
        .filter((el) => el && !el.hidden && el.offsetParent !== null && (el.id !== "parts-strip" || overlapsCanvas(el)))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: (r.left - canvasRect.left + dom.canvas.scrollLeft) / state.zoom,
            y: (r.top - canvasRect.top + dom.canvas.scrollTop) / state.zoom,
            w: r.width / state.zoom,
            h: r.height / state.zoom,
          };
        });
    },
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

  // ---------------------------------------------------------------------------
  // App views: home (learning path) · lesson (one lesson + canvas) · sandbox (free build)
  // ---------------------------------------------------------------------------
  const APP_VIEWS = ["home", "lesson", "sandbox"];
  const CLOCKED_NODE_TYPES = new Set(["clock", "register", "rom", "screen", "keyboard"]);

  function isLessonWorkspace(workspace) {
    return Boolean(workspace && workspace.meta && workspace.meta.challengeId);
  }

  function isSandboxUnlocked() {
    const learner = state.project.learner || {};
    if (learner.unlockedAll) {
      return true;
    }
    return (learner.completedChallengeIds || []).includes(INTRO_LESSON_ID);
  }

  function ensureSandboxWorkspace() {
    const current = getCurrentWorkspace();
    if (current && !isLessonWorkspace(current)) {
      state.lastSandboxWorkspaceId = current.id;
      return;
    }
    const remembered = state.lastSandboxWorkspaceId ? getWorkspace(state.lastSandboxWorkspaceId) : null;
    let target =
      remembered && !isLessonWorkspace(remembered)
        ? remembered
        : state.project.workspaces.find((workspace) => !isLessonWorkspace(workspace));
    if (!target) {
      target = createWorkspace(state.project, "Main Workspace");
      state.project.workspaces.unshift(target);
    }
    state.project.currentWorkspaceId = target.id;
    state.lastSandboxWorkspaceId = target.id;
    state.selectedNodeId = null;
    state.selectedNodeIds = [];
  }

  /** Keeps the view consistent after actions that swap the workspace (delete, import, undo). */
  function reconcileViewWithWorkspace() {
    if (!state.project) {
      return;
    }
    if (state.appView === "sandbox") {
      ensureSandboxWorkspace();
    } else if (state.appView === "lesson" && !isLessonWorkspace(getCurrentWorkspace())) {
      state.appView = "home";
    }
  }

  function setAppView(view) {
    let next = view === "course" ? "home" : view === "workspace" ? "sandbox" : view;
    if (!APP_VIEWS.includes(next)) {
      next = "home";
    }
    let explainSandboxLock = false;
    if (next === "sandbox" && !isSandboxUnlocked()) {
      setStatus(t("sandboxLockedStatus"));
      next = "home";
      explainSandboxLock = true;
    }
    if (next === "lesson" && !isLessonWorkspace(getCurrentWorkspace())) {
      next = "home";
    }
    if (next !== state.appView) {
      runtimeActions.clockRunner.stop();
    }
    state.appView = next;
    if (next === "sandbox") {
      ensureSandboxWorkspace();
    }
    if (next !== "lesson" && typeof tutorial.stop === "function") {
      tutorial.stop();
    }
    if (dom.settingsMenu) {
      dom.settingsMenu.open = false;
    }
    render();
    if (explainSandboxLock) {
      const card = dom.courseView && dom.courseView.querySelector(".course-sandbox-card");
      if (card) {
        card.classList.remove("attention");
        void card.offsetWidth;
        card.classList.add("attention");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    window.scrollTo(0, 0);
  }

  function findLatestLessonWorkspace(challengeId) {
    const drafts = state.project.workspaces.filter(
      (workspace) => workspace.meta && workspace.meta.challengeId === challengeId
    );
    return drafts.length ? drafts[drafts.length - 1] : null;
  }

  /** Opens a lesson; resumes its most recent sheet unless `fresh` is requested. */
  function openLesson(challengeId, { fresh = false } = {}) {
    const challenge = CHALLENGES.find((item) => item.id === challengeId);
    if (!challenge || !panelRenderers.isChallengeUnlocked(challenge)) {
      setStatus(t("status.lessonLocked"));
      return;
    }
    runtimeActions.clockRunner.stop();
    state.selectedChallengeId = challengeId;
    state.lastSubmitFeedback = null;
    if (fresh) {
      // "Restart": the lesson opens at the intro again, with the quiz offered again.
      state.introSeen[challengeId] = false;
      delete state.quizSkipped[challengeId];
    }
    if (state.sheetByView.lesson === "peek") {
      state.sheetByView.lesson = "half";
    }
    dom.challengeList.scrollTop = 0;
    const existing = fresh ? null : findLatestLessonWorkspace(challengeId);
    if (existing) {
      // Reopening a finished lesson whose quiz is unanswered: go on to "Next", quiz stays open as "Still open".
      const quizItems = challenge.learning?.quiz;
      const learner = state.project.learner || {};
      const answers = learner.quizAnswers?.[challengeId] || {};
      if (
        Array.isArray(quizItems) &&
        quizItems.length &&
        (learner.completedChallengeIds || []).includes(challengeId) &&
        !quizItems.every((_, index) => answers[String(index)] !== undefined)
      ) {
        state.quizSkipped[challengeId] = true;
      }
      state.project.currentWorkspaceId = existing.id;
      state.selectedNodeId = null;
      state.selectedNodeIds = [];
      state.appView = "lesson";
      render();
      if (tutorial && typeof tutorial.maybeStart === "function") {
        tutorial.maybeStart(challengeId);
      }
    } else {
      state.appView = "lesson";
      // Show the lesson layout first so the new sheet can size itself to the visible canvas.
      updateViewChrome();
      workspaceMutations.openChallengeWorkspace(challengeId);
    }
    dom.challengeList.scrollTop = 0;
    window.scrollTo(0, 0);
    requestAnimationFrame(() => fitToContent({ minZoom: 0.6, maxZoom: 1.25, centered: true }));
  }

  function nodesNeedClock(nodes, seenDefinitions) {
    for (const node of nodes || []) {
      if (CLOCKED_NODE_TYPES.has(node.type)) {
        return true;
      }
      if (node.type === "chip-instance") {
        const definitionId = node.config && node.config.definitionId;
        if (definitionId && !seenDefinitions.has(definitionId)) {
          seenDefinitions.add(definitionId);
          const definition = getChipDefinition(definitionId);
          const snapshotNodes = definition && definition.circuitSnapshot ? definition.circuitSnapshot.nodes : [];
          if (nodesNeedClock(snapshotNodes, seenDefinitions)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /** Shows only the chrome that matters for the current view and sheet. */
  function updateViewChrome() {
    const view = state.appView;
    if (dom.app) {
      dom.app.dataset.view = view;
      if (dom.lessonPanel) {
        dom.lessonPanel.dataset.sheet = state.sheetByView.lesson;
      }
      if (dom.sandboxPanel) {
        dom.sandboxPanel.dataset.sheet = state.sheetByView.sandbox;
      }
    }
    if (dom.courseView) {
      dom.courseView.hidden = view !== "home";
    }
    document.querySelectorAll(".appbar-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.nav === view);
    });
    const coachToggle = document.getElementById("coach-enabled-toggle");
    if (coachToggle) {
      coachToggle.checked = state.project.learner?.coachEnabled !== false;
    }
    const sandboxUnlocked = isSandboxUnlocked();
    if (dom.navSandbox) {
      dom.navSandbox.classList.toggle("locked", !sandboxUnlocked);
      dom.navSandbox.setAttribute("aria-disabled", sandboxUnlocked ? "false" : "true");
      dom.navSandbox.title = sandboxUnlocked ? "" : t("sandboxLockedStatus");
    }
    if (dom.lessonPanelHandle) {
      const challenge = workspaceMutations.getActiveWorkspaceChallenge();
      if (dom.lessonPanelHandleLabel) {
        dom.lessonPanelHandleLabel.textContent = challenge ? localizeChallenge(challenge).title : "";
      }
      const peek = state.sheetByView.lesson === "peek";
      dom.lessonPanelHandle.setAttribute("aria-expanded", peek ? "false" : "true");
      dom.lessonPanelHandle.title = peek ? t("lessonPanelShow") : t("lessonPanelHide");
    }
    updateWorkspaceChrome();
    updatePeekStatus();
  }

  function updateWorkspaceChrome() {
    const workspace = getCurrentWorkspace();
    if (!workspace) {
      return;
    }
    if (state.appView === "lesson") {
      panelRenderers.syncLessonStep();
      scheduleLiveCheck();
    }
    if (state.appView === "sandbox") {
      const signature = state.project.workspaces
        .map((item) => `${item.id}:${item.nodes.length}:${item.wires.length}:${item.name}`)
        .join("|") + `@${workspace.id}`;
      if (signature !== state.sheetListSignature) {
        state.sheetListSignature = signature;
        panelRenderers.renderWorkspaceList(workspace);
      }
    }
    const challenge = workspaceMutations.getActiveWorkspaceChallenge();
    const sequentialLesson = Boolean(
      challenge && String(challenge.verification || "").startsWith("sequential")
    );
    const showSim =
      state.appView !== "home" && (sequentialLesson || nodesNeedClock(workspace.nodes, new Set()));
    if (dom.simControls && dom.simControls.hidden === showSim) {
      dom.simControls.hidden = !showSim;
      if (!showSim) {
        runtimeActions.clockRunner.stop();
      }
    }
    // The bar above the canvas exists only to hold the clock buttons.
    if (dom.simControls && dom.simControls.parentElement) {
      const header = dom.simControls.closest(".workspace-header");
      if (header) {
        header.classList.toggle("has-sim", showSim);
      }
    }
    // Free build: the active sheet's name sits in the app bar next to the tabs.
    if (dom.appbarSheet && dom.appbarSheet.textContent !== workspace.name) {
      dom.appbarSheet.textContent = workspace.name;
    }
    if (dom.inspectorCard) {
      const selected = workspace.nodes.find((node) => node.id === state.selectedNodeId);
      dom.inspectorCard.hidden = !selected;
      // In lessons the inspector starts folded so it never hides pins; one tap opens it.
      const open = Boolean(state.inspectorOpenByView[state.appView]);
      dom.inspectorCard.classList.toggle("collapsed", !open);
      const toggle = document.getElementById("inspector-toggle");
      if (toggle) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      }
      const nodeLabel = document.getElementById("inspector-toggle-node");
      if (nodeLabel) {
        nodeLabel.textContent = selected ? selected.config?.label || selected.type : "";
      }
    }
    if (dom.checksCard) {
      const errors = state.lastEvaluation ? state.lastEvaluation.errors : [];
      dom.checksCard.hidden = !errors || errors.length === 0;
    }
  }

  /** Transient chip definition of the current sheet, for live testing without saving. */
  function buildLiveDefinition() {
    const workspace = getCurrentWorkspace();
    if (!workspace) {
      return null;
    }
    const iface = chipDefinitionsService.extractChipInterface(workspace);
    if (iface.errors.length) {
      return { error: iface.errors[0].message };
    }
    // Only show live results once every output pin is actually driven by the circuit.
    const outputIds = workspace.nodes.filter((node) => node.type === "output-pin").map((node) => node.id);
    const allOutputsWired = outputIds.every((id) => workspace.wires.some((wire) => wire.toNodeId === id));
    if (!allOutputsWired) {
      return { error: "outputs-unwired" };
    }
    return {
      definition: {
        id: `live-${workspace.id}`,
        name: workspace.name,
        version: 0,
        inputs: iface.inputs,
        outputs: iface.outputs,
        circuitSnapshot: { id: `live-${workspace.id}`, name: workspace.name, nodes: workspace.nodes, wires: workspace.wires, meta: {} },
      },
    };
  }

  const scheduleLiveCheck = debounce(() => {
    if (state.appView === "lesson") {
      panelRenderers.refreshLiveCheck();
      updatePeekStatus();
    }
  }, 200);

  /** Short status for the folded bottom sheet: live-check summary or lesson state. */
  function updatePeekStatus() {
    if (!dom.lessonPeekStatus) {
      return;
    }
    // The folded sheet shows the action bar's status and its primary action.
    const status = dom.challengeList.querySelector(".lesson-actionbar [data-bar-status]");
    dom.lessonPeekStatus.textContent = status ? status.textContent.trim() : "";
    dom.lessonPeekStatus.classList.toggle("ok", Boolean(status && status.classList.contains("ok")));
    const primary = dom.challengeList.querySelector(
      ".lesson-actionbar [data-intro-done], .lesson-actionbar [data-submit-challenge], .lesson-actionbar [data-next-lesson]"
    );
    document.querySelectorAll("[data-peek-check]").forEach((button) => {
      button.style.display = primary ? "" : "none";
      if (primary) {
        button.textContent = primary.textContent.trim();
      }
    });
  }

  const SHEET_STATES = ["peek", "half", "full"];

  function setSheetState(view, next) {
    state.sheetByView[view] = SHEET_STATES.includes(next) ? next : "half";
    updateViewChrome();
  }

  /** Bottom sheet (narrow screens): tap the grip to fold/unfold, drag it to resize. */
  function bindSheetGrip(grip) {
    const view = grip.dataset.sheetGrip;
    const panel = grip.closest(".lesson-panel, .sandbox-panel");
    let drag = null;

    grip.addEventListener("pointerdown", (event) => {
      if (window.innerWidth >= 1024) {
        return;
      }
      drag = { pointerId: event.pointerId, startY: event.clientY, startHeight: panel.getBoundingClientRect().height, moved: false };
      grip.setPointerCapture(event.pointerId);
    });
    grip.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const dy = event.clientY - drag.startY;
      if (Math.abs(dy) > 6) {
        drag.moved = true;
      }
      if (drag.moved) {
        const max = window.innerHeight - 120;
        panel.style.height = `${Math.max(56, Math.min(max, drag.startHeight - dy))}px`;
        panel.style.maxHeight = "none";
        panel.dataset.sheet = "dragging";
      }
    });
    const finish = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const wasDrag = drag.moved;
      drag = null;
      if (!wasDrag) {
        return;
      }
      const ratio = panel.getBoundingClientRect().height / window.innerHeight;
      panel.style.height = "";
      panel.style.maxHeight = "";
      setSheetState(view, ratio < 0.22 ? "peek" : ratio < 0.62 ? "half" : "full");
    };
    grip.addEventListener("pointerup", finish);
    grip.addEventListener("pointercancel", finish);
    grip.addEventListener("click", () => {
      if (window.innerWidth >= 1024 || panel.dataset.sheet === "dragging") {
        return;
      }
      const current = state.sheetByView[view];
      setSheetState(view, current === "peek" ? "half" : current === "full" ? "half" : "peek");
    });
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
    openChallengeWorkspace: (id) => openLesson(id, { fresh: true }),
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
    getCurrentWorkspace,
    buildLiveDefinition,
    getNodeSymbol: (node) => canvasRenderers.getNodeSymbol(node),
    hasCoach: (challengeId) => tutorial.hasScript(challengeId),
    getActiveChallengeId: () => {
      const challenge = workspaceMutations.getActiveWorkspaceChallenge();
      return challenge ? challenge.id : null;
    },
  });

  courseRenderers = createCourseRenderers({
    dom,
    CHALLENGES,
    escapeHtml,
    getLearner: () => state.project.learner || { completedChallengeIds: [], badges: [] },
    openLesson,
    setAppView,
    isSandboxUnlocked,
    setStatus,
    renderAll: () => render(),
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
    getAppView: () => (state.appView === "home" ? "course" : state.appView),
    onWorkspaceRendered: () => {
      updateWorkspaceChrome();
      updatePeekStatus();
    },
  });

  const eventBinder = createEventBinder({
    dom,
    workspaceActions,
    interactionHandlers,
    courseRenderers,
    setAppView,
    changeLocale,
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

  function changeLocale(code) {
    setLocale(code);
    applyStaticI18n();
    syncClockRunnerUi({
      running: runtimeActions.clockRunner.isRunning(),
      hz: runtimeActions.clockRunner.getSpeed(),
    });
    renderFull();
  }

  async function initializeApp() {
    try {
      initLocale();
      applyStaticI18n();
      const openedFromShareLink = Boolean(parseSharePayloadFromHash(location.hash));
      await projectIo.tryLoadProjectFromShareHash();
      state.appView = openedFromShareLink && isSandboxUnlocked() ? "sandbox" : "home";
      render();
      eventBinder.bindEvents();
      bindShellEvents();
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
      state.appView = "home";
      render();
      eventBinder.bindEvents();
      bindShellEvents();
      setStatus(t("status.projectReset"));
    }
  }

  /**
   * Touch: two-finger pinch zooms around the midpoint (and pans with it).
   * Trackpad / Ctrl+wheel zooms around the pointer.
   */
  function bindTouchGestures() {
    const touches = new Map();
    let pinch = null;

    function canvasPoint(clientX, clientY) {
      const rect = dom.canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function pinchMetrics() {
      const [a, b] = [...touches.values()];
      return {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: canvasPoint((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    }

    dom.canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType !== "touch") {
          return;
        }
        // Een vinger op een pin sleept een draad; die telt niet mee voor pan of pinch.
        if (event.target.closest && event.target.closest("[data-pin-direction]")) {
          return;
        }
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touches.size === 2) {
          // Second finger: cancel any single-finger pan/drag/long-press and start pinching.
          state.panningCanvas = null;
          state.dragging = null;
          state.longPress = null;
          state.longPressWire = null;
          state.marquee = null;
          const metrics = pinchMetrics();
          pinch = { startDistance: metrics.distance, startZoom: state.zoom, lastMid: metrics.mid };
        }
      },
      true
    );

    document.addEventListener("pointermove", (event) => {
      if (!touches.has(event.pointerId)) {
        return;
      }
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!pinch || touches.size < 2) {
        return;
      }
      const metrics = pinchMetrics();
      setZoom(pinch.startZoom * (metrics.distance / pinch.startDistance), metrics.mid);
      // Two-finger pan.
      dom.canvas.scrollLeft -= metrics.mid.x - pinch.lastMid.x;
      dom.canvas.scrollTop -= metrics.mid.y - pinch.lastMid.y;
      pinch.lastMid = metrics.mid;
    });

    const release = (event) => {
      touches.delete(event.pointerId);
      if (touches.size < 2) {
        pinch = null;
      }
    };
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);

    dom.canvas.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey && !event.metaKey) {
          return;
        }
        event.preventDefault();
        const factor = Math.exp(-event.deltaY * 0.01);
        setZoom(state.zoom * factor, canvasPoint(event.clientX, event.clientY));
      },
      { passive: false }
    );
  }

  function bindShellEvents() {
    bindTouchGestures();
    document.querySelectorAll(".appbar [data-nav]").forEach((button) => {
      button.addEventListener("click", () => setAppView(button.dataset.nav));
    });
    if (dom.courseView) {
      dom.courseView.addEventListener("change", courseRenderers.handleCourseChange);
      dom.courseView.addEventListener("toggle", courseRenderers.handleCourseToggle, true);
    }
    // Lesson panel: navigation that the legacy challenge handler doesn't know about.
    dom.challengeList.addEventListener(
      "click",
      (event) => {
        const navButton = event.target.closest("[data-nav]");
        if (navButton) {
          event.stopImmediatePropagation();
          setAppView(navButton.dataset.nav);
          return;
        }
        const coachButton = event.target.closest("[data-coach-start]");
        if (coachButton) {
          event.stopImmediatePropagation();
          tutorial.start(coachButton.dataset.coachStart);
          return;
        }
        const hintButton = event.target.closest("[data-reveal-hint]");
        if (hintButton) {
          event.stopImmediatePropagation();
          const id = hintButton.dataset.revealHint;
          state.hintsShown[id] = (state.hintsShown[id] || 0) + 1;
          panelRenderers.renderChallenges();
          return;
        }
        const expandButton = event.target.closest("[data-expand-step]");
        if (expandButton) {
          event.stopImmediatePropagation();
          const id = state.selectedChallengeId;
          const step = expandButton.dataset.expandStep;
          const open = state.expandedStep[id];
          const current = dom.challengeList.querySelector(".lesson-step.is-current")?.dataset.lessonStep || "";
          state.expandedStep[id] = open && open.step === step && open.current === current ? null : { step, current };
          panelRenderers.renderChallenges();
          return;
        }
        const introButton = event.target.closest("[data-intro-done]");
        if (introButton) {
          event.stopImmediatePropagation();
          state.introSeen[introButton.dataset.introDone] = true;
          panelRenderers.renderChallenges();
          updatePeekStatus();
          return;
        }
        const skipButton = event.target.closest("[data-quiz-skip]");
        if (skipButton) {
          event.stopImmediatePropagation();
          state.quizSkipped[skipButton.dataset.quizSkip] = true;
          panelRenderers.renderChallenges();
          updatePeekStatus();
          return;
        }
        const nextButton = event.target.closest("[data-next-lesson]");
        if (nextButton) {
          event.stopImmediatePropagation();
          openLesson(nextButton.dataset.nextLesson);
        }
      },
      true
    );
    document.querySelectorAll("[data-sheet-grip]").forEach(bindSheetGrip);
    dom.chipLibrary.addEventListener(
      "click",
      (event) => {
        if (event.target.closest("[data-empty-snapshot]")) {
          event.stopImmediatePropagation();
          dom.saveChipButton.click();
        }
      },
      true
    );
    const fitButton = document.getElementById("zoom-fit-button");
    if (fitButton) {
      fitButton.addEventListener("click", () => fitToContent({ minZoom: MIN_ZOOM, maxZoom: 1.5 }));
    }
    document.querySelectorAll("[data-peek-check]").forEach((button) =>
      button.addEventListener("click", () => {
        const primary = dom.challengeList.querySelector(
          ".lesson-actionbar [data-intro-done], .lesson-actionbar [data-submit-challenge], .lesson-actionbar [data-next-lesson]"
        );
        if (primary && !primary.disabled) {
          primary.click();
        }
      })
    );
    if (dom.partsStrip) {
      dom.partsStrip.addEventListener("click", (event) => {
        const part = event.target.closest("[data-strip-part]");
        const chip = event.target.closest("[data-strip-chip]");
        if (!part && !chip) {
          return;
        }
        // Phones: once you start building, fold the lesson sheet so the canvas gets the room.
        if (window.innerWidth < 640 && state.appView === "lesson" && state.sheetByView.lesson !== "peek") {
          state.sheetByView.lesson = "peek";
          updateViewChrome();
        }
        if (part) {
          workspaceMutations.addPartToWorkspace(part.dataset.stripPart);
        } else {
          workspaceMutations.addPartToWorkspace("chip-instance", chip.dataset.stripChip);
        }
      });
    }
    dom.challengeList.addEventListener(
      "toggle",
      (event) => {
        const details = event.target;
        if (details && details.dataset && details.dataset.theoryToggle) {
          state.theoryOpen[details.dataset.theoryToggle] = details.open;
        }
      },
      true
    );
    dom.canvas.addEventListener(
      "scroll",
      () => {
        const workspace = getCurrentWorkspace();
        if (workspace && workspace.id === state.renderedWorkspaceId) {
          state.canvasScroll[workspace.id] = { left: dom.canvas.scrollLeft, top: dom.canvas.scrollTop };
        }
      },
      { passive: true }
    );
    const inspectorToggle = document.getElementById("inspector-toggle");
    if (inspectorToggle) {
      inspectorToggle.addEventListener("click", () => {
        state.inspectorOpenByView[state.appView] = !state.inspectorOpenByView[state.appView];
        updateWorkspaceChrome();
      });
    }
    const coachToggle = document.getElementById("coach-enabled-toggle");
    if (coachToggle) {
      coachToggle.addEventListener("change", () => {
        const learner = state.project.learner;
        learner.coachEnabled = coachToggle.checked;
        if (coachToggle.checked) {
          learner.coachDismissed = {};
        } else {
          tutorial.stop();
        }
        saveProject();
      });
    }
    // Close popovers (settings, help, parts) when clicking elsewhere or after picking an action.
    document.addEventListener("click", (event) => {
      document.querySelectorAll("details.settings-menu[open], details.parts-dropdown[open]").forEach((details) => {
        if (!details.contains(event.target)) {
          details.open = false;
        }
      });
      const settingsAction = event.target.closest(".settings-actions button");
      if (settingsAction && dom.settingsMenu) {
        dom.settingsMenu.open = false;
      }
    });
  }

  function loadProject() {
    return loadProjectState(getProjectStateDeps(), localStorage);
  }

  function saveProject() {
    const result = saveProjectState(state.project, localStorage);
    if (result && result.ok === false && result.reason === "quota") {
      setStatus(t("status.quota"));
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

  /**
   * Zoom and scroll so every node is visible. By default only zooms out (never past
   * `minZoom`, so pins stay tappable) — used when a lesson opens on a narrow screen.
   */
  function fitToContent({ minZoom = 0.6, maxZoom = 1, onlyIfOverflowing = false, centered = false } = {}) {
    const workspace = getCurrentWorkspace();
    if (!workspace || !workspace.nodes.length || !dom.canvas.clientWidth) {
      return;
    }
    const boxes = workspace.nodes.map((node) => {
      const el = dom.nodeLayer.querySelector(`article[data-node-id="${node.id}"]`);
      return { x: node.x, y: node.y, w: el ? el.offsetWidth : 120, h: el ? el.offsetHeight : 80 };
    });
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const pad = 28;
    const fitsNow =
      minX * state.zoom >= dom.canvas.scrollLeft &&
      maxX * state.zoom <= dom.canvas.scrollLeft + dom.canvas.clientWidth &&
      minY * state.zoom >= dom.canvas.scrollTop &&
      maxY * state.zoom <= dom.canvas.scrollTop + dom.canvas.clientHeight;
    if (onlyIfOverflowing && fitsNow) {
      return;
    }
    const zoomX = dom.canvas.clientWidth / (maxX - minX + pad * 2);
    const zoomY = dom.canvas.clientHeight / (maxY - minY + pad * 2);
    const target = Math.max(minZoom, Math.min(maxZoom, zoomX, zoomY));
    if (centered) {
      fitCentered(boxes, target, minZoom);
      canvasRenderers.renderWires(getCurrentWorkspace(), state.lastEvaluation || evaluateWorkspace(getCurrentWorkspace()));
      return;
    }
    state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(target * 100) / 100));
    applyWorkspaceZoom();
    dom.canvas.scrollLeft = Math.max(0, (minX - pad) * state.zoom);
    dom.canvas.scrollTop = Math.max(0, (minY - pad) * state.zoom);
    canvasRenderers.renderWires(getCurrentWorkspace(), state.lastEvaluation || evaluateWorkspace(getCurrentWorkspace()));
  }

  /**
   * Zoom and scroll so the content sits in the middle of the visible canvas, and (if possible)
   * clear of the floating cards (inspector, tools, status). Steps the zoom down to `minZoom`.
   */
  function fitCentered(boxes, startZoom, minZoom) {
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const canvasRect = dom.canvas.getBoundingClientRect();
    const overlays = ["#inspector-card", ".canvas-tools", ".canvas-status"]
      .map((selector) => document.querySelector(selector))
      .filter((el) => el && !el.hidden && el.offsetParent !== null)
      .map((el) => el.getBoundingClientRect())
      .map((r) => ({ l: r.left - canvasRect.left, t: r.top - canvasRect.top, r: r.right - canvasRect.left, b: r.bottom - canvasRect.top }));
    const place = (zoom) => {
      state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom * 100) / 100));
      applyWorkspaceZoom();
      dom.canvas.scrollLeft = Math.max(0, ((minX + maxX) / 2) * state.zoom - dom.canvas.clientWidth / 2);
      dom.canvas.scrollTop = Math.max(0, ((minY + maxY) / 2) * state.zoom - dom.canvas.clientHeight / 2);
    };
    const collides = () =>
      boxes.some((b) => {
        const l = b.x * state.zoom - dom.canvas.scrollLeft;
        const t = b.y * state.zoom - dom.canvas.scrollTop;
        const r = l + b.w * state.zoom;
        const bt = t + b.h * state.zoom;
        return overlays.some((o) => l < o.r && r > o.l && t < o.b && bt > o.t);
      });
    // Touch: never zoom out just to dodge a floating card; pins must stay finger-sized.
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const floor = coarse ? Math.min(startZoom, Math.max(minZoom, 1)) : minZoom;
    let zoom = startZoom;
    place(zoom);
    while (collides() && zoom - 0.05 >= floor) {
      zoom -= 0.05;
      place(zoom);
    }
  }

  function changeZoom(delta) {
    setZoom(state.zoom + delta);
  }

  /**
   * @param {number} nextZoom
   * @param {{x:number, y:number}} [focus] point in canvas-viewport pixels that stays put
   *   (pinch midpoint, mouse position); defaults to the viewport centre.
   */
  function setZoom(nextZoom, focus) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(nextZoom * 100) / 100));
    if (clamped === state.zoom) {
      return;
    }
    const previousZoom = state.zoom;
    const focusX = focus ? focus.x : dom.canvas.clientWidth / 2;
    const focusY = focus ? focus.y : dom.canvas.clientHeight / 2;
    const logicalX = (dom.canvas.scrollLeft + focusX) / previousZoom;
    const logicalY = (dom.canvas.scrollTop + focusY) / previousZoom;
    state.zoom = clamped;
    applyWorkspaceZoom();
    dom.canvas.scrollLeft = Math.max(0, logicalX * state.zoom - focusX);
    dom.canvas.scrollTop = Math.max(0, logicalY * state.zoom - focusY);
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
