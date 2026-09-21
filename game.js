// ===== ゲーム状態 =====
const state = {
  // --- ここから新仕様(経験点/ステータス/ランク)の基盤フィールド ---
  // 中身の計算ロジックは stats-engine.js を参照。
  // ホーム/ステータス画面やアルバイト・練習との接続は次フェーズで行う。
  ...StatsEngine.createInitialFoundation(),
  // --- ここまで ---
  playerName: 'タケル',
  playerId: '',
  bandName: 'タケルバンド',
  money: 10000,
  health: 100,
  condition: 'normal', // 'normal' | 'greatCondition' | 'cold' | 'fever'
  hungover: false, // 二日酔い(TOP画面の表示のみに影響。体調そのものはconditionで管理)
  feverTurnsLeft: 0,
  greatConditionTurnsLeft: 0,
  fame: 0,
  followers: 0,
  turn: 1,          // 通算ターン数(1ターン=1週間)
  year: 1,
  month: 8,          // START_MONTH(下記定数)と合わせること
  weekOfMonth: 1,
  weekIncome: 0,
  weekUnitsSold: 0,
  monthlyPerformance: 0,
  agencyStatus: 'unsigned', // 'unsigned' | 'indie' | 'major'
  indieLabel: null, // 所属しているインディーズレーベルのkey(INDIE_LABELS参照)
  agencySalary: 0,
  agencyJoinTurn: null,
  gameEnded: false,
  totalEarnings: 0, // 累計収入(エンディングの「総取得金額」表示用)
  indieOfferThreshold: Math.round(13000 + Math.random() * 4000), // 約15,000前後
  declinedIndieOffer: false,
  declinedMajorOffer: false,
  justAgencyOffer: null,
  justIndieLabelOffer: false,
  justKeibaEvent: null, // きさらの競馬イベント。{ raceName } を入れるとその日の行動後に発生する
  justChoiceEvent: null, // 選択肢つきの小イベント。{ key } を入れるとその日の行動後に発生する
  brokenGearTurns: 0,    // 機材を直さずに使っている残り週数。0より大きい間はライブの出来が落ちる
  labelRequest: null,    // レーベルからの要求 { genre, expiryTurn }
  labelPerkBoost: false, // 要求に応えたらレーベルの特典が強化される
  labelRequestDone: false,
  skills: { vocal: 10, guitar: 10, performance: 10, live: 10, compose: 10 },
  songs: [],            // { id, title, genre, completion, used }
  releases: [],          // { id, type, typeName, title, songTitles, genres, songCount, completionAvg, price, cost, released, releaseTurn, totalSold, salesActive, weeksElapsed }
  songInProgress: null,   // { title, genre, weeksLeft, totalWeeks }
  justCompletedSong: null,
  justInsufficientFunds: false,
  justRyoheiEvent: null, // { key: 'RP1'|'RP3'|'RP4' }
  justDrNasakenaiEvent: false,
  drNasakenaiEventDone: false,
  maxHealthMult: 100, // 「元気になりたい」成功で120になる(体力の最大値%)
  justRyoheiCollabDay: false,
  ryoheiPendingOffer: null,
  ryoheiJustBecameFriend: false,
  ryoheiEvents: { rp1Done: false, rp3Done: false, rp4Done: false, firstCollabScheduled: false, firstCollabTurn: null, firstCollabAnnounced: false },
  takumaPendingOffer: null,
  justTakumaEvent: null, // 'TKM1'|'TKM2'|'TKM3'
  justTakumaCollabDay: false,
  takumaEvents: { tkm1Done: false, tkm2Done: false, collabPending: false, collabTurn: null, collabAnnounced: false },
  justReleasedCD: null,
  justRecordedCD: null,
  justPlayedLive: null,
  lastLiveHadMembers: false,
  lastLiveMemberIds: [], // 直近のライブに参加したフレンドID(きさら/いつき等。親密度反映用)
  bandIntimacy: 0,
  afterpartyKnackGained: false,
  knacks: {},               // 掴んだコツ(習得に必要な経験点が半分になる)
  tenDrinkCount: 0,         // 打ち上げで10杯飲み切った回数
  justKnack: null,
  lastPracticeKey: null,    // 飽き性×の判定に使う
  practiceStreak: 0,
  startingAbility: null,     // 開始時に抽選された特殊能力
  justNegativeAbility: null, // 直前についてしまったマイナス能力(UIで一度だけ見せる)
  afterpartyState: null,
  justLiveDayArrived: null,
  liveDayAnnounced: false,
  peakFame: 0,               // これまでの最高知名度(減衰の下限に使う)
  peakFollowers: 0,
  scheduledGuests: [],       // 次の定期ライブに出てもらうフレンド(たくま/りょーぺ 最大2組)
  guestAskedThisLive: {},    // 今回の定期ライブで誘いをかけた相手(断られても再挑戦できない)
  justLiveCancelled: null,   // 熱で中止になった時の通知
  justGuestReply: null,      // 対バンに誘った返事
  justSuperAbility: null,    // 超特殊能力を覚えた時の通知
  nextLiveTurn: 6,          // 次回定期ライブのターン(6週ごと)
  lastLiveTurn: null,       // 直近でライブを打ったターン(客足の回復に使う)
  bestAudience: 0,          // 1回のライブで集めた最高動員(メジャーの条件に使う)
  livePromoUsedTurn: null,  // 直近で宣伝を行ったターン(週1回まで)
  promoMonth: null,         // 宣伝した月(1ヶ月に1回の判定用)
  promoCountThisMonth: 0,
  liveExtraAudience: 0,     // 宣伝で積み上がった追加来場数
  justCollabLive: null,
  justFriendOffer: null,
  justFlavorEvent: null,
  justPracticeResult: null,
  practiceStamps: 0,
  practiceCount: {}, // 練習種別ごとの実施回数(練習レベル算出用)
  practiceCoupon: null,
  goodsInventory: [],
  goodsInvIdSeq: 1,
  genreMastery: {}, // { ジャンル名: 0〜100 }
  friends: [], // 実際の初期値(きさら/いつき)はNPC_MEMBERS定義後に設定する
  mailbox: [],
  mailIdSeq: 1,
  songIdSeq: 1,
  releaseIdSeq: 1,
  log: [],               // { msg, type: 'plus'|'minus'|'neutral' } 直近8件(画面表示用)
  logHistory: [],        // 過去ログの全履歴(最大300件、ログ履歴モーダル用)
};

// ===== マスタデータ =====
// サポートメンバーの雇用料。売れるほど、そしてレーベルに所属するほど高くなる。
// 駆け出しのうちは1人10,000円。
const MEMBER_COST_BASE = 10000;
const MEMBER_COST_MAX = 50000;
function memberHireCost() {
  const fameAdd = Math.min(20000, (state.fame / 18000) * 20000);
  const followerAdd = Math.min(12000, (state.followers / 11000) * 12000);
  const labelMult = state.agencyStatus === 'major' ? 1.5 : (state.agencyStatus === 'indie' ? 1.2 : 1);
  const raw = (MEMBER_COST_BASE + fameAdd + followerAdd) * labelMult;
  return Math.min(MEMBER_COST_MAX, Math.round(raw / 1000) * 1000);
}
const PRODUCER_COST = 30000;
// レコーディングのゲスト参加(たくま・りょーぺ)。親密度がMAXになると頼めるようになる。
// ライブのサポートメンバーにはできない(あくまでスタジオでの客演)。
const RECORD_GUEST_COST = 60000;
const RECORD_GUEST_MIN_INTIMACY = 100;
const RECORD_GUEST_IDS = ['takuma', 'ryohei'];
const RECORDING_COST_PER_SONG = 15000;
const MONTHLY_PERFORMANCE_THRESHOLD = 800;
const GREAT_CONDITION_CHANCE = 0.02;

// expGain は新仕様(筋力str/技術ski/知力int/精神men)の経験点カテゴリ。
// まだどの実行関数からも参照されていない(次フェーズでアルバイト実行処理から
// StatsEngine.gainExp(state.expPool, job.expGain) を呼ぶ形に配線する)。
// expGain は各カテゴリごとに [最小,最大] のばらつき範囲。実際の値は実行時にランダムで決まる。
const JOBS = [
  { key: 'conveni', name: 'コンビニ', wage: 900, healthCost: 10, expGain: { int: [5, 10], ski: [5, 10] } },
  { key: 'izakaya', name: '居酒屋', wage: 1100, healthCost: 12, expGain: { ski: [5, 10], int: [5, 10], men: [5, 10] } },
  { key: 'event', name: 'イベントスタッフ', wage: 1300, healthCost: 15, expGain: { str: [5, 10], int: [5, 10], ski: [5, 10] } },
  { key: 'hikkoshi', name: '引っ越し', wage: 1600, healthCost: 25, expGain: { str: [5, 10], men: [5, 10] } },
  { key: 'haitatsu', name: '配達', wage: 1200, healthCost: 15, expGain: { ski: [5, 10], men: [5, 10] } },
  { key: 'koujou', name: '工場', wage: 1400, healthCost: 20, expGain: { str: [5, 10], ski: [5, 10], men: [5, 10] } },
];

// アルバイトは熟練度(0〜100)が上がるほど時給と経験点が伸びる。
// 序盤で終わりにならず、通い続けた職場は終盤でも選ぶ価値が残る。
let JOB_MASTERY_WAGE_BONUS = 0.8;   // 熟練度MAXで時給1.8倍
let JOB_MASTERY_EXP_BONUS = 1.2;    // 熟練度MAXで経験点2.2倍

function jobMasteryMult(jobKey, bonus) {
  const m = (state.jobMastery && state.jobMastery[jobKey]) || 0;
  return 1 + (m / 100) * bonus;
}

// 熟練度MAX(100)でアルバイトごとの特殊能力(StatsEngine.ABILITIES の
// unlockType:'mastery' 側)が自動習得される想定。
const JOB_MASTERY_ABILITY = {
  conveni: 'flex', izakaya: 'charisma', event: 'multigenre',
  hikkoshi: 'patience', haitatsu: 'drive', koujou: 'dexterity',
};

// PRACTICE_MENUS も同様に expGain を追加。費用は仕様書どおり
// 全体練習=5,000円、合宿=10,000円に更新。アルバイトより経験点が多い。
// expGainは各カテゴリ [最小,最大] のばらつき範囲(基準はLv1)。練習レベルが上がるとこの範囲全体に倍率がかかる。
const PRACTICE_MENUS = [
  { key: 'vocal', name: 'ボイトレ', cost: 1000, stats: ['vocal'], healthCost: 10, exp: 6, expGain: { str: [10, 20], men: [10, 20] } },
  { key: 'guitar', name: 'ギター練習', cost: 1000, stats: ['guitar'], healthCost: 10, exp: 6, expGain: { ski: [10, 20], men: [10, 20] } },
  { key: 'compose', name: '作曲練習', cost: 1000, stats: ['compose'], healthCost: 10, exp: 6, expGain: { int: [10, 20], men: [10, 20] } },
  { key: 'group', name: '全体練習', cost: 5000, stats: ['vocal', 'guitar'], healthCost: 15, exp: 10, expGain: { ski: [10, 20], str: [10, 20], men: [10, 20] } },
  { key: 'dress_rehearsal', name: 'ゲネプロ', cost: 5000, stats: ['vocal', 'guitar', 'live', 'performance'], healthCost: 15, exp: 18, expGain: { str: [10, 20], ski: [10, 20], int: [10, 20] } },
  { key: 'camp', name: '合宿', cost: 10000, stats: ['vocal', 'guitar', 'compose'], healthCost: 20, exp: 16, expGain: { str: [10, 20], ski: [10, 20], int: [10, 20], men: [10, 20] } },
];
// 練習レベル(1〜5)による経験点倍率。5回practice実行するごとに1レベル上がる(最大Lv5)。
// 同じ練習を続けるほど効率が上がるので、練習に寄せた立ち回りがステータスで報われる。
let PRACTICE_LEVEL_MULTIPLIER = [1, 2.0, 3.25, 4.75, 6.5]; // index 0=Lv1 … 4=Lv5
const PRACTICE_LEVEL_UP_EVERY = 5;
function getPracticeLevel(key) {
  const count = (state.practiceCount && state.practiceCount[key]) || 0;
  return Math.min(5, 1 + Math.floor(count / PRACTICE_LEVEL_UP_EVERY));
}
// 練習の「獲得予定」を実際の計算と同じ式で先に出す。
// 経験点に掛かる倍率は練習した後のレベルなので、ここでも1回ぶん進めたレベルで見積もる。
function practicePreview(key) {
  const menu = PRACTICE_MENUS.find(m => m.key === key);
  if (!menu) return null;
  const count = (state.practiceCount && state.practiceCount[key]) || 0;
  const level = Math.min(5, 1 + Math.floor((count + 1) / PRACTICE_LEVEL_UP_EVERY));
  const levelUp = level > Math.min(5, 1 + Math.floor(count / PRACTICE_LEVEL_UP_EVERY));
  const toNextLevel = level >= 5 ? 0 : PRACTICE_LEVEL_UP_EVERY - ((count + 1) % PRACTICE_LEVEL_UP_EVERY || PRACTICE_LEVEL_UP_EVERY);
  const levelMult = PRACTICE_LEVEL_MULTIPLIER[level - 1];
  // 飽き性×: 同じ練習を続けると落ちる
  let boredMult = 1;
  if (hasAbility('fickle')) {
    const streak = state.lastPracticeKey === key ? (state.practiceStreak || 0) + 1 : 0;
    boredMult = Math.max(0.5, 1 - streak * 0.18);
  }
  const cm = conditionMult();
  // grantExp()と同じ倍率(やる気＋体調不良)で見積もる
  const expMult = StatsEngine.getExpMultiplier(currentMotivationIndex(), isSickForExp());
  const exp = {};
  Object.keys(menu.expGain).forEach(cat => {
    const [lo, hi] = menu.expGain[cat];
    exp[cat] = [
      Math.max(0, Math.round(Math.round(lo * levelMult * boredMult) * expMult)),
      Math.max(0, Math.round(Math.round(hi * levelMult * boredMult) * expMult)),
    ];
  });
  const couponValid = !!(state.practiceCoupon && state.turn <= state.practiceCoupon.expiryTurn);
  return {
    key, name: menu.name, level, levelUp, toNextLevel, levelMult, boredMult, expMult,
    motivation: StatsEngine.MOTIVATION_LEVELS[currentMotivationIndex()],
    exp,
    cost: menu.cost, halfCost: Math.round(menu.cost / 2), couponValid,
    healthCost: menu.healthCost, condition: state.condition,
    stamps: state.practiceStamps || 0, stampsNeeded: PRACTICE_STAMPS_FOR_COUPON,
  };
}

const PRACTICE_STAMPS_FOR_COUPON = 10;
const PRACTICE_COUPON_VALID_TURNS = 4; // 約1ヶ月(4週)

const GENRES = ['ロック', 'パンク', 'メロコア', 'エモ', 'ポップ', 'バラード'];
const SONG_HEALTH_COST = 15;

const STUDIOS = [
  { key: 'a', name: 'Aスタジオ', costPerSong: 15000, qualityBonus: 1.0 },
  { key: 'b', name: 'Bスタジオ', costPerSong: 50000, qualityBonus: 1.15 },
  { key: 'c', name: 'Cスタジオ', costPerSong: 100000, qualityBonus: 1.35 },
];

const CD_TYPES = [
  { key: 'single', name: 'シングル', minSongs: 1, maxSongs: 4, priceMin: 500, priceMax: 1500 },
  { key: 'ep', name: 'EP', minSongs: 3, maxSongs: 7, priceMin: 1000, priceMax: 2000 },
  { key: 'album', name: 'アルバム', minSongs: 8, maxSongs: 20, priceMin: 2000, priceMax: 3500 },
];

const MEMBERS = [
  { key: 'bass', name: 'きさら(ベース)' },
  { key: 'drums', name: 'いつき(ドラム)' },
];
const MEMBER_KEY_TO_FRIEND_ID = { bass: 'kisara', drums: 'itsuki' };

// メンバー・フレンドの詳細ステータス(CSVのランクを目安の数値に変換したもの)
const NPC_MEMBERS = {
  kisara: {
    name: 'きさら', bandName: '', part: 'ベース',
    stats: { vocal: 65, play: 85, compose: 55, performance: 65, mental: 55 },
    abilities: ['人気◎', 'リズム感◯', 'デザイン◯'],
    fame: 683, followers: 570,
  },
  itsuki: {
    name: 'いつき', bandName: '', part: 'ドラム',
    stats: { vocal: 55, play: 75, compose: 55, performance: 55, mental: 75 },
    abilities: ['コミュ力×', '忍耐力◯'],
    fame: 499, followers: 378,
  },
  ryohei: {
    name: 'りょーぺ', bandName: 'アフターワーク', part: 'ギター/ボーカル',
    stats: { vocal: 65, play: 55, compose: 55, performance: 65, mental: 75 },
    abilities: ['コミュ力◎', '打ち上げ◯'],
    fame: 705, followers: 408,
  },
  takuma: {
    name: 'たくま', bandName: 'KAME', part: 'ギター/ボーカル',
    // 歌唱A / 演奏E / 作曲C / パフォーマンスD / メンタルC
    stats: { vocal: 82, play: 45, compose: 64, performance: 55, mental: 63 },
    abilities: ['度胸◯'],
    fame: 620, followers: 480,
  },
};

// 初期(現在)のフレンド: きさら(ベース)・いつき(ドラム)。りょーぺはRP1で加入する想定のためここには含めない。
// フレンド一覧では「バンドメンバー」等の区分けをせず、全員を同じ形の一件として扱う。
function createInitialFriends() {
  return ['kisara', 'itsuki'].map(key => ({
    id: key, memberKey: key, isNpc: true,
    name: NPC_MEMBERS[key].name, bandName: NPC_MEMBERS[key].bandName,
    part: NPC_MEMBERS[key].part, stats: { ...NPC_MEMBERS[key].stats }, abilities: [...NPC_MEMBERS[key].abilities],
    fame: NPC_MEMBERS[key].fame, followers: NPC_MEMBERS[key].followers, intimacy: 50,
  }));
}
state.friends = createInitialFriends();

const VENUES = [
  { key: 'small', name: '小規模ライブハウス', cost: 10000, capacity: 50, ticket: 400, minFame: 0, healthCost: 8 },
  { key: 'mid', name: '中規模ライブハウス', cost: 50000, capacity: 300, ticket: 333, minFame: 500, healthCost: 12 },
  { key: 'zepp', name: 'Zepp風会場', cost: 200000, capacity: 1000, ticket: 400, minFame: 5000, healthCost: 16 },
  { key: 'hall', name: 'ホール', cost: 500000, capacity: 2000, ticket: 500, minFame: 15000, healthCost: 20 },
  { key: 'budokan', name: '武道館', cost: 1000000, capacity: 10000, ticket: 200, minFame: 20000, healthCost: 25 },
];

// 前回のライブからの間隔で客足が戻る(連続で打つと客が飽きる)
function liveFatigueMult() {
  if (state.lastLiveTurn === null || state.lastLiveTurn === undefined) return 1;
  const gap = Math.max(0, state.turn - state.lastLiveTurn);
  const base = hasAbility('regular') ? LIVE_FATIGUE_BASE + 0.20 : LIVE_FATIGUE_BASE; // 常連◯
  return Math.max(0.15, Math.min(1, base + gap * LIVE_FATIGUE_RECOVER));
}

// 集客力 = 今の自分が呼べる客の数。会場のキャパとは無関係に決まる。
// これが会場のキャパを上回れば満員、下回ればその差がそのまま空席になる。
function calcDrawPower(ignoreFatigue) {
  const overall = StatsEngine.calcOverallScore(state);
  const base = (Math.pow(state.fame, DRAW_FAME_EXP) / DRAW_FAME_DIV
    + Math.pow(state.followers, DRAW_FAME_EXP) / DRAW_FOLLOWER_DIV) * (0.5 + overall / 100)
    + overall * DRAW_OVERALL;
  const drawBonus = 1 + abilityTier('draw') * 0.10;   // 集客力◯+10% / ◎+20%
  const draw = base * drawBonus * (ignoreFatigue ? 1 : liveFatigueMult());
  return Math.max(2, Math.round(draw));
}

// 定期ライブの会場は「今の集客力で一番きれいに埋まる箱」が自動で選ばれる。
// (追加ライブでは、プレイヤーが自分でこれ以外の箱も選べる)
function pickVenueForPlayer() {
  const draw = calcDrawPower(true);
  let best = VENUES[0];
  for (const v of VENUES) {
    if (state.fame < v.minFame) continue;
    // 8割前後まで埋まる箱を上限に、入るなら大きいほうを選ぶ
    if (draw >= v.capacity * 0.75) best = v;
  }
  return best;
}

// 会場ごとの見込み(画面表示にも使う)。venueKeyを省略すると定期ライブの会場で計算する。
function estimateLive(venueKey) {
  const venue = VENUES.find(v => v.key === venueKey) || pickVenueForPlayer();
  const draw = calcDrawPower();
  const promo = state.liveExtraAudience || 0;
  const audience = Math.max(0, Math.min(venue.capacity, Math.round((draw + promo) * liveAudienceMult())));
  const fill = venue.capacity > 0 ? audience / venue.capacity : 0;
  return { venue, draw, audience, fill };
}

// チケット取り置き枚数(集客力のうち、来場が確定している分)
function calcTicketsReserved(venue) {
  const draw = calcDrawPower();
  return Math.max(2, Math.min(venue.capacity, Math.round(draw * 0.75)));
}

// ===== 宣伝(ライブ前、週を消費せず週1回まで) =====
const PROMOTIONS = [
  { key: 'stream', name: '配信を行う', cost: 2000, audienceMin: 2, audienceMax: 5, fameGain: 25, followerGain: 20 },
  { key: 'flyer', name: 'チラシを配る', cost: 5000, audienceMin: 4, audienceMax: 9, fameGain: 45, followerGain: 35 },
  { key: 'ad', name: 'SNS広告', cost: 10000, audienceMin: 8, audienceMax: 14, fameGain: 75, followerGain: 60 },
];

// 宣伝は1ヶ月(4週)に1回まで
const PROMO_MAX_PER_MONTH = 1;
// 月1回しか打てないぶん、1回の効き目を大きくする
let PROMO_POWER = 1;
let SONG_STAT_WEIGHT = 0.72;   // 曲の完成度がステータスに対してどれだけ伸びるか
function currentMonthIndex() { return Math.floor(state.turn / 4); }
function promoMaxPerMonth() {
  return PROMO_MAX_PER_MONTH;
}
function promoLeftThisMonth() {
  const m = currentMonthIndex();
  const used = (state.promoMonth === m) ? (state.promoCountThisMonth || 0) : 0;
  return Math.max(0, promoMaxPerMonth() - used);
}
function doPromotion(key) {
  const promo = PROMOTIONS.find(p => p.key === key);
  if (!promo) return;
  if (promoLeftThisMonth() <= 0) {
    addLog(`宣伝は1ヶ月に${promoMaxPerMonth()}回までです`, 'neutral'); render(); return;
  }
  if (state.money < promo.cost) { notifyInsufficientFunds(); render(); return; }
  state.money -= promo.cost;
  let audienceGain = promo.audienceMin + Math.floor(Math.random() * (promo.audienceMax - promo.audienceMin + 1));
  // SNS映え◯: 宣伝の効きが良くなる
  const snsMult = hasAbility('sns') ? 1.4 : 1;
  // 戦略家: 打ち方がうまくなり、同じ宣伝でも効き目が上がる(◯+10% / ◎+20% / 天才軍師+30%)
  const strategyMult = 1 + abilityTier('strategy') * 0.10;
  audienceGain = Math.round(audienceGain * snsMult * PROMO_POWER * strategyMult);
  state.liveExtraAudience = (state.liveExtraAudience || 0) + audienceGain;
  const promoFame = Math.round(promo.fameGain * FAME_GROWTH * snsMult * PROMO_POWER * strategyMult);
  const promoFollowers = Math.round(promo.followerGain * FAME_GROWTH * snsMult * PROMO_POWER * strategyMult);
  state.fame += promoFame;
  state.followers += promoFollowers;
  state.livePromoUsedTurn = state.turn;
  const pm = currentMonthIndex();
  if (state.promoMonth !== pm) { state.promoMonth = pm; state.promoCountThisMonth = 0; }
  state.promoCountThisMonth = (state.promoCountThisMonth || 0) + 1;
  addLog(`${promo.name}を実施した${promo.cost > 0 ? `(-${yen(promo.cost)})` : '(無料)'}`, promo.cost > 0 ? 'minus' : 'neutral');
  addLog(`来場数が${audienceGain}人増える見込み`, 'plus');
  addLog(`知名度が${promoFame}増えた`, 'plus');
  addLog(`フォロワーが${promoFollowers}増えた`, 'plus');
  render();
}

const GOODS = [
  { key: 'sticker', name: 'ステッカー', minQty: 100, unitCost: 100, priceMin: 0, priceMax: 500, healthCost: 2, seasonMonths: null },
  { key: 'tshirt_short', name: '半袖Tシャツ', minQty: 10, unitCost: 1200, priceMin: 1500, priceMax: 3000, healthCost: 4, seasonMonths: [5, 6, 7, 8] },
  { key: 'tshirt_long', name: '長袖Tシャツ', minQty: 10, unitCost: 1500, priceMin: 2000, priceMax: 3500, healthCost: 4, seasonMonths: [9, 10, 3, 4] },
  { key: 'hoodie', name: 'パーカー', minQty: 10, unitCost: 3000, priceMin: 3500, priceMax: 5000, healthCost: 5, seasonMonths: [11, 12, 1, 2] },
  { key: 'towel', name: 'タオル', minQty: 20, unitCost: 1000, priceMin: 1500, priceMax: 2000, healthCost: 3, seasonMonths: null },
  { key: 'keyholder', name: 'キーホルダー', minQty: 20, unitCost: 300, priceMin: 500, priceMax: 900, healthCost: 2, seasonMonths: null },
];

// ===== フレンド機能 =====
// 初期フレンド(きさら・いつき)は createInitialFriends() で設定済み。
// ここで空配列に戻すとメンバーが消えてしまうので、何もしない。

// ===== アクション: フレンド検索・申請 =====
// (2026-08 以降、フレンド機能はFirebase経由のオンライン専用。ダミー検索は廃止)

// ===== アクション: ランキングの相手にフレンド申請を送る(オンライン専用) =====
// ダミーの即時フレンド追加は廃止。Firebase経由の申請フローに一本化。

// ===== アクション: 届いた対バンオファーへの回答 =====


// ===== イベント抽選(仕様: 各行動の終わりに30%、そのうち10%が対バンオファー) =====
// ===== 知名度・フォロワーの伸び =====
// 半年〜1年でインディーズデビュー、1年〜2年でメジャーデビュー(知名度・フォロワーとも5000以上)に
// 届くように、2年ぶんを実際に回して決めた倍率。ここを変えると全体の伸びが一括で変わる。
const FAME_GROWTH = 5.5;
// フォロワーは知名度より伸びにくいと画面が寂しいので、追随率を上げてある
const FOLLOWER_FROM_LIVE = 0.8;
const FOLLOWER_FROM_CD = 0.9;
// 選択肢イベントは1回のサクセス中に何度でも起きる(平均で13回ほど)。
// ライブやCDと同じ倍率にすると知名度・フォロワーが伸びすぎるので、こちらは小さく抑える。
let EVENT_FAME_GROWTH = 1.5;

// ===== ライブの集客モデル(調整パラメータ) =====
// 「集客力」= 会場に関係なく自分が呼べる客の数。これを会場のキャパと比べて充足率が決まる。
// 身の丈に合った箱なら埋まり、背伸びするとガラガラになる。
// 知名度がそのまま集客力になると「客が増える→知名度が増える→客が増える」で
// 指数的に伸びてしまい、全員が終盤に一斉に同じ水準へ到達する。
// 累乗(1未満)を噛ませて伸びを寝かせ、プレイヤーごとの差が早い段階から出るようにする。
let DRAW_FAME_EXP = 0.70;
let DRAW_FAME_DIV = 2.7;       // 知名度→集客力
let DRAW_FOLLOWER_DIV = 5.4;   // フォロワー→集客力
let DRAW_OVERALL = 0.5;        // 総合力→集客力(序盤の下支え)
// 前回のライブからの間隔で客足が戻る。連続で打つと客が飽きる。
let LIVE_FATIGUE_BASE = 0.35;      // 翌週にもう1本打った時の倍率
let LIVE_FATIGUE_RECOVER = 0.16;   // 1週空けるごとの回復量(1.0で頭打ち)
// 知名度の入り方。満員に近いほど跳ねる。
let FAME_PER_HEAD = 0.18;      // 客1人あたりの知名度(×FAME_GROWTH)。動員数に見合う量にする
let FILL_BONUS_MIN = 0.45;     // 充足率0%のときの倍率
let FILL_BONUS_RANGE = 1.15;   // 充足率100%で FILL_BONUS_MIN + これ 倍になる
let FLOP_FILL = 0.2;           // これ未満の充足率は「ガラガラ」扱い
let FLOP_FAME_LOSS = 0.5;      // ガラガラ時に失う知名度(空席1人あたり×FAME_GROWTH)
let EXTRA_LIVE_HEALTH_MULT = 1.0;  // 追加ライブの体力消費倍率
// ライブでも経験点は入るが、練習ほどではない。
// ここを大きくするとライブだけでステータスも伸びてしまい、練習と使い分ける意味が薄れる。
// ===== 人気の自然減衰 =====
// 何もしなければ人は忘れていく。毎週この割合だけ知名度・フォロワーが落ちる。
// これがあると「伸ばし続けないと維持できない」状態になり、
// 知名度は青天井ではなく“活動量に見合った水準”で頭打ちになる。
// (週あたりの獲得量 ÷ 減衰率 が、そのプレイヤーの到達水準のおよその目安)
let FAME_DECAY = 0.030;
let FOLLOWER_DECAY = 0.022;   // フォロワーは知名度より離れにくい
// 一度ついたファンが全員離れるわけではない。
// これまでの最高値のうち、この割合までは減らずに残る(=定着した層)。
// 終盤に「維持するためだけにライブを打ち続ける」状態にならないようにするための下限。
let FAME_FLOOR_RATIO = 0.60;
let FOLLOWER_FLOOR_RATIO = 0.70;

// ===== 特殊能力の判定 =====
// abilityTier(): 0=未所持 / 1=◯ / 2=◎ / 3=金(絶対音感など)
function abilityTier(key) {
  const a = (state.abilities || []).find(x => x.key === key);
  if (!a) return 0;
  return { normal: 1, great: 2, gold: 3 }[a.tier] || 0;
}
function hasAbility(key) { return abilityTier(key) > 0; }

// 会場のキャパが自分の集客力に対して大きすぎると緊張して出来が落ちる。
// 「度胸◯」「大舞台◯」で緩和され、「あがり症×」で悪化する。
// 戻り値は performanceFinal に掛ける倍率(1.0で影響なし)。
function stageNerveMult(venue) {
  const draw = Math.max(1, calcDrawPower(true));
  const ratio = venue.capacity / draw;          // 1.0以下なら身の丈
  if (ratio <= 1.2) return 1;
  let penalty = Math.min(0.30, (ratio - 1.2) * 0.06);
  if (hasAbility('zesshou')) return 1;   // 絶唱: 大舞台でも一切物怖じしない
  if (hasAbility('guts')) penalty *= 0.5;
  if (hasAbility('bigstage')) penalty *= 0.4;
  if (hasAbility('stageFright')) penalty *= 1.8;
  return 1 - penalty;
}

// ライブで得られる経験点は会場の規模で決まる。
// 小規模なら4カテゴリすべてに10ずつ、中規模なら20ずつ…と上がっていく。
const LIVE_EXP_BY_VENUE = {
  small: 10, mid: 20, zepp: 30, hall: 40, budokan: 50,
};
// 上の値は満員だった時の量。客席が埋まらないとここまで減る。
let LIVE_EXP_FILL_MIN = 0.55;
// ライブに一緒に出たメンバーとの親密度が、1本ごとにこれだけ上がる
let LIVE_INTIMACY_GAIN = 5;
// チケット売上のうち、バンドの取り分。残りは会場と運営に渡る。
let LIVE_REVENUE_SHARE = 0.55;

// 経験点の内訳を「筋力経験点を10得た」のように1行ずつにする
function expSegments(applied) {
  if (!applied) return [];
  return StatsEngine.EXP_CATEGORIES
    .filter(c => (applied[c] || 0) > 0)
    .map(c => ({ text: `${StatsEngine.EXP_CATEGORY_NAMES[c]}経験点を${applied[c]}得た`, type: 'plus' }));
}

// ===== イベント抽選 =====
// 1日の行動のあと、30%でイベントが1つ発生する。
// 何が起きるかは EVENT_POOL から重み付きで1つ選ぶ。条件(cond)を満たさないものは候補に入らない。
// 重みが大きいほど出やすく、ナサケナーイ博士だけは他よりかなり低くしてある。
const EVENT_CHANCE = 0.30;
const COLD_FROM_LOW_HP_PRACTICE_CHANCE = 0.2; // 体力50%以下で練習した際に風邪をひく確率(仮の数値)
// ---- 各イベントの結果。戻り値のsegmentsをUIがそのまま吹き出しに流す ----

// 路上ライブ
function resolveStreetLive(keepPlaying) {
  if (!keepPlaying) {
    const fame = Math.round((10 + Math.random() * 15) * EVENT_FAME_GROWTH);
    const fol = Math.round((8 + Math.random() * 10) * EVENT_FAME_GROWTH * FOLLOWER_FROM_LIVE);
    state.fame += fame; state.followers += fol;
    const appliedShort = grantExp(rollExpFromRanges({ str: [5, 10], ski: [5, 10], int: [5, 10], men: [5, 10] }));
    applyHealthCost(4);
    addLog(`路上ライブを切り上げた(知名度+${fame} フォロワー+${fol})`, 'plus');
    render();
    return [
      { text: '深追いせずに切り上げた', type: 'neutral' },
      { text: `知名度+${fame} フォロワー+${fol}`, type: 'plus' },
      ...expSegments(appliedShort),
      { text: '体力が4下がった', type: 'minus' },
    ];
  }
  const busted = Math.random() < 0.18;   // 低確率で通報される
  const fol = Math.round((30 + Math.random() * 50) * EVENT_FAME_GROWTH * FOLLOWER_FROM_LIVE);
  state.followers += busted ? Math.round(fol / 2) : fol;
  // 人前で弾いた経験は、通報されても残る
  const applied = grantExp(rollExpFromRanges({ str: [10, 20], ski: [10, 20], int: [10, 20], men: [10, 20] }));
  applyHealthCost(12);
  if (busted) {
    const loss = Math.round(30 * EVENT_FAME_GROWTH + state.fame * 0.03);
    state.fame = Math.max(0, state.fame - loss);
    addLog(`路上ライブが通報された…(知名度-${loss})`, 'minus');
    render();
    return [
      { text: '人だかりができたが、通報されてしまった', type: 'neutral' },
      { text: `知名度が${loss}下がった`, type: 'minus' },
      { text: `フォロワー+${Math.round(fol / 2)}`, type: 'plus' },
      ...expSegments(applied),
      { text: '体力が12下がった', type: 'minus' },
    ];
  }
  const fame = Math.round((40 + Math.random() * 60) * EVENT_FAME_GROWTH);
  state.fame += fame;
  addLog(`路上ライブが盛り上がった！(知名度+${fame} フォロワー+${fol})`, 'plus');
  render();
  return [
    { text: '足を止める人がどんどん増えていった！', type: 'neutral' },
    { text: `知名度+${fame} フォロワー+${fol}`, type: 'plus' },
    ...expSegments(applied),
    { text: '体力が12下がった', type: 'minus' },
  ];
}

// 楽器が壊れた
const GEAR_REPAIR_COST = 15000;
const GEAR_BROKEN_TURNS = 4;
function resolveBrokenGear(repair) {
  if (repair) {
    if (state.money < GEAR_REPAIR_COST) {
      state.brokenGearTurns = GEAR_BROKEN_TURNS;
      addLog('修理代が足りず、だましだまし使うことにした', 'minus');
      render();
      return [
        { text: '修理に出したかったが、お金が足りなかった…', type: 'minus' },
        { text: `${GEAR_BROKEN_TURNS}週間、ライブの出来が下がる`, type: 'minus' },
      ];
    }
    state.money -= GEAR_REPAIR_COST;
    addLog(`機材を修理に出した(-${yen(GEAR_REPAIR_COST)})`, 'minus');
    render();
    return [
      { text: '機材を修理に出した', type: 'neutral' },
      { text: `${yen(GEAR_REPAIR_COST)}かかった`, type: 'minus' },
      { text: 'これで本番も安心だ', type: 'plus' },
    ];
  }
  state.brokenGearTurns = GEAR_BROKEN_TURNS;
  addLog(`機材をだましだまし使うことにした(${GEAR_BROKEN_TURNS}週間ライブの出来が下がる)`, 'minus');
  render();
  return [
    { text: 'だましだまし使うことにした', type: 'neutral' },
    { text: `${GEAR_BROKEN_TURNS}週間、ライブの出来が下がる`, type: 'minus' },
  ];
}

// SNSがバズる
function resolveSnsBuzz(ride) {
  if (!ride) {
    const fol = Math.round(80 * EVENT_FAME_GROWTH + state.followers * 0.008 + Math.random() * 120 * EVENT_FAME_GROWTH);
    state.followers += fol;
    addLog(`バズをきっかけにフォロワーが増えた(+${fol})`, 'plus');
    render();
    return [
      { text: 'いつもどおりの投稿を続けた', type: 'neutral' },
      { text: `フォロワー+${fol}`, type: 'plus' },
    ];
  }
  const flamed = Math.random() < 0.22;    // 乗っかると軽く炎上することがある
  if (flamed) {
    const lossF = Math.round(150 * EVENT_FAME_GROWTH + state.followers * 0.03);
    const lossN = Math.round(80 * EVENT_FAME_GROWTH);
    state.followers = Math.max(0, state.followers - lossF);
    state.fame = Math.max(0, state.fame - lossN);
    addLog(`投稿を盛りすぎて軽く炎上した…(フォロワー-${lossF} 知名度-${lossN})`, 'minus');
    render();
    return [
      { text: '投稿を増やしたら、やりすぎだと言われてしまった', type: 'neutral' },
      { text: `フォロワーが${lossF}減った`, type: 'minus' },
      { text: `知名度が${lossN}下がった`, type: 'minus' },
    ];
  }
  const fol = Math.round(200 * EVENT_FAME_GROWTH + state.followers * 0.022 + Math.random() * 300 * EVENT_FAME_GROWTH);
  state.followers += fol;
  addLog(`バズに乗っかって一気に伸びた！(フォロワー+${fol})`, 'plus');
  render();
  return [
    { text: '波に乗って投稿を増やした！', type: 'neutral' },
    { text: `フォロワー+${fol}`, type: 'plus' },
  ];
}

// 雑誌の取材
function resolveMagazine(accept) {
  if (!accept) {
    // 断ると露出の機会を逃す。ただし丸1日空くので体力は少し戻り、断った経験が精神になる。
    const fameLoss = Math.round(40 * EVENT_FAME_GROWTH + state.fame * 0.01);
    const folLoss = Math.round(30 * EVENT_FAME_GROWTH + state.followers * 0.01);
    state.fame = Math.max(0, state.fame - fameLoss);
    state.followers = Math.max(0, state.followers - folLoss);
    const maxHealth = state.maxHealthMult || 100;
    const before = state.health;
    state.health = Math.min(maxHealth, state.health + 10);
    const healed = Math.round(state.health - before);
    const applied = grantExp({ men: 10 });
    addLog(`取材を断った(知名度-${fameLoss} フォロワー-${folLoss})`, 'minus');
    render();
    return [
      { text: '今は音楽に集中したい、と伝えた', type: 'neutral' },
      { text: `知名度が${fameLoss}下がった`, type: 'minus' },
      { text: `フォロワーが${folLoss}減った`, type: 'minus' },
      ...expSegments(applied),
      ...(healed > 0 ? [{ text: `体力が${healed}回復した`, type: 'plus' }] : []),
    ];
  }
  const fame = Math.round((150 + Math.random() * 150) * EVENT_FAME_GROWTH);
  const fol = Math.round((80 + Math.random() * 120) * EVENT_FAME_GROWTH * FOLLOWER_FROM_LIVE);
  state.fame += fame; state.followers += fol;
  applyHealthCost(10);
  addLog(`インディーズ誌の取材を受けた(知名度+${fame} フォロワー+${fol})`, 'plus');
  render();
  return [
    { text: '取材を受けた。誌面に載るのが楽しみだ', type: 'neutral' },
    { text: `知名度+${fame} フォロワー+${fol}`, type: 'plus' },
    { text: '体力が10下がった', type: 'minus' },
  ];
}

// 親から電話
function resolveParentCall(persuade) {
  if (persuade) {
    const applied = grantExp({ men: 30 });
    addLog('親を説得した(精神経験点+30)', 'plus');
    render();
    return [
      { text: '「ちゃんとやってる」と正面から伝えた', type: 'neutral' },
      ...expSegments(applied),
    ];
  }
  const amount = 20000 + Math.floor(Math.random() * 11) * 1000;
  addMoney(amount);
  addLog(`親から仕送りが届いた(+${yen(amount)})`, 'money');
  render();
  return [
    { text: '「まあ、ぼちぼち」とごまかした', type: 'neutral' },
    { text: `後日、仕送りが届いた(+${yen(amount)})`, type: 'money' },
  ];
}

// CDが有線で流れる(選択肢なし)
function resolveCdOnAir() {
  const released = state.releases.filter(r => r.released);
  if (released.length === 0) return { segments: [{ text: '', type: 'neutral' }] };
  const cd = released[Math.floor(Math.random() * released.length)];
  cd.salesActive = true;
  cd.weeksElapsed = Math.max(0, (cd.weeksElapsed || 0) - 2);  // 売れる期間が戻る
  const fame = Math.round((60 + Math.random() * 40) * EVENT_FAME_GROWTH);
  state.fame += fame;
  addLog(`「${cd.title}」が店内で流れた！(知名度+${fame} 売上期間が延びた)`, 'plus');
  render();
  return {
    title: cd.title,
    segments: [
      { text: `入った店で「${cd.title}」が流れてきた！`, type: 'neutral' },
      { text: `知名度+${fame}`, type: 'plus' },
      { text: 'しばらく売上が伸びそうだ', type: 'money' },
    ],
  };
}

// レーベルからの要求
const LABEL_REQUEST_TURNS = 12;
function pickLabelRequestGenre() {
  return GENRES[Math.floor(Math.random() * GENRES.length)];
}
function resolveLabelRequest(accept, genre) {
  const label = indieLabelDef();
  if (!accept) {
    state.labelRequestDone = true;
    addLog('レーベルの要求を断った', 'neutral');
    render();
    return [
      { text: '「今は作りたいものを作りたい」と断った', type: 'neutral' },
      { text: `${label ? label.name : 'レーベル'}との関係が少し冷えた`, type: 'minus' },
    ];
  }
  state.labelRequest = { genre, expiryTurn: state.turn + LABEL_REQUEST_TURNS };
  addLog(`${genre}のCDを${LABEL_REQUEST_TURNS}週以内にリリースすると約束した`, 'neutral');
  render();
  return [
    { text: `${genre}で1枚作ると約束した`, type: 'neutral' },
    { text: `期限は${turnToDateLabel(state.turn + LABEL_REQUEST_TURNS)}まで`, type: 'neutral' },
    { text: '間に合えばレーベルの特典が強化される', type: 'plus' },
  ];
}

// 取材などで丸1週つかう時に呼ぶ。イベントが二重に発生しないようskipEventsで進める。
function spendExtraWeek() {
  advanceWeek({ skipEvents: true });
}

// たくまとの出会いが期限までに起きていなければ、ここで必ず起こす。
// 他のイベントが控えている週は見送り、次の週に改めて出す。
function checkTakumaMeeting() {
  if (state.takumaEvents.tkm1Done) return;
  if (state.turn < TAKUMA_MEETING_DEADLINE) return;
  if (hasPendingEvent()) return;
  if (state.justAgencyOffer || state.justIndieLabelOffer) return;
  state.justTakumaEvent = 'TKM1';
}

// 10杯飲み切るのをこの回数こなすと「打ち上げ王」のコツが手に入る
const AFTERPARTY_KING_TIMES = 5;

// ===== フレンドから受け継ぐコツ =====
// 一緒に演奏すると、そのキャラの得意なことが少しずつ身につく。
// 掴んだコツはその能力と、対応する超特殊能力の必要経験点を下げる。
//   きさら=リズム感(屋台骨) / いつき=忍耐力(不動) / りょーぺ=コミュ力(人たらし) / たくま=音感(絶唱)
const FRIEND_KNACK = { kisara: 'rhythm', itsuki: 'patience', ryohei: 'charisma', takuma: 'onkan' };
const FRIEND_KNACK_CHANCE = { live: 0.30, recording: 0.22 };

// 一緒にやった相手からコツをもらえるか抽選する。もらえたらレベルが1上がる(最大5)。
// 戻り値: もらえた場合 { name, knackKey, abilityName, level, off } / もらえなければ null
function rollFriendKnack(friendId, source) {
  const knackKey = FRIEND_KNACK[friendId];
  if (!knackKey) return null;
  const chance = FRIEND_KNACK_CHANCE[source] || 0.2;
  if (Math.random() >= chance) return null;
  state.knacks = state.knacks || {};
  const before = StatsEngine.knackLevel(state, knackKey);
  if (before >= StatsEngine.KNACK_MAX_LEVEL) return null;   // 上限に達していたら何も起きない
  const level = before + 1;
  state.knacks[knackKey] = level;
  const def = StatsEngine.ABILITIES[knackKey] || {};
  const friend = (state.friends || []).find(f => f.id === friendId);
  const info = {
    name: (friend && friend.name) || (NPC_MEMBERS[friendId] || {}).name || '',
    knackKey, abilityName: def.name || knackKey, level,
    off: Math.round((1 - StatsEngine.knackDiscount(level)) * 100),
  };
  addLog(`${info.name}から${info.abilityName}のコツを教わった！(Lv.${level} / 必要経験点が${info.off}%引き)`, 'money');
  return info;
}

// ===== 超特殊能力(親密度100で習得) =====
function learnSuperAbilityFrom(friendId) {
  const f = state.friends.find(x => x.id === friendId);
  if (!f) return null;
  const got = StatsEngine.learnSuperAbility(state, f);
  if (got) {
    addLog(`${f.name}との絆から「${got.label}」を身につけた！`, 'money');
    state.justSuperAbility = { ...got, friendName: f.name, memberKey: f.memberKey || f.id };
    render();
  }
  return got;
}

function canLearnSuperFrom(friendId) {
  const f = state.friends.find(x => x.id === friendId);
  return StatsEngine.canLearnSuperAbility(state, f);
}

// ===== 定期ライブへの対バン誘い =====
// 親密度50以上のフレンドを、次の定期ライブに誘える。週は消費しない。
// 親密度が高いほど受けてもらいやすい。
const GUEST_INVITE_MIN_INTIMACY = 50;
// 対バン本番に一緒に出たときの親密度(相手から誘われた場合・自分から誘った場合の両方)
const COLLAB_INTIMACY_GAIN = 10;
// こちらから誘う場合は、相手のバンドにギャラを払う。箱が大きいほど高い。
const GUEST_INVITE_GALA = { street: 10000, small: 30000, mid: 80000, zepp: 240000, hall: 500000, budokan: 1000000 };
// 定期ライブの会場は当日に自動で決まるので、誘う時点での見込みの箱でギャラを出す
function guestInviteVenue() { return pickVenueForPlayer(); }
function guestInviteGala(venueKey) {
  const key = venueKey || guestInviteVenue().key;
  return GUEST_INVITE_GALA[key] != null ? GUEST_INVITE_GALA[key] : 30000;
}

// 自分のバンドのメンバー(きさら・いつき)は対バンの相手にはならない。
// 誘えるのは、自分のバンドを持っているフレンド(りょーぺ・たくま)だけ。
function isGuestCandidate(friend) {
  if (!friend || !friend.isNpc) return false;
  const npc = NPC_MEMBERS[friend.memberKey || friend.id];
  const band = (friend.bandName || (npc && npc.bandName) || '').trim();
  return band.length > 0;
}

// レコーディングにゲストとして呼べるフレンド(親密度MAXのたくま・りょーぺのみ)
function recordGuestCandidates() {
  return (state.friends || []).filter(f =>
    RECORD_GUEST_IDS.includes(f.id) && (f.intimacy || 0) >= RECORD_GUEST_MIN_INTIMACY);
}
function canGuestRecord(friendId) {
  return recordGuestCandidates().some(f => f.id === friendId);
}

function canInviteGuest(friendId) {
  // 1回の定期ライブにつき、相手ごとに1度だけ。断られても次のライブまで誘い直せない。
  if ((state.guestAskedThisLive || {})[friendId]) return false;
  if ((state.scheduledGuests || []).some(g => g.id === friendId)) return false;
  if (state.condition === 'fever') return false;
  const f = state.friends.find(x => x.id === friendId);
  if (!isGuestCandidate(f)) return false;
  if ((f.intimacy || 0) < GUEST_INVITE_MIN_INTIMACY) return false;
  if (state.money < guestInviteGala()) return false;      // ギャラが払えない
  return true;
}

// 受けてもらえる確率。親密度50でおよそ5割、100で9割。
function guestAcceptChance(intimacy) {
  if (hasAbility('hitotarashi')) return 0.98;   // 人たらし: ほぼ断られない
  const v = Math.max(0, Math.min(100, intimacy || 0));
  return Math.max(0, Math.min(0.9, 0.5 + (v - GUEST_INVITE_MIN_INTIMACY) * 0.008));
}

// 誘いの返事を出す。週は進めない。
function inviteGuestToLive(friendId) {
  if (!canInviteGuest(friendId)) return null;
  const f = state.friends.find(x => x.id === friendId);
  const npc = NPC_MEMBERS[f.memberKey || f.id] || {};
  const accepted = Math.random() < guestAcceptChance(f.intimacy);
  const liveTurn = state.nextLiveTurn;
  state.guestAskedThisLive = state.guestAskedThisLive || {};
  state.guestAskedThisLive[friendId] = true;   // 受けても断られても、このライブではもう誘えない
  const inviteVenue = guestInviteVenue();
  const gala = guestInviteGala(inviteVenue.key);
  if (accepted) {
    // 断られた場合はギャラは発生しない
    state.money -= gala;
    addLog(`${f.name}(${f.bandName || npc.bandName || ''})へのギャラ${yen(gala)}を払った(${inviteVenue.name})`, 'minus');
    state.scheduledGuests = state.scheduledGuests || [];
    state.scheduledGuests.push({
      id: f.id, memberKey: f.memberKey || f.id,
      name: f.name, bandName: f.bandName || npc.bandName || '',
      fame: npc.fame || f.fame || 0, followers: npc.followers || f.followers || 0,
      turn: liveTurn,
    });
    addIntimacy(f, 3);
    addLog(`${turnToDateLabel(liveTurn)}のライブに${f.name}が出演してくれることになった！`, 'plus');
  } else {
    addLog(`${f.name}は${turnToDateLabel(liveTurn)}の予定が合わなかった…`, 'neutral');
  }
  state.justGuestReply = {
    friendId: f.id, memberKey: f.memberKey || f.id, name: f.name,
    bandName: f.bandName || npc.bandName || '',
    accepted, dateLabel: turnToDateLabel(liveTurn),
    gala: accepted ? gala : 0, venueName: inviteVenue.name,
  };
  render();
  return state.justGuestReply;
}

// 熱で定期ライブに出られない時の中止処理。
// キャンセル料を払い、次回の定期ライブを組み直す。
function cancelScheduledLive() {
  const venue = pickVenueForPlayer();
  const fee = Math.max(LIVE_CANCEL_FEE_MIN, Math.round(venue.cost * LIVE_CANCEL_FEE_RATE));
  const paid = Math.min(state.money, fee);
  state.money -= paid;
  state.liveDayAnnounced = false;
  state.justLiveDayArrived = null;
  state.nextLiveTurn = state.turn + LIVE_INTERVAL_TURNS;
  // 予約していた対バン相手も一緒に流れる
  const cancelledGuests = (state.scheduledGuests || []).slice();
  state.scheduledGuests = [];
  state.guestAskedThisLive = {};   // ライブごと流れたので、次のライブでは誘い直せる
  state.justLiveCancelled = {
    venueName: venue.name, fee: paid,
    shortOfMoney: paid < fee,
    guestName: cancelledGuests.length ? cancelledGuests.map(g => g.name).join('・') : null,
    nextLabel: turnToDateLabel(state.turn + LIVE_INTERVAL_TURNS),
  };
  addLog(`熱のため${venue.name}での定期ライブを中止した(キャンセル料-${yen(paid)})`, 'minus');
  render();
}

// 約束の期限が切れていないか、毎週みる
function checkLabelRequest() {
  if (!state.labelRequest) return;
  if (state.turn <= state.labelRequest.expiryTurn) return;
  state.labelRequest = null;
  state.labelRequestDone = true;
  addLog('レーベルとの約束の期限が過ぎてしまった…', 'minus');
}

function triggerColdEvent() {
  if (state.condition === 'normal') {
    state.condition = 'cold';
  }
  state.justFlavorEvent = {
    title: '体調に注意',
    body: '朝から少し寒気がする。無理をしすぎたのかもしれない…「風邪」の症状が出てきた。',
  };
}

// 各行動の後に呼ばれるメインのイベント抽選ディスパッチャ
// 30%の確率でイベントが発生し、そのうち10%が対バンオファー、残りのうち2%が風邪イベント、それ以外はフレーバーイベント
const EVENT_POOL = [
  // --- 選択肢つきの小イベント ---
  { key: 'street',   weight: 6, cond: () => true,                   fire: () => { state.justChoiceEvent = { key: 'street' }; } },
  { key: 'gear',     weight: 4, cond: () => true,                   fire: () => { state.justChoiceEvent = { key: 'gear' }; } },
  { key: 'sns',      weight: 6, cond: () => state.followers >= 100, fire: () => { state.justChoiceEvent = { key: 'sns' }; } },
  { key: 'magazine', weight: 4, cond: () => state.fame >= 800,      fire: () => { state.justChoiceEvent = { key: 'magazine' }; } },
  { key: 'parent',   weight: 4, cond: () => true,                   fire: () => { state.justChoiceEvent = { key: 'parent' }; } },
  { key: 'onair',    weight: 4, cond: () => state.releases.some(r => r.released), fire: () => { state.justChoiceEvent = { key: 'onair' }; } },
  { key: 'labelreq', weight: 4, cond: () => !!state.indieLabel && !state.labelRequest && !state.labelRequestDone,
    fire: () => { state.justChoiceEvent = { key: 'labelreq' }; } },

  // --- 仲間・お誘い ---
  { key: 'friendOffer', weight: 12, cond: () => state.friends.some(f => isGuestCandidate(f)), fire: () => generateFriendOffer() },
  { key: 'keiba',       weight: 5, cond: () => true,
    fire: () => { state.justKeibaEvent = { raceName: KEIBA_RACE_NAMES[Math.floor(Math.random() * KEIBA_RACE_NAMES.length)] }; } },

  // --- 物語のイベント(前提を満たしている間だけ候補に入る) ---
  { key: 'ryoheiRP3', weight: 9,
    cond: () => state.ryoheiEvents.rp4Done && !state.ryoheiEvents.rp3Done,
    fire: () => { state.ryoheiEvents.rp3Done = true; state.justRyoheiEvent = { key: 'RP3' }; } },
  { key: 'takuma', weight: 9,
    cond: () => !state.takumaEvents.tkm1Done || !state.takumaEvents.tkm2Done || !state.takumaEvents.collabPending,
    fire: () => {
      const ev = state.takumaEvents;
      if (!ev.tkm1Done) state.justTakumaEvent = 'TKM1';
      else if (!ev.tkm2Done) state.justTakumaEvent = 'TKM2';
      else state.justTakumaEvent = 'TKM3';
    } },
  // 他より出にくいレアイベント
  { key: 'drNasakenai', weight: 1,
    cond: () => !state.drNasakenaiEventDone,
    fire: () => { state.justDrNasakenaiEvent = true; } },

  // --- 体調 ---
  // 不動を持っていると、そもそも風邪をひかないのでこのイベントは起きない
  { key: 'cold', weight: 2, cond: () => state.condition === 'normal' && !hasAbility('fudou'), fire: () => triggerColdEvent() },
];

// 未処理のイベントが残っている間は新しく発生させない
function hasPendingEvent() {
  return !!(state.justFriendOffer || state.justFlavorEvent || state.justRyoheiEvent
    || state.justDrNasakenaiEvent || state.justTakumaEvent || state.justIndieLabelOffer
    || state.justKeibaEvent || state.justChoiceEvent || state.justAgencyOffer);
}

function checkRandomEvent() {
  if (hasPendingEvent()) return;
  if (Math.random() >= EVENT_CHANCE) return;
  const pool = EVENT_POOL.filter(e => e.cond());
  const total = pool.reduce((a, e) => a + e.weight, 0);
  if (total <= 0) return;
  let x = Math.random() * total;
  for (const e of pool) {
    x -= e.weight;
    if (x <= 0) { e.fire(); return; }
  }
}

function pickRandomFriend() {
  // 今週フレンドになったばかりの相手は、同じ週のうちに対バンオファーが来ないよう除外する
  // 対バンは相手のバンドと組むもの。自分のバンドのメンバーは相手にならない。
  let pool = state.friends.filter(f => isGuestCandidate(f));
  if (state.ryoheiJustBecameFriend) pool = pool.filter(f => f.id !== 'ryohei');
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomVenueFromKeys(keys) {
  const key = keys[Math.floor(Math.random() * keys.length)];
  return VENUES.find(v => v.key === key);
}

// フレンドの知名度に応じて会場を決める(段階が上がるほど選択肢が広がりランダム性が出る)
function pickVenueForFriend(friend) {
  const fame = friend.fame || 0;
  if (fame >= 15000) return VENUES.find(v => v.key === 'hall');
  if (fame >= 10000) return pickRandomVenueFromKeys(['zepp', 'hall']);
  if (fame >= 8000) return pickRandomVenueFromKeys(['zepp', 'mid']);
  if (fame >= 5000) return pickRandomVenueFromKeys(['zepp', 'mid', 'small']);
  if (fame >= 1000) return VENUES.find(v => v.key === 'mid');
  return VENUES.find(v => v.key === 'small');
}

function generateFriendOfferGala(venueKey) {
  const base = 10000 + Math.random() * 15000;
  const fameBonus = Math.min(35000, (state.fame / 50000) * 35000);
  const followerBonus = Math.min(20000, (state.followers / 100000) * 20000);
  const labelBonus = state.agencyStatus === 'major' ? 20000 : 0;
  return Math.min(100000, Math.max(10000, Math.round((base + fameBonus + followerBonus + labelBonus) / 1000) * 1000));
}

// 対バンオファーの本体生成(新イベント抽選・旧ロールの両方から呼ばれる)
function generateFriendOffer() {
  const friend = pickRandomFriend();
  if (!friend) return;
  const venue = pickVenueForFriend(friend);
  const gala = generateFriendOfferGala(venue.key);
  state.justFriendOffer = {
    friendId: friend.id,
    friendName: friend.name,
    bandName: friend.bandName,
    friendFame: friend.fame || 0,
    friendFollowers: friend.followers || 0,
    venueKey: venue.key,
    gala,
    isRyoheiRP2: friend.id === 'ryohei', // RP1でフレンドになった後は常にこの文言(RP2)を使う
  };
}

function finalizeFriendOfferLive(offer, memberKeys) {
  memberKeys = memberKeys || [];
  const venue = VENUES.find(v => v.key === offer.venueKey) || VENUES[0];
  const memberCost = memberKeys.length * memberHireCost();
  if (state.money < memberCost) { notifyInsufficientFunds(); render(); return; }
  state.money -= memberCost;

  // インフレ防止: 自分のステータスを重視した集客計算(自分75% : フレンド25%)
  const npcRef = NPC_MEMBERS[offer.friendId] || {};
  const friendFame = Number(offer.friendFame) || npcRef.fame || 0;
  const friendFollowers = Number(offer.friendFollowers) || npcRef.followers || 0;
  const fameScore = (state.fame || 0) * 0.75 + friendFame * 0.25;
  const followerScore = (state.followers || 0) * 0.75 + friendFollowers * 0.25;
  const fillRate = Math.min(1, 0.25 + fameScore / 60000 + followerScore / 120000);
  const promoAudience = state.liveExtraAudience || 0;
  const audience = Math.min(venue.capacity, Math.round((venue.capacity * fillRate + promoAudience) * liveAudienceMult()));
  state.liveExtraAudience = 0; // 対バンライブでも宣伝効果は消費する(定期ライブと同じ扱い)
  const fameGain = Math.round(audience * 0.22 * FAME_GROWTH);
  const followerGain = Math.round(fameGain * 0.6);

  addMoney(offer.gala);
  state.fame += fameGain;
  state.followers += followerGain;
  state.monthlyPerformance += audience;
  grantExp(rollExpFromRanges({ str: [20, 30], ski: [20, 30], int: [20, 30], men: [20, 30] }));
  addLog(`${offer.friendName}(${offer.bandName})との対バンに出演！${venue.name} 動員${audience.toLocaleString()}人 ギャラ+${yen(offer.gala)} 知名度+${fameGain}`, 'plus');
  const isRyoheiFirstCollab = offer.friendId === 'ryohei' && !state.ryoheiEvents.rp4Done;
  if (offer.friendId === 'ryohei') {
    const friend = state.friends.find(f => f.id === 'ryohei');
    const intimacyDelta = offer.isRyoheiRP2 ? 7 : 0;
    if (friend && intimacyDelta) {
      addIntimacy(friend, intimacyDelta);
      addLog(`りょーぺとの親密度が${intimacyDelta}上がった`, 'plus');
    }
    if (isRyoheiFirstCollab) {
      state.ryoheiEvents.rp4Done = true; // RP4はこの直後の打ち上げでui.js側が明示的に表示する
    }
  }
  // 対バンが終わったら予約を解除する。これをしないと、たくまのイベントが
  // 「対バン予約済み」の判定に引っかかって二度と出なくなる。
  if (offer.friendId === 'takuma') {
    state.takumaEvents.collabPending = false;
    state.takumaEvents.collabTurn = null;
    state.takumaEvents.collabAnnounced = false;
    state.takumaPendingOffer = null;
  }
  // りょーぺ側も同じように解除する。これを忘れると予約が残り続け、
  // 毎週「りょーぺとの対バンの日」になってしまう。
  if (offer.friendId === 'ryohei') {
    state.ryoheiEvents.firstCollabScheduled = false;
    state.ryoheiEvents.firstCollabTurn = null;
    state.ryoheiEvents.firstCollabAnnounced = false;
    state.ryoheiPendingOffer = null;
  }
  // 一緒にステージに立ったぶん、相手との距離が縮まる
  let collabIntimacyGain = 0;
  {
    const collabFriend = state.friends.find(f => f.id === offer.friendId);
    if (collabFriend) {
      const before = collabFriend.intimacy || 0;
      addIntimacy(collabFriend, COLLAB_INTIMACY_GAIN);
      collabIntimacyGain = (collabFriend.intimacy || 0) - before;
      if (collabIntimacyGain > 0) addLog(`${collabFriend.name}との親密度が${collabIntimacyGain}上がった`, 'plus');
    }
  }
  const collabKnack = rollFriendKnack(offer.friendId, 'live');
  const info = { knacksLearned: collabKnack ? [collabKnack] : [], collabIntimacyGain, friendId: offer.friendId, friendName: offer.friendName, bandName: offer.bandName, venueName: venue.name, venueKey: venue.key, audience, fameGain, gala: offer.gala, isRyoheiFirstCollab };
  state.justCollabLive = info;
  render();
  return info;
}

function resolveRyoheiRP3(returned) {
  const friend = state.friends.find(f => f.id === 'ryohei');
  if (returned) {
    state.money -= 2000;
    grantExp({ str: 10, ski: 10, int: 10 });
    if (friend) addIntimacy(friend, 10);
    addLog('りょーぺに2,000円返した', 'minus');
    addLog('りょーぺとの親密度が10上がった', 'plus');
  } else {
    grantExp({ men: 30 });
    if (friend) friend.intimacy = (friend.intimacy || 0) - 5;
    addLog('りょーぺへの借金を踏み倒した…', 'minus');
    addLog('りょーぺとの親密度が5下がった', 'minus');
  }
  render();
}

// ===== たくま(KAME)イベント =====
// TKM1: フレンドになる(サクセス中1回)。TKM2: 趣味の話(サクセス中1回、TKM1後)。
// TKM3: 対バンオファー(TKM1後、回数制限なし)。いずれも「その日の行動後」に判定する。
// テスト用: 1週目にTKM1、2週目にTKM2、3週目にTKM3を確実に発生させる。
// 確認が済んだらfalseに戻し、本来の確率抽選(5%/5%/8%)に戻す。
function resolveTakumaTkm1() {
  state.takumaEvents.tkm1Done = true;
  state.friends.push({
    id: 'takuma', memberKey: 'takuma', isNpc: true,
    name: NPC_MEMBERS.takuma.name, bandName: NPC_MEMBERS.takuma.bandName,
    part: NPC_MEMBERS.takuma.part, stats: { ...NPC_MEMBERS.takuma.stats }, abilities: [...NPC_MEMBERS.takuma.abilities],
    fame: NPC_MEMBERS.takuma.fame, followers: NPC_MEMBERS.takuma.followers, intimacy: 10,
  });
  addLog('たくまとの親密度が10上がった', 'plus');
  addLog('たくまがフレンドになった！', 'money');
  render();
}

// choiceKey: 'agree'(その気持ちわかる) | 'huh'(は？)
function resolveTakumaTkm2(choiceKey) {
  state.takumaEvents.tkm2Done = true;
  const friend = state.friends.find(f => f.id === 'takuma');
  if (choiceKey === 'agree') {
    grantExp(rollExpFromRanges({ int: [10, 20], men: [10, 20] }));
    if (friend) {
      addIntimacy(friend, 5);
      addLog('たくまとの親密度が5上がった', 'plus');
    }
  } else {
    grantExp(rollExpFromRanges({ str: [10, 20], ski: [10, 20] }));
  }
  render();
}

// TKM3: オファーを受ける。定期ライブと被らない日程で2週間後に対バンを決める。
function acceptTakumaCollab(preComputedTurn) {
  // TKM3の台詞で提示した日付とズレないよう、可能であれば呼び出し元が計算済みのturnをそのまま使う。
  let targetTurn = preComputedTurn;
  if (!targetTurn) {
    targetTurn = state.turn + 2;
    if (targetTurn === state.nextLiveTurn) targetTurn += 1;
  }
  const npc = NPC_MEMBERS.takuma;
  const venue = pickVenueForFriend(npc);
  const gala = generateFriendOfferGala(venue.key);
  state.takumaEvents.collabPending = true;
  state.takumaEvents.collabTurn = targetTurn;
  state.takumaEvents.collabAnnounced = false;
  state.takumaPendingOffer = {
    friendId: 'takuma', friendName: npc.name, bandName: npc.bandName,
    friendFame: npc.fame, friendFollowers: npc.followers,
    venueKey: venue.key, gala,
  };
  const friend = state.friends.find(f => f.id === 'takuma');
  if (friend) {
    addIntimacy(friend, 5);
    addLog('たくまとの親密度が5上がった', 'plus');
  }
  addLog(`たくまとの対バンが${turnToDateLabel(targetTurn)}に決まった`, 'plus');
  render();
}

function declineTakumaCollab() {
  const friend = state.friends.find(f => f.id === 'takuma');
  if (friend) {
    friend.intimacy = Math.max(0, (friend.intimacy || 0) - 5);
    addLog('たくまとの親密度が5下がった', 'minus');
  }
  addLog('たくまとの対バンの誘いを断った', 'minus');
  render();
}

// ===== ナサケナーイ博士イベント(1サクセスにつき1回、本来は3%抽選) =====
// ===== きさらの競馬イベント =====
// 「その日の行動後」に5%で発生する。当日のレース名はここで決める。
const KEIBA_EVENT_RATE = 0.05;
const KEIBA_BET_LIMIT = 10000;      // 1レースの賭け金上限
// 払い戻しの上限。三連単は万馬券どころか1万倍を超えることがあり、
// 上限が無いと1回の的中でサクセス2年分の収入を軽く超えてしまうため頭を抑えている。
const KEIBA_PAYOUT_LIMIT = 1000000;
const KEIBA_RACE_NAMES = [
  '皐月記念', '桜花記念', '菊花記念', '有明記念', '若葉記念',
  '大川記念', 'ロケット記念', '宵待月記念', '新緑記念', '師走記念',
];
// 馬券を買う。所持金が足りなければfalseを返して何もしない。
function placeKeibaBet(amount) {
  const bet = Math.min(KEIBA_BET_LIMIT, Math.max(0, Math.round(amount)));
  if (bet <= 0 || state.money < bet) { notifyInsufficientFunds(); render(); return false; }
  state.money -= bet;
  return true;
}

// 払い戻し。当たっていなければ0を渡す。
function receiveKeibaPayout(payout, betAmount, raceName, label) {
  const raw = Math.max(0, Math.round(payout));
  const p = Math.min(KEIBA_PAYOUT_LIMIT, raw);
  if (p > 0) {
    addMoney(p);
    const capped = raw > p ? `(上限${yen(KEIBA_PAYOUT_LIMIT)})` : '';
    addLog(`${raceName} ${label}が的中！払い戻し+${yen(p)}${capped}(購入${yen(betAmount)})`, 'money');
  } else {
    addLog(`${raceName} ${label}ははずれ…(-${yen(betAmount)})`, 'minus');
    // 負けが込むと悪いクセがつくことがある(5%)
    if (betAmount > 0 && Math.random() < 0.05) {
      const got = StatsEngine.grantRandomNegative(state);
      if (got) {
        state.justNegativeAbility = got;
        addLog(`${got.label}がついてしまった…`, 'minus');
      }
    }
  }
  render();
}

// key: 'genki'|'strong'|'money'|'fame'  戻り値: { success, segments }
function resolveDrNasakenaiChoice(key) {
  const segments = [];
  let success = false;
  if (key === 'nothing') {
    success = true;
    segments.push({ text: '無事に家に帰れた…', type: 'neutral' });
  } else if (key === 'genki') {
    success = true;
    state.maxHealthMult = 120;
    state.health = state.maxHealthMult;
    segments.push({ text: '体力が最大まで回復した', type: 'plus' });
    segments.push({ text: '体力の最大値が20%増えた(120%になった)', type: 'plus' });
  } else if (key === 'strong') {
    success = Math.random() < 0.25;
    if (success) {
      StatsEngine.STAT_ORDER.forEach(k => { state.stats[k] = (state.stats[k] || 0) + 10; });
      grantExp({ str: 100, ski: 100, int: 100, men: 100 });
      segments.push({ text: '各ステータスが10ずつ上がった', type: 'plus' });
      segments.push({ text: '各経験点を100ずつ得た', type: 'plus' });
      if (Math.random() < 0.2) {
        state.abilities.push({ key: 'sense', tier: 'normal' });
        segments.push({ text: 'センス◯を身につけた！', type: 'money' });
      }
    } else {
      StatsEngine.STAT_ORDER.forEach(k => { state.stats[k] = Math.max(0, (state.stats[k] || 0) - 7); });
      Object.keys(state.expPool).forEach(c => { state.expPool[c] = Math.max(0, (state.expPool[c] || 0) - 50); });
      segments.push({ text: '各ステータスが7ずつ下がった', type: 'minus' });
      segments.push({ text: '各経験点が50ずつ減った', type: 'minus' });
      // 失敗すると、そこそこの確率で悪いクセがついてしまう
      if (Math.random() < 0.45) {
        const got = StatsEngine.grantRandomNegative(state);
        if (got) {
          addLog(`${got.label}がついてしまった…`, 'minus');
          segments.push({ text: `${got.label}がついてしまった…`, type: 'minus' });
        }
      }
    }
  } else if (key === 'money') {
    success = Math.random() < 0.8;
    if (success) {
      addMoney(100000);
      segments.push({ text: '100,000円を手に入れた！', type: 'money' });
    } else {
      state.money = Math.max(0, state.money - 50000);
      segments.push({ text: '50,000円失った…', type: 'minus' });
    }
  } else if (key === 'fame') {
    success = Math.random() < 0.5;
    if (success) {
      state.fame += 1000;
      state.followers += 1000;
      segments.push({ text: '知名度が1000上がった', type: 'plus' });
      segments.push({ text: 'フォロワーが1000人増えた', type: 'plus' });
    } else {
      state.fame = Math.max(0, state.fame - 300);
      state.followers = Math.max(0, state.followers - 300);
      segments.push({ text: '知名度が300下がった', type: 'minus' });
      segments.push({ text: 'フォロワーが300人減った', type: 'minus' });
    }
  }
  state.drNasakenaiEventDone = true;
  state.justDrNasakenaiEvent = false;
  render();
  return { success, segments };
}


// りょーぺのオファーを受ける。たくま(acceptTakumaCollab)と同じく、
// 定期ライブと被らない週で2週間後に対バンを決める。2回目以降のオファーでも呼ばれるため、
// 「当日を知らせたか」のフラグも毎回リセットする。
function scheduleRyoheiCollab(offer) {
  let targetTurn = state.turn + 2;
  if (targetTurn === state.nextLiveTurn) targetTurn += 1;
  state.ryoheiEvents.firstCollabScheduled = true;
  state.ryoheiEvents.firstCollabTurn = targetTurn;
  state.ryoheiEvents.firstCollabAnnounced = false;
  state.ryoheiPendingOffer = offer;
  addLog(`りょーぺとの対バンが${turnToDateLabel(targetTurn)}に決まった`, 'plus');
  render();
}

function declineFriendOffer(offer) {
  state.mailIdSeq = state.mailIdSeq || 1;
  state.mailbox.unshift({
    id: state.mailIdSeq++,
    offer: offer,
    expiryTurn: state.turn + 1,
    read: false,
  });
  if (offer.friendId === 'ryohei' && offer.isRyoheiRP2) {
    const friend = state.friends.find(f => f.id === 'ryohei');
    if (friend) {
      friend.intimacy = (friend.intimacy || 0) - 5;
      addLog('りょーぺとの親密度が5下がった', 'minus');
    }
  }
  addLog(`${offer.friendName}からの対バンオファーを見送った(メールポストで1週間有効)`, 'neutral');
  render();
}

// ===== アクション: 自分から対バンを主催する =====
function hostCollabLive(friendId, venueKey, memberKeys) {
  const friend = state.friends.find(f => f.id === friendId);
  const venue = VENUES.find(v => v.key === venueKey);
  if (!friend || !venue) return;
  memberKeys = memberKeys || [];
  const totalCost = venue.cost + memberKeys.length * memberHireCost();
  if (state.money < totalCost) { notifyInsufficientFunds(); render(); return; }
  state.money -= totalCost;

  const audience = Math.min(venue.capacity, Math.round(venue.capacity * Math.min(1, 0.3 + (state.fame + friend.fame) / 150000 + (state.followers + friend.followers) / 300000) * liveAudienceMult()));
  const revenue = Math.round(audience * venue.ticket * 0.9);
  const profit = revenue - totalCost;
  const fameGain = Math.round(audience * 0.25 * FAME_GROWTH);
  const followerGain = Math.round(fameGain * 0.6);
  addMoney(revenue);
  state.fame += fameGain;
  state.followers += followerGain;
  state.monthlyPerformance += audience;
  grantExp(rollExpFromRanges({ str: [20, 30], ski: [20, 30], int: [20, 30], men: [20, 30] }));
  addLog(`${friend.name}(${friend.bandName})と対バン開催！${venue.name} 動員${audience.toLocaleString()}人 利益${yen(profit)} 知名度+${fameGain}`, profit >= 0 ? 'plus' : 'minus');
  const info = { friendId: friend.id, friendName: friend.name, bandName: friend.bandName, venueName: venue.name, venueKey: venue.key, audience, fameGain, profit, isRyoheiFirstCollab: false };
  state.justCollabLive = info;
  render();
  return info;
}

// ===== ユーティリティ =====
const yen = n => '¥' + Math.round(n).toLocaleString();
// ライブの出来に使う「演奏面の平均」。skillsの成長を廃止したので実ステータスから出す。
const avgSkill = () => {
  const st = state.stats || {};
  return ((st.vocal || 0) + (st.play || 0) + (st.performance || 0)) / 3;
};

// ===== ターン(週)制の日付システム =====
// 1回の行動(アルバイト・練習など)ごとに1週間が経過する。
// 1ヶ月=4週、1年=12ヶ月として、8月開始・2年間(96ターン)で計算する。
const WEEKS_PER_MONTH = 4;
const MONTHS_PER_YEAR = 12;
const START_MONTH = 8; // 8月開始
// サクセスの長さ。2年半 = 30ヶ月 × 4週 = 120ターン。
const SUCCESS_MONTHS = 30;
const TOTAL_TURNS = SUCCESS_MONTHS * WEEKS_PER_MONTH; // 120ターン=2年半
const LIVE_INTERVAL_TURNS = 8; // 2ヶ月(8週)に1回、定期ライブがある
// たくまとの出会い(TKM1)は必ずサクセス序盤に起きる。
// 通常のイベント抽選でこの週までに出会えていなければ、強制的に発生させる。
const TAKUMA_MEETING_DEADLINE = 12; // 3ヶ月(12週)
// 熱を出したまま定期ライブの日を迎えたら、出られないので中止する。
// 会場のキャンセル料を払い、次の定期ライブまで待つことになる。
const LIVE_CANCEL_FEE_RATE = 0.3;   // 会場費の3割
const LIVE_CANCEL_FEE_MIN = 5000;

// turn(1始まり) → { year, month, weekOfMonth }
function turnToDate(turn) {
  const idx = Math.max(0, turn - 1);
  const weekOfMonth = (idx % WEEKS_PER_MONTH) + 1;
  const monthIdxInYear = Math.floor(idx / WEEKS_PER_MONTH) % MONTHS_PER_YEAR;
  const year = Math.floor(idx / (WEEKS_PER_MONTH * MONTHS_PER_YEAR)) + 1;
  const month = ((START_MONTH - 1 + monthIdxInYear) % MONTHS_PER_YEAR) + 1;
  return { year, month, weekOfMonth };
}
function turnToDateLabel(turn) {
  const { year, month, weekOfMonth } = turnToDate(turn);
  return `${year}年目 ${month}月${weekOfMonth}週`;
}
function addLog(msg, type) {
  state.log.unshift({ msg, type: type || 'neutral' });
  if (state.log.length > 8) state.log.pop();
  state.logHistory = state.logHistory || [];
  state.logHistory.unshift({ msg, type: type || 'neutral', turn: state.turn });
  if (state.logHistory.length > 300) state.logHistory.pop();
}
// 収入を加算する共通ヘルパー。エンディングで表示する「総取得金額」を正確に積算するために使う。
function addMoney(amount) {
  if (!amount) return;
  state.money += amount;
  state.totalEarnings = (state.totalEarnings || 0) + amount;
}
// お金が足りない場合に画面上へ小さなポップアップを出すための共通ヘルパー
function notifyInsufficientFunds() {
  state.justInsufficientFunds = true;
}

function generateSongTitle() {
  const adjectives = ['夜明けの', '最後の', '君だけの', '灰色の', '透明な', '嘘みたいな', 'まだ見ぬ', '壊れかけの'];
  const nouns = ['コード', 'シグナル', '約束', 'メロディ', '夜空', '衝動', '声', '答え'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  return a + n;
}

function generateAlbumTitle() {
  const adjectives = ['夜明けの', '青春の', '孤独な', '眩しい', '果てなき', '名もなき', '不完全な', '約束の'];
  const nouns = ['物語', '軌跡', '断片', '証明', '記憶', '景色', '鼓動', '足跡'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  return a + n;
}

function cdTypeOf(typeKey) {
  return CD_TYPES.find(t => t.key === typeKey);
}

// 売値が価格帯のどのあたりかで需要が変わる(安いほど売れやすく、高いほど単価は良いが売れにくい)
function priceFactor(price, typeKey) {
  const type = cdTypeOf(typeKey);
  const t = Math.min(1, Math.max(0, (price - type.priceMin) / (type.priceMax - type.priceMin)));
  return 1.3 - t * 0.7; // 1.3(最安値) 〜 0.6(最高値)
}

// ===== 体力・体調 =====
function conditionMult() {
  if (state.condition === 'cold') return { money: 0.8, exp: 0.6, skill: 0.7 };
  return { money: 1, exp: 1, skill: 1 };
}

// やる気(StatsEngine用、5段階)を現在の体調から算出
function currentMotivationIndex() {
  if (state.condition === 'greatCondition') return 4; // 絶好調
  if (state.condition === 'fever') return 0;           // 絶不調
  if (state.condition === 'cold') return 1;             // 不調
  return 2; // 普通
}
function isSickForExp() {
  return state.condition === 'cold' || state.condition === 'fever';
}
// 新エンジン(経験点)への加算をまとめて行うヘルパー
// ---- 経験点のばらつき用ヘルパー ----
// rangeSpec: { str: [min,max], ski: [min,max], ... } → 各カテゴリごとに範囲内でランダムな値を出す
function randInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rollExpFromRanges(rangeSpec) {
  const out = {};
  Object.keys(rangeSpec || {}).forEach(cat => {
    const range = rangeSpec[cat];
    out[cat] = Array.isArray(range) ? randInRange(range[0], range[1]) : range;
  });
  return out;
}

// 親密度の増減。コミュ力◯を持っていると上がり幅が増える(下がり幅は変わらない)。
function addIntimacy(friend, amount) {
  if (!friend) return 0;
  let delta = amount;
  if (delta > 0 && hasAbility('charisma')) delta = Math.round(delta * 1.5);
  if (delta > 0 && hasAbility('hitotarashi')) delta = Math.round(delta * 2);   // 人たらし
  const before = friend.intimacy || 0;
  friend.intimacy = Math.max(0, Math.min(100, before + delta));   // 上限100
  return friend.intimacy - before;
}

function grantExp(gains) {
  if (!gains) return null;
  state.motivation = currentMotivationIndex();
  state.sick = isSickForExp();
  const mult = StatsEngine.getExpMultiplier(state.motivation, state.sick);
  const applied = StatsEngine.applyMultiplier(gains, mult);
  StatsEngine.gainExp(state.expPool, applied);
  Object.keys(applied).forEach(cat => {
    if (applied[cat] > 0) {
      addLog(`${StatsEngine.EXP_CATEGORY_NAMES[cat]}経験点を${applied[cat]}得た`, 'plus');
    }
  });
  return applied;
}
// アルバイトの熟練度を上げ、MAXになったら対応する特殊能力を自動習得する
function gainJobMastery(jobKey, amount) {
  state.jobMastery = state.jobMastery || {};
  const prev = state.jobMastery[jobKey] || 0;
  state.jobMastery[jobKey] = Math.min(100, prev + amount);
  if (prev < 100 && state.jobMastery[jobKey] >= 100) {
    const abilityKey = JOB_MASTERY_ABILITY[jobKey];
    if (abilityKey) {
      const r = StatsEngine.tryUnlockAbility(state, abilityKey);
      if (r.ok) addLog(`アルバイトの熟練度がMAXになり、特殊能力「${r.label}」を習得した！`, 'plus');
    }
  }
}

function applyHealthCost(percent, skipSicknessCheck) {
  const healthBefore = state.health;
  const drainMult = state.condition === 'greatCondition' ? 0.5 : 1.0;
  state.health = Math.max(0, Math.round(state.health - percent * drainMult));
  const actualDrop = healthBefore - state.health;
  if (actualDrop > 0) {
    addLog(`体力が${actualDrop}下がった`, 'minus');
  }
  if (!skipSicknessCheck) checkSickness(healthBefore);
}

function checkSickness(healthBefore) {
  if (hasAbility('fudou')) return;   // 不動: 体調を崩さない
  if (healthBefore > 50) return;
  let severity = (50 - healthBefore) / 50; // 0〜1
  // 柔軟性◯: 体調を崩しにくい / 行動力◯: 好調を保ちやすい
  if (hasAbility('flex')) severity *= 0.6;
  if (hasAbility('drive')) severity *= 0.75;
  if (state.condition === 'cold') {
    const chance = 0.15 + severity * 0.35;
    if (Math.random() < chance) {
      state.condition = 'fever';
      state.feverTurnsLeft = 3;
      addLog('無理がたたって熱を出してしまった…3週間動けない', 'minus');
    }
  } else if (state.condition === 'normal' || state.condition === 'greatCondition') {
    const chance = 0.1 + severity * 0.3;
    if (Math.random() < chance) {
      state.condition = 'cold';
      addLog('体調を崩して風邪をひいてしまった…', 'minus');
    }
  }
}

function isFeverBlocked() {
  if (state.condition === 'fever') {
    addLog(`熱で何もできません。あと${state.feverTurnsLeft}週安静に`, 'minus');
    render();
    return true;
  }
  return false;
}

// ===== アクション: 休む =====
function doRest() {
  const wasCold = state.condition === 'cold';
  const wasFever = state.condition === 'fever';
  state.health = state.maxHealthMult || 100;
  if (!wasFever && wasCold) {
    state.condition = 'normal';
    state.hungover = false;
    addLog('しっかり休んで体調が回復した', 'plus');
  } else if (wasFever) {
    addLog('安静にしている…', 'neutral');
  } else {
    addLog('しっかり休んで体力が全回復した', 'plus');
  }
  advanceWeek({ skipEvents: true }); // 休んだ後はランダムイベントを発生させない
  render();
}

// ===== ターンの進行(1回の行動=1週間) =====
function advanceWeek(opts) {
  const skipEvents = opts && opts.skipEvents;
  const actionTurn = state.turn; // この行動を起こした「当日」のturn(インクリメント前)

  // 前の行動までに完成していた曲があれば、新しい1日の最初に成果を出す(この判定自体は日付を進めない)
  if (state.songInProgress && state.songInProgress.weeksLeft <= 0) {
    finalizeSongProduction();
  }

  state.turn += 1;

  // 人気の自然減衰(1週ぶん)。根強い人気◯で半分、不人気×で1.5倍。
  // 減るのは「定着した層」を超えたぶんだけ。積み上げた実績は残る。
  let decayMult = 1;
  if (hasAbility('loyal')) decayMult *= 0.5;
  if (hasAbility('unpopular')) decayMult *= 1.5;
  state.peakFame = Math.max(state.peakFame || 0, state.fame);
  state.peakFollowers = Math.max(state.peakFollowers || 0, state.followers);
  const fameFloor = state.peakFame * FAME_FLOOR_RATIO;
  const followerFloor = state.peakFollowers * FOLLOWER_FLOOR_RATIO;
  if (state.fame > fameFloor) {
    state.fame = Math.max(fameFloor, state.fame - (state.fame - fameFloor) * FAME_DECAY * decayMult);
  }
  if (state.followers > followerFloor) {
    state.followers = Math.max(followerFloor, state.followers - (state.followers - followerFloor) * FOLLOWER_DECAY * decayMult);
  }

  // 浪費癖×: 毎週わずかにお金が減る
  if (hasAbility('spender') && state.money > 0) {
    const loss = Math.min(state.money, Math.round(2000 + state.money * 0.007));
    state.money -= loss;
    addLog(`つい使ってしまった(-${yen(loss)})`, 'minus');
  }

  const d = turnToDate(state.turn);
  state.year = d.year;
  state.month = d.month;
  state.weekOfMonth = d.weekOfMonth;

  // 熱の経過(週単位)
  if (state.condition === 'fever') {
    state.feverTurnsLeft -= 1;
    if (state.feverTurnsLeft <= 0) {
      state.condition = 'normal';
      state.hungover = false;
      state.health = 70;
      addLog('熱が下がり、動けるようになった', 'plus');
    }
  } else if (state.condition === 'greatCondition') {
    state.greatConditionTurnsLeft -= 1;
    if (state.greatConditionTurnsLeft <= 0) {
      state.condition = 'normal';
    }
  } else if (state.condition === 'normal' && Math.random() < GREAT_CONDITION_CHANCE) {
    state.condition = 'greatCondition';
    state.greatConditionTurnsLeft = 2;
    addLog('絶好調だ！体力の減りが抑えられる', 'plus');
  }

  // 制作中の曲の進行(週単位)。ここでは残り週数を減らすだけで、完成の演出は次回のadvanceWeek冒頭で行う。
  if (state.songInProgress) {
    state.songInProgress.weeksLeft -= 1;
  }

  // グッズの在庫販売(1ターン=1週間ごとに販売機会がある。売れ行きの調整は
  // 「グッズ」フェーズで別途行う)
  processGoodsSalesDaily();

  // CD売上は1ターン=1週間ごとに処理する(生活費の徴収は仕様により廃止)
  processWeeklyCDSales();
  if (state.weekIncome > 0 || state.weekUnitsSold > 0) {
    addLog(`CD収入 ${yen(state.weekIncome)} / 売上 ${state.weekUnitsSold}枚`, state.weekIncome > 0 ? 'money' : 'neutral');
  }
  state.weekIncome = 0;
  state.weekUnitsSold = 0;

  // 月の区切り(4週間ごと): 事務所まわりの処理
  if (state.weekOfMonth === WEEKS_PER_MONTH) {
    processMonthlyAgency();
  }

  if (state.brokenGearTurns > 0) {
    state.brokenGearTurns -= 1;
    if (state.brokenGearTurns === 0) addLog('機材のガタつきが落ち着いてきた', 'neutral');
  }
  checkLabelRequest();
  checkAgencyOffers();
  checkTakumaMeeting();
  if (!skipEvents) {
    checkRandomEvent();   // 30%でイベントが1つ発生する(中身はEVENT_POOLから抽選)
  }
  state.ryoheiJustBecameFriend = false; // このターンの抽選が終わったので次回からは対象に含める

  // 定期ライブの日が来たら、主人公の吹き出しで知らせる(1サイクルにつき1回)
  if (state.turn >= state.nextLiveTurn && !state.liveDayAnnounced) {
    // 熱で寝込んでいる時は出演できないので、ライブ自体を中止する
    if (state.condition === 'fever') {
      cancelScheduledLive();
    } else {
      state.liveDayAnnounced = true;
      state.justLiveDayArrived = { venueName: pickVenueForPlayer().name };
    }
  }

  // りょーぺとの対バンの日が来たら知らせる
  if (state.ryoheiEvents.firstCollabScheduled && !state.ryoheiEvents.firstCollabAnnounced && state.turn >= state.ryoheiEvents.firstCollabTurn) {
    state.ryoheiEvents.firstCollabAnnounced = true;
    state.justRyoheiCollabDay = true;
  }

  // たくまとの対バンの日が来たら知らせる
  if (state.takumaEvents.collabPending && !state.takumaEvents.collabAnnounced && state.turn >= state.takumaEvents.collabTurn) {
    state.takumaEvents.collabAnnounced = true;
    state.justTakumaCollabDay = true;
  }

  // 2年間(96ターン)経過でサクセス終了。
  // このフラグを見たUI側(showStartOfDayPopupsIfAny)がエンディングの演出に入る。
  if (state.turn >= TOTAL_TURNS && !state.gameEnded) {
    state.gameEnded = true;
    addLog('2年半のサクセス期間が終了した', 'neutral');
  }
}

// リリース済みCDの売上は「週1回・最大4週間(1ヶ月)」だけ発生する
function processWeeklyCDSales() {
  state.releases.forEach(r => {
    if (!r.released || !r.salesActive) return;
    r.weeksElapsed = (r.weeksElapsed || 0) + 1;
    if (r.weeksElapsed > 4) {
      r.salesActive = false;
      return;
    }
    const decay = Math.max(0.15, 1 - (r.weeksElapsed - 1) / 4);
    const pf = priceFactor(r.price, r.type);
    const qualityFactor = Math.pow(r.completionAvg / 100, 1.2);
    const units = Math.max(3, Math.round(qualityFactor * r.songCount * 12 * decay * (1 + state.fame / 20000) * (1 + state.followers / 45000) * pf * cdSalesMult()));
    const income = units * r.price;
    if (units > 0) {
      r.totalSold += units;
      addMoney(income);
      state.weekIncome += income;
      state.weekUnitsSold += units;
      state.monthlyPerformance += units;
      addLog(`「${r.title}」週間売上 ${units.toLocaleString()}枚(+${yen(income)})`, 'money');
    }
  });
}

// ジャンル熟練度: 通常→青→緑→赤→金 の順で色が変わる(仕様どおり)
const GENRE_MASTERY_TIERS = [
  { min: 0,  key: 'normal', label: '通常', color: '#5A5A62' },
  { min: 25, key: 'blue',   label: '青',   color: '#5B8DEF' },
  { min: 50, key: 'green',  label: '緑',   color: '#6ABF6A' },
  { min: 75, key: 'red',    label: '赤',   color: '#E06A6A' },
  { min: 100, key: 'gold',  label: '金',   color: '#FFD166' },
];
function genreMasteryTier(mastery) {
  const v = mastery || 0;
  let tier = GENRE_MASTERY_TIERS[0];
  GENRE_MASTERY_TIERS.forEach(t => { if (v >= t.min) tier = t; });
  return tier;
}

// 作曲画面に出す「完成度の見込み」。実際の計算(finalizeSongProduction)と
// 同じ式を使う。以前は廃止した旧ステータス(skills)で別計算していて、
// 画面には12くらいと出るのに実際は70前後できる、という食い違いになっていた。
function predictSongCompletion(genre) {
  const st = state.stats || {};
  const mastery = (state.genreMastery && genre) ? (state.genreMastery[genre] || 0) : 0;
  const masteryBonus = (mastery / 100) * 18;
  const base = ((st.compose || 0) * 1.5 + (st.vocal || 0) + (st.play || 0)) / 3 * SONG_STAT_WEIGHT + masteryBonus;
  const earBonus = 1 + abilityTier('onkan') * 0.05 + abilityTier('rhythm') * 0.03;
  const mid = hasAbility('focus') ? 5 : 5;   // trendBonusの期待値
  return Math.max(1, Math.min(100, Math.round((base + mid) * earBonus)));
}

function finalizeSongProduction() {
  const draft = state.songInProgress;
  const sick = isSickForExp();
  state.genreMastery = state.genreMastery || {};
  const mastery = state.genreMastery[draft.genre] || 0;
  const masteryBonus = (mastery / 100) * 18; // 熟練度MAXで+18点相当
  const st = state.stats || {};
  // skillsの成長を廃止したので、実際に育つ5ステータスから完成度を出す
  const base = ((st.compose || 0) * 1.5 + (st.vocal || 0) + (st.play || 0)) / 3 * SONG_STAT_WEIGHT + masteryBonus;
  // 集中力◯: 出来のブレ幅が小さくなり、低い完成度を引きにくくなる
  const spread = hasAbility('focus') ? 10 : 20;
  const offset = hasAbility('focus') ? 0 : -5;
  const trendBonus = (Math.random() * spread) + offset;
  // 音感・リズム感は完成度を底上げする
  const earBonus = 1 + abilityTier('onkan') * 0.05 + abilityTier('rhythm') * 0.03;
  let completion = Math.max(1, Math.min(100, Math.round((base + trendBonus) * earBonus)));
  if (sick) completion = Math.max(1, Math.round(completion * 0.75)); // 体調不良で完成度が下がる
  const song = {
    id: state.songIdSeq++,
    title: draft.title,
    genre: draft.genre,
    completion,
    used: false,
  };
  state.songs.unshift(song);
  state.songInProgress = null;
  const cm = conditionMult();
  const appliedExp = grantExp(rollExpFromRanges({ int: [10, 20], ski: [10, 20], men: [10, 20] })); // 作曲そのものからも新エンジンの経験点を付与
  // 他ジャンル◯: ジャンル熟練度が上がりやすい
  const masteryGain = hasAbility('multigenre') ? 12 : 8;
  state.genreMastery[draft.genre] = Math.min(100, mastery + masteryGain);
  addLog(`新曲「${song.title}」(${song.genre})が完成した！完成度${completion}`, 'neutral');
  state.justCompletedSong = { ...song, appliedExp };
}

// ===== インディーズレーベル =====
// 知名度またはフォロワーがこの値を超えると、ロケットミュージックエンターテイメントの
// 堀 良音からオファーが来る。3つのレーベルから1つを選ぶと、それぞれ違う特典が付く。
// ふつうに遊んで半年〜1年(24〜48週)で届く値。2年ぶんを実際に回して決めている。
let INDIE_OFFER_THRESHOLD = 2000;
let INDIE_OVERALL_REQUIRED = 50;   // Dランク相当

// ===== メジャーデビューの条件 =====
// 知名度とフォロワーが両方5000以上で、かつバンドの総合力(ステータスの平均+特殊能力)も一定以上。
// 数字だけ伸ばしても、演奏が伴っていなければ声はかからない。
// 条件を満たしても、すぐ声がかかるわけではない。満たしている間だけ毎回抽選する。
// 1年半で約20%、2年で約40%が到達するように、実際に2年ぶんを回して決めた数値。
let MAJOR_AUDIENCE_REQUIRED = 0;        // 廃止(1本のライブで呼べた最高動員)
let MAJOR_FAME_REQUIRED = 15000;
let MAJOR_FOLLOWERS_REQUIRED = 10000;
let MAJOR_OVERALL_REQUIRED = 68;        // Cランク上位相当
let MAJOR_OFFER_CHANCE = 0.40;        // 条件を満たせば数週以内に必ず声がかかる(=抽選ではなく条件で決まる)

// メジャーの給料。知名度・フォロワー・ライブの動員から20万〜50万の間で決まる。
// 毎月払うたびに計算し直すので、バンドが大きくなるほど増えていく。
const MAJOR_SALARY_MIN = 200000;
const MAJOR_SALARY_MAX = 500000;
function calcMajorSalary() {
  const venue = pickVenueForPlayer();
  const audience = calcTicketsReserved(venue);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const score = (clamp01((state.fame - MAJOR_FAME_REQUIRED) / 32000)
    + clamp01((state.followers - MAJOR_FOLLOWERS_REQUIRED) / 24000)
    + clamp01((audience - 200) / 1800)) / 3;
  const raw = MAJOR_SALARY_MIN + score * (MAJOR_SALARY_MAX - MAJOR_SALARY_MIN);
  return Math.round(raw / 10000) * 10000;
}
const INDIE_LABELS = [
  { key: 'truster',    name: 'トラスターレコーズ',     perk: 'レコーディング費用25%負担' },
  { key: 'orion',      name: 'オリオンレコーズ',       perk: 'CDの売れ行き15%UP' },
  { key: 'elevenback', name: 'イレブンバックレコーズ', perk: 'ライブ時の動員20%UP' },
];
function indieLabelDef(key) {
  return INDIE_LABELS.find(l => l.key === (key === undefined ? state.indieLabel : key)) || null;
}

// 各レーベルの特典。所属していない場合は等倍(1)を返す。
function recordingCostMult() {
  // レーベル選択が無かった頃のセーブ(agencyStatus:'indie'だけ)はレコーディング割引として扱う
  if (!state.indieLabel) return state.agencyStatus === 'indie' ? 0.75 : 1;
  if (state.indieLabel !== 'truster') return 1;
  return state.labelPerkBoost ? 0.65 : 0.75;   // 要求に応えていると割引が増える
}
function cdSalesMult() {
  // 商才◯/青田買い: CDが売れやすくなる
  const merchant = 1 + abilityTier('merchant') * 0.12;
  const label = state.indieLabel !== 'orion' ? 1 : (state.labelPerkBoost ? 1.25 : 1.15);
  return label * merchant;
}
function liveAudienceMult() {
  if (state.indieLabel !== 'elevenback') return 1;
  return state.labelPerkBoost ? 1.3 : 1.2;
}

// ===== 事務所オファー(インディーズレーベル→メジャー) =====
function checkAgencyOffers() {
  // メジャーのオファーは他のイベントと同時に出ても構わない(モーダルのキューで順番に出る)。
  // ここで弾くと、イベントが出た週ぶん抽選機会が減ってしまう。
  if (state.justAgencyOffer) return;
  if (state.agencyStatus === 'unsigned' && !state.declinedIndieOffer && meetsIndieRequirements()) {
    // 同じ日に別のイベントが控えている時は見送り、次のターン以降に改めて出す
    if (state.justFriendOffer || state.justFlavorEvent || state.justRyoheiEvent
        || state.justDrNasakenaiEvent || state.justTakumaEvent) return;
    state.justIndieLabelOffer = true;
  } else if (state.agencyStatus === 'indie' && !state.declinedMajorOffer
      && meetsMajorRequirements() && Math.random() < MAJOR_OFFER_CHANCE) {
    state.justAgencyOffer = { type: 'major' };
  }
}

// レーベルに所属する。経験点と体力の回復は仕様として固定値。
// 結果表示用のsegmentsを返す(呼び出し元のUIがそのまま吹き出しに流す)。
// インディーズの声がかかる条件を満たしているか。
// 知名度かフォロワーのどちらかが届いていて、かつ演奏がある程度のところまで来ていること。
function meetsIndieRequirements() {
  return (state.fame >= INDIE_OFFER_THRESHOLD || state.followers >= INDIE_OFFER_THRESHOLD)
    && StatsEngine.calcOverallScore(state) >= INDIE_OVERALL_REQUIRED;
}

// メジャーの声がかかる条件を満たしているか
// メジャーの声がかかる条件。
// 累計の知名度ではなく「1本のライブで何人呼べたか(自己ベスト動員)」を主役にしている。
// 累計値は最後まで伸び続けるのでどこに線を引いても終盤通過になるが、
// 動員は実力に応じた水準で頭打ちになるため、早い段階でも到達できる。
function meetsMajorRequirements() {
  // 「1本のライブで◯人」の条件は、小さい箱でもすぐ超えてしまい
  // ゲートとして働いていなかったため廃止した(知名度・フォロワー・総合力の3条件)
  return state.fame >= MAJOR_FAME_REQUIRED
    && state.followers >= MAJOR_FOLLOWERS_REQUIRED
    && StatsEngine.calcOverallScore(state) >= MAJOR_OVERALL_REQUIRED;
}

function acceptIndieLabel(labelKey) {
  const label = indieLabelDef(labelKey);
  if (!label) return [];
  state.agencyStatus = 'indie';
  state.indieLabel = label.key;
  const maxHealth = state.maxHealthMult || 100;
  const before = state.health;
  state.health = Math.min(maxHealth, state.health + 20);
  const healed = Math.round(state.health - before);
  const applied = grantExp({ str: 30, ski: 30, int: 30, men: 30 });
  addLog(`${label.name}に所属した！(${label.perk})`, 'plus');
  render();
  return [
    { text: `${label.name}に所属した！`, type: 'plus' },
    { text: label.perk, type: 'plus' },
    ...expSegments(applied),
    { text: `体力が${healed}回復した`, type: 'plus' },
  ];
}

function declineIndieLabelOffer() {
  state.declinedIndieOffer = true;
  addLog('インディーズレーベルのオファーを見送った', 'neutral');
  render();
}

function acceptAgencyOffer(offerType) {
  if (offerType === 'indie') {
    state.agencyStatus = 'indie';
    addLog('インディーズ事務所と契約した！レコーディング費用が25%割引になる', 'plus');
  } else if (offerType === 'major') {
    state.agencyStatus = 'major';
    state.agencyJoinTurn = state.turn;
    state.agencySalary = calcMajorSalary();
    state.monthlyPerformance = 0;
    addLog(`メジャーデビュー決定！事務所と契約した(月給${yen(state.agencySalary)})`, 'plus');
  }
  render();
}

function declineAgencyOffer(offerType) {
  if (offerType === 'indie') state.declinedIndieOffer = true;
  if (offerType === 'major') state.declinedMajorOffer = true;
  addLog('事務所のオファーを見送った', 'neutral');
  render();
}

function processMonthlyAgency() {
  if (state.agencyStatus !== 'major') return;
  // バンドの規模に合わせて毎月見直す
  state.agencySalary = calcMajorSalary();
  state.lastSalaryPaid = state.agencySalary;   // 事務所画面で「前回の振込額」として出す
  addMoney(state.agencySalary);
  addLog(`事務所から給料が振り込まれた(+${yen(state.agencySalary)})`, 'plus');
  if (state.monthlyPerformance < MONTHLY_PERFORMANCE_THRESHOLD) {
    state.agencyStatus = 'indie';
    state.declinedMajorOffer = false; // 立て直せば再度メジャーのオファーが来る可能性がある
    addLog('CDの売れ行き・ライブの動員が伸びず、事務所を解雇された…アルバイトが可能になった', 'minus');
  }
  state.monthlyPerformance = 0;
}

// ===== アクション: アルバイト(経験値は得られない) =====

function doJob(key) {
  if (isFeverBlocked()) return;
  const job = JOBS.find(j => j.key === key);
  // 体調不良時や体力が少ない(30%未満)ときは4Hで早退させられる。それ以外は8H勤務。
  // 忍耐力◯: 体力が少なくても8時間働ける確率が上がる
  const wouldBeSentHome = state.condition === 'cold' || state.condition === 'fever' || state.health < 30;
  const sentHomeEarly = wouldBeSentHome && !(hasAbility('patience') && Math.random() < 0.6);
  const hours = sentHomeEarly ? 4 : 8;
  // 器用◯: 時給が1.25倍。さらに熟練度ぶんの上乗せがある。
  const wageMult = (hasAbility('dexterity') ? 1.25 : 1) * jobMasteryMult(key, JOB_MASTERY_WAGE_BONUS);
  const wage = Math.round(job.wage * hours * wageMult);
  addMoney(wage);
  addLog(`${job.name}で ${yen(wage)} 稼いだ${sentHomeEarly ? `(${hours}時間で早退)` : ''}`, 'plus');
  // 器用◯と熟練度で、得られる経験点も増える
  const expMult = (hasAbility('dexterity') ? 1.25 : 1) * jobMasteryMult(key, JOB_MASTERY_EXP_BONUS);
  const jobExp = rollExpFromRanges(job.expGain);
  Object.keys(jobExp).forEach(c => { jobExp[c] = Math.max(1, Math.round(jobExp[c] * expMult)); });
  grantExp(jobExp);
  gainJobMastery(key, 8); // 8回前後(体調やイベントで前後)でMAXになる目安
  applyHealthCost(job.healthCost);
  advanceWeek();
  render();
}

// ===== アクション: 練習 =====
function doPracticeSession(key, useCoupon) {
  if (isFeverBlocked()) return;
  const menu = PRACTICE_MENUS.find(m => m.key === key);
  if (!menu) return;
  const healthBeforePractice = state.health;
  const couponValid = state.practiceCoupon && state.turn <= state.practiceCoupon.expiryTurn;
  const applyCoupon = !!useCoupon && couponValid;
  const cost = applyCoupon ? Math.round(menu.cost / 2) : menu.cost;
  if (state.money < cost) { notifyInsufficientFunds(); render(); return; }
  state.money -= cost;
  if (applyCoupon) state.practiceCoupon = null;

  // 決定画面に出した「獲得予定」とズレないよう、表示と同じ関数で倍率を出し、
  // その範囲の中で実際の値を決める(表示と実際で別々に計算しない)。
  const pv = practicePreview(key);
  const prevLevel = getPracticeLevel(key);

  state.practiceCount = state.practiceCount || {};
  state.practiceCount[key] = (state.practiceCount[key] || 0) + 1;
  const newLevel = getPracticeLevel(key);

  // 飽き性×: 同じ練習を連続すると効果が落ちる(別の練習を挟めば戻る)
  if (hasAbility('fickle')) {
    const streak = state.lastPracticeKey === key ? (state.practiceStreak || 0) + 1 : 0;
    state.practiceStreak = streak;
    if (streak > 0) addLog('同じ練習に飽きてきた…', 'minus');
  }
  state.lastPracticeKey = key;

  // 予測の[最小,最大]の中から実際の獲得量を引く。倍率は既に織り込み済みなので
  // ここで重ねて掛けない(以前はここでもう一度掛けていて表示と食い違っていた)。
  const scaledExpGain = {};
  Object.keys(pv.exp).forEach(cat => {
    const [lo, hi] = pv.exp[cat];
    scaledExpGain[cat] = randInRange(lo, hi);
  });
  StatsEngine.gainExp(state.expPool, scaledExpGain);
  Object.keys(scaledExpGain).forEach(cat => {
    if (scaledExpGain[cat] > 0) addLog(`${StatsEngine.EXP_CATEGORY_NAMES[cat]}経験点を${scaledExpGain[cat]}得た`, 'plus');
  });
  if (newLevel > prevLevel) {
    addLog(`${menu.name}のレベルが${newLevel}に上がった！`, 'plus');
  }

  state.practiceStamps = (state.practiceStamps || 0) + 1;
  let newCoupon = false;
  if (state.practiceStamps >= PRACTICE_STAMPS_FOR_COUPON) {
    state.practiceStamps = 0;
    state.practiceCoupon = { expiryTurn: state.turn + PRACTICE_COUPON_VALID_TURNS };
    newCoupon = true;
  }

  if (cost > 0) {
    addLog(`所持金が${cost.toLocaleString()}円減った${applyCoupon ? '(クーポン利用)' : ''}`, 'minus');
  }
  if (newCoupon) addLog('スタンプ10個達成！練習半額クーポンを獲得した', 'plus');

  applyHealthCost(menu.healthCost);

  // 体力が半分以下の状態で練習すると、風邪をひいてしまうことがある
  if (!hasAbility('fudou') && healthBeforePractice <= 50 && state.condition === 'normal'
      && Math.random() < COLD_FROM_LOW_HP_PRACTICE_CHANCE) {
    state.condition = 'cold';
    addLog('体力が少ない状態で無理をして、風邪をひいてしまった…', 'minus');
  }

  advanceWeek();
  render();
}

// ===== アクション: 曲制作(着手。完成は日数経過後) =====
function startSong(genre, customTitle) {
  if (isFeverBlocked()) return;
  const cost = 2000;
  const totalWeeks = 2;
  if (state.songInProgress) { addLog('すでに制作中の曲があります', 'neutral'); render(); return; }
  if (state.money < cost) { notifyInsufficientFunds(); render(); return; }
  state.money -= cost;
  const title = (customTitle && customTitle.trim()) ? customTitle.trim() : generateSongTitle();
  state.songInProgress = { title, genre, weeksLeft: totalWeeks, totalWeeks };
  addLog(`「${state.songInProgress.title}」(${genre})の制作を開始した(-${yen(cost)})`, 'minus');
  applyHealthCost(SONG_HEALTH_COST, true); // 作曲の体力低下は体調不良の発生に影響させない
  render(); // 作曲の開始自体は日付を進めない(ランダムイベントも発生しない)
}

// ===== アクション: CD制作(複数曲をまとめてレコーディング) =====
function produceCD(typeKey, songIds, price, customTitle, memberKeys, studioKey, producerHired, guestIds) {
  if (isFeverBlocked()) return;
  memberKeys = memberKeys || [];
  // 親密度MAXでないゲストが紛れ込まないよう、ここでも必ず弾く
  guestIds = (guestIds || []).filter(canGuestRecord);
  const type = cdTypeOf(typeKey);
  const studio = STUDIOS.find(st => st.key === studioKey) || STUDIOS[0];
  if (!type) { addLog('CD種別が正しくありません', 'neutral'); render(); return; }
  if (songIds.length < type.minSongs || songIds.length > type.maxSongs) {
    addLog(`${type.name}は${type.minSongs}〜${type.maxSongs}曲で制作してください`, 'neutral');
    render();
    return;
  }
  if (price < type.priceMin || price > type.priceMax) {
    addLog('売値が価格帯の範囲外です', 'neutral');
    render();
    return;
  }
  const songs = songIds.map(id => state.songs.find(s => s.id === id && !s.used)).filter(Boolean);
  if (songs.length !== songIds.length) {
    addLog('曲の選択に誤りがあります', 'neutral');
    render();
    return;
  }
  const memberCost = memberKeys.length * memberHireCost();
  const producerCost = producerHired ? PRODUCER_COST : 0;
  const guestCost = guestIds.length * RECORD_GUEST_COST;
  const recordingBaseCost = songs.length * studio.costPerSong;
  const discountedRecordingCost = Math.round(recordingBaseCost * recordingCostMult());
  const totalCost = discountedRecordingCost + memberCost + producerCost + guestCost;
  if (state.money < totalCost) { notifyInsufficientFunds(); render(); return; }

  state.money -= totalCost;
  songs.forEach(s => { s.used = true; });
  const memberBonus = 1 + memberKeys.length * 0.06;
  const producerBonus = producerHired ? 1.1 : 1.0;
  // ゲストは一線級なので、サポートメンバーより完成度への効き目が大きい
  const guestBonus = 1 + guestIds.length * 0.14;
  const completionAvg = Math.min(100, Math.round((songs.reduce((a, s) => a + s.completion, 0) / songs.length) * memberBonus * studio.qualityBonus * producerBonus * guestBonus));

  const release = {
    id: state.releaseIdSeq++,
    type: typeKey,
    typeName: type.name,
    title: (customTitle && customTitle.trim()) ? customTitle.trim() : generateAlbumTitle(),
    songTitles: songs.map(s => s.title),
    genres: songs.map(s => s.genre),   // レーベルからの要求(指定ジャンル)の判定に使う
    songCount: songs.length,
    completionAvg,
    price,
    cost: totalCost,
    released: false,
    releaseTurn: null,
    totalSold: 0,
    salesActive: false,
    weeksElapsed: 0,
    studioKey: studio.key,
  };
  state.releases.unshift(release);
  const cm = conditionMult();
  const guestNames = guestIds.map(id => {
    const f = (state.friends || []).find(x => x.id === id);
    return f ? f.name : id;
  });
  const appliedExp = grantExp(rollExpFromRanges({ str: [10, 20], ski: [10, 20], int: [10, 20], men: [10, 20] }));
  // ゲストと一緒に録ると、そのぶん技術・精神の学びがある
  if (guestIds.length) {
    const g = guestIds.length;
    const extra = grantExp(rollExpFromRanges({ ski: [8 * g, 14 * g], int: [8 * g, 14 * g], men: [5 * g, 10 * g] }));
    Object.keys(extra).forEach(cat => { appliedExp[cat] = (appliedExp[cat] || 0) + extra[cat]; });
    guestNames.forEach(n => addLog(`${n}がレコーディングに参加してくれた！`, 'plus'));
  }
  const memberNote = memberKeys.length ? ` / サポート${memberKeys.length}名雇用` : '';
  const producerNote = producerHired ? ' / プロデューサー起用' : '';
  const guestNote = guestNames.length ? ` / ゲスト: ${guestNames.join('・')}` : '';
  const discountNote = recordingCostMult() < 1 ? '(レーベルのレコーディング費用負担あり)' : '';
  addLog(`「${release.title}」(${type.name}/${songs.length}曲/${studio.name})を制作した${discountNote}(-${yen(totalCost)}${memberNote}${producerNote}${guestNote})`, 'minus');
  const recKnacks = [];
  memberKeys.forEach(k => {
    const fid = MEMBER_KEY_TO_FRIEND_ID[k];
    if (!fid) return;
    const kn = rollFriendKnack(fid, 'recording');
    if (kn) recKnacks.push(kn);
  });
  guestIds.forEach(id => {
    const kn = rollFriendKnack(id, 'recording');
    if (kn) recKnacks.push(kn);
  });
  state.justRecordedCD = { knacksLearned: recKnacks, releaseId: release.id, title: release.title, typeName: release.typeName, songCount: release.songCount, completionAvg: release.completionAvg, studioName: studio.name, studioKey: studio.key, appliedExp };
  const healthCost = Math.min(25, 5 + songs.length * 1.5);
  applyHealthCost(healthCost);
  // レコーディング→リリース→初動売上は一続きの流れとして扱うため、ここでは日付を進めない。
  // 実際の日付変更は finalizeRecordingDay() で、成果ポップアップを閉じた後に行う。
  render();
}

// レコーディング(→リリース)の一連の流れが終わったタイミングで日付を進める
function finalizeRecordingDay() {
  advanceWeek();
  render();
}

// ===== アクション: CDリリース(初動) =====
function releaseCD(releaseId) {
  const r = state.releases.find(x => x.id === releaseId);
  if (!r || r.released) return;
  const pf = priceFactor(r.price, r.type);
  const qualityFactor = Math.pow(r.completionAvg / 100, 1.2); // 完成度が低いと売れにくい
  // 知名度300で約20枚、1000で約50枚、5000で約100枚(完成度MAX付近)を狙った目安の式
  const fameBase = 0.65 * Math.pow(Math.max(0, state.fame), 0.58);
  const followerMultiplier = 1 + state.followers / 80000;
  const songCountFactor = Math.sqrt(r.songCount);
  const units = Math.max(3, Math.round((3 + fameBase) * qualityFactor * followerMultiplier * songCountFactor * pf * cdSalesMult()));
  const sales = units * r.price;
  const fameGain = Math.round(r.completionAvg * r.songCount * 0.8 * FAME_GROWTH);

  addMoney(sales);
  state.fame += fameGain;
  state.followers += Math.round(fameGain * FOLLOWER_FROM_CD);
  r.released = true;
  r.releaseTurn = state.turn;
  // レーベルとの約束(指定ジャンルのCD)を果たしたか
  if (state.labelRequest && state.turn <= state.labelRequest.expiryTurn
      && (r.genres || []).includes(state.labelRequest.genre)) {
    const label = indieLabelDef();
    state.labelRequest = null;
    state.labelRequestDone = true;
    state.labelPerkBoost = true;
    addLog(`${label ? label.name : 'レーベル'}との約束を果たした！特典が強化された`, 'plus');
  }
  r.totalSold = units;
  r.salesActive = true;
  r.weeksElapsed = 0;
  state.weekIncome += sales;
  state.weekUnitsSold += units;
  state.monthlyPerformance += units;
  const netVsCost = sales - r.cost;
  addLog(`「${r.title}」リリース！初動${units.toLocaleString()}枚 売上${yen(sales)}(制作費比${netVsCost >= 0 ? '+' : ''}${yen(netVsCost)}) 知名度+${fameGain}`, netVsCost >= 0 ? 'plus' : 'minus');
  state.justReleasedCD = { title: r.title, typeName: r.typeName, totalSold: units, sales, netVsCost, studioKey: r.studioKey };
  // ここでも日付は進めない(初動売上ポップアップを閉じた後に finalizeRecordingDay() で進める)
  render();
}

// ===== アクション: ライブ =====
// ライブを1本打つ。
//   doLive(members)                       … 定期ライブ(会場は自動・会場費なし・スケジュール週のみ)
//   doLive(members, { venueKey: 'zepp' }) … 追加ライブ(自分で会場を選ぶ・会場費を前払い・いつでも打てる)
function doLive(memberKeys, opts) {
  if (isFeverBlocked()) return;
  opts = opts || {};
  const isExtra = !!opts.venueKey;
  if (!isExtra && state.turn < state.nextLiveTurn) {
    addLog('まだ定期ライブの週ではありません', 'neutral'); render(); return;
  }
  memberKeys = memberKeys || [];
  const venue = isExtra ? (VENUES.find(v => v.key === opts.venueKey) || pickVenueForPlayer()) : pickVenueForPlayer();
  if (isExtra && state.fame < venue.minFame) {
    addLog(`${venue.name}はまだ押さえられません`, 'neutral'); render(); return;
  }
  const memberCost = memberKeys.length * memberHireCost();
  // 定期ライブはいつもの箱なので会場費なし。追加ライブは自分で押さえるぶん前払いになる。
  const venueCost = isExtra ? venue.cost : 0;
  const totalCost = memberCost + venueCost;
  if (state.money < totalCost) { notifyInsufficientFunds(); render(); return; }
  state.money -= totalCost;

  const memberBonus = 1 + memberKeys.length * 0.05;
  const overall = StatsEngine.calcOverallScore(state);
  // 出来(0〜100・パフォーマンス評価)
  let performanceFinal = Math.max(1, Math.min(100, Math.round(overall * 0.7 + avgSkill() * 0.3 + (Math.random() * 10 - 5))));
  if (isSickForExp()) performanceFinal = Math.round(performanceFinal * 0.8); // 体調不良で出来が下がる
  if (state.brokenGearTurns > 0) performanceFinal = Math.round(performanceFinal * 0.85); // 機材を直していない
  // 音感・リズム感は本番の出来を底上げする
  performanceFinal = Math.round(performanceFinal * (1 + abilityTier('onkan') * 0.04 + abilityTier('rhythm') * 0.04));
  // 会場が大きすぎると緊張する(度胸◯・大舞台◯で緩和、あがり症×で悪化)
  performanceFinal = Math.max(1, Math.min(100, Math.round(performanceFinal * stageNerveMult(venue))));
  // 屋台骨: きさらが支えてくれるので、大きく崩れることがなくなる。
  // 良い時をさらに良くするのではなく、下振れを持ち上げるだけにする。
  if (hasAbility('yataibone')) performanceFinal = Math.max(performanceFinal, Math.round(overall * 0.72));
  // 絶唱: 会場が大きいほど声が乗る。武道館なら2割増し。
  if (hasAbility('zesshou')) {
    const scale = Math.min(0.2, Math.max(0, (venue.capacity - 50) / 10000 * 0.2));
    performanceFinal = Math.round(performanceFinal * (1 + scale));
  }
  performanceFinal = Math.max(1, Math.min(100, performanceFinal));

  // 集客: 自分の集客力(=呼べる人数)に、出来・サポート・宣伝を乗せる。
  // 会場のキャパは「上限」であって、キャパが大きいから客が増えるわけではない。
  // 対バンのゲストが出てくれる回は、相手の客も来るぶん集客が伸びる
  const guests = (!isExtra ? (state.scheduledGuests || []) : []).filter(g => g.turn <= state.turn);
  const guest = guests[0] || null;   // 従来の単数参照との互換用
  // 出てくれた相手のぶんだけ客が増える。2組でも青天井にはしない。
  const guestFameSum = guests.reduce((a, g) => a + (g.fame || 0), 0);
  const guestBonus = guests.length ? (1 + Math.min(0.60, guestFameSum / 3000 * 0.15)) : 1;
  const draw = calcDrawPower() * memberBonus * guestBonus * (0.75 + performanceFinal / 250);
  const promoAudience = state.liveExtraAudience || 0;
  const audience = Math.max(0, Math.min(venue.capacity, Math.round((draw + promoAudience) * liveAudienceMult())));
  const fill = venue.capacity > 0 ? audience / venue.capacity : 0;
  const reserved = Math.min(audience, Math.round(audience * 0.75));

  // チケット代がまるごと手元に残るわけではない。会場や運営の取り分を引いたぶんが収入になる。
  const revenue = Math.round(audience * venue.ticket * (0.8 + performanceFinal / 250) * LIVE_REVENUE_SHARE);
  const profit = revenue - totalCost;

  // 知名度は「何人の前で演奏したか」と「どれだけ埋まったか」で決まる。
  // 満員に近いほど跳ね、ガラガラだと逆に評判を落とす。
  let fameGain;
  let flopped = false;
  if (fill < FLOP_FILL) {
    flopped = true;
    const empty = venue.capacity - audience;
    fameGain = -Math.round(empty * FLOP_FAME_LOSS * FAME_GROWTH / 10);
    if (hasAbility('comeback')) fameGain = Math.round(fameGain * 0.5);   // 逆境◯

  } else {
    fameGain = Math.round(audience * FAME_PER_HEAD * (FILL_BONUS_MIN + fill * FILL_BONUS_RANGE) * FAME_GROWTH);
  }

  addMoney(revenue);
  state.fame = Math.max(0, state.fame + fameGain);
  state.followers = Math.max(0, state.followers + Math.round(fameGain * FOLLOWER_FROM_LIVE));
  state.monthlyPerformance += audience;
  state.lastLiveTurn = state.turn;
  // 「今どれだけ客を呼べるか」の自己ベスト。メジャーのスカウトはここを見る。
  state.bestAudience = Math.max(state.bestAudience || 0, audience);
  state.liveExtraAudience = 0;   // 宣伝の効果はこのライブで使い切る

  // 経験点(全カテゴリ、来場数・出来で変動)
  // 経験点は会場の規模ぶんを4カテゴリすべてに配る(小規模10 / 中規模20 / Zepp30 …)。
  // ただし満員に近いほど身になる。ガラガラのライブは学びも少ない。
  const baseExp = LIVE_EXP_BY_VENUE[venue.key] || 10;
  const expFillMult = LIVE_EXP_FILL_MIN + fill * (1 - LIVE_EXP_FILL_MIN);
  const expPerCategory = Math.max(1, Math.round(baseExp * expFillMult));
  const liveExp = grantExp({ str: expPerCategory, ski: expPerCategory, int: expPerCategory, men: expPerCategory });

  const memberNote = memberKeys.length ? ` / サポート${memberKeys.length}名雇用` : '';
  const fillNote = `(${Math.round(fill * 100)}%)`;
  addLog(`${venue.name}で${isExtra ? '追加' : '定期'}ライブ！動員${audience}人${fillNote} 出来${performanceFinal} 利益${yen(profit)} 知名度${fameGain >= 0 ? '+' : ''}${fameGain}${memberNote}`,
    flopped ? 'minus' : (profit >= 0 ? 'plus' : 'minus'));
  state.justPlayedLive = { venueKey: venue.key, venueName: venue.name, audience, revenue, profit, fameGain, performanceFinal,
    capacity: venue.capacity, fill, flopped, isExtra, venueCost, appliedExp: liveExp,
    guestName: guest ? guest.name : null, guestBand: guest ? guest.bandName : null,
    guests: guests.map(g => ({ id: g.id, memberKey: g.memberKey, name: g.name, bandName: g.bandName })) };
  if (guests.length) {
    state.justPlayedLive.guestIntimacy = [];
    guests.forEach(g => {
      const gf = state.friends.find(x => x.id === g.id);
      if (gf) {
        const before = gf.intimacy || 0;
        addIntimacy(gf, COLLAB_INTIMACY_GAIN);   // 一緒に出たぶん大きく縮まる
        const gained = (gf.intimacy || 0) - before;
        if (gained > 0) {
          state.justPlayedLive.guestIntimacy.push({ name: gf.name, gained });
          addLog(`${gf.name}との親密度が${gained}上がった`, 'plus');
        }
      }
      addLog(`${g.name}(${g.bandName})が対バンしてくれた！`, 'plus');
      const k = rollFriendKnack(g.id, 'live');
      if (k) (state.justPlayedLive.knacksLearned = state.justPlayedLive.knacksLearned || []).push(k);
    });
    if (guests.length === 1) state.justPlayedLive.guestIntimacyGain = (state.justPlayedLive.guestIntimacy[0] || {}).gained || 0;
    // 出演済みのゲストを消化する
    state.scheduledGuests = (state.scheduledGuests || []).filter(g => g.turn > state.turn);
  }
  let rp1JustTriggered = false;
  if (!state.ryoheiEvents.rp1Done) {
    state.ryoheiEvents.rp1Done = true;
    state.ryoheiJustBecameFriend = true; // このターンのイベント抽選では対象外にする
    grantExp({ str: 10, ski: 10, int: 10, men: 10 });
    state.friends.push({
      id: 'ryohei', memberKey: 'ryohei', isNpc: true,
      name: NPC_MEMBERS.ryohei.name, bandName: NPC_MEMBERS.ryohei.bandName,
      part: NPC_MEMBERS.ryohei.part, stats: { ...NPC_MEMBERS.ryohei.stats }, abilities: [...NPC_MEMBERS.ryohei.abilities],
      fame: NPC_MEMBERS.ryohei.fame, followers: NPC_MEMBERS.ryohei.followers, intimacy: 10,
    });
    addLog('りょーぺとの親密度が10上がった', 'plus');
    addLog('りょーぺがフレンドになった！', 'money');
    rp1JustTriggered = true;
  }
  // 一緒にステージに立ったメンバーとだけ仲良くなる。
  // 雇わなければ縮まらないので、誰と組むかを選ぶことになる。
  memberKeys.forEach(k => {
    const fid = MEMBER_KEY_TO_FRIEND_ID[k];
    const f = fid && state.friends.find(x => x.id === fid);
    if (f) addIntimacy(f, LIVE_INTIMACY_GAIN);
    if (fid) {
      const kn = rollFriendKnack(fid, 'live');
      if (kn) (state.justPlayedLive.knacksLearned = state.justPlayedLive.knacksLearned || []).push(kn);
    }
  });

  state.lastLiveHadMembers = memberKeys.length > 0;
  state.lastLiveMemberIds = memberKeys.map(k => MEMBER_KEY_TO_FRIEND_ID[k]).filter(Boolean);
  const toughMult = hasAbility('tough') ? 0.8 : 1;   // タフネス◯
  applyHealthCost(Math.round(venue.healthCost * (isExtra ? EXTRA_LIVE_HEALTH_MULT : 1) * toughMult));

  // 定期ライブを打った時だけ次回を組み直す。追加ライブは定期の予定に影響しない。
  if (!isExtra) {
    state.nextLiveTurn = state.turn + LIVE_INTERVAL_TURNS;
    state.liveDayAnnounced = false;
  }
  state.liveExtraAudience = 0;
  state.livePromoUsedTurn = null;
  state.guestAskedThisLive = {};

  advanceWeek();
  render();
  state.justPlayedLive.rp1JustTriggered = rp1JustTriggered;
  return state.justPlayedLive;
}

// ===== 打ち上げ =====
const AFTERPARTY_TIERS = [
  { max: 2, expMin: 5, expMax: 10, intimacy: -5, health: 10 },   // 0〜2杯
  { max: 6, expMin: 10, expMax: 20, intimacy: 5, health: -5 },   // 3〜6杯
  { max: 9, expMin: 20, expMax: 25, intimacy: 5, health: -10 },  // 7〜9杯
  { max: 10, expMin: 30, expMax: 30, intimacy: 10, health: -15 }, // 10杯
];
function getAfterpartyTier(drinks) {
  return AFTERPARTY_TIERS.find(t => drinks <= t.max) || AFTERPARTY_TIERS[AFTERPARTY_TIERS.length - 1];
}

function startAfterparty() {
  state.afterpartyState = { drinks: 0, vomited: false };
}

// 1杯飲む。戻り値: { vomited, done, drinks } doneはtrueで打ち上げ終了(吐いたor10杯)
function drinkAtAfterparty() {
  const ap = state.afterpartyState;
  if (!ap || ap.vomited) return { vomited: false, done: true, drinks: ap ? ap.drinks : 0 };
  ap.drinks += 1;
  // 吐く確率: 2%からスタートし、飲むほど上昇(8杯目あたりで約10%)
  // 打ち上げ◯を持っていると吐きにくい。打ち上げ王なら一切吐かない。
  const apTier = abilityTier('afterparty');
  const vomitMult = apTier >= 3 ? 0 : (apTier >= 1 ? 0.4 : 1);
  const vomitChance = Math.min(0.35, (0.02 + Math.max(0, ap.drinks - 1) * 0.011) * vomitMult);
  const vomited = Math.random() < vomitChance;
  if (vomited) ap.vomited = true;
  return { vomited, done: vomited || ap.drinks >= 10, drinks: ap.drinks };
}

// 打ち上げを締めくくる(吐いた/10杯飲みきった/途中でやめた、いずれの場合も呼ぶ)。
// 飲んだ杯数に応じた成果(経験点・親密度・体力)を確定させ、結果を返す。
function finishAfterparty() {
  // 前回の打ち上げの結果が残っていると、今回何も無くても
  // 「コツがLv.5になった」と出てしまう。毎回ここで消す。
  state.afterpartyKnackGained = false;
  state.justKnack = null;
  const ap = state.afterpartyState || { drinks: 0, vomited: false };
  const drinks = ap.drinks;
  const vomited = ap.vomited;
  const tier = getAfterpartyTier(drinks);

  // 打ち上げ王は飲んだぶんがしっかり身になる
  const kingMult = abilityTier('afterparty') >= 3 ? 1.5 : 1;
  const eMin = Math.round(tier.expMin * kingMult), eMax = Math.round(tier.expMax * kingMult);
  const expRange = { str: [eMin, eMax], ski: [eMin, eMax], int: [eMin, eMax], men: [eMin, eMax] };
  const applied = grantExp(rollExpFromRanges(expRange));

  if (state.lastLiveHadMembers) {
    state.bandIntimacy = (state.bandIntimacy || 0) + tier.intimacy;
    (state.lastLiveMemberIds || []).forEach(fid => {
      const friend = state.friends.find(f => f.id === fid);
      if (friend && friend.intimacy !== undefined) friend.intimacy += tier.intimacy;
    });
    addLog(tier.intimacy >= 0 ? `メンバーとの親密度が${tier.intimacy}上がった` : `メンバーとの親密度が${Math.abs(tier.intimacy)}下がった`, tier.intimacy >= 0 ? 'plus' : 'minus');
  }

  if (tier.health > 0) {
    const before = state.health;
    state.health = Math.min(100, state.health + tier.health);
    if (state.health > before) addLog(`体力が${state.health - before}回復した`, 'plus');
  } else if (tier.health < 0) {
    applyHealthCost(Math.abs(tier.health));
  }

  // 10杯飲み切るたびに「打ち上げ」のコツのレベルが1ずつ上がる(最大Lv5で必要経験点が半分)。
  // 5回目には金ランク「打ち上げ王」のコツも手に入る。
  if (drinks >= 10) {
    state.knacks = state.knacks || {};
    state.tenDrinkCount = (state.tenDrinkCount || 0) + 1;
    const beforeLv = StatsEngine.knackLevel(state, 'afterparty');
    const afterLv = Math.min(StatsEngine.KNACK_MAX_LEVEL, state.tenDrinkCount);
    if (afterLv > beforeLv) {
      state.knacks.afterparty = afterLv;
      state.afterpartyKnackGained = { level: afterLv, off: Math.round((1 - StatsEngine.knackDiscount(afterLv)) * 100) };
      addLog(`打ち上げのコツがLv.${afterLv}になった(必要経験点が${state.afterpartyKnackGained.off}%引き)`, 'plus');
    }
    // すでにLv5(上限)なら、コツについては何も出さない
    if (state.tenDrinkCount >= AFTERPARTY_KING_TIMES && !state.knacks.afterpartyKing) {
      state.knacks.afterpartyKing = true;
      addLog(`10杯飲み切るのを${AFTERPARTY_KING_TIMES}回達成！「打ち上げ王」のコツをつかんだ`, 'money');
      state.justKnack = { label: '打ち上げ王', note: '金特殊能力「打ち上げ王」が習得できるようになった' };
    }
  }

  let hungover = false;
  if (vomited) {
    addLog('飲みすぎて吐いてしまった…', 'minus');
    // 吐いた場合、確率で二日酔いになり翌日は体調不良になる(仮の確率: 50%)
    // 柔軟性◯: 悪い効果を少し打ち消す
    const hangoverChance = hasAbility('flex') ? 0.25 : 0.5;
    if (Math.random() < hangoverChance) {
      hungover = true;
      if (state.condition !== 'fever') state.condition = 'cold';
      state.hungover = true;
      addLog('二日酔いになってしまった…翌日は体調が優れない', 'minus');
    }
  }

  state.afterpartyState = null;
  return { drinks, vomited, hungover, applied, tier };
}

// 打ち上げの飲みゲームから「逃げる」を選んだ場合。体力のみ回復し、経験点は得られない。
// メンバーが参加していた場合、そのメンバーとの親密度が5%下がる。
function fleeAfterparty() {
  const maxH = state.maxHealthMult || 100;
  const before = state.health;
  state.health = Math.min(maxH, state.health + 10);
  const healthGain = state.health - before;

  const intimacyDrops = [];
  if (state.lastLiveHadMembers) {
    (state.lastLiveMemberIds || []).forEach(fid => {
      const friend = state.friends.find(f => f.id === fid);
      if (friend && friend.intimacy !== undefined) {
        const beforeIntimacy = friend.intimacy;
        friend.intimacy = Math.round(friend.intimacy * 0.95);
        if (friend.intimacy < beforeIntimacy) {
          intimacyDrops.push({ name: friend.name, from: beforeIntimacy, to: friend.intimacy });
        }
      }
    });
  }

  addLog('隙を見て打ち上げから逃げ出した…', 'neutral');
  if (healthGain > 0) addLog(`体力が${healthGain}回復した`, 'plus');
  intimacyDrops.forEach(d => addLog(`${d.name}との親密度が下がった`, 'minus'));

  state.afterpartyState = null;
  return { healthGain, intimacyDrops };
}

// 打ち上げを終えて帰宅する(週が進み、日付が変わる)
function endAfterpartyAndGoHome() {
  advanceWeek({ skipEvents: true }); // 打ち上げ後はランダムイベントを発生させない
  render();
}

// ===== アクション: グッズ(経験値は得られない) =====
function makeGoods(key, quantity, price) {
  if (isFeverBlocked()) return;
  const g = GOODS.find(x => x.key === key);
  if (!g) return;
  quantity = Math.max(g.minQty, Math.round(quantity || g.minQty));
  price = Math.min(g.priceMax, Math.max(g.priceMin, Math.round(price)));

  const cost = quantity * g.unitCost;
  if (state.money < cost) { notifyInsufficientFunds(); render(); return; }
  state.money -= cost;

  state.goodsInvIdSeq = state.goodsInvIdSeq || 1;
  state.goodsInventory.push({
    id: state.goodsInvIdSeq++,
    key: g.key,
    name: g.name,
    remaining: quantity,
    total: quantity,
    price,
  });

  addLog(`${g.name}を${quantity.toLocaleString()}個制作した(-${yen(cost)})。在庫として販売を開始`, 'minus');
  applyHealthCost(g.healthCost);
  advanceWeek();
  render();
}

// 在庫があるグッズは、毎ターン(週)ごとに売れていく。
// 「在庫が4〜12週くらいで捌ける」「完売すると合計1.5倍の収益」という仕様に合わせて、
// 需要(知名度・フォロワー・価格・季節・デザイン◯)から完売までの目安週数を逆算し、
// それに沿って毎週の販売数を決める(単純な等比減衰ではなく目標到達型)。
function processGoodsSalesDaily() {
  const currentMonth = state.month;
  const hasDesign = (state.abilities || []).some(a => a.key === 'design');
  state.goodsInventory.forEach(inv => {
    if (inv.remaining <= 0) return;
    const g = GOODS.find(x => x.key === inv.key);
    if (!g) return;

    const seasonFactor = !g.seasonMonths ? 1.0 : (g.seasonMonths.includes(currentMonth) ? 1.5 : 0.6);
    const priceRange = (g.priceMax - g.priceMin) || 1;
    const priceT = Math.min(1, Math.max(0, (inv.price - g.priceMin) / priceRange));
    const priceFactor = 1.3 - priceT * 0.9; // 安いほど売れやすい
    const demandFactor = Math.min(1.6, 0.3 + state.fame / 15000 + state.followers / 30000);
    const designFactor = hasDesign ? 1.25 : 1.0; // デザイン◯で売れ行きアップ
    const merchantFactor = 1 + abilityTier('merchant') * 0.15; // 商才/青田買いで捌けが良くなる

    const speed = Math.min(1, Math.max(0, (demandFactor * priceFactor * seasonFactor * designFactor * merchantFactor - 0.3) / 1.3));
    const targetWeeks = Math.round(12 - speed * 8); // 需要が高いほど4週、低いほど12週に近づく
    const weeksLeftEstimate = Math.max(1, targetWeeks - (inv.weeksElapsed || 0));
    let units = Math.min(inv.remaining, Math.max(1, Math.round(inv.remaining / weeksLeftEstimate)));

    inv.weeksElapsed = (inv.weeksElapsed || 0) + 1;

    const revenue = units * inv.price;
    inv.remaining -= units;
    inv.revenueSoFar = (inv.revenueSoFar || 0) + revenue;
    addMoney(revenue);
    const fameGain = Math.round(units * 0.03);
    const followerGain = Math.round(units * 0.02);
    if (fameGain > 0) state.fame += fameGain;
    if (followerGain > 0) state.followers += followerGain;
    addLog(`${g.name}が${units.toLocaleString()}個売れた(+${yen(revenue)}${fameGain > 0 ? ` 知名度+${fameGain}` : ''})`, 'goods');

    if (inv.remaining <= 0) {
      const bonus = Math.round(inv.revenueSoFar * 0.5); // 完売で合計1.5倍相当になるよう追加収益
      addMoney(bonus);
      addLog(`${g.name}が完売！売り切りボーナス +${yen(bonus)}(合計1.5倍)`, 'money');
    }
  });
  state.goodsInventory = state.goodsInventory.filter(inv => inv.remaining > 0);
}

// ===== 新規ゲーム開始 =====
function resetGameState() {
  state.friends = createInitialFriends();   // きさら・いつきに戻す
  state.money = 10000;
  state.health = 100;
  state.condition = 'normal';
  state.hungover = false;
  state.feverTurnsLeft = 0;
  state.greatConditionTurnsLeft = 0;
  state.fame = 0;
  state.followers = 0;
  state.turn = 1;
  state.year = 1;
  state.month = START_MONTH;
  state.weekOfMonth = 1;
  state.gameEnded = false;
  state.totalEarnings = 0;
  state.weekIncome = 0;
  state.weekUnitsSold = 0;
  state.monthlyPerformance = 0;
  state.agencyStatus = 'unsigned';
  state.indieLabel = null;
  state.agencySalary = 0;
  state.agencyJoinTurn = null;

  // タケル(主人公)本人のステータス: 新しいサクセスを始めるたびに各10〜20でランダムに初期化する。
  // あわせて「持って生まれた才能/クセ」を1つ抽選する(45%で何か付き、残りは何も無し)。
  state.expPool = StatsEngine.createEmptyExpPool();
  state.statInvested = StatsEngine.createEmptyInvested();
  state.stats = StatsEngine.createEmptyStats();
  StatsEngine.STAT_ORDER.forEach(key => {
    state.stats[key] = 10 + Math.floor(Math.random() * 11); // 10〜20
  });
  state.abilities = [];
  state.startingAbility = StatsEngine.rollStartingAbility(state);
  state.jobMastery = { conveni: 0, izakaya: 0, event: 0, hikkoshi: 0, haitatsu: 0, koujou: 0 };
  state.motivation = 2;
  state.sick = false;
  state.indieOfferThreshold = Math.round(13000 + Math.random() * 4000);
  state.declinedIndieOffer = false;
  state.declinedMajorOffer = false;
  state.justAgencyOffer = null;
  state.justIndieLabelOffer = false;
  state.justKeibaEvent = null;
  state.justChoiceEvent = null;
  state.brokenGearTurns = 0;
  state.labelRequest = null;
  state.labelPerkBoost = false;
  state.labelRequestDone = false;
  state.skills = { vocal: 10, guitar: 10, performance: 10, live: 10, compose: 10 };
  state.songs = [];
  state.releases = [];
  state.songInProgress = null;
  state.justCompletedSong = null;
  state.justInsufficientFunds = false;
  state.justRyoheiEvent = null;
  state.justRyoheiCollabDay = false;
  state.ryoheiPendingOffer = null;
  state.ryoheiJustBecameFriend = false;
  state.ryoheiEvents = { rp1Done: false, rp3Done: false, rp4Done: false, firstCollabScheduled: false, firstCollabTurn: null, firstCollabAnnounced: false };
  state.takumaPendingOffer = null;
  state.justTakumaEvent = null;
  state.justTakumaCollabDay = false;
  state.takumaEvents = { tkm1Done: false, tkm2Done: false, collabPending: false, collabTurn: null, collabAnnounced: false };
  state.justReleasedCD = null;
  state.justRecordedCD = null;
  state.justPlayedLive = null;
  state.lastLiveHadMembers = false;
  state.lastLiveMemberIds = [];
  state.bandIntimacy = 0;
  state.afterpartyKnackGained = false;
  state.afterpartyState = null;
  state.justLiveDayArrived = null;
  state.liveDayAnnounced = false;
  state.peakFame = 0;
  state.peakFollowers = 0;
  state.scheduledGuests = [];
  state.guestAskedThisLive = {};
  state.promoMonth = null;
  state.promoCountThisMonth = 0;
  state.justLiveCancelled = null;
  state.justGuestReply = null;
  state.justDrNasakenaiEvent = false;
  state.drNasakenaiEventDone = false;
  state.maxHealthMult = 100;
  state.nextLiveTurn = LIVE_INTERVAL_TURNS;
  state.livePromoUsedTurn = null;
  state.liveExtraAudience = 0;
  state.genreMastery = {};
  state.justCollabLive = null;
  state.justFriendOffer = null;
  state.justPracticeResult = null;
  state.practiceStamps = 0;
  state.practiceCount = {};
  state.practiceCoupon = null;
  state.lastPracticeKey = null;   // 飽き性×の連続判定を前のサクセスから持ち越さない
  state.practiceStreak = 0;
  state.knacks = {};              // コツも前のサクセスから持ち越さない
  state.tenDrinkCount = 0;
  state.afterpartyKnackGained = false;
  state.justKnack = null;
  state.goodsInventory = [];
  state.goodsInvIdSeq = 1;
  state.friends = createInitialFriends();
  state.mailbox = [];
  state.mailIdSeq = 1;
  state.songIdSeq = 1;
  state.releaseIdSeq = 1;
  state.log = [];
  state.logHistory = [];
}

function generatePlayerId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字(0,O,1,I等)は除外
  let raw = '';
  for (let i = 0; i < 8; i++) raw += chars[Math.floor(Math.random() * chars.length)];
  return `TKR-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function startNewGameWithNames(playerName, bandName) {
  resetGameState();
  state.playerName = (playerName && playerName.trim()) ? playerName.trim() : 'タケル';
  state.bandName = (bandName && bandName.trim()) ? bandName.trim() : `${state.playerName}バンド`;
  state.playerId = generatePlayerId();

  const mail = {
    id: state.mailIdSeq++,
    type: 'allowance',
    playerName: state.playerName,
    amount: 5000,
    claimed: false,
    read: false,
  };
  state.mailbox.push(mail);
  addLog(`${state.playerName}の新バンド「${state.bandName}」の物語が始まった！`, 'plus');
  if (state.startingAbility) {
    addLog(`${state.playerName}は「${state.startingAbility.label}」を持っている`,
      state.startingAbility.negative ? 'minus' : 'money');
  }
}

function claimAllowanceMail(mailId) {
  const mail = state.mailbox.find(m => m.id === mailId);
  if (!mail || mail.type !== 'allowance' || mail.claimed) return;
  mail.claimed = true;
  mail.read = true;
  addMoney(mail.amount);
  addLog(`母ちゃんからの仕送り +${yen(mail.amount)}`, 'plus');
  render();
}

// ===== セーブ/ロード(localStorage) =====
const SAVE_KEY = 'takeru_mvp_save_v1';

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    ensureInitialFriends();
    return true;
  } catch (e) {
    return false;
  }
}

// きさら・いつきは最初からいるメンバー。
// 以前のバージョンで保存されたデータには入っていないことがあるので、
// 読み込んだ後に足りないぶんを補う。
function ensureInitialFriends() {
  state.friends = state.friends || [];
  // 並び順が入れ替わらないよう、後ろから足していく
  ['kisara', 'itsuki'].slice().reverse().forEach(key => {
    if (state.friends.some(f => f.id === key)) return;
    const npc = NPC_MEMBERS[key];
    state.friends.unshift({
      id: key, memberKey: key, isNpc: true,
      name: npc.name, bandName: npc.bandName, part: npc.part,
      stats: { ...npc.stats }, abilities: [...npc.abilities],
      fame: npc.fame, followers: npc.followers, intimacy: 50,
    });
  });
}

function hasSaveData() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

function deleteSaveData() {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

window.GameActions = {
  doJob, doPracticeSession, startSong, produceCD, releaseCD, doLive, makeGoods, doRest,
  finalizeFriendOfferLive, declineFriendOffer, hostCollabLive,
  acceptAgencyOffer, declineAgencyOffer,
  acceptIndieLabel, declineIndieLabelOffer,
  placeKeibaBet, receiveKeibaPayout,
  resolveStreetLive, resolveBrokenGear, resolveSnsBuzz, resolveMagazine,
  resolveParentCall, resolveCdOnAir, resolveLabelRequest,
  spendExtraWeek,
  doPromotion, recordGuestCandidates, canGuestRecord, startAfterparty, drinkAtAfterparty, finishAfterparty, endAfterpartyAndGoHome,
  AFTERPARTY_KING_TIMES, GUEST_INVITE_MIN_INTIMACY, canInviteGuest, inviteGuestToLive, guestAcceptChance,
  GUEST_INVITE_GALA, guestInviteGala, guestInviteVenue, COLLAB_INTIMACY_GAIN,
  FRIEND_KNACK, FRIEND_KNACK_CHANCE,
  PROMO_MAX_PER_MONTH, promoLeftThisMonth, promoMaxPerMonth,
  GUEST_INVITE_MIN_INTIMACY, canInviteGuest, isGuestCandidate, inviteGuestToLive, guestAcceptChance, cancelScheduledLive,
  learnSuperAbilityFrom, canLearnSuperFrom,
  resolveRyoheiRP3, scheduleRyoheiCollab, finalizeRecordingDay, resolveDrNasakenaiChoice, fleeAfterparty,
  resolveTakumaTkm1, resolveTakumaTkm2, acceptTakumaCollab, declineTakumaCollab,
  startNewGameWithNames, claimAllowanceMail,
  saveGame, loadGame, hasSaveData, deleteSaveData, ensureInitialFriends,
};
window.GameData = {
  JOBS, jobMasteryMult, JOB_MASTERY_WAGE_BONUS, JOB_MASTERY_EXP_BONUS, PRACTICE_MENUS, GENRES, CD_TYPES, STUDIOS, VENUES, GOODS, MEMBERS, PROMOTIONS, NPC_MEMBERS,
  INDIE_LABELS, INDIE_OFFER_THRESHOLD, indieLabelDef, recordingCostMult,
  RECORD_GUEST_COST, RECORD_GUEST_MIN_INTIMACY, RECORD_GUEST_IDS,
  INDIE_OVERALL_REQUIRED, meetsIndieRequirements,
  MAJOR_AUDIENCE_REQUIRED, MAJOR_FAME_REQUIRED, MAJOR_FOLLOWERS_REQUIRED, MAJOR_OVERALL_REQUIRED, meetsMajorRequirements,
  MAJOR_SALARY_MIN, MAJOR_SALARY_MAX, calcMajorSalary,
  KEIBA_BET_LIMIT, KEIBA_PAYOUT_LIMIT, KEIBA_RACE_NAMES,
  MEMBER_COST_BASE, MEMBER_COST_MAX, memberHireCost, PRODUCER_COST, MONTHLY_PERFORMANCE_THRESHOLD,
  SONG_HEALTH_COST,
  PRACTICE_STAMPS_FOR_COUPON, PRACTICE_COUPON_VALID_TURNS,
  PROMO_MAX_PER_MONTH,
  getPracticeLevel, PRACTICE_LEVEL_MULTIPLIER, practicePreview, PRACTICE_LEVEL_UP_EVERY, predictSongCompletion,
  TOTAL_TURNS, WEEKS_PER_MONTH, MONTHS_PER_YEAR, LIVE_INTERVAL_TURNS,
  turnToDate, turnToDateLabel,
  genreMasteryTier, GENRE_MASTERY_TIERS,
  pickVenueForPlayer, calcTicketsReserved, calcDrawPower, estimateLive, liveFatigueMult,
  randomSongTitle: generateSongTitle, randomAlbumTitle: generateAlbumTitle,
};
window.GameState = state;
