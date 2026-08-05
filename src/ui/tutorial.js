/**
 * Guided walkthrough voor les 1 (NAND).
 * Alleen UI + state-observatie — geen sim-modules.
 */

const NAND_LESSON_ID = "nand";

function ensureOverlay() {
  let root = document.getElementById("tutorial-root");
  if (root) {
    return root;
  }
  root = document.createElement("div");
  root.id = "tutorial-root";
  root.className = "tutorial-root";
  root.hidden = true;
  root.innerHTML = `
    <div class="tutorial-spotlight" data-tutorial-spotlight hidden></div>
    <div class="tutorial-coach" data-tutorial-coach hidden>
      <p class="tutorial-coach-text" data-tutorial-text></p>
      <div class="tutorial-coach-actions">
        <span class="tutorial-step-indicator" data-tutorial-step></span>
        <button type="button" class="ghost-button tutorial-skip" data-tutorial-skip>Overslaan</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function findInputPin(workspace, label) {
  return workspace.nodes.find(
    (node) => node.type === "input-pin" && String(node.config?.label || "") === label
  );
}

function findOutputPin(workspace, label) {
  return workspace.nodes.find(
    (node) => node.type === "output-pin" && String(node.config?.label || "") === label
  );
}

function findNandGate(workspace) {
  return workspace.nodes.find(
    (node) => node.type === "gate" && String(node.config?.gateType || "").toUpperCase() === "NAND"
  );
}

function hasWire(workspace, fromId, toId) {
  return workspace.wires.some(
    (wire) => wire.fromNodeId === fromId && wire.toNodeId === toId
  );
}

export function createTutorial(deps) {
  const { state, getCurrentWorkspace, setStatus } = deps;

  let active = false;
  let stepIndex = 0;
  let root = null;

  const steps = [
    {
      id: "place-nand",
      text: "Open Parts en plaats een NAND-gate op het canvas.",
      getTarget() {
        const dropdown = document.querySelector(".parts-dropdown");
        const nandBtn = document.querySelector('[data-part-type="gate-nand"]');
        if (dropdown && !dropdown.open) {
          return dropdown.querySelector("summary");
        }
        return nandBtn || dropdown?.querySelector("summary") || null;
      },
      isComplete(workspace) {
        return Boolean(findNandGate(workspace));
      },
    },
    {
      id: "wire-a",
      text: "Verbind Input A met de NAND-gate: klik eerst de output-pin van A, daarna een input-pin van de gate.",
      getTarget() {
        const workspace = getCurrentWorkspace();
        const inputA = findInputPin(workspace, "A");
        if (!inputA) {
          return null;
        }
        return (
          document.querySelector(
            `[data-node-id="${inputA.id}"][data-pin-direction="output"]`
          ) || document.querySelector(`[data-node-id="${inputA.id}"]`)
        );
      },
      isComplete(workspace) {
        const inputA = findInputPin(workspace, "A");
        const nand = findNandGate(workspace);
        return Boolean(inputA && nand && hasWire(workspace, inputA.id, nand.id));
      },
    },
    {
      id: "wire-out",
      text: "Verbind de NAND-gate met OUT: klik de gate-output, daarna de input-pin van OUT.",
      getTarget() {
        const workspace = getCurrentWorkspace();
        const nand = findNandGate(workspace);
        if (!nand) {
          return null;
        }
        return (
          document.querySelector(
            `[data-node-id="${nand.id}"][data-pin-direction="output"]`
          ) || document.querySelector(`[data-node-id="${nand.id}"]`)
        );
      },
      isComplete(workspace) {
        const nand = findNandGate(workspace);
        const out = findOutputPin(workspace, "OUT");
        return Boolean(nand && out && hasWire(workspace, nand.id, out.id));
      },
    },
    {
      id: "toggle-a",
      text: "Toggle Input A en kijk hoe het lampje / de signalen veranderen.",
      getTarget() {
        const workspace = getCurrentWorkspace();
        const inputA = findInputPin(workspace, "A");
        if (!inputA) {
          return null;
        }
        return (
          document.querySelector(
            `[data-node-action="toggle-input-pin"][data-node-id="${inputA.id}"]`
          ) || document.querySelector(`[data-node-id="${inputA.id}"]`)
        );
      },
      isComplete(workspace) {
        const inputA = findInputPin(workspace, "A");
        return Boolean(inputA && String(inputA.config?.previewValue || "0").includes("1"));
      },
    },
    {
      id: "submit",
      text: "Klik Submit om je NAND-chip te laten controleren. (Tip: verbind ook Input B voor een volledige oplossing.)",
      getTarget() {
        return (
          document.querySelector('[data-submit-challenge="nand"]') ||
          document.getElementById("challenge-submit-button")
        );
      },
      isComplete() {
        const completed = state.project.learner?.completedChallengeIds || [];
        return completed.includes(NAND_LESSON_ID);
      },
    },
  ];

  function getLearner() {
    if (!state.project.learner) {
      state.project.learner = {
        completedChallengeIds: [],
        unlockedAll: false,
        quizAnswers: {},
        tutorialDismissed: false,
      };
    }
    return state.project.learner;
  }

  function shouldAutoStart(challengeId) {
    if (challengeId !== NAND_LESSON_ID) {
      return false;
    }
    const learner = getLearner();
    if (learner.tutorialDismissed) {
      return false;
    }
    if ((learner.completedChallengeIds || []).includes(NAND_LESSON_ID)) {
      return false;
    }
    return true;
  }

  function positionCoach(target) {
    if (!root) {
      return;
    }
    const coach = root.querySelector("[data-tutorial-coach]");
    const spotlight = root.querySelector("[data-tutorial-spotlight]");
    if (!coach || !spotlight) {
      return;
    }

    if (!target || !target.getBoundingClientRect) {
      spotlight.hidden = true;
      coach.style.top = "72px";
      coach.style.left = "50%";
      coach.style.transform = "translateX(-50%)";
      coach.hidden = false;
      return;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      spotlight.hidden = true;
      coach.style.top = "72px";
      coach.style.left = "50%";
      coach.style.transform = "translateX(-50%)";
      coach.hidden = false;
      return;
    }

    const pad = 6;
    spotlight.hidden = false;
    spotlight.style.top = `${Math.max(0, rect.top - pad)}px`;
    spotlight.style.left = `${Math.max(0, rect.left - pad)}px`;
    spotlight.style.width = `${rect.width + pad * 2}px`;
    spotlight.style.height = `${rect.height + pad * 2}px`;

    const coachWidth = Math.min(320, window.innerWidth - 24);
    let top = rect.bottom + 12;
    let left = rect.left;
    if (top + 120 > window.innerHeight) {
      top = Math.max(12, rect.top - 120);
    }
    if (left + coachWidth > window.innerWidth - 12) {
      left = window.innerWidth - coachWidth - 12;
    }
    left = Math.max(12, left);

    coach.style.transform = "none";
    coach.style.top = `${top}px`;
    coach.style.left = `${left}px`;
    coach.style.width = `${coachWidth}px`;
    coach.hidden = false;
  }

  function renderStep() {
    if (!active || !root) {
      return;
    }
    const step = steps[stepIndex];
    if (!step) {
      stop();
      return;
    }
    root.hidden = false;
    const textEl = root.querySelector("[data-tutorial-text]");
    const stepEl = root.querySelector("[data-tutorial-step]");
    if (textEl) {
      textEl.textContent = step.text;
    }
    if (stepEl) {
      stepEl.textContent = `Stap ${stepIndex + 1}/${steps.length}`;
    }
    positionCoach(step.getTarget());
  }

  function advanceIfNeeded() {
    if (!active) {
      return;
    }
    const workspace = getCurrentWorkspace();
    if (!workspace) {
      return;
    }
    while (stepIndex < steps.length && steps[stepIndex].isComplete(workspace)) {
      stepIndex += 1;
    }
    if (stepIndex >= steps.length) {
      stop();
      if (typeof setStatus === "function") {
        setStatus("Walkthrough voltooid — goed gedaan!");
      }
      return;
    }
    renderStep();
  }

  function onSkipClick(event) {
    if (!event.target.closest("[data-tutorial-skip]")) {
      return;
    }
    dismiss();
  }

  function start() {
    root = ensureOverlay();
    if (!root.dataset.bound) {
      root.addEventListener("click", onSkipClick);
      root.dataset.bound = "1";
    }
    active = true;
    stepIndex = 0;
    const workspace = getCurrentWorkspace();
    while (workspace && stepIndex < steps.length && steps[stepIndex].isComplete(workspace)) {
      stepIndex += 1;
    }
    if (stepIndex >= steps.length) {
      stop();
      return;
    }
    renderStep();
  }

  function stop() {
    active = false;
    if (root) {
      root.hidden = true;
      const coach = root.querySelector("[data-tutorial-coach]");
      const spotlight = root.querySelector("[data-tutorial-spotlight]");
      if (coach) {
        coach.hidden = true;
      }
      if (spotlight) {
        spotlight.hidden = true;
      }
    }
  }

  function dismiss() {
    const learner = getLearner();
    learner.tutorialDismissed = true;
    stop();
    if (typeof setStatus === "function") {
      setStatus("Walkthrough overgeslagen.");
    }
  }

  function maybeStart(challengeId) {
    if (!shouldAutoStart(challengeId)) {
      return;
    }
    start();
  }

  function onStateChanged() {
    if (!active) {
      return;
    }
    advanceIfNeeded();
  }

  function isActive() {
    return active;
  }

  return {
    maybeStart,
    start,
    stop,
    dismiss,
    onStateChanged,
    isActive,
  };
}
