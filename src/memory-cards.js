const CARDS = {
  direction: card(["di", "rec", "tion"], "迪 di 看到方向 rec，最后接 tion：direction。", "./assets/memory/direction.jpg"),
  delicious: card(["de", "li", "cious"], "弟弟 de 说 li 好吃，cious 收尾：delicious。", "./assets/memory/delicious.jpg"),
  comfortable: card(["com", "fort", "able"], "com 进 fort 堡垒，住得 able 舒服：comfortable。", "./assets/memory/comfortable.jpg"),
  classmate: card(["class", "mate"], "class 里的 mate 是同学：classmate。", "./assets/memory/classmate.jpg"),
  building: card(["build", "ing"], "build 建造，加 ing 变成建筑物：building。", "./assets/memory/building.jpg"),
  interesting: card(["in", "ter", "est", "ing"], "in 里面有 ter，再加 est 和 ing：interesting。", "./assets/memory/interesting.jpg"),
  important: card(["im", "por", "tant"], "重要的事情 im 先说，por 和 tant 跟上：important。", "./assets/memory/important.jpg"),
  medicine: card(["med", "i", "cine"], "医生拿 med 药箱，i 和 cine 接上：medicine。", "./assets/memory/medicine.jpg"),
  dangerous: card(["dan", "ger", "ous"], "Dan 看到危险 ger，最后说 ous：dangerous。", "./assets/memory/dangerous.jpg"),
  restaurant: card(["rest", "au", "rant"], "先 rest 休息一下，再去餐馆 restaurant。", "./assets/memory/restaurant.jpg"),
  supermarket: card(["super", "market"], "super 超级市场 market：supermarket。", "./assets/memory/supermarket.jpg"),
  celebration: card(["cele", "bra", "tion"], "cele 庆典里 bra 和 tion 一起庆祝：celebration。", "./assets/memory/celebration.jpg"),
  cabin: card(["ca", "bin"], "“卡宾”住进小木屋：ca + bin = cabin。"),
  badge: card(["bad", "ge"], "爸爸的徽章叫 badge：先记 bad，再接 ge。"),
  coral: card(["co", "ral"], "“口绕”珊瑚游一圈：co + ral = coral。"),
  thorn: card(["th", "orn"], "看到刺先咬舌发 th，再接 orn。"),
  plume: card(["plu", "me"], "羽饰飘向我 me：plu + me = plume。"),
  wharf: card(["wh", "arf"], "海风呼呼吹到码头：wh + arf = wharf。"),
  lantern: card(["lan", "tern"], "蓝 lan 色灯笼转 tern 起来：lan + tern = lantern。"),
  meadow: card(["mea", "dow"], "来到草地慢慢走：mea + dow = meadow。"),
  parcel: card(["par", "cel"], "“怕塞了”一个包裹：par + cel = parcel。"),
  compass: card(["com", "pass"], "拿着指南针通关 pass：com + pass = compass。"),
  oyster: card(["oy", "ster"], "牡蛎张嘴喊 oy，再接 ster。"),
  velvet: card(["vel", "vet"], "兽医 vet 摸到天鹅绒：vel + vet = velvet。"),
  adventure: card(["ad", "venture"], "阿德 ad 出发去冒险 venture：ad + venture = adventure。", "./assets/memory/adventure.jpg"),
  telescope: card(["tele", "scope"], "tele 是远方，scope 是看：看远方就是 telescope。", "./assets/memory/telescope.jpg"),
  festival: card(["fest", "i", "val"], "节日先开 fest，再让 i 和 val 来参加。", "./assets/memory/festival.jpg"),
  sapphire: card(["sap", "phire"], "蓝宝石先记 sap，再把 phire 接上。"),
  fortress: card(["fort", "ress"], "堡垒 fort 后面再守住 ress。"),
  avalanche: card(["ava", "lanche"], "雪崩冲下来：先 ava，再 lanche。"),
  lighthouse: card(["light", "house"], "会发光 light 的房子 house，就是灯塔 lighthouse。", "./assets/memory/lighthouse.jpg"),
  masterpiece: card(["master", "piece"], "大师 master 做出的作品 piece，就是杰作 masterpiece。", "./assets/memory/masterpiece.jpg"),
  skateboard: card(["skate", "board"], "滑行 skate 的板 board，就是滑板 skateboard。"),
  observatory: card(["obser", "va", "tory"], "天文台分三站：obser + va + tory。", "./assets/memory/observatory.jpg"),
  constellation: card(["con", "stell", "ation"], "星座分三节：con + stell + ation。", "./assets/memory/constellation.jpg"),
  encyclopedia: card(["en", "cyclo", "pedia"], "百科全书分三卷：en + cyclo + pedia。", "./assets/memory/encyclopedia.jpg"),
};

export function memoryCardFor(word) {
  const key = String(word).toLowerCase();
  return CARDS[key] ?? card(splitFallback(key), `把 ${key} 分成小块，一块一块记。`);
}

export function rescueWordIds(selectedWords, attempts, limit = 4) {
  const delayed = new Map(
    attempts.filter((attempt) => attempt.phase === "delayed").map((attempt) => [attempt.itemId, attempt])
  );
  return selectedWords
    .filter((word) => !delayed.get(`delayed-${word.wordId}`)?.analysis?.correct)
    .sort((a, b) => a.length - b.length)
    .slice(0, limit)
    .map((word) => word.wordId);
}

function card(chunks, mnemonic, image = null) {
  return { chunks, mnemonic, image };
}

function splitFallback(word) {
  if (word.length <= 5) return [word];
  const middle = Math.ceil(word.length / 2);
  return [word.slice(0, middle), word.slice(middle)];
}
