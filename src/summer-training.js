// Provisional summer deck for the 2026 Grade 7 transition.
// It is intentionally a small, shared-core deck; the school book will be used
// to add/remove unit-specific words after the first week of term.
export const SUMMER_TRAINING_EDITION = "新版沪教牛津七年级上册（广州地区）·暑假试行版";
export const SUMMER_TRAINING_SOURCE_NOTE = "按广州地区新版沪教牛津体系整理的真实高频词候选；开学拿到教材后再按版权页和单元目录校准，不会清掉已有训练记录。";

export const summerTrainingWords = [
  word("adventure", "冒险", "travelling"),
  word("direction", "方向", "travelling"),
  word("festival", "节日", "travelling"),
  word("restaurant", "餐馆", "travelling"),
  word("delicious", "美味的", "travelling"),
  word("comfortable", "舒适的", "travelling"),
  word("classmate", "同学", "school life"),
  word("building", "建筑物", "school life"),
  word("interesting", "有趣的", "school life"),
  word("important", "重要的", "school life"),
  word("medicine", "药；医学", "health"),
  word("dangerous", "危险的", "health"),
  word("telescope", "望远镜", "science"),
  word("lighthouse", "灯塔", "places"),
  word("masterpiece", "杰作", "culture"),
  word("observatory", "天文台", "science"),
  word("constellation", "星座", "science"),
  word("encyclopedia", "百科全书", "reading"),
  word("supermarket", "超市", "daily life"),
  word("celebration", "庆祝；庆典", "culture"),
];

export const TRAINING_SESSION_SIZE = 8;
export const TRAINING_NEW_LIMIT = 8;

export function trainingWordFor(wordId) {
  return summerTrainingWords.find((item) => item.wordId === wordId) ?? null;
}

export function buildTrainingQueue(wordState = {}, now = Date.now(), size = TRAINING_SESSION_SIZE) {
  const known = summerTrainingWords.filter((item) => wordState[item.wordId]?.attempts > 0);
  const due = known
    .filter((item) => (wordState[item.wordId]?.dueAt ?? 0) <= now)
    .sort((a, b) => (wordState[a.wordId]?.dueAt ?? 0) - (wordState[b.wordId]?.dueAt ?? 0));
  const unseen = summerTrainingWords.filter((item) => !wordState[item.wordId]?.attempts);
  const reviewSlots = Math.min(2, due.length, Math.max(0, size - 1));
  const selected = [...due.slice(0, reviewSlots), ...unseen.slice(0, Math.min(TRAINING_NEW_LIMIT, size - reviewSlots))];

  // If a nearly finished deck has fewer new words, fill the session with due items.
  if (selected.length < size) {
    const selectedIds = new Set(selected.map((item) => item.wordId));
    selected.push(...due.filter((item) => !selectedIds.has(item.wordId)).slice(0, size - selected.length));
  }
  return selected.slice(0, size);
}

export function nextDueAt(box, correct, now = Date.now()) {
  if (!correct) return now + 24 * 60 * 60 * 1000;
  const days = [1, 2, 4, 7, 14][Math.min(Math.max(box, 0), 4)];
  return now + days * 24 * 60 * 60 * 1000;
}

export function countDueWords(wordState = {}, now = Date.now()) {
  return summerTrainingWords.filter((item) => wordState[item.wordId]?.attempts > 0 && (wordState[item.wordId]?.dueAt ?? 0) <= now).length;
}

function word(wordId, meaning, theme) {
  return {
    wordId,
    word: wordId,
    meaning,
    theme,
    length: wordId.length,
    lengthBand: wordId.length <= 5 ? "4-5" : wordId.length <= 7 ? "6-7" : wordId.length <= 9 ? "8-9" : "10+",
  };
}
