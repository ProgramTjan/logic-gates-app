import {
  CURRICULUM,
  isLessonUnlocked,
  getRequiredLessonTitle,
} from "../data/curriculum.js";
import { S } from "../data/strings.js";

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

  const challengesById = new Map(CHALLENGES.map((challenge) => [challenge.id, challenge]));

  function getLearner() {
    return state.project.learner || { completedChallengeIds: [], unlockedAll: false };
  }

  function isChallengeUnlocked(challenge) {
    return isLessonUnlocked(challenge.id, getLearner(), challenge.prerequisites);
  }

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
    const definitions = state.project.chipDefinitions.filter(
      (definition) => !challengeVerifier.isStarterDefinition(definition)
    );
    if (!definitions.length) {
      dom.chipLibrary.innerHTML =
        '<div class="chip-card"><div class="chip-meta">Nog geen chips opgeslagen. Gebruik `Input` en `Output` nodes in een workspace en klik daarna op `Snapshot`.</div></div>';
      return;
    }

    const bySeries = new Map();
    definitions.forEach((definition) => {
      if (!bySeries.has(definition.seriesId)) {
        bySeries.set(definition.seriesId, []);
      }
      bySeries.get(definition.seriesId).push(definition);
    });
    const groups = [...bySeries.entries()]
      .map(([seriesId, versions]) => {
        versions.sort((a, b) => b.version - a.version);
        return { seriesId, versions, latest: versions[0] };
      })
      .sort((a, b) => a.latest.name.localeCompare(b.latest.name));

    const groupMarkup = groups
      .map(({ seriesId, versions, latest }) => {
        const open = state.openChipSeries && state.openChipSeries.has(seriesId) ? " open" : "";
        const dependencyCount = countChipDependencies(latest.circuitSnapshot);
        const versionRows = versions
          .map((definition) => {
            const isLatest = definition.id === latest.id;
            return `<div class="chip-version-row">
              <span class="chip-version-label">v${definition.version}${isLatest ? " · nieuwste" : ""}</span>
              <span class="chip-version-actions">
                <button class="ghost-button" type="button" data-place-chip="${definition.id}">Plaats</button>
                <button class="ghost-button" type="button" data-edit-chip="${definition.id}">Nieuwe versie</button>
                <button class="ghost-button" type="button" data-clone-chip="${definition.id}">Kloon sheet</button>
              </span>
            </div>`;
          })
          .join("");
        return `<details class="chip-series-card"${open}>
          <summary class="chip-series-summary" data-chip-series="${seriesId}">
            <span class="chip-series-name">${escapeHtml(latest.name)}</span>
            <span class="chip-series-meta">${latest.inputs.length} in / ${latest.outputs.length} out${
              versions.length > 1 ? ` · ${versions.length} versies` : ""
            }</span>
          </summary>
          <div class="chip-series-body">
            ${latest.description ? `<p class="chip-meta">${escapeHtml(latest.description)}</p>` : ""}
            ${dependencyCount ? `<p class="chip-meta">${dependencyCount} geneste chip(s)</p>` : ""}
            ${versionRows}
          </div>
        </details>`;
      })
      .join("");

    dom.chipLibrary.innerHTML = `
      <p class="chip-library-hint">Je opgeslagen chips. Plaatsen kan ook via <em>Parts → Saved Chips</em> (altijd de nieuwste versie); hier beheer je versies.</p>
      ${groupMarkup}
    `;
  }

  function pickDefinitionForProbe(challenge, userDefinitions) {
    const matches = challengeVerifier.findDefinitionsForChallenge(challenge, userDefinitions);
    if (!matches.length) {
      return null;
    }
    return [...matches].sort((a, b) => b.version - a.version)[0];
  }

  function renderTruthProbeTable(challenge, userDefinitions) {
    if (challenge.verification !== "combinational" || !challenge.tests?.length) {
      return "";
    }
    const definition = pickDefinitionForProbe(challenge, userDefinitions);
    const rows = challenge.tests
      .map((test) => {
        const inputs = Object.entries(test.inputs)
          .map(([k, v]) => `${k}=${v}`)
          .join(" · ");
        const expected = Object.entries(test.outputs)
          .map(([k, v]) => `${k}=${v}`)
          .join(" · ");
        let actual = "—";
        let mark = "";
        if (definition) {
          try {
            const out = challengeVerifier.previewOutputs(challenge, definition, test.inputs);
            const ok = Object.entries(test.outputs).every(([k, v]) => out[k] === v);
            actual = Object.entries(test.outputs)
              .map(([k]) => `${k}=${out[k] ?? "?"}`)
              .join(" · ");
            mark = ok ? "✓" : "✗";
          } catch {
            actual = "(simulatiefout)";
            mark = "?";
          }
        }
        return `<tr>
          <td class="truth-col-in">${escapeHtml(inputs)}</td>
          <td class="truth-col-exp">${escapeHtml(expected)}</td>
          <td class="truth-col-act">${escapeHtml(actual)}</td>
          <td class="truth-col-ok">${mark}</td>
        </tr>`;
      })
      .join("");
    const defHint = definition
      ? `<p class="truth-probe-hint">Simulatie gebruikt <strong>${escapeHtml(definition.name)}</strong> v${definition.version}.</p>`
      : `<p class="truth-probe-hint">Sla een chip op die bij deze opdracht past om je uitkomsten hier te zien.</p>`;
    return `<div class="challenge-details truth-probe-wrap">
      <div class="challenge-kicker">Live probe (combinatorisch)</div>
      ${defHint}
      <div class="truth-probe-scroll">
        <table class="truth-probe-table">
          <thead><tr><th>Input</th><th>Verwacht</th><th>Jouw chip</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }

  function statusLabel(label) {
    if (label === "Verified") {
      return S.verified;
    }
    if (label === "Needs Work") {
      return S.needsWork;
    }
    return label || S.needsWork;
  }

  function renderFailedCasesTable(result) {
    if (!result || result.done || !Array.isArray(result.failedCases) || !result.failedCases.length) {
      return "";
    }
    const rows = result.failedCases
      .slice(0, 12)
      .map((item, index) => {
        const step = item.step != null ? item.step : index + 1;
        const expected =
          item.expected && typeof item.expected === "object"
            ? Object.entries(item.expected)
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")
            : "";
        const actual =
          item.actual && typeof item.actual === "object"
            ? Object.entries(item.actual)
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")
            : "";
        const inputs =
          item.inputs && typeof item.inputs === "object"
            ? Object.entries(item.inputs)
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")
            : "";
        return `<tr>
          <td>${escapeHtml(String(step))}</td>
          <td class="mono">${escapeHtml(inputs)}</td>
          <td class="mono">${escapeHtml(expected)}</td>
          <td class="mono">${escapeHtml(actual)}</td>
        </tr>`;
      })
      .join("");
    return `<div class="challenge-details failed-cases">
      <div class="challenge-kicker">${escapeHtml(S.failedSteps)}</div>
      <table class="failed-cases-table">
        <thead>
          <tr>
            <th>${escapeHtml(S.step)}</th>
            <th>${escapeHtml(S.inputs)}</th>
            <th>${escapeHtml(S.expected)}</th>
            <th>${escapeHtml(S.actual)}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderLessonQuiz(challenge, learner) {
    const quiz = challenge.learning?.quiz;
    if (!Array.isArray(quiz) || !quiz.length) {
      return "";
    }
    const saved = learner.quizAnswers?.[challenge.id] || {};
    const items = quiz
      .map((item, questionIndex) => {
        const selected =
          saved[String(questionIndex)] !== undefined ? Number(saved[String(questionIndex)]) : null;
        const answered = selected !== null && !Number.isNaN(selected);
        const correct = answered && selected === item.answerIndex;
        const options = (item.options || [])
          .map((option, optionIndex) => {
            const isSelected = answered && selected === optionIndex;
            const markClass = isSelected ? (optionIndex === item.answerIndex ? "correct" : "incorrect") : "";
            return `<button type="button"
              class="quiz-option ${markClass}"
              data-quiz-challenge="${challenge.id}"
              data-quiz-question="${questionIndex}"
              data-quiz-option="${optionIndex}">
              ${escapeHtml(option)}
            </button>`;
          })
          .join("");
        const feedback = answered
          ? `<p class="quiz-feedback ${correct ? "ok" : "bad"}">${
              correct ? "Goed!" : "Nog niet."
            } ${escapeHtml(item.explain || "")}</p>`
          : "";
        return `<div class="quiz-item">
          <p class="quiz-question">${escapeHtml(item.question)}</p>
          <div class="quiz-options">${options}</div>
          ${feedback}
        </div>`;
      })
      .join("");
    return `<div class="lesson-quiz">
      <div class="challenge-kicker">Check je begrip</div>
      ${items}
    </div>`;
  }

  function renderChallengeDetail(challenge, result, userDefinitions) {
    const learner = getLearner();
    const unlocked = isChallengeUnlocked(challenge);
    const lessonCompleted = (learner.completedChallengeIds || []).includes(challenge.id);
    const requiredTitle = unlocked
      ? null
      : getRequiredLessonTitle(challenge.id, getLearner(), challengesById);
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

    const constraintKicker =
      challenge.gateConstraint?.allowedGateTypes?.length
        ? ` • poorten: ${challenge.gateConstraint.allowedGateTypes.join(", ")}`
        : challenge.gateConstraint?.forbiddenGateTypes?.length
          ? ` • verboden: ${challenge.gateConstraint.forbiddenGateTypes.join(", ")}`
          : "";

    const learning = challenge.learning || {};
    const goalHtml = learning.goal
      ? `<p class="lesson-goal"><span class="lesson-goal-label">Doel</span> ${escapeHtml(learning.goal)}</p>`
      : "";
    const conceptsHtml = Array.isArray(learning.concepts) && learning.concepts.length
      ? `<div class="lesson-concepts">${learning.concepts
          .map((concept) => `<span class="lesson-concept">${escapeHtml(concept)}</span>`)
          .join("")}</div>`
      : "";

    const quizHtml = renderLessonQuiz(challenge, learner);

    const lockNotice = !unlocked
      ? `<p class="challenge-lock-notice">🔒 Vergrendeld — vereist: ${escapeHtml(requiredTitle || "vorige les")}. Schakel vrije modus in om alles te openen.</p>`
      : "";

    const disabledAttr = unlocked ? "" : "disabled";

    const feedback =
      state.lastSubmitFeedback && state.lastSubmitFeedback.challengeId === challenge.id
        ? state.lastSubmitFeedback
        : null;
    const feedbackHtml = feedback
      ? `<p class="submit-feedback ${feedback.ok ? "ok" : "bad"}">${escapeHtml(feedback.message)}</p>`
      : "";

    const failedCount = !result.done && Array.isArray(result.failedCases) ? result.failedCases.length : 0;
    const hasTheory = Boolean(theoryHtml || quizHtml);
    const tabs = [
      hasTheory ? { id: "theorie", label: "Theorie" } : null,
      { id: "hints", label: "Hints" },
      { id: "tests", label: failedCount ? `Tests (${failedCount} ✗)` : "Tests" },
    ].filter(Boolean);
    let activeTab = state.challengeDetailTab || "theorie";
    if (!tabs.some((tab) => tab.id === activeTab)) {
      activeTab = tabs[0].id;
    }
    const tabButtons = tabs
      .map(
        (tab) => `<button type="button" class="challenge-tab ${tab.id === activeTab ? "active" : ""}"
          data-challenge-tab="${tab.id}">${escapeHtml(tab.label)}</button>`
      )
      .join("");

    let paneHtml = "";
    if (activeTab === "theorie") {
      paneHtml = `<div class="lesson-theory-block">
        ${theoryHtml ? `<div class="theory-body">${theoryHtml}</div>` : ""}
        ${quizHtml}
      </div>`;
    } else if (activeTab === "hints") {
      paneHtml = `<div class="challenge-details">
        <ul class="challenge-hints">
          ${challenge.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}
        </ul>
      </div>`;
    } else {
      paneHtml = `
        ${renderFailedCasesTable(result)}
        ${renderTruthProbeTable(challenge, userDefinitions)}
        ${testsHtml ? `<div class="challenge-details">
          <div class="challenge-kicker">Referentietests (${challenge.tests.length})</div>
          <div class="challenge-tests">${testsHtml}</div>
        </div>` : ""}`;
    }

    return `<article class="challenge-card challenge-detail-card ${lessonCompleted || result.done ? "done" : ""} ${unlocked ? "" : "locked"}">
      <div class="challenge-head">
        <div>
          <h3>${unlocked ? "" : "🔒 "}${escapeHtml(challenge.title)}</h3>
          <div class="challenge-kicker">${escapeHtml(
            `${challenge.phase} • ${challenge.inputs} in / ${challenge.outputs} out${constraintKicker}`
          )}</div>
        </div>
        <span class="challenge-status">${escapeHtml(
          lessonCompleted || result.done
            ? statusLabel(result.label || "Verified")
            : unlocked
              ? statusLabel(result.label)
              : S.locked
        )}</span>
      </div>
      <p class="challenge-copy">${escapeHtml(challenge.description)}</p>
      ${lockNotice}
      ${feedbackHtml}
      ${result.summary ? `<p class="challenge-copy challenge-result-summary">${escapeHtml(result.summary)}</p>` : ""}

      <div class="lesson-build-block">
        ${goalHtml}
        ${conceptsHtml}
        <div class="challenge-actions">
          <button class="ghost-button" type="button" data-open-challenge="${challenge.id}" ${disabledAttr}>${S.start}</button>
          <button class="ghost-button" type="button" data-submit-challenge="${challenge.id}" ${disabledAttr}>${S.submit}</button>
          ${
            challenge.id === "computer" && lessonCompleted
              ? `<button class="ghost-button" type="button" data-show-completion-overlay>${S.showCompletion}</button>`
              : ""
          }
        </div>
      </div>

      <div class="challenge-tabs" role="tablist">${tabButtons}</div>
      <div class="challenge-tab-pane">${paneHtml}</div>
    </article>`;
  }

  function renderChallenges() {
    if (!state.selectedChallengeId && CHALLENGES.length) {
      state.selectedChallengeId = CHALLENGES[0].id;
    }
    const learner = getLearner();
    const userDefinitions = state.project.chipDefinitions.filter(
      (definition) => !challengeVerifier.isStarterDefinition(definition)
    );
    const challengeStates = CHALLENGES.map((challenge) => ({
      challenge,
      result: challengeVerifier.evaluateChallengeResult(challenge, userDefinitions),
      unlocked: isChallengeUnlocked(challenge),
    }));
    const completedSet = new Set(learner.completedChallengeIds || []);
    const displayCompleted = CHALLENGES.filter((challenge) => completedSet.has(challenge.id)).length;

    const moduleMarkup = CURRICULUM.map((module) => {
      const phaseItems = module.lessonIds
        .map((id) => challengeStates.find((item) => item.challenge.id === id))
        .filter(Boolean);
      const phaseDone = phaseItems.filter((item) => completedSet.has(item.challenge.id)).length;
      const items = phaseItems
        .map(({ challenge, result, unlocked }) => {
          const active = state.selectedChallengeId === challenge.id;
          const completed = completedSet.has(challenge.id);
          const requiredTitle = unlocked
            ? null
            : getRequiredLessonTitle(challenge.id, learner, challengesById);
          const lockLabel = unlocked
            ? ""
            : `<span class="challenge-picker-lock" title="${escapeHtml(
                requiredTitle ? `Vereist: ${requiredTitle}` : "Vergrendeld"
              )}">🔒</span>`;
          return `<button class="challenge-picker-item ${completed ? "done" : ""} ${
            unlocked ? "" : "locked"
          } ${active ? "active" : ""}"
            type="button" data-select-challenge="${challenge.id}">
            <span class="challenge-picker-dot"></span>
            <span class="challenge-picker-name">${escapeHtml(challenge.title)}</span>
            ${completed ? `<span class="challenge-picker-check">✓</span>` : lockLabel}
          </button>`;
        })
        .join("");
      const containsSelected = module.lessonIds.includes(state.selectedChallengeId);
      return `<details class="challenge-picker-group"${containsSelected ? " open" : ""}>
        <summary class="challenge-picker-phase">${escapeHtml(module.title)} <span class="challenge-phase-count">${phaseDone}/${phaseItems.length}</span></summary>
        ${items}
      </details>`;
    }).join("");

    const selected = challengeStates.find(({ challenge }) => challenge.id === state.selectedChallengeId);
    const detailMarkup = selected
      ? renderChallengeDetail(selected.challenge, selected.result, userDefinitions)
      : "";

    const freeModeChecked = learner.unlockedAll ? "checked" : "";

    dom.challengeList.innerHTML = `
      <div class="challenge-progress">
        <span>${displayCompleted}/${CHALLENGES.length} voltooid</span>
        <button type="button" class="ghost-button challenge-next-open" data-next-open-challenge>${S.nextOpen}</button>
        <div class="challenge-progress-bar">
          <div class="challenge-progress-fill" style="width:${Math.round((displayCompleted / CHALLENGES.length) * 100)}%"></div>
        </div>
      </div>
      <label class="challenge-free-mode">
        <input type="checkbox" data-toggle-free-mode ${freeModeChecked} />
        <span>${S.freeMode}</span>
      </label>
      <div class="challenge-picker">${moduleMarkup}</div>
      ${detailMarkup}
      <details class="challenge-card how-to-card">
        <summary class="challenge-kicker theory-kicker how-to-summary">🚀 Hoe werkt dit?</summary>
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
            <li>Meerdere nodes tegelijk: <kbd>Shift+slepen</kbd> (kader) of <kbd>Ctrl+A</kbd>, dan <kbd>Ctrl+C</kbd> en plak met <kbd>Ctrl+V</kbd> — ook op een andere sheet.</li>
          </ul>
        </div>
      </details>
    `;
    workspaceActions.updateChallengeStartButton();
    workspaceActions.updateChallengeSubmitButton();
  }

  return { renderBuiltinPalette, renderWorkspaceList, renderChipLibrary, renderChallenges, isChallengeUnlocked };
}
