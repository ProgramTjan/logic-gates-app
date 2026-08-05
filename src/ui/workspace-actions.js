import { isLessonUnlocked, createDefaultLearner, recordQuizAnswer } from "../data/curriculum.js";
import { S } from "../data/strings.js";

export function createWorkspaceActionHandlers(deps) {
  const {
    dom,
    state,
    challenges,
    challengeVerifier,
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
    showCompletionOverlay,
  } = deps;

  function getLearner() {
    if (!state.project.learner) {
      state.project.learner = createDefaultLearner();
    }
    return state.project.learner;
  }

  function isChallengeUnlocked(challengeId) {
    const challenge = challenges.find((item) => item.id === challengeId);
    if (!challenge) {
      return false;
    }
    return isLessonUnlocked(challenge.id, getLearner(), challenge.prerequisites);
  }

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
      if (typeof deps.stopClockRunner === "function") {
        deps.stopClockRunner();
      }
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
    const seriesSummary = event.target.closest("summary[data-chip-series]");
    if (seriesSummary) {
      // Native <details>-toggle doet het visuele werk; hier alleen de open-status
      // onthouden zodat die een re-render overleeft.
      const seriesId = seriesSummary.dataset.chipSeries;
      if (!state.openChipSeries) {
        state.openChipSeries = new Set();
      }
      if (state.openChipSeries.has(seriesId)) {
        state.openChipSeries.delete(seriesId);
      } else {
        state.openChipSeries.add(seriesId);
      }
      return;
    }

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

  function selectNextOpenChallenge() {
    const learner = getLearner();
    const next = challenges.find(
      (challenge) =>
        isLessonUnlocked(challenge.id, learner, challenge.prerequisites) &&
        !(learner.completedChallengeIds || []).includes(challenge.id)
    );
    if (!next) {
      setStatus("Alle beschikbare lessen zijn afgerond.");
      renderChallenges();
      return;
    }
    state.selectedChallengeId = next.id;
    setStatus(`Les geselecteerd: ${next.title}.`);
    renderChallenges();
  }

  function handleChallengeListClick(event) {
    const freeModeLabel = event.target.closest("label.challenge-free-mode");
    if (freeModeLabel) {
      return;
    }

    const quizOption = event.target.closest("[data-quiz-challenge]");
    if (quizOption) {
      const challengeId = quizOption.dataset.quizChallenge;
      const questionIndex = Number(quizOption.dataset.quizQuestion);
      const optionIndex = Number(quizOption.dataset.quizOption);
      state.project.learner = recordQuizAnswer(
        getLearner(),
        challengeId,
        questionIndex,
        optionIndex
      );
      renderChallenges();
      return;
    }

    if (event.target.closest("[data-next-open-challenge]")) {
      selectNextOpenChallenge();
      return;
    }

    const tabButton = event.target.closest("[data-challenge-tab]");
    if (tabButton) {
      state.challengeDetailTab = tabButton.dataset.challengeTab;
      renderChallenges();
      return;
    }

    const toggleButton = event.target.closest("[data-toggle-challenge]");
    if (toggleButton) {
      const challengeId = toggleButton.dataset.toggleChallenge;
      state.selectedChallengeId = state.selectedChallengeId === challengeId ? null : challengeId;
      renderChallenges();
      return;
    }

    const openButton = event.target.closest("[data-open-challenge]");
    if (openButton) {
      if (openButton.disabled || !isChallengeUnlocked(openButton.dataset.openChallenge)) {
        setStatus("Deze les is nog vergrendeld. Rond eerst de vorige les af, of zet vrije modus aan.");
        return;
      }
      openChallengeWorkspace(openButton.dataset.openChallenge);
      return;
    }

    const submitButton = event.target.closest("[data-submit-challenge]");
    if (submitButton) {
      if (submitButton.disabled || !isChallengeUnlocked(submitButton.dataset.submitChallenge)) {
        setStatus("Deze les is nog vergrendeld. Submit is pas mogelijk na unlock.");
        return;
      }
      submitChallenge(submitButton.dataset.submitChallenge);
      return;
    }

    if (event.target.closest("[data-show-completion-overlay]")) {
      if (typeof showCompletionOverlay === "function") {
        showCompletionOverlay(true);
      }
      return;
    }

    const selectedCard = event.target.closest("[data-select-challenge]");
    if (selectedCard) {
      if (state.selectedChallengeId !== selectedCard.dataset.selectChallenge) {
        state.challengeDetailTab = "theorie";
      }
      state.selectedChallengeId = selectedCard.dataset.selectChallenge;
      renderChallenges();
    }
  }

  function updateChallengeStartButton() {
    const selectedChallenge = challenges.find((item) => item.id === state.selectedChallengeId);
    if (!selectedChallenge) {
      dom.challengeStartButton.disabled = true;
      dom.challengeStartButton.textContent = S.startSelected;
      return;
    }
    const unlocked = isChallengeUnlocked(selectedChallenge.id);
    dom.challengeStartButton.disabled = !unlocked;
    dom.challengeStartButton.textContent = unlocked
      ? `${S.start} ${selectedChallenge.title}`
      : `${S.locked}: ${selectedChallenge.title}`;
  }

  function updateChallengeSubmitButton() {
    const challenge = getActiveWorkspaceChallenge();
    if (!challenge) {
      dom.challengeSubmitButton.disabled = true;
      dom.challengeSubmitButton.textContent = S.submitCurrent;
      return;
    }
    const unlocked = isChallengeUnlocked(challenge.id);
    dom.challengeSubmitButton.disabled = !unlocked;
    dom.challengeSubmitButton.textContent = unlocked
      ? `${S.submit} ${challenge.names[0]}`
      : `${S.locked}: ${challenge.names[0]}`;
  }

  function startSelectedChallenge() {
    if (!state.selectedChallengeId) {
      return;
    }
    if (!isChallengeUnlocked(state.selectedChallengeId)) {
      setStatus("Deze les is nog vergrendeld. Rond eerst de vorige les af, of zet vrije modus aan.");
      renderChallenges();
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
    if (!isChallengeUnlocked(challenge.id)) {
      setStatus("Deze les is nog vergrendeld. Submit is pas mogelijk na unlock.");
      return;
    }
    submitChallenge(challenge.id);
  }

  function handleChallengeListChange(event) {
    const freeModeToggle = event.target.closest("[data-toggle-free-mode]");
    if (!freeModeToggle) {
      return;
    }
    const learner = getLearner();
    learner.unlockedAll = Boolean(freeModeToggle.checked);
    setStatus(
      learner.unlockedAll
        ? "Vrije modus aan — alle lessen zijn startbaar."
        : "Vrije modus uit — leerpad-gating hersteld."
    );
    renderChallenges();
  }

  return {
    handleBuiltinPaletteClick,
    handleWorkspaceListClick,
    handleChipLibraryClick,
    handleChallengeListClick,
    handleChallengeListChange,
    updateChallengeStartButton,
    updateChallengeSubmitButton,
    startSelectedChallenge,
    submitCurrentChallenge,
    selectNextOpenChallenge,
    isChallengeUnlocked,
  };
}
