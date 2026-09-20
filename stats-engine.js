// ============================================================
// stats-engine.js
// 「経験点 → ステータス → ランク」データ基盤(フェーズ1)
// ------------------------------------------------------------
// この段階では ui.js / game.js の各コマンド(アルバイト・練習など)
// への配線はまだ行っていません。まずは計算ロジックだけを
// 独立モジュールとして固め、次フェーズでホーム/ステータス画面の
// UIと接続します。
//
// 使い方の想定:
//   1. アルバイトや練習の結果として StatsEngine.gainExp(state.expPool, {int:3, ski:3})
//      のようにカテゴリ別の経験点をプールに加算する
//   2. ステータス画面で StatsEngine.raiseStat(state, 'vocal') を呼ぶと
//      プールから必要経験点を消費してステータスを1上げる
//   3. StatsEngine.getRank(value) で G〜S / S1,S2… のランク文字列を取得
//   4. StatsEngine.tryUnlockAbility(state, 'onkan') で特殊能力を習得/昇格
// ============================================================

const StatsEngine = (function () {

  // ---- 経験点カテゴリ(4種) ----
  const EXP_CATEGORIES = ['str', 'ski', 'int', 'men'];
  const EXP_CATEGORY_NAMES = { str: '筋力', ski: '技術', int: '知力', men: '精神' };

  function createEmptyExpPool() {
    return { str: 0, ski: 0, int: 0, men: 0 };
  }

  // ---- 5ステータスの定義(仕様書どおりの組み合わせ) ----
  const STAT_DEFS = {
    vocal:       { name: '歌唱力',        categories: ['str', 'ski'] },
    play:        { name: '演奏',          categories: ['ski', 'men'] },
    compose:     { name: '作曲',          categories: ['int', 'ski', 'men'] },
    performance: { name: 'パフォーマンス', categories: ['str', 'men'] },
    mental:      { name: 'メンタル',       categories: ['int', 'men'] },
  };
  const STAT_ORDER = ['vocal', 'play', 'compose', 'performance', 'mental'];

  function createEmptyStats() {
    const s = {};
    STAT_ORDER.forEach(k => { s[k] = 0; });
    return s;
  }
  function createEmptyInvested() {
    const s = {};
    STAT_ORDER.forEach(k => { s[k] = createEmptyExpPool(); });
    return s;
  }

  // ---- ランク換算 ----
  // 0〜100は下表、100超は10刻みでS1,S2…(パワプロ同様の仕組み)
  const RANK_TABLE = [
    { min: 0,  max: 19,  label: 'G' },
    { min: 20, max: 39,  label: 'F' },
    { min: 40, max: 49,  label: 'E' },
    { min: 50, max: 59,  label: 'D' },
    { min: 60, max: 69,  label: 'C' },
    { min: 70, max: 79,  label: 'B' },
    { min: 80, max: 89,  label: 'A' },
    { min: 90, max: 100, label: 'S' },
  ];

  function getRankIndex(value) {
    const v = Math.max(0, Math.floor(value));
    if (v > 100) return RANK_TABLE.length + Math.floor((v - 101) / 10); // 8+ = S1,S2...(101〜110がS1)
    return RANK_TABLE.findIndex(r => v >= r.min && v <= r.max);
  }

  function getRank(value) {
    const v = Math.max(0, Math.floor(value));
    if (v > 100) {
      const tier = Math.floor((v - 101) / 10) + 1; // 101-110→S1, 111-120→S2 ...
      return `S${tier}`;
    }
    const found = RANK_TABLE.find(r => v >= r.min && v <= r.max);
    return found ? found.label : 'G';
  }

  // ---- ステータスを1ポイント上げるのに必要な経験点(ランクが上がるほど増加) ----
  const RANK_BASE_COST = [6, 9, 13, 18, 24, 32, 42, 55, 70]; // G,F,E,D,C,B,A,S,S1以降(共通)
  function pointCost(currentValue) {
    const idx = Math.min(getRankIndex(currentValue), RANK_BASE_COST.length - 1);
    return RANK_BASE_COST[idx];
  }

  // ---- 経験点をプールへ加算 ----
  // gains は { str:3, ski:2 } のような部分オブジェクトでOK
  function gainExp(expPool, gains) {
    EXP_CATEGORIES.forEach(c => {
      if (gains[c]) expPool[c] += gains[c];
    });
    return expPool;
  }

  // ---- やる気(5段階)・体調不良による経験点の倍率 ----
  const MOTIVATION_LEVELS = ['絶不調', '不調', '普通', '好調', '絶好調']; // index 0〜4、2が標準
  const MOTIVATION_MULTIPLIER = [0.6, 0.8, 1.0, 1.2, 1.4];
  function getExpMultiplier(motivationIndex, sick) {
    const base = MOTIVATION_MULTIPLIER[motivationIndex] ?? 1.0;
    return sick ? Math.round(base * 50) / 100 : base; // 体調不良は半減
  }
  function applyMultiplier(gains, multiplier) {
    const out = {};
    Object.keys(gains).forEach(c => {
      out[c] = Math.max(0, Math.round(gains[c] * multiplier));
    });
    return out;
  }

  function hasSense(state) {
    return (state.abilities || []).some(a => a.key === 'sense');
  }
  function hasSenseBad(state) {
    return (state.abilities || []).some(a => a.key === 'senseBad');
  }
  function costMultiplier(state) {
    let mult = 1;
    if (hasSense(state)) mult *= 0.9;
    if (hasSenseBad(state)) mult *= 1.15;
    return mult;
  }

  // ---- ステータス上昇 ----
  function raiseStat(state, statKey) {
    const def = STAT_DEFS[statKey];
    if (!def) return { ok: false, reason: 'unknown_stat' };
    const current = state.stats[statKey] || 0;
    let cost = pointCost(current);
    cost = Math.max(1, Math.round(cost * costMultiplier(state)));
    const perCategory = Math.ceil(cost / def.categories.length);
    const shortage = def.categories.filter(c => (state.expPool[c] || 0) < perCategory);
    if (shortage.length > 0) {
      return { ok: false, reason: 'insufficient', shortage: shortage.map(c => EXP_CATEGORY_NAMES[c]), needed: perCategory };
    }
    def.categories.forEach(c => {
      state.expPool[c] -= perCategory;
      state.statInvested[statKey][c] += perCategory;
    });
    state.stats[statKey] = current + 1;
    return { ok: true, newValue: state.stats[statKey], newRank: getRank(state.stats[statKey]) };
  }

  // ---- 総合ランク(5ステータス平均+特殊能力ボーナス) ----
  function calcOverallScore(state) {
    const statAvg = STAT_ORDER.reduce((sum, k) => sum + (state.stats[k] || 0), 0) / STAT_ORDER.length;
    const abilityBonus = (state.abilities || []).reduce((sum, a) => {
      const def = ABILITIES[a.key];
      const bonus = { normal: 2, great: 4, gold: 8 }[a.tier] || 0;
      // マイナス能力は総合力を下げる
      return sum + (def && def.negative ? -bonus : bonus);
    }, 0);
    return statAvg + abilityBonus;
  }
  function getOverallRank(state) {
    return getRank(calcOverallScore(state));
  }

  // ---- 特殊能力 ----
  // unlockType: 'exp'(経験点を消費して習得/昇格) / 'mastery'(アルバイト熟練度MAXで自動習得)
  const ABILITIES = {
    onkan: {
      name: '音感',
      effect: '作曲時・ライブ本番時の完成度/出来にボーナス',
      unlockType: 'exp',
      tiers: [
        { tier: 'normal', label: '音感◯',   cost: { int: 40, ski: 40 } },
        { tier: 'great',  label: '音感◎',   cost: { int: 90, ski: 90 } },
        { tier: 'gold',   label: '絶対音感', cost: { int: 160, ski: 160, men: 80 } },
      ],
    },
    rhythm: {
      name: 'リズム感',
      effect: '作曲時・ライブ本番時の完成度/出来にボーナス',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: 'リズム感◯', cost: { str: 40, ski: 40 } }],
    },
    afterparty: {
      name: '打ち上げ',
      effect: 'ライブ後の打ち上げで吐きにくくなる',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: '打ち上げ◯', cost: { men: 60, str: 30 } }],
    },
    design: {
      name: 'デザイン',
      effect: 'グッズの売れ行きが良くなる',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: 'デザイン◯', cost: { int: 50, ski: 30 } }],
    },
    // ここから3つはオリジナルで追加した特殊能力
    focus: {
      name: '集中力',
      effect: '作曲時の完成度のブレ幅が小さくなり、安定して高完成度を狙いやすい',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: '集中力◯', cost: { int: 50, men: 50 } }],
    },
    guts: {
      name: '度胸',
      effect: '大きな会場のライブでも緊張によるマイナス補正を受けにくい',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: '度胸◯', cost: { men: 70, str: 20 } }],
    },
    sns: {
      name: 'SNS映え',
      effect: '配信・SNS広告によるフォロワー/知名度の伸びが良くなる',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: 'SNS映え◯', cost: { ski: 30, men: 30, int: 30 } }],
    },
    // ===== ライブ・会場まわりの特殊能力 =====
    draw: {
      name: '集客力',
      effect: 'ライブに呼べる客の数が増える(◯+10% / ◎+20%)',
      unlockType: 'exp',
      tiers: [
        { tier: 'normal', label: '集客力◯', cost: { men: 60, int: 40 } },
        { tier: 'great',  label: '集客力◎', cost: { men: 130, int: 90 } },
      ],
    },
    regular: {
      name: '常連',
      effect: '続けてライブを打っても客足が落ちにくくなる',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: '常連◯', cost: { men: 50, ski: 40 } }],
    },
    bigstage: {
      name: '大舞台',
      effect: '定員の大きい会場でも実力を出せる(緊張によるマイナスが減る)',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: '大舞台◯', cost: { men: 80, str: 40 } }],
    },
    comeback: {
      name: '逆境',
      effect: '客席が埋まらなかった時の知名度ダウンが半分になる',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: '逆境◯', cost: { men: 70, str: 30 } }],
    },
    loyal: {
      name: '根強い人気',
      effect: '知名度・フォロワーの自然減衰が半分になる',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: '根強い人気◯', cost: { men: 60, int: 60 } }],
    },
    tough: {
      name: 'タフネス',
      effect: 'ライブでの体力消費が20%減る',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: 'タフネス◯', cost: { str: 80 } }],
    },

    // ===== マイナス能力 =====
    // 経験点では習得できない。ナサケナーイ博士の失敗や、競馬で負けた時などに付く。
    stageFright: {
      name: 'あがり症',
      effect: '定員の大きい会場で出来が下がりやすくなる',
      unlockType: 'special', negative: true,
      tiers: [{ tier: 'normal', label: 'あがり症×' }],
    },
    fickle: {
      name: '飽き性',
      effect: '同じ練習を続けると得られる経験点が減る',
      unlockType: 'special', negative: true,
      tiers: [{ tier: 'normal', label: '飽き性×' }],
    },
    spender: {
      name: '浪費癖',
      effect: '毎週わずかにお金が減っていく',
      unlockType: 'special', negative: true,
      tiers: [{ tier: 'normal', label: '浪費癖×' }],
    },
    unpopular: {
      name: '不人気',
      effect: '知名度・フォロワーの自然減衰が1.5倍になる',
      unlockType: 'special', negative: true,
      tiers: [{ tier: 'normal', label: '不人気×' }],
    },

    // サクセス開始時に3%の確率で最初から所持する特殊能力(経験点では習得不可)
    sense: {
      name: 'センス',
      effect: 'ステータスアップ・特殊能力の習得に必要な経験点が10%下がる',
      unlockType: 'special',
      tiers: [{ tier: 'normal', label: 'センス◯' }],
    },
    senseBad: {
      name: 'センス',
      effect: 'ステータスアップ・特殊能力の習得に必要な経験点が15%増える',
      unlockType: 'special',
      tiers: [{ tier: 'normal', label: 'センス×' }],
    },
    // アルバイト熟練度MAXで自動習得(経験点では取得不可)
    flex:       { name: '柔軟性',   effect: 'ライブや他キャラとの交流での悪い効果を少し打ち消す', unlockType: 'mastery', masteryJob: 'conveni', tiers: [{ tier: 'normal', label: '柔軟性◯' }] },
    charisma:   { name: 'コミュ力', effect: '他キャラクターと親密になりやすくなる',            unlockType: 'mastery', masteryJob: 'izakaya', tiers: [{ tier: 'normal', label: 'コミュ力◯' }] },
    multigenre: { name: '他ジャンル', effect: '色々な曲ジャンルで熟練度が上がりやすくなる',       unlockType: 'mastery', masteryJob: 'event',   tiers: [{ tier: 'normal', label: '他ジャンル◯' }] },
    patience:   { name: '忍耐力',   effect: '体力が少ない時でも8時間働ける確率が上がる',        unlockType: 'mastery', masteryJob: 'hikkoshi', tiers: [{ tier: 'normal', label: '忍耐力◯' }] },
    drive:      { name: '行動力',   effect: 'やる気が好調を保ちやすくなる',                    unlockType: 'mastery', masteryJob: 'haitatsu', tiers: [{ tier: 'normal', label: '行動力◯' }] },
    dexterity:  { name: '器用',     effect: '各アルバイトで得られる経験点と時給(×1.25)が上がる', unlockType: 'mastery', masteryJob: 'koujou',  tiers: [{ tier: 'normal', label: '器用◯' }] },
  };

  function tryUnlockAbility(state, abilityKey) {
    const def = ABILITIES[abilityKey];
    if (!def) return { ok: false, reason: 'unknown_ability' };
    const owned = (state.abilities || []).find(a => a.key === abilityKey);
    const nextTierIndex = owned ? def.tiers.findIndex(t => t.tier === owned.tier) + 1 : 0;
    const nextTier = def.tiers[nextTierIndex];
    if (!nextTier) return { ok: false, reason: 'max_tier_reached' };

    if (def.unlockType === 'special') {
      // センスやマイナス能力は、イベントの結果でしか付かない
      return { ok: false, reason: 'not_learnable' };
    }
    if (def.unlockType === 'mastery') {
      const mastery = (state.jobMastery && state.jobMastery[def.masteryJob]) || 0;
      if (mastery < 100) return { ok: false, reason: 'mastery_not_max' };
    } else {
      const rawCost = nextTier.cost || {};
      const discount = costMultiplier(state);
      const cost = {};
      Object.keys(rawCost).forEach(c => { cost[c] = Math.max(1, Math.round(rawCost[c] * discount)); });
      const shortage = Object.keys(cost).filter(c => (state.expPool[c] || 0) < cost[c]);
      if (shortage.length > 0) {
        return { ok: false, reason: 'insufficient', shortage: shortage.map(c => EXP_CATEGORY_NAMES[c]) };
      }
      Object.keys(cost).forEach(c => { state.expPool[c] -= cost[c]; });
    }

    if (owned) {
      owned.tier = nextTier.tier;
    } else {
      state.abilities = state.abilities || [];
      state.abilities.push({ key: abilityKey, tier: nextTier.tier });
    }
    return { ok: true, tier: nextTier.tier, label: nextTier.label, isGold: nextTier.tier === 'gold' };
  }

  // ---- state初期化用ヘルパー(game.jsのstateオブジェクトに合成して使う) ----
  function createInitialFoundation() {
    return {
      expPool: createEmptyExpPool(),
      stats: createEmptyStats(),
      statInvested: createEmptyInvested(),
      abilities: [],
      jobMastery: { conveni: 0, izakaya: 0, event: 0, hikkoshi: 0, haitatsu: 0, koujou: 0 },
      motivation: 2, // '普通'
      sick: false,
    };
  }

  // ---- マイナス能力をランダムに1つ付ける(すでに持っているものは除く) ----
  function grantRandomNegative(state) {
    const keys = Object.keys(ABILITIES).filter(k => ABILITIES[k].negative);
    const owned = (state.abilities || []).map(a => a.key);
    const pool = keys.filter(k => owned.indexOf(k) < 0);
    if (pool.length === 0) return null;
    const key = pool[Math.floor(Math.random() * pool.length)];
    state.abilities = state.abilities || [];
    state.abilities.push({ key, tier: 'normal' });
    return { key, name: ABILITIES[key].name, label: ABILITIES[key].tiers[0].label, effect: ABILITIES[key].effect };
  }

  // ---- サクセス開始時の持って生まれた才能/クセを1つ抽選する ----
  // 何も付かないことのほうが多い。付くと、その周の立ち回りが変わる。
  const STARTING_ABILITY_TABLE = [
    { key: 'sense',       tier: 'normal', weight: 3 },
    { key: 'draw',        tier: 'normal', weight: 3 },
    { key: 'tough',       tier: 'normal', weight: 3 },
    { key: 'bigstage',    tier: 'normal', weight: 2 },
    { key: 'loyal',       tier: 'normal', weight: 2 },
    { key: 'regular',     tier: 'normal', weight: 2 },
    { key: 'onkan',       tier: 'normal', weight: 2 },
    { key: 'guts',        tier: 'normal', weight: 2 },
    { key: 'senseBad',    tier: 'normal', weight: 3 },
    { key: 'stageFright', tier: 'normal', weight: 3 },
    { key: 'fickle',      tier: 'normal', weight: 2 },
    { key: 'spender',     tier: 'normal', weight: 2 },
    { key: 'unpopular',   tier: 'normal', weight: 2 },
  ];
  const STARTING_ABILITY_CHANCE = 0.45;   // これ以外は「何も持たずに始まる」

  function rollStartingAbility(state) {
    if (Math.random() >= STARTING_ABILITY_CHANCE) return null;
    const total = STARTING_ABILITY_TABLE.reduce((a, e) => a + e.weight, 0);
    let x = Math.random() * total;
    for (const e of STARTING_ABILITY_TABLE) {
      x -= e.weight;
      if (x <= 0) {
        const def = ABILITIES[e.key];
        if (!def) return null;
        state.abilities = state.abilities || [];
        if (state.abilities.some(a => a.key === e.key)) return null;
        state.abilities.push({ key: e.key, tier: e.tier });
        const tierDef = def.tiers.find(t => t.tier === e.tier) || def.tiers[0];
        return { key: e.key, name: def.name, label: tierDef.label, effect: def.effect, negative: !!def.negative };
      }
    }
    return null;
  }

  return {
    EXP_CATEGORIES, EXP_CATEGORY_NAMES,
    STAT_DEFS, STAT_ORDER,
    RANK_TABLE, MOTIVATION_LEVELS,
    ABILITIES,
    createEmptyExpPool, createEmptyStats, createEmptyInvested,
    getRank, getRankIndex, pointCost,
    gainExp, getExpMultiplier, applyMultiplier,
    raiseStat, calcOverallScore, getOverallRank,
    tryUnlockAbility, hasSense, grantRandomNegative, rollStartingAbility,
    createInitialFoundation,
  };
})();
