import { t } from "../i18n/index.js";
export function createChallengeVerifier(deps) {
  const { getChipDefinition } = deps;

  function normalizeChallengeName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function isStarterDefinition(definition) {
    return Boolean(
      (definition.description && definition.description.toLowerCase().startsWith("starter ")) ||
        (definition.circuitSnapshot &&
          definition.circuitSnapshot.meta &&
          definition.circuitSnapshot.meta.isStarter)
    );
  }

  function definitionNameMatches(definition, challenge) {
    return challenge.names.some(
      (name) => normalizeChallengeName(definition.name) === normalizeChallengeName(name)
    );
  }

  function definitionMatchesChallenge(definition, challenge) {
    return (
      challenge.names.some(
        (name) => normalizeChallengeName(definition.name) === normalizeChallengeName(name)
      ) &&
      definition.inputs.length === challenge.inputs &&
      definition.outputs.length === challenge.outputs
    );
  }

  function collectGateTypesInSnapshot(snapshot, visitedDefinitions, acc) {
    if (!snapshot || !Array.isArray(snapshot.nodes)) {
      return;
    }
    for (const node of snapshot.nodes) {
      if (node.type === "gate") {
        const gt = String(node.config && node.config.gateType ? node.config.gateType : "").toUpperCase();
        if (gt) {
          acc.push(gt);
        }
      } else if (node.type === "chip-instance" && typeof getChipDefinition === "function") {
        const def = getChipDefinition(node.config.definitionId);
        if (def && !visitedDefinitions.has(def.id) && !isStarterDefinition(def)) {
          visitedDefinitions.add(def.id);
          collectGateTypesInSnapshot(def.circuitSnapshot, visitedDefinitions, acc);
        }
      }
    }
  }

  function checkGateConstraints(challenge, definition) {
    const gc = challenge.gateConstraint;
    if (!gc || (!gc.allowedGateTypes?.length && !gc.forbiddenGateTypes?.length)) {
      return { ok: true, message: "" };
    }
    const acc = [];
    collectGateTypesInSnapshot(definition.circuitSnapshot, new Set(), acc);

    if (gc.allowedGateTypes && gc.allowedGateTypes.length) {
      const allowed = new Set(gc.allowedGateTypes.map((g) => String(g).toUpperCase()));
      const bad = acc.filter((g) => !allowed.has(g));
      if (bad.length) {
        const uniq = [...new Set(bad)].join(", ");
        return {
          ok: false,
          message: t("verify.gateOnly", { allowed: [...allowed].join(", "), found: uniq }),
        };
      }
    }
    if (gc.forbiddenGateTypes && gc.forbiddenGateTypes.length) {
      const forbidden = new Set(gc.forbiddenGateTypes.map((g) => String(g).toUpperCase()));
      const bad = acc.filter((g) => forbidden.has(g));
      if (bad.length) {
        const uniq = [...new Set(bad)].join(", ");
        return { ok: false, message: t("verify.forbidden", { found: uniq }) };
      }
    }
    return { ok: true, message: "" };
  }

  /** A lesson can't be passed by dropping in the starter chip of the very chip it asks you to build. */
  function checkStarterShortcut(challenge, definition) {
    const nodes = definition.circuitSnapshot?.nodes || [];
    for (const node of nodes) {
      if (node.type !== "chip-instance") {
        continue;
      }
      const def = getChipDefinition(node.config?.definitionId);
      if (def && isStarterDefinition(def) && definitionNameMatches(def, challenge)) {
        return { ok: false, message: t("verify.starterShortcut", { name: def.name }) };
      }
    }
    return { ok: true, message: "" };
  }

  function finalizeWithGateConstraint(challenge, definition, base) {
    const starter = checkStarterShortcut(challenge, definition);
    const gateCheck = checkGateConstraints(challenge, definition);
    const gc = starter.ok ? gateCheck : starter;
    const done = Boolean(base.done) && gc.ok;
    let summary = base.summary || "";
    if (!gc.ok) {
      summary = summary ? `${summary} ${gc.message}` : gc.message;
    }
    return {
      ...base,
      done,
      label: done ? "Verified" : "Needs Work",
      summary,
    };
  }

  function evaluateChallengeResult(challenge, definitions) {
    const candidates = definitions.filter((definition) => definitionMatchesChallenge(definition, challenge));
    if (!candidates.length) {
      return {
        done: false,
        label: "Open",
        summary: t("verify.noSolution"),
      };
    }

    const attempts = candidates.map((definition) => runChallengeVerification(challenge, definition));
    const passing = attempts.find((attempt) => attempt.done);
    if (passing) {
      return passing;
    }

    const bestAttempt = attempts.sort((left, right) => right.score - left.score)[0];
    return bestAttempt;
  }

  function runChallengeVerification(challenge, definition) {
    if (challenge.verification === "combinational") {
      return runCombinationalChallengeVerification(challenge, definition);
    }
    if (challenge.verification === "sequential-register") {
      return runRegisterChallengeVerification(challenge, definition);
    }
    if (challenge.verification === "sequential-counter") {
      return runCounterChallengeVerification(challenge, definition);
    }
    if (challenge.verification === "sequential-script") {
      return runSequentialScriptVerification(challenge, definition);
    }
    const base = {
      done: true,
      label: "Shape OK",
      summary: t("verify.shapeOk"),
      score: 1,
    };
    return finalizeWithGateConstraint(challenge, definition, base);
  }

  function runCombinationalChallengeVerification(challenge, definition) {
    const tests = Array.isArray(challenge.tests) ? challenge.tests : [];
    let passed = 0;
    const failedCases = [];

    for (const test of tests) {
      const outputs = simulateDefinitionOutputs(definition, test.inputs, `challenge:${challenge.id}`);
      const success = Object.entries(test.outputs).every(([name, expected]) => outputs[name] === expected);
      if (success) {
        passed += 1;
      } else {
        const expectedStr = Object.entries(test.outputs)
          .map(([k, v]) => `${k}=${v}`)
          .join(",");
        const actualStr = Object.entries(test.outputs)
          .map(([k]) => `${k}=${outputs[k] ?? "?"}`)
          .join(",");
        const inputStr = Object.entries(test.inputs)
          .map(([k, v]) => `${k}=${v}`)
          .join(",");
        failedCases.push({
          inputs: test.inputs,
          expected: test.outputs,
          actual: outputs,
          detail: `in ${inputStr} verwacht ${expectedStr}, kreeg ${actualStr}`,
        });
      }
    }

    const base = {
      done: passed === tests.length,
      label: passed === tests.length ? "Verified" : "Needs Work",
      summary: t("verify.functional", { passed, total: tests.length }),
      score: tests.length ? passed / tests.length : 0,
      failedCases,
    };
    return finalizeWithGateConstraint(challenge, definition, base);
  }

  function runRegisterChallengeVerification(challenge, definition) {
    const originalRuntime = deps.deepClone(deps.getRuntimeRegisterStates());
    const path = `challenge:${challenge.id}:${definition.id}`;
    deps.setRuntimeRegisterStates({});

    try {
      const checkpoints = [];

      checkpoints.push(
        compareOutputs(
          simulateDefinitionOutputs(definition, { D: "0", CLK: "0", RST: "0" }, path),
          { Q: "0" }
        )
      );

      applyDefinitionStep(definition, { D: "1", CLK: "1", RST: "0" }, path);
      checkpoints.push(
        compareOutputs(
          simulateDefinitionOutputs(definition, { D: "1", CLK: "1", RST: "0" }, path),
          { Q: "1" }
        )
      );

      applyDefinitionStep(definition, { D: "0", CLK: "0", RST: "0" }, path);
      checkpoints.push(
        compareOutputs(
          simulateDefinitionOutputs(definition, { D: "0", CLK: "0", RST: "0" }, path),
          { Q: "1" }
        )
      );

      applyDefinitionStep(definition, { D: "0", CLK: "1", RST: "0" }, path);
      checkpoints.push(
        compareOutputs(
          simulateDefinitionOutputs(definition, { D: "0", CLK: "1", RST: "0" }, path),
          { Q: "0" }
        )
      );

      applyDefinitionStep(definition, { D: "1", CLK: "0", RST: "1" }, path);
      checkpoints.push(
        compareOutputs(
          simulateDefinitionOutputs(definition, { D: "1", CLK: "0", RST: "1" }, path),
          { Q: "0" }
        )
      );

      const passed = checkpoints.filter(Boolean).length;
      const base = {
        done: passed === checkpoints.length,
        label: passed === checkpoints.length ? "Verified" : "Needs Work",
        summary: t("verify.sequential", { passed, total: checkpoints.length }),
        score: checkpoints.length ? passed / checkpoints.length : 0,
      };
      return finalizeWithGateConstraint(challenge, definition, base);
    } finally {
      deps.setRuntimeRegisterStates(originalRuntime);
    }
  }

  function runCounterChallengeVerification(challenge, definition) {
    const originalRuntime = deps.deepClone(deps.getRuntimeRegisterStates());
    const path = `challenge:${challenge.id}:${definition.id}`;
    deps.setRuntimeRegisterStates({});

    try {
      const checks = [];

      function step(inputs, expect) {
        applyDefinitionStep(definition, inputs, path);
        const actual = simulateDefinitionOutputs(definition, inputs, path);
        checks.push(compareOutputs(actual, expect));
      }

      checks.push(
        compareOutputs(
          simulateDefinitionOutputs(definition, { IN: "0", LOAD: "0", INC: "0", RST: "0" }, path),
          { OUT: "0" }
        )
      );

      step({ IN: "1", LOAD: "0", INC: "0", RST: "1" }, { OUT: "0" });

      step({ IN: "1", LOAD: "1", INC: "0", RST: "0" }, { OUT: "1" });

      step({ IN: "0", LOAD: "0", INC: "0", RST: "0" }, { OUT: "1" });

      step({ IN: "0", LOAD: "0", INC: "1", RST: "0" }, { OUT: "0" });

      step({ IN: "0", LOAD: "0", INC: "1", RST: "0" }, { OUT: "1" });

      step({ IN: "1", LOAD: "1", INC: "1", RST: "1" }, { OUT: "0" });

      const passed = checks.filter(Boolean).length;
      const base = {
        done: passed === checks.length,
        label: passed === checks.length ? "Verified" : "Needs Work",
        summary: t("verify.pc", { passed, total: checks.length }),
        score: checks.length ? passed / checks.length : 0,
      };
      return finalizeWithGateConstraint(challenge, definition, base);
    } finally {
      deps.setRuntimeRegisterStates(originalRuntime);
    }
  }

  function runSequentialScriptVerification(challenge, definition) {
    const originalRuntime = deps.deepClone(deps.getRuntimeRegisterStates());
    const path = `challenge:${challenge.id}:${definition.id}`;
    deps.setRuntimeRegisterStates({});

    try {
      const script = challenge.script || [];
      let ctx = {};
      let passed = 0;
      let total = 0;
      const failedCases = [];

      for (const step of script) {
        ctx = { ...ctx, ...(step.inputs || {}) };
        if (step.tick) {
          applyDefinitionStep(definition, ctx, path);
        }
        if (step.expect) {
          total += 1;
          const actual = simulateDefinitionOutputs(definition, ctx, path);
          const ok = compareOutputs(actual, step.expect);
          if (ok) {
            passed += 1;
          } else {
            const expectedStr = Object.entries(step.expect)
              .map(([k, v]) => `${k}=${v}`)
              .join(",");
            const actualStr = Object.entries(step.expect)
              .map(([k]) => `${k}=${actual[k] ?? "?"}`)
              .join(",");
            failedCases.push({
              step: total,
              inputs: { ...ctx },
              expected: step.expect,
              actual,
              ok: false,
              detail: `stap ${total}: verwacht ${expectedStr}, kreeg ${actualStr}`,
            });
          }
        }
        if (step.expectState) {
          total += 1;
          const states = deps.getRuntimeRegisterStates();
          const ok = compareRegisterState(states, step.expectState);
          if (ok) {
            passed += 1;
          } else {
            const actualState = {};
            Object.keys(step.expectState).forEach((pattern) => {
              const keys = Object.keys(states || {});
              const matchKey = keys.find(
                (key) => key === pattern || key.endsWith(pattern) || key.includes(pattern)
              );
              actualState[pattern] = matchKey
                ? deps.formatBits(states[matchKey].bits, String(step.expectState[pattern]).length)
                : "?";
            });
            failedCases.push({
              step: total,
              inputs: { ...ctx },
              expected: step.expectState,
              actual: actualState,
              ok: false,
              detail: `stap ${total} (state): verwacht ${JSON.stringify(step.expectState)}, kreeg ${JSON.stringify(actualState)}`,
            });
          }
        }
      }

      const base = {
        done: total > 0 && passed === total,
        label: total > 0 && passed === total ? "Verified" : "Needs Work",
        summary: t("verify.script", { passed, total }),
        score: total ? passed / total : 0,
        failedCases,
      };
      return finalizeWithGateConstraint(challenge, definition, base);
    } finally {
      deps.setRuntimeRegisterStates(originalRuntime);
    }
  }

  function compareOutputs(actual, expected) {
    return Object.entries(expected).every(([name, value]) => actual[name] === value);
  }

  /**
   * Match register-state keys by suffix/substring pattern.
   * Example: expectState: { ":row0": "11110000" } matches keys ending with ":row0".
   */
  function compareRegisterState(registerStates, expected) {
    if (!expected || typeof expected !== "object") {
      return false;
    }
    const keys = Object.keys(registerStates || {});
    return Object.entries(expected).every(([pattern, value]) => {
      const matchKey = keys.find(
        (key) => key === pattern || key.endsWith(pattern) || key.includes(pattern)
      );
      if (!matchKey || !registerStates[matchKey]) {
        return false;
      }
      const width = String(value).length || 1;
      return deps.formatBits(registerStates[matchKey].bits, width) === String(value);
    });
  }

  function simulateDefinitionOutputs(definition, namedInputs, path) {
    const externalInputs = {};
    definition.inputs.forEach((pin) => {
      externalInputs[pin.key] = deps.parseBits(namedInputs[pin.name] || "0", pin.width);
    });
    const evaluation = deps.evaluateCircuit(definition.circuitSnapshot, externalInputs, path, new Set());
    const namedOutputs = {};
    definition.outputs.forEach((pin) => {
      namedOutputs[pin.name] = deps.formatBits(evaluation.interfaceOutputs[pin.key], pin.width);
    });
    return namedOutputs;
  }

  function applyDefinitionStep(definition, namedInputs, path) {
    const externalInputs = {};
    definition.inputs.forEach((pin) => {
      externalInputs[pin.key] = deps.parseBits(namedInputs[pin.name] || "0", pin.width);
    });
    const updates = deps.collectRegisterUpdates(definition.circuitSnapshot, externalInputs, path, new Set());
    const registerStates = deps.getRuntimeRegisterStates();
    updates.forEach((update) => {
      registerStates[update.key] = { bits: update.bits };
    });
  }

  function findDefinitionsForChallenge(challenge, definitions) {
    return definitions.filter((definition) => definitionMatchesChallenge(definition, challenge));
  }

  function previewOutputs(challenge, definition, namedInputs) {
    return simulateDefinitionOutputs(definition, namedInputs, `preview:${challenge.id}`);
  }

  return {
    evaluateChallengeResult,
    isStarterDefinition,
    runChallengeVerification,
    definitionMatchesChallenge,
    findDefinitionsForChallenge,
    previewOutputs,
    simulateDefinitionOutputs,
  };
}
