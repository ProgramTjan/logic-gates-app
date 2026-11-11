/**
 * Coach: guided, step-by-step walkthrough for a lesson.
 * Steps come from src/data/coach-scripts.js; this module only interprets them.
 * UI + state observation only — never touches the simulation.
 */

import { t } from "../i18n/index.js";

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
    <div class="tutorial-coach" data-tutorial-coach role="dialog" aria-live="polite" hidden>
      <p class="tutorial-coach-text" data-tutorial-text></p>
      <div class="tutorial-coach-actions">
        <span class="tutorial-step-indicator" data-tutorial-step></span>
        <span class="tutorial-coach-buttons">
          <button type="button" class="link-button tutorial-skip" data-tutorial-skip></button>
          <button type="button" class="primary-button tutorial-ack" data-tutorial-ack hidden></button>
        </span>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

export function createTutorial(deps) {
  const { state, getCurrentWorkspace, getChipDefinition, setStatus, getScript } = deps;

  let active = false;
  let lessonId = null;
  let steps = [];
  let stepIndex = 0;
  let acked = new Set();
  let root = null;
  let repositionFrame = 0;
  let revealedStep = -1;

  // ---------------------------------------------------------------------------
  // Matching nodes and checking conditions
  // ---------------------------------------------------------------------------
  function nodeMatches(node, match) {
    if (!match || !node) {
      return false;
    }
    if (match.anyOf) {
      return match.anyOf.some((sub) => nodeMatches(node, sub));
    }
    if (match.pin) {
      return (
        (node.type === "input-pin" || node.type === "output-pin") &&
        String(node.config?.label || "").trim() === match.pin
      );
    }
    if (match.gate) {
      return node.type === "gate" && String(node.config?.gateType || "").toUpperCase() === match.gate;
    }
    if (match.chip) {
      if (node.type !== "chip-instance") {
        return false;
      }
      const definition = getChipDefinition(node.config?.definitionId);
      return Boolean(definition && String(definition.name || "").toUpperCase() === match.chip);
    }
    return false;
  }

  function findNodes(workspace, match) {
    return workspace.nodes.filter((node) => nodeMatches(node, match));
  }

  function nodeById(workspace, id) {
    return workspace.nodes.find((node) => node.id === id);
  }

  function isHigh(node) {
    return Boolean(node && /1/.test(String(node.config?.previewValue || "0")));
  }

  function conditionHolds(workspace, until, index) {
    if (!until) {
      return false;
    }
    if (until.ack) {
      return acked.has(index);
    }
    if (until.all) {
      return until.all.every((sub) => conditionHolds(workspace, sub, index));
    }
    if (until.has) {
      return findNodes(workspace, until.has).length >= (until.count || 1);
    }
    if (until.wire) {
      const [from, to] = until.wire;
      return workspace.wires.some(
        (wire) =>
          nodeMatches(nodeById(workspace, wire.fromNodeId), from) && nodeMatches(nodeById(workspace, wire.toNodeId), to)
      );
    }
    if (until.fed) {
      const needed = until.pins || 1;
      const fedNodes = findNodes(workspace, until.fed).filter(
        (node) => new Set(workspace.wires.filter((wire) => wire.toNodeId === node.id).map((wire) => wire.toPin)).size >= needed
      );
      return fedNodes.length >= (until.count || 1);
    }
    if (until.high) {
      return until.high.every((label) => findNodes(workspace, { pin: label }).some(isHigh));
    }
    if (until.completed) {
      return (state.project.learner?.completedChallengeIds || []).includes(lessonId);
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Finding what to point at
  // ---------------------------------------------------------------------------
  function visible(el) {
    if (!el || !el.getBoundingClientRect) {
      return null;
    }
    const rect = el.getBoundingClientRect();
    return rect.width || rect.height ? el : null;
  }

  function pinElement(nodeId, direction, freeOnly, workspace) {
    const pins = [...document.querySelectorAll(`[data-node-id="${nodeId}"][data-pin-direction="${direction}"]`)];
    if (!freeOnly) {
      return pins[0] || null;
    }
    return (
      pins.find(
        (pin) => !workspace.wires.some((wire) => wire.toNodeId === nodeId && wire.toPin === pin.dataset.pinKey)
      ) || pins[0] || null
    );
  }

  function partButton(match) {
    // The parts strip is the one palette on every screen size.
    const strip = document.querySelector("#parts-strip");
    if (!strip) {
      return null;
    }
    let button = null;
    if (match.gate) {
      button = visible(strip.querySelector(`[data-strip-part="gate-${match.gate.toLowerCase()}"]`));
      if (!button) {
        // Not a built-in in this lesson: it is the chip you made yourself.
        button = [...strip.querySelectorAll("[data-strip-chip]")].find(
          (el) => el.textContent.trim().toLowerCase() === match.gate.toLowerCase()
        );
        button = visible(button);
      }
    }
    if (button && button.scrollIntoView) {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    return button || visible(strip);
  }

  /** While a wire is being drawn from the step's source, point at a free input of the target. */
  function pendingWireTarget(workspace, step) {
    const pending = state.pendingConnection;
    if (!pending || pending.direction !== "output") {
      return null;
    }
    const source = nodeById(workspace, pending.nodeId);
    const until = step.until || {};
    let toMatch = null;
    if (until.wire && nodeMatches(source, until.wire[0])) {
      toMatch = until.wire[1];
    } else if (until.fed) {
      toMatch = until.fed;
    } else if (until.all) {
      const wireCond = until.all.find((sub) => sub.wire && nodeMatches(source, sub.wire[0]));
      const fedCond = until.all.find((sub) => sub.fed);
      toMatch = wireCond ? wireCond.wire[1] : fedCond ? fedCond.fed : null;
    }
    if (!toMatch) {
      return null;
    }
    const candidates = findNodes(workspace, toMatch).filter((node) => node.id !== source?.id);
    for (const node of candidates) {
      const pin = visible(pinElement(node.id, "input", true, workspace));
      if (pin) {
        return pin;
      }
    }
    return null;
  }

  function resolveTarget(workspace, step) {
    const at = step.at || {};
    if (at.out) {
      const pending = pendingWireTarget(workspace, step);
      if (pending) {
        return { el: pending, pending: true };
      }
      const node = findNodes(workspace, at.out)[0];
      return { el: node ? visible(pinElement(node.id, "output", false, workspace)) : null };
    }
    if (at.part) {
      return { el: visible(partButton(at.part)) };
    }
    if (at.toggle) {
      const node = findNodes(workspace, { pin: at.toggle })[0];
      return {
        el: node ? visible(document.querySelector(`[data-node-action="toggle-input-pin"][data-node-id="${node.id}"]`)) : null,
      };
    }
    if (at.check) {
      return { el: visible(document.querySelector(`[data-submit-challenge="${lessonId}"]`)) };
    }
    if (at.selector) {
      return { el: visible(document.querySelector(at.selector)) };
    }
    return { el: null };
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function rectsOverlap(a, b, margin = 4) {
    return (
      a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin
    );
  }

  /**
   * Places the coach balloon.
   *  - target inside the lesson panel, wide screen: right of the panel, level with the target, arrow to the left;
   *  - narrow screen (lesson panel is a bottom sheet): above the sheet, never over it;
   *  - no target (welcome): centred on the canvas;
   *  - never over the target itself or the primary button of the lesson action bar.
   */
  function positionCoach(target) {
    const coach = root.querySelector("[data-tutorial-coach]");
    const spotlight = root.querySelector("[data-tutorial-spotlight]");
    const coachWidth = Math.min(320, window.innerWidth - 24);
    coach.style.width = `${coachWidth}px`;
    coach.hidden = false;
    coach.dataset.arrow = "none";
    const coachHeight = coach.offsetHeight || 130;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const wide = vw >= 1024;
    const panel = document.getElementById("lesson-panel");
    const panelRect = panel && panel.offsetParent !== null ? panel.getBoundingClientRect() : null;
    const place = (top, left) => {
      coach.style.top = `${Math.round(top)}px`;
      coach.style.left = `${Math.round(Math.max(12, left))}px`;
    };

    if (!target) {
      spotlight.hidden = true;
      const canvas = document.getElementById("workspace-canvas");
      const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
      if (canvasRect && canvasRect.width > 0) {
        place(
          Math.max(8, canvasRect.top + (canvasRect.height - coachHeight) / 2),
          canvasRect.left + (canvasRect.width - coachWidth) / 2
        );
      } else {
        place(84, (vw - coachWidth) / 2);
      }
      return;
    }

    const rect = target.getBoundingClientRect();
    const pad = 6;
    spotlight.hidden = false;
    spotlight.style.top = `${Math.max(0, rect.top - pad)}px`;
    spotlight.style.left = `${Math.max(0, rect.left - pad)}px`;
    spotlight.style.width = `${rect.width + pad * 2}px`;
    spotlight.style.height = `${rect.height + pad * 2}px`;

    const inPanel = Boolean(panelRect && panel.contains(target));
    // Lowest y the balloon may reach: on narrow screens that is the top of the bottom sheet.
    const maxBottom = !wide && panelRect ? panelRect.top - 8 : vh - 8;
    let top;
    let left;
    let insideBigTarget = false;

    if (inPanel && wide) {
      // Beside the panel, level with the (top of the) target; the arrow points left at it.
      const anchorY = rect.top + Math.min(rect.height / 2, 40);
      top = Math.min(Math.max(8, anchorY - 28), vh - coachHeight - 8);
      left = panelRect.right + 14;
      coach.dataset.arrow = "left";
      coach.style.setProperty("--coach-arrow", `${Math.round(Math.min(Math.max(anchorY - top, 16), coachHeight - 16))}px`);
    } else if (inPanel) {
      // Narrow: above the bottom sheet, arrow down at the target's column.
      top = Math.max(8, panelRect.top - coachHeight - 10);
      left = Math.min(Math.max(12, rect.left), vw - coachWidth - 12);
      coach.dataset.arrow = "down";
      const arrowX = rect.left + Math.min(rect.width / 2, 40) - left;
      coach.style.setProperty("--coach-arrow", `${Math.round(Math.min(Math.max(arrowX, 16), coachWidth - 16))}px`);
    } else {
      top = rect.bottom + 14;
      if (top + coachHeight > maxBottom) {
        top = rect.top - coachHeight - 14;
      }
      if (top < 8) {
        // Big target (e.g. the canvas): sit inside it, near the top.
        insideBigTarget = true;
        top = Math.min(maxBottom - coachHeight, Math.max(8, rect.top + 14));
      }
      left = rect.left;
      if (left + coachWidth > vw - 12) {
        left = vw - coachWidth - 12;
      }
      // Keep clear of the lesson panel (its text) on wide screens.
      if (wide && panelRect && left < panelRect.right + 8) {
        left = panelRect.right + 8;
      }
    }

    // Never over the target or the lesson's primary button: move up.
    const avoid = [];
    if (!insideBigTarget) {
      avoid.push(rect);
    }
    const primary = document.querySelector(
      ".lesson-actionbar [data-intro-done], .lesson-actionbar [data-submit-challenge], .lesson-actionbar [data-next-lesson]"
    );
    if (primary) {
      avoid.push(primary.getBoundingClientRect());
    }
    for (const rectToAvoid of avoid) {
      const box = { left, right: left + coachWidth, top, bottom: top + coachHeight };
      if (rectsOverlap(box, rectToAvoid)) {
        top = Math.max(8, rectToAvoid.top - coachHeight - 10);
      }
    }
    place(top, left);
  }

  function renderStep() {
    if (!active || !root) {
      return;
    }
    const step = steps[stepIndex];
    const workspace = getCurrentWorkspace();
    if (!step || !workspace) {
      stop();
      return;
    }
    const { el, pending } = resolveTarget(workspace, step);
    // Bring the target into view once per step (e.g. the Check button at the bottom of the panel).
    if (el && revealedStep !== stepIndex) {
      revealedStep = stepIndex;
      const rect = el.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth) {
        el.scrollIntoView({ block: "center", inline: "center" });
      }
    }
    root.hidden = false;
    const textKey = pending ? "coach.wireTo" : step.say;
    root.querySelector("[data-tutorial-text]").textContent = t(textKey, step.vars || {});
    root.querySelector("[data-tutorial-step]").textContent = t("tutorialStep", {
      n: stepIndex + 1,
      total: steps.length,
    });
    root.querySelector("[data-tutorial-skip]").textContent = t("tutorialSkip");
    const ack = root.querySelector("[data-tutorial-ack]");
    ack.hidden = !step.until?.ack;
    ack.textContent = stepIndex === 0 ? t("coach.start") : t("coach.next");
    positionCoach(el);
  }

  function scheduleReposition() {
    if (!active || repositionFrame) {
      return;
    }
    repositionFrame = requestAnimationFrame(() => {
      repositionFrame = 0;
      renderStep();
    });
  }

  function advanceIfNeeded() {
    if (!active) {
      return;
    }
    const workspace = getCurrentWorkspace();
    if (!workspace || workspace.meta?.challengeId !== lessonId) {
      stop();
      return;
    }
    while (stepIndex < steps.length && conditionHolds(workspace, steps[stepIndex].until, stepIndex)) {
      stepIndex += 1;
    }
    if (stepIndex >= steps.length) {
      stop();
      if (typeof setStatus === "function") {
        setStatus(t("tutorialDone"));
      }
      return;
    }
    renderStep();
  }

  function onRootClick(event) {
    if (event.target.closest("[data-tutorial-skip]")) {
      dismiss();
      return;
    }
    if (event.target.closest("[data-tutorial-ack]")) {
      acked.add(stepIndex);
      advanceIfNeeded();
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  function getLearner() {
    const learner = state.project.learner;
    if (!learner.coachDismissed || typeof learner.coachDismissed !== "object") {
      learner.coachDismissed = {};
    }
    return learner;
  }

  function hasScript(challengeId) {
    const script = typeof getScript === "function" ? getScript(challengeId) : null;
    return Array.isArray(script) && script.length > 0;
  }

  function shouldAutoStart(challengeId) {
    const learner = getLearner();
    return (
      hasScript(challengeId) &&
      learner.coachEnabled !== false &&
      !learner.coachDismissed[challengeId] &&
      !(learner.completedChallengeIds || []).includes(challengeId)
    );
  }

  function start(challengeId) {
    const id = challengeId || state.selectedChallengeId;
    if (!hasScript(id)) {
      return;
    }
    root = ensureOverlay();
    if (!root.dataset.bound) {
      root.addEventListener("click", onRootClick);
      window.addEventListener("resize", scheduleReposition);
      document.addEventListener("scroll", scheduleReposition, true);
      document.addEventListener("toggle", scheduleReposition, true);
      root.dataset.bound = "1";
    }
    lessonId = id;
    steps = getScript(id);
    stepIndex = 0;
    revealedStep = -1;
    acked = new Set();
    active = true;
    advanceIfNeeded();
  }

  function stop() {
    active = false;
    if (root) {
      root.hidden = true;
      root.querySelector("[data-tutorial-coach]").hidden = true;
      root.querySelector("[data-tutorial-spotlight]").hidden = true;
    }
  }

  function dismiss() {
    if (lessonId) {
      getLearner().coachDismissed[lessonId] = true;
    }
    stop();
    if (typeof setStatus === "function") {
      setStatus(t("tutorialSkipped"));
    }
  }

  function maybeStart(challengeId) {
    if (shouldAutoStart(challengeId)) {
      start(challengeId);
    }
  }

  function onStateChanged() {
    if (active) {
      advanceIfNeeded();
    }
  }

  return {
    maybeStart,
    start,
    stop,
    dismiss,
    onStateChanged,
    hasScript,
    isActive: () => active,
  };
}
