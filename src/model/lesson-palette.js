/**
 * Which built-in parts a lesson offers in its Parts menu.
 *
 * Idea: a lesson shows only what is useful for it, and built-in gates become available
 * once the learner has built them themselves (NAND is the given primitive). Free mode
 * (`learner.unlockedAll`) offers every gate. Free build (sandbox) does not use this.
 */

/** Built-in gate type → the lesson that teaches it. NAND is always available. */
export const GATE_TAUGHT_BY = {
  "gate-not": "not",
  "gate-and": "and",
  "gate-or": "or",
  "gate-xor": "xor",
  "gate-nor": "or",
};

const ALWAYS = ["input-pin", "output-pin", "gate-nand"];
const BUS_PARTS = ["splitter", "joiner"];
const SEQUENTIAL_PARTS = ["clock", "register"];

function pinWidth(pin) {
  return pin && typeof pin === "object" ? Number(pin.width) || 1 : 1;
}

export function isSequentialChallenge(challenge) {
  return String(challenge?.verification || "").startsWith("sequential");
}

/**
 * @param {object} challenge  lesson definition (uses verification, template, gateConstraint)
 * @param {{completedChallengeIds?: string[], unlockedAll?: boolean}} learner
 * @returns {{ available: string[], locked: {type: string, lessonId: string}[] }}
 */
export function getLessonPartTypes(challenge, learner = {}) {
  const template = challenge?.template || { inputs: [], outputs: [] };
  const completed = new Set(learner.completedChallengeIds || []);
  const available = new Set(ALWAYS);
  const locked = [];

  const allowedGates = challenge?.gateConstraint?.allowedGateTypes?.length
    ? new Set(challenge.gateConstraint.allowedGateTypes.map((g) => `gate-${String(g).toLowerCase()}`))
    : null;

  Object.entries(GATE_TAUGHT_BY).forEach(([type, lessonId]) => {
    if (allowedGates && !allowedGates.has(type)) {
      return;
    }
    if (lessonId === challenge?.id) {
      // Never offer the gate you are building in this very lesson.
      return;
    }
    if (learner.unlockedAll || completed.has(lessonId)) {
      available.add(type);
    } else {
      locked.push({ type, lessonId });
    }
  });
  if (allowedGates && !allowedGates.has("gate-nand")) {
    available.delete("gate-nand");
  }

  const pins = [...(template.inputs || []), ...(template.outputs || [])];
  if (pins.some((pin) => pinWidth(pin) > 1)) {
    BUS_PARTS.forEach((type) => available.add(type));
  }
  if (isSequentialChallenge(challenge)) {
    SEQUENTIAL_PARTS.forEach((type) => available.add(type));
  }
  (template.nodes || []).forEach((spec) => {
    if (spec && spec.type) {
      available.add(spec.type);
    }
  });

  // NOR is taught by OR; keep only one locked entry per lesson for a tidy "learn later" row.
  const seenLessons = new Set();
  const tidyLocked = locked.filter((item) => {
    if (seenLessons.has(item.lessonId)) {
      return false;
    }
    seenLessons.add(item.lessonId);
    return true;
  });

  return { available: [...available], locked: tidyLocked };
}

/** Gate types that completing `challengeId` newly unlocks (for the "new in your parts" note). */
export function getPartsUnlockedBy(challengeId) {
  return Object.entries(GATE_TAUGHT_BY)
    .filter(([, lessonId]) => lessonId === challengeId)
    .map(([type]) => type);
}
