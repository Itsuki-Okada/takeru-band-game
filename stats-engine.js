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
  // 上のランクほど伸びにくくする度合い。1.0で従来どおり。
  // 大きくすると、高ランク帯の1ポイントが重くなる。
  let COST_CURVE = 1.25;
  function setCostCurve(v) { COST_CURVE = Math.max(0.1, Number(v) || 1); }
  function pointCost(currentValue) {
    const idx = Math.min(getRankIndex(currentValue), RANK_BASE_COST.length - 1);
    const base = RANK_BASE_COST[idx];
    if (COST_CURVE === 1) return base;
    // Dランク(idx3)を境に、それより上だけ倍率を効かせる。序盤の伸びはそのまま残す。
    const steps = Math.max(0, idx - 3);
    return Math.max(1, Math.round(base * Math.pow(COST_CURVE, steps)));
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
  // 特殊能力の査定(総合力への加算)。
  // 能力は全部で27種あるので、1つあたりを大きくすると
  // 「能力を集めるだけでSランク」になってしまう。ステータスを伸ばす道と
  // 釣り合う程度に抑えている。
  let ABILITY_ASSESS = { normal: 0.5, great: 1, gold: 2, super: 8 };
  // 能力は27種あるので、集めるほど際限なく積み上がってしまう。
  // プラス側の合計には上限を設け、ステータスを伸ばす道と釣り合うようにする。
  let ABILITY_ASSESS_CAP = 12;
  function setAbilityAssess(v) { ABILITY_ASSESS = Object.assign({}, ABILITY_ASSESS, v || {}); }
  function abilityAssessValue(def, tier) {
    if (def && def.super) return ABILITY_ASSESS.super;
    return ABILITY_ASSESS[tier] || 0;
  }

  function calcOverallScore(state) {
    const statAvg = STAT_ORDER.reduce((sum, k) => sum + (state.stats[k] || 0), 0) / STAT_ORDER.length;
    let plus = 0, minus = 0;
    (state.abilities || []).forEach(a => {
      const def = ABILITIES[a.key];
      const bonus = abilityAssessValue(def, a.tier);
      // マイナス能力は総合力を下げる(こちらは重めに効き、上限もかからない)
      if (def && def.negative) minus += bonus * 2;
      else plus += bonus;
    });
    return statAvg + Math.min(ABILITY_ASSESS_CAP, plus) - minus;
  }
  function getOverallRank(state) {
    return getRank(calcOverallScore(state));
  }

  // ---- 特殊能力 ----
  // unlockType: 'exp'(経験点を消費して習得/昇格) / 'mastery'(アルバイト熟練度MAXで自動習得)
  const ABILITIES = {
    onkan: {
      knackKey: 'onkan',
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
      knackKey: 'rhythm',
      name: 'リズム感',
      effect: '作曲時・ライブ本番時の完成度/出来にボーナス',
      unlockType: 'exp',
      tiers: [{ tier: 'normal', label: 'リズム感◯', cost: { str: 40, ski: 40 } }],
    },
    strategy: {
      name: '戦略家',
      effect: '宣伝の効き目が上がる(◯+10% / ◎+20% / 天才軍師+30%)',
      unlockType: 'exp',
      tiers: [
        { tier: 'normal', label: '戦略家◯', cost: { int: 70 } },
        { tier: 'great',  label: '戦略家◎', cost: { int: 150 } },
        { tier: 'gold',   label: '天才軍師', cost: { int: 300 } },
      ],
    },
    merchant: {
      name: '商才',
      effect: 'CDの売上とグッズの利益が増える',
      unlockType: 'exp',
      tiers: [
        { tier: 'normal', label: '商才◯', cost: { int: 90 } },
        { tier: 'gold',   label: '青田買い', cost: { int: 260 } },
      ],
    },
    afterparty: {
      knackKey: 'afterparty',
      name: '打ち上げ',
      effect: '打ち上げで吐きにくくなる。「打ち上げ王」まで上げると飲み切りやすくなり、経験点も増える',
      unlockType: 'exp',
      // 金ランクの「打ち上げ王」は、10杯飲み切るのを5回達成してコツを掴まないと習得できない
      tiers: [
        { tier: 'normal', label: '打ち上げ◯', cost: { men: 60, str: 30 } },
        { tier: 'gold', label: '打ち上げ王', cost: { men: 140, str: 120 }, needsKnack: 'afterpartyKing' },
      ],
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

    // ===== 超特殊能力 =====
    // フレンドと親密度100まで仲良くなると習得できる。査定(総合力)への加算も大きい。
    // unlockType: 'friendship' … 経験点では取れず、そのキャラとの関係でしか手に入らない。
    yataibone: {
      name: '屋台骨',
      effect: 'きさらがリズムで支えてくれる。ライブの出来が落ちにくくなり、最低でも実力どおりの演奏ができる',
      knackKey: 'rhythm', unlockType: 'friendship', friendId: 'kisara', super: true,
      tiers: [{ tier: 'gold', label: '屋台骨', cost: { ski: 200, str: 160, men: 120 } }],
    },
    fudou: {
      name: '不動',
      effect: 'いつきに倣って動じなくなる。風邪をひかず、熱も出さない',
      knackKey: 'patience', unlockType: 'friendship', friendId: 'itsuki', super: true,
      tiers: [{ tier: 'gold', label: '不動', cost: { men: 220, str: 160, int: 100 } }],
    },
    hitotarashi: {
      name: '人たらし',
      effect: 'りょーぺ直伝。親密度が大きく上がり、対バンの誘いをほぼ断られなくなる',
      knackKey: 'charisma', unlockType: 'friendship', friendId: 'ryohei', super: true,
      tiers: [{ tier: 'gold', label: '人たらし', cost: { men: 200, int: 180, ski: 100 } }],
    },
    zesshou: {
      name: '絶唱',
      effect: 'たくまに学んだ歌。大きい会場ほど声が乗り、緊張が逆に力になる',
      knackKey: 'onkan', unlockType: 'friendship', friendId: 'takuma', super: true,
      tiers: [{ tier: 'gold', label: '絶唱', cost: { str: 200, men: 180, ski: 100 } }],
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

  // ===== コツ(knack) =====
  // コツにはLv1〜5があり、1レベルにつき必要経験点が10%引き。Lv5で半分になる。
  // 下位のコツを持っていると、金特殊能力・超特殊能力の必要経験点にも同じ割引がかかる。
  const KNACK_MAX_LEVEL = 5;
  function knackLevel(state, key) {
    const v = (state.knacks || {})[key];
    if (v === true) return KNACK_MAX_LEVEL;      // 旧セーブ(真偽値)は最大レベル扱い
    const n = Number(v) || 0;
    return Math.max(0, Math.min(KNACK_MAX_LEVEL, n));
  }
  function knackDiscount(level) {
    return 1 - Math.max(0, Math.min(KNACK_MAX_LEVEL, level)) * 0.1;
  }
  // 持っているコツのうち一番高いレベル(金特殊・超特殊への割引に使う)
  function bestKnackLevel(state) {
    const ks = state.knacks || {};
    return Object.keys(ks).reduce((m, k) => Math.max(m, knackLevel(state, k)), 0);
  }

  // 次の段階に必要な経験点(割引適用後)。UIの「必要:」表示と習得処理で同じ値を使う。
  function abilityNextCost(state, abilityKey) {
    const def = ABILITIES[abilityKey];
    if (!def) return null;
    const owned = (state.abilities || []).find(a => a.key === abilityKey);
    const nextTierIndex = owned ? def.tiers.findIndex(t => t.tier === owned.tier) + 1 : 0;
    const nextTier = def.tiers[nextTierIndex];
    if (!nextTier || !nextTier.cost) return null;
    // その能力に対応するコツだけが効く(包括的な割引はしない)
    const lv = def.knackKey ? knackLevel(state, def.knackKey) : 0;
    const discount = costMultiplier(state) * knackDiscount(lv);
    const cost = {};
    Object.keys(nextTier.cost).forEach(c => { cost[c] = Math.max(1, Math.round(nextTier.cost[c] * discount)); });
    return { cost, knackLevel: lv, knackKey: def.knackKey || null, off: Math.round((1 - knackDiscount(lv)) * 100), tier: nextTier.tier, label: nextTier.label };
  }

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
    if (def.unlockType === 'friendship') {
      // 超特殊能力はフレンドとの親密度でしか手に入らない
      return { ok: false, reason: 'friendship_only' };
    }
    if (def.unlockType === 'mastery') {
      const mastery = (state.jobMastery && state.jobMastery[def.masteryJob]) || 0;
      if (mastery < 100) return { ok: false, reason: 'mastery_not_max' };
    } else {
      if (nextTier.needsKnack && !(state.knacks || {})[nextTier.needsKnack]) {
        return { ok: false, reason: 'needs_knack' };
      }
      const rawCost = nextTier.cost || {};
      let discount = costMultiplier(state);
      // その能力のコツ。金特殊(gold)は下位のコツでも割引が効く。
      const lv = def.knackKey ? knackLevel(state, def.knackKey) : 0;
      discount *= knackDiscount(lv);
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

  // ---- 超特殊能力(親密度100で習得) ----
  const FRIENDSHIP_ABILITY_REQUIRED = 100;

  // そのフレンドに紐づく超特殊能力のキーを返す
  function superAbilityFor(friendId) {
    return Object.keys(ABILITIES).find(k => ABILITIES[k].unlockType === 'friendship' && ABILITIES[k].friendId === friendId) || null;
  }

  function hasAbilityKey(state, key) {
    return (state.abilities || []).some(a => a.key === key);
  }

  // 超特殊能力を取るのに必要な経験点(センス◯などの割引は反映する)
  function superAbilityCost(state, key) {
    const def = ABILITIES[key];
    if (!def || !def.tiers[0].cost) return {};
    const raw = def.tiers[0].cost;
    // 超特殊能力は、対応する下位のコツ(屋台骨=リズム感 など)を掴んでいるぶんだけ安くなる
    const discount = costMultiplier(state) * knackDiscount(knackLevel(state, def.knackKey));
    const out = {};
    Object.keys(raw).forEach(c => { out[c] = Math.max(1, Math.round(raw[c] * discount)); });
    return out;
  }

  // 習得できる状態か。親密度・未所持・経験点をそれぞれ見る。
  // 戻り値: { ok, reason, key, cost, shortage }
  // 絆の特殊能力は1サクセスにつき1つだけ。誰と深く付き合うかを選ぶことになる。
  function ownedSuperKey(state) {
    const a = (state.abilities || []).find(x => { const d = ABILITIES[x.key]; return d && d.super; });
    return a ? a.key : null;
  }

  function superAbilityStatus(state, friend) {
    if (!friend || !friend.isNpc) return { ok: false, reason: 'not_npc' };
    const key = superAbilityFor(friend.id);
    if (!key) return { ok: false, reason: 'none' };
    if (hasAbilityKey(state, key)) return { ok: false, reason: 'owned', key };
    const cost = superAbilityCost(state, key);
    if ((friend.intimacy || 0) < FRIENDSHIP_ABILITY_REQUIRED) {
      return { ok: false, reason: 'intimacy', key, cost };
    }
    const shortage = Object.keys(cost).filter(c => (state.expPool[c] || 0) < cost[c]);
    if (shortage.length > 0) return { ok: false, reason: 'exp', key, cost, shortage };
    return { ok: true, key, cost };
  }

  function canLearnSuperAbility(state, friend) {
    return superAbilityStatus(state, friend).ok;
  }

  function learnSuperAbility(state, friend) {
    const st = superAbilityStatus(state, friend);
    if (!st.ok) return null;
    const def = ABILITIES[st.key];
    Object.keys(st.cost).forEach(c => { state.expPool[c] -= st.cost[c]; });
    state.abilities = state.abilities || [];
    state.abilities.push({ key: st.key, tier: 'gold' });
    return { key: st.key, name: def.name, label: def.tiers[0].label, effect: def.effect, cost: st.cost };
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
    getRank, getRankIndex, pointCost, setCostCurve,
    gainExp, getExpMultiplier, applyMultiplier,
    KNACK_MAX_LEVEL, knackLevel, knackDiscount, bestKnackLevel, abilityNextCost,
    ABILITY_ASSESS, ABILITY_ASSESS_CAP, setAbilityAssess, abilityAssessValue,
    raiseStat, calcOverallScore, getOverallRank,
    tryUnlockAbility, hasSense, grantRandomNegative, rollStartingAbility,
    FRIENDSHIP_ABILITY_REQUIRED, superAbilityFor, canLearnSuperAbility, learnSuperAbility,
    superAbilityStatus, superAbilityCost, ownedSuperKey,
    createInitialFoundation,
  };
})();
