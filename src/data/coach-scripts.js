/**
 * Coach scripts per lesson (UX fase C). Data only — interpreted by src/ui/tutorial.js.
 *
 * Step fields
 *   say:   i18n key for the coach text; `vars` fills {placeholders}.
 *   at:    where to point
 *            { selector }          any element
 *            { part: match }       the Parts button (or the Parts menu itself while closed)
 *            { out: match }        first output pin of a matching node
 *            { toggle: "LABEL" }   toggle button of an input pin
 *            { check: true }       the "Check my circuit" button
 *   until: when the step is done
 *            { ack: true }               coach shows a "Got it" button
 *            { has: match, count }       at least `count` matching nodes (default 1)
 *            { wire: [from, to] }        a wire from a matching node to a matching node
 *            { fed: match, count, pins } at least `count` matching nodes with ≥ `pins` wired inputs
 *            { high: ["LABEL", …] }      these input pins are switched on
 *            { completed: true }         the lesson is passed
 *            { all: [until, …] }         every sub-condition holds
 *
 * Node matches: { pin: "LABEL" } input/output pin · { gate: "AND" } built-in gate ·
 *               { chip: "NOT" } your saved chip · { anyOf: [match, …] }.
 * A wire step points at the source pin first; once that pin is picked, it points at a
 * free input of the target and switches to the "wireTo" text.
 */

const gateOrChip = (name) => ({ anyOf: [{ gate: name }, { chip: name }] });

const checkStep = { say: "coach.check", at: { check: true }, until: { completed: true } };

export const COACH_SCRIPTS = {
  "intro-light": [
    { say: "coach.intro.welcome", at: { selector: '[data-lesson-step="intro"]' }, until: { ack: true } },
    { say: "coach.intro.canvas", at: { selector: "#workspace-canvas" }, until: { ack: true } },
    { say: "coach.place", vars: { part: "AND" }, at: { part: { gate: "AND" } }, until: { has: { gate: "AND" } } },
    {
      say: "coach.wireFrom",
      vars: { from: "DOOR", to: "AND" },
      at: { out: { pin: "DOOR" } },
      until: { wire: [{ pin: "DOOR" }, { gate: "AND" }] },
    },
    {
      say: "coach.wireFrom",
      vars: { from: "ALARM", to: "AND" },
      at: { out: { pin: "ALARM" } },
      until: { wire: [{ pin: "ALARM" }, { gate: "AND" }] },
    },
    {
      say: "coach.wireFrom",
      vars: { from: "AND", to: "LAMP" },
      at: { out: { gate: "AND" } },
      until: { wire: [{ gate: "AND" }, { pin: "LAMP" }] },
    },
    { say: "coach.intro.toggleDoor", at: { toggle: "DOOR" }, until: { high: ["DOOR"] } },
    { say: "coach.intro.toggleAlarm", at: { toggle: "ALARM" }, until: { high: ["DOOR", "ALARM"] } },
    { say: "coach.intro.check", at: { check: true }, until: { completed: true } },
  ],

  nand: [
    { say: "coach.place", vars: { part: "NAND" }, at: { part: { gate: "NAND" } }, until: { has: { gate: "NAND" } } },
    {
      say: "coach.wireFrom",
      vars: { from: "A", to: "NAND" },
      at: { out: { pin: "A" } },
      until: { wire: [{ pin: "A" }, { gate: "NAND" }] },
    },
    {
      say: "coach.wireFrom",
      vars: { from: "B", to: "NAND" },
      at: { out: { pin: "B" } },
      until: { wire: [{ pin: "B" }, { gate: "NAND" }] },
    },
    {
      say: "coach.wireFrom",
      vars: { from: "NAND", to: "OUT" },
      at: { out: { gate: "NAND" } },
      until: { wire: [{ gate: "NAND" }, { pin: "OUT" }] },
    },
    { say: "coach.toggleWatch", vars: { pin: "A" }, at: { toggle: "A" }, until: { high: ["A"] } },
    checkStep,
  ],

  not: [
    { say: "coach.not.idea", at: { selector: '[data-lesson-step="intro"]' }, until: { ack: true } },
    { say: "coach.place", vars: { part: "NAND" }, at: { part: { gate: "NAND" } }, until: { has: { gate: "NAND" } } },
    {
      say: "coach.not.wireBoth",
      at: { out: { pin: "IN" } },
      until: { fed: { gate: "NAND" }, count: 1, pins: 2 },
    },
    {
      say: "coach.wireFrom",
      vars: { from: "NAND", to: "OUT" },
      at: { out: { gate: "NAND" } },
      until: { wire: [{ gate: "NAND" }, { pin: "OUT" }] },
    },
    checkStep,
  ],

  and: [
    { say: "coach.and.idea", at: { selector: '[data-lesson-step="intro"]' }, until: { ack: true } },
    { say: "coach.place", vars: { part: "NAND" }, at: { part: { gate: "NAND" } }, until: { has: { gate: "NAND" } } },
    { say: "coach.placeOwn", vars: { part: "NOT" }, at: { part: { gate: "NOT" } }, until: { has: gateOrChip("NOT") } },
    {
      say: "coach.wireInputs",
      vars: { to: "NAND" },
      at: { out: { pin: "A" } },
      until: { all: [{ wire: [{ pin: "A" }, { gate: "NAND" }] }, { wire: [{ pin: "B" }, { gate: "NAND" }] }] },
    },
    {
      say: "coach.wireFrom",
      vars: { from: "NAND", to: "NOT" },
      at: { out: { gate: "NAND" } },
      until: { wire: [{ gate: "NAND" }, gateOrChip("NOT")] },
    },
    {
      say: "coach.wireFrom",
      vars: { from: "NOT", to: "OUT" },
      at: { out: gateOrChip("NOT") },
      until: { wire: [gateOrChip("NOT"), { pin: "OUT" }] },
    },
    checkStep,
  ],

  or: [
    { say: "coach.or.idea", at: { selector: '[data-lesson-step="intro"]' }, until: { ack: true } },
    { say: "coach.placeTwo", vars: { part: "NOT" }, at: { part: { gate: "NOT" } }, until: { has: gateOrChip("NOT"), count: 2 } },
    { say: "coach.place", vars: { part: "NAND" }, at: { part: { gate: "NAND" } }, until: { has: { gate: "NAND" } } },
    {
      say: "coach.or.wireNots",
      at: { out: { pin: "A" } },
      until: { fed: gateOrChip("NOT"), count: 2, pins: 1 },
    },
    {
      say: "coach.or.wireNand",
      at: { out: gateOrChip("NOT") },
      until: { fed: { gate: "NAND" }, count: 1, pins: 2 },
    },
    {
      say: "coach.wireFrom",
      vars: { from: "NAND", to: "OUT" },
      at: { out: { gate: "NAND" } },
      until: { wire: [{ gate: "NAND" }, { pin: "OUT" }] },
    },
    checkStep,
  ],

  xor: [
    { say: "coach.xor.idea", at: { selector: '[data-lesson-step="intro"]' }, until: { ack: true } },
    { say: "coach.placeOwn", vars: { part: "OR" }, at: { part: { gate: "OR" } }, until: { has: gateOrChip("OR") } },
    { say: "coach.place", vars: { part: "NAND" }, at: { part: { gate: "NAND" } }, until: { has: { gate: "NAND" } } },
    { say: "coach.placeOwn", vars: { part: "AND" }, at: { part: { gate: "AND" } }, until: { has: gateOrChip("AND") } },
    {
      say: "coach.xor.wireInputs",
      at: { out: { pin: "A" } },
      until: { all: [{ fed: gateOrChip("OR"), count: 1, pins: 2 }, { fed: { gate: "NAND" }, count: 1, pins: 2 }] },
    },
    {
      say: "coach.xor.wireAnd",
      at: { out: gateOrChip("OR") },
      until: { fed: gateOrChip("AND"), count: 1, pins: 2 },
    },
    {
      say: "coach.wireFrom",
      vars: { from: "AND", to: "OUT" },
      at: { out: gateOrChip("AND") },
      until: { wire: [gateOrChip("AND"), { pin: "OUT" }] },
    },
    checkStep,
  ],
};

export function getCoachScript(challengeId) {
  return COACH_SCRIPTS[challengeId] || null;
}
