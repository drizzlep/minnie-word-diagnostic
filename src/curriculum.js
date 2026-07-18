export const CURRICULUM_EDITION = "广州教科版（三年级起点）";

export const CURRICULUM_SOURCES = {
  primary: {
    id: "gz-primary-vocab-2023",
    title: "广州版小学英语三至六年级单词表",
    url: "https://wenku.so.com/d/ed1b2ba3717bfcb5abc565e0934041a5",
    checkedAt: "2026-07-18",
    note: "第三方汇总资料，用于逐项核对年级、册次和单元；页码指预览页，不是教材页码。",
  },
  grade6b: {
    id: "gz-grade6b-vocab-2025",
    title: "广州版小学英语六年级下册单词表",
    url: "https://wenku.so.com/d/87b29fb5a0e89ff2065a277dcc1a8127",
    checkedAt: "2026-07-18",
    note: "第三方汇总资料，用于补齐并交叉核对六年级下册。",
  },
};

export const CURRICULUM_OCCURRENCES = [
  // Grade 3
  c("morning", 3, "上", 1, 1), c("friend", 3, "上", 4, 2), c("children", 3, "上", 6, 2, "child"),
  c("mouth", 3, "上", 6, 3), c("family", 3, "上", 7, 3), c("picture", 3, "上", 7, 3),
  c("father", 3, "上", 7, 3), c("chair", 3, "上", 12, 6),
  c("black", 3, "下", 2, 7), c("orange", 3, "下", 2, 6), c("happy", 3, "下", 5, 7),
  c("people", 3, "下", 10, 9), c("grandmother", 3, "下", 10, 9), c("buy", 3, "下", 11, 10),

  // Grade 4
  c("window", 4, "上", 1, 11), c("computer", 4, "上", 1, 11), c("right", 4, "上", 2, 11),
  c("clock", 4, "上", 2, 11), c("house", 4, "上", 3, 11), c("study", 4, "上", 3, 11),
  c("kitchen", 4, "上", 3, 11), c("beautiful", 4, "上", 3, 11), c("building", 4, "上", 4, 11),
  c("bathroom", 4, "上", 4, 11), c("watch", 4, "上", 4, 11), c("homework", 4, "上", 4, 11),
  c("classroom", 4, "上", 5, 11), c("playground", 4, "上", 5, 11), c("lesson", 4, "上", 5, 11),
  c("subject", 4, "上", 8, 12), c("favourite", 4, "上", 8, 12), c("write", 4, "上", 8, 12),
  c("everything", 4, "上", 8, 12),
  c("run", 4, "下", 4, 13), c("swim", 4, "下", 4, 13), c("exercise", 4, "下", 4, 13), c("parent", 4, "下", 6, 14),
  c("interesting", 4, "下", 7, 14), c("football", 4, "下", 9, 14),
  c("basketball", 4, "下", 9, 14), c("celebration", 4, "下", 11, 14), c("saturday", 4, "下", 5, 14),

  // Grade 5
  c("country", 5, "上", 1, 15), c("together", 5, "上", 3, 15), c("bread", 5, "上", 8, 15),
  c("sandwich", 5, "上", 8, 15), c("vegetable", 5, "上", 8, 16), c("delicious", 5, "上", 9, 16),
  c("different", 5, "上", 10, 16), c("before", 5, "上", 12, 16), c("umbrella", 5, "上", 12, 16),
  c("colourful", 5, "下", 1, 17), c("answer", 5, "下", 2, 17), c("classmate", 5, "下", 2, 17),
  c("important", 5, "下", 3, 17), c("plan", 5, "下", 5, 17), c("supermarket", 5, "下", 5, 17),
  c("train", 5, "下", 7, 17), c("dangerous", 5, "下", 9, 18), c("hospital", 5, "下", 11, 18),
  c("direction", 5, "下", 11, 18), c("restaurant", 5, "下", 11, 18),

  // Grade 6
  c("grandparent", 6, "上", 2, 18), c("quiet", 6, "上", 3, 19), c("comfortable", 6, "上", 3, 19),
  c("because", 6, "上", 4, 19), c("countryside", 6, "上", 4, 19), c("medicine", 6, "上", 5, 19),
  c("yesterday", 6, "上", 7, 20), c("wonderful", 6, "上", 12, 20), c("bring", 6, "上", 12, 20),
  c("stop", 6, "下", 2, 1, "stop", "grade6b"),
];

export const CURRICULUM_WORDS = Object.groupBy(CURRICULUM_OCCURRENCES, (record) => record.lemma);

export function curriculumFor(lemma) {
  const occurrences = CURRICULUM_WORDS[String(lemma).toLowerCase()] ?? [];
  if (occurrences.length > 1) throw new Error(`教材映射不唯一: ${lemma}`);
  return occurrences[0] ?? null;
}

export function curriculumSource(sourceId) {
  return Object.values(CURRICULUM_SOURCES).find((source) => source.id === sourceId) ?? null;
}

function c(word, grade, semester, unit, referencePage, lemma = word, sourceKey = "primary") {
  const source = CURRICULUM_SOURCES[sourceKey];
  return {
    occurrenceId: `${grade}${semester}-u${unit}-${lemma}`,
    lemma,
    listedForm: word,
    grade,
    semester,
    unit,
    sourceId: source.id,
    sourceTitle: source.title,
    sourceUrl: source.url,
    referencePage,
    verifiedAt: source.checkedAt,
  };
}
