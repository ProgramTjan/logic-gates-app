export function createRenderOrchestrator(deps) {
  const {
    dom,
    state,
    canvasRenderers,
    inspectorRenderers,
    panelRenderers,
    getCurrentWorkspace,
    evaluateWorkspace,
    updateUndoRedoButtons,
    saveProject,
    WORKSPACE_BASE_WIDTH,
    WORKSPACE_BASE_HEIGHT,
  } = deps;

  function applyWorkspaceZoom() {
    dom.workspaceStage.style.transform = `scale(${state.zoom})`;
    dom.workspaceStageViewport.style.width = `${WORKSPACE_BASE_WIDTH * state.zoom}px`;
    dom.workspaceStageViewport.style.height = `${WORKSPACE_BASE_HEIGHT * state.zoom}px`;
    const percent = `${Math.round(state.zoom * 100)}%`;
    dom.zoomValue.textContent = percent;
    dom.zoomResetButton.textContent = percent;
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

  return { render, renderCanvas, applyWorkspaceZoom };
}
