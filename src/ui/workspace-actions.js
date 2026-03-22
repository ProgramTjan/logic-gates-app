export function createWorkspaceActionHandlers(deps) {
  const {
    dom,
    state,
    challenges,
    render,
    renderChallenges,
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
  } = deps;

  function closePartsDropdown() {
    const dropdown = document.querySelector(".parts-dropdown");
    if (dropdown && dropdown.open) {
      dropdown.open = false;
    }
  }

  function handleBuiltinPaletteClick(event) {
    const button = event.target.closest("[data-part-type]");
    if (button) {
      addPartToWorkspace(button.dataset.partType);
      closePartsDropdown();
      return;
    }

    const chipButton = event.target.closest("[data-place-chip]");
    if (chipButton) {
      addPartToWorkspace("chip-instance", chipButton.dataset.placeChip);
      closePartsDropdown();
    }
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

  function handleChallengeListClick(event) {
    const toggleButton = event.target.closest("[data-toggle-challenge]");
    if (toggleButton) {
      const challengeId = toggleButton.dataset.toggleChallenge;
      state.selectedChallengeId = state.selectedChallengeId === challengeId ? null : challengeId;
      renderChallenges();
      return;
    }

    const openButton = event.target.closest("[data-open-challenge]");
    if (openButton) {
      openChallengeWorkspace(openButton.dataset.openChallenge);
      return;
    }

    const submitButton = event.target.closest("[data-submit-challenge]");
    if (submitButton) {
      submitChallenge(submitButton.dataset.submitChallenge);
      return;
    }

    const selectedCard = event.target.closest("[data-select-challenge]");
    if (selectedCard) {
      state.selectedChallengeId = selectedCard.dataset.selectChallenge;
      renderChallenges();
    }
  }

  function updateChallengeStartButton() {
    const selectedChallenge = challenges.find((item) => item.id === state.selectedChallengeId);
    if (!selectedChallenge) {
      dom.challengeStartButton.disabled = true;
      dom.challengeStartButton.textContent = "Start Selected";
      return;
    }
    dom.challengeStartButton.disabled = false;
    dom.challengeStartButton.textContent = `Start ${selectedChallenge.title}`;
  }

  function updateChallengeSubmitButton() {
    const challenge = getActiveWorkspaceChallenge();
    if (!challenge) {
      dom.challengeSubmitButton.disabled = true;
      dom.challengeSubmitButton.textContent = "Submit Current";
      return;
    }
    dom.challengeSubmitButton.disabled = false;
    dom.challengeSubmitButton.textContent = `Submit ${challenge.names[0]}`;
  }

  function startSelectedChallenge() {
    if (!state.selectedChallengeId) {
      return;
    }
    openChallengeWorkspace(state.selectedChallengeId);
  }

  function submitCurrentChallenge() {
    const challenge = getActiveWorkspaceChallenge();
    if (!challenge) {
      const fallbackChallenge = challenges.find((item) => item.id === state.selectedChallengeId);
      setStatus(
        fallbackChallenge
          ? `Open eerst de actieve sheet voor ${fallbackChallenge.title} en lever die daarna in.`
          : "Open eerst een challenge-sheet om hem in te leveren."
      );
      render();
      return;
    }
    submitChallenge(challenge.id);
  }

  return {
    handleBuiltinPaletteClick,
    handleWorkspaceListClick,
    handleChipLibraryClick,
    handleChallengeListClick,
    updateChallengeStartButton,
    updateChallengeSubmitButton,
    startSelectedChallenge,
    submitCurrentChallenge,
  };
}
