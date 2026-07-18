export const MASTERY_THRESHOLDS = {
  meaning: 0.9,
  audio: 0.85,
  spelling: 0.85,
  longSpelling: 0.75,
  delayed: 0.7,
};

export function normaliseAnswer(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function evaluateSpelling(expectedValue, actualValue) {
  const expected = normaliseAnswer(expectedValue).replace(/[^a-z]/g, "");
  const actual = normaliseAnswer(actualValue).replace(/[^a-z]/g, "");
  const distance = levenshtein(expected, actual);
  const errorTypes = [];

  if (actual.length < expected.length) errorTypes.push("missing");
  if (actual.length > expected.length) errorTypes.push("extra");
  if (isAdjacentTransposition(expected, actual)) errorTypes.push("transposition");
  if (hasDoubleLetterError(expected, actual)) errorTypes.push("double-letter");
  if (!sameEnding(expected, actual)) errorTypes.push("ending");
  if (expected !== actual && errorTypes.length === 0) errorTypes.push("substitution");

  return {
    correct: expected === actual,
    letterAccuracy: expected.length ? Math.max(0, expected.length - distance) / expected.length : 0,
    distance,
    errorTypes,
    errorPositions: differingPositions(expected, actual),
  };
}

export function scoreAttempt(item, attempt) {
  if (!attempt || attempt.unknown) {
    return { correct: false, eligibleForLength: false, letterAccuracy: 0, errorTypes: ["unknown"] };
  }

  if (["spelling", "immediate", "delayed", "wordForm"].includes(item.type)) {
    return { ...evaluateSpelling(item.answer, attempt.response), eligibleForLength: item.group !== "novel" };
  }

  const correct = normaliseAnswer(item.answer) === normaliseAnswer(attempt.response);
  return { correct, eligibleForLength: false, letterAccuracy: correct ? 1 : 0, errorTypes: correct ? [] : ["choice"] };
}

export function generateReport({ items, attempts, novelWordIds = [], excludedWordIds = [], delayedIntervalMs = null }) {
  const attemptMap = new Map(attempts.map((attempt) => [attempt.itemId, attempt]));
  const results = items
    .filter((item) => attemptMap.has(item.id))
    .map((item) => {
      const attempt = attemptMap.get(item.id);
      return { item, attempt, score: scoreAttempt(item, attempt) };
    });

  const metrics = {
    meaning: metric(results.filter(({ item }) => item.type === "meaning")),
    audio: metric(results.filter(({ item }) => item.type === "audio")),
    spelling: metric(results.filter(({ item }) => ["spelling", "wordForm"].includes(item.type))),
    longSpelling: metric(results.filter(({ item }) => ["spelling", "wordForm"].includes(item.type) && ["8-9", "10+"].includes(item.lengthBand))),
    immediate: metric(results.filter(({ item }) => item.type === "immediate")),
    delayed: metric(results.filter(({ item }) => item.type === "delayed" && novelWordIds.includes(item.wordId))),
  };

  const lengthBands = Object.fromEntries(["4-5", "6-7", "8-9", "10+"].map((band) => {
    const eligible = results.filter(({ item, score }) =>
      ["spelling", "wordForm"].includes(item.type) && item.lengthBand === band && score.eligibleForLength
    );
    return [band, { ...metric(eligible), eligible: eligible.length }];
  }));

  const patterns = Object.fromEntries(["regular", "compound", "irregular", "word-form"].map((pattern) => {
    return [pattern, metric(results.filter(({ item }) =>
      ["spelling", "wordForm"].includes(item.type) && item.pattern === pattern
    ))];
  }));

  const failedMetrics = Object.entries(MASTERY_THRESHOLDS)
    .filter(([key, threshold]) => metrics[key].total > 0 && metrics[key].value < threshold)
    .map(([key]) => key);
  const allRequiredPresent = Object.keys(MASTERY_THRESHOLDS).every((key) => metrics[key].total > 0);
  const passed = allRequiredPresent && failedMetrics.length === 0;
  const unknownCount = results.filter(({ item, attempt }) => item.group === "core" && attempt.unknown).length;
  const errorTypes = countErrorTypes(results);
  const errorLocations = countErrorLocations(results);
  const personalThreshold = detectPersonalThreshold(lengthBands);

  const challengeRows = results
    .filter(({ item, score, attempt }) =>
      !["practice", "meaning", "audio"].includes(item.type) && (!score.correct || attempt.unknown)
    )
    .map(({ item, score, attempt }) => ({
      itemId: item.id,
      wordId: item.wordId,
      word: item.answer,
      meaning: item.meaning,
      lengthBand: item.lengthBand,
      unknown: Boolean(attempt.unknown),
      errors: score.errorTypes,
      phases: [item.type],
      priority: challengePriority(item, attempt, score, personalThreshold),
      excluded: excludedWordIds.includes(item.wordId),
    }));
  const challengeWords = aggregateChallenges(challengeRows);

  return {
    verdict: {
      passed,
      label: passed ? "小学常见词汇拼写抽测初步达标" : "小学常见词汇拼写抽测暂未达标",
      failedMetrics,
      caveat: "这是家庭学习诊断，不代表听力、语法、阅读、写作等小学英语整体水平。",
    },
    metrics,
    lengthBands,
    patterns,
    personalThreshold,
    gaps: { unknownCount },
    errorTypes,
    errorLocations,
    challengeWords,
    sampleSize: results.length,
    delayedIntervalMs,
    generatedAt: Date.now(),
  };
}

function metric(rows) {
  const total = rows.length;
  const correct = rows.filter(({ score }) => score.correct).length;
  return { correct, total, value: total ? correct / total : 0 };
}

function countErrorTypes(results) {
  const counts = {};
  for (const { score } of results) {
    if (score.correct) continue;
    for (const type of score.errorTypes) counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

function countErrorLocations(results) {
  const counts = { beginning: 0, middle: 0, ending: 0 };
  for (const { item, score } of results) {
    if (score.correct || !score.errorPositions?.length) continue;
    const length = Math.max(1, item.answer.length);
    for (const position of score.errorPositions) {
      const ratio = position / length;
      if (ratio < 0.34) counts.beginning += 1;
      else if (ratio < 0.67) counts.middle += 1;
      else counts.ending += 1;
    }
  }
  return counts;
}

function aggregateChallenges(rows) {
  const aggregated = new Map();
  for (const row of rows) {
    const existing = aggregated.get(row.wordId);
    if (!existing) {
      aggregated.set(row.wordId, row);
      continue;
    }
    existing.unknown ||= row.unknown;
    existing.errors = [...new Set([...existing.errors, ...row.errors])];
    existing.phases = [...new Set([...existing.phases, ...row.phases])];
    existing.priority = Math.max(existing.priority, row.priority);
    existing.excluded ||= row.excluded;
  }
  return [...aggregated.values()].sort((a, b) => b.priority - a.priority);
}

function detectPersonalThreshold(lengthBands) {
  const ordered = ["4-5", "6-7", "8-9", "10+"];
  let previous = null;
  for (const band of ordered) {
    const current = lengthBands[band];
    if (current.eligible < 2) continue;
    const accuracyDrop = previous !== null && previous - current.value >= 0.2;
    if (current.value < 0.7 && (accuracyDrop || band === "10+")) return band;
    previous = current.value;
  }
  return null;
}

function challengePriority(item, attempt, score, threshold) {
  const bandWeights = { "4-5": 1, "6-7": 2, "8-9": 3, "10+": 4 };
  let priority = bandWeights[item.lengthBand] ?? 1;
  if (attempt.unknown) priority += 4;
  if (item.core) priority += 3;
  if (threshold && bandWeights[item.lengthBand] >= bandWeights[threshold]) priority += 2;
  if (score.errorTypes.includes("transposition") || score.errorTypes.includes("missing")) priority += 1;
  return priority;
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return matrix[a.length][b.length];
}

function isAdjacentTransposition(expected, actual) {
  if (expected.length !== actual.length || expected === actual) return false;
  const differences = [];
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] !== actual[index]) differences.push(index);
  }
  return differences.length === 2 && differences[1] === differences[0] + 1 &&
    expected[differences[0]] === actual[differences[1]] && expected[differences[1]] === actual[differences[0]];
}

function hasDoubleLetterError(expected, actual) {
  const expectedDoubles = expected.match(/([a-z])\1/g) ?? [];
  const actualDoubles = actual.match(/([a-z])\1/g) ?? [];
  return expectedDoubles.join(",") !== actualDoubles.join(",");
}

function sameEnding(expected, actual) {
  const length = Math.min(3, expected.length, actual.length);
  return expected.slice(-length) === actual.slice(-length);
}

function differingPositions(expected, actual) {
  const rows = expected.length + 1;
  const columns = actual.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(columns).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < columns; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1),
      );
    }
  }
  const positions = [];
  let i = expected.length;
  let j = actual.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === actual[j - 1]) { i -= 1; j -= 1; continue; }
    if (i > 0 && j > 0 && matrix[i][j] === matrix[i - 1][j - 1] + 1) {
      positions.push(i - 1); i -= 1; j -= 1; continue;
    }
    if (i > 0 && matrix[i][j] === matrix[i - 1][j] + 1) {
      positions.push(i - 1); i -= 1; continue;
    }
    if (j > 0) { positions.push(Math.min(i, Math.max(0, expected.length - 1))); j -= 1; }
  }
  return [...new Set(positions)].sort((a, b) => a - b);
}
