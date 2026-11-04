export function createEventBinder(deps) {
  const { dom, handlers, workspaceActions, interactionHandlers, courseRenderers, setAppView, changeLocale } =
    deps;

  function bindEvents() {
    document.querySelectorAll("[data-set-locale]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof changeLocale === "function") {
          changeLocale(btn.dataset.setLocale);
        }
      });
    });
    dom.undoButton.addEventListener("click", handlers.undo);
    dom.redoButton.addEventListener("click", handlers.redo);
    if (dom.shareLinkButton) {
      dom.shareLinkButton.addEventListener("click", handlers.copyShareLink);
    }
    if (dom.sharePasteButton) {
      dom.sharePasteButton.addEventListener("click", handlers.importShareFromPrompt);
    }
    if (handlers.dismissOnboarding) {
      if (dom.onboardingDismiss) {
        dom.onboardingDismiss.addEventListener("click", handlers.dismissOnboarding);
      }
      if (dom.onboardingOverlay) {
        dom.onboardingOverlay.addEventListener("click", (event) => {
          if (event.target === dom.onboardingOverlay) {
            handlers.dismissOnboarding();
          }
        });
      }
    }
    if (handlers.dismissCompletionOverlay) {
      if (dom.completionDismiss) {
        dom.completionDismiss.addEventListener("click", handlers.dismissCompletionOverlay);
      }
      if (dom.completionOverlay) {
        dom.completionOverlay.addEventListener("click", (event) => {
          if (event.target === dom.completionOverlay) {
            handlers.dismissCompletionOverlay();
          }
        });
      }
    }
    dom.newWorkspaceButton.addEventListener("click", handlers.createWorkspaceFromPrompt);
    if (dom.duplicateWorkspaceButton) {
      dom.duplicateWorkspaceButton.addEventListener("click", handlers.duplicateCurrentWorkspace);
    }
    dom.saveChipButton.addEventListener("click", handlers.saveCurrentWorkspaceAsChip);
    dom.toggleClocksButton.addEventListener("click", handlers.toggleWorkspaceClocks);
    dom.stepRegistersButton.addEventListener("click", handlers.stepRegisters);
    if (dom.clockPlayButton) {
      dom.clockPlayButton.addEventListener("click", handlers.toggleClockPlay);
    }
    if (dom.clockSpeedSelect) {
      dom.clockSpeedSelect.addEventListener("change", handlers.changeClockSpeed);
    }
    dom.resetStateButton.addEventListener("click", handlers.resetRuntimeState);
    dom.exportButton.addEventListener("click", handlers.exportProject);
    dom.importButton.addEventListener("click", handlers.importClick);
    if (dom.restoreBackupButton && handlers.restoreBackup) {
      dom.restoreBackupButton.addEventListener("click", handlers.restoreBackup);
    }
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
    dom.challengeList.addEventListener("change", workspaceActions.handleChallengeListChange);
    document.querySelectorAll(".app-view-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        if (typeof setAppView === "function") {
          setAppView(tab.dataset.appView);
        }
      });
    });
    if (dom.courseView && courseRenderers) {
      dom.courseView.addEventListener("click", courseRenderers.handleCourseClick);
    }
    dom.nodeLayer.addEventListener("click", interactionHandlers.handleNodeLayerClick);
    dom.nodeLayer.addEventListener("pointerdown", interactionHandlers.handleNodeLayerPointerDown);
    dom.wireLayer.addEventListener("pointerdown", interactionHandlers.handleWirePointerDown);
    dom.wireLayer.addEventListener("click", interactionHandlers.handleWireClick);
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
