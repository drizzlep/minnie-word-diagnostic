import test from "node:test";
import assert from "node:assert/strict";

import { evaluateSpelling, generateReport } from "../src/diagnostic.js";
import { selectNovelCandidate } from "../src/data.js";
import { storedStateStatus } from "../src/state-version.js";
import { memoryCardFor, rescueWordIds } from "../src/memory-cards.js";
import { buildTrainingQueue, nextDueAt, summerTrainingWords } from "../src/summer-training.js";

test("拼写评分能识别漏字母、相邻错序和词尾错误", () => {
  const missing = evaluateSpelling("interesting", "intersting");
  assert.equal(missing.correct, false);
  assert.equal(missing.errorTypes.includes("missing"), true);
  assert.equal(missing.letterAccuracy, 10 / 11);
  assert.equal(missing.errorPositions.length > 0, true);

  const transposed = evaluateSpelling("friend", "freind");
  assert.equal(transposed.errorTypes.includes("transposition"), true);

  const ending = evaluateSpelling("studies", "study");
  assert.equal(ending.errorTypes.includes("ending"), true);
});

test("没印象计入基础缺口，但不参与个人长词门槛", () => {
  const items = [
    item("short", "spelling", "friend", "6-7"),
    item("long-unknown", "spelling", "interesting", "10+"),
    item("long-known", "spelling", "playground", "10+"),
  ];
  const attempts = [
    attempt("short", "friend"),
    attempt("long-unknown", "", true),
    attempt("long-known", "playgrond"),
  ];

  const report = generateReport({ items, attempts, novelWordIds: [] });

  assert.equal(report.metrics.spelling.value, 1 / 3);
  assert.equal(report.gaps.unknownCount, 1);
  assert.equal(report.lengthBands["10+"].eligible, 1);
  assert.equal(report.errorLocations.middle > 0 || report.errorLocations.ending > 0, true);
});

test("报告按既定五项门槛给出小学词汇拼写初步达标结论", () => {
  const items = [
    item("m1", "meaning", "苹果", "4-5", "苹果"),
    item("a1", "audio", "teacher", "6-7"),
    item("s1", "spelling", "family", "6-7"),
    item("s2", "spelling", "beautiful", "8-9"),
    item("d1", "delayed", "adventure", "8-9", "冒险", "novel"),
  ];
  const attempts = [
    attempt("m1", "苹果"),
    attempt("a1", "teacher"),
    attempt("s1", "family"),
    attempt("s2", "beautiful"),
    attempt("d1", "adventure"),
  ];

  const report = generateReport({ items, attempts, novelWordIds: ["adventure"] });

  assert.equal(report.verdict.passed, true);
  assert.equal(report.verdict.label, "广州教科版小学词汇抽测初步达标");
});

test("隔天新词保持率不足时报告暂未达标", () => {
  const items = [
    item("m1", "meaning", "苹果", "4-5", "苹果"),
    item("a1", "audio", "teacher", "6-7"),
    item("s1", "spelling", "family", "6-7"),
    item("s2", "spelling", "beautiful", "8-9"),
    item("d1", "delayed", "adventure", "8-9", "冒险", "novel"),
  ];
  const attempts = [
    attempt("m1", "苹果"),
    attempt("a1", "teacher"),
    attempt("s1", "family"),
    attempt("s2", "beautiful"),
    attempt("d1", "adventur"),
  ];

  const report = generateReport({ items, attempts, novelWordIds: ["adventure"] });

  assert.equal(report.verdict.passed, false);
  assert.equal(report.verdict.failedMetrics.includes("delayed"), true);
});

test("未满18小时的保持率不参与隔天达标判定", () => {
  const items = [
    item("m1", "meaning", "苹果", "4-5", "苹果"),
    item("a1", "audio", "teacher", "6-7"),
    item("s1", "spelling", "family", "6-7"),
    item("s2", "spelling", "beautiful", "8-9"),
    item("d1", "delayed", "adventure", "8-9", "冒险", "novel"),
  ];
  const attempts = [
    attempt("m1", "苹果"), attempt("a1", "teacher"), attempt("s1", "family"),
    attempt("s2", "beautiful"), attempt("d1", "adventur"),
  ];
  const report = generateReport({ items, attempts, novelWordIds: ["adventure"], delayedIntervalMs: 6 * 60 * 60 * 1000 });
  assert.equal(report.delayedEligible, false);
  assert.equal(report.metrics.delayed.value, 0);
  assert.equal(report.verdict.failedMetrics.includes("delayed"), false);
  assert.equal(report.verdict.passed, true);
});

test("个人长词门槛只在有足够样本且正确率明显下降时出现", () => {
  const items = [
    item("s1", "spelling", "black", "4-5"),
    item("s2", "spelling", "clock", "4-5"),
    item("m1", "spelling", "family", "6-7"),
    item("m2", "spelling", "friend", "6-7"),
    item("l1", "spelling", "daughter", "8-9"),
    item("l2", "spelling", "homework", "8-9"),
  ];
  const attempts = [
    attempt("s1", "black"), attempt("s2", "clock"),
    attempt("m1", "family"), attempt("m2", "friend"),
    attempt("l1", "daugter"), attempt("l2", "homewrok"),
  ];

  const report = generateReport({ items, attempts });

  assert.equal(report.personalThreshold, "8-9");
});

test("同一个新词立即与隔天都答错时只进入一次学习清单", () => {
  const items = [
    item("immediate-a", "immediate", "adventure", "8-9", "冒险", "novel"),
    item("delayed-a", "delayed", "adventure", "8-9", "冒险", "novel"),
  ];
  const attempts = [attempt("immediate-a", "adventur"), attempt("delayed-a", "adventre")];

  const report = generateReport({ items, attempts, novelWordIds: ["adventure"] });

  assert.equal(report.challengeWords.length, 1);
  assert.deepEqual(report.challengeWords[0].phases.sort(), ["delayed", "immediate"]);
  assert.equal(report.gaps.unknownCount, 0);
});

test("新词候选耗尽后不会重新使用已经确认认识的词", () => {
  const rejected = ["cabin", "badge", "coral", "thorn", "plume", "wharf"];
  assert.equal(selectNovelCandidate("4-5", [], rejected), null);
});

test("旧版进度不会被误当作当前题库进度", () => {
  assert.equal(storedStateStatus(null, 2), "missing");
  assert.equal(storedStateStatus({ version: 1 }, 2), "legacy");
  assert.equal(storedStateStatus({ version: 2 }, 2), "current");
});

test("记忆救援只选择隔天未答对的词并优先较短词", () => {
  const words = [
    { wordId: "lighthouse", length: 10 },
    { wordId: "cabin", length: 5 },
    { wordId: "lantern", length: 7 },
  ];
  const attempts = [
    { itemId: "delayed-cabin", phase: "delayed", analysis: { correct: true } },
    { itemId: "delayed-lantern", phase: "delayed", analysis: { correct: false } },
    { itemId: "delayed-lighthouse", phase: "delayed", analysis: { correct: false } },
  ];
  assert.deepEqual(rescueWordIds(words, attempts), ["lantern", "lighthouse"]);
});

test("记忆卡拆分完整覆盖原单词", () => {
  for (const word of ["cabin", "telescope", "lighthouse", "masterpiece"]) {
    assert.equal(memoryCardFor(word).chunks.join(""), word);
  }
});

test("暑假训练首日给八个新词，之后混入到期复习", () => {
  const first = buildTrainingQueue({}, 0, 8);
  assert.equal(first.length, 8);
  assert.equal(new Set(first.map((word) => word.wordId)).size, 8);

  const state = Object.fromEntries(first.slice(0, 2).map((word) => [word.wordId, {
    attempts: 1, correct: 1, mastery: 2, box: 1, dueAt: 0,
  }]));
  const next = buildTrainingQueue(state, 1, 8);
  assert.deepEqual(next.slice(0, 2).map((word) => word.wordId), first.slice(0, 2).map((word) => word.wordId));
  assert.equal(next.length, 8);
});

test("暑假训练答对后按盒子推进，答错一天后重试", () => {
  const now = Date.UTC(2026, 6, 19);
  assert.equal(nextDueAt(0, true, now) - now, 24 * 60 * 60 * 1000);
  assert.equal(nextDueAt(3, true, now) - now, 7 * 24 * 60 * 60 * 1000);
  assert.equal(nextDueAt(4, false, now) - now, 24 * 60 * 60 * 1000);
  assert.equal(summerTrainingWords.length >= 20, true);
});

function item(id, type, answer, lengthBand, meaning = "", group = "core") {
  return {
    id,
    type,
    answer,
    lengthBand,
    meaning,
    group,
    wordId: answer,
    pattern: "regular",
  };
}

function attempt(itemId, response, unknown = false) {
  return { itemId, response, unknown, durationMs: 1000, createdAt: Date.now() };
}
