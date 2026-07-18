export const SOURCE_LABEL = "广州教科版小学英语常见词汇参考";

const practice = [
  q("practice-meaning", "meaning", "apple", "苹果", ["苹果", "梨", "橙子", "香蕉"], { practice: true }),
  q("practice-audio", "audio", "teacher", "teacher", ["teacher", "picture", "daughter", "weather"], { practice: true }),
  q("practice-spelling", "spelling", "school", "school", [], { practice: true, prompt: "学校" }),
];

const aDay1 = [
  q("a1-m-people", "meaning", "people", "人们", ["人们", "朋友", "家庭", "孩子"]),
  q("a1-s-black", "spelling", "black", "black", [], { prompt: "黑色的" }),
  q("a1-a-write", "audio", "write", "write", ["write", "white", "right", "wait"]),
  q("a1-s-family", "spelling", "family", "family", [], { prompt: "家庭" }),
  q("a1-m-because", "meaning", "because", "因为", ["因为", "以前", "成为", "在……之间"]),
  q("a1-s-friend", "spelling", "friend", "friend", [], { prompt: "朋友", pattern: "irregular" }),
  q("a1-a-kitchen", "audio", "kitchen", "kitchen", ["kitchen", "chicken", "picture", "teacher"]),
  q("a1-f-studies", "wordForm", "study", "studies", [], { prompt: "study 的第三人称单数", pattern: "word-form", wordForm: "third-person" }),
  q("a1-m-children", "meaning", "children", "孩子们", ["孩子们", "父母", "同学们", "朋友们"], { pattern: "word-form" }),
  q("a1-s-daughter", "spelling", "daughter", "daughter", [], { prompt: "女儿", pattern: "irregular" }),
  q("a1-a-question", "audio", "question", "question", ["question", "station", "country", "kitchen"]),
  q("a1-s-homework", "spelling", "homework", "homework", [], { prompt: "家庭作业", pattern: "compound" }),
  q("a1-f-stopped", "wordForm", "stop", "stopped", [], { prompt: "stop 的过去式", pattern: "word-form", wordForm: "past" }),
  q("a1-m-beautiful", "meaning", "beautiful", "美丽的", ["美丽的", "有趣的", "困难的", "不同的"], { pattern: "irregular" }),
  q("a1-s-different", "spelling", "different", "different", [], { prompt: "不同的", pattern: "irregular" }),
  q("a1-s-playground", "spelling", "playground", "playground", [], { prompt: "操场", pattern: "compound" }),
  q("a1-a-basketball", "audio", "basketball", "basketball", ["basketball", "playground", "supermarket", "classroom"], { pattern: "compound" }),
  q("a1-s-vegetables", "spelling", "vegetable", "vegetables", [], { prompt: "蔬菜（复数）", pattern: "word-form", wordForm: "plural" }),
  q("a1-m-supermarket", "meaning", "supermarket", "超市", ["超市", "餐馆", "电影院", "图书馆"], { pattern: "compound" }),
  q("a1-s-interesting", "spelling", "interesting", "interesting", [], { prompt: "有趣的", pattern: "irregular" }),
];

const aDay2 = [
  q("a2-m-bread", "meaning", "bread", "面包", ["面包", "米饭", "肉", "牛奶"]),
  q("a2-s-clock", "spelling", "clock", "clock", [], { prompt: "时钟" }),
  q("a2-a-mouth", "audio", "mouth", "mouth", ["mouth", "mouse", "month", "mother"], { pattern: "irregular" }),
  q("a2-s-window", "spelling", "window", "window", [], { prompt: "窗户" }),
  q("a2-m-subject", "meaning", "subject", "学科", ["学科", "问题", "计划", "活动"]),
  q("a2-s-orange", "spelling", "orange", "orange", [], { prompt: "橙子" }),
  q("a2-f-running", "wordForm", "run", "running", [], { prompt: "run 的 -ing 形式", pattern: "word-form", wordForm: "ing" }),
  q("a2-s-elephant", "spelling", "elephant", "elephant", [], { prompt: "大象", pattern: "irregular" }),
  q("a2-a-hospital", "audio", "hospital", "hospital", ["hospital", "holiday", "history", "homework"]),
  q("a2-s-computer", "spelling", "computer", "computer", [], { prompt: "电脑" }),
  q("a2-m-together", "meaning", "together", "一起", ["一起", "明天", "经常", "已经"]),
  q("a2-s-classroom", "spelling", "classroom", "classroom", [], { prompt: "教室", pattern: "compound" }),
  q("a2-f-bought", "wordForm", "buy", "bought", [], { prompt: "buy 的过去式", pattern: "word-form", wordForm: "past" }),
  q("a2-a-dictionary", "audio", "dictionary", "dictionary", ["dictionary", "different", "direction", "delicious"], { pattern: "irregular" }),
  q("a2-s-grandparent", "spelling", "grandparent", "grandparent", [], { prompt: "祖父或祖母", pattern: "compound" }),
  q("a2-s-countryside", "spelling", "countryside", "countryside", [], { prompt: "乡村", pattern: "compound" }),
];

const bDay1 = [
  q("b1-m-house", "meaning", "house", "房子", ["房子", "学校", "商店", "房间"]),
  q("b1-s-happy", "spelling", "happy", "happy", [], { prompt: "开心的" }),
  q("b1-a-right", "audio", "right", "right", ["right", "write", "white", "light"], { pattern: "irregular" }),
  q("b1-s-father", "spelling", "father", "father", [], { prompt: "父亲" }),
  q("b1-m-before", "meaning", "before", "在……之前", ["在……之前", "在……之后", "在……之间", "因为"]),
  q("b1-s-answer", "spelling", "answer", "answer", [], { prompt: "回答", pattern: "irregular" }),
  q("b1-a-picture", "audio", "picture", "picture", ["picture", "teacher", "kitchen", "future"]),
  q("b1-f-watches", "wordForm", "watch", "watches", [], { prompt: "watch 的第三人称单数", pattern: "word-form", wordForm: "third-person" }),
  q("b1-m-parents", "meaning", "parents", "父母", ["父母", "祖父母", "孩子", "朋友"], { pattern: "word-form" }),
  q("b1-s-saturday", "spelling", "Saturday", "saturday", [], { prompt: "星期六" }),
  q("b1-a-language", "audio", "language", "language", ["language", "village", "message", "sandwich"], { pattern: "irregular" }),
  q("b1-s-football", "spelling", "football", "football", [], { prompt: "足球", pattern: "compound" }),
  q("b1-f-planned", "wordForm", "plan", "planned", [], { prompt: "plan 的过去式", pattern: "word-form", wordForm: "past" }),
  q("b1-m-wonderful", "meaning", "wonderful", "精彩的", ["精彩的", "困难的", "危险的", "传统的"]),
  q("b1-s-favourite", "spelling", "favourite", "favourite", [], { prompt: "最喜欢的", pattern: "irregular" }),
  q("b1-s-everything", "spelling", "everything", "everything", [], { prompt: "每件事", pattern: "compound" }),
  q("b1-a-toothbrush", "audio", "toothbrush", "toothbrush", ["toothbrush", "breakfast", "classroom", "playground"], { pattern: "compound" }),
  q("b1-s-exercises", "spelling", "exercise", "exercises", [], { prompt: "练习（复数）", pattern: "word-form", wordForm: "plural" }),
  q("b1-m-traditional", "meaning", "traditional", "传统的", ["传统的", "国际的", "重要的", "有趣的"]),
  q("b1-s-environment", "spelling", "environment", "environment", [], { prompt: "环境", pattern: "irregular" }),
];

const bDay2 = [
  q("b2-m-chair", "meaning", "chair", "椅子", ["椅子", "桌子", "书包", "床"]),
  q("b2-s-train", "spelling", "train", "train", [], { prompt: "火车" }),
  q("b2-a-quiet", "audio", "quiet", "quiet", ["quiet", "quite", "quick", "queen"], { pattern: "irregular" }),
  q("b2-s-morning", "spelling", "morning", "morning", [], { prompt: "早晨" }),
  q("b2-m-country", "meaning", "country", "国家", ["国家", "城市", "乡村", "世界"]),
  q("b2-s-lesson", "spelling", "lesson", "lesson", [], { prompt: "课" }),
  q("b2-f-swimming", "wordForm", "swim", "swimming", [], { prompt: "swim 的 -ing 形式", pattern: "word-form", wordForm: "ing" }),
  q("b2-s-sandwich", "spelling", "sandwich", "sandwich", [], { prompt: "三明治", pattern: "irregular" }),
  q("b2-a-building", "audio", "building", "building", ["building", "beautiful", "between", "bedroom"]),
  q("b2-s-umbrella", "spelling", "umbrella", "umbrella", [], { prompt: "雨伞" }),
  q("b2-m-yesterday", "meaning", "yesterday", "昨天", ["昨天", "今天", "明天", "周末"]),
  q("b2-s-bathroom", "spelling", "bathroom", "bathroom", [], { prompt: "浴室", pattern: "compound" }),
  q("b2-f-taught", "wordForm", "teach", "taught", [], { prompt: "teach 的过去式", pattern: "word-form", wordForm: "past" }),
  q("b2-a-restaurant", "audio", "restaurant", "restaurant", ["restaurant", "supermarket", "dictionary", "interesting"], { pattern: "irregular" }),
  q("b2-s-grandmother", "spelling", "grandmother", "grandmother", [], { prompt: "祖母", pattern: "compound" }),
  q("b2-s-information", "spelling", "information", "information", [], { prompt: "信息" }),
];

export const novelCandidates = {
  "4-5": [
    novel("cabin", "小木屋"), novel("badge", "徽章"), novel("coral", "珊瑚"),
    novel("thorn", "荆棘"), novel("plume", "羽饰"), novel("wharf", "码头"),
  ],
  "6-7": [
    novel("lantern", "灯笼"), novel("meadow", "草地"), novel("parcel", "包裹"),
    novel("compass", "指南针"), novel("oyster", "牡蛎"), novel("velvet", "天鹅绒"),
  ],
  "8-9": [
    novel("adventure", "冒险"), novel("telescope", "望远镜"), novel("festival", "节日"),
    novel("sapphire", "蓝宝石"), novel("fortress", "堡垒"), novel("avalanche", "雪崩"),
  ],
  "10+": [
    novel("lighthouse", "灯塔"), novel("masterpiece", "杰作"), novel("skateboard", "滑板"),
    novel("observatory", "天文台"), novel("constellation", "星座"), novel("encyclopedia", "百科全书"),
  ],
};

export const exams = {
  A: { day1: aDay1, day2: aDay2 },
  B: { day1: bDay1, day2: bDay2 },
};

export const practiceItems = practice;

export function buildNovelItems(selectedWords) {
  return selectedWords.flatMap((word) => [
    {
      ...word,
      id: `immediate-${word.wordId}`,
      type: "immediate",
      answer: word.word,
      group: "novel",
      prompt: word.meaning,
    },
    {
      ...word,
      id: `delayed-${word.wordId}`,
      type: "delayed",
      answer: word.word,
      group: "novel",
      prompt: word.meaning,
    },
  ]);
}

export function selectNovelCandidate(band, selectedIds, rejectedIds) {
  return novelCandidates[band].find((word) => !selectedIds.includes(word.wordId) && !rejectedIds.includes(word.wordId)) ?? null;
}

export function allAudioWords() {
  const fromQuestions = [...practice, ...aDay1, ...aDay2, ...bDay1, ...bDay2]
    .filter((item) => item.type === "audio")
    .map((item) => item.word);
  const novelWords = Object.values(novelCandidates).flat().map((item) => item.word);
  return [...new Set([...fromQuestions, ...novelWords])].sort();
}

function q(id, type, word, answer, choices = [], extra = {}) {
  const canonical = String(answer).toLowerCase();
  const length = type === "wordForm" || ["spelling", "immediate", "delayed"].includes(type) ? canonical.length : String(word).replace(/[^a-z]/gi, "").length;
  return {
    id,
    type,
    wordId: String(word).toLowerCase(),
    word: String(word).toLowerCase(),
    answer: canonical,
    meaning: type === "meaning" ? answer : (extra.prompt ?? ""),
    prompt: extra.prompt ?? "",
    choices,
    length,
    lengthBand: bandFor(length),
    pattern: extra.pattern ?? "regular",
    group: extra.practice ? "practice" : "core",
    core: !extra.practice,
    source: SOURCE_LABEL,
    wordForm: extra.wordForm ?? null,
  };
}

function novel(word, meaning) {
  return {
    wordId: word,
    word,
    meaning,
    length: word.length,
    lengthBand: bandFor(word.length),
    pattern: "regular",
    source: "适龄真实新词（诊断用）",
  };
}

function bandFor(length) {
  if (length <= 5) return "4-5";
  if (length <= 7) return "6-7";
  if (length <= 9) return "8-9";
  return "10+";
}
