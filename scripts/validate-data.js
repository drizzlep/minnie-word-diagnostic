import { exams, practiceItems, novelCandidates, allAudioWords, DATASET_VERSION } from "../src/data.js";
import { CURRICULUM_OCCURRENCES, curriculumSource } from "../src/curriculum.js";
import { summerTrainingWords } from "../src/summer-training.js";
import { memoryCardFor } from "../src/memory-cards.js";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const allItems = [...practiceItems, ...exams.A.day1, ...exams.A.day2, ...exams.B.day1, ...exams.B.day2];
const ids = new Set();
const occurrenceIds = new Set();
const errors = [];
for (const occurrence of CURRICULUM_OCCURRENCES) {
  if (occurrenceIds.has(occurrence.occurrenceId)) errors.push(`重复教材条目 ID: ${occurrence.occurrenceId}`);
  occurrenceIds.add(occurrence.occurrenceId);
  if (occurrence.lemma !== occurrence.lemma.toLowerCase()) errors.push(`教材 lemma 不是小写: ${occurrence.occurrenceId}`);
  if (!Number.isInteger(occurrence.referencePage) || occurrence.referencePage < 1) errors.push(`教材来源页错误: ${occurrence.occurrenceId}`);
}
for (const item of allItems) {
  if (ids.has(item.id)) errors.push(`重复题目 ID: ${item.id}`);
  ids.add(item.id);
  if (!item.answer) errors.push(`缺少答案: ${item.id}`);
  if (!["4-5", "6-7", "8-9", "10+"].includes(item.lengthBand)) errors.push(`长度分档错误: ${item.id}`);
  if (["spelling", "wordForm"].includes(item.type) && item.answer.length !== item.length) errors.push(`长度不一致: ${item.id}`);
  if (item.group === "core") {
    if (!item.curriculum) errors.push(`缺少教材映射: ${item.id}`);
    else {
      if (![3, 4, 5, 6].includes(item.curriculum.grade)) errors.push(`教材年级错误: ${item.id}`);
      if (!["上", "下"].includes(item.curriculum.semester)) errors.push(`教材册次错误: ${item.id}`);
      if (!Number.isInteger(item.curriculum.unit)) errors.push(`教材单元错误: ${item.id}`);
      if (item.lemma !== item.curriculum.lemma) errors.push(`教材 lemma 不一致: ${item.id}`);
      if (!occurrenceIds.has(item.curriculum.occurrenceId)) errors.push(`教材条目不存在: ${item.id}`);
      if (!curriculumSource(item.curriculum.sourceId)?.url) errors.push(`教材来源错误: ${item.id}`);
    }
  }
}

for (const [band, words] of Object.entries(novelCandidates)) {
  if (words.length < 3) errors.push(`${band} 新词候选不足 3 个`);
}

for (const word of allAudioWords()) {
  try { await access(path.resolve("assets/audio", `${word}.mp3`)); }
  catch { errors.push(`缺少音频: ${word}.mp3`); }
}

const serviceWorker = await readFile("sw.js", "utf8");
for (const word of summerTrainingWords) {
  const expectedImage = `./assets/memory/${word.word}.jpg`;
  const card = memoryCardFor(word.word);
  if (card.image !== expectedImage) errors.push(`记忆卡图片映射错误: ${word.word}`);
  if (!serviceWorker.includes(expectedImage)) errors.push(`Service Worker 缺少记忆图: ${word.word}.jpg`);
  try { await access(path.resolve("assets/memory", `${word.word}.jpg`)); }
  catch { errors.push(`缺少记忆图: ${word.word}.jpg`); }
}
if (!serviceWorker.includes(`minnie-diagnostic-data-v${DATASET_VERSION}`)) errors.push("Service Worker 缓存版本未与题库版本同步");
for (const asset of ["./src/curriculum.js", "./src/state-version.js", "./src/memory-cards.js", "./src/summer-training.js", "./assets/audio/index.json"]) {
  if (!serviceWorker.includes(asset)) errors.push(`Service Worker 缺少资源: ${asset}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const coreCount = allItems.filter((item) => item.group === "core").length;
  console.log(`数据校验通过：${allItems.length} 道题，${coreCount} 道教材题均有册次与单元映射，${allAudioWords().length} 个英式音频。`);
}
