export function createChallengeVerifier(deps) {
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

  function definitionMatchesChallenge(definition, challenge) {
    return (
      challenge.names.some(
        (name) => normalizeChallengeName(definition.name) === normalizeChallengeName(name)
      ) &&
      definition.inputs.length === challenge.inputs &&
      definition.outputs.length === challenge.outputs
    );
  }

  function evaluateChallengeResult(challenge, definitions) {
    const candidates = definitions.filter((definition) => definitionMatchesChallenge(definition, challenge));
    if (!candidates.length) {
      return {
        done: false,
        label: "Open",
        summary: "Nog geen eigen oplossing opgeslagen.",
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
    return {
      done: true,
      label: "Shape OK",
      summary: "Interface komt overeen met de opdracht.",
      score: 1,
    };
  }

  function runCombinationalChallengeVerification(challenge, definition) {
    const tests = Array.isArray(challenge.tests) ? challenge.tests : [];
    let passed = 0;

    for (const test of tests) {
      const outputs = simulateDefinitionOutputs(definition, test.inputs, `challenge:${challenge.id}`);
      const success = Object.entries(test.outputs).every(([name, expected]) => outputs[name] === expected);
      if (success) {
        passed += 1;
      }
    }

    const done = passed === tests.length;
    return {
      done,
      label: done ? "Verified" : "Needs Work",
      summary: `${passed}/${tests.length} functionele tests geslaagd.`,
      score: tests.length ? passed / tests.length : 0,
    };
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
      const done = passed === checkpoints.length;
      return {
        done,
        label: done ? "Verified" : "Needs Work",
        summary: `${passed}/${checkpoints.length} sequentiële checks geslaagd.`,
        score: checkpoints.length ? passed / checkpoints.length : 0,
      };
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

      // Beginstaat: OUT = 0
      checks.push(
        compareOutputs(
          simulateDefinitionOutputs(definition, { IN: "0", LOAD: "0", INC: "0", RST: "0" }, path),
          { OUT: "0" }
        )
      );

      // RST=1 → OUT blijft 0
      step({ IN: "1", LOAD: "0", INC: "0", RST: "1" }, { OUT: "0" });

      // LOAD=1, IN=1 → OUT = 1
      step({ IN: "1", LOAD: "1", INC: "0", RST: "0" }, { OUT: "1" });

      // Hold (geen actie) → OUT blijft 1
      step({ IN: "0", LOAD: "0", INC: "0", RST: "0" }, { OUT: "1" });

      // INC=1 → OUT = 0  (1+1 overflow voor 1-bit)
      step({ IN: "0", LOAD: "0", INC: "1", RST: "0" }, { OUT: "0" });

      // INC=1 → OUT = 1  (0+1)
      step({ IN: "0", LOAD: "0", INC: "1", RST: "0" }, { OUT: "1" });

      // RST heeft hogere prioriteit dan LOAD en INC → OUT = 0
      step({ IN: "1", LOAD: "1", INC: "1", RST: "1" }, { OUT: "0" });

      const passed = checks.filter(Boolean).length;
      const done = passed === checks.length;
      return {
        done,
        label: done ? "Verified" : "Needs Work",
        summary: `${passed}/${checks.length} sequentiële PC-checks geslaagd.`,
        score: checks.length ? passed / checks.length : 0,
      };
    } finally {
      deps.setRuntimeRegisterStates(originalRuntime);
    }
  }

  function compareOutputs(actual, expected) {
    return Object.entries(expected).every(([name, value]) => actual[name] === value);
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

  return {
    evaluateChallengeResult,
    isStarterDefinition,
    runChallengeVerification,
  };
}
