import {
  CURRICULUM,
  getOrderedLessonIds,
  isLessonUnlocked,
  getRequiredLessonTitle,
} from "../data/curriculum.js";
import { S, t } from "../i18n/index.js";
import { localizeChallenge, localizeCurriculumModule } from "../i18n/challenges.js";
import { getLessonPartTypes, getPartsUnlockedBy, isSequentialChallenge } from "../model/lesson-palette.js";

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

  function localizedRequiredTitle(challenge) {
    const raw = getRequiredLessonTitle(challenge.id, getLearner(), challengesById);
    if (!raw) {
      return null;
    }
    const required =
      challengesById.get(raw) ||
      [...challengesById.values()].find((item) => item.title === raw);
    return required ? localizeChallenge(required).title : raw;
  }

  function getActiveLesson() {
    if (state.appView !== "lesson" || typeof deps.getActiveChallengeId !== "function") {
      return null;
    }
    const id = deps.getActiveChallengeId();
    return id ? challengesById.get(id) || null : null;
  }

  function partLabel(type) {
    const part = BUILTIN_PARTS.find((item) => item.type === type);
    return part ? part.label : type;
  }

  function renderPartButton(part) {
    return `<button class="palette-button" type="button" data-part-type="${part.type}">
          ${escapeHtml(part.label)}
          <small>${escapeHtml(part.copy)}</small>
        </button>`;
  }

  function renderBuiltinPalette() {
    const lesson = getActiveLesson();
    const lessonParts = lesson ? getLessonPartTypes(lesson, getLearner()) : null;
    const visibleParts = lessonParts
      ? BUILTIN_PARTS.filter((part) => lessonParts.available.includes(part.type))
      : BUILTIN_PARTS;
    const builtinMarkup = visibleParts.map(renderPartButton).join("");

    const latestDefinitions = state.project.chipSeries
      .map((series) => getLatestChipDefinitionForSeries(series.id))
      .filter(Boolean)
      // In a lesson you only build with chips you made yourself.
      .filter((definition) => !lesson || !challengeVerifier.isStarterDefinition(definition))
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
      : `<div class="palette-section-empty">${escapeHtml(t("paletteChipsEmpty"))}</div>`;

    const lockedMarkup =
      lessonParts && lessonParts.locked.length
        ? `<div class="palette-later">
            <span class="palette-later-label">${escapeHtml(t("paletteLater"))}</span>
            ${lessonParts.locked
              .map(({ type, lessonId }) => {
                const teaching = challengesById.get(lessonId);
                const title = teaching ? localizeChallenge(teaching).title : lessonId;
                return `<span class="palette-later-part" title="${escapeHtml(
                  t("paletteLockedTitle", { title })
                )}">🔒 ${escapeHtml(partLabel(type))}</span>`;
              })
              .join("")}
          </div>`
        : "";

    if (dom.partsStrip) {
      // Compact one-tap strip for narrow screens (shown via CSS below 1024px).
      dom.partsStrip.innerHTML = [
        ...visibleParts.map(
          (part) =>
            `<button type="button" class="parts-strip-button" data-strip-part="${part.type}">${escapeHtml(part.label)}</button>`
        ),
        ...latestDefinitions.map(
          (definition) =>
            `<button type="button" class="parts-strip-button is-chip" data-strip-chip="${definition.id}">${escapeHtml(
              definition.name
            )}</button>`
        ),
      ].join("");
    }

    dom.builtinPalette.innerHTML = `
      <div class="palette-section-title">${escapeHtml(lesson ? t("paletteForLesson") : t("basicParts"))}</div>
      ${builtinMarkup}
      <div class="palette-section-title">${escapeHtml(t("savedChips"))}</div>
      ${chipMarkup}
      ${lockedMarkup}
      ${lesson ? `<p class="palette-sandbox-note">${escapeHtml(t("paletteSandboxNote"))}</p>` : ""}
    `;
  }

  function renderWorkspaceList(currentWorkspace) {
    dom.workspaceTitle.textContent = currentWorkspace.name;
    dom.workspaceList.innerHTML = state.project.workspaces
      .filter((item) => !(item.meta && item.meta.challengeId))
      .map((item) => {
        const nodeCount = item.nodes.length;
        const wireCount = item.wires.length;
        const sourceSeries =
          item.meta && item.meta.sourceChipSeriesId ? getChipSeries(item.meta.sourceChipSeriesId) : null;
        const draftMeta = sourceSeries
          ? `${t("workspaceDraftFor", { name: sourceSeries.name })}${
              item.meta.sourceChipVersion ? ` v${item.meta.sourceChipVersion}` : ""
            }`
          : item.meta && item.meta.isStarter
            ? t("workspaceStarter")
            : "";
        return `<div class="workspace-card ${item.id === currentWorkspace.id ? "active" : ""}">
          <div class="workspace-row">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <div class="workspace-meta">${escapeHtml(t("workspaceMeta", { nodes: nodeCount, wires: wireCount }))}${
                draftMeta ? ` • ${escapeHtml(draftMeta)}` : ""
              }</div>
            </div>
            <button class="ghost-button" type="button" data-open-workspace="${item.id}">${escapeHtml(
              t("workspaceOpen")
            )}</button>
          </div>
          <div class="workspace-actions">
            <button class="ghost-button" type="button" data-duplicate-workspace="${item.id}">${escapeHtml(
              t("workspaceDuplicate")
            )}</button>
            <button class="ghost-button" type="button" data-delete-workspace="${item.id}" ${
              state.project.workspaces.filter((ws) => !(ws.meta && ws.meta.challengeId)).length <= 1 ? "disabled" : ""
            }>${escapeHtml(t("workspaceDelete"))}</button>
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
      dom.chipLibrary.innerHTML = `<div class="chip-card"><div class="chip-meta">${escapeHtml(
        t("chipLibraryEmpty")
      )}</div></div>`;
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
              <span class="chip-version-label">v${definition.version}${
                isLatest ? ` · ${escapeHtml(t("chipLatest"))}` : ""
              }</span>
              <span class="chip-version-actions">
                <button class="ghost-button" type="button" data-place-chip="${definition.id}">${escapeHtml(
                  t("chipPlace")
                )}</button>
                <button class="ghost-button" type="button" data-edit-chip="${definition.id}">${escapeHtml(
                  t("chipNewVersion")
                )}</button>
                <button class="ghost-button" type="button" data-clone-chip="${definition.id}">${escapeHtml(
                  t("chipCloneSheet")
                )}</button>
              </span>
            </div>`;
          })
          .join("");
        return `<details class="chip-series-card"${open}>
          <summary class="chip-series-summary" data-chip-series="${seriesId}">
            <span class="chip-series-name">${escapeHtml(latest.name)}</span>
            <span class="chip-series-meta">${latest.inputs.length} in / ${latest.outputs.length} out${
              versions.length > 1 ? ` · ${escapeHtml(t("chipVersions", { n: versions.length }))}` : ""
            }</span>
          </summary>
          <div class="chip-series-body">
            ${latest.description ? `<p class="chip-meta">${escapeHtml(latest.description)}</p>` : ""}
            ${
              dependencyCount
                ? `<p class="chip-meta">${escapeHtml(t("chipNested", { n: dependencyCount }))}</p>`
                : ""
            }
            ${versionRows}
          </div>
        </details>`;
      })
      .join("");

    dom.chipLibrary.innerHTML = `
      <p class="chip-library-hint">${t("chipLibraryHint")}</p>
      ${groupMarkup}
    `;
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
              correct ? escapeHtml(t("quizGood")) : escapeHtml(t("quizBad"))
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
      <div class="challenge-kicker">${escapeHtml(t("checkUnderstanding"))}</div>
      ${items}
    </div>`;
  }

  function formatPins(pins) {
    return (pins || [])
      .map((pin) => {
        if (pin && typeof pin === "object") {
          return pin.width && pin.width > 1 ? `${pin.name}[${pin.width}]` : pin.name;
        }
        return String(pin);
      })
      .join(", ");
  }

  function formatAssignments(values) {
    return Object.entries(values || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ");
  }

  /** Live test table: evaluates the sheet as it is now, without saving a chip. */
  function renderLiveCheckInner(challenge) {
    if (challenge.verification !== "combinational" || !challenge.tests?.length) {
      return `<p class="live-check-note">${escapeHtml(t("liveSequential"))}</p>`;
    }
    const live = typeof deps.buildLiveDefinition === "function" ? deps.buildLiveDefinition() : null;
    if (!live || !live.definition) {
      return `<p class="live-check-note">${escapeHtml(t("liveNeedsInterface"))}</p>`;
    }
    let passed = 0;
    let firstFailIndex = -1;
    const rows = challenge.tests
      .map((test, index) => {
        let actual = "?";
        let ok = false;
        try {
          const out = challengeVerifier.previewOutputs(challenge, live.definition, test.inputs);
          ok = Object.entries(test.outputs).every(([k, v]) => out[k] === v);
          actual = Object.keys(test.outputs)
            .map((k) => `${k}=${out[k] ?? "?"}`)
            .join(" · ");
        } catch {
          actual = "—";
        }
        if (ok) {
          passed += 1;
        } else if (firstFailIndex < 0) {
          firstFailIndex = index;
        }
        return `<tr class="${ok ? "ok" : "bad"} ${index === firstFailIndex ? "first-fail" : ""}">
          <td class="mono">${escapeHtml(formatAssignments(test.inputs))}</td>
          <td class="mono">${escapeHtml(formatAssignments(test.outputs))}</td>
          <td class="mono">${escapeHtml(actual)}</td>
          <td class="live-mark">${ok ? "✓" : "✗"}</td>
        </tr>`;
      })
      .join("");
    const total = challenge.tests.length;
    const allPass = passed === total;
    return `<div class="live-check-summary ${allPass ? "ok" : ""}">
        <span class="live-check-meter" style="--ratio:${total ? passed / total : 0}"></span>
        <span>${escapeHtml(allPass ? t("liveAllPass") : t("livePassing", { passed, total }))}</span>
      </div>
      <div class="live-check-table-wrap">
        <table class="live-check-table">
          <thead><tr>
            <th>${escapeHtml(t("truthColInput"))}</th>
            <th>${escapeHtml(t("truthColExpected"))}</th>
            <th>${escapeHtml(t("liveColNow"))}</th>
            <th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function refreshLiveCheck() {
    const container = dom.challengeList.querySelector("[data-live-check]");
    if (!container) {
      return;
    }
    const challenge = challengesById.get(container.dataset.liveCheck);
    if (challenge) {
      container.innerHTML = renderLiveCheckInner(challenge);
    }
  }

  function renderHintLadder(challenge, localized) {
    const hints = localized.hints || [];
    if (!hints.length) {
      return "";
    }
    const shown = Math.min(hints.length, (state.hintsShown && state.hintsShown[challenge.id]) || 0);
    const list = shown
      ? `<ol class="hint-list">${hints
          .slice(0, shown)
          .map((hint) => `<li>${escapeHtml(hint)}</li>`)
          .join("")}</ol>`
      : "";
    const button =
      shown < hints.length
        ? `<button type="button" class="ghost-button hint-button" data-reveal-hint="${challenge.id}">💡 ${escapeHtml(
            t("hintShow", { n: shown + 1, total: hints.length })
          )}</button>`
        : "";
    return `${list}${button}`;
  }

  function renderStep(number, key, stateClass, title, body) {
    return `<li class="lesson-step ${stateClass}" data-lesson-step="${key}">
      <span class="lesson-step-marker">${stateClass === "is-done" ? "✓" : number}</span>
      <div class="lesson-step-body">
        <h4 class="lesson-step-title">${escapeHtml(title)}</h4>
        ${body}
      </div>
    </li>`;
  }

  function renderChallengeDetail(challenge, result) {
    const localized = localizeChallenge(challenge);
    const learner = getLearner();
    const unlocked = isChallengeUnlocked(challenge);
    const lessonCompleted = (learner.completedChallengeIds || []).includes(challenge.id) || Boolean(result.done);
    const nextLessonId = getNextLessonId(challenge.id);
    const requiredTitle = unlocked ? null : localizedRequiredTitle(challenge);
    const learning = localized.learning || {};
    const quizHtml = renderLessonQuiz(localized, learner);
    const quizItems = Array.isArray(localized.learning?.quiz) ? localized.learning.quiz : [];
    const quizAnswered =
      quizItems.length > 0 &&
      quizItems.every((_, index) => learner.quizAnswers?.[challenge.id]?.[String(index)] !== undefined);
    const disabledAttr = unlocked ? "" : "disabled";

    const feedback =
      state.lastSubmitFeedback && state.lastSubmitFeedback.challengeId === challenge.id
        ? state.lastSubmitFeedback
        : null;
    const lastCheckFailed = Boolean(feedback && !feedback.ok);

    // Step states: done ✓ · current (accent) · upcoming (muted).
    const buildState = lessonCompleted ? "is-done" : lastCheckFailed ? "" : "is-current";
    const checkState = lessonCompleted ? "is-done" : lastCheckFailed ? "is-current" : "";
    const quizState = !quizItems.length ? "" : quizAnswered ? "is-done" : lessonCompleted ? "is-current" : "";
    const nextState = lessonCompleted && (!quizItems.length || quizAnswered) ? "is-current" : "";

    const theoryOpen =
      state.theoryOpen && state.theoryOpen[challenge.id] !== undefined
        ? state.theoryOpen[challenge.id]
        : !lessonCompleted;
    const theoryParagraphs = (localized.theory || [])
      .map((paragraph) => `<p class="theory-paragraph">${escapeHtml(paragraph)}</p>`)
      .join("");

    const template = challenge.template || { inputs: [], outputs: [] };
    const conceptsHtml =
      Array.isArray(learning.concepts) && learning.concepts.length
        ? `<div class="lesson-concepts">${learning.concepts
            .map((concept) => `<span class="lesson-concept">${escapeHtml(concept)}</span>`)
            .join("")}</div>`
        : "";

    const steps = [];
    let n = 1;
    steps.push(
      renderStep(
        n++,
        "goal",
        "is-done",
        t("stepGoal"),
        `<p class="lesson-goal-text">${escapeHtml(learning.goal || localized.description || "")}</p>${conceptsHtml}`
      )
    );
    if (theoryParagraphs) {
      steps.push(
        renderStep(
          n++,
          "theory",
          "is-done",
          t("stepTheory"),
          `<details class="lesson-theory" data-theory-toggle="${challenge.id}"${theoryOpen ? " open" : ""}>
            <summary>${escapeHtml(theoryOpen ? t("theoryHide") : t("theoryRead"))}</summary>
            <div class="theory-body">${theoryParagraphs}</div>
          </details>`
        )
      );
    }
    steps.push(
      renderStep(
        n++,
        "build",
        buildState,
        t("stepBuild"),
        `<p class="lesson-step-copy">${escapeHtml(t("buildInstruction"))}</p>
        <p class="lesson-interface"><span>${escapeHtml(formatPins(template.inputs))}</span> → <span>${escapeHtml(
          formatPins(template.outputs)
        )}</span></p>
        ${
          unlocked && typeof deps.hasCoach === "function" && deps.hasCoach(challenge.id)
            ? `<button type="button" class="ghost-button coach-button" data-coach-start="${challenge.id}">▶ ${escapeHtml(
                t("coachShowMe")
              )}</button>`
            : ""
        }
        ${renderHintLadder(challenge, localized)}`
      )
    );

    const feedbackHtml = feedback
      ? `<p class="submit-feedback ${feedback.ok ? "ok" : "bad"}">${escapeHtml(feedback.message)}</p>`
      : "";
    const sequentialFailures = isSequentialChallenge(challenge) ? renderFailedCasesTable(result) : "";
    steps.push(
      renderStep(
        n++,
        "check",
        checkState,
        t("stepCheck"),
        `${unlocked ? `<div class="live-check" data-live-check="${challenge.id}">${renderLiveCheckInner(challenge)}</div>` : ""}
        ${feedbackHtml}
        ${sequentialFailures}
        <button class="${lessonCompleted ? "ghost-button" : "primary-button"} lesson-check-button" type="button" data-submit-challenge="${challenge.id}" ${disabledAttr}>${escapeHtml(
          t("lessonCheck")
        )}</button>`
      )
    );

    if (quizHtml) {
      steps.push(renderStep(n++, "quiz", quizState, t("stepQuiz"), quizHtml));
    }

    const unlockedParts = getPartsUnlockedBy(challenge.id)
      .map((type) => BUILTIN_PARTS.find((part) => part.type === type)?.label || type)
      .join(", ");
    const nextBody = lessonCompleted
      ? `${unlockedParts ? `<p class="lesson-unlocked-parts">✨ ${escapeHtml(t("unlockedParts", { parts: unlockedParts }))}</p>` : ""}
        <div class="lesson-next-actions">
          ${
            nextLessonId
              ? `<button class="primary-button" type="button" data-next-lesson="${nextLessonId}">${escapeHtml(
                  t("lessonNext")
                )}</button>`
              : ""
          }
          <button class="ghost-button" type="button" data-nav="home">${escapeHtml(t("backToOverview"))}</button>
          ${
            challenge.id === "computer"
              ? `<button class="ghost-button" type="button" data-show-completion-overlay>${S.showCompletion}</button>`
              : ""
          }
        </div>`
      : `<p class="lesson-step-copy muted">${escapeHtml(t("nextLocked"))}</p>`;
    steps.push(renderStep(n++, "next", nextState, t("stepNext"), nextBody));

    const lockNotice = !unlocked
      ? `<p class="challenge-lock-notice">${escapeHtml(t("lockNotice", { required: requiredTitle || t("locked") }))}</p>`
      : "";

    return `<article class="challenge-card challenge-detail-card lesson-flow ${lessonCompleted ? "done" : ""} ${
      unlocked ? "" : "locked"
    }">
      <div class="challenge-head">
        <h3>${unlocked ? "" : "🔒 "}${escapeHtml(localized.title)}</h3>
        <span class="challenge-status">${escapeHtml(
          lessonCompleted ? statusLabel("Verified") : unlocked ? statusLabel(result.label === "Open" ? "Open" : "Needs Work") : S.locked
        )}</span>
      </div>
      <p class="challenge-copy">${escapeHtml(localized.description)}</p>
      ${lockNotice}
      <ol class="lesson-steps">${steps.join("")}</ol>
      <div class="lesson-footer">
        <button class="link-button" type="button" data-open-challenge="${challenge.id}" title="${escapeHtml(
          t("lessonRestartTitle")
        )}" ${disabledAttr}>↺ ${escapeHtml(t("lessonRestart"))}</button>
      </div>
    </article>`;
  }

  function getLessonPosition(challengeId) {
    const module = CURRICULUM.find((item) => item.lessonIds.includes(challengeId));
    if (!module) {
      return null;
    }
    return {
      module,
      index: module.lessonIds.indexOf(challengeId),
      total: module.lessonIds.length,
    };
  }

  function getNextLessonId(challengeId) {
    const order = getOrderedLessonIds(CURRICULUM);
    const index = order.indexOf(challengeId);
    if (index < 0 || index + 1 >= order.length) {
      return null;
    }
    const nextId = order[index + 1];
    const next = CHALLENGES.find((challenge) => challenge.id === nextId);
    return next && isChallengeUnlocked(next) ? nextId : null;
  }

  function renderChallenges() {
    const activeChallengeId =
      (typeof deps.getActiveChallengeId === "function" && deps.getActiveChallengeId()) ||
      state.selectedChallengeId ||
      (CHALLENGES.length ? CHALLENGES[0].id : null);
    state.selectedChallengeId = activeChallengeId;
    const challenge = CHALLENGES.find((item) => item.id === activeChallengeId);
    if (!challenge) {
      dom.challengeList.innerHTML = "";
      return;
    }
    const userDefinitions = state.project.chipDefinitions.filter(
      (definition) => !challengeVerifier.isStarterDefinition(definition)
    );
    const result = challengeVerifier.evaluateChallengeResult(challenge, userDefinitions);
    const position = getLessonPosition(challenge.id);
    const positionLabel = position
      ? t("lessonPosition", {
          module: localizeCurriculumModule(position.module).title,
          n: position.index + 1,
          total: position.total,
        })
      : "";

    dom.challengeList.innerHTML = `
      <div class="lesson-panel-head">
        <button type="button" class="ghost-button lesson-back" data-nav="home">${escapeHtml(t("lessonBack"))}</button>
        <span class="lesson-position">${escapeHtml(positionLabel)}</span>
      </div>
      ${renderChallengeDetail(challenge, result)}
    `;
    workspaceActions.updateChallengeStartButton();
    workspaceActions.updateChallengeSubmitButton();
  }

  return {
    renderBuiltinPalette,
    renderWorkspaceList,
    renderChipLibrary,
    renderChallenges,
    isChallengeUnlocked,
    getNextLessonId,
    refreshLiveCheck,
  };
}
