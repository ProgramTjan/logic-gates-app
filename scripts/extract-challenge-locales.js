/**
 * Extract challenge prose from CHALLENGES into locale modules.
 * Usage: node scripts/extract-challenge-locales.js
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CHALLENGES } from "../src/data/challenges.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../src/data/locales");

function pickProse(challenge) {
  const learning = challenge.learning || {};
  const quiz = Array.isArray(learning.quiz)
    ? learning.quiz.map((item) => ({
        question: item.question,
        options: item.options ? [...item.options] : [],
        explain: item.explain || "",
        answerIndex: item.answerIndex,
      }))
    : undefined;
  return {
    title: challenge.title,
    description: challenge.description,
    hints: Array.isArray(challenge.hints) ? [...challenge.hints] : [],
    theory: Array.isArray(challenge.theory) ? [...challenge.theory] : [],
    learning: {
      goal: learning.goal || "",
      concepts: Array.isArray(learning.concepts) ? [...learning.concepts] : [],
      ...(quiz ? { quiz } : {}),
    },
  };
}

const nlMap = {};
for (const challenge of CHALLENGES) {
  nlMap[challenge.id] = pickProse(challenge);
}

const header = `/** Auto-extracted / maintained challenge prose. Do not put tests here. */\n`;
const nlBody = `${header}export default ${JSON.stringify(nlMap, null, 2)};\n`;
writeFileSync(join(outDir, "challenges-nl.js"), nlBody, "utf8");
console.log(`Wrote challenges-nl.js (${Object.keys(nlMap).length} lessons)`);
console.log("Create challenges-en.js with English translations of the same keys.");
