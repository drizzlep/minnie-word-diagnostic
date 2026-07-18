import { exams, practiceItems, novelCandidates, buildNovelItems, selectNovelCandidate, SOURCE_LABEL } from "./data.js";
import { generateReport, scoreAttempt } from "./diagnostic.js";
import { loadState, saveState, clearState } from "./storage.js";

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
  if (saved?.version === 1) return saved;
  return freshState();
}

function freshState() {
  return {
    version: 1,
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
    completedAt: null,
  };
}

function render() {
  stopCountdown();
  if (questionTimer) window.clearTimeout(questionTimer);
  switch (state.screen) {
    case "welcome": renderWelcome(); break;
    case "practice": renderQuestion(practiceItems[state.practiceIndex], state.practiceIndex, practiceItems.length, "练习"); break;
    case "day1": renderQuestion(exams[state.form].day1[state.day1Index], state.day1Index, exams[state.form].day1.length, "第一天 · 基础筛查"); break;
    case "novel-intro": renderNovelIntro(); break;
    case "novel-select": renderNovelSelect(); break;
    case "novel-learn": renderNovelLearning(); break;
    case "immediate": renderQuestion(immediateItems()[state.immediateIndex], state.immediateIndex, immediateItems().length, "第一天 · 新词立即回忆"); break;
    case "waiting": renderWaiting(); break;
    case "day2-intro": renderDay2Intro(); break;
    case "delayed": renderQuestion(delayedItems()[state.delayedIndex], state.delayedIndex, delayedItems().length, "第二天 · 隔天回忆"); break;
    case "day2": renderQuestion(exams[state.form].day2[state.day2Index], state.day2Index, exams[state.form].day2.length, "第二天 · 长词定位"); break;
    case "report": renderReport(); break;
    default: renderWelcome();
  }
  const nextItem = currentItem();
  if (nextItem?.id !== activeQuestionId) {
    activeQuestionId = nextItem?.id ?? null;
    questionStartedAt = Date.now();
  }
  app.focus({ preventScroll: true });
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
        </div>
        <ul class="facts">
          <li><strong>两次完成</strong>每次约 10–15 分钟，间隔一天。</li>
          <li><strong>独立作答</strong>不强制限时，不会就选“没印象”。</li>
          <li><strong>只测真实单词</strong>参考广州教科版，不做同龄排名。</li>
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

function choiceButtons(choices) {
  return `<div class="choice-grid">${choices.map((choice) => `<button class="choice-button" data-action="choose" data-value="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`).join("")}</div>`;
}

function keyboard() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  return `<div class="letter-keyboard" aria-label="字母键盘">
    ${letters.map((letter) => `<button class="key" data-action="letter" data-value="${letter.toLowerCase()}">${letter}</button>`).join("")}
    <button class="key wide" data-action="backspace">删除</button>
    <button class="key submit" data-action="submit-spelling" ${currentInput ? "" : "disabled"}>提交</button>
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
      <span class="status-chip">✓ 第一天已保存</span>
      <h2 style="margin-top:18px">先让记忆睡一觉</h2>
      <p class="lead">第一天的答案暂时不公布。第二次先检查昨天的新词还记得多少，再完成长词定位。</p>
      <div class="waiting-clock">${ready ? "可以开始第二天" : formatDuration(remaining)}</div>
      ${outsideIdeal ? `<div class="notice">已经超过理想的 36 小时间隔。仍然可以继续，报告会保留实际间隔时间。</div>` : ""}
      <div class="action-row">
        <button class="primary-button" data-action="start-day2" ${ready ? "" : "disabled"}>开始第二天</button>
        <button class="secondary-button" data-action="export-progress">导出当前进度</button>
      </div>
    </section>`;
  if (!ready) countdownTimer = window.setInterval(render, 60000);
}

function renderDay2Intro() {
  const hours = Math.round((Date.now() - state.day1CompletedAt) / 360000) / 10;
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">Day two</p>
      <h2>先回忆昨天的新词</h2>
      <p class="lead">已经间隔约 ${hours} 小时。先做 8 个无提示回忆题，再完成最后一组熟词。全部结束后会生成完整报告。</p>
      <div class="action-row"><button class="primary-button" data-action="begin-delayed">开始隔天回忆</button></div>
    </section>`;
}

function renderReport() {
  const report = buildReport();
  const failed = report.verdict.failedMetrics.map((key) => METRIC_LABELS[key]).join("、");
  app.innerHTML = `
    <section class="panel">
      <div class="report-header">
        <div>
          <p class="eyebrow">完整诊断报告</p>
          <h2>这不是从头再来，<br>而是找准下一步。</h2>
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
        ${metricCard("隔天保持", report.metrics.delayed, 0.7)}
      </div>
      <p class="question-hint" style="margin-top:18px">两次测试实际间隔：${formatInterval(report.delayedIntervalMs)}。</p>
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
  if (submitting && ["submit-spelling", "unknown", "skip", "choose"].includes(action)) return;
  if (action === "explain") { renderExplanation(); return; }
  if (action === "home") { state.screen = "welcome"; persistAndRender(); return; }
  if (action === "start") {
    if (state.screen === "welcome") state.screen = state.practiceIndex >= practiceItems.length ? "day1" : "practice";
    persistAndRender(); return;
  }
  if (action === "play-audio") { playAudio(word); return; }
  if (action === "letter") { currentInput += value; feedback = null; render(); return; }
  if (action === "backspace") { currentInput = currentInput.slice(0, -1); feedback = null; render(); return; }
  if (action === "submit-spelling") { submitCurrent(currentInput, false); return; }
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
  if (action === "start-day2") { state.screen = "day2-intro"; state.day2StartedAt = Date.now(); persistAndRender(); return; }
  if (action === "begin-delayed") { state.screen = "delayed"; persistAndRender(); return; }
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
      state = { ...freshState(), form: "B", screen: "practice" };
      await saveState(state);
      render();
    }
    return;
  }
  if (action === "reset") {
    if (window.confirm("确认清除本机的全部测试答案并重新开始吗？")) {
      await clearState(); state = freshState(); render();
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
    if (state.practiceIndex >= practiceItems.length) state.screen = "day1";
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
    if (state.delayedIndex >= delayedItems().length) state.screen = "day2";
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
  if (state.screen === "practice") state.screen = "day1";
  else if (state.screen === "day1") state.screen = "novel-intro";
  else if (state.screen === "immediate") state.screen = "waiting";
  else if (state.screen === "delayed") state.screen = "day2";
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

function exportPayload(includeReport) {
  return {
    app: "米妮单词诊断",
    version: state.version,
    source: SOURCE_LABEL,
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}
