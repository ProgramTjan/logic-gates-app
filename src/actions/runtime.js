export function createRuntimeActions(deps) {
  const {
    state,
    parseBits,
    formatBits,
    getCurrentWorkspace,
    collectRegisterUpdates,
    setStatus,
    renderWorkspace,
    saveProject,
  } = deps;

  let runnerTimer = null;
  let runnerRaf = null;
  let runnerHz = 4;
  let running = false;

  function toggleInputPinNode(node) {
    const width = node.config.width || 1;
    const current = parseBits(node.config.previewValue, width);
    const toggled = current.map((bit) => !bit);
    node.config.previewValue = formatBits(toggled, width);
    setStatus(`${node.config.label} is nu ${node.config.previewValue}.`);
  }

  function toggleSwitchNode(node) {
    const current = parseBits(node.config.value, node.config.width);
    const toggled = current.map((bit) => !bit);
    node.config.value = formatBits(toggled, node.config.width);
    setStatus(`${node.config.label} is nu ${node.config.value}.`);
  }

  function toggleClockNode(node) {
    node.config.value = node.config.value === "1" ? "0" : "1";
    setStatus(`${node.config.label} is nu ${node.config.value}.`);
  }

  function toggleWorkspaceClocks() {
    const workspace = getCurrentWorkspace();
    let toggled = 0;
    workspace.nodes.forEach((node) => {
      if (node.type === "clock") {
        node.config.value = node.config.value === "1" ? "0" : "1";
        toggled += 1;
      }
    });
    setStatus(toggled ? `${toggled} clock node(s) omgezet.` : "Geen clock nodes in deze workspace.");
    renderWorkspace();
  }

  function applyRegisterStep(workspace) {
    const updates = collectRegisterUpdates(workspace, {}, `workspace:${workspace.id}`, new Set());
    updates.forEach((update) => {
      state.project.runtime.registerStates[update.key] = { bits: update.bits };
    });
    return updates.length;
  }

  function stepRegisters() {
    const workspace = getCurrentWorkspace();
    const count = applyRegisterStep(workspace);
    setStatus(count ? `${count} register(s) bijgewerkt.` : "Geen registers gevonden.");
    renderWorkspace();
  }

  function setClockSources(workspace, high) {
    const bit = high ? "1" : "0";
    workspace.nodes.forEach((node) => {
      if (node.type === "clock") {
        node.config.value = bit;
      } else if (
        node.type === "input-pin" &&
        String(node.config?.label || "").toUpperCase() === "CLK"
      ) {
        node.config.previewValue = bit;
      }
    });
  }

  /**
   * Eén runner-tick = volledige klokcyclus (level-sensitive CLK in collectRegisterUpdates):
   * clocks/CLK-inputs → 1, registers stappen, clocks/CLK → 0, registers stappen.
   * Zo latchen registers op de “hoog”-fase en blijft de laag-fase stabiel voor de UI.
   */
  function runClockCycle() {
    const workspace = getCurrentWorkspace();
    if (!workspace) {
      return;
    }
    setClockSources(workspace, true);
    applyRegisterStep(workspace);
    setClockSources(workspace, false);
    applyRegisterStep(workspace);
    renderWorkspace({ save: false, evaluate: true });
  }

  function clearRunnerTimers() {
    if (runnerTimer != null) {
      clearInterval(runnerTimer);
      runnerTimer = null;
    }
    if (runnerRaf != null) {
      cancelAnimationFrame(runnerRaf);
      runnerRaf = null;
    }
  }

  function scheduleRunner() {
    clearRunnerTimers();
    if (!running) {
      return;
    }
    if (runnerHz === "max") {
      const loop = () => {
        if (!running) {
          return;
        }
        runClockCycle();
        runnerRaf = requestAnimationFrame(loop);
      };
      runnerRaf = requestAnimationFrame(loop);
      return;
    }
    const hz = Number(runnerHz) || 4;
    const ms = Math.max(16, Math.round(1000 / hz));
    runnerTimer = setInterval(() => {
      if (!running) {
        return;
      }
      runClockCycle();
    }, ms);
  }

  function updateRunnerUi() {
    if (typeof deps.onRunnerStateChange === "function") {
      deps.onRunnerStateChange({ running, hz: runnerHz });
    }
  }

  function start(hz) {
    if (hz !== undefined) {
      runnerHz = hz === "max" ? "max" : Number(hz) || 4;
    }
    running = true;
    scheduleRunner();
    setStatus(
      runnerHz === "max"
        ? "Klok draait (max / per frame)."
        : `Klok draait op ${runnerHz} Hz.`
    );
    updateRunnerUi();
  }

  function stop() {
    if (!running && runnerTimer == null && runnerRaf == null) {
      updateRunnerUi();
      return;
    }
    running = false;
    clearRunnerTimers();
    if (typeof saveProject === "function") {
      saveProject();
    }
    setStatus("Klok gepauzeerd.");
    updateRunnerUi();
    renderWorkspace({ save: false });
  }

  function isRunning() {
    return running;
  }

  function setSpeed(hz) {
    runnerHz = hz === "max" ? "max" : Number(hz) || 4;
    if (running) {
      scheduleRunner();
      setStatus(runnerHz === "max" ? "Kloksnelheid: max." : `Kloksnelheid: ${runnerHz} Hz.`);
    }
    updateRunnerUi();
  }

  function getSpeed() {
    return runnerHz;
  }

  function togglePlay() {
    if (running) {
      stop();
    } else {
      start(runnerHz);
    }
  }

  function resetRuntimeState() {
    stop();
    state.project.runtime.registerStates = {};
    state.project.workspaces.forEach((workspace) => {
      workspace.nodes.forEach((node) => {
        if (node.type === "clock") {
          node.config.value = "0";
        }
        if (
          node.type === "input-pin" &&
          String(node.config?.label || "").toUpperCase() === "CLK"
        ) {
          node.config.previewValue = "0";
        }
      });
    });
    setStatus("Runtime state gereset. Clocks staan weer op 0 en registers op hun resetwaarde.");
    renderWorkspace();
  }

  const clockRunner = {
    start,
    stop,
    isRunning,
    setSpeed,
    getSpeed,
    togglePlay,
    runClockCycle,
  };

  return {
    toggleInputPinNode,
    toggleSwitchNode,
    toggleClockNode,
    toggleWorkspaceClocks,
    stepRegisters,
    resetRuntimeState,
    clockRunner,
  };
}
