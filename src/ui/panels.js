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

  function renderChallengeDetail(challenge, result) {
    const theoryHtml = (challenge.theory || [])
      .map((paragraph) => `<p class="theory-paragraph">${escapeHtml(paragraph)}</p>`)
      .join("");

    const testsHtml = (challenge.tests || [])
      .map((test) => {
        const inputs = Object.entries(test.inputs).map(([k, v]) => `${k}=${v}`).join("  ");
        const outputs = Object.entries(test.outputs).map(([k, v]) => `${k}=${v}`).join("  ");
        return `<div class="challenge-test-row"><span>${escapeHtml(inputs)}</span><span>→</span><span>${escapeHtml(outputs)}</span></div>`;
      })
      .join("");

    return `<article class="challenge-card challenge-detail-card ${result.done ? "done" : ""}">
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
      ${result.summary ? `<p class="challenge-copy challenge-result-summary">${escapeHtml(result.summary)}</p>` : ""}
      <div class="challenge-actions">
        <button class="ghost-button" type="button" data-open-challenge="${challenge.id}">Start</button>
        <button class="ghost-button" type="button" data-submit-challenge="${challenge.id}">Submit</button>
      </div>

      ${theoryHtml ? `<div class="challenge-details theory-section">
        <div class="challenge-kicker theory-kicker">📖 Achtergrond</div>
        ${theoryHtml}
      </div>` : ""}

      <div class="challenge-details">
        <div class="challenge-kicker">Hints</div>
        <ul class="challenge-hints">
          ${challenge.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}
        </ul>
      </div>

      ${testsHtml ? `<div class="challenge-details">
        <div class="challenge-kicker">Waarheidstabel (${challenge.tests.length} tests)</div>
        <div class="challenge-tests">${testsHtml}</div>
      </div>` : ""}
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

    const phases = [...new Set(CHALLENGES.map((c) => c.phase))];
    const pickerMarkup = phases.map((phase) => {
      const items = challengeStates
        .filter(({ challenge }) => challenge.phase === phase)
        .map(({ challenge, result }) => {
          const active = state.selectedChallengeId === challenge.id;
          return `<button class="challenge-picker-item ${result.done ? "done" : ""} ${active ? "active" : ""}"
            type="button" data-select-challenge="${challenge.id}">
            <span class="challenge-picker-dot"></span>
            <span class="challenge-picker-name">${escapeHtml(challenge.title)}</span>
            ${result.done ? `<span class="challenge-picker-check">✓</span>` : ""}
          </button>`;
        })
        .join("");
      return `<div class="challenge-picker-group">
        <div class="challenge-picker-phase">${escapeHtml(phase)}</div>
        ${items}
      </div>`;
    }).join("");

    const selected = challengeStates.find(({ challenge }) => challenge.id === state.selectedChallengeId);
    const detailMarkup = selected ? renderChallengeDetail(selected.challenge, selected.result) : "";

    dom.challengeList.innerHTML = `
      <div class="challenge-progress">
        <span>${completedCount}/${CHALLENGES.length} voltooid</span>
        <div class="challenge-progress-bar">
          <div class="challenge-progress-fill" style="width:${Math.round((completedCount / CHALLENGES.length) * 100)}%"></div>
        </div>
      </div>
      <div class="challenge-picker">${pickerMarkup}</div>
      ${detailMarkup}
      <div class="challenge-card how-to-card">
        <div class="challenge-kicker theory-kicker">🚀 Hoe werkt dit?</div>
        <div class="how-to-body">
          <p><strong>1. Kies een opdracht</strong> in het menu hierboven en klik <em>Start</em>. Er opent een nieuwe sheet met kant-en-klare Input- en Output-pins.</p>
          <p><strong>2. Bouw je circuit</strong> via <em>Parts → Quick Add</em>. Sleep gates naar de canvas en verbind ze door op een output-pin te klikken en daarna een input-pin.</p>
          <p><strong>3. Test direct</strong>: klik de toggle-knop op een Input-node om de waarde te wisselen. De Output-node toont een lampje — groen = 1, grijs = 0.</p>
          <p><strong>4. Sla op als chip</strong> via de <em>Snapshot</em>-knop (linksboven). Geef je chip de exacte naam die in de opdracht staat (bijv. <code>NAND</code>).</p>
          <p><strong>5. Submit</strong> via de knop in het detailpaneel. Het systeem draait alle tests automatisch en toont hoeveel er slagen.</p>
          <p><strong>6. Gebruik je chips opnieuw</strong>: opgeslagen chips verschijnen in de Chips-bibliotheek (links) en in de Parts-balk. Bouw complexere chips op je eigen bouwblokken.</p>
        </div>
        <div class="how-to-tips">
          <div class="challenge-kicker">Tips</div>
          <ul class="challenge-hints">
            <li>Verwijder een draad: hou hem ~½ sec ingedrukt → rode × verschijnt.</li>
            <li>Verwijder een node: hou hem ~½ sec ingedrukt → rode × in de hoek.</li>
            <li>Meerdere chips bewaren van hetzelfde type? Gebruik <em>Edit as New Version</em>.</li>
            <li>Draden kleuren groen (=1) of rood (=0) — zo zie je signaalstromen in één oogopslag.</li>
            <li>Gebruik Splitter/Joiner voor multi-bit bussen (nodig voor Add4, Inc4).</li>
          </ul>
        </div>
      </div>
    `;
    workspaceActions.updateChallengeStartButton();
    workspaceActions.updateChallengeSubmitButton();
  }

  return { renderBuiltinPalette, renderWorkspaceList, renderChipLibrary, renderChallenges };
}
