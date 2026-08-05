export function createProjectIoActions(deps) {
  const {
    state,
    normalizeProject,
    saveProject,
    setStatus,
    render,
    encodeProjectForUrlHash,
    decodeProjectFromUrlHashPayload,
    parseSharePayloadFromHash,
    stopClockRunner,
    listBackups,
    restoreBackup,
    getProjectStateDeps,
    appModals,
  } = deps;

  function haltRunner() {
    if (typeof stopClockRunner === "function") {
      stopClockRunner();
    }
  }

  async function tryLoadProjectFromShareHash() {
    const payload = parseSharePayloadFromHash(location.hash);
    if (!payload) {
      return;
    }
    const ok = window.confirm(
      "Project uit deze link laden? Niet-opgeslagen wijzigingen in dit tabblad worden overschreven; bij opslaan vervang je ook je lokale project in deze browser."
    );
    if (!ok) {
      history.replaceState(null, "", `${location.pathname}${location.search}`);
      return;
    }
    try {
      const data = await decodeProjectFromUrlHashPayload(payload);
      haltRunner();
      state.project = normalizeProject(data);
      state.selectedNodeId = null;
      state.pendingConnection = null;
      history.replaceState(null, "", `${location.pathname}${location.search}`);
      setStatus("Project geladen via gedeelde link.");
    } catch (error) {
      console.error(error);
      setStatus("Laden via link mislukt (corrupt of te groot).");
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
  }

  async function copyShareLink() {
    try {
      const payload = await encodeProjectForUrlHash(state.project);
      const url = `${location.origin}${location.pathname}#${payload}`;
      await navigator.clipboard.writeText(url);
      setStatus("Projectlink gekopieerd naar klembord.");
    } catch (error) {
      console.error(error);
      setStatus("Kon projectlink niet maken of kopiëren.");
    }
  }

  async function importShareFromPrompt() {
    const text = window.prompt(
      "Plak een volledige Forge Logic-URL, of alleen het stuk na # (begint met p=)",
      ""
    );
    if (!text) {
      return;
    }
    const trimmed = text.trim();
    const hashPart = trimmed.includes("#") ? trimmed.split("#").pop() : trimmed;
    if (!hashPart || !hashPart.startsWith("p=")) {
      setStatus("Geen geldige project-hash (verwacht p=...).");
      return;
    }
    try {
      const data = await decodeProjectFromUrlHashPayload(hashPart);
      haltRunner();
      state.project = normalizeProject(data);
      state.selectedNodeId = null;
      state.pendingConnection = null;
      saveProject();
      setStatus("Project uit link geïmporteerd.");
      render();
    } catch (error) {
      console.error(error);
      setStatus("Import uit link mislukt.");
    }
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
        haltRunner();
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

  async function restoreBackupFromUi() {
    const backups = typeof listBackups === "function" ? listBackups(localStorage) : [];
    if (!backups.length) {
      setStatus("Geen back-ups gevonden.");
      return;
    }
    if (!appModals || typeof appModals.showFormModal !== "function") {
      setStatus("Herstel-dialoog niet beschikbaar.");
      return;
    }

    const formatStamp = (iso) => {
      if (!iso) {
        return "onbekend tijdstip";
      }
      try {
        return new Date(iso).toLocaleString("nl-NL");
      } catch {
        return iso;
      }
    };

    const choice = await appModals.showFormModal({
      title: "Herstel back-up",
      lead: "Kies een lokale back-up. Je huidige project in deze browser wordt overschreven.",
      confirmLabel: "Herstellen",
      fields: [
        {
          id: "slot",
          label: "Back-up",
          type: "select",
          required: true,
          requiredMessage: "Kies een back-up.",
          options: backups.map((backup) => ({
            value: String(backup.slot),
            label: `#${backup.slot} — ${formatStamp(backup.savedAt)} — ${backup.workspaceCount} sheet(s)`,
          })),
        },
      ],
    });
    if (!choice) {
      return;
    }

    const slot = Number(choice.slot);
    const depsForRestore =
      typeof getProjectStateDeps === "function" ? getProjectStateDeps() : null;
    if (!depsForRestore || typeof restoreBackup !== "function") {
      setStatus("Herstellen mislukt (interne fout).");
      return;
    }

    try {
      const restored = restoreBackup(localStorage, slot, depsForRestore);
      if (!restored) {
        setStatus("Herstellen mislukt: back-up ontbreekt of is corrupt.");
        return;
      }
      haltRunner();
      state.project = restored;
      state.selectedNodeId = null;
      state.pendingConnection = null;
      setStatus(`Back-up #${slot} hersteld.`);
      render();
    } catch (error) {
      console.error(error);
      setStatus("Herstellen mislukt.");
    }
  }

  function showOnboardingIfNeeded() {
    if (localStorage.getItem("forge-onboarding-v1")) {
      return;
    }
    if (deps.dom.onboardingOverlay) {
      deps.dom.onboardingOverlay.hidden = false;
    }
  }

  function dismissOnboarding() {
    if (deps.dom.onboardingOverlay) {
      deps.dom.onboardingOverlay.hidden = true;
    }
    localStorage.setItem("forge-onboarding-v1", "1");
  }

  function showCompletionOverlay(force = false) {
    const learner = state.project?.learner;
    if (!learner) {
      return;
    }
    const completed = Array.isArray(learner.completedChallengeIds)
      ? learner.completedChallengeIds
      : [];
    if (!completed.includes("computer")) {
      return;
    }
    if (!force && learner.completionOverlayDismissed) {
      return;
    }
    const chipCount = (state.project.chipDefinitions || []).filter(
      (definition) => !(definition.description || "").startsWith("Starter ")
    ).length;
    if (deps.dom.completionSummary) {
      deps.dom.completionSummary.textContent = `${completed.length} lessen afgerond · ${chipCount} eigen chips in je bibliotheek.`;
    }
    if (deps.dom.completionOverlay) {
      deps.dom.completionOverlay.hidden = false;
    }
  }

  function dismissCompletionOverlay() {
    if (deps.dom.completionOverlay) {
      deps.dom.completionOverlay.hidden = true;
    }
    if (state.project?.learner) {
      state.project.learner = {
        ...state.project.learner,
        completionOverlayDismissed: true,
      };
      saveProject();
    }
  }

  return {
    tryLoadProjectFromShareHash,
    copyShareLink,
    importShareFromPrompt,
    exportProject,
    importProjectFromFile,
    restoreBackupFromUi,
    showOnboardingIfNeeded,
    dismissOnboarding,
    showCompletionOverlay,
    dismissCompletionOverlay,
  };
}
