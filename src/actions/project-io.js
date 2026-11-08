import { t, getLocale } from "../i18n/index.js";
import { CHALLENGES } from "../data/challenges.js";

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
      t("share.confirmLoad")
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
      setStatus(t("status.importOk"));
    } catch (error) {
      console.error(error);
      setStatus(t("status.importFailed"));
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
  }

  async function copyShareLink() {
    try {
      const payload = await encodeProjectForUrlHash(state.project);
      const url = `${location.origin}${location.pathname}#${payload}`;
      await navigator.clipboard.writeText(url);
      setStatus(t("status.shareCopied"));
    } catch (error) {
      console.error(error);
      setStatus(t("status.shareFailed"));
    }
  }

  async function importShareFromPrompt() {
    const text = window.prompt(
      t("share.pastePrompt"),
      ""
    );
    if (!text) {
      return;
    }
    const trimmed = text.trim();
    const hashPart = trimmed.includes("#") ? trimmed.split("#").pop() : trimmed;
    if (!hashPart || !hashPart.startsWith("p=")) {
      setStatus(t("status.importFailed"));
      return;
    }
    try {
      const data = await decodeProjectFromUrlHashPayload(hashPart);
      haltRunner();
      state.project = normalizeProject(data);
      state.selectedNodeId = null;
      state.pendingConnection = null;
      saveProject();
      setStatus(t("status.importOk"));
      render();
    } catch (error) {
      console.error(error);
      setStatus(t("status.importFailed"));
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
    setStatus(t("status.exportOk"));
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
        setStatus(t("status.importOk"));
        render();
      } catch (error) {
        console.error(error);
        setStatus(t("status.importFailed"));
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function restoreBackupFromUi() {
    const backups = typeof listBackups === "function" ? listBackups(localStorage) : [];
    if (!backups.length) {
      setStatus(t("status.restoreMissing"));
      return;
    }
    if (!appModals || typeof appModals.showFormModal !== "function") {
      setStatus(t("status.restoreNoModal"));
      return;
    }

    const formatStamp = (iso) => {
      if (!iso) {
        return "—";
      }
      try {
        return new Date(iso).toLocaleString(getLocale() === "nl" ? "nl-NL" : "en-US");
      } catch {
        return iso;
      }
    };

    const choice = await appModals.showFormModal({
      title: t("restoreModalTitle"),
      lead: t("restoreModalLead"),
      confirmLabel: t("restoreConfirm"),
      fields: [
        {
          id: "slot",
          label: t("restoreBackup"),
          type: "select",
          required: true,
          requiredMessage: t("fieldRequired", { label: t("restoreBackup") }),
          options: backups.map((backup) => ({
            value: String(backup.slot),
            label: t("restoreSlotLabel", {
              when: `#${backup.slot} — ${formatStamp(backup.savedAt)}`,
              sheets: backup.workspaceCount,
            }),
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
      setStatus(t("status.restoreFailed"));
      return;
    }

    try {
      const restored = restoreBackup(localStorage, slot, depsForRestore);
      if (!restored) {
        setStatus(t("status.restoreMissing"));
        return;
      }
      haltRunner();
      state.project = restored;
      state.selectedNodeId = null;
      state.pendingConnection = null;
      setStatus(t("status.restoreOk"));
      render();
    } catch (error) {
      console.error(error);
      setStatus(t("status.restoreFailed"));
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
    if (deps.dom.completionSummary) {
      deps.dom.completionSummary.textContent = t("status.completionSummary", {
        done: completed.length,
        total: CHALLENGES.length,
      });
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
