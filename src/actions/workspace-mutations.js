import { markChallengeCompleted } from "../data/curriculum.js";
import { t } from "../i18n/index.js";
import { localizeChallenge } from "../i18n/challenges.js";

export function createWorkspaceMutations(deps) {
  const {
    state,
    CHALLENGES,
    challengeVerifier,
    chipDefinitionsService,
    appModals,
    allocateId,
    createWorkspace,
    createNode,
    createChipInstance,
    deepClone,
    normalizeWorkspace,
    getCurrentWorkspace,
    getWorkspace,
    getChipDefinition,
    getChipSeries,
    pushUndo,
    setStatus,
    renderFull,
    renderWorkspace,
    WORKSPACE_BASE_WIDTH,
    WORKSPACE_BASE_HEIGHT,
    clamp,
    tutorial,
  } = deps;

  function getLatestChipDefinitionForSeries(seriesId) {
    const series = getChipSeries(seriesId);
    if (!series) {
      return null;
    }
    const definitions = series.definitionIds
      .map((definitionId) => getChipDefinition(definitionId))
      .filter(Boolean)
      .sort((left, right) => right.version - left.version);
    return definitions[0] || null;
  }

  function countChipDependencies(circuit) {
    return circuit.nodes.filter((node) => node.type === "chip-instance").length;
  }

  function getActiveWorkspaceChallenge() {
    const workspace = getCurrentWorkspace();
    if (!workspace || !workspace.meta || !workspace.meta.challengeId) {
      return null;
    }
    return CHALLENGES.find((item) => item.id === workspace.meta.challengeId) || null;
  }

  function getWorkspaceClusterAnchor(workspace) {
    if (!workspace.nodes.length) {
      return { x: 120, y: 110 };
    }
    const bounds = workspace.nodes.reduce(
      (result, node) => ({
        minX: Math.min(result.minX, node.x),
        minY: Math.min(result.minY, node.y),
        maxX: Math.max(result.maxX, node.x),
        maxY: Math.max(result.maxY, node.y),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
    return {
      x: Math.min(bounds.maxX + 110, WORKSPACE_BASE_WIDTH - 140),
      y: Math.min(bounds.maxY + 70, WORKSPACE_BASE_HEIGHT - 110),
    };
  }

  /**
   * Where a newly added part goes: a free spot (no overlap with nodes or floating cards),
   * preferably inside the visible canvas and close to the selected node / the circuit.
   * Falls back to the nearest free spot outside the view; `pendingReveal` then asks the
   * caller to scroll it into view.
   */
  function getSuggestedNodePosition(workspace) {
    const margin = 24;
    const gap = 14;
    const newSize = (typeof deps.getNewNodeSize === "function" && deps.getNewNodeSize()) || { w: 150, h: 110 };
    const sizeOf = (node) =>
      (typeof deps.getNodeSize === "function" && deps.getNodeSize(node.id)) || { w: 150, h: 110 };
    const obstacles = [
      ...workspace.nodes.map((node) => {
        const size = sizeOf(node);
        return { x: node.x, y: node.y, w: size.w, h: size.h };
      }),
      ...((typeof deps.getReservedStageRects === "function" && deps.getReservedStageRects()) || []),
    ];
    const isFree = (x, y) =>
      obstacles.every(
        (r) => x + newSize.w + gap <= r.x || x >= r.x + r.w + gap || y + newSize.h + gap <= r.y || y >= r.y + r.h + gap
      );

    const selectedNode = workspace.nodes.find((item) => item.id === state.selectedNodeId);
    const anchor = selectedNode
      ? { x: selectedNode.x + sizeOf(selectedNode).w + 30, y: selectedNode.y }
      : getWorkspaceClusterAnchor(workspace);

    const view = typeof deps.getVisibleStageRect === "function" ? deps.getVisibleStageRect() : null;
    const stage = { x: margin, y: margin, w: WORKSPACE_BASE_WIDTH - 2 * margin, h: WORKSPACE_BASE_HEIGHT - 2 * margin };
    const area = view && view.width > 0 && view.height > 0
      ? {
          x: Math.max(stage.x, view.x + 12),
          y: Math.max(stage.y, view.y + 12),
          w: Math.max(newSize.w, view.width - 24),
          h: Math.max(newSize.h, view.height - 24),
        }
      : stage;
    const inside = (x, y, box) => x >= box.x && y >= box.y && x + newSize.w <= box.x + box.w && y + newSize.h <= box.y + box.h;
    const preferred = inside(anchor.x, anchor.y, area)
      ? anchor
      : { x: area.x + area.w * 0.35, y: area.y + area.h * 0.3 };

    const search = (box) => {
      const step = 20;
      let best = null;
      for (let y = box.y; y + newSize.h <= box.y + box.h; y += step) {
        for (let x = box.x; x + newSize.w <= box.x + box.w; x += step) {
          if (!isFree(x, y)) {
            continue;
          }
          const distance = Math.hypot(x - preferred.x, y - preferred.y);
          if (!best || distance < best.distance) {
            best = { x, y, distance };
          }
        }
      }
      return best;
    };

    let spot = search(area);
    state.pendingReveal = null;
    if (!spot && area !== stage) {
      spot = search(stage);
      if (spot) {
        state.pendingReveal = { x: spot.x, y: spot.y, w: newSize.w, h: newSize.h };
      }
    }
    const stagger = workspace.nodes.length % 4;
    const x = spot ? spot.x : anchor.x + stagger * 18;
    const y = spot ? spot.y : anchor.y + stagger * 14;
    return {
      x: clamp(Math.round(x), margin, WORKSPACE_BASE_WIDTH - 140),
      y: clamp(Math.round(y), margin, WORKSPACE_BASE_HEIGHT - 110),
    };
  }

  function addPartToWorkspace(partType, definitionId) {
    const workspace = getCurrentWorkspace();
    const position = getSuggestedNodePosition(workspace);
    const node =
      partType === "chip-instance"
        ? createChipInstance(state.project, definitionId, position)
        : createNode(state.project, partType, position);
    pushUndo();
    workspace.nodes.push(node);
    state.selectedNodeId = node.id;
    setStatus(
      t("status.partAdded", {
        label: node.config.label || node.type,
        workspace: workspace.name,
      })
    );
    renderWorkspace();
  }

  async function createWorkspaceFromPrompt() {
    const suggestedName = `Workspace ${state.project.workspaces.length + 1}`;
    const name = await appModals.showWorkspaceNameModal({
      suggestedName,
      lead: t("workspaceModalLead"),
    });
    if (!name) {
      return;
    }
    const workspace = createWorkspace(state.project, name);
    state.project.workspaces.push(workspace);
    state.project.currentWorkspaceId = workspace.id;
    state.selectedNodeId = null;
    setStatus(t("status.workspaceCreated", { name: workspace.name }));
    renderFull();
  }

  function populateChallengeWorkspace(workspace, challenge) {
    const template = challenge.template || { inputs: [], outputs: [] };
    const inputStep = Math.max(90, Math.floor(420 / Math.max(1, template.inputs.length)));
    const outputStep = Math.max(90, Math.floor(420 / Math.max(1, template.outputs.length)));
    // Narrow canvas (tablet portrait / phone): pull inputs and outputs closer together.
    const view = typeof deps.getVisibleStageRect === "function" ? deps.getVisibleStageRect() : null;
    const viewWidth = view && view.width > 0 ? view.width : 1000;
    const inputX = viewWidth < 700 ? 30 : 120;
    const outputX = Math.max(380, Math.min(760, Math.round(viewWidth - 190)));

    template.inputs.forEach((item, index) => {
      const label = typeof item === "string" ? item : item.name;
      const width = typeof item === "string" ? 1 : item.width || 1;
      workspace.nodes.push(
        chipDefinitionsService.createConfiguredNode(
          state.project,
          "input-pin",
          { x: inputX, y: 120 + index * inputStep },
          { label, width, previewValue: "0".repeat(width) }
        )
      );
    });

    template.outputs.forEach((item, index) => {
      const label = typeof item === "string" ? item : item.name;
      const width = typeof item === "string" ? 1 : item.width || 1;
      workspace.nodes.push(
        chipDefinitionsService.createConfiguredNode(
          state.project,
          "output-pin",
          { x: outputX, y: 120 + index * outputStep },
          { label, width }
        )
      );
    });

    if (Array.isArray(template.nodes)) {
      template.nodes.forEach((spec) => {
        workspace.nodes.push(
          chipDefinitionsService.createConfiguredNode(
            state.project,
            spec.type,
            { x: Number(spec.x) || 400, y: Number(spec.y) || 200 },
            spec.config || {}
          )
        );
      });
    }
  }

  function openChallengeWorkspace(challengeId) {
    const challenge = CHALLENGES.find((item) => item.id === challengeId);
    if (!challenge) {
      return;
    }
    const workspace = createWorkspace(state.project, localizeChallenge(challenge).title, null, {
      challengeId,
    });
    populateChallengeWorkspace(workspace, challenge);
    state.project.workspaces.push(workspace);
    state.project.currentWorkspaceId = workspace.id;
    state.selectedNodeId = null;
    state.selectedChallengeId = challengeId;
    setStatus(
      t("status.workspaceOpened", { name: localizeChallenge(challenge).title })
    );
    if (typeof deps.stopClockRunner === "function") {
      deps.stopClockRunner();
    }
    renderFull();
    if (tutorial && typeof tutorial.maybeStart === "function") {
      tutorial.maybeStart(challengeId);
    }
  }

  function duplicateCurrentWorkspace() {
    duplicateWorkspace(getCurrentWorkspace().id);
  }

  function duplicateWorkspace(workspaceId) {
    const source = getWorkspace(workspaceId);
    if (!source) {
      return;
    }
    const name = `${source.name} Copy`;
    const duplicate = createWorkspace(state.project, name, source);
    state.project.workspaces.push(duplicate);
    state.project.currentWorkspaceId = duplicate.id;
    state.selectedNodeId = null;
    setStatus(t("status.workspaceCreated", { name: duplicate.name }));
    renderFull();
  }

  function deleteWorkspace(workspaceId) {
    if (state.project.workspaces.length === 1) {
      return;
    }
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return;
    }
    if (!window.confirm(`Delete workspace "${workspace.name}"?`)) {
      return;
    }
    state.project.workspaces = state.project.workspaces.filter((item) => item.id !== workspaceId);
    if (state.project.currentWorkspaceId === workspaceId) {
      state.project.currentWorkspaceId = state.project.workspaces[0].id;
    }
    state.selectedNodeId = null;
    state.pendingConnection = null;
    setStatus(t("status.workspaceDeleted", { name: workspace.name }));
    renderFull();
  }

  async function saveCurrentWorkspaceAsChip(options = {}) {
    const workspace = getCurrentWorkspace();
    const interfaceResult = chipDefinitionsService.extractChipInterface(workspace);
    if (interfaceResult.errors.length) {
      setStatus(interfaceResult.errors[0].message);
      renderWorkspace();
      return null;
    }

    const sourceSeries =
      workspace.meta && workspace.meta.sourceChipSeriesId
        ? getChipSeries(workspace.meta.sourceChipSeriesId)
        : null;
    const {
      preferredName = "",
      preferredDescription = "",
      promptForName = true,
      promptForDescription = true,
    } = options;
    const suggestedName =
      preferredName ||
      (sourceSeries ? sourceSeries.name : workspace.name.replace(/\s+copy$/i, "").trim()) ||
      t("customChip");
    const defaultDescription =
      preferredDescription || t("snapshotFromWorkspace", { name: workspace.name });

    let trimmedName = suggestedName.trim();
    let description = defaultDescription;

    if (promptForName || promptForDescription) {
      const modalResult = await appModals.showChipSaveModal({
        suggestedName: trimmedName,
        suggestedDescription: description,
        lead: t("chipModalLead", {
          inputs: interfaceResult.inputs.length,
          outputs: interfaceResult.outputs.length,
        }),
      });
      if (!modalResult) {
        return null;
      }
      trimmedName = modalResult.name;
      description = promptForDescription ? modalResult.description : defaultDescription;
    }

    if (!trimmedName) {
      return null;
    }

    let series =
      sourceSeries && sourceSeries.name.toLowerCase() === trimmedName.toLowerCase()
        ? sourceSeries
        : state.project.chipSeries.find((entry) => entry.name.toLowerCase() === trimmedName.toLowerCase());
    if (!series) {
      series = { id: allocateId(state.project, "chip-series"), name: trimmedName, definitionIds: [] };
      state.project.chipSeries.push(series);
    }

    const version = series.definitionIds.length + 1;
    const definition = {
      id: allocateId(state.project, "chip-def"),
      seriesId: series.id,
      name: trimmedName,
      version,
      description,
      inputs: interfaceResult.inputs,
      outputs: interfaceResult.outputs,
      createdAt: new Date().toISOString(),
      circuitSnapshot: normalizeWorkspace({
        id: `snapshot-${Date.now()}`,
        name: `${trimmedName} Snapshot`,
        nodes: deepClone(workspace.nodes),
        wires: deepClone(workspace.wires),
      }),
    };

    state.project.chipDefinitions.push(definition);
    series.definitionIds.push(definition.id);
    workspace.meta = {
      ...workspace.meta,
      sourceChipSeriesId: series.id,
      sourceChipDefinitionId: definition.id,
      sourceChipVersion: definition.version,
      draftMode: "new-version",
    };
    setStatus(t("status.chipSaved", { name: trimmedName, version }));
    renderFull();
    return definition;
  }

  function formatSubmitStatus(challenge, result) {
    const title = localizeChallenge(challenge).title;
    if (result.done) {
      return t("status.submitOk", { title, summary: result.summary });
    }
    let message = t("status.submitNeedsWork", { title, summary: result.summary });
    if (result.failedCases && result.failedCases.length) {
      const detail = result.failedCases
        .slice(0, 3)
        .map((item) => item.detail)
        .join(" · ");
      message += t("status.submitMiss", { detail });
      if (result.failedCases.length > 3) {
        message += t("status.submitMore", { n: result.failedCases.length - 3 });
      }
    }
    return message;
  }

  function setSubmitFeedback(challengeId, ok, message) {
    state.lastSubmitFeedback = { challengeId, ok, message };
  }

  async function submitChallenge(challengeId) {
    const challenge = CHALLENGES.find((item) => item.id === challengeId);
    const workspace = getCurrentWorkspace();
    if (!challenge || !workspace) {
      return;
    }
    if (!workspace.meta || workspace.meta.challengeId !== challengeId) {
      const message = t("status.submitWrongSheet", {
        sheet: workspace.name,
        title: localizeChallenge(challenge).title,
      });
      setSubmitFeedback(challengeId, false, message);
      setStatus(message);
      renderFull();
      return;
    }

    const interfaceResult = chipDefinitionsService.extractChipInterface(workspace);
    if (interfaceResult.errors.length) {
      const message = t("status.submitInterface", {
        message: interfaceResult.errors[0].message,
      });
      setSubmitFeedback(challengeId, false, message);
      setStatus(message);
      renderFull();
      return;
    }

    const definition = await saveCurrentWorkspaceAsChip({
      preferredName: challenge.names[0],
      preferredDescription: t("challengeSubmission", {
        title: localizeChallenge(challenge).title,
      }),
      promptForName: false,
      promptForDescription: false,
    });
    if (!definition) {
      return;
    }

    const result = challengeVerifier.runChallengeVerification(challenge, definition);
    if (result.done) {
      state.project.learner = markChallengeCompleted(state.project.learner, challenge.id);
      if (challenge.id === "computer" && typeof deps.showCompletionOverlay === "function") {
        deps.showCompletionOverlay(true);
      }
    } else {
      state.challengeDetailTab = "tests";
    }
    setSubmitFeedback(challengeId, result.done, formatSubmitStatus(challenge, result));
    setStatus(formatSubmitStatus(challenge, result));
    renderFull();
  }

  function cloneChipToWorkspace(definitionId) {
    const definition = getChipDefinition(definitionId);
    if (!definition) {
      return;
    }
    const workspace = createWorkspace(
      state.project,
      `${definition.name} v${definition.version} Draft`,
      definition.circuitSnapshot,
      {
        sourceChipDefinitionId: definition.id,
        sourceChipSeriesId: definition.seriesId,
        sourceChipVersion: definition.version,
        draftMode: "clone",
      }
    );
    state.project.workspaces.push(workspace);
    state.project.currentWorkspaceId = workspace.id;
    state.selectedNodeId = null;
    setStatus(
      t("status.chipCloned", { name: definition.name, version: definition.version })
    );
    renderFull();
  }

  function editChipAsNewVersion(definitionId) {
    const definition = getChipDefinition(definitionId);
    if (!definition) {
      return;
    }
    const workspace = createWorkspace(
      state.project,
      `${definition.name} v${definition.version + 1} Draft`,
      definition.circuitSnapshot,
      {
        sourceChipDefinitionId: definition.id,
        sourceChipSeriesId: definition.seriesId,
        sourceChipVersion: definition.version,
        draftMode: "new-version",
      }
    );
    state.project.workspaces.push(workspace);
    state.project.currentWorkspaceId = workspace.id;
    state.selectedNodeId = null;
    setStatus(
      t("status.draftOpened", { name: definition.name, version: definition.version + 1 })
    );
    renderFull();
  }

  function duplicateSelectedNode() {
    const workspace = getCurrentWorkspace();
    if (!workspace) {
      return;
    }
    const node = workspace.nodes.find((item) => item.id === state.selectedNodeId);
    if (!node) {
      return;
    }
    pushUndo();
    const clone = deepClone(node);
    clone.id = allocateId(state.project, "node");
    clone.x = clamp((Number(node.x) || 0) + 28, 24, WORKSPACE_BASE_WIDTH - 140);
    clone.y = clamp((Number(node.y) || 0) + 28, 24, WORKSPACE_BASE_HEIGHT - 110);
    workspace.nodes.push(clone);
    state.selectedNodeId = clone.id;
    setStatus(t("status.pasted", { n: 1 }));
    renderWorkspace();
  }

  return {
    addPartToWorkspace,
    createWorkspaceFromPrompt,
    openChallengeWorkspace,
    getActiveWorkspaceChallenge,
    duplicateCurrentWorkspace,
    duplicateWorkspace,
    deleteWorkspace,
    saveCurrentWorkspaceAsChip,
    submitChallenge,
    cloneChipToWorkspace,
    editChipAsNewVersion,
    getLatestChipDefinitionForSeries,
    countChipDependencies,
    duplicateSelectedNode,
    getSuggestedNodePosition,
  };
}
