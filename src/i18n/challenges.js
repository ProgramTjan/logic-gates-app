import challengesEn from "../data/locales/challenges-en.js";
import challengesNl from "../data/locales/challenges-nl.js";
import { getLocale, t } from "./index.js";

export function localizeChallenge(challenge, locale = getLocale()) {
  const packs = locale === "nl" ? challengesNl : challengesEn;
  const bag = packs[challenge.id] || challengesEn[challenge.id] || {};
  const learningBag = bag.learning || {};
  const baseLearning = challenge.learning || {};
  return {
    ...challenge,
    title: bag.title ?? challenge.title,
    description: bag.description ?? challenge.description,
    hints: bag.hints ?? challenge.hints ?? [],
    theory: bag.theory ?? challenge.theory ?? [],
    learning: {
      ...baseLearning,
      goal: learningBag.goal ?? baseLearning.goal,
      concepts: learningBag.concepts ?? baseLearning.concepts ?? [],
      quiz: learningBag.quiz ?? baseLearning.quiz,
    },
  };
}

export function localizeCurriculumModule(module, locale = getLocale()) {
  void locale;
  return {
    ...module,
    title: t(`curriculum.${module.id}.title`),
    description: t(`curriculum.${module.id}.description`),
  };
}
