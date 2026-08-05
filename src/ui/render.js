export function createRenderOrchestrator(deps) {
  const {
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
    debouncedSaveProject,
    WORKSPACE_BASE_WIDTH,
    WORKSPACE_BASE_HEIGHT,
    getAppView,
  } = deps;

  const scheduleSave = debouncedSaveProject || saveProject;

  function applyWorkspaceZoom() {
    dom.workspaceStage.style.transform = `scale(${state.zoom})`;
    dom.workspaceStageViewport.style.width = `${WORKSPACE_BASE_WIDTH * state.zoom}px`;
    dom.workspaceStageViewport.style.height = `${WORKSPACE_BASE_HEIGHT * state.zoom}px`;
    const percent = `${Math.round(state.zoom * 100)}%`;
    dom.zoomValue.textContent = percent;
    dom.zoomResetButton.textContent = percent;
  }

  function evaluateCurrentWorkspace() {
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

  function renderPanels() {
    panelRenderers.renderBuiltinPalette();
    panelRenderers.renderWorkspaceList(getCurrentWorkspace());
    panelRenderers.renderChipLibrary();
    panelRenderers.renderChallenges();
    if (courseRenderers && typeof courseRenderers.renderCourse === "function") {
      if (!getAppView || getAppView() === "course") {
        courseRenderers.renderCourse();
      }
    }
  }

  function renderWorkspaceView({ evaluate = true, save = true } = {}) {
    if (evaluate) {
      evaluateCurrentWorkspace();
    }
    renderCanvas();
    inspectorRenderers.renderInspector();
    inspectorRenderers.renderErrors();
    updateUndoRedoButtons();
    if (save) {
      scheduleSave();
    }
    if (deps.tutorial && typeof deps.tutorial.onStateChanged === "function") {
      deps.tutorial.onStateChanged();
    }
  }

  function render() {
    renderPanels();
    renderWorkspaceView();
  }

  return { render, renderPanels, renderWorkspaceView, renderCanvas, applyWorkspaceZoom };
}
