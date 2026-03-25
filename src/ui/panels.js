export function createPanelRenderers(deps) {
  const {
    dom,
    state,
    BUILTIN_PARTS,
    CHALLENGES,
    getChipSeries,
    getLatestChipDefinitionForSeries,
    countChipDependencies,
    challengeVerifier,
    workspaceActions,
    escapeHtml,
  } = deps;

  function renderBuiltinPalette() {
    const builtinMarkup = BUILTIN_PARTS.map(
      (part) =>
        `<button class="palette-button" type="button" data-part-type="${part.type}">
          ${escapeHtml(part.label)}
          <small>${escapeHtml(part.copy)}</small>
        </button>`
    ).join("");

    const latestDefinitions = state.project.chipSeries
      .map((series) => getLatestChipDefinitionForSeries(series.id))
      .filter(Boolean)
      .sort((left, right) => left.name.localeCompare(right.name));

    const chipMarkup = latestDefinitions.length
      ? latestDefinitions
          .map(
            (definition) => `<button class="palette-button chip-palette-button" type="button" data-place-chip="${definition.id}">
              ${escapeHtml(definition.name)}
              <small>${escapeHtml(`${definition.inputs.length} in • ${definition.outputs.length} out • v${definition.version}`)}</small>
            </button>`
          )
          .join("")
      : '<div class="palette-section-empty">Sla eerst een chip op via `Snapshot`.</div>';

    dom.builtinPalette.innerHTML = `
      <div class="palette-section-title">Basic Parts</div>
      ${builtinMarkup}
      <div class="palette-section-title">Saved Chips</div>
      ${chipMarkup}
    `;
  }

  function renderWorkspaceList(currentWorkspace) {
    dom.workspaceTitle.textContent = currentWorkspace.name;
    dom.workspaceList.innerHTML = state.project.workspaces
      .map((item) => {
        const nodeCount = item.nodes.length;
        const wireCount = item.wires.length;
        const sourceSeries =
          item.meta && item.meta.sourceChipSeriesId ? getChipSeries(item.meta.sourceChipSeriesId) : null;
        const draftMeta = sourceSeries
          ? `Draft for ${sourceSeries.name}${item.meta.sourceChipVersion ? ` v${item.meta.sourceChipVersion}` : ""}`
          : item.meta && item.meta.isStarter
            ? "Starter sheet"
            : "";
        return `<div class="workspace-card ${item.id === currentWorkspace.id ? "active" : ""}">
          <div class="workspace-row">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <div class="workspace-meta">${nodeCount} nodes • ${wireCount} wires${
                draftMeta ? ` • ${escapeHtml(draftMeta)}` : ""
              }</div>
            </div>
            <button class="ghost-button" type="button" data-open-workspace="${item.id}">Open</button>
          </div>
          <div class="workspace-actions">
            <button class="ghost-button" type="button" data-duplicate-workspace="${item.id}">Duplicate</button>
            <button class="ghost-button" type="button" data-delete-workspace="${item.id}" ${
              state.project.workspaces.length === 1 ? "disabled" : ""
            }>Delete</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderChipLibrary() {
    if (!state.project.chipDefinitions.length) {
      dom.chipLibrary.innerHTML =
        '<div class="chip-card"><div class="chip-meta">Nog geen chips opgeslagen. Gebruik `Input` en `Output` nodes in een workspace en klik daarna op `Snapshot`.</div></div>';
      return;
    }

    const definitions = [...state.project.chipDefinitions].sort((a, b) => {
      if (a.name === b.name) {
        return a.version - b.version;
      }
      return a.name.localeCompare(b.name);
    });

    dom.chipLibrary.innerHTML = definitions
      .map((definition) => {
        const series = getChipSeries(definition.seriesId);
        const dependencyCount = countChipDependencies(definition.circuitSnapshot);
        const latestVersion = series ? getLatestChipDefinitionForSeries(series.id) : definition;
        const isLatest = latestVersion && latestVersion.id === definition.id;
        return `<div class="chip-card">
          <div class="chip-row">
            <div>
              <h3>${escapeHtml(definition.name)} v${definition.version}${isLatest ? " • latest" : ""}</h3>
              <div class="chip-meta">
                ${definition.inputs.length} in • ${definition.outputs.length} out • ${dependencyCount} nested chips
              </div>
            </div>
            <button class="ghost-button" type="button" data-place-chip="${definition.id}">Add</button>
          </div>
          <p class="chip-meta">${escapeHtml(definition.description || `Series: ${series ? series.name : definition.name}`)}</p>
          <div class="chip-actions">
            <button class="ghost-button" type="button" data-edit-chip="${definition.id}">Edit as New Version</button>
            <button class="ghost-button" type="button" data-clone-chip="${definition.id}">Clone to Workspace</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderChallengeCard(challenge, result) {
    const expanded = state.selectedChallengeId === challenge.id;
    return `<article class="challenge-card ${result.done ? "done" : ""} ${
      expanded ? "selected" : ""
    }" data-select-challenge="${challenge.id}">
      <div class="challenge-head">
        <div>
          <h3>${escapeHtml(challenge.title)}</h3>
          <div class="challenge-kicker">${escapeHtml(
            `${challenge.phase} • ${challenge.inputs} in / ${challenge.outputs} out`
          )}</div>
        </div>
        <span class="challenge-status">${escapeHtml(result.label)}</span>
      </div>
      <p class="challenge-copy">${escapeHtml(challenge.description)}</p>
      <p class="challenge-copy">${escapeHtml(result.summary)}</p>
      <div class="challenge-actions">
        <button class="ghost-button" type="button" data-open-challenge="${challenge.id}">Start</button>
        <button class="ghost-button" type="button" data-submit-challenge="${challenge.id}">Submit</button>
        <button class="ghost-button" type="button" data-toggle-challenge="${challenge.id}">${
          expanded ? "Hide Details" : "Show Details"
        }</button>
      </div>
      ${
        expanded
          ? `<div class="challenge-details">
              <div class="challenge-kicker">Hints</div>
              <ul class="challenge-hints">
                ${challenge.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }
    </article>`;
  }

  function renderChallenges() {
    if (!state.selectedChallengeId && CHALLENGES.length) {
      state.selectedChallengeId = CHALLENGES[0].id;
    }
    const userDefinitions = state.project.chipDefinitions.filter(
      (definition) => !challengeVerifier.isStarterDefinition(definition)
    );
    const challengeStates = CHALLENGES.map((challenge) => ({
      challenge,
      result: challengeVerifier.evaluateChallengeResult(challenge, userDefinitions),
    }));
    const completedCount = challengeStates.filter((item) => item.result.done).length;
    dom.challengeList.innerHTML = [
      `<div class="challenge-card">
        <div class="challenge-head">
          <div>
            <h3>Progress</h3>
            <div class="challenge-kicker">${completedCount}/${CHALLENGES.length} klaar</div>
          </div>
          <span class="challenge-status">${Math.round((completedCount / CHALLENGES.length) * 100)}%</span>
        </div>
      </div>`,
      ...challengeStates.map(({ challenge, result }) => renderChallengeCard(challenge, result)),
    ].join("");
    workspaceActions.updateChallengeStartButton();
    workspaceActions.updateChallengeSubmitButton();
  }

  return { renderBuiltinPalette, renderWorkspaceList, renderChipLibrary, renderChallenges };
}
