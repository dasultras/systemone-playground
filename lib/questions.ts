import type { Question, QuestionType } from "./types";

let counter = 0;
export const uid = (prefix = "q") => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newQuestion(type: QuestionType = "choice"): Question {
  return {
    id: uid(),
    text: "",
    type,
    options: type === "choice" ? ["", "", ""] : [],
    levels: 5,
    scoreLow: "niedrig",
    scoreHigh: "hoch",
  };
}

/** Beschriftungen der Ausgabeachse einer Frage. */
export function labelsFor(question: Question): string[] {
  if (question.type === "noul") return ["Ja", "Nein"];
  if (question.type === "score") return Array.from({ length: question.levels }, (_, i) => String(i + 1));
  return question.options.map((o, i) => o.trim() || `Option ${i + 1}`);
}
