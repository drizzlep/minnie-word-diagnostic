import { exams, practiceItems, novelCandidates, buildNovelItems, selectNovelCandidate, SOURCE_LABEL, DATASET_VERSION } from "./data.js";
import { CURRICULUM_SOURCES } from "./curriculum.js";
import { generateReport, scoreAttempt } from "./diagnostic.js";
import { memoryCardFor, rescueWordIds } from "./memory-cards.js";
import { loadState, saveState } from "./storage.js";
import { storedStateStatus } from "./state-version.js";
import { buildTrainingQueue, countDueWords, nextDueAt, summerTrainingWords, SUMMER_TRAINING_EDITION, SUMMER_TRAINING_SOURCE_NOTE, TRAINING_SESSION_SIZE } from "./summer-training.js";

const app = document.querySelector("#app");
const SECOND_DAY_MIN_MS = 18 * 60 * 60 * 1000;
const SECOND_DAY_IDEAL_MS = 24 * 60 * 60 * 1000;
const SECOND_DAY_MAX_MS = 36 * 60 * 60 * 1000;
const LEARNING_SECONDS = 20;
const TYPE_LABELS = {
  meaning: "看词选义",
  audio: "听音选词",
  spelling: "看中文拼英文",
  wordForm: "词形拼写",
  immediate: "新词立即回忆",
  delayed: "新词隔天回忆",
};
const METRIC_LABELS = {
  meaning: "看词知义",
  audio: "听音识词",
  spelling: "核心词拼写",
  longSpelling: "8字母以上拼写",
  immediate: "新词立即记忆",
  delayed: "新词隔天保持",
};
const ERROR_LABELS = {
  missing: "漏字母",
  extra: "多字母",
  transposition: "字母错序",
  "double-letter": "双写错误",
  ending: "词尾错误",
  substitution: "字母替换",
  unknown: "完全没印象",
  choice: "识别错误",
};

let legacyState = null;
let state = await initialiseState();
let currentInput = "";
let questionStartedAt = Date.now();
let feedback = null;
let deferredInstallPrompt = null;
let countdownTimer = null;
let questionTimer = null;
let activeQuestionId = null;
let submitting = false;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const button = document.querySelector("#install-button");
  button.hidden = false;
});
document.querySelector("#install-button").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.querySelector("#install-button").hidden = true;
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});

app.addEventListener("click", handleClick);
render();

async function initialiseState() {
  const saved = await loadState();
  const status = storedStateStatus(saved, DATASET_VERSION);
  if (status === "current") return normaliseState(saved);
  if (status === "legacy") {
    legacyState = saved;
    return { ...freshState(), screen: "dataset-update" };
  }
  return freshState();
}

function normaliseState(saved) {
  const trainingStage = ["learn", "spell", "review"].includes(saved.trainingStage) ? saved.trainingStage : "learn";
  return {
    ...freshState(),
    ...saved,
    rescueWordIds: saved.rescueWordIds ?? [],
    rescueAttempts: saved.rescueAttempts ?? [],
    rescueStars: saved.rescueStars ?? 0,
    trainingWordState: saved.trainingWordState ?? {},
    trainingQueue: saved.trainingQueue ?? [],
    trainingIndex: saved.trainingIndex ?? 0,
    // Old in-progress sessions had no teaching stage; restart them safely at
    // the memory lesson instead of restoring an answer beside the prompt.
    trainingAnswer: trainingStage === "spell" ? (saved.trainingAnswer ?? "") : "",
    trainingFeedback: saved.trainingFeedback ?? null,
    trainingStage,
    trainingGuesses: saved.trainingGuesses ?? [],
    trainingSessionDate: saved.trainingSessionDate ?? null,
    trainingSessionStartedAt: saved.trainingSessionStartedAt ?? null,
    trainingSessionCompletedAt: saved.trainingSessionCompletedAt ?? null,
  };
}

function freshState() {
  return {
    version: DATASET_VERSION,
    screen: "welcome",
    form: "A",
    practiceIndex: 0,
    practiceAttempts: [],
    day1Index: 0,
    day2Index: 0,
    attempts: [],
    novelWords: [],
    novelLearningIndex: 0,
    immediateIndex: 0,
    delayedIndex: 0,
    day1CompletedAt: null,
    day2StartedAt: null,
    excludedItemIds: [],
    rescueWordIds: [],
    rescueIndex: 0,
    rescueStage: "clue",
    rescueAttempts: [],
    rescueStars: 0,
    completedAt: null,
    trainingWordState: {},
    trainingQueue: [],
    trainingIndex: 0,
    trainingAnswer: "",
    trainingFeedback: null,
    trainingStage: "learn",
    trainingGuesses: [],
    trainingSessionDate: null,
    trainingSessionStartedAt: null,
    trainingSessionCompletedAt: null,
  };
}

function render() {
  stopCountdown();
  if (questionTimer) window.clearTimeout(questionTimer);
  switch (state.screen) {
    case "welcome": renderWelcome(); break;
    case "dataset-update": renderDatasetUpdate(); break;
    case "practice": renderQuestion(practiceItems[state.practiceIndex], state.practiceIndex, practiceItems.length, "练习"); break;
    case "practice-complete": renderWarmupComplete(); break;
    case "day1": renderQuestion(exams[state.form].day1[state.day1Index], state.day1Index, exams[state.form].day1.length, "第一天 · 基础筛查"); break;
    case "novel-intro": renderNovelIntro(); break;
    case "novel-select": renderNovelSelect(); break;
    case "novel-learn": renderNovelLearning(); break;
    case "immediate": renderQuestion(immediateItems()[state.immediateIndex], state.immediateIndex, immediateItems().length, "第一天 · 新词立即回忆"); break;
    case "waiting": renderWaiting(); break;
    case "day2-intro": renderDay2Intro(); break;
    case "delayed": renderQuestion(delayedItems()[state.delayedIndex], state.delayedIndex, delayedItems().length, recallSectionLabel()); break;
    case "rescue-intro": renderRescueIntro(); break;
    case "rescue": renderMemoryRescue(); break;
    case "rescue-complete": renderRescueComplete(); break;
    case "day2": renderQuestion(exams[state.form].day2[state.day2Index], state.day2Index, exams[state.form].day2.length, "第二天 · 长词定位"); break;
    case "report": renderReport(); break;
    case "training-home": renderTrainingHome(); break;
    case "training": renderTraining(); break;
    case "training-done": renderTrainingDone(); break;
    default: renderWelcome();
  }
  const nextItem = currentItem();
  if (nextItem?.id !== activeQuestionId) {
    activeQuestionId = nextItem?.id ?? null;
    questionStartedAt = Date.now();
  }
  app.focus({ preventScroll: true });
}

function renderDatasetUpdate() {
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">题库已更新</p>
      <h2>旧测试进度仍然保留</h2>
      <p class="lead">教材题已改为广州教科版（三年级起点）的教材词表抽样。旧题与新题不同，不能安全接着计分；请先导出旧进度，再开始新版测试。</p>
      <div class="action-row">
        <button class="secondary-button" data-action="export-legacy">导出旧进度</button>
        <button class="primary-button" data-action="start-updated">开始新版测试</button>
      </div>
      <div class="notice" style="margin-top:20px">只有点击“开始新版测试”后，旧进度才会从本机替换。</div>
    </section>`;
}

function renderWelcome() {
  const resumed = state.screen !== "welcome" || state.day1Index > 0 || state.practiceIndex > 0;
  app.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Two-day word check</p>
        <h1>长一点，<br>到底难在哪？</h1>
        <p class="lead">用两次短测试，找出米妮已经会的词、需要补的基础，以及真正开始变难的单词长度。不会从头重学，也不会在测试时展示谐音提示。</p>
        <div class="action-row">
          <button class="primary-button" data-action="start">${resumed ? "继续上次测试" : "开始第一天"}</button>
          <button class="secondary-button" data-action="explain">先看测试说明</button>
          <button class="quiet-button" data-action="open-training">暑假训练</button>
        </div>
        <ul class="facts">
          <li><strong>两次完成</strong>每次约 10–15 分钟，间隔一天。</li>
          <li><strong>独立作答</strong>不强制限时，不会就选“没印象”。</li>
          <li><strong>教材来源已记录</strong>小学诊断与初一暑假训练分开保存，开学可校准。</li>
        </ul>
      </div>
      <div class="length-ruler" aria-label="单词长度分组">
        <div><strong>4–5</strong><span>短词基准</span></div>
        <div><strong>6–7</strong><span>中等长度</span></div>
        <div><strong>8–9</strong><span>长词观察</span></div>
        <div><strong>10+</strong><span>超长词观察</span></div>
      </div>
    </section>`;
}


function renderTrainingHome() {
  const completed = Object.values(state.trainingWordState).filter((item) => item.mastery >= 2).length;
  const due = countDueWords(state.trainingWordState, Date.now());
  const unseen = summerTrainingWords.filter((item) => !state.trainingWordState[item.wordId]?.attempts).length;
  const activeToday = state.trainingSessionDate === localDateStamp() && state.trainingQueue.length > 0 && state.trainingIndex < state.trainingQueue.length;
  const completedToday = state.trainingSessionDate === localDateStamp() && Boolean(state.trainingSessionCompletedAt);
  app.innerHTML = `
    <section class="panel training-hero">
      <p class="eyebrow">暑假正式训练 · ${SUMMER_TRAINING_EDITION}</p>
      <h2>每天 8 个词，先赢一小关</h2>
      <p class="lead">不用等开学拿到课本。先练广州地区新版沪教牛津七上与小学高频词的共同核心；开学后只做增删校准，不会推翻已经记住的词。</p>
      <div class="training-stats"><div><strong>${completed}</strong><span>已稳住</span></div><div><strong>${summerTrainingWords.length}</strong><span>暑假候选</span></div><div><strong>${due}</strong><span>到期复习</span></div></div>
      <div class="notice">${SUMMER_TRAINING_SOURCE_NOTE}</div>
      <div class="action-row"><button class="primary-button" data-action="start-training" ${completedToday ? "disabled" : ""}>${completedToday ? "今天已完成 8 词" : activeToday ? "继续今天的训练" : "开始今天的 8 词训练"}</button><button class="secondary-button" data-action="home">回到诊断</button></div>
      ${completedToday ? `<p class="question-hint">还剩 ${unseen} 个候选新词。明天再来，系统会先安排到期复习。</p>` : ""}
    </section>
    <section class="panel"><h3>训练规则</h3><div class="bar-list"><div class="bar-row"><span>新词</span><div class="bar"><span style="width:75%"></span></div><strong>最多8个新词</strong></div><div class="bar-row"><span>复习</span><div class="bar"><span style="width:25%"></span></div><strong>最多2个复习</strong></div></div><p class="question-hint">每词先看英式发音和谐音/词块线索，再用小写字母拼写；答对后按 1、2、4、7、14 天复习。答错不会扣分，明天还会回来。</p></section>`;
}

function renderTraining() {
  const item = trainingItem();
  if (!item) { state.screen = "training-done"; persistAndRender(); return; }
  const progress = state.trainingIndex / state.trainingQueue.length * 100;
  const card = memoryCardFor(item.word);
  const feedbackHtml = state.trainingFeedback ? `<div class="feedback ${state.trainingFeedback.kind}">${escapeHtml(state.trainingFeedback.message)}</div>` : "";
  const imageHtml = card.image ? `<div class="memory-image-wrap"><img class="memory-image" src="${escapeHtml(card.image)}" alt="${escapeHtml(item.meaning)}的记忆图" loading="lazy"></div>` : "";
  const memoryHtml = `${imageHtml}<div class="mnemonic-story">💡 ${escapeHtml(card.mnemonic)}</div><div class="word-chunks">${card.chunks.map((chunk) => `<span>${escapeHtml(chunk)}</span>`).join("")}</div>`;
  const isLearning = state.trainingStage === "learn";
  const isReview = state.trainingStage === "review";
  const isSpell = state.trainingStage === "spell";
  const stageHeader = isSpell
    ? `<div class="training-word-row"><div><div class="learning-meaning">${item.meaning}</div><div class="question-hint">回想刚才的画面和词块</div></div><button class="audio-button" data-action="play-audio" data-word="${item.word}">听发音</button></div>`
    : `<div class="training-word-row"><div><div class="learning-word">${item.word}</div><div class="learning-meaning">${item.meaning}</div></div><button class="audio-button" data-action="play-audio" data-word="${item.word}">听发音</button></div>`;
  let body = "";
  if (isLearning) {
    body = `${memoryHtml}<p class="question-label">先用图像和谐音记住它，再开始拼写</p><p class="question-hint">先观察图片，把声音、画面和词块连起来。这里不是考试。</p><button class="primary-button" data-action="training-start-spelling">记住了，开始拼写</button>`;
  } else if (isReview) {
    body = `${memoryHtml}${feedbackHtml}<p class="question-label">重新看一遍记忆法，再开始拼写</p><button class="primary-button" data-action="training-start-spelling">看完了，再试一次</button><div class="unknown-row"><button class="quiet-button" data-action="training-skip">今天先跳过</button></div>`;
  } else {
    body = `<p class="question-label">现在不用看答案，拼出这个词（小写）</p><div class="spelling-display ${state.trainingAnswer ? "" : "placeholder"}">${state.trainingAnswer ? escapeHtml(state.trainingAnswer) : "用下面的小写字母键盘输入"}</div>${trainingKeyboard()}${feedbackHtml}<div class="unknown-row"><button class="quiet-button" data-action="training-hint">我又忘了，再看记忆法</button><button class="quiet-button" data-action="training-skip">今天先跳过</button></div>`;
  }
  app.innerHTML = `<section class="panel question-card training-card">
    <div class="progress-meta"><span>暑假训练 · ${item.theme}</span><span>${state.trainingIndex + 1} / ${state.trainingQueue.length}</span></div>
    <div class="progress-track"><span style="width:${progress}%"></span></div>
    ${stageHeader}
    ${body}
  </section>`;
}

function trainingKeyboard() {
  return `<div class="letter-keyboard" aria-label="小写字母键盘">${"abcdefghijklmnopqrstuvwxyz".split("").map((letter) => `<button class="key" data-action="training-letter" data-value="${letter}">${letter}</button>`).join("")}<button class="key wide" data-action="training-backspace">删除</button><button class="key submit" data-action="training-submit" ${state.trainingAnswer ? "" : "disabled"}>提交</button></div>`;
}

function renderTrainingDone() {
  const completed = state.trainingQueue.length;
  app.innerHTML = `<section class="panel quest-panel"><div class="quest-badge large"><span>★</span><strong>今日训练完成</strong><small>不和别人比，只和昨天的自己比</small></div><h2>你完成了 ${completed} 个词！</h2><p class="lead">今天的成绩已经保存在这台设备上。明天打开“暑假训练”，系统会优先安排到期复习，再给少量新词。</p><div class="action-row"><button class="primary-button" data-action="open-training">查看训练进度</button><button class="secondary-button" data-action="home">回到诊断</button><button class="quiet-button" data-action="export-training">导出训练进度</button></div></section>`;
}

function trainingItem() { return summerTrainingWords.find((item) => item.wordId === state.trainingQueue[state.trainingIndex]); }

function startTraining() {
  const today = localDateStamp();
  if (state.trainingSessionDate === today && state.trainingSessionCompletedAt) {
    state.screen = "training-done";
    persistAndRender();
    return;
  }
  // Keep the saved queue while today's session is active so a refresh or
  // leaving the screen cannot replace unfinished words with a new queue.
  if (state.trainingSessionDate === today && state.trainingQueue.length && state.trainingIndex < state.trainingQueue.length) {
    state.screen = "training";
    persistAndRender();
    return;
  }
  state.trainingQueue = buildTrainingQueue(state.trainingWordState, Date.now(), TRAINING_SESSION_SIZE).map((item) => item.wordId);
  state.trainingIndex = 0;
  state.trainingAnswer = "";
  state.trainingFeedback = null;
  state.trainingStage = "learn";
  state.trainingSessionStartedAt = Date.now();
  state.trainingSessionDate = today;
  state.trainingSessionCompletedAt = null;
  state.trainingGuesses = [];
  state.screen = state.trainingQueue.length ? "training" : "training-done";
  persistAndRender();
}

async function submitTraining() {
  const item = trainingItem();
  if (!item || !state.trainingAnswer || submitting) return;
  submitting = true;
  const answer = state.trainingAnswer.toLowerCase();
  const correct = answer === item.word;
  state.trainingGuesses.push({ wordId: item.wordId, response: answer, correct, createdAt: Date.now() });
  const old = state.trainingWordState[item.wordId] ?? { box: 0, mastery: 0, attempts: 0 };
  if (correct) {
    state.trainingWordState[item.wordId] = { ...old, attempts: old.attempts + 1, correct: (old.correct ?? 0) + 1, mastery: Math.min(2, old.mastery + 1), box: Math.min(4, old.box + 1), lastAttemptAt: Date.now(), dueAt: nextDueAt(old.box, true, Date.now()) };
    state.trainingIndex += 1;
    state.trainingAnswer = "";
    state.trainingFeedback = null;
    state.trainingStage = "learn";
    if (state.trainingIndex >= state.trainingQueue.length) { state.trainingSessionCompletedAt = Date.now(); state.screen = "training-done"; }
  } else {
    state.trainingAnswer = "";
    state.trainingStage = "review";
    state.trainingFeedback = { kind: "try", message: "这次先不继续猜。请重新看上面的图像、谐音和词块，再开始下一次拼写。" };
  }
  document.querySelectorAll(".training-card button").forEach((button) => { button.disabled = true; });
  try {
    await saveState(state);
  } finally {
    submitting = false;
    render();
  }
}

async function skipTraining() {
  const item = trainingItem();
  if (!item || submitting) return;
  submitting = true;
  document.querySelectorAll(".training-card button").forEach((button) => { button.disabled = true; });
  const now = Date.now();
  const old = state.trainingWordState[item.wordId] ?? { box: 0, mastery: 0, attempts: 0 };
  state.trainingGuesses.push({ wordId: item.wordId, response: "", correct: false, skipped: true, createdAt: now });
  state.trainingWordState[item.wordId] = { ...old, attempts: old.attempts + 1, correct: old.correct ?? 0, mastery: 0, box: 0, lastAttemptAt: now, dueAt: nextDueAt(0, false, now) };
  state.trainingIndex += 1;
  state.trainingAnswer = "";
  state.trainingFeedback = null;
  if (state.trainingIndex >= state.trainingQueue.length) { state.trainingSessionCompletedAt = now; state.screen = "training-done"; }
  try {
    await saveState(state);
  } finally {
    submitting = false;
    render();
  }
}

function renderExplanation() {
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">测试说明</p>
      <h2>第一次不公布答案</h2>
      <p class="lead">第一天会做基础题，并学习 8 个没有谐音提示的新词。第二天先回忆这些新词，再做另一组熟词。全部完成后才开放完整报告，避免答案影响隔天记忆。</p>
      <div class="notice">正式测试请由米妮独立完成。遇到完全陌生的词，直接选择“没印象”，不要猜是不是学过。</div>
      <div class="action-row">
        <button class="primary-button" data-action="start">我知道了，开始练习</button>
        <button class="quiet-button" data-action="home">返回</button>
      </div>
    </section>`;
}

function renderQuestion(item, index, total, sectionLabel) {
  if (!item) return advanceAfterQuestionSection();
  const percentage = Math.round((index / total) * 100);
  const common = `
    ${effortHud(index, total, sectionLabel)}
    <div class="progress-meta"><span>${sectionLabel}</span><span>${index + 1} / ${total}</span></div>
    <div class="progress-track"><span style="width:${percentage}%"></span></div>`;

  let questionBody = "";
  if (item.type === "meaning") {
    questionBody = `
      <p class="question-label">这个词最常用的意思是？</p>
      <div class="question-word">${escapeHtml(item.word)}</div>
      ${choiceButtons(item.choices)}
      <div class="unknown-row"><button class="quiet-button" data-action="unknown">完全没印象</button></div>`;
  } else if (item.type === "audio") {
    questionBody = `
      <p class="question-label">听发音，选出正确的单词</p>
      <button class="audio-button" data-action="play-audio" data-word="${item.word}">播放英式发音</button>
      ${choiceButtons(item.choices)}
      <div class="unknown-row"><button class="quiet-button" data-action="unknown">完全没印象</button></div>`;
  } else {
    const label = item.type === "wordForm" ? "请写出正确词形" : item.type === "delayed" ? "还记得昨天的这个新词吗？" : "请拼出这个单词";
    questionBody = `
      <p class="question-label">${label}</p>
      <div class="question-prompt">${escapeHtml(item.prompt || item.meaning)}</div>
      <div class="spelling-display ${currentInput ? "" : "placeholder"}">${currentInput ? escapeHtml(currentInput) : "用下面的字母键盘输入"}</div>
      ${keyboard()}
      <div class="unknown-row">
        <button class="quiet-button" data-action="unknown">完全没印象</button>
        <button class="quiet-button" data-action="skip">跳过</button>
      </div>`;
  }

  app.innerHTML = `
    <section class="panel question-card">
      ${common}
      ${questionBody}
      ${feedback ? `<div class="feedback ${feedback.kind}">${feedback.message}</div>` : ""}
    </section>`;
  startQuestionHintTimer();
}

function effortHud(index, total, sectionLabel) {
  const label = sectionLabel === "练习" ? "热身能量" : sectionLabel.includes("隔天") ? "记忆勇气" : sectionLabel.includes("第二天") ? "最后冲刺" : "探索能量";
  return `<div class="effort-hud"><span>⚡ ${index}</span><small>${label} · 完成就会增长，不按对错扣除</small><strong>${index} / ${total}</strong></div>`;
}

function renderWarmupComplete() {
  app.innerHTML = `
    <section class="panel quest-panel">
      <div class="quest-badge large"><span>★</span><strong>热身达人</strong><small>听音、选择和小写键盘都已解锁</small></div>
      <h2>操作全会了，第一枚徽章到手！</h2>
      <p class="lead">正式挑战不扣命，也不会公开比较分数。每完成一题，探索能量都会增加。</p>
      <div class="action-row"><button class="primary-button" data-action="begin-day1">带着徽章出发</button></div>
    </section>`;
}

function choiceButtons(choices) {
  return `<div class="choice-grid">${choices.map((choice) => `<button class="choice-button" data-action="choose" data-value="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`).join("")}</div>`;
}

function keyboard() {
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  return `<div class="letter-keyboard" aria-label="字母键盘">
    ${letters.map((letter) => `<button class="key" data-action="letter" data-value="${letter}">${letter}</button>`).join("")}
    <button class="key wide" data-action="backspace">删除</button>
    <button class="key submit" data-action="submit-spelling" ${currentInput ? "" : "disabled"}>${state.screen === "rescue" ? "挑战" : "提交"}</button>
  </div>`;
}

function renderNovelIntro() {
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">第一天 · 第二部分</p>
      <h2>接下来学习 8 个新词</h2>
      <p class="lead">每个长度选 2 个真实单词。学习时只看单词、中文义和英式发音，不提供谐音、拆分或图片。每个词有 20 秒。</p>
      <div class="notice">看到认识的词，请一定点“这个词我认识”。系统会换一个，保证测试的是现场学习能力。</div>
      <div class="action-row"><button class="primary-button" data-action="begin-novel-select">开始选择新词</button></div>
    </section>`;
}

function renderNovelSelect() {
  const band = ["4-5", "6-7", "8-9", "10+"][Math.floor(state.novelWords.length / 2)];
  if (!band) return finishNovelSelection();
  const pickedInBand = state.novelWords.filter((word) => word.lengthBand === band).map((word) => word.wordId);
  const rejected = state.rejectedNovelWords ?? [];
  const candidate = selectNovelCandidate(band, pickedInBand, rejected);
  if (!candidate) {
    app.innerHTML = `<section class="panel"><h2>这一档的候选词都认识</h2><p class="lead">这说明这组新词候选不适合继续测。请导出当前进度，之后补充新的真实候选词再继续；系统不会把已经认识的词强行当作新词。</p><div class="action-row"><button class="secondary-button" data-action="export-progress">导出当前进度</button></div></section>`;
    return;
  }
  app.innerHTML = `
    <section class="panel question-card">
      <div class="progress-meta"><span>选择现场新词 · ${band} 个字母</span><span>${state.novelWords.length + 1} / 8</span></div>
      <div class="progress-track"><span style="width:${state.novelWords.length / 8 * 100}%"></span></div>
      <p class="question-label">以前见过或知道这个词吗？</p>
      <div class="question-word">${candidate.word}</div>
      <div class="action-row" style="justify-content:center">
        <button class="primary-button" data-action="novel-unknown" data-word="${candidate.wordId}">不认识，用这个</button>
        <button class="secondary-button" data-action="novel-known" data-word="${candidate.wordId}">我认识，换一个</button>
      </div>
    </section>`;
}

function renderNovelLearning() {
  const word = state.novelWords[state.novelLearningIndex];
  if (!word) return startImmediateRecall();
  let seconds = LEARNING_SECONDS;
  app.innerHTML = `
    <section class="panel learning-card">
      <div class="progress-meta"><span>学习真实新词</span><span>${state.novelLearningIndex + 1} / ${state.novelWords.length}</span></div>
      <div class="progress-track"><span style="width:${state.novelLearningIndex / state.novelWords.length * 100}%"></span></div>
      <p class="question-label">看清拼写，听两遍发音</p>
      <div class="learning-word">${word.word}</div>
      <div class="learning-meaning">${word.meaning}</div>
      <button class="audio-button" data-action="play-audio" data-word="${word.word}">播放英式发音</button>
      <div id="countdown" class="countdown-ring" style="--progress:100%">${seconds}</div>
      <button class="quiet-button" data-action="learn-next" disabled>时间到后继续</button>
    </section>`;
  playAudio(word.word);
  countdownTimer = window.setInterval(() => {
    seconds -= 1;
    const ring = document.querySelector("#countdown");
    if (ring) {
      ring.textContent = seconds;
      ring.style.setProperty("--progress", `${seconds / LEARNING_SECONDS * 100}%`);
    }
    if (seconds <= 0) {
      stopCountdown();
      const button = document.querySelector('[data-action="learn-next"]');
      if (button) { button.disabled = false; button.textContent = "学习下一个"; }
    }
  }, 1000);
}

function renderWaiting() {
  const elapsed = Date.now() - state.day1CompletedAt;
  const remaining = Math.max(0, SECOND_DAY_MIN_MS - elapsed);
  const ready = remaining === 0;
  const outsideIdeal = elapsed > SECOND_DAY_MAX_MS;
  app.innerHTML = `
    <section class="panel">
      <div class="quest-badge" aria-label="第一天挑战完成"><span>★</span><strong>勇气徽章</strong><small>第一天挑战完成</small></div>
      <span class="status-chip">✓ 所有答案都已保存</span>
      <h2 style="margin-top:18px">今天已经闯过第一关</h2>
      <p class="lead">认真完成比答对多少更重要。先让记忆睡一觉，明天先看看还记得什么，再用记忆线索把难词赢回来。</p>
      <div class="quest-path" aria-label="两天挑战进度"><span class="done">1 完成挑战</span><span class="active">2 唤醒记忆</span><span>3 解锁报告</span></div>
      <div class="waiting-clock">${ready ? "可以开始第二天" : formatDuration(remaining)}</div>
      ${!ready ? `<div class="notice">如果希望明天直接进入训练，可以提前完成；${recallMode(Date.now()) === "same-day" ? "这次会标记为“同日保持”" : "这次会标记为“短间隔保持”"}，不能作为24小时隔天保持率。</div>` : ""}
      ${outsideIdeal ? `<div class="notice">已经超过理想的 36 小时间隔。仍然可以继续，报告会保留实际间隔时间。</div>` : ""}
      <div class="action-row">
        <button class="primary-button" data-action="start-day2">${ready ? "开始第二天" : recallMode(Date.now()) === "same-day" ? "今天提前完成第二次" : "提前完成第二次"}</button>
        <button class="secondary-button" data-action="export-progress">导出当前进度</button>
      </div>
    </section>`;
  if (!ready) countdownTimer = window.setInterval(render, 60000);
}

function renderDay2Intro() {
  const hours = Math.round((Date.now() - state.day1CompletedAt) / 360000) / 10;
  const mode = recallMode(state.day2StartedAt);
  const early = mode !== "delayed";
  const recallName = mode === "same-day" ? "同日" : mode === "short" ? "短间隔" : "隔天";
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">Day two</p>
      <div class="quest-score">⭐ 0 <small>今天从零开始，只加星，不扣命</small></div>
      <h2>先唤醒昨天的记忆</h2>
      <p class="lead">已经间隔约 ${hours} 小时。先做8个无提示${recallName}回忆，保留真实结果；然后进入“记忆救援”，用拆分和趣味线索把难词赢回来。</p>
      ${early ? `<div class="notice">本次属于${recallName}保持测试。应用会保留实际间隔，但不会把它解释成24小时隔天记忆，也不参与隔天保持达标判定。</div>` : ""}
      <div class="notice">不会的词不是失败，而是待解锁的关卡。所有题都可以继续，没有红心，也不会扣分退出。</div>
      <div class="action-row"><button class="primary-button" data-action="begin-delayed">开始唤醒记忆</button></div>
    </section>`;
}

function renderRescueIntro() {
  const remembered = delayedItems().filter((item) => state.attempts.find((attempt) => attempt.itemId === item.id)?.analysis?.correct).length;
  app.innerHTML = `
    <section class="panel quest-panel">
      <div class="quest-score">⭐ ${remembered}<small>每一个想起来的词都是一颗星</small></div>
      <p class="eyebrow">记忆救援 · 奖励关</p>
      <h2>${remembered ? `你已经唤醒了 ${remembered} 个词！` : "真正的学习现在才开始！"}</h2>
      <p class="lead">接下来只挑最多4个挑战词。先看拆分和趣味线索，再补词块，最后独立拼写。答错不扣星，只会得到更多提示。</p>
      <div class="quest-path"><span class="done">✓ 无提示记录</span><span class="active">记忆救援</span><span>最后挑战</span></div>
      <div class="action-row"><button class="primary-button" data-action="begin-rescue">开始赚星星</button></div>
    </section>`;
}

function renderMemoryRescue() {
  const word = rescueWords()[state.rescueIndex];
  if (!word) return finishRescue();
  const card = memoryCardFor(word.word);
  const progress = state.rescueIndex / state.rescueWordIds.length * 100;
  const common = `
    <div class="quest-head"><div class="quest-score">⭐ ${state.rescueStars}</div><strong>${state.rescueIndex + 1} / ${state.rescueWordIds.length}</strong></div>
    <div class="progress-track"><span style="width:${progress}%"></span></div>`;

  if (state.rescueStage === "clue") {
    app.innerHTML = `<section class="panel quest-panel">${common}
      <p class="question-label">第1步 · 找到记忆线索</p>
      <div class="learning-word">${word.word}</div>
      <div class="learning-meaning">${word.meaning}</div>
      ${card.image ? `<div class="memory-image-wrap"><img class="memory-image" src="${escapeHtml(card.image)}" alt="${escapeHtml(word.meaning)}的记忆图" loading="lazy"></div>` : ""}
      <div class="word-chunks">${card.chunks.map((chunk) => `<span>${escapeHtml(chunk)}</span>`).join("")}</div>
      <div class="mnemonic-story">💡 ${escapeHtml(card.mnemonic)}</div>
      <button class="audio-button" data-action="play-audio" data-word="${word.word}">播放英式发音</button>
      <div class="action-row"><button class="primary-button" data-action="clue-found">我找到线索了 +1⭐</button></div>
    </section>`;
    return;
  }

  if (state.rescueStage === "chunk") {
    const missing = card.chunks.at(-1);
    const visible = card.chunks.slice(0, -1);
    app.innerHTML = `<section class="panel quest-panel question-card">${common}
      <p class="question-label">第2步 · 补上最后一块</p>
      <div class="chunk-puzzle">${visible.map((chunk) => `<span>${escapeHtml(chunk)}</span>`).join("")}<span class="missing-chunk">?</span></div>
      <p class="question-hint">拼成“${escapeHtml(word.meaning)}”还缺哪一块？</p>
      <div class="chunk-choices">${chunkChoices(missing).map((choice) => `<button class="choice-button" data-action="choose-chunk" data-value="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`).join("")}</div>
      ${feedback ? `<div class="feedback ${feedback.kind}">${feedback.message}</div>` : ""}
    </section>`;
    return;
  }

  if (state.rescueStage === "answer") {
    renderRescueAnswer(word, card, common);
    return;
  }

  app.innerHTML = `<section class="panel quest-panel question-card">${common}
    <p class="question-label">最终挑战 · 自己拼出来</p>
    <div class="question-prompt">${escapeHtml(word.meaning)}</div>
    <div class="spelling-display ${currentInput ? "" : "placeholder"}">${currentInput ? escapeHtml(currentInput) : "你已经拿到线索，试试看"}</div>
    ${keyboard()}
    <div class="unknown-row"><button class="quiet-button" data-action="reveal-rescue-answer">看答案再继续，不扣星</button></div>
    ${feedback ? `<div class="feedback ${feedback.kind}">${feedback.message}</div>` : ""}
  </section>`;
}

function renderRescueAnswer(word, card, common) {
  app.innerHTML = `<section class="panel quest-panel">${common}
    <p class="question-label">先收下答案，下次再独立挑战</p>
    <div class="learning-word">${escapeHtml(word.word)}</div>
    <div class="learning-meaning">${escapeHtml(word.meaning)}</div>
    <div class="word-chunks">${card.chunks.map((chunk) => `<span>${escapeHtml(chunk)}</span>`).join("")}</div>
    <p class="lead">你已经完成了线索和拼图两关，这个词不是零分，只是最后一颗星留到下次。</p>
    <div class="action-row"><button class="primary-button" data-action="continue-rescue-word">收进记忆口袋，继续</button></div>
  </section>`;
}

function renderRescueComplete() {
  app.innerHTML = `
    <section class="panel quest-panel">
      <div class="quest-badge large"><span>★</span><strong>记忆探险家</strong><small>提示不是作弊，是学习工具</small></div>
      <h2>你把难词赢回来了！</h2>
      <div class="final-stars">⭐ ${state.rescueStars}</div>
      <p class="lead">无提示结果仍然保留；这些星星记录的是使用记忆方法后的进步。现在再完成最后一组熟词，就能解锁完整报告。</p>
      <div class="action-row"><button class="primary-button" data-action="continue-day2">继续最后一关</button></div>
    </section>`;
}

function renderReport() {
  const report = buildReport();
  const failed = report.verdict.failedMetrics.map((key) => METRIC_LABELS[key]).join("、");
  const rescuedCount = new Set(state.rescueAttempts.filter((attempt) => attempt.correct).map((attempt) => attempt.wordId)).size;
  app.innerHTML = `
    <section class="panel">
      <div class="report-header">
        <div>
          <p class="eyebrow">完整诊断报告</p>
          <h2>这不是从头再来，<br>而是找准下一步。</h2>
          <p class="question-hint">${SOURCE_LABEL}；正式教材题均记录年级、册次和单元，并以第三方汇总词表核对，不等同于官方教材页。</p>
        </div>
        <div class="verdict ${report.verdict.passed ? "pass" : ""}">
          <strong>${report.verdict.label}</strong>
          <span>${report.verdict.passed ? "已达到本应用设定的家庭学习门槛。" : `当前需要优先提升：${failed || "样本不足"}。`}</span>
        </div>
      </div>
      <div class="metric-grid">
        ${metricCard("看词知义", report.metrics.meaning, 0.9)}
        ${metricCard("听音识词", report.metrics.audio, 0.85)}
        ${metricCard("核心词拼写", report.metrics.spelling, 0.85)}
        ${metricCard("8字母以上", report.metrics.longSpelling, 0.75)}
        ${metricCard("立即记忆", report.metrics.immediate, null)}
        ${metricCard(recallMetricLabel(), report.metrics.delayed, report.delayedEligible ? 0.7 : null)}
      </div>
      <p class="question-hint" style="margin-top:18px">两次测试实际间隔：${formatInterval(report.delayedIntervalMs)}。</p>
      ${report.delayedEligible ? "" : `<p class="question-hint">本次保持率属于提前观察，不参与“隔天保持”达标判定。</p>`}
    </section>
    <section class="panel quest-panel">
      <div class="quest-badge"><span>★</span><strong>记忆救援成果</strong><small>和无提示诊断分开记录</small></div>
      <h3>使用线索后学会 ${rescuedCount} / ${state.rescueWordIds.length || 0} 个挑战词</h3>
      <div class="final-stars">⭐ ${state.rescueStars}</div>
      <p class="question-hint">星星表示完成拆分、词块和独立拼写关卡，不会替代无提示隔天保持率。</p>
    </section>
    <section class="panel">
      <h3>个人长词门槛</h3>
      <p class="lead">${report.personalThreshold ? `从 <strong>${report.personalThreshold} 个字母</strong>这一档开始，正确率出现值得关注的下降。` : "本次样本中没有发现清晰的长度断崖；更可能需要结合拼写规律和具体错词训练。"}</p>
      <div class="bar-list">${Object.entries(report.lengthBands).map(([band, row]) => barRow(`${band} 字母`, row.value, row.total)).join("")}</div>
    </section>
    <section class="panel">
      <h3>困难更像哪一种？</h3>
      <div class="bar-list">
        ${barRow("规则词", report.patterns.regular.value, report.patterns.regular.total)}
        ${barRow("复合词", report.patterns.compound.value, report.patterns.compound.total)}
        ${barRow("不规则词", report.patterns.irregular.value, report.patterns.irregular.total)}
        ${barRow("词形变化", report.patterns["word-form"].value, report.patterns["word-form"].total)}
      </div>
      <p class="question-hint" style="margin-top:18px">主要错误：${formatErrors(report.errorTypes)}。选择“没印象”的教材词有 ${report.gaps.unknownCount} 个，这些计入基础缺口，不用于判断长词门槛。</p>
      <p class="question-hint">错字位置：${formatLocations(report.errorLocations)}。</p>
    </section>
    <section class="panel">
      <h3>优先学习清单</h3>
      <p class="question-hint">系统已按基础重要性、长度和错误类型排序。误触或暂不学习的词可以排除。</p>
      ${report.challengeWords.length ? `<ul class="challenge-list">${report.challengeWords.map(challengeRow).join("")}</ul>` : `<div class="empty">这次没有需要进入优先清单的拼写词。</div>`}
      <div class="action-row">
        <button class="primary-button" data-action="export-report">导出完整报告</button>
        <button class="secondary-button" data-action="print-report">打印 / 存为 PDF</button>
        <button class="secondary-button" data-action="start-b">4–6 周后开始 B 卷</button>
        <button class="danger-button" data-action="reset">清除并重新测试</button>
      </div>
      <div class="notice" style="margin-top:20px">${report.verdict.caveat}。后续谐音图卡只针对清单中的真实薄弱词，不为已经掌握的词重复制作。</div>
    </section>`;
}

async function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, value, word } = button.dataset;
  if (submitting && ["submit-spelling", "unknown", "skip", "choose", "training-submit", "training-skip"].includes(action)) return;
  if (action === "open-training") { state.screen = "training-home"; persistAndRender(); return; }
  if (action === "start-training") { startTraining(); return; }
  if (action === "training-start-spelling") { if (state.trainingStage === "learn" || state.trainingStage === "review") { state.trainingStage = "spell"; state.trainingAnswer = ""; state.trainingFeedback = null; persistAndRender(); } return; }
  if (action === "training-letter") { state.trainingAnswer += value; state.trainingFeedback = null; render(); return; }
  if (action === "training-backspace") { state.trainingAnswer = state.trainingAnswer.slice(0, -1); state.trainingFeedback = null; render(); return; }
  if (action === "training-submit") { submitTraining(); return; }
  if (action === "training-hint") { state.trainingStage = "review"; state.trainingAnswer = ""; state.trainingFeedback = { kind: "try", message: "先看图和谐音，把这个词重新连起来。准备好后再开始拼写。" }; persistAndRender(); return; }
  if (action === "training-skip") { skipTraining(); return; }
  if (action === "export-training") { downloadJson(`米妮暑假训练进度-${dateStamp()}.json`, { app: "米妮单词训练", edition: SUMMER_TRAINING_EDITION, exportedAt: new Date().toISOString(), trainingWordState: state.trainingWordState, trainingGuesses: state.trainingGuesses }); return; }
  if (action === "explain") { renderExplanation(); return; }
  if (action === "export-legacy") {
    downloadJson(`米妮单词诊断-旧版进度-${dateStamp()}.json`, { app: "米妮单词诊断", exportedAt: new Date().toISOString(), legacyState });
    return;
  }
  if (action === "start-updated") {
    if (window.confirm("确认已经保存旧进度，并开始新版教材测试吗？")) {
      legacyState = null;
      state = freshState();
      await saveState(state);
      render();
    }
    return;
  }
  if (action === "home") { state.screen = "welcome"; persistAndRender(); return; }
  if (action === "start") {
    if (state.screen === "welcome") state.screen = state.practiceIndex >= practiceItems.length ? "day1" : "practice";
    persistAndRender(); return;
  }
  if (action === "begin-day1") { state.screen = "day1"; persistAndRender(); return; }
  if (action === "play-audio") { playAudio(word); return; }
  if (action === "letter") { currentInput += value; feedback = null; render(); return; }
  if (action === "backspace") { currentInput = currentInput.slice(0, -1); feedback = null; render(); return; }
  if (action === "submit-spelling") {
    if (state.screen === "rescue") submitRescueSpelling();
    else submitCurrent(currentInput, false);
    return;
  }
  if (action === "unknown") { submitCurrent("", true); return; }
  if (action === "skip") { submitCurrent("", false); return; }
  if (action === "choose") { submitCurrent(value, false); return; }
  if (action === "begin-novel-select") { state.screen = "novel-select"; persistAndRender(); return; }
  if (action === "novel-known") {
    state.rejectedNovelWords = [...(state.rejectedNovelWords ?? []), word];
    persistAndRender(); return;
  }
  if (action === "novel-unknown") {
    const candidate = Object.values(novelCandidates).flat().find((item) => item.wordId === word);
    state.novelWords.push(candidate);
    persistAndRender(); return;
  }
  if (action === "learn-next") { state.novelLearningIndex += 1; persistAndRender(); return; }
  if (action === "start-day2") {
    const elapsed = Date.now() - state.day1CompletedAt;
    const mode = recallMode(Date.now());
    const label = mode === "same-day" ? "同日保持" : "短间隔保持";
    if (elapsed < SECOND_DAY_MIN_MS && !window.confirm(`现在开始会记录为${label}，不能代表24小时隔天记忆。确认提前完成第二次吗？`)) return;
    state.screen = "day2-intro";
    state.day2StartedAt = Date.now();
    persistAndRender(); return;
  }
  if (action === "begin-delayed") { state.screen = "delayed"; persistAndRender(); return; }
  if (action === "begin-rescue") {
    state.rescueWordIds = rescueWordIds(state.novelWords, state.attempts);
    state.rescueIndex = 0;
    state.rescueStage = "clue";
    state.screen = "rescue";
    persistAndRender(); return;
  }
  if (action === "clue-found") {
    if (state.screen !== "rescue" || state.rescueStage !== "clue") return;
    button.disabled = true;
    state.rescueStars += 1;
    state.rescueStage = "chunk";
    feedback = null;
    persistAndRender(); return;
  }
  if (action === "choose-chunk") { handleChunkChoice(value); return; }
  if (action === "reveal-rescue-answer") {
    if (state.screen !== "rescue" || state.rescueStage !== "spell") return;
    state.rescueAttempts.push({ wordId: rescueWords()[state.rescueIndex].wordId, response: currentInput, correct: false, revealed: true, completedAt: Date.now() });
    currentInput = "";
    feedback = null;
    state.rescueStage = "answer";
    persistAndRender(); return;
  }
  if (action === "continue-rescue-word") {
    if (state.screen !== "rescue" || state.rescueStage !== "answer") return;
    advanceRescueWord();
    persistAndRender(); return;
  }
  if (action === "continue-day2") { state.screen = "day2"; persistAndRender(); return; }
  if (action === "toggle-exclude") {
    state.excludedItemIds = state.excludedItemIds.includes(value)
      ? state.excludedItemIds.filter((id) => id !== value)
      : [...state.excludedItemIds, value];
    persistAndRender(); return;
  }
  if (action === "export-progress") { downloadJson(`米妮单词诊断-第一天进度.json`, exportPayload(false)); return; }
  if (action === "export-report") { downloadJson(`米妮单词诊断报告-${dateStamp()}.json`, exportPayload(true)); return; }
  if (action === "print-report") { window.print(); return; }
  if (action === "start-b") {
    if (window.confirm("B 卷用于 4–6 周后的复测。确认现在清除当前答题进度并开始 B 卷吗？请先导出本次报告。")) {
      state = withTrainingState({ ...freshState(), form: "B", screen: "practice" });
      await saveState(state);
      render();
    }
    return;
  }
  if (action === "reset") {
    if (window.confirm("确认清除本机的诊断测试答案并重新开始吗？暑假训练记录会保留。")) {
      state = withTrainingState(freshState());
      await saveState(state);
      render();
    }
  }
}

async function submitCurrent(response, unknown) {
  const item = currentItem();
  if (!item) return;
  if (submitting || state.attempts.some((attempt) => attempt.itemId === item.id) || state.practiceAttempts.some((attempt) => attempt.itemId === item.id)) return;
  submitting = true;
  document.querySelectorAll(".question-card button").forEach((button) => { button.disabled = true; });
  const attempt = {
    itemId: item.id,
    response: String(response).toLowerCase(),
    unknown,
    durationMs: Date.now() - questionStartedAt,
    createdAt: Date.now(),
    phase: state.screen,
  };
  attempt.analysis = scoreAttempt(item, attempt);
  const target = state.screen === "practice" ? state.practiceAttempts : state.attempts;
  target.push(attempt);
  currentInput = "";
  feedback = null;

  if (state.screen === "practice") {
    state.practiceIndex += 1;
    if (state.practiceIndex >= practiceItems.length) state.screen = "practice-complete";
  } else if (state.screen === "day1") {
    state.day1Index += 1;
    if (state.day1Index >= exams[state.form].day1.length) state.screen = "novel-intro";
  } else if (state.screen === "immediate") {
    state.immediateIndex += 1;
    if (state.immediateIndex >= immediateItems().length) {
      state.day1CompletedAt = Date.now();
      state.screen = "waiting";
    }
  } else if (state.screen === "delayed") {
    state.delayedIndex += 1;
    if (state.delayedIndex >= delayedItems().length) state.screen = "rescue-intro";
  } else if (state.screen === "day2") {
    state.day2Index += 1;
    if (state.day2Index >= exams[state.form].day2.length) {
      state.completedAt = Date.now();
      state.screen = "report";
    }
  }
  await saveState(state);
  submitting = false;
  render();
}

function currentItem() {
  if (state.screen === "practice") return practiceItems[state.practiceIndex];
  if (state.screen === "day1") return exams[state.form].day1[state.day1Index];
  if (state.screen === "immediate") return immediateItems()[state.immediateIndex];
  if (state.screen === "delayed") return delayedItems()[state.delayedIndex];
  if (state.screen === "day2") return exams[state.form].day2[state.day2Index];
  return null;
}

function immediateItems() { return buildNovelItems(state.novelWords).filter((item) => item.type === "immediate"); }
function delayedItems() { return buildNovelItems(state.novelWords).filter((item) => item.type === "delayed"); }
function rescueWords() {
  return state.rescueWordIds.map((wordId) => state.novelWords.find((word) => word.wordId === wordId)).filter(Boolean);
}

function chunkChoices(correct) {
  const variants = [correct, `${correct}e`, correct.length > 1 ? correct.slice(0, -1) : `${correct}a`];
  return [...new Set(variants)].sort((a, b) => `${state.rescueIndex}-${a}`.localeCompare(`${state.rescueIndex}-${b}`));
}

function handleChunkChoice(choice) {
  if (state.screen !== "rescue" || state.rescueStage !== "chunk") return;
  document.querySelectorAll('[data-action="choose-chunk"]').forEach((choiceButton) => { choiceButton.disabled = true; });
  const word = rescueWords()[state.rescueIndex];
  const correct = memoryCardFor(word.word).chunks.at(-1);
  if (choice !== correct) {
    feedback = { kind: "try", message: "差一点！星星不会减少，再看看上面的词块。" };
    render();
    return;
  }
  state.rescueStars += 1;
  state.rescueStage = "spell";
  feedback = { kind: "good", message: "拼图完成！再拿下最后一颗星。" };
  persistAndRender();
}

async function submitRescueSpelling() {
  if (submitting || state.screen !== "rescue" || state.rescueStage !== "spell") return;
  const word = rescueWords()[state.rescueIndex];
  const analysis = scoreAttempt({ ...word, type: "spelling", answer: word.word, group: "rescue" }, { response: currentInput });
  state.rescueAttempts.push({ wordId: word.wordId, response: currentInput, correct: analysis.correct, completedAt: Date.now() });
  if (!analysis.correct) {
    feedback = { kind: "try", message: `已经很接近了！看一眼线索：${memoryCardFor(word.word).chunks.join(" + ")}` };
    currentInput = "";
    await saveState(state);
    render();
    return;
  }
  submitting = true;
  state.rescueStars += 1;
  currentInput = "";
  feedback = null;
  advanceRescueWord();
  await saveState(state);
  submitting = false;
  render();
}

function advanceRescueWord() {
  state.rescueIndex += 1;
  state.rescueStage = "clue";
  if (state.rescueIndex >= state.rescueWordIds.length) state.screen = "rescue-complete";
}

function finishRescue() {
  state.screen = "rescue-complete";
  persistAndRender();
}

function finishNovelSelection() {
  state.screen = "novel-learn";
  state.novelLearningIndex = 0;
  persistAndRender();
}

function startImmediateRecall() {
  state.screen = "immediate";
  state.immediateIndex = 0;
  persistAndRender();
}

function advanceAfterQuestionSection() {
  if (state.screen === "practice") state.screen = "practice-complete";
  else if (state.screen === "day1") state.screen = "novel-intro";
  else if (state.screen === "immediate") state.screen = "waiting";
  else if (state.screen === "delayed") state.screen = "rescue-intro";
  else if (state.screen === "day2") state.screen = "report";
  persistAndRender();
}

function buildReport() {
  return generateReport({
    items: [...exams[state.form].day1, ...immediateItems(), ...delayedItems(), ...exams[state.form].day2],
    attempts: state.attempts,
    novelWordIds: state.novelWords.map((word) => word.wordId),
    excludedWordIds: state.excludedItemIds,
    delayedIntervalMs: state.day1CompletedAt && state.day2StartedAt ? state.day2StartedAt - state.day1CompletedAt : null,
  });
}

function metricCard(label, row, threshold) {
  const percentage = Math.round(row.value * 100);
  const className = threshold === null ? "" : row.value >= threshold ? "pass" : "fail";
  return `<div class="metric ${className}"><strong>${row.total ? `${percentage}%` : "—"}</strong><span>${label}${threshold === null ? "" : ` · 目标 ${Math.round(threshold * 100)}%`}</span></div>`;
}

function barRow(label, value, total) {
  const percentage = total ? Math.round(value * 100) : 0;
  return `<div class="bar-row"><span>${label}</span><div class="bar"><span style="width:${percentage}%"></span></div><strong>${total ? `${percentage}%` : "—"}</strong></div>`;
}

function challengeRow(item) {
  const reason = item.unknown ? "基础缺口 · 完全没印象" : item.errors.map((key) => ERROR_LABELS[key] ?? key).join("、");
  return `<li class="challenge-item ${item.excluded ? "excluded" : ""}">
    <div><strong>${item.word}</strong><small>${item.meaning || item.lengthBand} · ${reason || "拼写错误"}</small></div>
    <button class="toggle-button" data-action="toggle-exclude" data-value="${item.wordId}">${item.excluded ? "恢复" : "排除"}</button>
  </li>`;
}

function formatErrors(errorTypes) {
  const entries = Object.entries(errorTypes).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.slice(0, 4).map(([key, count]) => `${ERROR_LABELS[key] ?? key} ${count} 次`).join("、") : "没有明显集中错误";
}

function formatLocations(locations) {
  const labels = { beginning: "开头", middle: "中间", ending: "词尾" };
  const entries = Object.entries(locations).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([key, count]) => `${labels[key]} ${count} 处`).join("、") : "没有明显集中位置";
}

function playAudio(word) {
  const audio = new Audio(`./assets/audio/${word.toLowerCase()}.mp3`);
  audio.play().catch(() => {
    feedback = { kind: "try", message: "音频暂时无法播放，请检查设备音量后再试。" };
    render();
  });
}

function withTrainingState(nextState) {
  return {
    ...nextState,
    trainingWordState: state.trainingWordState,
    trainingQueue: state.trainingQueue,
    trainingIndex: state.trainingIndex,
    trainingAnswer: state.trainingAnswer,
    trainingFeedback: state.trainingFeedback,
    trainingStage: state.trainingStage,
    trainingGuesses: state.trainingGuesses,
    trainingSessionDate: state.trainingSessionDate,
    trainingSessionStartedAt: state.trainingSessionStartedAt,
    trainingSessionCompletedAt: state.trainingSessionCompletedAt,
  };
}

async function persistAndRender() {
  await saveState(state);
  render();
}

function stopCountdown() {
  if (countdownTimer) window.clearInterval(countdownTimer);
  countdownTimer = null;
}

function startQuestionHintTimer() {
  if (questionTimer) window.clearTimeout(questionTimer);
  const remaining = Math.max(0, 60000 - (Date.now() - questionStartedAt));
  questionTimer = window.setTimeout(() => {
    const card = document.querySelector(".question-card");
    if (!card || document.querySelector("#time-hint")) return;
    const hint = document.createElement("div");
    hint.id = "time-hint";
    hint.className = "feedback try";
    hint.textContent = "不用着急。如果完全没印象，可以直接选择“没印象”或跳过。";
    card.append(hint);
  }, remaining);
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.ceil((ms % 3600000) / 60000);
  return `${hours} 小时 ${minutes} 分钟后可继续`;
}

function formatInterval(ms) {
  if (ms === null) return "未记录";
  const hours = Math.round(ms / 360000) / 10;
  const note = ms >= SECOND_DAY_MIN_MS && ms <= SECOND_DAY_MAX_MS ? "在建议的 18–36 小时范围内" : "不在建议的 18–36 小时范围内";
  return `${hours} 小时，${note}`;
}

function recallSectionLabel() {
  const mode = recallMode(state.day2StartedAt);
  return mode === "same-day" ? "第二次 · 同日回忆" : mode === "short" ? "第二次 · 短间隔回忆" : "第二天 · 隔天回忆";
}

function recallMetricLabel() {
  const mode = recallMode(state.day2StartedAt);
  return mode === "same-day" ? "同日保持（提前）" : mode === "short" ? "短间隔保持" : "隔天保持";
}

function recallMode(secondStartedAt) {
  if (!state.day1CompletedAt || !secondStartedAt || secondStartedAt - state.day1CompletedAt >= SECOND_DAY_MIN_MS) return "delayed";
  const first = new Date(state.day1CompletedAt);
  const second = new Date(secondStartedAt);
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate()
    ? "same-day"
    : "short";
}

function exportPayload(includeReport) {
  return {
    app: "米妮单词诊断",
    version: state.version,
    source: SOURCE_LABEL,
    curriculumSources: CURRICULUM_SOURCES,
    exportedAt: new Date().toISOString(),
    form: state.form,
    state,
    report: includeReport ? buildReport() : null,
  };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dateStamp() { return new Date().toISOString().slice(0, 10); }

function localDateStamp() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}
