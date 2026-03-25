export function createEventBinder(deps) {
  const { dom, handlers, workspaceActions, interactionHandlers } = deps;

  function bindEvents() {
    dom.undoButton.addEventListener("click", handlers.undo);
    dom.redoButton.addEventListener("click", handlers.redo);
    dom.newWorkspaceButton.addEventListener("click", handlers.createWorkspaceFromPrompt);
    dom.duplicateWorkspaceButton.addEventListener("click", handlers.duplicateCurrentWorkspace);
    dom.saveChipButton.addEventListener("click", handlers.saveCurrentWorkspaceAsChip);
    dom.toggleClocksButton.addEventListener("click", handlers.toggleWorkspaceClocks);
    dom.stepRegistersButton.addEventListener("click", handlers.stepRegisters);
    dom.resetStateButton.addEventListener("click", handlers.resetRuntimeState);
    dom.exportButton.addEventListener("click", handlers.exportProject);
    dom.importButton.addEventListener("click", handlers.importClick);
    dom.importInput.addEventListener("change", handlers.importProjectFromFile);
    dom.zoomOutButton.addEventListener("click", handlers.zoomOut);
    dom.zoomResetButton.addEventListener("click", handlers.zoomReset);
    dom.zoomInButton.addEventListener("click", handlers.zoomIn);
    dom.challengeStartButton.addEventListener("click", workspaceActions.startSelectedChallenge);
    dom.challengeSubmitButton.addEventListener("click", workspaceActions.submitCurrentChallenge);

    dom.builtinPalette.addEventListener("click", workspaceActions.handleBuiltinPaletteClick);
    dom.workspaceList.addEventListener("click", workspaceActions.handleWorkspaceListClick);
    dom.chipLibrary.addEventListener("click", workspaceActions.handleChipLibraryClick);
    dom.challengeList.addEventListener("click", workspaceActions.handleChallengeListClick);
    dom.nodeLayer.addEventListener("click", interactionHandlers.handleNodeLayerClick);
    dom.nodeLayer.addEventListener("pointerdown", interactionHandlers.handleNodeLayerPointerDown);
    dom.canvas.addEventListener("pointerdown", interactionHandlers.handleCanvasPointerDown);
    dom.inspector.addEventListener("focusin", handlers.inspectorFocusIn);
    dom.inspector.addEventListener("input", handlers.inspectorInput);
    dom.inspector.addEventListener("click", handlers.inspectorClick);

    document.addEventListener("pointermove", interactionHandlers.handleDragMove);
    document.addEventListener("pointerup", interactionHandlers.stopDragging);
    document.addEventListener("pointercancel", interactionHandlers.stopDragging);
    document.addEventListener("keydown", handlers.keydown);
  }

  return { bindEvents };
}
