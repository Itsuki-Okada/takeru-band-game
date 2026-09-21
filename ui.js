let currentTab = 'home';
let appPhase = 'title'; // 'title' | 'howto' | 'game'
let howToReturnTo = 'title';
let howToOpenSections = {};
let prevStats = { money: null, followers: null, fame: null, health: null };
let lastRenderedHealth = null;    // ホームHUDの体力ゲージをアニメーションさせるための直前値
let lastRenderedMoney = null;
let lastRenderedFollowers = null;
let lastRenderedFame = null;
let suppressStatusBar = false;    // 背景HUDを持つ画面ではグローバルのstatusBarを隠す

const TAB_BGM_MAP = {
  title: 'title',
  song: 'compose',
  recording: 'compose',
  live: 'live',
  friendlive: 'live',
  ending: 'ending', // window.BGM.ending を用意すればエンディングで自動的に鳴る(未定義なら normal のまま)
};
let currentBgmKey = null;
let bgmMuted = false;

// ===== 音量バランス =====
// 効果音がBGMに埋もれず、かといってBGMが消えないところを狙った値。
// BGM_VOLUME を下げるほど効果音が前に出る(効果音側は sfx.js の master)。
const BGM_VOLUME = 0.38;   // 基準値。ここにユーザー設定の倍率を掛ける

// ===== 音量設定(0〜100で保存。BGMと効果音を別々に持つ) =====
const VOLUME_KEY = 'takeru_volumes';
let volumeSettings = { bgm: 70, sfx: 80 };

function loadVolumeSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(VOLUME_KEY) || 'null');
    if (v && typeof v.bgm === 'number' && typeof v.sfx === 'number') volumeSettings = v;
  } catch (e) { /* 既定値のまま */ }
  applyVolumeSettings();
}

function applyVolumeSettings() {
  const audioEl = document.getElementById('bgmPlayer');
  const vol = currentBgmVolume();
  // WebAudioに繋げていればそちらで音量を決める(iOSでも効く)。
  // 繋げられていない場合だけ、従来どおり要素のvolumeを使う。
  const viaGain = window.Sfx && window.Sfx.setBgmVolume ? window.Sfx.setBgmVolume(vol) : false;
  if (audioEl && !viaGain) audioEl.volume = vol;
  if (window.Sfx) window.Sfx.setVolume(SFX_BASE_VOLUME * (volumeSettings.sfx / 100));
}

// 今のBGM音量(曲ごとの補正 × 基準値 × ユーザー設定)
function currentBgmVolume() {
  const gain = BGM_GAIN[currentBgmKey] || 1;
  return Math.min(1, BGM_VOLUME * gain * (volumeSettings.bgm / 100));
}

const SFX_BASE_VOLUME = 0.60;   // sfx.js のマスターと同じ基準値

function setVolume(kind, value) {
  const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  volumeSettings[kind] = v;
  try { localStorage.setItem(VOLUME_KEY, JSON.stringify(volumeSettings)); } catch (e) { /* ignore */ }
  applyVolumeSettings();
  // 効果音は動かしたその場で聴けたほうが分かりやすい
  if (kind === 'sfx' && v > 0) playSfx('tap', { minGap: 0 });
  const label = document.getElementById('vol-' + kind + '-value');
  if (label) label.textContent = v + '%';
}

// 曲ごとの録音レベルの差を揃える補正。
// 各mp3の実測RMSを -17dB 前後に合わせてあり、曲が変わっても音量が飛ばない。
// BGMを差し替えた時は、ここも合わせて調整する(1.0 = 補正なし)。
const BGM_GAIN = {
  normal: 1.08,   // 実測 -17.7dB
  event:  1.18,   // 実測 -18.4dB
  title:  0.79,   // 実測 -15.0dB
  live:   0.68,   // 実測 -13.7dB
  compose: 0.82,  // 実測 -15.3dB
};

// イベント中だけ流すBGM。タブのBGMより優先される。
// setEventBgm(true)で切り替え、イベントの吹き出し・ポップアップが全部閉じたら戻す。
let bgmOverrideKey = null;

function setEventBgm(on) {
  const next = on ? 'event' : null;
  if (bgmOverrideKey === next) return;
  bgmOverrideKey = next;
  updateBGM(currentTab);
}

// イベントの表示がすべて終わっていれば通常BGMに戻す
function endEventBgmIfIdle() {
  if (!bgmOverrideKey) return;
  if (dialogueState) return;
  if (modalQueue.length > 0) return;
  setEventBgm(false);
}

let sfxObjects = {};

// 効果音。window.SFX に音声ファイル(data URI)が入っていればそれを、
// 無ければ sfx.js の合成音(WebAudio)を鳴らす。
function playSfx(key, opts) {
  if (bgmMuted) return;
  if (window.SFX && window.SFX[key]) {
    try {
      if (!sfxObjects[key]) sfxObjects[key] = new Audio(window.SFX[key]);
      const a = sfxObjects[key];
      a.currentTime = 0;
      a.play().catch(() => {});
      return;
    } catch (e) { /* 合成音にフォールバック */ }
  }
  if (window.Sfx) window.Sfx.play(key, opts);
}

// ===== 全画面共通のボタン音 =====
// 個々のonclickに書き足すのではなく、押された要素から音の種類を判定してまとめて鳴らす。
// これでどの画面のどのボタンでも音が出て、新しい画面を足しても書き漏らしが起きない。
function sfxKeyForElement(el) {
  if (!el || !el.closest) return null;
  if (el.closest('.dialogue-cmd-cancel, .keiba-btn-cancel, .modal-btn-cancel')) return 'cancel';
  if (el.closest('.back, .btn-back, .home-menu-close, .modal-close')) return 'cancel';
  if (el.closest('.dialogue-cmd-btn')) return 'select';
  if (el.closest('.dialogue-next-indicator, .dialogue-bubble-inline, .dialogue-bubble')) return 'page';
  if (el.closest('.bottom-nav button, .bottom-nav .nav-item, .tab-btn')) return 'nav';
  if (el.closest('.list-row, .menu-cmd, .card-row, .practice-card, .job-card, .song-row, .member-card')) return 'open';
  if (el.closest('button, a, [onclick], [role="button"], input[type="range"], select')) return 'tap';
  return null;
}

// 画面遷移アニメの最中など、音を出したくない時にtrueにする
let sfxSuppressed = false;

document.addEventListener('pointerdown', (e) => {
  if (sfxSuppressed) return;
  const key = sfxKeyForElement(e.target);
  if (key) playSfx(key, { minGap: 30 });
}, true);

// 結果表示のページに含まれる増減に合わせて音を鳴らす。
// 増加と減少が同じページに並ぶ場合は、増加を鳴らしたあと少し遅らせて減少を鳴らす。
function playResultSfxForHtml(html) {
  if (!html) return;
  // 1行ごとに「増えた/減った/お金」を見て、そのページを代表する音を決める
  const lines = String(html).match(/<p class="dialogue-line[^"]*">[^<]*<\/p>/g) || [];
  let plus = false, minus = false, money = false, spend = false;
  lines.forEach(line => {
    const isPlus = line.indexOf('dialogue-line-plus') >= 0;
    const isMinus = line.indexOf('dialogue-line-minus') >= 0;
    const isMoneyClass = line.indexOf('dialogue-line-money') >= 0;
    const hasYen = line.indexOf('¥') >= 0 || line.indexOf('円') >= 0;
    if (isMoneyClass || (isPlus && hasYen)) money = true;
    else if (isPlus) plus = true;
    if (isMinus) { if (hasYen) spend = true; else minus = true; }
  });
  // 良い知らせを先に、悪い知らせを少し遅らせて鳴らす(同時に鳴らすと濁るため)
  const good = money ? 'coin' : (plus ? 'gain' : null);
  const bad = spend ? 'spend' : (minus ? 'loss' : null);
  if (good) playSfx(good, { minGap: 0 });
  if (bad) {
    if (good) setTimeout(() => playSfx(bad, { minGap: 0 }), 260);
    else playSfx(bad, { minGap: 0 });
  }
}

let audioUnlocked = false;

function updateBGM(tab) {
  let key = bgmOverrideKey || TAB_BGM_MAP[tab] || 'normal';
  // 未収録のBGM(エンディングなど)を指しているときは、無音にならないよう通常BGMにフォールバックする
  if (!window.BGM[key]) key = 'normal';
  const audioEl = document.getElementById('bgmPlayer');
  if (!audioEl) return;
  if (key !== currentBgmKey) {
    currentBgmKey = key;
    audioEl.src = window.BGM[key];
    audioEl.loop = true;
  }
  const vol = Math.min(1, BGM_VOLUME * (BGM_GAIN[key] || 1) * (volumeSettings.bgm / 100));
  const viaGain = window.Sfx && window.Sfx.setBgmVolume ? window.Sfx.setBgmVolume(vol) : false;
  if (!viaGain) audioEl.volume = vol;
  audioEl.muted = bgmMuted || !audioUnlocked;
  if (audioEl.paused) {
    audioEl.play().catch(() => {}); // 自動再生制限時はミュート状態で待機し、初回操作で解除される
  }
}

function toggleBgmMute() {
  bgmMuted = !bgmMuted;
  if (window.Sfx) window.Sfx.setMuted(bgmMuted);
  const audioEl = document.getElementById('bgmPlayer');
  if (audioEl) audioEl.muted = bgmMuted || !audioUnlocked;
  render();
}

function setTab(tab) {
  if (isNavLocked() && tab !== currentTab) return; // 吹き出し表示中・ローディング中は画面遷移をブロック
  try { preloadImages(imagesForTab(tab)); } catch (e) { /* 先読みは失敗しても進行に影響させない */ }
  homeMenuOpen = false;
  if (currentTab === 'job' && tab !== 'job') {
    jobScreenState = { selected: null, phase: 'confirm' };
  }
  if (currentTab === 'live' && tab !== 'live') {
    liveFlowState = { confirming: false, promoting: false, members: [], venueKey: null };
  }
  if (currentTab === 'friend' && tab !== 'friend') {
    friendDetailId = null;
    hostOfferState = { friendId: null, venue: null, members: [] };
    friendSearchState = { result: null };
  }
  if (tab === 'friend') {
    syncFirebaseProfile();
    refreshFirebaseInbox();
    refreshOnlineFriends();
  }
  if (currentTab === 'practice' && tab !== 'practice') {
    practiceScreenState = { selected: null, phase: 'confirm', useCoupon: false, result: null };
  }
  if (currentTab === 'goods' && tab !== 'goods') {
    goodsFlowState = { type: null, quantity: null, price: null };
  }
  if ((currentTab === 'ranking' || currentTab === 'rivalstatus') && tab !== 'ranking' && tab !== 'rivalstatus') {
    rivalStatusEntry = null;
  }
  if (currentTab === 'song' && tab !== 'song') {
    songFlowState = { genre: null };
  }
  currentTab = tab;
  updateBGM(tab);
  render();
}

// あそびかた。cat でカテゴリ分けし、画面側でグループごとに並べる。
const HOWTO_CATEGORIES = [
  { key: 'basic',  label: 'まずはここから', accent: '#E8C468' },
  { key: 'grow',   label: '育てる',         accent: '#6EA8E0' },
  { key: 'live',   label: 'ライブで売る',   accent: '#E06A6A' },
  { key: 'goal',   label: 'デビューを目指す', accent: '#8FBF6A' },
];

const HOWTO_SECTIONS = [
  { key: 'flow', cat: 'basic', icon: '🎮', label: '基本の流れ',
    lead: '1行動＝1週間。2年半で勝負が決まります。',
    body: '下のタブから行動を1つ選ぶと1週間進みます。サクセスは<b>2年半(120週)</b>。<br><br>行動のあとは<b>30%でイベント</b>が起き、選択肢によって結果が変わります。<br><br>最後まで進むとエンディングになり、そこまでの成果が「サクセス済みのキャラ」として記録されます。' },
  { key: 'health', cat: 'basic', icon: '❤️', label: '体力と体調',
    lead: '無理をすると風邪をひき、こじらせると3週間動けません。',
    body: '行動するたびに体力が減ります。<b>体力50%以下</b>で行動すると風邪をひくことがあり、風邪のまま無理をすると<b>熱を出して3週間なにもできません</b>。<br><br>「休む」で体力が全回復します。1週間使いますが、寝込むより安上がりです。' },
  { key: 'money', cat: 'basic', icon: '💰', label: 'お金',
    lead: 'アルバイトが基本。メジャーになると給料制に変わります。',
    body: 'アルバイトは確実にお金が入り、経験点も少し手に入ります。同じ仕事を続けると<b>熟練度</b>が上がり、MAXになると特殊能力を覚えます。<br><br>お金はレコーディング・グッズ制作・<b>ライブの会場費</b>に使います。<br><br>メジャーデビューするとアルバイトが「事務所」に変わり、<b>毎月20〜50万円の給料</b>が入るようになります。' },

  { key: 'stats', cat: 'grow', icon: '📊', label: 'ステータスと経験点',
    lead: '経験点を振り分けて5つの能力を伸ばします。',
    body: '練習・ライブ・アルバイトで<b>筋力・技術・知力・精神</b>の経験点がたまります。ステータス画面で振り分けると、歌唱力・演奏・作曲・パフォーマンス・メンタルが上がります。<br><br>ランクが上がるほど1ポイントの値段も上がるので、後半ほど伸びにくくなります。<br><br>5つの平均が<b>総合力</b>で、ライブの出来やメジャーの条件に直結します。' },
  { key: 'practice', cat: 'grow', icon: '🎵', label: '練習',
    lead: '経験点を稼ぐ一番の手段。',
    body: '練習メニューごとに<b>練習レベル</b>があり、5回ごとに上がって獲得経験点が増えます。<br><br>同じ練習を続けるほど効率が良くなりますが、<b>ライブに使う週が減る</b>ので知名度が伸びません。練習に寄せるとステータスは高くなるかわりにメジャーデビューは遠のきます。' },
  { key: 'ability', cat: 'grow', icon: '✨', label: '特殊能力',
    lead: '経験点で覚えるもの、生まれ持つもの、ついてしまうもの。',
    body: 'ステータス画面の「特殊能力」から経験点で習得できます。総合力も上がります。<br><br>サクセス開始時に<b>45%で能力を1つ持って始まります</b>。良いものとは限らず、あがり症×や浪費癖×といった困ったクセのこともあります。<br><br>マイナス能力は自分では消せません。<b>ナサケナーイ博士の失敗</b>や<b>競馬での負け</b>でついてしまうこともあります。' },
  { key: 'song', cat: 'grow', icon: '🎼', label: '曲作りとCD',
    lead: '3曲そろえたらCDにして売りましょう。',
    body: '「曲を作る」でジャンルを選ぶと数週間かけて完成します。完成度は作曲力と<b>ジャンル熟練度</b>で決まります。<br><br>曲が3曲たまるとレコーディングしてCDを出せます。CDは発売後しばらく売れ続け、<b>知名度とフォロワー</b>も伸びます。' },

  { key: 'live', cat: 'live', icon: '🎤', label: 'ライブ',
    lead: '知名度を伸ばす主役。定期ライブと追加ライブの2種類があります。',
    body: '<b>定期ライブ</b>は6週に1回。会場は身の丈に合ったところが自動で決まり、会場費はかかりません。<br><br><b>追加ライブ</b>はライブ画面からいつでも打てます。会場を自分で選び、<b>会場費を前払い</b>して体力も使います。' },
  { key: 'venue', cat: 'live', icon: '🏟️', label: '会場選びが勝負',
    lead: '埋めれば大きく伸び、ガラガラなら赤字のうえ評判も落ちます。',
    body: '会場のキャパが大きいほど客が入るわけではありません。<b>集客力</b>(呼べる人数)がキャパを下回ると、その差がそのまま空席になります。<br><br>満員に近いほど知名度は大きく伸びます。逆に<b>充足率20%未満</b>だと知名度が下がり、会場費も丸損です。<br><br>さらに、キャパが集客力より大きすぎると<b>緊張して出来が落ちます</b>。度胸◯や大舞台◯があると和らぎます。' },
  { key: 'fatigue', cat: 'live', icon: '📉', label: '客足と人気の維持',
    lead: '連投すると客が飽き、放っておくと忘れられます。',
    body: '前回のライブから間隔が空くほど客足は戻ります。<b>翌週にもう1本打つと客足は本来の35%</b>まで落ちるので、詰め込みすぎは逆効果です。<br><br>また知名度とフォロワーは<b>毎週少しずつ減っていきます</b>。活動を止めると人は忘れていくので、伸ばし続ける必要があります。' },
  { key: 'promo', cat: 'live', icon: '📣', label: '宣伝',
    lead: 'ライブ前に打つと来場者が増えます。',
    body: '配信・チラシ・SNS広告の3種類があり、2週間に1回まで。来場者と知名度・フォロワーが増えます。効果は次のライブで消費されます。<br><br>背伸びした会場を埋めたい時は、宣伝で足りない分を補うのが有効です。' },

  { key: 'famefollow', cat: 'goal', icon: '⭐', label: '知名度とフォロワー',
    lead: 'ライブ・CD・イベントで伸びます。',
    body: '知名度はライブの動員とCDの売上で伸び、フォロワーはそれに連動します。<br><br>どちらも<b>毎週少しずつ減る</b>ので、貯金のように積み上がるものではなく「今の勢い」を表す数字だと思ってください。' },
  { key: 'agency', cat: 'goal', icon: '🏢', label: 'デビューへの道',
    lead: 'インディーズ→メジャーの2段階です。',
    body: '<b>インディーズ</b>は知名度かフォロワーが2,500を超え、総合力がDランク以上になると声がかかります。3つのレーベルから選べ、それぞれ特典が違います。<br><br><b>メジャー</b>は条件がぐっと厳しくなります。ステータス画面に残りの条件が出ているので、そこを見ながら進めてください。<br><br>条件を満たすと数週間以内に必ずオファーが届きます。' },
  { key: 'major', cat: 'goal', icon: '📀', label: 'メジャーデビュー後',
    lead: 'アルバイトが消え、給料と解雇ラインが生まれます。',
    body: 'アルバイトのタブが<b>事務所</b>に変わり、毎月給料が振り込まれます。額は知名度・フォロワー・ライブの動員で毎月見直され、20〜50万円の範囲で変わります。<br><br>ただし<b>毎月の動員が解雇ラインを下回ると契約を切られます</b>。デビューしてからも走り続ける必要があります。' },
  { key: 'friend', cat: 'goal', icon: '👥', label: 'フレンドと対バン',
    lead: '一緒にライブをすると動員もギャラも増えます。',
    body: 'りょーぺ・たくまといったキャラと仲良くなると、対バンのオファーが届きます。受けると相手の知名度も動員に乗るので、ひとりで打つより大きな会場に立てます。<br><br>IDで他のプレイヤーを検索してフレンドになることもできます。' },
];


let tempPlayerName = '';
let tempBandName = '';

// ===== 画像の先読み =====
// 画像はimg/に置いてあり、必要になった時に読み込まれる。
// ただし暗転明けに背景が間に合わないと一瞬白く見えるので、
// 「すぐ使うもの」は先に、「そのうち使うもの」は手が空いた時に裏で取っておく。
const preloadedImages = new Set();

function preloadImages(urls) {
  (urls || []).forEach(url => {
    if (!url || typeof url !== 'string' || preloadedImages.has(url)) return;
    if (url.indexOf('img/') !== 0) return;   // data URIや音声は対象外
    preloadedImages.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  });
}

// タブごとに「その画面で必ず出る画像」
function imagesForTab(tab) {
  const s = window.GameState;
  switch (tab) {
    case 'home':   return [homeBgUrl(), homeCharUrl()];
    case 'job':    return Object.values(window.JOB_THUMB || {});
    case 'practice': return Object.values(window.PRACTICE_BG || {});
    case 'live':   return [window.VENUE_BG ? window.VENUE_BG[(window.GameData.pickVenueForPlayer() || {}).key] : null];
    case 'goods':  return Object.values(window.GOODS_THUMB || {});
    case 'song':   return Object.values(window.STUDIO_BG || {});
    default: return [];
  }
}

// 起動直後に最低限のものだけ先に確保する
function preloadCriticalImages() {
  preloadImages([
    (window.HOME_CHAR_STATES && window.HOME_CHAR_STATES.normal) || null,
    window.TITLE_LOGO,
    window.HOME_BG,
  ]);
}

// 手が空いたタイミングで、よく使う背景を裏で温めておく
function preloadCommonImagesWhenIdle() {
  const run = () => {
    preloadImages([
      ...Object.values(window.JOB_THUMB || {}),
      ...Object.values(window.VENUE_BG || {}),
      ...Object.values(window.PRACTICE_BG || {}),
      ...Object.values(window.HOME_CHAR_STATES || {}),
      ...Object.values(window.RECORDING_CHARS || {}),
    ]);
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}

// ===== アカウント名 =====
// プレイヤー名は「アカウント名」として端末にひとつだけ持ち、サクセスをまたいで共通で使う。
// サクセスごとに変えられるのはバンド名だけ。アカウント名はタイトル画面から変更できる。
const ACCOUNT_NAME_KEY = 'takeru_account_name';

function getAccountName() {
  try {
    const v = localStorage.getItem(ACCOUNT_NAME_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch (e) { return null; }
}

function setAccountName(name) {
  const clean = (name && name.trim()) ? name.trim().slice(0, 10) : 'タケル';
  try { localStorage.setItem(ACCOUNT_NAME_KEY, clean); } catch (e) { /* 保存不可の環境は無視 */ }
  // 進行中のサクセスと、過去にクリアしたキャラの名前もまとめて置き換える
  if (window.GameState) window.GameState.playerName = clean;
  try {
    const runs = JSON.parse(localStorage.getItem('takeru_completed_runs') || '[]');
    runs.forEach(r => { r.playerName = clean; });
    localStorage.setItem('takeru_completed_runs', JSON.stringify(runs));
  } catch (e) { /* 同上 */ }
  syncFirebaseProfile();
  if (window.FirebaseSvc && window.FirebaseSvc.isReady()) {
    window.FirebaseSvc.renameMyRuns(clean);
    rankingData = null;
    majorBandsData = null;
  }
  return clean;
}

// 初回起動かどうか(アカウント名が未設定ならアカウント名入力から始める)
function initialAppPhase() {
  return getAccountName() ? 'title' : 'accountname';
}

function confirmAccountName() {
  const field = document.getElementById('accountNameField');
  const name = setAccountName(field ? field.value : '');
  accountNameEditing = false;
  appPhase = 'title';
  render();
  updateBGM('title');
  addLog(`アカウント名を「${name}」にした`, 'neutral');
}

let accountNameEditing = false;
// タイトルのネームプレートから開く、名前とアイコンの設定
function showPlayerSettings() {
  showModal(`
    <div class="modal-card">
      <p class="modal-title">プレイヤー設定</p>
      <div class="player-setting-row">
        <img src="${currentIconUrl()}" class="player-setting-icon" />
        <div class="player-setting-text">
          <p class="player-setting-name">${getAccountName() || '未設定'}</p>
          <p class="player-setting-sub">アイコンと名前はランキングにも出ます</p>
        </div>
      </div>
      <button class="modal-primary-btn" onclick="closeModal();showIconPicker();">アイコンを変える</button>
      <button class="modal-primary-btn" onclick="closeModal();openAccountNameEdit();">名前を変える</button>
      <button class="modal-close-btn" onclick="closeModal()">閉じる</button>
    </div>
  `);
}

function openAccountNameEdit() {
  accountNameEditing = true;
  appPhase = 'accountname';
  render();
}

function startNewGame() {
  if (GameActions.hasSaveData()) {
    showModal(`
      <div class="modal-card">
        <p class="modal-title">はじめから</p>
        <p class="modal-sub">セーブデータがあります。新しく始めると上書きされますが、よろしいですか？</p>
        <button class="modal-primary-btn" onclick="closeModal();confirmStartNewGame();">上書きして始める</button>
        <button class="modal-close-btn" onclick="closeModal()">キャンセル</button>
      </div>
    `);
    return;
  }
  confirmStartNewGame();
}

function confirmStartNewGame() {
  // プレイヤー名はアカウント名をそのまま使う。サクセスで決めるのはバンド名だけ。
  tempPlayerName = getAccountName() || 'タケル';
  tempBandName = '';
  appPhase = 'story';
  render();
}

function confirmBandNameAndStart() {
  const field = document.getElementById('bandNameField');
  tempBandName = (field && field.value.trim()) ? field.value.trim() : `${tempPlayerName}バンド`;
  GameActions.startNewGameWithNames(tempPlayerName, tempBandName);
  endingFlowStarted = false; // 前回のサクセスのエンディング状態が残らないようにする
  endingSaved = false;
  appPhase = 'game';
  currentTab = 'home';
  render();
  updateBGM('home');
  syncFirebaseProfile();
  // 持って生まれた才能/クセがあれば、最初に見せる
  const born = window.GameState.startingAbility;
  if (born) {
    queuePopup(() => showStartingAbilityPopup(born));
  }
}

// サクセス開始時に抽選された特殊能力のお知らせ
function showStartingAbilityPopup(born) {
  playSfx(born.negative ? 'fail' : 'fanfare', { minGap: 0 });
  showModal(`
    <div class="modal-card">
      <p class="modal-title">${born.negative ? '困ったクセがある…' : '生まれ持った才能！'}</p>
      <p class="modal-sub"><b style="color:${born.negative ? '#E06A6A' : '#E8C46A'};font-size:18px;">${born.label}</b></p>
      <p class="modal-sub">${born.effect}</p>
      <button class="modal-primary-btn" onclick="closeModal();">わかった</button>
    </div>
  `);
}

// 競馬などで悪いクセがついた時のお知らせ
// 熱で定期ライブが中止になった時のお知らせ
function showLiveCancelledPopup(info) {
  playSfx('fail', { minGap: 0 });
  showModal(`
    <div class="modal-card">
      <p class="modal-title">ライブを中止した</p>
      <p class="modal-sub">熱が下がらず、${info.venueName}での定期ライブに出られなかった。</p>
      <p class="modal-sub" style="color:#E06A6A;">キャンセル料 ${yen(info.fee)}${info.shortOfMoney ? '(払えるぶんだけ支払った)' : ''}</p>
      ${info.guestName ? `<p class="modal-sub">${info.guestName}との対バンも流れてしまった…</p>` : ''}
      <p class="modal-sub">次の定期ライブは ${info.nextLabel}</p>
      <button class="modal-primary-btn" onclick="closeModal();">…</button>
    </div>
  `);
}

function showNegativeAbilityPopup(got) {
  playSfx('fail', { minGap: 0 });
  showModal(`
    <div class="modal-card">
      <p class="modal-title">悪いクセがついてしまった…</p>
      <p class="modal-sub"><b style="color:#E06A6A;font-size:18px;">${got.label}</b></p>
      <p class="modal-sub">${got.effect}</p>
      <button class="modal-primary-btn" onclick="closeModal();">…</button>
    </div>
  `);
}

let lastProfileSyncAt = 0;
let realtimeSyncStarted = false;
let knownRequestIds = new Set();
let hasReceivedFirstRequestSnapshot = false;

function syncFirebaseProfile() {
  if (!(window.FirebaseSvc && window.FirebaseSvc.isConfigured())) return;
  const trySync = () => {
    if (!window.FirebaseSvc.isReady()) { setTimeout(trySync, 500); return; }
    const s = window.GameState;
    window.FirebaseSvc.upsertPlayerProfile({
      playerId: s.playerId, playerName: s.playerName, bandName: s.bandName,
      iconUrl: currentIconUrl(),
      fame: Math.round(s.fame), followers: Math.round(s.followers),
      money: Math.round(s.money), skills: s.skills,
      releases: (s.releases || []).map(r => ({ title: r.title, totalSold: r.totalSold, released: r.released })),
    });
    startFirebaseRealtimeSync();
  };
  trySync();
}

// フレンド一覧・フレンド申請をリアルタイムで監視し、
// 画面を開き直さなくても自動的に反映されるようにする
function startFirebaseRealtimeSync() {
  if (realtimeSyncStarted) return;
  if (!(window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady())) return;
  realtimeSyncStarted = true;

  window.FirebaseSvc.listenToFriends((friends) => {
    const s = window.GameState;
    // ゲーム内のキャラ(きさら・いつき・りょーぺ・たくま)は残したまま、
    // オンラインで繋がった相手だけを入れ替える。
    // ここで丸ごと代入すると、最初からいるメンバーが消えてしまう。
    const npcs = (s.friends || []).filter(f => f.isNpc);
    const online = friends.map(f => ({
      id: f.uid,
      playerId: f.playerId,
      name: f.playerName || '???',
      bandName: f.bandName || '(名称未設定)',
      iconUrl: f.iconUrl || '',
      fame: f.fame || 0,
      followers: f.followers || 0,
      level: f.level || 1,
      skills: f.skills || {},
      releases: f.releases || [],
    }));
    s.friends = [...npcs, ...online];
    render();
  });

  window.FirebaseSvc.listenToPendingRequests((requests) => {
    // 新着(前回まで存在しなかった)申請を検出して通知ポップアップを出す
    const newOnes = requests.filter(r => !knownRequestIds.has(r.id));
    if (hasReceivedFirstRequestSnapshot && newOnes.length > 0) {
      newOnes.forEach(r => {
        queuePopup(() => showFriendRequestArrivedPopup(r));
      });
    }
    hasReceivedFirstRequestSnapshot = true;
    knownRequestIds = new Set(requests.map(r => r.id));
    firebaseInboxRequests = requests;
    render();
  });

  // 自分が送った申請が承認されたら、自分自身のフレンド一覧にも反映する
  // (listenToFriendsが同じデータを拾ってrender()するので、ここでは特別な処理は不要)
  window.FirebaseSvc.listenToAcceptedOutgoingRequests(() => {
    // FirebaseSvc側で相手をfriendsサブコレクションに追加済み。
    // listenToFriendsのリスナーが自動的に検知してstate.friendsを更新するため、ここでは何もしない。
  });
}

function showFriendRequestArrivedPopup(r) {
  playSfx('notify');
  showModal(`
    <div class="modal-card">
      <div class="modal-icon-badge">🧑‍🤝‍🧑</div>
      <p class="modal-title">フレンド申請が届きました</p>
      <p class="modal-sub"><strong>${r.fromPlayerName}</strong>(${r.fromBandName})から申請が届いています</p>
      <button class="modal-primary-btn" onclick="closeModal();acceptOnlineFriendRequest('${r.id}','${r.fromUid}','${r.fromPlayerId}','${r.fromPlayerName}','${r.fromBandName}');">承認する</button>
      <button class="modal-close-btn" onclick="closeModal();declineOnlineFriendRequest('${r.id}');">見送る</button>
    </div>
  `);
}

function openHowTo(from) {
  howToReturnTo = from;
  appPhase = 'howto';
  render();
  if (from === 'title') updateBGM('title');
}

function closeHowTo() {
  if (howToReturnTo === 'title') {
    appPhase = 'title';
    render();
    updateBGM('title');
  } else {
    appPhase = 'game';
    render();
  }
}

// アカウント名の入力/変更。初回起動時と、タイトルからの変更で共用する。
function screenAccountNameFull() {
  const current = getAccountName() || '';
  const editing = accountNameEditing && !!current;
  return `
    <div class="intro-screen">
      <p class="intro-heading">${editing ? 'アカウント名を変更' : 'アカウント名を入力してください'}</p>
      <p class="intro-sub">${editing
        ? 'クリア済みのキャラの名前もまとめて変わります'
        : 'ゲーム全体で使う名前です。あとからタイトル画面で変更できます'}</p>
      <input id="accountNameField" type="text" maxlength="10" placeholder="例: タケル" class="text-input intro-input" value="${current}" />
      <button class="intro-primary-btn" onclick="confirmAccountName()">${editing ? '変更する' : 'この名前ではじめる'}</button>
      ${editing ? `<button class="intro-cancel-btn" onclick="accountNameEditing=false;appPhase='title';render();">やめる</button>` : ''}
    </div>
  `;
}

function screenStoryFull() {
  const name = tempPlayerName || 'タケル';
  return `
    <div class="intro-screen">
      <p class="intro-heading">Prologue</p>
      <div class="intro-story-text">
        <p>長年組んでいたバンドが、まさかの活動休止。<br>メンバーはそれぞれの道へ——<br>就職、結婚、そして謎の陶芸修行。<br>「ここらが潮時かもな」と誰かが笑っていた。</p>
        <p>気づけば${name}も28歳。<br>実家の母とはある約束をしていた。<br>「30歳までに売れなかったら、就職しなさい」<br>残された猶予は、あと2年半——。</p>
        <p>ならばこの2年半で必ずメジャーデビューしてやる。<br>ダメならその時は潔く諦める。<br>そう腹をくくり、${name}は新しいバンドを始めることに決めた。<br>とはいえ、メンバーは今のところ自分ひとり……。</p>
      </div>
      <button class="intro-primary-btn intro-next-btn" onclick="appPhase='bandname';render();">バンド名を決める</button>
    </div>
  `;
}

function screenBandNameFull() {
  return `
    <div class="intro-screen">
      <p class="intro-heading">バンド名を入力してください</p>
      <p class="intro-sub">プレイヤー名は「${tempPlayerName}」です(サクセス中は変更できません)</p>
      <input id="bandNameField" type="text" maxlength="14" placeholder="例: ${tempPlayerName}バンド" class="text-input intro-input" value="${tempBandName}" />
      <button class="intro-primary-btn" onclick="confirmBandNameAndStart()">この名前で始める</button>
    </div>
  `;
}

const TITLE_CD_ITEMS = [
  { key: 'success', catalog: 'TKR-001', label: 'SUCCESS', accent: '#E8C468', action: "event.stopPropagation();toggleSuccessMenu();" },
  { key: 'completed', catalog: 'TKR-002', label: 'SUCCESS\nDATA', accent: '#6EA8E0', action: "event.stopPropagation();setAppPhaseScreen('completed');" },
  { key: 'charalog', catalog: 'TKR-003', label: 'CHARACTERS', accent: '#8FBF6A', action: "event.stopPropagation();setAppPhaseScreen('charalog');" },
  { key: 'ranking', catalog: 'TKR-004', label: 'RANKING', accent: '#E06A6A', action: "event.stopPropagation();setAppPhaseScreen('rankingtitle');" },
  { key: 'howto', catalog: 'TKR-005', label: 'HELP', accent: '#C7B98A', action: "event.stopPropagation();openHowTo('title');" },
  { key: 'account', catalog: 'TKR-006', label: 'ACCOUNT', accent: '#B07AC7', action: "event.stopPropagation();openAccountNameEdit();" },
];

// タイトルロゴ。画像ではなくSVGで組み、
//   1文字ずつ跳ねながら飛び込む → 着地の衝撃 → ゆるく波打つ待機 → 金の光沢が走る
// という流れで見せる。文字はテキストのまま持っているので、文言を変えたい時はここだけ直せばよい。
const TITLE_UPPER = 'バンドマン';
const TITLE_LOWER = 'たける';

// 1文字ぶんのHTML。金の本体の後ろに、ずらした赤い版を敷いて印刷物っぽい厚みを出す。
// 待機の揺れは外側の<g>、飛び込みは<text>に掛けて、2つのアニメーションがぶつからないようにしている。
function titleLetter(ch, x, y, cls, i, delay) {
  const rot = (i % 2 === 0 ? -12 : 12);          // 1文字ごとに逆向きへひねりながら入る
  const waveDelay = (delay + 1.05).toFixed(2);
  const waveDir = (i % 2 === 0 ? 2.5 : -2.5);
  return `
    <g class="title-letter" style="--wd:${waveDelay}s;--wr:${waveDir}deg">
      <text class="title-ch title-ch-back ${cls}" style="--d:${delay.toFixed(2)}s;--r:${rot}deg" x="${x + 4}" y="${y + 5}">${ch}</text>
      <text class="title-ch ${cls}" style="--d:${delay.toFixed(2)}s;--r:${rot}deg" x="${x}" y="${y}">${ch}</text>
    </g>`;
}

function titleLogoSvg() {
  const upper = TITLE_UPPER.split('')
    .map((ch, i) => titleLetter(ch, 86 + i * 37, 44, 'title-ch-u', i, 0.06 * i))
    .join('');
  const lower = TITLE_LOWER.split('')
    .map((ch, i) => titleLetter(ch, 92 + i * 68, 114, 'title-ch-l', i, 0.40 + 0.10 * i))
    .join('');

  // 光沢は同じ文字を白で重ね、細い帯で切り抜いて通す。待機の揺れは掛けない。
  const shineUpper = TITLE_UPPER.split('')
    .map((ch, i) => `<text class="title-ch title-ch-u" x="${86 + i * 37}" y="44">${ch}</text>`).join('');
  const shineLower = TITLE_LOWER.split('')
    .map((ch, i) => `<text class="title-ch title-ch-l" x="${92 + i * 68}" y="114">${ch}</text>`).join('');

  return `
    <svg class="title-logo-svg" viewBox="0 0 320 140" role="img" aria-label="${TITLE_UPPER}${TITLE_LOWER}">
      <defs>
        <linearGradient id="titleGold" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%"   stop-color="#FFF7DC"/>
          <stop offset="34%"  stop-color="#F7D169"/>
          <stop offset="52%"  stop-color="#E0A929"/>
          <stop offset="68%"  stop-color="#F9DC8D"/>
          <stop offset="100%" stop-color="#C98A18"/>
        </linearGradient>
        <clipPath id="titleShineClip" clipPathUnits="userSpaceOnUse">
          <rect class="title-shine-rect" x="-110" y="-30" width="38" height="200"/>
        </clipPath>
      </defs>

      <!-- 「たける」が着地した瞬間に広がる衝撃の輪 -->
      <g class="title-impact">
        <ellipse class="title-ring" cx="160" cy="118" rx="70" ry="16"/>
        <ellipse class="title-ring title-ring-2" cx="160" cy="118" rx="70" ry="16"/>
      </g>

      <g class="title-letters">${upper}${lower}</g>
      <g class="title-shine" clip-path="url(#titleShineClip)">${shineUpper}${shineLower}</g>

      <!-- 音符がふわっと浮かぶ。バンドものらしさと、止まって見えない賑やかさのため -->
      <g class="title-notes">
        <!-- 位置合わせは外側の<g>で行う。<path>側にtransform属性を書くと、
             CSSアニメーションのtransformに上書きされて原点に飛んでしまうため。 -->
        <g transform="translate(34,124) scale(1.55)"><path class="title-note" style="--nd:1.6s;--nx:10px"  d="M0 0 h2.6 v-13 l7 -2.2 v3 l-7 2.2 v12.2 a3.4 3.4 0 1 1 -2.6 -3.1 z"/></g>
        <g transform="translate(276,118) scale(1.45)"><path class="title-note" style="--nd:2.9s;--nx:-9px" d="M0 0 h2.2 v-11 l6 -1.9 v2.6 l-6 1.9 v10.4 a2.9 2.9 0 1 1 -2.2 -2.6 z"/></g>
        <g transform="translate(262,42) scale(1.2)"><path class="title-note" style="--nd:4.1s;--nx:8px"  d="M0 0 h2 v-10 l5.4 -1.7 v2.4 l-5.4 1.7 v9.4 a2.6 2.6 0 1 1 -2 -2.4 z"/></g>
      </g>
    </svg>`;
}

function screenTitleFull() {
  const hasSave = GameActions.hasSaveData();
  const jackets = TITLE_CD_ITEMS.map((c, i) => `
    <div class="cd-jacket-wrap" style="--jrot:${i % 2 === 0 ? '-1.5deg' : '1.5deg'};">
      <div class="cd-disc-peek" style="--discAccent:${c.accent};"></div>
      <div class="cd-jacket" style="--jAccent:${c.accent};" onclick="${c.action}">
        <div class="cd-jacket-art">
          <p class="cd-jacket-catalog">${c.catalog}</p>
          <div class="cd-jacket-bottom">
            <div class="cd-jacket-rule"></div>
            <p class="cd-jacket-label">${c.label.split('\n').map(line => `<span>${line}</span>`).join('')}</p>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  const dots = TITLE_CD_ITEMS.map((c, i) => `<span class="cd-dot" data-idx="${i}"></span>`).join('');

  const successOverlay = successMenuOpen ? `
    <div class="cd-pop-overlay" onclick="successMenuOpen=false;render();">
      <div class="cd-disc cd-disc-left" onclick="event.stopPropagation();startNewGame();">
        <div class="cd-disc-label-ring"></div>
        <div class="cd-disc-hole"></div>
        <span>はじめから</span>
      </div>
      ${hasSave ? `
      <div class="cd-disc cd-disc-right" onclick="event.stopPropagation();continueGame();">
        <div class="cd-disc-label-ring"></div>
        <div class="cd-disc-hole"></div>
        <span>つづきから</span>
      </div>` : ''}
    </div>
  ` : '';

  const accountName = getAccountName() || '未設定';
  return `
    <div class="title-screen">
      <button class="title-player-plate" onclick="showPlayerSettings()">
        <img src="${currentIconUrl()}" class="title-player-face" />
        <span class="title-player-text">
          <span class="title-player-label">PLAYER</span>
          <span class="title-player-name">${accountName}</span>
        </span>
        <span class="title-player-edit">✎</span>
      </button>
      <div class="title-hero">
        <div class="title-logo-wrap">${titleLogoSvg()}</div>
        <div class="title-char-wrap">
          <div class="title-char-glow"></div>
          <img src="${idlePortrait()}" class="title-char" />
        </div>
      </div>
      <div class="cd-carousel" id="cdCarousel" onscroll="handleCdCarouselScroll()">${jackets}</div>
      <div class="cd-dots" id="cdDots">${dots}</div>
      ${successOverlay}
      <p class="title-caption">©2026 iroiro Co. All rights reserved.</p>
    </div>
  `;
}

let successMenuOpen = false;
function toggleSuccessMenu() {
  successMenuOpen = !successMenuOpen;
  render();
}
function handleCdCarouselScroll() {
  const el = document.getElementById('cdCarousel');
  const dotsBox = document.getElementById('cdDots');
  if (!el || !dotsBox) return;
  const cardWidth = el.scrollWidth / TITLE_CD_ITEMS.length;
  const idx = Math.round(el.scrollLeft / cardWidth);
  Array.from(dotsBox.children).forEach((d, i) => d.classList.toggle('active', i === idx));
}
function setAppPhaseScreen(phase) {
  successMenuOpen = false;
  appPhase = phase;
  render();
}

function continueGame() {
  const loaded = GameActions.loadGame();
  if (!loaded) { startNewGame(); return; }
  appPhase = 'game';
  render();
  updateBGM(currentTab);
  syncFirebaseProfile();
}

// ===== キャラ名鑑 =====
// 登場キャラクターの名鑑。ステータスは game.js の NPC_MEMBERS をそのまま参照するので、
// 数値を変えたい時は game.js 側だけ直せばここにも反映される。
const CHARA_LOG_ENTRIES = [
  { key: 'takeru', name: 'タケル', npc: null, part: 'ギター/ボーカル', band: '(プレイヤー)',
    catch: '28歳。崖っぷちのバンドマン。',
    profile: 'バンドが活動休止になり、気づけば28歳。<br>「30歳までに売れなかったら就職」という母との約束を抱えて、残り2年半で新しいバンドを立ち上げた。<br><br>能力は毎回ランダムで、サクセスごとに違う人生を送ることになる。',
    getImg: () => (window.HOME_CHAR_STATES && window.HOME_CHAR_STATES.normal) || '' },
  { key: 'kisara', name: 'きさら', npc: 'kisara', part: 'ベース', band: 'バンドメンバー',
    catch: '演奏A',
    profile: 'なんだかんだ主人公のわがままを聞いてくれる頼れる存在<br>競馬が好きらしい。',
    getImg: () => (window.MEMBER_CHARS && window.MEMBER_CHARS.kisara) ? window.MEMBER_CHARS.kisara.idle : '' },
  { key: 'itsuki', name: 'いつき', npc: 'itsuki', part: 'ドラム', band: 'バンドメンバー',
    catch: 'メンタルB',
    profile: '口数が少なく根暗だがたまにうるさいときがある。',
    getImg: () => (window.MEMBER_CHARS && window.MEMBER_CHARS.itsuki) ? window.MEMBER_CHARS.itsuki.idle : '' },
  { key: 'ryohei', name: 'りょーぺ', npc: 'ryohei', part: 'ギター/ボーカル', band: 'アフターワーク',
    catch: 'メンタルB',
    profile: 'バンド「アフターワーク」のギターボーカル。<br>コミュ力の塊。多分。',
    getImg: () => (window.MEMBER_CHARS && window.MEMBER_CHARS.ryohei) ? window.MEMBER_CHARS.ryohei.idle : '' },
  { key: 'takuma', name: 'たくま', npc: 'takuma', part: 'ギター/ボーカル', band: 'KAME',
    catch: '歌唱A',
    profile: 'バンド「KAME」のギターボーカル。<br>年々黒目が大きくなっている。<br>彼の目に光が宿るときはくるのか。<br>亀を飼っている(かめきち)',
    getImg: () => (window.MEMBER_CHARS && window.MEMBER_CHARS.takuma) ? window.MEMBER_CHARS.takuma.idle : '' },
  { key: 'hori', name: '堀 良音', npc: null, part: 'レーベル担当', band: 'ロケットミュージックエンターテイメント',
    catch: 'スカウト',
    profile: 'ロケットミュージックエンターテイメントのスカウト<br>インディーズレーベルも数社運営している。',
    getImg: () => window.HORI_IMG || '' },
  { key: 'nasakenai', name: 'ナサケナーイ博士', npc: null, part: '???', band: '???',
    catch: '???',
    profile: '夜道でまれに出会う謎の人物。ひとつだけ願いを聞いてくれる。',
    getImg: () => window.DR_NASAKENAI_IMG || '' },
];
let charaProfileKey = null;

function screenCharaLogFull() {
  const tiles = CHARA_LOG_ENTRIES.map(c => `
    <div class="chara-log-tile" onclick="charaProfileKey='${c.key}';render();">
      <img src="${c.getImg()}" class="chara-log-thumb" loading="lazy" decoding="async" />
      <p class="chara-log-name">${c.name}</p>
    </div>`).join('');
  return `
    <div class="howto-screen">
      <div class="howto-header">
        <button class="back" onclick="appPhase='title';render();updateBGM('title');">←</button>
        <span>キャラ名鑑</span>
      </div>
      <p class="howto-intro">気になるキャラをタップしてね</p>
      <div class="chara-log-grid">${tiles}</div>
    </div>
  `;
}

function screenCharaProfileFull() {
  const c = CHARA_LOG_ENTRIES.find(x => x.key === charaProfileKey);
  if (!c) { charaProfileKey = null; return screenCharaLogFull(); }
  const npc = c.npc ? (window.GameData.NPC_MEMBERS || {})[c.npc] : null;
  const statsHtml = npc ? StatsEngine.STAT_ORDER.map(key => {
    const v = npc.stats[key] || 0;
    const rank = StatsEngine.getRank(v);
    return `
      <div class="chara-stat-row">
        <span class="chara-stat-name">${StatsEngine.STAT_DEFS[key].name}</span>
        <div class="chara-stat-bar"><div class="chara-stat-fill" style="width:${Math.min(100, v)}%;"></div></div>
        <span class="chara-stat-rank">${rank}</span>
      </div>`;
  }).join('') : '';
  const abilityHtml = npc && npc.abilities.length
    ? npc.abilities.map(a => `<span class="chara-ability">${a}</span>`).join('')
    : '';
  return `
    <div class="howto-screen">
      <div class="howto-header">
        <button class="back" onclick="charaProfileKey=null;render();">←</button>
        <span>${c.name}</span>
      </div>
      <div class="chara-profile-hero">
        <img src="${c.getImg()}" class="chara-profile-img" />
        <div class="chara-profile-head">
          <p class="chara-profile-name">${c.name}</p>
          <p class="chara-profile-part">${c.part}</p>
          <p class="chara-profile-band">${c.band}</p>
        </div>
      </div>
      <p class="chara-profile-catch">${c.catch}</p>
      ${npc ? `
        <div class="chara-section">
          <p class="chara-section-title">ステータス</p>
          <div class="chara-stats">${statsHtml}</div>
        </div>
        ${abilityHtml ? `
        <div class="chara-section">
          <p class="chara-section-title">特殊能力</p>
          <div class="chara-abilities">${abilityHtml}</div>
        </div>` : ''}
        <div class="chara-section">
          <p class="chara-section-title">知名度・フォロワー</p>
          <div class="chara-meta">
            <span>⭐ 知名度 <b>${(npc.fame || 0).toLocaleString()}</b></span>
            <span>👥 フォロワー <b>${(npc.followers || 0).toLocaleString()}</b></span>
          </div>
        </div>` : ''}
      <div class="chara-section">
        <p class="chara-section-title">プロフィール</p>
        <p class="chara-profile-text">${c.profile}</p>
      </div>
    </div>
  `;
}

// ===== サクセス済みのキャラ =====
let completedRunsCache = [];

// クリアしたキャラの詳細。ランキングの詳細と同じ見た目で出し、ここから削除もできる。
function showCompletedDetail(index) {
  const r = completedRunsCache[index];
  if (!r) return;
  const saved = rankingData;
  rankingData = [r];
  showRankDetail(0);
  rankingData = saved;
  // 削除ボタンを足す
  const card = document.querySelector('.modal-card');
  if (!card) return;
  const btn = document.createElement('button');
  btn.className = 'modal-close-btn completed-delete-btn';
  btn.textContent = 'この記録を削除';
  btn.onclick = () => confirmDeleteCompleted(index);
  card.insertBefore(btn, card.lastElementChild);
}

function confirmDeleteCompleted(index) {
  const r = completedRunsCache[index];
  if (!r) return;
  closeModal();
  setTimeout(() => {
    showModal(`
      <div class="modal-card">
        <p class="modal-title">記録を削除しますか？</p>
        <p class="modal-sub">「${r.bandName || 'タケルバンド'}」の記録を消します。<br>ランキングからも消え、元に戻せません。</p>
        <button class="modal-primary-btn" onclick="deleteCompletedRun(${index});">削除する</button>
        <button class="modal-close-btn" onclick="closeModal()">やめる</button>
      </div>
    `);
  }, 260);
}

function deleteCompletedRun(index) {
  const r = completedRunsCache[index];
  closeModal();
  if (!r) return;
  // ローカルの記録を消す
  try {
    const key = 'takeru_completed_runs';
    const runs = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = runs.findIndex(x => x.completedAt === r.completedAt);
    if (idx >= 0) { runs.splice(idx, 1); localStorage.setItem(key, JSON.stringify(runs)); }
  } catch (e) { /* 保存できない環境は無視 */ }
  // ランキング側(Firestore)の記録も消す
  if (r.remoteId && window.FirebaseSvc && window.FirebaseSvc.isReady()) {
    window.FirebaseSvc.deleteCompletedRun(r.remoteId).then(() => {
      rankingData = null;
      majorBandsData = null;
    });
  }
  playSfx('cancel');
  setTimeout(() => render(), 280);
}

function screenCompletedFull() {
  let runs = [];
  try { runs = JSON.parse(localStorage.getItem('takeru_completed_runs') || '[]'); } catch (e) { /* 保存不可の環境は無視 */ }
  const statusLabel = st => st === 'major' ? 'メジャー' : (st === 'indie' ? 'インディーズ' : '無所属');
  completedRunsCache = runs;
  const rows = runs.map((r, i) => `
    <button class="rank-row rank-row-tap" onclick="showCompletedDetail(${i})">
      <div class="rank-no rank-no-top">${r.agencyStatus === 'major' ? '🏆' : (r.agencyStatus === 'indie' ? '🎸' : '🎤')}</div>
      <img src="${r.iconUrl || defaultIconUrl()}" class="rank-face" loading="lazy" decoding="async" />
      <div class="rank-body">
        <p class="rank-band">${r.bandName || 'タケルバンド'}
          ${r.agencyStatus === 'major' ? '<span class="rank-major">MAJOR</span>' : ''}</p>
        <p class="rank-player">${statusLabel(r.agencyStatus)} / 総合${r.overallRank} / 知名度${(r.fame || 0).toLocaleString()}</p>
      </div>
      <span class="rank-arrow">›</span>
    </button>
  `).join('');
  return `
    <div class="howto-screen">
      <div class="howto-header">
        <button class="back" onclick="appPhase='title';render();updateBGM('title');">←</button>
        <span>サクセス済みのキャラ</span>
      </div>
      ${runs.length > 0
        ? `<div class="rank-list">${rows}</div>`
        : `<p class="empty" style="margin-top:40px;">まだサクセスを完走したキャラがいません。<br>サクセスをクリアすると、ここに記録されます。</p>`}
    </div>
  `;
}

// ===== ランキング(タイトル画面・全プレイヤーのサクセス完走記録) =====
let rankingData = null;
let rankingLoading = false;
let rankingSort = 'overallScore';
let majorBandsData = null;
let majorBandsLoading = false;

const RANKING_SORTS = [
  { key: 'overallScore', label: '総合力', unit: r => `総合${r.overallRank} (${r.overallScore})` },
  { key: 'fame',         label: '知名度', unit: r => `知名度 ${(r.fame || 0).toLocaleString()}` },
  { key: 'totalUnitsSold', label: 'CD売上', unit: r => `${(r.totalUnitsSold || 0).toLocaleString()}枚` },
  { key: 'totalEarnings', label: '総収入', unit: r => yen(r.totalEarnings || 0) },
];

function setRankingSort(key) {
  if (rankingSort === key) return;
  rankingSort = key;
  rankingData = null;
  render();
}

// ランキングの行をタップした時の詳細。
// 保存されている範囲で、そのサクセスがどういう内容だったかを見せる。
function showRankDetail(index) {
  const r = (rankingData || [])[index];
  if (!r) return;
  const statsHtml = (r.stats && Object.keys(r.stats).length > 0)
    ? StatsEngine.STAT_ORDER.map(key => {
        const v = r.stats[key] || 0;
        return `
          <div class="chara-stat-row">
            <span class="chara-stat-name">${StatsEngine.STAT_DEFS[key].name}</span>
            <div class="chara-stat-bar"><div class="chara-stat-fill" style="width:${Math.min(100, v)}%;"></div></div>
            <span class="chara-stat-rank">${StatsEngine.getRank(v)}</span>
          </div>`;
      }).join('')
    : '<p class="rank-detail-none">この記録にはステータスが残っていません</p>';
  const abilityHtml = (r.abilities && r.abilities.length > 0)
    ? r.abilities.map(a => `<span class="chara-ability ${a.tone || (a.negative ? 'ability-tone-bad' : 'ability-tone-normal')} ${a.negative ? 'chara-ability-bad' : ''}">${a.label}</span>`).join('')
    : '<p class="rank-detail-none">特殊能力なし</p>';
  const statusLabel = r.agencyStatus === 'major'
    ? (r.debutTurn ? `${window.GameData.turnToDateLabel(r.debutTurn)}にメジャーデビュー` : 'メジャーデビュー')
    : (r.agencyStatus === 'indie' ? 'インディーズ所属' : '無所属');
  const debut = '';
  showModal(`
    <div class="modal-card modal-card-scroll">
      <div class="rank-detail-head">
        <img src="${r.iconUrl || defaultIconUrl()}" class="rank-detail-face" />
        <div class="rank-detail-name">
          <p class="rank-detail-band">${r.bandName || '???'}
            ${r.isMajor ? '<span class="rank-major">MAJOR</span>' : ''}</p>
          <p class="rank-detail-player">${r.playerName || '???'}</p>
          <p class="rank-detail-status">${statusLabel}</p>
        </div>
        <div class="rank-detail-rank">
          <span class="overall-rank-badge">${r.overallRank || 'G'}</span>
          <span class="rank-detail-score">${r.overallScore || 0}</span>
        </div>
      </div>
      <p class="chara-section-title">ステータス</p>
      <div class="chara-stats">${statsHtml}</div>
      <p class="chara-section-title">特殊能力</p>
      <div class="chara-abilities">${abilityHtml}</div>
      <p class="chara-section-title">サクセスの成績</p>
      <div class="rank-detail-grid">
        <div class="rank-detail-cell"><span>知名度</span><b>${(r.fame || 0).toLocaleString()}</b></div>
        <div class="rank-detail-cell"><span>フォロワー</span><b>${(r.followers || 0).toLocaleString()}</b></div>
        <div class="rank-detail-cell"><span>最高動員</span><b>${(r.bestAudience || 0).toLocaleString()}人</b></div>
        <div class="rank-detail-cell"><span>CD</span><b>${r.releasedCount || 0}枚</b></div>
        <div class="rank-detail-cell"><span>総販売</span><b>${(r.totalUnitsSold || 0).toLocaleString()}枚</b></div>
        <div class="rank-detail-cell"><span>総収入</span><b>${yen(r.totalEarnings || 0)}</b></div>
      </div>
      <button class="modal-close-btn" onclick="closeModal()">閉じる</button>
    </div>
  `);
}

function screenRankingTitleFull() {
  const online = window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady();
  if (online && rankingData === null && !rankingLoading) {
    rankingLoading = true;
    window.FirebaseSvc.fetchCompletedRuns(rankingSort, 30).then(list => {
      rankingData = list || [];
      rankingLoading = false;
      render();
    });
  }
  const sortDef = RANKING_SORTS.find(x => x.key === rankingSort) || RANKING_SORTS[0];
  const tabs = RANKING_SORTS.map(x => `
    <button class="rank-sort-btn ${x.key === rankingSort ? 'active' : ''}" onclick="setRankingSort('${x.key}')">${x.label}</button>
  `).join('');
  const rows = (rankingData || []).map((r, i) => {
    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : (i + 1)));
    return `
    <button class="rank-row rank-row-tap" onclick="showRankDetail(${i})">
      <div class="rank-no ${i < 3 ? 'rank-no-top' : ''}">${medal}</div>
      <img src="${r.iconUrl || defaultIconUrl()}" class="rank-face" loading="lazy" decoding="async" />
      <div class="rank-body">
        <p class="rank-band">${r.bandName || '???'}
          ${r.isMajor ? '<span class="rank-major">MAJOR</span>' : ''}</p>
        <p class="rank-player">${r.playerName || '???'}</p>
      </div>
      <div class="rank-value">${sortDef.unit(r)}</div>
      <span class="rank-arrow">›</span>
    </button>`;
  }).join('');
  let body;
  if (!online) {
    body = `<p class="empty" style="margin-top:40px;">オンライン機能に接続できていません。<br>通信環境を確認してください。</p>`;
  } else if (rankingLoading) {
    body = `<p class="empty" style="margin-top:40px;">読み込み中...</p>`;
  } else if (rankingData && rankingData.length > 0) {
    body = `<div class="rank-list">${rows}</div>`;
  } else {
    body = `<p class="empty" style="margin-top:40px;">まだ誰もサクセスを完走していません。<br>最初の1人になりましょう。</p>`;
  }
  return `
    <div class="howto-screen">
      <div class="howto-header">
        <button class="back" onclick="appPhase='title';render();updateBGM('title');">←</button>
        <span>ランキング</span>
      </div>
      <p class="howto-intro">サクセスを完走した全プレイヤーの記録</p>
      <div class="rank-sort-row">${tabs}</div>
      ${body}
    </div>
  `;
}

function screenHowToFull() {
  const groups = HOWTO_CATEGORIES.map(cat => {
    const rows = HOWTO_SECTIONS.filter(x => x.cat === cat.key).map(sec => `
      <button class="howto-card" style="--hcAccent:${cat.accent};" onclick="openHowtoModal('${sec.key}')">
        <span class="howto-card-icon">${sec.icon}</span>
        <span class="howto-card-text">
          <span class="howto-card-label">${sec.label}</span>
          <span class="howto-card-lead">${sec.lead}</span>
        </span>
        <span class="howto-card-arrow">›</span>
      </button>`).join('');
    return `
      <div class="howto-group">
        <div class="howto-group-head" style="--hcAccent:${cat.accent};">
          <span class="howto-group-bar"></span>
          <span class="howto-group-label">${cat.label}</span>
        </div>
        ${rows}
      </div>`;
  }).join('');
  return `
    <div class="howto-screen">
      <div class="howto-header">
        <button class="back" onclick="closeHowTo()">←</button>
        <span>あそびかた</span>
      </div>
      <div class="howto-hero">
        <img src="${idlePortrait()}" class="howto-hero-char" />
        <div class="howto-hero-text">
          <p class="howto-hero-title">2年半でメジャーデビューを目指す</p>
          <p class="howto-hero-sub">1行動＝1週間。全120週。<br>気になる項目をタップしてください。</p>
        </div>
      </div>
      <div class="howto-groups">${groups}</div>
    </div>
  `;
}

function openHowtoModal(key) {
  const s = HOWTO_SECTIONS.find(x => x.key === key);
  if (!s) return;
  showModal(`
    <div class="modal-card modal-card-scroll">
      <div class="modal-icon-badge">${s.icon}</div>
      <p class="modal-title">${s.label}</p>
      <p class="modal-lead">${s.lead}</p>
      <p class="modal-sub" style="text-align:left;">${s.body}</p>
      <button class="modal-primary-btn" onclick="closeModal()">閉じる</button>
    </div>
  `);
}

function logBox() {
  const s = window.GameState;
  if (!s.log || s.log.length === 0) return '';
  const latest = s.log[0];
  const textCls = latest.type === 'plus' ? 'log-plus' : (latest.type === 'minus' ? 'log-minus' : (latest.type === 'goods' ? 'log-goods' : ''));
  return `<div class="logbox-compact">
    <p class="${textCls}">${latest.msg}</p>
    <button class="log-history-btn" onclick="showLogHistoryModal()">ログ</button>
  </div>`;
}

function showLogHistoryModal() {
  const s = window.GameState;
  const history = s.logHistory || [];
  const lines = history.map(l => {
    const dotCls = l.type === 'plus' ? 'log-dot-plus' : (l.type === 'minus' ? 'log-dot-minus' : (l.type === 'goods' ? 'log-dot-goods' : 'log-dot-neutral'));
    const textCls = l.type === 'plus' ? 'log-plus' : (l.type === 'minus' ? 'log-minus' : (l.type === 'goods' ? 'log-goods' : ''));
    return `<div class="log-entry"><span class="log-dot ${dotCls}"></span><p class="${textCls}">${l.msg}</p></div>`;
  }).join('');
  showModal(`
    <div class="modal-card log-history-modal">
      <p class="modal-title">これまでのログ</p>
      <div class="log-history-scroll">${lines || '<p class="empty">まだ記録がありません</p>'}</div>
      <button class="modal-close-btn" onclick="closeModal();">閉じる</button>
    </div>
  `);
}

function feverBanner() {
  const s = window.GameState;
  if (s.condition !== 'fever') return '';
  return `<div class="progress-card" style="margin:10px 14px;border-color:#E06A6A;">
    <p class="progress-title" style="color:#E06A6A;">熱を出して寝込んでいます</p>
    <p class="progress-sub">あと${s.feverTurnsLeft}週安静に。ホームの「休む」で回復を待ちましょう</p>
  </div>`;
}

let jobScreenState = { selected: null, phase: 'confirm' };

// アクション結果の会話吹き出し(アルバイト/練習/ライブ/レコーディング共通)。
// dialogueState.screenTab が現在のタブと一致する間、通常の画面の代わりにこちらを表示する。
function dialogueResultScreen() {
  const ds = dialogueState;
  return `
    <div class="home-bg" style="background-image:url('${ds.bgUrl}')">
      ${bgHud()}
      ${dialogueBubbleInnerHtml()}
    </div>
    ${logBox()}
  `;
}

function screenJob() {
  if (dialogueState && dialogueState.screenTab === 'job') return dialogueResultScreen();
  const s = window.GameState;
  if (isSpecialLiveDayPending()) return liveDayBlockedScreen('アルバイト');
  if (s.agencyStatus === 'major') {
    return screenAgency();
  }
  if (jobScreenState.selected) {
    return jobWorkScreen(jobScreenState.selected);
  }
  const cards = window.GameData.JOBS.map(j => {
    return `
    <div class="job-card" onclick="jobScreenState={selected:'${j.key}',phase:'confirm'};render();">
      <img src="${window.JOB_THUMB[j.key]}" class="job-card-img" loading="lazy" decoding="async" />
      <p class="job-card-name">${j.name}</p>
      <p class="job-card-detail">体力-${j.healthCost}%</p>
      <p class="job-card-wage">時給${j.wage.toLocaleString()}円(×8H)</p>
    </div>`;
  }).join('');
  return sectionTitle('アルバイトを選ぶ') + feverBanner() + `<div class="job-grid">${cards}</div>` + logBox();
}

function screenAgency() {
  const s = window.GameState;
  const G = window.GameData;
  // 給料は毎月の振込時に計算し直される。
  // 画面には「次に振り込まれる見込み額」と「前回の実績」を分けて出す
  // (その場で計算した額だけを出すと、実際の振込額と食い違って見える)。
  const nextSalary = G.calcMajorSalary();
  const lastPaid = s.lastSalaryPaid || 0;
  const weeksToPayday = G.WEEKS_PER_MONTH - (s.weekOfMonth || 1) + 1;
  const perf = s.monthlyPerformance || 0;
  const threshold = G.MONTHLY_PERFORMANCE_THRESHOLD;
  const safe = perf >= threshold;
  return sectionTitle('事務所') + `
    <div class="progress-card" style="margin:10px 14px;">
      <p class="progress-title">メジャー契約中</p>
      <p class="progress-sub">${turnToDateLabel(s.agencyJoinTurn)}〜 契約中</p>
      <p class="progress-sub">次の給料(あと${weeksToPayday}週) <b style="color:#E8C46A;">${yen(nextSalary)}</b></p>
      ${lastPaid ? `<p class="progress-sub">前回の振込 ${yen(lastPaid)}</p>` : ''}
      <p class="progress-sub">知名度・フォロワー・ライブの動員で毎月見直される(${yen(G.MAJOR_SALARY_MIN)}〜${yen(G.MAJOR_SALARY_MAX)})</p>
    </div>
    <div class="progress-card" style="margin:10px 14px;">
      <p class="progress-title">今月の実績</p>
      <p class="progress-sub">${perf.toLocaleString()} / ${threshold.toLocaleString()}(解雇ライン)
        <b style="color:${safe ? '#3AA65C' : '#E06A6A'};">${safe ? '達成' : `あと${(threshold - perf).toLocaleString()}`}</b></p>
      <div class="bar" style="margin-top:8px;"><div class="bar-fill" style="width:${Math.min(100, Math.round(perf / threshold * 100))}%"></div></div>
      <p class="progress-sub" style="margin-top:6px;">ライブの動員とCDの売上が積み上がる。月末までに届かないと解雇される。</p>
    </div>
    <p class="section-label">CDの売上・ライブの動員を伸ばすと契約が続きます。低迷すると解雇されることがあります。</p>
    ${labelRosterHtml()}
    ${logBox()}
  `;
}

// 事務所の「所属バンド」。他のプレイヤーがサクセスでメジャーデビューまで行かせたバンドを並べる。
function labelRosterHtml() {
  const online = window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady();
  if (!online) return '';
  if (majorBandsData === null && !majorBandsLoading) {
    majorBandsLoading = true;
    window.FirebaseSvc.fetchMajorBands(20).then(list => {
      majorBandsData = list || [];
      majorBandsLoading = false;
      render();
    });
  }
  let inner;
  if (majorBandsLoading) {
    inner = `<p class="roster-empty">読み込み中...</p>`;
  } else if (majorBandsData && majorBandsData.length > 0) {
    inner = majorBandsData.map(b => `
      <div class="roster-row">
        <div class="roster-disc">💿</div>
        <div class="roster-text">
          <p class="roster-band">${b.bandName || '???'}</p>
          <p class="roster-player">${b.playerName || '???'}</p>
        </div>
        <div class="roster-fame">⭐${(b.fame || 0).toLocaleString()}</div>
      </div>`).join('');
  } else {
    inner = `<p class="roster-empty">まだ他に所属しているバンドがいません</p>`;
  }
  return `
    ${sectionTitle('所属バンド')}
    <p class="section-label">同じ事務所に所属している、他のプレイヤーのバンドです。</p>
    <div class="roster-list">${inner}</div>
  `;
}

function jobWorkScreen(key) {
  const s = window.GameState;
  const job = window.GameData.JOBS.find(j => j.key === key);
  const bg = window.JOB_BG[key];
  const charImg = window.JOB_THUMB[key];
  const phase = jobScreenState.phase;
  const wage = job.wage;
  const working = phase === 'working';

  return `
    <div class="header">
      <button class="back" ${working ? 'disabled' : ''} onclick="jobScreenState={selected:null,phase:'confirm'};render();">←</button>
      <span>${job.name}</span>
    </div>
    <div class="home-bg" style="background-image:url('${bg}')">
      ${bgHud()}
      <img src="${charImg}" class="job-char-overlay" />
    </div>
    ${working ? `
      <div class="progress-card" style="margin:10px 14px;">
        <div class="bar"><div class="bar-fill loading-fill"></div></div>
        <p class="progress-sub">頑張って働いています…</p>
      </div>
    ` : `
      <div style="padding:0 14px;"><button class="rest-btn" onclick="startJobWork('${key}')">この仕事をする</button></div>
      <div style="padding:8px 14px 0;"><button class="genre-btn" style="width:100%;" onclick="jobScreenState={selected:null,phase:'confirm'};render();">他のアルバイトにする</button></div>
    `}
    ${logBox()}
  `;
}

// アクション実行によって新しく追加されたログ行を集める(吹き出し表示用)。type情報も保持する。
function collectNewLogLines(actionFn) {
  const s = window.GameState;
  const beforeTop = s.log.length > 0 ? s.log[0] : null;
  actionFn();
  const lines = [];
  for (const entry of s.log) {
    if (beforeTop && entry === beforeTop) break;
    lines.push({ text: entry.msg, type: entry.type });
  }
  lines.reverse();
  return lines.length > 0 ? lines : [{ text: '', type: 'neutral' }];
}

function startJobWork(key) {
  jobScreenState.phase = 'working';
  render();
  setTimeout(() => {
    playSfx('complete');
    const bg = window.JOB_BG[key];
    const lines = collectNewLogLines(() => GameActions.doJob(key));
    jobScreenState = { selected: null, phase: 'confirm' };
    playCompleteWipeTransition(() => {
      showResultDialogue(
        [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }],
        window.GameState.playerName || 'タケル',
        lines,
        null,
        bg,
        'job',
        closeToHomeAnimated
      );
    });
  }, 2000);
}

const STAT_LABEL = { vocal: 'ボーカル', guitar: 'ギター', compose: '作曲', live: 'ライブ', performance: 'パフォーマンス' };
const PRACTICE_BG_MAP = { vocal: 'small', guitar: 'small', compose: 'small', group: 'live', dress_rehearsal: 'live', camp: 'camp' };
let practiceScreenState = { selected: null, phase: 'confirm', useCoupon: false, result: null };
let practiceFrameTimer = null;
let practiceLoadingTimer = null;

function screenPractice() {
  if (dialogueState && dialogueState.screenTab === 'practice') return dialogueResultScreen();
  if (isSpecialLiveDayPending()) return liveDayBlockedScreen('練習');
  if (practiceScreenState.selected) {
    return practiceSessionScreen();
  }
  const cards = window.GameData.PRACTICE_MENUS.map(m => {
    const bgKey = PRACTICE_BG_MAP[m.key] || 'small';
    const lv = window.GameData.getPracticeLevel(m.key);
    return `<div class="job-card" onclick="practiceScreenState={selected:'${m.key}',phase:'confirm',useCoupon:false,result:null};render();">
      <img src="${window.PRACTICE_BG[bgKey]}" class="job-card-img" loading="lazy" decoding="async" />
      <p class="job-card-name">${m.name} <span style="color:#E8C468;">Lv.${lv}</span></p>
      <p class="job-card-wage">¥${m.cost.toLocaleString()}</p>
    </div>`;
  }).join('');

  return sectionTitle('スタジオ練習') + feverBanner() +
    `<div class="job-grid">${cards}</div>` +
    practiceStampCard() + logBox();
}

function practiceStampCard() {
  const s = window.GameState;
  const stamps = s.practiceStamps || 0;
  const dots = Array.from({ length: window.GameData.PRACTICE_STAMPS_FOR_COUPON }, (_, i) => `
    <div class="stamp-dot ${i < stamps ? 'stamp-filled' : ''}" style="animation-delay:${i * 0.03}s;">${i < stamps ? '★' : ''}</div>
  `).join('');
  const couponValid = s.practiceCoupon && s.turn <= s.practiceCoupon.expiryTurn;
  const couponHtml = couponValid
    ? `<div class="coupon-card">
        <p class="coupon-title">🎟️ 練習半額クーポン</p>
        <p class="coupon-expiry">有効期限: ${turnToDateLabel(s.practiceCoupon.expiryTurn)}まで</p>
      </div>`
    : '';
  return `
    <p class="section-label">練習スタンプカード(${stamps}/${window.GameData.PRACTICE_STAMPS_FOR_COUPON})</p>
    <div class="stamp-card">${dots}</div>
    ${couponHtml}
  `;
}

function practiceSessionScreen() {
  const menu = window.GameData.PRACTICE_MENUS.find(m => m.key === practiceScreenState.selected);
  const phase = practiceScreenState.phase;
  const s = window.GameState;

  if (phase === 'working') {
    const bgKey = PRACTICE_BG_MAP[menu.key] || 'small';
    return `
      <div class="header"><span>${menu.name}</span></div>
      <div class="recording-session-bg" style="background-image:url('${window.PRACTICE_BG[bgKey]}')">
        ${bgHud()}
        <img id="practiceCharImg" src="${window.RECORDING_CHARS.vocal1}" class="recording-char-img" />
      </div>
      <div class="progress-card" style="margin:10px 14px;">
        <p class="progress-title">${menu.name}中...</p>
        <div class="bar"><div class="bar-fill loading-fill" style="animation-duration:3s;"></div></div>
      </div>
    `;
  }

  if (phase === 'couponAsk') {
    const halfCost = Math.round(menu.cost / 2);
    return `
      <div class="header"><span>${menu.name}</span></div>
      <div class="progress-card" style="margin:10px 14px;">
        <p class="progress-title">半額クーポンを使用しますか？</p>
        <p class="progress-sub">通常 ¥${menu.cost.toLocaleString()} → クーポン使用時 ¥${halfCost.toLocaleString()}</p>
        <p class="progress-sub" style="color:#E06A6A;font-weight:700;">クーポン期限: ${turnToDateLabel(s.practiceCoupon.expiryTurn)}まで</p>
      </div>
      <div style="padding:8px 14px 0;"><button class="rest-btn" onclick="confirmPracticeStart(true)">はい(クーポンを使う)</button></div>
      <div style="padding:8px 14px 0;"><button class="genre-btn" style="width:100%;" onclick="confirmPracticeStart(false)">いいえ(保留する)</button></div>
    `;
  }

  // confirm
  const couponValid = s.practiceCoupon && s.turn <= s.practiceCoupon.expiryTurn;
  return `
    <div class="header"><button class="back" onclick="practiceScreenState={selected:null,phase:'confirm',useCoupon:false,result:null};render();">←</button><span>${menu.name}</span></div>
    <div class="progress-card" style="margin:10px 14px;">
      <p class="progress-title">獲得予定</p>
      <p class="progress-sub">体力 -${menu.healthCost}%</p>
      <p class="progress-sub">費用: ¥${menu.cost.toLocaleString()}${couponValid ? '(クーポン利用可)' : ''}</p>
    </div>
    <div style="padding:0 14px;"><button class="rest-btn" onclick="startPracticeSession('${menu.key}')">練習を開始する</button></div>
  `;
}

function startPracticeSession(key) {
  practiceScreenState.selected = key;
  const s = window.GameState;
  const couponValid = s.practiceCoupon && s.turn <= s.practiceCoupon.expiryTurn;
  if (couponValid) {
    practiceScreenState.phase = 'couponAsk';
    render();
  } else {
    confirmPracticeStart(false);
  }
}

function confirmPracticeStart(useCoupon) {
  const menu = window.GameData.PRACTICE_MENUS.find(m => m.key === practiceScreenState.selected);
  const s = window.GameState;
  const cost = useCoupon ? Math.round(menu.cost / 2) : menu.cost;
  if (s.money < cost) {
    showInsufficientFundsToast();
    return;
  }
  practiceScreenState.phase = 'working';
  practiceScreenState.useCoupon = useCoupon;
  render();
  runPracticeLoading();
}

function runPracticeLoading() {
  clearInterval(practiceFrameTimer);
  clearTimeout(practiceLoadingTimer);
  let frame = 0;
  practiceFrameTimer = setInterval(() => {
    frame = frame === 0 ? 1 : 0;
    const img = document.getElementById('practiceCharImg');
    if (img) img.src = window.RECORDING_CHARS[frame === 0 ? 'vocal1' : 'vocal2'];
  }, 450);
  practiceLoadingTimer = setTimeout(() => {
    clearInterval(practiceFrameTimer);
    const key = practiceScreenState.selected;
    const useCoupon = practiceScreenState.useCoupon;
    playSfx('complete');
    const bgKey = PRACTICE_BG_MAP[key] || 'small';
    const lines = collectNewLogLines(() => GameActions.doPracticeSession(key, useCoupon));
    window.GameState.justPracticeResult = null;
    practiceScreenState = { selected: null, phase: 'confirm', useCoupon: false, result: null };
    playCompleteWipeTransition(() => {
      showResultDialogue(
        [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }],
        window.GameState.playerName || 'タケル',
        lines,
        null,
        window.PRACTICE_BG[bgKey],
        'practice',
        closeToHomeAnimated
      );
    });
  }, 3000);
}

function predictedCompletion() {
  const s = window.GameState;
  const base = (s.skills.compose * 1.5 + s.skills.vocal + s.skills.guitar) / 3;
  return Math.round(base);
}

let songFlowState = { genre: null };

function screenSong() {
  const s = window.GameState;

  if (s.songInProgress) {
    const p = s.songInProgress;
    const pct = Math.round((1 - p.weeksLeft / p.totalWeeks) * 100);
    return `
      <div class="craft-hero" style="background-image:url('${window.HOME_BG}')">
        <div class="craft-hero-shade"></div>
        <img src="${window.RECORDING_CHARS.guitar_idle}" class="craft-hero-char" />
        <div class="craft-hero-text">
          <p class="craft-hero-label">制作中</p>
          <p class="craft-hero-title">「${p.title}」</p>
          <p class="craft-hero-sub">${p.genre}</p>
        </div>
      </div>
      <div class="craft-progress">
        <div class="craft-progress-head">
          <span>完成まで</span><b>あと${p.weeksLeft}週</b>
        </div>
        <div class="craft-bar"><div class="craft-bar-fill" style="width:${pct}%"></div></div>
        <p class="craft-progress-note">何か行動すると週が進みます</p>
      </div>
    ` + songLifecycleList() + logBox();
  }

  const predicted = predictedCompletion();
  const s0 = window.GameState;
  const genreButtons = window.GameData.GENRES.map(g => {
    const mastery = (s0.genreMastery && s0.genreMastery[g]) || 0;
    const tier = window.GameData.genreMasteryTier(mastery);
    const selectedStyle = songFlowState.genre === g ? `box-shadow:0 0 0 2px ${tier.color} inset;` : '';
    return `
    <button class="genre-card ${songFlowState.genre === g ? 'genre-card-on' : ''}" style="--gTier:${tier.color};"
      onclick="songFlowState.genre='${g}';render();">
      <span class="genre-card-name">${g}</span>
      <span class="genre-card-bar"><span class="genre-card-fill" style="width:${Math.min(100, mastery)}%;"></span></span>
      <span class="genre-card-tier">${tier.label}${mastery >= 100 ? ' MAX' : ''}</span>
    </button>
  `;
  }).join('');
  return `
    <div class="craft-hero" style="background-image:url('${window.HOME_BG}')">
      <div class="craft-hero-shade"></div>
      <img src="${window.RECORDING_CHARS.guitar_idle}" class="craft-hero-char" />
      <div class="craft-hero-text">
        <p class="craft-hero-label">SONG WRITING</p>
        <p class="craft-hero-title">曲を作る</p>
        <p class="craft-hero-sub">¥2,000 / 体力-${window.GameData.SONG_HEALTH_COST}% / 2週かかる</p>
        <span class="craft-hero-badge">
          <span class="craft-badge-label">予想完成度</span>
          <span class="craft-badge-value">${predicted}</span>
        </span>
      </div>
    </div>
    ${feverBanner()}
    <div class="craft-block">
      <p class="craft-block-label">曲名</p>
      <div class="craft-title-row">
        <input id="songTitleField" type="text" placeholder="空欄ならおまかせ" class="text-input craft-title-input" />
        <button class="craft-dice" onclick="document.getElementById('songTitleField').value=GameData.randomSongTitle()">🎲</button>
      </div>
    </div>
    <div class="craft-block">
      <p class="craft-block-label">ジャンル <span class="craft-block-hint">作るほど熟練度が上がり、完成度が伸びます</span></p>
      <div class="genre-grid">${genreButtons}</div>
    </div>
    <div style="padding:4px 14px 0;">
      <button class="rest-btn" ${songFlowState.genre ? '' : 'disabled'} onclick="confirmStartSong()">
        ${songFlowState.genre ? `${songFlowState.genre}で作曲する` : 'ジャンルを選んでください'}
      </button>
    </div>
  ` + songLifecycleList() + logBox();
}

function confirmStartSong() {
  if (!songFlowState.genre) return;
  const titleField = document.getElementById('songTitleField');
  const title = titleField ? titleField.value : '';
  const genre = songFlowState.genre;
  songFlowState = { genre: null };
  GameActions.startSong(genre, title);
}

function songLifecycleList() {
  const s = window.GameState;
  const unused = s.songs.filter(sg => !sg.used);
  const releases = s.releases || [];

  let html = '';

  if (unused.length > 0) {
    const rows = unused.map(sg => `
      <div class="row" style="cursor:default;">
        <div class="thumb">🎼</div>
        <div class="row-text">
          <p class="row-title">${sg.title}</p>
          <p class="row-sub">${sg.genre} / 完成度${sg.completion} <span class="badge badge-draft">未使用</span></p>
        </div>
      </div>`).join('');
    html += `<p class="section-label">未使用の曲(${unused.length}曲)</p><div class="list">${rows}</div>`;
    html += `<div style="padding:8px 14px 0;"><button class="modal-primary-btn" style="width:100%;margin-top:0;" onclick="setTab('recording')">レコーディングする</button></div>`;
  }

  if (releases.length > 0) {
    const rows = releases.map(r => {
      let badge, action, extra = '';
      if (r.released) {
        badge = '<span class="badge badge-done">リリース済</span>';
        const weeksLeft = Math.max(0, 4 - (r.weeksElapsed || 0));
        extra = `<p class="row-sub">累計${r.totalSold.toLocaleString()}枚売上 / 売値¥${r.price.toLocaleString()}${r.salesActive ? ` / 販売継続あと${weeksLeft}週` : ' / 販売終了'}</p>`;
      } else {
        badge = '<span class="badge badge-ready">未リリース</span>';
        action = `<button class="row-btn" onclick="GameActions.releaseCD(${r.id})">リリースする</button>`;
      }
      return `
      <div class="row" style="cursor:default;">
        <div class="thumb">💿</div>
        <div class="row-text">
          <p class="row-title">${r.title}</p>
          <p class="row-sub">${r.typeName} / ${r.songCount}曲 / 完成度${r.completionAvg} ${badge}</p>
          ${extra}
        </div>
        ${action || ''}
      </div>`;
    }).join('');
    html += `<p class="section-label">制作したCD(${releases.length})</p><div class="list">${rows}</div>`;
  }

  return html;
}

let recordingState = { type: null, selectedSongs: [], price: null, members: [], guests: [], studio: 'a', producer: false };

const RECORDING_PHASE_CONFIG = {
  drums: { label: 'ドラムをレコーディング中...', frames: ['drum', 'drum_smile'] },
  bass: { label: 'ベースをレコーディング中...', frames: ['bass', 'bass_smile'] },
  guitar: { label: 'ギターをレコーディング中...', frames: ['vocal1', 'vocal2'] },
  vocal: { label: '歌をレコーディング中...', frames: ['vocal1', 'vocal2'] },
};
const RECORDING_MEMBER_ORDER = ['drums', 'bass'];

// パートごとに「その担当キャラのライブ絵」を使う。
// 叩いているのはいつきなので、ドラムの収録中はいつきのライブ画像を出す。
const RECORDING_PHASE_MEMBER = { drums: 'itsuki' };

// 収録中に出す画像。担当キャラのライブ絵があればそれを、なければ従来の絵を使う。
function recordingPhaseImg(phaseKey, frame) {
  const memberKey = RECORDING_PHASE_MEMBER[phaseKey];
  const chars = memberKey && window.MEMBER_CHARS && window.MEMBER_CHARS[memberKey];
  if (chars && Array.isArray(chars.live) && chars.live.length > 0) {
    return chars.live[frame % chars.live.length];
  }
  const config = RECORDING_PHASE_CONFIG[phaseKey];
  return window.RECORDING_CHARS[config.frames[frame]];
}

let recordingSessionState = { active: false, phases: [], phaseIndex: 0, frame: 0, pendingParams: null };
let recordingFrameTimer = null;
let recordingPhaseTimer = null;

const MEMBER_CHAR_KEY = { bass: 'bass', drums: 'drum', keyboard: 'keyboard' };
const MEMBER_NPC_KEY = { bass: 'kisara', drums: 'itsuki' }; // MEMBERS.keyからMEMBER_CHARSのキーへの対応(keyboardはNPC未設定)

function thumbImg(src) {
  return `<div class="thumb thumb-img"><img src="${src}" /></div>`;
}

function memberToggleRows(selectedArray, toggleFnName) {
  return window.GameData.MEMBERS.map(m => {
    const checked = selectedArray.includes(m.key);
    const npcKey = MEMBER_NPC_KEY[m.key];
    const npc = npcKey && window.MEMBER_CHARS && window.MEMBER_CHARS[npcKey];
    const charSrc = npc ? npc.idle : window.RECORDING_CHARS[MEMBER_CHAR_KEY[m.key]];
    return `<div class="row ${checked ? 'active' : ''}" onclick="${toggleFnName}('${m.key}')">
      ${thumbImg(charSrc)}
      <div class="row-text"><p class="row-title">${m.name}</p><p class="row-sub">¥${m.cost.toLocaleString()}</p></div>
      <span class="row-value ${checked ? 'gold' : ''}">${checked ? '雇用中' : ''}</span>
    </div>`;
  }).join('');
}

function producerToggleRow() {
  const checked = recordingState.producer;
  return `<div class="row ${checked ? 'active' : ''}" onclick="recordingState.producer=!recordingState.producer;render();">
    ${thumbImg(window.RECORDING_CHARS.producer)}
    <div class="row-text"><p class="row-title">プロデューサー</p><p class="row-sub">¥${window.GameData.PRODUCER_COST.toLocaleString()} / 完成度アップ</p></div>
    <span class="row-value ${checked ? 'gold' : ''}">${checked ? '起用中' : ''}</span>
  </div>`;
}

// 親密度MAXのたくま・りょーぺはレコーディングにゲスト参加してもらえる
// (ライブのサポートメンバーには入れない)
function guestToggleRows() {
  const cands = GameActions.recordGuestCandidates();
  if (!cands.length) return '';
  const cost = window.GameData.RECORD_GUEST_COST;
  return cands.map(f => {
    const checked = (recordingState.guests || []).includes(f.id);
    const chars = window.MEMBER_CHARS && window.MEMBER_CHARS[f.id];
    const charSrc = chars ? chars.idle : window.RECORDING_CHARS.vocal1;
    return `<div class="row ${checked ? 'active' : ''}" onclick="toggleRecordingGuest('${f.id}')">
      ${thumbImg(charSrc)}
      <div class="row-text"><p class="row-title">${f.name}(${f.bandName})</p><p class="row-sub">¥${cost.toLocaleString()} / 完成度が大きくアップ</p></div>
      <span class="row-value ${checked ? 'gold' : ''}">${checked ? '参加' : ''}</span>
    </div>`;
  }).join('');
}

function studioToggleRows() {
  return window.GameData.STUDIOS.map(st => {
    const checked = recordingState.studio === st.key;
    return `<div class="row ${checked ? 'active' : ''}" onclick="recordingState.studio='${st.key}';render();">
      ${thumbImg(window.STUDIO_BG[st.key])}
      <div class="row-text"><p class="row-title">${st.name}</p><p class="row-sub">1曲¥${st.costPerSong.toLocaleString()} / 音質補正 x${st.qualityBonus}</p></div>
      <span class="row-value ${checked ? 'gold' : ''}">${checked ? '選択中' : ''}</span>
    </div>`;
  }).join('');
}

function screenRecording() {
  if (dialogueState && dialogueState.screenTab === 'recording') return dialogueResultScreen();
  if (recordingSessionState.active) {
    return screenRecordingSession();
  }
  if (isSpecialLiveDayPending()) return liveDayBlockedScreen('レコーディング');

  const s = window.GameState;
  const unused = s.songs.filter(sg => !sg.used);

  if (!recordingState.type) {
    if (unused.length === 0) {
      return sectionTitle('CD種別を選ぶ') + `<p class="empty">未使用の曲がありません。先に曲制作をしてください。</p>`;
    }
    const enough = t => unused.length >= t.minSongs;
    const typeCards = window.GameData.CD_TYPES.map(t => `
      <button class="cd-type-card ${enough(t) ? '' : 'cd-type-locked'}" ${enough(t) ? '' : 'disabled'}
        onclick="recordingState={type:'${t.key}',selectedSongs:[],price:${t.priceMin},members:[],guests:[],studio:'a',producer:false};render();">
        <span class="cd-type-disc"><span class="cd-type-hole"></span></span>
        <span class="cd-type-text">
          <span class="cd-type-name">${t.name}</span>
          <span class="cd-type-sub">${t.minSongs}〜${t.maxSongs}曲 / 売値 ¥${t.priceMin.toLocaleString()}〜¥${t.priceMax.toLocaleString()}</span>
          ${enough(t) ? '' : `<span class="cd-type-need">あと${t.minSongs - unused.length}曲必要</span>`}
        </span>
        <span class="cd-type-arrow">›</span>
      </button>`).join('');
    return `
      <div class="craft-hero" style="background-image:url('${window.STUDIO_BG.a}')">
        <div class="craft-hero-shade"></div>
        <img src="${window.RECORDING_CHARS.vocal1}" class="craft-hero-char" />
        <div class="craft-hero-text">
          <p class="craft-hero-label">RECORDING</p>
          <p class="craft-hero-title">CDを作る</p>
          <p class="craft-hero-sub">手持ちの曲 ${unused.length}曲</p>
        </div>
      </div>
      ${feverBanner()}
      <div class="craft-block">
        <p class="craft-block-label">どの規模で出す？</p>
        <div class="cd-type-list">${typeCards}</div>
      </div>
    ` + logBox();
  }

  const type = window.GameData.CD_TYPES.find(t => t.key === recordingState.type);
  const studio = window.GameData.STUDIOS.find(st => st.key === recordingState.studio) || window.GameData.STUDIOS[0];
  const selected = recordingState.selectedSongs;
  const songRows = unused.map(sg => {
    const checked = selected.includes(sg.id);
    return `<div class="row ${checked ? 'active' : ''}" onclick="toggleSongSelect(${sg.id})">
      <div class="thumb">🎼</div>
      <div class="row-text"><p class="row-title">${sg.title}</p><p class="row-sub">${sg.genre} / 完成度${sg.completion}</p></div>
      <span class="row-value ${checked ? 'gold' : ''}">${checked ? '選択中' : ''}</span>
    </div>`;
  }).join('');

  const memberCost = recordingState.members.length * window.GameData.MEMBER_COST;
  const producerCost = recordingState.producer ? window.GameData.PRODUCER_COST : 0;
  const guestCost = (recordingState.guests || []).length * window.GameData.RECORD_GUEST_COST;
  const cost = selected.length * studio.costPerSong + memberCost + producerCost + guestCost;
  const guestRows = guestToggleRows();
  const canProduce = selected.length >= type.minSongs && selected.length <= type.maxSongs;
  const price = recordingState.price || type.priceMin;

  return sectionTitle(`${type.name}を制作(${type.minSongs}〜${type.maxSongs}曲)`) +
    `<p class="section-label">曲を選ぶ(${selected.length}/${type.maxSongs})</p>
     <div class="list">${songRows}</div>
     <p class="section-label">スタジオを選ぶ</p>
     <div class="list">${studioToggleRows()}</div>
     <p class="section-label">サポートメンバーを雇う(任意・1人¥10,000)</p>
     <div class="list">${memberToggleRows(recordingState.members, 'toggleRecordingMember')}</div>
     <p class="section-label">プロデューサーを起用する(任意)</p>
     <div class="list">${producerToggleRow()}</div>
     ${guestRows ? `<p class="section-label">ゲストを呼ぶ(親密度MAXのフレンドのみ)</p><div class="list">${guestRows}</div>` : ''}
     <div style="padding:10px 14px 0;">
       <p class="section-label" style="padding:0 0 4px;">CDタイトル(空欄でランダム)</p>
       <div style="display:flex;gap:6px;">
         <input id="cdTitleField" type="text" placeholder="CDタイトルを入力" class="text-input" style="flex:1;" />
         <button class="row-btn" onclick="document.getElementById('cdTitleField').value=GameData.randomAlbumTitle()">🎲</button>
       </div>
     </div>
     <div style="padding:10px 14px 0;">
       <p class="section-label" style="padding:0 0 4px;">売値: <span id="priceLabel">¥${price.toLocaleString()}</span>(¥${type.priceMin.toLocaleString()}〜¥${type.priceMax.toLocaleString()})</p>
       <input id="priceRange" type="range" min="${type.priceMin}" max="${type.priceMax}" step="50" value="${price}"
         oninput="recordingState.price=parseInt(this.value);document.getElementById('priceLabel').innerText='¥'+parseInt(this.value).toLocaleString();"
         style="width:100%;" />
     </div>
     <div style="padding:10px 14px 0;"><p class="row-sub" style="text-align:center;">制作費用: ¥${cost.toLocaleString()}(${studio.name} ¥${studio.costPerSong.toLocaleString()}×${selected.length} + メンバー¥${memberCost.toLocaleString()} + プロデューサー¥${producerCost.toLocaleString()}${guestCost ? ` + ゲスト¥${guestCost.toLocaleString()}` : ''})</p></div>
     <div style="padding:8px 14px 0;"><button class="rest-btn" ${canProduce ? '' : 'disabled'} onclick="confirmProduceCD()">この内容で制作する</button></div>
     <div style="padding:8px 14px 0;"><button class="genre-btn" style="width:100%;" onclick="recordingState={type:null,selectedSongs:[],price:null,members:[],guests:[],studio:'a',producer:false};render();">CD種別を選び直す</button></div>
     ${logBox()}`;
}

const RECORDING_PART_HEIGHT = { drums: 175, bass: 140, keyboard: 148, guitar: 148, vocal: 148 };
const PRODUCER_HEIGHT = 120;

function screenRecordingSession() {
  const rs = recordingSessionState;
  const phaseKey = rs.phases[rs.phaseIndex];
  const config = RECORDING_PHASE_CONFIG[phaseKey];
  const bg = window.STUDIO_BG[recordingState.studio];
  const charHeight = RECORDING_PART_HEIGHT[phaseKey] || 140;
  const producerHtml = recordingState.producer
    ? `<img src="${window.RECORDING_CHARS.producer}" class="recording-producer-img" style="height:${PRODUCER_HEIGHT}px;" />`
    : '';
  const guestIds = (rs.pendingParams && rs.pendingParams.guests) || [];
  const guestHtml = guestIds.map(id => {
    const chars = window.MEMBER_CHARS && window.MEMBER_CHARS[id];
    if (!chars) return '';
    const src = Array.isArray(chars.live) && chars.live.length ? chars.live[rs.frame % chars.live.length] : chars.idle;
    return `<img src="${src}" class="recording-guest-img" />`;
  }).join('');
  return `
    <div class="header"><span>レコーディング中</span></div>
    <div class="recording-session-bg" style="background-image:url('${bg}')">
      ${bgHud()}
      ${producerHtml}
      <div class="recording-guest-row">${guestHtml}</div>
      <img id="recordingCharImg" src="${recordingPhaseImg(phaseKey, rs.frame)}" class="recording-char-img" style="height:${charHeight}px;" />
    </div>
    <div class="progress-card" style="margin:10px 14px;">
      <p class="progress-title">${config.label}</p>
      <div class="bar"><div class="bar-fill loading-fill" style="animation-duration:3s;" id="recordingPhaseBar"></div></div>
    </div>
  `;
}

function toggleSongSelect(id) {
  const type = window.GameData.CD_TYPES.find(t => t.key === recordingState.type);
  const idx = recordingState.selectedSongs.indexOf(id);
  if (idx >= 0) {
    recordingState.selectedSongs.splice(idx, 1);
  } else {
    if (recordingState.selectedSongs.length >= type.maxSongs) { return; }
    recordingState.selectedSongs.push(id);
  }
  render();
}

function toggleRecordingMember(key) {
  const idx = recordingState.members.indexOf(key);
  if (idx >= 0) { recordingState.members.splice(idx, 1); } else { recordingState.members.push(key); }
  render();
}

function toggleRecordingGuest(id) {
  recordingState.guests = recordingState.guests || [];
  const idx = recordingState.guests.indexOf(id);
  if (idx >= 0) { recordingState.guests.splice(idx, 1); } else { recordingState.guests.push(id); }
  render();
}

function confirmProduceCD() {
  const titleField = document.getElementById('cdTitleField');
  const title = titleField ? titleField.value : '';
  const price = recordingState.price || window.GameData.CD_TYPES.find(t => t.key === recordingState.type).priceMin;

  const s = window.GameState;
  const studio = window.GameData.STUDIOS.find(st => st.key === recordingState.studio) || window.GameData.STUDIOS[0];
  const memberCost = recordingState.members.length * window.GameData.MEMBER_COST;
  const producerCost = recordingState.producer ? window.GameData.PRODUCER_COST : 0;
  const guestCost = (recordingState.guests || []).length * window.GameData.RECORD_GUEST_COST;
  const recordingBaseCost = recordingState.selectedSongs.length * studio.costPerSong;
  const totalCost = Math.round(recordingBaseCost * window.GameData.recordingCostMult()) + memberCost + producerCost + guestCost;
  if (s.money < totalCost) {
    showInsufficientFundsToast();
    return;
  }

  const phases = RECORDING_MEMBER_ORDER.filter(k => recordingState.members.includes(k));
  phases.push('guitar');
  phases.push('vocal');

  recordingSessionState = {
    active: true,
    phases,
    phaseIndex: 0,
    frame: 0,
    pendingParams: {
      type: recordingState.type,
      songIds: recordingState.selectedSongs,
      price,
      title,
      members: recordingState.members,
      studio: recordingState.studio,
      producer: recordingState.producer,
      guests: (recordingState.guests || []).slice(),
    },
  };
  render();
  runRecordingPhase();
}

function runRecordingPhase() {
  clearInterval(recordingFrameTimer);
  clearTimeout(recordingPhaseTimer);

  recordingFrameTimer = setInterval(() => {
    recordingSessionState.frame = recordingSessionState.frame === 0 ? 1 : 0;
    const img = document.getElementById('recordingCharImg');
    if (img) {
      const phaseKey = recordingSessionState.phases[recordingSessionState.phaseIndex];
      img.src = recordingPhaseImg(phaseKey, recordingSessionState.frame);
    }
  }, 450);

  recordingPhaseTimer = setTimeout(() => {
    recordingSessionState.phaseIndex += 1;
    if (recordingSessionState.phaseIndex >= recordingSessionState.phases.length) {
      clearInterval(recordingFrameTimer);
      playSfx('complete');
      finishRecordingSession();
    } else {
      recordingSessionState.frame = 0;
      render();
      runRecordingPhase();
    }
  }, 3000);
}

function finishRecordingSession() {
  const p = recordingSessionState.pendingParams;
  recordingSessionState = { active: false, phases: [], phaseIndex: 0, frame: 0, pendingParams: null };
  recordingState = { type: null, selectedSongs: [], price: null, members: [], guests: [], studio: 'a', producer: false };
  GameActions.produceCD(p.type, p.songIds, p.price, p.title, p.members, p.studio, p.producer, p.guests);
}

let liveFlowState = { confirming: false, promoting: false, members: [], venueKey: null };
let promoLoadingState = null; // 'stream'|'flyer'|'ad'|null
let afterpartyPartnerKey = null; // 打ち上げに同席しているNPCキー(りょーぺ等)。ソロならnull

function doPromotionUI(key) {
  liveFlowState.promoting = false;
  playCompleteWipeTransition(() => {
    promoLoadingState = key;
    render();
    setTimeout(() => {
      promoLoadingState = null;
      playSfx('complete');
      playCompleteWipeTransition(() => {
        const venue = window.GameData.pickVenueForPlayer();
        const lines = collectNewLogLines(() => GameActions.doPromotion(key));
        showResultDialogue(
          [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }],
          window.GameState.playerName || 'タケル',
          lines,
          null,
          window.VENUE_BG[venue.key],
          'live'
        );
      });
    }, 1800);
  }, false);
}

function screenPromoLoading() {
  const img = (window.PROMO_IMAGES && window.PROMO_IMAGES[promoLoadingState]) || window.HOME_BG;
  return `
    <div class="header"><span>宣伝中...</span></div>
    <div class="recording-session-bg" style="background-image:url('${img}');background-size:cover;"></div>
    <div class="progress-card" style="margin:10px 14px;">
      <p class="progress-title">宣伝しています…</p>
      <div class="bar"><div class="bar-fill loading-fill" style="animation-duration:1.8s;"></div></div>
    </div>
  `;
}
let liveSessionState = { active: false, pendingParams: null };
let liveFrameTimer = null;
let livePhaseTimer = null;

const LIVE_MEMBER_ORDER = ['bass', 'keyboard', 'drums'];
// 各会場の背景画像内で「ステージの上」に来るよう、演者の下端位置を個別調整
const VENUE_STAGE_BOTTOM = {
  street: '4%',
  small: '9%',
  mid: '12%',
  zepp: '18%',
  hall: '15%',
  budokan: '22%',
};
const LIVE_CHAR_FRAMES = {
  bass: ['bass', 'bass_smile'],
  keyboard: ['keyboard', 'keyboard_smile'],
  drums: ['drum', 'drum_smile'],
  vocal: ['vocal1', 'vocal2'],
};
// パート担当NPC(きさら/いつき)は本人のライブ画像を、それ以外は汎用画像を使う
const LIVE_PART_NPC_KEY = { bass: 'kisara', drums: 'itsuki' };
function getLivePerformerImg(partKey, frameIdx) {
  const npcKey = LIVE_PART_NPC_KEY[partKey];
  if (npcKey && window.MEMBER_CHARS && window.MEMBER_CHARS[npcKey] && window.MEMBER_CHARS[npcKey].live) {
    return window.MEMBER_CHARS[npcKey].live[frameIdx] || window.MEMBER_CHARS[npcKey].live[0];
  }
  return window.RECORDING_CHARS[LIVE_CHAR_FRAMES[partKey][frameIdx]];
}

// 対バン相手(りょーぺ・たくま等)専用のライブ画像があればそれを使い、なければ汎用画像にフォールバックする
function getOpponentPerformerImg(friendId, frameIdx) {
  if (friendId && window.MEMBER_CHARS && window.MEMBER_CHARS[friendId] && window.MEMBER_CHARS[friendId].live) {
    return window.MEMBER_CHARS[friendId].live[frameIdx] || window.MEMBER_CHARS[friendId].live[0];
  }
  return window.RECORDING_CHARS[['vocal1', 'vocal2'][frameIdx]];
}

function toggleLiveMember(key) {
  const idx = liveFlowState.members.indexOf(key);
  if (idx >= 0) { liveFlowState.members.splice(idx, 1); } else { liveFlowState.members.push(key); }
  render();
}

function screenLive() {
  if (dialogueState && dialogueState.screenTab === 'live') return dialogueResultScreen();
  if (promoLoadingState) return screenPromoLoading();
  if (liveSessionState.active) {
    return screenLiveSession();
  }

  const s = window.GameState;
  const venue = window.GameData.pickVenueForPlayer();
  const reserved = window.GameData.calcTicketsReserved(venue);
  const weeksLeft = Math.max(0, s.nextLiveTurn - s.turn);
  const ready = s.turn >= s.nextLiveTurn;
  const promoOnCooldown = s.livePromoUsedTurn !== null && (s.turn - s.livePromoUsedTurn) < window.GameData.PROMO_COOLDOWN_TURNS;

  if (liveFlowState.promoting) {
    const promoButtons = window.GameData.PROMOTIONS.map(p => `
      <button class="genre-btn" style="width:100%;margin-bottom:8px;" onclick="doPromotionUI('${p.key}')">
        ${p.name}${p.cost > 0 ? `(¥${p.cost.toLocaleString()})` : '(無料)'}
      </button>`).join('');
    return `
      <div class="home-bg" style="background-image:url('${window.VENUE_BG[venue.key]}')">${bgHud()}</div>
      <div class="header">
        <button class="back" onclick="liveFlowState.promoting=false;render();">←</button>
        <span>宣伝方法を選ぶ</span>
      </div>
      <div style="padding:0 14px;">${promoButtons}</div>
      ${logBox()}
    `;
  }

  if (!liveFlowState.confirming) {
    const takumaOffer = s.takumaEvents.collabPending ? s.takumaPendingOffer : null;
    const takumaVenue = takumaOffer ? window.GameData.VENUES.find(v => v.key === takumaOffer.venueKey) : null;
    return `
      <div class="home-bg" style="background-image:url('${window.VENUE_BG[venue.key]}')">${bgHud()}</div>
      <div class="progress-card" style="margin:10px 14px;">
        <p class="progress-title">${ready ? '定期ライブの開催が可能です！' : `次回の定期ライブまで残り${weeksLeft}週`}</p>
        <p class="progress-sub">会場: ${venue.name}(定員${venue.capacity.toLocaleString()}人)</p>
        <p class="progress-sub">予定日: ${turnToDateLabel(s.nextLiveTurn)}</p>
        <p class="progress-sub">チケット取り置き: ${reserved.toLocaleString()}人(来場確定)</p>
      </div>
      ${takumaOffer ? `
      <div class="progress-card" style="margin:10px 14px;">
        <p class="progress-title">対バン予定: たくま(KAME)</p>
        <p class="progress-sub">会場: ${takumaVenue.name}</p>
        <p class="progress-sub">予定日: ${turnToDateLabel(s.takumaEvents.collabTurn)}</p>
        <p class="progress-sub">ギャラ目安: ${yen(takumaOffer.gala)}</p>
      </div>
      ` : ''}
      <div style="padding:0 14px;">
        <button class="genre-btn" style="width:100%;" ${promoOnCooldown ? 'disabled' : ''} onclick="liveFlowState.promoting=true;render();">
          宣伝する${promoOnCooldown ? '(まだ実施できません)' : ''}
        </button>
      </div>
      ${ready ? `<div style="padding:10px 14px 0;"><button class="rest-btn" onclick="liveFlowState.venueKey=null;liveFlowState.confirming=true;render();">定期ライブの準備をする</button></div>` : ''}
      ${sectionTitle('自分でライブを打つ')}
      <p class="section-label">会場を押さえれば定期ライブ以外の週でもライブができます。会場費は前払い。埋まれば知名度が大きく伸び、ガラガラだと赤字のうえ評判も落ちます。</p>
      ${fatigueNote()}
      <div class="venue-list">${extraVenueCards()}</div>
      ${logBox()}
    `;
  }

  const memberCost = liveFlowState.members.length * window.GameData.MEMBER_COST;
  const confirmVenue = liveFlowState.venueKey
    ? (window.GameData.VENUES.find(v => v.key === liveFlowState.venueKey) || venue)
    : venue;
  return `
    <div class="header">
      <button class="back" onclick="liveFlowState={confirming:false,promoting:false,members:[],venueKey:null};render();">←</button>
      <span>${confirmVenue.name}</span>
    </div>
    <p class="section-label">サポートメンバーを選ぶ(任意・1人¥10,000)</p>
    <div class="list">${memberToggleRows(liveFlowState.members, 'toggleLiveMember')}</div>
    <div style="padding:10px 14px 0;"><p class="row-sub" style="text-align:center;">${
      liveFlowState.venueKey
        ? `見込み動員 ${window.GameData.estimateLive(confirmVenue.key).audience.toLocaleString()}人 / 会場費 ${yen(confirmVenue.cost)} + サポート ¥${memberCost.toLocaleString()}`
        : `定期ライブなので会場費は無料。費用: ¥${memberCost.toLocaleString()}(サポートメンバー分のみ)`
    }</p></div>
    <div style="padding:8px 14px 0;"><button class="rest-btn" onclick="startLiveSession()">このライブを開催する</button></div>
    ${logBox()}
  `;
}

// 追加ライブで押さえられる会場の一覧。
// 見込み動員と充足率をそのまま出して、「攻めるか守るか」を数字で判断できるようにする。
// 追加ライブの会場一覧。
// 「どれくらい埋まるか」が一目で分かることを優先し、横並びではなく1行ずつのカードにする。
function extraVenueCards() {
  const s = window.GameState;
  const G = window.GameData;
  return G.VENUES.map(v => {
    const locked = s.fame < v.minFame;
    const canPay = s.money >= v.cost;
    if (locked) {
      return `
        <div class="venue-card venue-card-locked">
          <div class="venue-card-head">
            <span class="venue-card-name">${v.name}</span>
            <span class="venue-card-cap">定員${v.capacity.toLocaleString()}人</span>
          </div>
          <p class="venue-card-lock">🔒 知名度 ${v.minFame.toLocaleString()} 以上で解放</p>
        </div>`;
    }
    const est = G.estimateLive(v.key);
    const pct = Math.round(est.fill * 100);
    // 充足率で色を変える: 8割以上=金 / 2割未満=赤 / それ以外=白
    const tone = est.fill >= 0.8 ? 'good' : (est.fill < 0.2 ? 'bad' : 'mid');
    const note = est.fill >= 0.9
      ? '満員に近い。知名度が大きく伸びる'
      : (est.fill < 0.2 ? '客席が埋まらず、評判を落とす見込み' : '');
    return `
      <button class="venue-card venue-${tone}" ${canPay ? '' : 'disabled'}
        onclick="chooseExtraVenue('${v.key}')">
        <div class="venue-card-head">
          <span class="venue-card-name">${v.name}</span>
          <span class="venue-card-cap">定員${v.capacity.toLocaleString()}人</span>
        </div>
        <div class="venue-card-bar"><div class="venue-card-fill" style="width:${Math.min(100, pct)}%;"></div></div>
        <div class="venue-card-figures">
          <span class="venue-card-aud">見込み動員 <b>${est.audience.toLocaleString()}</b>人</span>
          <span class="venue-card-pct">${pct}%</span>
        </div>
        <div class="venue-card-costs">
          <span>会場費 <b>${yen(v.cost)}</b></span>
          <span>体力 <b>-${v.healthCost}%</b></span>
        </div>
        ${note ? `<p class="venue-card-note">${note}</p>` : ''}
        ${canPay ? '' : '<p class="venue-card-note venue-card-short">所持金が足りません</p>'}
      </button>`;
  }).join('');
}

// 前回のライブからの間隔で客足が戻る。今どれくらい戻っているかを見せる。
function fatigueNote() {
  const s = window.GameState;
  const mult = window.GameData.liveFatigueMult();
  if (s.lastLiveTurn === null || s.lastLiveTurn === undefined || mult >= 1) return '';
  const gap = s.turn - s.lastLiveTurn;
  return `<p class="section-label" style="color:#E06A6A;">前回のライブから${gap}週。今の客足は本来の${Math.round(mult * 100)}%です(間隔を空けるほど戻ります)</p>`;
}

function chooseExtraVenue(venueKey) {
  liveFlowState.venueKey = venueKey;
  liveFlowState.confirming = true;
  render();
}

function startLiveSession() {
  const G = window.GameData;
  const isExtra = !!liveFlowState.venueKey;
  const venue = isExtra
    ? (G.VENUES.find(v => v.key === liveFlowState.venueKey) || G.pickVenueForPlayer())
    : G.pickVenueForPlayer();
  const memberCost = liveFlowState.members.length * G.MEMBER_COST;
  const totalCost = memberCost + (isExtra ? venue.cost : 0);
  if (window.GameState.money < totalCost) {
    showInsufficientFundsToast();
    return;
  }
  liveSessionState = {
    active: true,
    pendingParams: { members: liveFlowState.members.slice(), venueKey: isExtra ? venue.key : null },
    venueKey: venue.key,
  };
  render();
  runLiveSession();
}

function screenLiveSession() {
  const venue = window.GameData.VENUES.find(v => v.key === liveSessionState.venueKey) || window.GameData.pickVenueForPlayer();
  const bg = window.VENUE_BG[venue.key];
  const order = LIVE_MEMBER_ORDER.filter(k => liveFlowState.members.includes(k));
  const performers = [...order, 'vocal'];
  const soloVocal = performers.length === 1;

  const performerHtml = performers.map((partKey, i) => {
    const frames = LIVE_CHAR_FRAMES[partKey];
    const frame = liveSessionState.frame || 0;
    const cls = soloVocal ? 'live-performer live-performer-solo' : 'live-performer';
    return `<img id="livePerformer${i}" src="${getLivePerformerImg(partKey, frame)}" class="${cls}" data-part="${partKey}" />`;
  }).join('');

  return `
    <div class="header"><span>ライブ中</span></div>
    <div class="recording-session-bg" style="background-image:url('${bg}')">
      <div class="live-performers-row" style="bottom:${VENUE_STAGE_BOTTOM[venue.key] || '4%'};">${performerHtml}</div>
    </div>
    <div class="progress-card" style="margin:10px 14px;">
      <p class="progress-title">${venue.name}でライブ中...</p>
      <div class="bar"><div class="bar-fill loading-fill" style="animation-duration:5s;"></div></div>
    </div>
  `;
}

function runLiveSession() {
  clearInterval(liveFrameTimer);
  clearTimeout(livePhaseTimer);
  liveSessionState.frame = 0;

  liveFrameTimer = setInterval(() => {
    liveSessionState.frame = liveSessionState.frame === 0 ? 1 : 0;
    const order = LIVE_MEMBER_ORDER.filter(k => liveFlowState.members.includes(k));
    const performers = [...order, 'vocal'];
    performers.forEach((partKey, i) => {
      const img = document.getElementById('livePerformer' + i);
      if (img) img.src = getLivePerformerImg(partKey, liveSessionState.frame);
    });
  }, 450);

  livePhaseTimer = setTimeout(() => {
    clearInterval(liveFrameTimer);
    playSfx('complete');
    finishLiveSession();
  }, 5000);
}

function finishLiveSession() {
  const p = liveSessionState.pendingParams;
  liveSessionState = { active: false, pendingParams: null };
  liveFlowState = { confirming: false, promoting: false, members: [], venueKey: null };
  playSfx('complete');
  const info = GameActions.doLive(p.members, p.venueKey ? { venueKey: p.venueKey } : {});
  if (info) {
    playCompleteWipeTransition(() => {
      if (info.rp1JustTriggered) {
        showRyoheiRP1Dialogue(() => showLiveFinishedDialogue(info));
      } else {
        showLiveFinishedDialogue(info);
      }
    });
  }
}

const RANKING_TABS = [
  { key: 'oricon', label: 'オリコン' },
  { key: 'fame', label: '知名度' },
  { key: 'followers', label: 'フォロワー' },
  { key: 'assets', label: '総資産' },
];
let rankingActiveTab = 'oricon';

const RANKING_FIELD = { oricon: 'bestReleaseSales', fame: 'fame', followers: 'followers', assets: 'money' };
let rankingCache = { oricon: null, fame: null, followers: null, assets: null };

async function refreshRanking(category) {
  if (!(window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady())) {
    rankingCache[category] = [];
    render();
    return;
  }
  const field = RANKING_FIELD[category];
  const raw = await window.FirebaseSvc.fetchRanking(field, 50);
  const s = window.GameState;
  rankingCache[category] = raw.map(p => ({
    uid: p.uid,
    playerId: p.playerId,
    name: p.bandName || '(名称未設定)',
    personName: p.playerName || '???',
    value: category === 'oricon' ? (p.bestReleaseSales || 0) : (p[field] || 0),
    extra: category === 'oricon' ? (p.bestReleaseTitle || '(未リリース)') : null,
    fame: p.fame || 0,
    followers: p.followers || 0,
    level: p.level || 1,
    skills: p.skills || {},
    releases: p.releases || [],
    isPlayer: p.playerId === s.playerId,
  }));
  render();
}

function screenRanking() {
  const online = window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady();
  const tabs = RANKING_TABS.map(t => `
    <button class="ranking-tab ${rankingActiveTab === t.key ? 'ranking-tab-active' : ''}" onclick="rankingActiveTab='${t.key}';refreshRanking('${t.key}');render();">${t.label}</button>
  `).join('');

  if (!online) {
    return sectionTitle('ランキング') +
      `<div class="ranking-tabs">${tabs}</div>
       <p class="empty">⚠️ オンライン接続が必要です。フレンド画面と同じ状態(接続エラー)が原因の可能性があります。</p>` + logBox();
  }

  if (rankingCache[rankingActiveTab] === null) {
    refreshRanking(rankingActiveTab);
    return sectionTitle('ランキング(上位50名)') +
      `<div class="ranking-tabs">${tabs}</div>
       <p class="empty">読み込み中...</p>` + logBox();
  }

  const list = rankingCache[rankingActiveTab];
  const unit = { oricon: '枚', fame: '', followers: '人', assets: '' }[rankingActiveTab];

  if (list.length === 0) {
    return sectionTitle('ランキング(上位50名)') +
      `<div class="ranking-tabs">${tabs}</div>
       <p class="empty">まだ誰もランクインしていません</p>` + logBox();
  }

  const rows = list.map((e, i) => {
    const rank = i + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    const rankHtml = medal ? `<span class="rank-medal">${medal}</span>` : `<span class="rank-number">${rank}</span>`;
    const valueLabel = rankingActiveTab === 'assets' ? yen(e.value) : `${e.value.toLocaleString()}${unit}`;
    const extraLine = e.extra ? `<p class="row-sub">「${e.extra}」</p>` : '';
    const iconHtml = e.isPlayer
      ? `<img src="${profileIconUrl || window.RECORDING_CHARS.guitar_idle}" class="ranking-icon" loading="lazy" decoding="async" />`
      : `<img src="${window.RECORDING_CHARS.guitar_idle}" class="ranking-icon" loading="lazy" decoding="async" />`;
    const entryJson = JSON.stringify(e).replace(/"/g, '&quot;');
    const nameOnclick = e.isPlayer ? "setTab('status')" : `openRivalStatus(${entryJson})`;
    return `
      <div class="ranking-row ${e.isPlayer ? 'ranking-row-player' : ''}">
        <div class="rank-badge">${rankHtml}</div>
        ${iconHtml}
        <div class="row-text" onclick="${nameOnclick}" style="cursor:pointer;">
          <p class="row-title">${e.name}${e.isPlayer ? ' <span class="badge badge-done">YOU</span>' : ''}</p>
          ${extraLine}
        </div>
        <span class="row-value gold">${valueLabel}</span>
      </div>`;
  }).join('');

  return sectionTitle('ランキング(上位50名)') +
    `<div class="ranking-tabs">${tabs}</div>
     <div class="list">${rows}</div>` + logBox();
}

let rivalStatusEntry = null;

function openRivalStatus(entry) {
  rivalStatusEntry = entry;
  rivalStatusMsg = '';
  setTab('rivalstatus');
}

function screenRivalStatus() {
  const e = rivalStatusEntry;
  if (!e) return `<div class="header"><button class="back" onclick="setTab('ranking');">←</button><span>プレイヤー情報</span></div><p class="empty">情報がありません</p>`;
  const s = window.GameState;
  const alreadyFriend = s.friends.some(f => f.playerId === e.playerId);
  const skillRows = Object.entries(e.skills || {}).map(([k, v]) => `
    <div class="statrow">
      <div class="statrow-top"><span>${STAT_LABEL[k] || k}</span><span>${v}</span></div>
      <div class="bar"><div class="bar-fill" style="width:${Math.min(100, v)}%"></div></div>
    </div>
  `).join('');
  return `
    <div class="header"><button class="back" onclick="rivalStatusEntry=null;setTab('ranking');">←</button><span>${e.personName}(${e.name})</span></div>
    <div class="statgrid" style="padding:12px 14px 0;">
      <div class="statcard"><p class="statcard-label">知名度</p><p class="statcard-value">${e.fame.toLocaleString()}</p></div>
      <div class="statcard"><p class="statcard-label">フォロワー</p><p class="statcard-value">${e.followers.toLocaleString()}</p></div>
    </div>
    <p class="section-label">能力値</p>
    <div class="list">${skillRows}</div>
    <div style="padding:10px 14px 0;">
      ${e.isPlayer
        ? ''
        : alreadyFriend
          ? '<button class="genre-btn" style="width:100%;" disabled>すでにフレンドです</button>'
          : `<button class="rest-btn" onclick="sendFriendRequestToRankingEntry('${e.uid}')">フレンド申請を送る</button>`}
      ${rivalStatusMsg ? `<p class="row-sub" style="text-align:center;margin-top:6px;">${rivalStatusMsg}</p>` : ''}
    </div>
  `;
}

let rivalStatusMsg = '';

async function sendFriendRequestToRankingEntry(uid) {
  const s = window.GameState;
  rivalStatusMsg = '送信中...';
  render();
  const ok = await window.FirebaseSvc.sendFriendRequest(uid, { playerId: s.playerId, playerName: s.playerName, bandName: s.bandName });
  rivalStatusMsg = ok ? '申請を送信しました！' : '送信に失敗しました';
  render();
}

function homeBgUrl() {
  return window.HOME_BG;
}
function homeCharUrl() {
  const s = window.GameState;
  const states = window.HOME_CHAR_STATES || {};
  if (s.hungover) return states.hungover || states.normal;
  if (s.condition === 'fever') return states.fever || states.normal;
  if (s.condition === 'cold') return states.cold || states.normal;
  if (s.health <= 50) return states.dejected || states.normal;
  return states.normal;
}

function healthBarColor(v) {
  if (v >= 80) return 'linear-gradient(90deg, #4a9a4a, #7ED07E)'; // 80%以上: 緑
  if (v >= 30) return 'linear-gradient(90deg, #b59a1c, #E8C468)'; // 30〜79%: 黄
  return 'linear-gradient(90deg, #9a2a2a, #E06A6A)'; // 30%未満: 赤
}

// 数値をアニメーションさせながらカウントアップ/ダウンする(高品質アニメーション用の共通ユーティリティ)
function animateCountUp(el, from, to, duration, formatFn) {
  if (!el) return;
  if (from === to) { el.textContent = formatFn ? formatFn(to) : to.toLocaleString(); return; }
  const start = performance.now();
  const diff = to - from;
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const val = Math.round(from + diff * eased);
    el.textContent = formatFn ? formatFn(val) : val.toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// アルバイト・練習・レコーディングなど、背景画像を持つ画面共通の上部HUD(日付・残り週・体力、
// ホーム画面のみ所持金/フォロワー/知名度も表示)。呼び出し元は suppressStatusBar=true を
// セットして、グローバルのstatusBar()と二重表示にならないようにすること。
function bgHud(opts) {
  opts = opts || {};
  suppressStatusBar = true;
  // どの画面でも数字が見えるようにする。ホーム以外は横1列のコンパクト表示。
  const compact = !opts.showStats;
  const s = window.GameState;
  const weeksRemaining = Math.max(0, window.GameData.TOTAL_TURNS - s.turn + 1);
  const maxHealth = s.maxHealthMult || 100;
  const health = Math.max(0, Math.min(maxHealth, s.health));
  const initialHealth = lastRenderedHealth === null ? health : lastRenderedHealth;
  const barWidthPct = maxHealth > 0 ? Math.max(0, Math.min(100, (initialHealth / maxHealth) * 100)) : 0;

  let statsHtml = '';
  {
    const money = Math.round(s.money);
    const followers = Math.round(s.followers);
    const fame = Math.round(s.fame);
    const initMoney = lastRenderedMoney === null ? money : lastRenderedMoney;
    const initFollowers = lastRenderedFollowers === null ? followers : lastRenderedFollowers;
    const initFame = lastRenderedFame === null ? fame : lastRenderedFame;
    const moneyLabel = (v) => (v < 0 ? '-¥' + Math.abs(v).toLocaleString() : '¥' + v.toLocaleString());
    statsHtml = compact
      ? `
      <div class="home-hud-stats home-hud-stats-compact">
        <div class="hud-stat-row"><span class="hud-stat-label">💰</span><span class="hud-stat-value" id="hudMoney">${moneyLabel(initMoney)}</span></div>
        <div class="hud-stat-row"><span class="hud-stat-label">👥</span><span class="hud-stat-value" id="hudFollowers">${initFollowers.toLocaleString()}</span></div>
        <div class="hud-stat-row"><span class="hud-stat-label">⭐</span><span class="hud-stat-value" id="hudFame">${initFame.toLocaleString()}</span></div>
      </div>`
      : `
      <div class="home-hud-stats">
        <div class="hud-stat-row"><span class="hud-stat-label">所持金</span><span class="hud-stat-value" id="hudMoney">${moneyLabel(initMoney)}</span></div>
        <div class="hud-stat-row"><span class="hud-stat-label">フォロワー</span><span class="hud-stat-value" id="hudFollowers">${initFollowers.toLocaleString()}人</span></div>
        <div class="hud-stat-row"><span class="hud-stat-label">知名度</span><span class="hud-stat-value" id="hudFame">${initFame.toLocaleString()}</span></div>
      </div>`;
  }

  return `
    <div class="home-hud">
      <div class="home-hud-left">
        <div class="home-hud-date">
          <span class="main">${turnToDateLabel(s.turn)}</span>
          <span class="sub">サクセス終了まで あと${weeksRemaining}週</span>
        </div>
        ${statsHtml}
      </div>
      <div class="home-hud-health">
        <span class="hud-health-label">体力</span>
        <div class="hud-health-bar"><div class="hud-health-fill" id="homeHealthFill" style="width:${barWidthPct}%;background:${healthBarColor(initialHealth)}"></div></div>
        <span class="hud-health-pct" id="homeHealthPct">${health}%</span>
      </div>
    </div>`;
}

function screenHome() {
  const s = window.GameState;
  const overallRank = StatsEngine.getOverallRank(s);
  const infoCardRows = StatsEngine.STAT_ORDER.map(key => {
    const def = StatsEngine.STAT_DEFS[key];
    const val = s.stats[key] || 0;
    return `<div class="stat-line"><span>${def.name}</span><b>${StatsEngine.getRank(val)}</b></div>`;
  }).join('');
  return `
    <div class="home-bg" style="background-image:url('${homeBgUrl()}')">
      ${bgHud({ showStats: true })}
      <button class="menu-pill" ${isNavLocked() ? 'disabled' : ''} onclick="toggleHomeMenu()">MENU</button>
      ${homeMenuOpen ? homeMenuPopoverHtml() : ''}
      <img src="${homeCharUrl()}" class="home-char-overlay" />
      <div class="home-info-card">
        <div class="card-head-row">
          <div class="card-head-col">
            <span class="name">${s.playerName || 'タケル'}</span>
            <span class="band">${s.bandName || 'タケルバンド'}</span>
          </div>
          <span class="overall-mini"><span class="rk">${overallRank}</span><span class="lbl">RANK</span></span>
        </div>
        <div class="stat-grid">${infoCardRows}</div>
      </div>
      <div class="rest-cutin-overlay" id="restCutinOverlay">
        <img src="${window.REST_CUTIN_IMG}" class="rest-cutin-img" />
        <p class="rest-cutin-text">おやすみなさい…</p>
      </div>
      ${dialogueState ? dialogueBubbleInnerHtml() : ''}
    </div>
    <div style="padding:8px 14px 0;">
      ${isSpecialLiveDayPending()
        ? `<button class="rest-btn rest-btn-primary" disabled>休む(今日はライブの日のため不可)</button>`
        : `<button class="rest-btn rest-btn-primary" onclick="triggerRestCutin()">休む(体力を全回復)</button>`}
    </div>
    <p class="section-label">進行中の内容</p>
    ${homeProgressCard()}
    ${logBox()}
  `;
}

function conditionLabel(condition) {
  if (condition === 'greatCondition') return ' <span class="badge badge-done">絶好調</span>';
  if (condition === 'cold') return ' <span class="badge badge-draft" style="color:#E0C56A;">風邪</span>';
  if (condition === 'fever') return ' <span class="badge badge-draft" style="color:#E06A6A;">熱</span>';
  return '';
}

function homeProgressCard() {
  const s = window.GameState;

  if (s.songInProgress) {
    const p = s.songInProgress;
    const pct = Math.round((1 - p.weeksLeft / p.totalWeeks) * 100);
    return `<div class="progress-card">
      <p class="progress-title">曲制作中: 「${p.title}」(${p.genre})</p>
      <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      <p class="progress-sub">残り${p.weeksLeft}週で完成</p>
    </div>`;
  }

  const pendingCD = (s.releases || []).find(r => !r.released);
  if (pendingCD) {
    return `<div class="progress-card">
      <p class="progress-title">「${pendingCD.title}」がリリース待ちです</p>
      <p class="progress-sub">${pendingCD.typeName} / ${pendingCD.songCount}曲 / 完成度${pendingCD.completionAvg}</p>
    </div>`;
  }

  const unusedSong = s.songs.find(sg => !sg.used);
  if (unusedSong) {
    return `<div class="progress-card">
      <p class="progress-title">「${unusedSong.title}」が未使用です</p>
      <p class="progress-sub">完成度${unusedSong.completion} / 曲制作画面からCD制作に進めます</p>
    </div>`;
  }

  const activeRelease = (s.releases || []).find(r => r.released && r.salesActive);
  if (activeRelease) {
    return `<div class="progress-card">
      <p class="progress-title">「${activeRelease.title}」好評発売中</p>
      <p class="progress-sub">累計${activeRelease.totalSold.toLocaleString()}枚売上 / 今週の収入${yen(s.weekIncome)}</p>
    </div>`;
  }

  return `<div class="progress-card"><p class="progress-sub">現在進行中の制作・リリースはありません</p></div>`;
}

let friendSearchState = { result: null };
let friendDetailId = null;
let hostOfferState = { friendId: null, venue: null, members: [] };

let firebaseSearchStatus = '';
let firebaseInboxRequests = null; // null=未取得, []=取得済み

async function doFriendSearch() {
  const input = document.getElementById('friendSearchInput');
  const query = input ? input.value.trim() : '';

  if (!(window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady())) {
    firebaseSearchStatus = 'オンライン接続が必要です';
    render();
    return;
  }

  if (!query) { firebaseSearchStatus = 'IDを入力してください'; render(); return; }
  firebaseSearchStatus = '検索中...';
  render();
  const result = await window.FirebaseSvc.searchPlayerById(query);
  if (!result) {
    friendSearchState.result = null;
    firebaseSearchStatus = '見つかりませんでした';
  } else if (result.self) {
    friendSearchState.result = null;
    firebaseSearchStatus = 'それはあなた自身のIDです';
  } else {
    friendSearchState.result = { uid: result.uid, id: result.playerId, name: result.playerName, bandName: result.bandName, fame: result.fame || 0, followers: result.followers || 0 };
    firebaseSearchStatus = '';
  }
  render();
}

async function sendFriendRequestOnline() {
  const target = friendSearchState.result;
  if (!target) return;
  const s = window.GameState;
  firebaseSearchStatus = '送信中...';
  render();
  const ok = await window.FirebaseSvc.sendFriendRequest(target.uid, { playerId: s.playerId, playerName: s.playerName, bandName: s.bandName });
  firebaseSearchStatus = ok ? '申請を送信しました！相手の承認をお待ちください' : '送信に失敗しました。もう一度お試しください';
  friendSearchState = { result: null };
  render();
}

async function refreshOnlineFriends() {
  if (!(window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady())) return;
  const friends = await window.FirebaseSvc.fetchFriendsWithProfiles();
  const s = window.GameState;
  // listenToFriendsと同じく、ゲーム内のキャラは残してオンラインぶんだけ差し替える
  const npcs = (s.friends || []).filter(f => f.isNpc);
  const online = friends.map(f => ({
    id: f.uid,
    playerId: f.playerId,
    name: f.playerName || '???',
    bandName: f.bandName || '(名称未設定)',
    iconUrl: f.iconUrl || '',
    fame: f.fame || 0,
    followers: f.followers || 0,
    level: f.level || 1,
    skills: f.skills || {},
    releases: f.releases || [],
  }));
  s.friends = [...npcs, ...online];
  render();
}

async function refreshFirebaseInbox() {
  if (!(window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady())) return;
  firebaseInboxRequests = await window.FirebaseSvc.fetchPendingRequests();
  render();
}

async function acceptOnlineFriendRequest(requestId, fromUid, fromPlayerId, fromPlayerName, fromBandName) {
  const ok = await window.FirebaseSvc.acceptFriendRequest(
    requestId, fromUid,
    { playerId: fromPlayerId, playerName: fromPlayerName, bandName: fromBandName }
  );
  if (ok) {
    addLog(`${fromPlayerName}(${fromBandName})とフレンドになった`, 'plus');
  }
  await refreshFirebaseInbox();
  await refreshOnlineFriends();
}

async function declineOnlineFriendRequest(requestId) {
  await window.FirebaseSvc.declineFriendRequest(requestId);
  await refreshFirebaseInbox();
}

// ===== 定期ライブへの対バン誘い =====
// キャラごとに返事のセリフが違う。週は消費しないので、その場で結果まで見せる。
const GUEST_REPLIES = {
  takuma: {
    ok: d => `${d}？空いてるから大丈夫やと思う！よろしく！`,
    ng: () => 'その日仕事入ってんねん〜',
  },
  ryohei: {
    ok: () => 'えぇぇ、うえぇぇぇぇ、、本当に俺たちでいいの？ありがとう！よろしく',
    ng: () => 'どうしよっかな〜、、一応空いてるけど、、その日ライブ見に行きたいんよなあ、、せっかくやけどやめとくわぁ、、',
  },
  kisara: {
    ok: d => `${d}ね、大丈夫。任せて`,
    ng: () => 'ごめん、その日はちょっと予定があって…',
  },
  itsuki: {
    ok: d => `${d}か。……いいよ`,
    ng: () => '……その日は無理',
  },
};

function guestReplyLine(memberKey, accepted, dateLabel) {
  const set = GUEST_REPLIES[memberKey] || GUEST_REPLIES.kisara;
  return accepted ? set.ok(dateLabel) : set.ng(dateLabel);
}

// フレンド画面の「誘う」。ライブハウス外で、主人公と相手が並ぶ。
function inviteGuestScene(friendId) {
  const s = window.GameState;
  const f = s.friends.find(x => x.id === friendId);
  if (!f) return;
  const memberKey = f.memberKey || f.id;
  const charImg = (window.MEMBER_CHARS && window.MEMBER_CHARS[memberKey])
    ? window.MEMBER_CHARS[memberKey].convo : idlePortrait();
  const dateLabel = window.GameData.turnToDateLabel(s.nextLiveTurn);
  const portraits = [
    { src: idlePortrait(), name: s.playerName || 'タケル', active: true },
    { src: charImg, name: f.name, active: false },
  ];
  setEventBgm(true);
  showDialogueScene(portraits, s.playerName || 'タケル',
    `${dateLabel}のライブに出てほしいんやけど、予定とかどう？`,
    dialogueChoices([
      { label: '誘う', action: `confirmInviteGuest('${friendId}')` },
      { label: 'やっぱりやめる', action: 'closeInviteScene()', cancel: true },
    ]),
    window.VENUE_OUTSIDE_BG);
}

function closeInviteScene() {
  dialogueState = null;
  setEventBgm(false);
  render();
}

function confirmInviteGuest(friendId) {
  const s = window.GameState;
  const reply = GameActions.inviteGuestToLive(friendId);
  if (!reply) { closeInviteScene(); return; }
  const memberKey = reply.memberKey;
  const charImg = (window.MEMBER_CHARS && window.MEMBER_CHARS[memberKey])
    ? window.MEMBER_CHARS[memberKey].convo : idlePortrait();
  const portraits = [
    { src: idlePortrait(), name: s.playerName || 'タケル', active: false },
    { src: charImg, name: reply.name, active: true },
  ];
  const segments = [{ text: guestReplyLine(memberKey, reply.accepted, reply.dateLabel), type: 'neutral' }];
  if (reply.accepted) {
    segments.push({
      text: `${reply.dateLabel}のライブに${reply.bandName ? reply.bandName + 'の' : ''}${reply.name}が出演してくれるようになった`,
      type: 'plus',
    });
  }
  showResultDialogue(portraits, reply.name, segments, null, window.VENUE_OUTSIDE_BG, null, () => {
    setEventBgm(false);
    setTab('friend');
    render();
  });
}

function screenFriend() {
  if (hostOfferState.friendId) {
    return screenHostOffer();
  }
  if (friendDetailId) {
    const friend = window.GameState.friends.find(f => f.id === friendDetailId);
    if (friend) return screenFriendDetail(friend);
    friendDetailId = null;
  }

  const s = window.GameState;
  const online = window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady();

  // バンド仲間(ゲーム内キャラ)と、オンラインで繋がったプレイヤーを分けて並べる
  const npcFriends = s.friends.filter(f => f.isNpc);
  const onlineFriends = s.friends.filter(f => !f.isNpc);

  // 出会っていないキャラは「？」のシルエット枠として見せる。
  // 何人いるのかが分かるので、出会う楽しみが残る。
  const ALL_NPC_KEYS = ['kisara', 'itsuki', 'ryohei', 'takuma'];
  const metKeys = npcFriends.map(f => f.memberKey || f.id);
  const unmetCount = ALL_NPC_KEYS.filter(k => metKeys.indexOf(k) < 0).length;

  const intimacyTier = v => {
    if (v >= 80) return { label: '親友', color: '#E8C468' };
    if (v >= 50) return { label: '仲がいい', color: '#8FBF6A' };
    if (v >= 20) return { label: '顔なじみ', color: '#6EA8E0' };
    return { label: '知り合い', color: 'rgba(255,255,255,0.45)' };
  };

  const renderNpcCard = f => {
    const img = (f.memberKey && window.MEMBER_CHARS && window.MEMBER_CHARS[f.memberKey])
      ? window.MEMBER_CHARS[f.memberKey].idle : null;
    const iv = f.intimacy || 0;
    const tier = intimacyTier(iv);
    // 自分のバンドのメンバーは対バンの相手にならないので、誘う欄自体を出さない
    const isCandidate = GameActions.isGuestCandidate(f);
    const canInvite = GameActions.canInviteGuest(f.id);
    const inviteReason = s.scheduledGuest
      ? `${s.scheduledGuest.name}が出演予定`
      : (s.condition === 'fever' ? '熱が下がってから'
        : (iv < GameActions.GUEST_INVITE_MIN_INTIMACY ? `親密度${GameActions.GUEST_INVITE_MIN_INTIMACY}で誘える` : ''));
    return `
      <div class="friend-card-wrap ${isCandidate ? '' : 'friend-card-solo'}">
        <button class="friend-card" onclick="friendDetailId='${f.id}';render();">
          ${img ? `<img src="${img}" class="friend-card-face" loading="lazy" decoding="async" />`
                : '<span class="friend-card-face friend-card-noface">👤</span>'}
          <span class="friend-card-body">
            <span class="friend-card-top">
              <span class="friend-card-name">${f.name}</span>
              <span class="friend-card-tier" style="color:${tier.color};">${tier.label}</span>
            </span>
            <span class="friend-card-sub">${f.bandName || f.part || ''}</span>
            <span class="friend-card-bar"><span class="friend-card-fill" style="width:${Math.min(100, iv)}%;background:${tier.color};"></span></span>
            <span class="friend-card-figures">親密度 ${iv} ・ 知名度 ${(f.fame || 0).toLocaleString()}</span>
          </span>
          <span class="friend-card-arrow">›</span>
        </button>
        ${isCandidate ? `
        <div class="friend-invite-row">
          ${canInvite
            ? `<button class="friend-invite-btn" onclick="inviteGuestScene('${f.id}')">対バンに誘う</button>`
            : `<span class="friend-invite-note">${inviteReason}</span>`}
          ${GameActions.canGuestRecord(f.id) ? '<span class="friend-invite-note friend-invite-note-gold">レコーディングにも呼べる</span>' : ''}
        </div>` : ''}
      </div>`;
  };
  const bandMembers = npcFriends.filter(f => !GameActions.isGuestCandidate(f));
  const otherBands = npcFriends.filter(f => GameActions.isGuestCandidate(f));
  const memberCards = bandMembers.map(renderNpcCard).join('');
  const bandCards = otherBands.map(renderNpcCard).join('');

  const unmetHtml = unmetCount > 0
    ? `<div class="friend-unmet">${Array.from({ length: unmetCount }).map(() => `
        <span class="friend-unmet-slot">?</span>`).join('')}
        <span class="friend-unmet-note">活動を続けると出会えます</span>
      </div>`
    : '';

  const onlineCards = onlineFriends.map(f => `
    <button class="friend-card friend-card-online" onclick="friendDetailId='${f.id}';render();">
      <img src="${f.iconUrl || defaultIconUrl()}" class="friend-card-face" loading="lazy" decoding="async" />
      <span class="friend-card-body">
        <span class="friend-card-top">
          <span class="friend-card-name">${f.name}</span>
          <span class="friend-card-tier" style="color:#6EA8E0;">プレイヤー</span>
        </span>
        <span class="friend-card-sub">${f.bandName || ''}</span>
        <span class="friend-card-figures">知名度 ${(f.fame || 0).toLocaleString()} ・ フォロワー ${(f.followers || 0).toLocaleString()}</span>
      </span>
      <span class="friend-card-arrow">›</span>
    </button>`).join('');

  const inboxHtml = (online && firebaseInboxRequests && firebaseInboxRequests.length > 0) ? `
    <div class="craft-block">
      <p class="craft-block-label">フレンド申請 <span class="friend-badge">${firebaseInboxRequests.length}</span></p>
      ${firebaseInboxRequests.map(r => `
        <div class="friend-request">
          <div class="friend-request-text">
            <p class="friend-card-name">${r.fromPlayerName}</p>
            <p class="friend-card-sub">${r.fromBandName} / ID ${r.fromPlayerId}</p>
          </div>
          <button class="friend-req-ok" onclick="acceptOnlineFriendRequest('${r.id}','${r.fromUid}','${r.fromPlayerId}','${r.fromPlayerName}','${r.fromBandName}')">承認</button>
          <button class="friend-req-ng" onclick="declineOnlineFriendRequest('${r.id}')">見送る</button>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="craft-hero" style="background-image:url('${window.VENUE_OUTSIDE_BG || window.HOME_BG}')">
      <div class="craft-hero-shade"></div>
      ${npcFriends.length > 0 && window.MEMBER_CHARS && window.MEMBER_CHARS[npcFriends[0].memberKey]
        ? `<img src="${window.MEMBER_CHARS[npcFriends[0].memberKey].idle}" class="craft-hero-char" />` : ''}
      <div class="craft-hero-text">
        <p class="craft-hero-label">FRIENDS</p>
        <p class="craft-hero-title">フレンド</p>
        <p class="craft-hero-sub">仲良くなると対バンに誘ってもらえます</p>
      </div>
    </div>
    ${inboxHtml}
    <div class="craft-block">
      <p class="craft-block-label">次の定期ライブ
        <span class="craft-block-hint">${window.GameData.turnToDateLabel(s.nextLiveTurn)}${
          s.scheduledGuest ? ` / ${s.scheduledGuest.name}が出演` : ' / 対バン相手なし'}</span></p>
    </div>
    <div class="craft-block">
      <p class="craft-block-label">バンドメンバー <span class="craft-block-hint">${bandMembers.length}人</span></p>
      <div class="friend-list">${memberCards}</div>
    </div>
    <div class="craft-block">
      <p class="craft-block-label">他のバンドマン
        <span class="craft-block-hint">親密度${GameActions.GUEST_INVITE_MIN_INTIMACY}以上で対バンに誘えます</span></p>
      <div class="friend-list">${bandCards || '<p class="roster-empty">まだ出会っていません</p>'}</div>
      ${unmetHtml}
    </div>
    ${onlineFriends.length > 0 ? `
      <div class="craft-block">
        <p class="craft-block-label">オンラインのフレンド <span class="craft-block-hint">${onlineFriends.length}人</span></p>
        <div class="friend-list">${onlineCards}</div>
      </div>` : ''}
  ` + logBox();
}

// フレンドとの絆で覚える超特殊能力のパネル。
// 親密度と経験点の両方が要るので、足りないほうを出す。
function superAbilityPanel(friend) {
  const s = window.GameState;
  const st = StatsEngine.superAbilityStatus(s, friend);
  if (!st.key) return '';
  const def = StatsEngine.ABILITIES[st.key];
  const label = def.tiers[0].label;
  const iv = friend.intimacy || 0;
  const need = StatsEngine.FRIENDSHIP_ABILITY_REQUIRED;
  const costHtml = st.cost
    ? Object.entries(st.cost).map(([c, v]) => {
        const have = s.expPool[c] || 0;
        const short = have < v;
        return `<span class="super-cost ${short ? 'super-cost-short' : ''}">${StatsEngine.EXP_CATEGORY_NAMES[c]} ${have}/${v}</span>`;
      }).join('')
    : '';
  let footer;
  if (st.reason === 'owned') {
    footer = '<p class="super-note super-note-done">習得済み</p>';
  } else if (st.reason === 'intimacy') {
    footer = `<div class="super-bar"><div class="super-bar-fill" style="width:${Math.min(100, iv / need * 100)}%;"></div></div>
      <p class="super-note">親密度 ${iv} / ${need} — もっと仲良くなると習得できる</p>`;
  } else if (st.reason === 'already_have_other') {
    footer = `<p class="super-note super-note-short">すでに「${st.otherLabel}」を習得しています(絆の特殊能力は1つだけ)</p>`;
  } else if (st.ok) {
    footer = `<button class="super-learn-btn" onclick="learnSuperAbilityUI('${friend.id}')">「${label}」を習得する</button>`;
  } else {
    footer = `<p class="super-note super-note-short">経験点が足りません</p>`;
  }
  return `
    <p class="section-label">絆の特殊能力</p>
    <div class="super-panel ${st.reason === 'owned' ? 'super-panel-owned' : ''}">
      <div class="super-head">
        <span class="super-badge">超特殊</span>
        <span class="super-name">${label}</span>
      </div>
      <p class="super-effect">${def.effect}</p>
      ${st.reason !== 'owned' ? `<div class="super-costs">${costHtml}</div>` : ''}
      ${footer}
    </div>
  `;
}

function learnSuperAbilityUI(friendId) {
  const got = GameActions.learnSuperAbilityFrom(friendId);
  if (!got) { playSfx('deny'); return; }
  playSfx('fanfare', { minGap: 0 });
  const s = window.GameState;
  s.justSuperAbility = null;
  showModal(`
    <div class="modal-card">
      <p class="modal-title">絆の特殊能力を習得！</p>
      <p class="modal-sub"><b style="color:#E8C468;font-size:20px;">${got.label}</b></p>
      <p class="modal-sub">${got.effect}</p>
      <button class="modal-primary-btn" onclick="closeModal();">よし</button>
    </div>
  `);
}

function screenFriendDetail(friend) {
  if (friend.isNpc) {
    const npcImg = (window.MEMBER_CHARS && window.MEMBER_CHARS[friend.memberKey]) ? window.MEMBER_CHARS[friend.memberKey].convo : '';
    const statRows = StatsEngine.STAT_ORDER.map(key => {
      const def = StatsEngine.STAT_DEFS[key];
      const val = (friend.stats && friend.stats[key]) || 0;
      return `<div class="statrow"><div class="statrow-top"><span>${def.name}</span><span>${StatsEngine.getRank(val)}</span></div><div class="bar"><div class="bar-fill" style="width:${Math.min(100, val)}%"></div></div></div>`;
    }).join('');
    const abilityChips = (friend.abilities || []).map(a => `<span class="ability-chip">${a}</span>`).join('') || '<p class="empty">なし</p>';
    return `
      <div class="header"><button class="back" onclick="friendDetailId=null;render();">←</button><span>${friend.name}${friend.bandName ? '(' + friend.bandName + ')' : ''}</span></div>
      <img class="hero-box" src="${npcImg}" />
      <p class="hero-caption">担当: ${friend.part || ''}</p>
      <p class="section-label">能力値</p>
      <div class="list">${statRows}</div>
      <p class="section-label">特殊能力</p>
      <div style="padding:0 14px;display:flex;flex-wrap:wrap;gap:6px;">${abilityChips}</div>
      ${superAbilityPanel(friend)}
    `;
  }
  const skills = friend.skills || {};
  const releases = friend.releases || [];
  const skillRows = Object.entries(skills).map(([k, v]) => `
    <div class="statrow">
      <div class="statrow-top"><span>${STAT_LABEL[k] || k}</span><span>${v}</span></div>
      <div class="bar"><div class="bar-fill" style="width:${Math.min(100, v)}%"></div></div>
    </div>
  `).join('');
  const releaseRows = releases.length ? releases.map(r => `
    <div class="row" style="cursor:default;">
      <div class="thumb">💿</div>
      <div class="row-text"><p class="row-title">${r.title}</p><p class="row-sub">累計${(r.totalSold || 0).toLocaleString()}枚</p></div>
    </div>
  `).join('') : `<p class="empty">まだリリースはありません</p>`;

  return `
    <div class="header"><button class="back" onclick="friendDetailId=null;render();">←</button><span>${friend.name}(${friend.bandName})</span></div>
    <div class="statgrid" style="padding:12px 14px 0;">
      <div class="statcard"><p class="statcard-label">知名度</p><p class="statcard-value">${(friend.fame || 0).toLocaleString()}</p></div>
      <div class="statcard"><p class="statcard-label">フォロワー</p><p class="statcard-value">${(friend.followers || 0).toLocaleString()}</p></div>
      <div class="statcard"><p class="statcard-label">リリース</p><p class="statcard-value">${releases.length}枚</p></div>
    </div>
    <p class="section-label">能力値</p>
    <div class="list">${skillRows || '<p class="empty">情報を取得中です</p>'}</div>
    <p class="section-label">リリース済CD</p>
    <div class="list">${releaseRows}</div>
  `;
}

function screenHostOffer() {
  const friend = window.GameState.friends.find(f => f.id === hostOfferState.friendId);
  if (!hostOfferState.venue) {
    const cards = window.GameData.VENUES.map(v => {
      const thumb = window.VENUE_BG[v.key];
      const thumbHtml = thumb
        ? `<img src="${thumb}" class="job-card-img" loading="lazy" decoding="async" />`
        : `<div class="job-card-img" style="display:flex;align-items:center;justify-content:center;background:#1B1B22;font-size:22px;">🎫</div>`;
      return `<div class="job-card" onclick="hostOfferState.venue='${v.key}';render();">${thumbHtml}<p class="job-card-name">${v.name}</p><p class="job-card-wage">¥${v.cost.toLocaleString()}</p></div>`;
    }).join('');
    return `<div class="header"><button class="back" onclick="hostOfferState={friendId:null,venue:null,members:[]};render();">←</button><span>${friend.name}と対バン: 会場を選ぶ</span></div>
      <div class="job-grid">${cards}</div>`;
  }
  const venue = window.GameData.VENUES.find(v => v.key === hostOfferState.venue);
  const memberCost = hostOfferState.members.length * window.GameData.MEMBER_COST;
  return `<div class="header"><button class="back" onclick="hostOfferState.venue=null;render();">←</button><span>${venue.name}</span></div>
    <p class="section-label">サポートメンバーを選ぶ(任意・1人¥10,000)</p>
    <div class="list">${memberToggleRows(hostOfferState.members, 'toggleHostMember')}</div>
    <div style="padding:10px 14px 0;"><p class="row-sub" style="text-align:center;">費用: ¥${(venue.cost + memberCost).toLocaleString()}(会場費¥${venue.cost.toLocaleString()} + メンバー¥${memberCost.toLocaleString()})</p></div>
    <div style="padding:8px 14px 0;"><button class="rest-btn" onclick="confirmHostOffer()">この内容で対バンを開催する</button></div>`;
}

function toggleHostMember(key) {
  const idx = hostOfferState.members.indexOf(key);
  if (idx >= 0) { hostOfferState.members.splice(idx, 1); } else { hostOfferState.members.push(key); }
  render();
}

function confirmHostOffer() {
  const params = hostOfferState;
  hostOfferState = { friendId: null, venue: null, members: [] };
  const info = GameActions.hostCollabLive(params.friendId, params.venue, params.members);
  if (info) {
    playCompleteWipeTransition(() => {
      showCollabLiveFinishedDialogue(info);
    });
  }
}

// ===== メールポスト(見送ったオファーの履歴) =====
function screenMailbox() {
  const s = window.GameState;
  if (s.mailbox.length === 0) {
    return `<div class="header"><button class="back" onclick="setTab('home');">←</button><span>メールポスト</span></div><p class="empty">メールはありません</p>`;
  }
  const rows = s.mailbox.map(m => {
    if (m.type === 'allowance') {
      return `
      <div class="row" onclick="openMailboxEntry(${m.id})">
        <div class="thumb">${m.claimed ? '📭' : '🎁'}</div>
        <div class="row-text">
          <p class="row-title">母ちゃんからの仕送り ${!m.claimed ? '<span class="badge badge-ready">未受取</span>' : ''}</p>
          <p class="row-sub">¥${m.amount.toLocaleString()}が添付されています</p>
        </div>
      </div>`;
    }
    const expired = s.turn > m.expiryTurn;
    const expiryLabel = turnToDateLabel(m.expiryTurn);
    const statusBadge = expired
      ? '<span class="badge badge-draft">期限切れ</span>'
      : (!m.read ? '<span class="badge badge-ready">未読</span>' : '');
    return `
    <div class="row" onclick="openMailboxEntry(${m.id})">
      <div class="thumb">${expired ? '📪' : (m.read ? '📭' : '📬')}</div>
      <div class="row-text">
        <p class="row-title">${m.offer.friendName}からの対バンオファー ${statusBadge}</p>
        <p class="row-sub">${m.offer.bandName} / ギャラ¥${m.offer.gala.toLocaleString()}</p>
        <p class="row-sub" style="color:${expired ? '#8A8A94' : '#E06A6A'};font-weight:700;">${expired ? '有効期限切れ' : `有効期限: ${expiryLabel}まで`}</p>
      </div>
    </div>`;
  }).join('');
  return `<div class="header"><button class="back" onclick="setTab('home');">←</button><span>メールポスト</span></div><div class="list">${rows}</div>`;
}

function openMailboxEntry(mailId) {
  const s = window.GameState;
  const entry = s.mailbox.find(m => m.id === mailId);
  if (!entry) return;

  if (entry.type === 'allowance') {
    entry.read = true;
    showModal(`
      <div class="modal-card">
        <div class="modal-icon-badge">💌</div>
        <p class="modal-title">${entry.playerName}へ</p>
        <p class="modal-sub" style="text-align:left;">${entry.playerName}！<br>母ちゃんから仕送りよ！大事に使いな！<br><br>母より</p>
        ${entry.claimed
          ? '<p class="modal-sub log-plus">受け取り済みです</p><button class="modal-close-btn" onclick="closeModal()">閉じる</button>'
          : `<button class="modal-primary-btn" onclick="closeModal();GameActions.claimAllowanceMail(${mailId});">¥${entry.amount.toLocaleString()}を受け取る</button>`}
      </div>
    `);
    return;
  }

  entry.read = true;
  const expired = s.turn > entry.expiryTurn;
  const venue = window.GameData.VENUES.find(v => v.key === entry.offer.venueKey);
  const expiryLabel = turnToDateLabel(entry.expiryTurn);
  const offerJson = JSON.stringify(entry.offer).replace(/"/g, '&quot;');
  // 見送った後にメールから受け直した場合も、吹き出しで受けた時と同じ扱いにする
  // (りょーぺは日程を決める / オンラインのフレンドはその場で会場へ)
  const acceptFromMailAction = entry.offer.friendId === 'ryohei'
    ? `GameActions.scheduleRyoheiCollab(${offerJson});`
    : `friendOfferFlowState={offer:${offerJson},members:[]};setTab('friendlive');`;
  showModal(`
    <div class="modal-card">
      <img src="${window.FRIEND_OFFER_IMG}" style="width:100%;border-radius:10px;margin-bottom:10px;" />
      <p class="modal-title">対バンオファー</p>
      <p class="modal-sub"><strong>${entry.offer.friendName}</strong>(${entry.offer.bandName})</p>
      <p class="modal-sub">会場: ${venue.name} / ギャラ: ${yen(entry.offer.gala)}</p>
      <p class="modal-sub" style="color:#E06A6A;font-weight:700;">有効期限: ${expiryLabel}まで</p>
      ${expired
        ? `<p class="modal-sub" style="color:#8A8A94;">この誘いは期限切れです</p><button class="modal-close-btn" onclick="closeModal();removeMailEntry(${mailId});">削除</button>`
        : `<button class="modal-primary-btn" onclick="closeModal();removeMailEntry(${mailId});${acceptFromMailAction}">出演する</button>
           <button class="modal-close-btn" onclick="closeModal()">閉じる</button>`
      }
    </div>
  `);
}

function removeMailEntry(mailId) {
  const s = window.GameState;
  s.mailbox = s.mailbox.filter(m => m.id !== mailId);
}

// ===== 対バンオファー(ランダムイベント)への対応フロー =====
let friendOfferFlowState = { offer: null, members: [] };
let friendLiveSessionState = { active: false, stage: null, offer: null, members: [], frame: 0 };
let friendLiveSessionTimer = null;
let friendLiveFrameTimer = null;

// インディーズレーベルのオファーは専用の会話イベント(showIndieLabelScene)になったため、
// このポップアップはメジャーデビューのオファー専用。
function showAgencyOfferPopup(offer) {
  setEventBgm(true);   // イベント中はイベントBGMに切り替える
  const title = 'メジャーデビューのオファー！';
  const desc = '知名度が一定数を超え、大手事務所からメジャーデビューのオファーが届きました。契約すると、アルバイトの代わりに毎月給料が振り込まれるようになります。';
  showModal(`
    <div class="modal-card">
      <div class="modal-icon-badge">🌟</div>
      <p class="modal-title">${title}</p>
      <p class="modal-sub">${desc}</p>
      <button class="modal-primary-btn" onclick="closeModal();playSfx('fanfare',{minGap:0});GameActions.acceptAgencyOffer('${offer.type}');">契約する</button>
      <button class="modal-close-btn" onclick="closeModal();GameActions.declineAgencyOffer('${offer.type}');">見送る</button>
    </div>
  `);
}

// ===== 会話吹き出しシステム(タップで次へ進む・2行ずつ表示) =====
let dialogueState = null;
const DIALOGUE_CHARS_PER_PAGE = 46; // 目安2行分

// 地の文(ナレーション)を約2行ずつのページに分割する。各ページは<p>でラップしたHTML文字列。
function dialoguePages(text) {
  const pages = [];
  let remaining = text;
  const breakChars = ['！', '？', '。', '、', '…'];
  while (remaining.length > 0) {
    if (remaining.length <= DIALOGUE_CHARS_PER_PAGE) {
      pages.push(`<p class="dialogue-line">${remaining}</p>`);
      break;
    }
    // 文字数で機械的に区切ると単語の途中で改ページされておかしくなるため、
    // 上限付近の句読点・感嘆符などの区切り文字を探し、そこで改ページする。
    let cutAt = -1;
    const searchFrom = Math.min(DIALOGUE_CHARS_PER_PAGE, remaining.length) - 1;
    const searchTo = Math.floor(DIALOGUE_CHARS_PER_PAGE * 0.5);
    for (let i = searchFrom; i >= searchTo; i--) {
      if (breakChars.includes(remaining[i])) { cutAt = i + 1; break; }
    }
    if (cutAt === -1) cutAt = DIALOGUE_CHARS_PER_PAGE;
    pages.push(`<p class="dialogue-line">${remaining.slice(0, cutAt)}</p>`);
    remaining = remaining.slice(cutAt);
  }
  return pages.length > 0 ? pages : ['<p class="dialogue-line"></p>'];
}

function logTypeClass(type) {
  if (type === 'plus') return 'dialogue-line-plus';
  if (type === 'minus') return 'dialogue-line-minus';
  if (type === 'money' || type === 'goods') return 'dialogue-line-money';
  return '';
}

// portraits: [{ src, name, active }] 1人 or 2人。省略可(HOME画面など既にキャラが表示されている場合)
// screenTab: このダイアログが表示されるべき画面タブ('job'/'practice'/'live'/'recording')。
//            省略時はどのタブでも(主にhome画面での表示を想定した)システムイベント用。
// 吹き出しは背景画像の下部に重ねて表示し、HUD・下部メニューはそのまま表示され続ける。
function showDialogueScene(portraits, speakerName, text, actionsHtml, bgUrl, screenTab, onClose) {
  dialogueState = {
    pages: dialoguePages(text), index: 0, speakerName, actionsHtml,
    portraits: portraits || [], bgUrl: bgUrl || window.HOME_BG, screenTab: screenTab || null, onClose: onClose || null,
    choiceEcho: consumeChoiceEcho(),
  };
  render();
  playResultSfxForHtml(dialogueState.pages[0]);
}

// segments: [{ text, type }] アルバイト/練習/ライブ/レコーディングの結果表示用。
// 内容ごとに段落を分け、増えたもの(plus)は青文字、減ったもの(minus)は赤文字にする。
// 吹き出しの大きさを一定に保つため、行数が多いときだけ「▼」でページ送りになる
// (DIALOGUE_RESULT_LINES_PER_PAGE行ずつ。ほとんどの結果は1ページで収まる)。
function showResultDialogue(portraits, speakerName, segments, actionsHtml, bgUrl, screenTab, onClose) {
  dialogueState = {
    pages: segmentsToPages(segments), index: 0, speakerName, actionsHtml,
    portraits: portraits || [], bgUrl: bgUrl || window.HOME_BG, screenTab: screenTab || null, onClose: onClose || null,
    choiceEcho: consumeChoiceEcho(),
  };
  render();
  playResultSfxForHtml(dialogueState.pages[0]);
}

// pages: 事前に組み立て済みのHTML文字列の配列(各要素が1ページ分)。複数ページにまたがる
// 会話(結果ログ→分岐質問、など)を組み立てるための低レベルAPI。
function showMultiPageDialogue(portraits, speakerName, pages, actionsHtml, bgUrl, screenTab, onClose) {
  dialogueState = {
    pages, index: 0, speakerName, actionsHtml,
    portraits: portraits || [], bgUrl: bgUrl || window.HOME_BG, screenTab: screenTab || null, onClose: onClose || null,
    choiceEcho: consumeChoiceEcho(),
  };
  render();
  playResultSfxForHtml(dialogueState.pages[0]);
}

function segmentsToPage(segments) {
  return segments.map(seg => `<p class="dialogue-line ${logTypeClass(seg.type)}">${seg.text}</p>`).join('');
}

// 結果表示も吹き出しの大きさを一定に保つため、行数でページに分けて「▼」で送れるようにする。
// ほとんどの結果は1ページに収まるので、実際にページ送りが必要になるのは
// リリース済みCDが多く週間売上の行が増えたときなど、行数が多い場合だけ。
const DIALOGUE_RESULT_LINES_PER_PAGE = 2;  // 吹き出しに収まる行数
const DIALOGUE_LINE_WIDTH = 26;            // 1行に入る全角文字数の目安

// 1行に収まらず折り返す行があるため、件数ではなく「折り返し後の行数」でページを分ける。
// (例:「俺もアフターワークってバンドやってて…」のような長い台詞は1件で2行を使う)
function estimateWrappedLines(text) {
  let width = 0;
  for (const ch of String(text || '')) {
    // 英数字・記号は半角幅として数える(金額や枚数の行を無駄に分割しないため)
    width += /[\x20-\x7E\uFF61-\uFF9F]/.test(ch) ? 0.5 : 1;
  }
  return Math.max(1, Math.ceil(width / DIALOGUE_LINE_WIDTH));
}

function segmentsToPages(segments) {
  const pages = [];
  let current = [];
  let lines = 0;
  for (const seg of segments) {
    const n = estimateWrappedLines(seg.text);
    if (current.length > 0 && lines + n > DIALOGUE_RESULT_LINES_PER_PAGE) {
      pages.push(segmentsToPage(current));
      current = [];
      lines = 0;
    }
    current.push(seg);
    lines += n;
  }
  if (current.length > 0) pages.push(segmentsToPage(current));
  return pages.length > 0 ? pages : ['<p class="dialogue-line"></p>'];
}

// ===== 選択肢(コマンドウィンドウ) =====
// 選択肢は吹き出しの外に出し、常に縦並びのコマンドウィンドウとして出す。
// こうすることで、選択肢の数が変わっても吹き出しの大きさは一定のままになる。
//
//   dialogueChoices([
//     { label: '出演する', action: "..." },
//     { label: '見送る',   action: "...", cancel: true },  // cancel:trueは「断る」系の色
//     { label: 'トラスターレコーズ', sub: 'レコーディング費用25%負担', action: "..." }, // subは小さい説明行
//   ])
//
// 選んだ選択肢は pickDialogueChoice() で覚えておき、
// 次に開く吹き出し(=分岐先のイベント)に「▶ 選んだ選択肢」として表示される。
function escapeForJsAttr(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function dialogueChoices(list) {
  const rows = list.map(c => {
    const echo = c.noEcho ? '' : `pickDialogueChoice('${escapeForJsAttr(c.label)}');`;
    const body = c.sub
      ? `<span class="dialogue-cmd-text"><span class="dialogue-cmd-label">${c.label}</span><span class="dialogue-cmd-sub">${c.sub}</span></span>`
      : `<span class="dialogue-cmd-label">${c.label}</span>`;
    return `<button class="dialogue-cmd-btn${c.cancel ? ' dialogue-cmd-cancel' : ''}" onclick="${echo}${c.action}">
      <span class="dialogue-cmd-cursor">▶</span>${body}
    </button>`;
  }).join('');
  return `<div class="dialogue-command">${rows}</div>`;
}

// 直前に選んだ選択肢。次に開く吹き出しがひとつだけ消費する。
// 選択後に会話が続かないまま時間が経った場合に無関係な場面へ持ち越さないよう、時間で失効させる。
let pendingChoiceEcho = null;
const CHOICE_ECHO_TTL_MS = 12000;
function pickDialogueChoice(label) {
  pendingChoiceEcho = { label, at: Date.now() };
}
function consumeChoiceEcho() {
  const e = pendingChoiceEcho;
  pendingChoiceEcho = null;
  if (!e) return null;
  if (Date.now() - e.at > CHOICE_ECHO_TTL_MS) return null;
  return e.label;
}

// 背景画像コンテナ(.home-bg / .recording-session-bg)の中に差し込む、吹き出し本体のHTML
function dialogueBubbleInnerHtml() {
  const ds = dialogueState;
  const isAfterparty = ds.bgUrl === window.AFTERPARTY_BG;
  const isHomeBg = ds.bgUrl === window.HOME_BG;
  const portraitHtml = ds.portraits.map(p => `
    <img src="${p.src}" class="dialogue-portrait-mini ${p.active ? 'dialogue-portrait-active' : ''} ${p.cls || ''}" />
  `).join('');
  return `
    ${ds.portraits.length ? `<div class="dialogue-portrait-row-mini ${ds.portraits.length > 1 ? 'dialogue-portrait-row-duo' : ''} ${isAfterparty ? 'dialogue-portrait-row-afterparty' : ''} ${isHomeBg ? 'dialogue-portrait-row-home' : ''}">${portraitHtml}</div>` : ''}
    ${dialogueChoiceEchoHtml()}
    <div class="dialogue-command-slot" id="dialogueCommand" onclick="event.stopPropagation()">${dialogueCommandSlotHtml()}</div>
    <div class="dialogue-bubble-inline dialogue-bubble-fixed" onclick="advanceDialogue()">
      <p class="dialogue-name">${ds.speakerName}</p>
      <div class="dialogue-text" id="dialogueText">${ds.pages[ds.index]}</div>
      <div id="dialogueActions" onclick="event.stopPropagation()">${dialogueActionsHtml()}</div>
    </div>
  `;
}

// 直前に選んだ選択肢を「▶ ○○」として吹き出しの上に出す(分岐先で何を選んだか分かるように)。
function dialogueChoiceEchoHtml() {
  const ds = dialogueState;
  if (!ds.choiceEcho) return '';
  return `<div class="dialogue-choice-echo"><span class="dialogue-cmd-cursor">▶</span>${ds.choiceEcho}</div>`;
}

// 選択肢のコマンドウィンドウ。吹き出しの外(上)に置くため、吹き出しの高さは選択肢の数に影響されない。
function dialogueCommandSlotHtml() {
  const ds = dialogueState;
  const isLast = ds.index === ds.pages.length - 1;
  return (isLast && ds.actionsHtml) ? ds.actionsHtml : '';
}

function dialogueActionsHtml() {
  const ds = dialogueState;
  const isLast = ds.index === ds.pages.length - 1;
  // このインジケーターは #dialogueActions (クリックの伝播を止めるラッパー) の中に置かれるため、
  // 自分自身にonclickを持たせないと、▼を直接タップした時だけ反応しなくなってしまう。
  if (!isLast) return `<p class="dialogue-next-indicator" onclick="advanceDialogue()">▼</p>`;
  // 選択肢がある場合、ボタン自体はコマンドウィンドウ側に出ているのでここには何も置かない
  if (ds.actionsHtml) return '';
  // 最終ページでアクションボタンが無く、onLastTap(タップで何か処理をしたい場合)が設定されている時は
  // 「▼」インジケーターだけ見せておく(タップは吹き出し全体で受け付けるのでこの▼自体はonclick不要)
  if (ds.onLastTap) return `<p class="dialogue-next-indicator">▼</p>`;
  return ''; // どちらも無ければ何も出さない(タップで閉じる)
}

function advanceDialogue() {
  const ds = dialogueState;
  if (!ds) return;
  const isLast = ds.index === ds.pages.length - 1;
  if (isLast) {
    // 最終ページは、吹き出し全体のタップで反応するようにする(▼などの小さな領域だけだと反応が悪く感じるため)。
    if (ds.onLastTap) { ds.onLastTap(); return; }
    if (!ds.actionsHtml) closeDialogue(); // アクションが無い場合はタップで閉じる
    return;
  }
  ds.index++;
  playResultSfxForHtml(ds.pages[ds.index]);
  const textEl = document.getElementById('dialogueText');
  const actionsEl = document.getElementById('dialogueActions');
  const commandEl = document.getElementById('dialogueCommand');
  if (textEl) textEl.innerHTML = ds.pages[ds.index];
  if (actionsEl) actionsEl.innerHTML = dialogueActionsHtml();
  // 最終ページに着いたところで選択肢のコマンドウィンドウを出す
  if (commandEl) commandEl.innerHTML = dialogueCommandSlotHtml();
}

function closeDialogue() {
  const ds = dialogueState;
  dialogueState = null;
  render();
  // イベントの吹き出しを閉じた時点で、同じ日に出すべき知らせが残っていれば続けて出す
  // (ライブ当日の知らせがイベントに押し出されて翌週にずれるのを防ぐ)
  const s = window.GameState;
  const pendingLiveDay = !!s.justLiveDayArrived;
  // 通常モーダル(showModal系)と同じキューを共有しているため、こちらでも次を進める
  modalQueue.shift();
  if (modalQueue.length > 0) {
    modalQueue[0]();
  }
  if (ds && ds.onClose) ds.onClose();
  endEventBgmIfIdle();
  if (pendingLiveDay && !dialogueState && modalQueue.length === 0) {
    showStartOfDayPopupsIfAny();
  }
}

// 吹き出しのボタンから別タブへ移動する場合に使う。先に画面遷移を確定させてから
// キューの次のポップアップを進める(そうしないと、次のポップアップがすぐ表示されて
// isNavLocked()に阻まれ、setTab()が効かなくなることがあるため)。
function closeDialogueAndGoTo(tab) {
  dialogueState = null;
  pendingChoiceEcho = null; // 別画面へ移る選択は、その先の無関係な会話に持ち越さない
  setEventBgm(false);       // ライブなど別の画面へ移るので、その画面のBGMに任せる
  setTab(tab);
  advanceModalQueueOnly();
}

function advanceModalQueueOnly() {
  modalQueue.shift();
  if (modalQueue.length > 0) {
    modalQueue[0]();
  }
}

function heroPortrait() {
  return window.RECORDING_CHARS.guitar_idle;
}

// タケル待機ポーズ(結果画面の会話で使う既定ポートレート)
function idlePortrait() {
  return (window.HOME_CHAR_STATES && window.HOME_CHAR_STATES.normal) || heroPortrait();
}

// 「COMPLETE」表示 → 右から左への暗転ワイプ → 裏側のシーンを差し替え、という一連の演出。
// onMidpoint はワイプが画面を覆っているタイミングで呼ばれ、そこでダイアログの表示状態を更新する。
// #app は render() のたびに丸ごと innerHTML が置き換わるため、演出用のオーバーレイは
// render() の影響を受けない #modalRoot 側に一時的に描画する。
// 日付が変わった後、結果の吹き出しを閉じたら必ず暗転アニメーションでホームへ戻る
// 成果ログを閉じた後の「日付が変わる」演出。ここで初めて日付ラベル入りのワイプを見せる。
// 成果ログを閉じた後の「日付が変わる」演出。ここで初めて日付ラベル入りのワイプを見せる。
// ただし曲完成・ナサケナーイ博士イベントなど特別な演出が控えている場合は、
// 「日付が変わった→そのイベントが始まる」という二段階に見えてしまうのを避けるため、
// 日付ラベルの表示を省略し、そのイベント側の演出(暗転など)に直接つなげる。
// 日付変更の暗転のあとに専用の演出が控えているイベント。
// これらがある時は日付ラベルを出さず、イベント側の暗転にそのままつなげる
// (「日付が変わった→イベントが始まった」と二段階に見えるのを避けるため)。
function hasPendingSpecialEvent() {
  const s = window.GameState;
  return !!(s.justCompletedSong || s.justDrNasakenaiEvent || s.justTakumaEvent || s.justIndieLabelOffer || s.justKeibaEvent || s.justChoiceEvent);
}

function closeToHomeAnimated() {
  const hasSpecialEvent = hasPendingSpecialEvent();
  playCompleteWipeTransition(() => {
    // 次にまたイベントが控えている場合はイベントBGMのまま、そうでなければ通常BGMに戻す
    if (!hasSpecialEvent) setEventBgm(false);
    setTab('home');
    showStartOfDayPopupsIfAny();
  }, hasSpecialEvent ? false : dateWipeLabel(window.GameState.turn), !hasSpecialEvent);
}

function showInsufficientFundsToast() {
  playSfx('deny');
  const root = document.getElementById('modalRoot');
  if (!root) return;
  const toast = document.createElement('div');
  toast.className = 'insufficient-funds-toast';
  toast.textContent = 'お金が足りません';
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('active'));
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, 1400);
}

// showText: true(既定)=「COMPLETE」を表示 / false=文字なし / 文字列=その文字列を表示(日付変更演出用など)
// showText: true(既定)=「COMPLETE」を金文字で表示 / false=文字なし(暗転のみ) / 文字列=その文字列を表示
// isDateChange: trueの場合、日付変更演出として白文字で表示する(COMPLETEの金文字と区別するため)
function playCompleteWipeTransition(onMidpoint, showText, isDateChange) {
  const root = document.getElementById('modalRoot');
  if (!root) { onMidpoint(); return; }
  let label = '';
  if (showText === false) label = '';
  else if (typeof showText === 'string') label = showText;
  else label = 'COMPLETE';
  const cls = isDateChange ? 'wipe-date-text' : 'wipe-complete-text';
  const textHtml = label ? `<p class="${cls}">${label}</p>` : '';
  root.innerHTML = `
    <div class="wipe-transition-overlay">
      ${textHtml}
      <div class="wipe-panel"></div>
    </div>`;
  // 暗転が画面を覆っている520msのあいだに、次の画面の画像を取りに行かせる
  try { preloadImages(imagesForTab(currentTab)); } catch (e) { /* 同上 */ }
  setTimeout(() => { onMidpoint(); }, 520);
  setTimeout(() => {
    if (root.querySelector('.wipe-transition-overlay')) root.innerHTML = '';
  }, 980);
}

// 日付が変わるアニメーションで表示する「○年目 ○月○週」ラベル。
// turnをそのまま渡す(=既に進行済みの新しい日付)か、+1したものを渡す(=これから進む日付)かは呼び出し側で判断する。
function dateWipeLabel(turn) {
  return window.GameData.turnToDateLabel(turn);
}

function showFlavorEventPopup(ev) {
  setEventBgm(true);   // イベント中はイベントBGMに切り替える
  playCompleteWipeTransition(() => {
    showDialogueScene([], ev.title, ev.body, null, null, null, closeToHomeAnimated);
  }, false);
}

function showFriendOfferPopup(offer) {
  setEventBgm(true);   // イベント中はイベントBGMに切り替える
  const offerJson = JSON.stringify(offer).replace(/"/g, '&quot;');
  const venue = window.GameData.VENUES.find(v => v.key === offer.venueKey);
  const otherPortrait = (window.MEMBER_CHARS && window.MEMBER_CHARS.ryohei && offer.friendId === 'ryohei')
    ? window.MEMBER_CHARS.ryohei.convo
    : (window.CONVO_CHARS && window.CONVO_CHARS.ryohei) || heroPortrait();
  const text = offer.isRyoheiRP2
    ? `⚪︎月⚪︎週にイベントをするんだけど、よかったら出てもらえない？`
    : `お疲れ様！ ${venue.name}でイベントを開催するんだけど、良かったら出演してもらえない？(ギャラ: ${yen(offer.gala)})`;
  // りょーぺのオファーは、たくま(TKM3)と同じく「定期ライブと被らない週に対バンを決める」形にする。
  // その場ですぐ会場へ向かうのは、オンラインのフレンドからのオファーだけ。
  const isRyoheiOffer = offer.friendId === 'ryohei';
  const acceptAction = isRyoheiOffer
    ? `dialogueState=null;GameActions.scheduleRyoheiCollab(${offerJson});advanceModalQueueOnly();`
    : `dialogueState=null;friendOfferFlowState={offer:${offerJson},members:[]};setTab('friendlive');advanceModalQueueOnly();`;
  playCompleteWipeTransition(() => {
    showDialogueScene(
      [
        // 主人公はタケル待機(ホーム画面と同じ立ち絵)。相手と並ぶ場面だが暗くはしない。
        { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
        { src: otherPortrait, name: offer.friendName, active: true },
      ],
      `${offer.friendName}(${offer.bandName})`,
      text,
      dialogueChoices([
        { label: '出演する', action: acceptAction },
        { label: '見送る', action: `closeDialogue();GameActions.declineFriendOffer(${offerJson});`, cancel: true },
      ]),
      window.VENUE_OUTSIDE_BG // 誘われる場面なので、会場の中ではなくライブハウスの外
    );
  }, false);
}

function screenFriendLive() {
  if (friendLiveSessionState.active) return screenFriendLiveSession();
  const offer = friendOfferFlowState.offer;
  if (!offer) return `<p class="empty">オファー情報がありません</p>`;
  const venue = window.GameData.VENUES.find(v => v.key === offer.venueKey);
  const memberCost = friendOfferFlowState.members.length * window.GameData.MEMBER_COST;
  return `<div class="header"><span>${offer.friendName}との対バン(${venue.name})</span></div>
    <p class="section-label">サポートメンバーを選ぶ(任意・1人¥10,000)</p>
    <div class="list">${memberToggleRows(friendOfferFlowState.members, 'toggleFriendOfferMember')}</div>
    <div style="padding:10px 14px 0;"><p class="row-sub" style="text-align:center;">メンバー費用: ¥${memberCost.toLocaleString()}</p></div>
    <div style="padding:8px 14px 0;"><button class="rest-btn" onclick="startFriendLiveSession()">出演する</button></div>`;
}

function toggleFriendOfferMember(key) {
  const idx = friendOfferFlowState.members.indexOf(key);
  if (idx >= 0) { friendOfferFlowState.members.splice(idx, 1); } else { friendOfferFlowState.members.push(key); }
  render();
}

function startFriendLiveSession() {
  const memberCost = friendOfferFlowState.members.length * window.GameData.MEMBER_COST;
  if (window.GameState.money < memberCost) {
    showInsufficientFundsToast();
    return;
  }
  friendLiveSessionState = { active: true, stage: 'self', offer: friendOfferFlowState.offer, members: friendOfferFlowState.members.slice(), frame: 0 };
  friendOfferFlowState = { offer: null, members: [] };
  render();
  runFriendLiveSessionStage();
}

function runFriendLiveSessionStage() {
  clearTimeout(friendLiveSessionTimer);
  clearInterval(friendLiveFrameTimer);
  friendLiveSessionState.frame = 0;

  friendLiveFrameTimer = setInterval(() => {
    friendLiveSessionState.frame = friendLiveSessionState.frame === 0 ? 1 : 0;
    if (friendLiveSessionState.stage === 'self') {
      const order = LIVE_MEMBER_ORDER.filter(k => friendLiveSessionState.members.includes(k));
      const performers = [...order, 'vocal'];
      performers.forEach((partKey, i) => {
        const img = document.getElementById('friendLivePerformer' + i);
        if (img) img.src = getLivePerformerImg(partKey, friendLiveSessionState.frame);
      });
    } else {
      const img = document.getElementById('friendLivePerformer0');
      if (img) img.src = getOpponentPerformerImg(friendLiveSessionState.offer.friendId, friendLiveSessionState.frame);
    }
  }, 450);

  const duration = friendLiveSessionState.stage === 'self' ? 5000 : 3000;
  friendLiveSessionTimer = setTimeout(() => {
    if (friendLiveSessionState.stage === 'self') {
      friendLiveSessionState.stage = 'friend';
      render();
      runFriendLiveSessionStage();
    } else {
      clearInterval(friendLiveFrameTimer);
      playSfx('complete');
      const offer = friendLiveSessionState.offer;
      const members = friendLiveSessionState.members;
      friendLiveSessionState = { active: false, stage: null, offer: null, members: [], frame: 0 };
      const info = GameActions.finalizeFriendOfferLive(offer, members);
      if (info) {
        playCompleteWipeTransition(() => {
          showCollabLiveFinishedDialogue(info);
        });
      }
    }
  }, duration);
}

function screenFriendLiveSession() {
  const offer = friendLiveSessionState.offer;
  const venue = window.GameData.VENUES.find(v => v.key === offer.venueKey);
  const bg = window.VENUE_BG[venue.key];
  const isSelf = friendLiveSessionState.stage === 'self';
  const duration = isSelf ? 5 : 3;

  let performerHtml;
  if (isSelf) {
    const order = LIVE_MEMBER_ORDER.filter(k => friendLiveSessionState.members.includes(k));
    const performers = [...order, 'vocal'];
    const solo = performers.length === 1;
    performerHtml = performers.map((partKey, i) => {
      const cls = solo ? 'live-performer live-performer-solo' : 'live-performer';
      return `<img id="friendLivePerformer${i}" src="${getLivePerformerImg(partKey, 0)}" class="${cls}" />`;
    }).join('');
  } else {
    performerHtml = `<img id="friendLivePerformer0" src="${getOpponentPerformerImg(offer.friendId, 0)}" class="live-performer live-performer-solo" />`;
  }

  const label = isSelf ? `${venue.name}でライブ中...` : `${offer.friendName}（${offer.bandName}）がライブ中...`;

  return `
    <div class="header"><span>対バンライブ中</span></div>
    <div class="recording-session-bg" style="background-image:url('${bg}')">
      <div class="live-performers-row" style="bottom:${VENUE_STAGE_BOTTOM[venue.key] || '4%'};">${performerHtml}</div>
    </div>
    <div class="progress-card" style="margin:10px 14px;">
      <p class="progress-title">${label}</p>
      <div class="bar"><div class="bar-fill loading-fill" style="animation-duration:${duration}s;"></div></div>
    </div>
  `;
}

// 対バンライブ終了後の吹き出し(定期ライブと同じ流れ)。共演相手の会話キャラも一緒に表示する。
function showCollabLiveFinishedDialogue(info) {
  const resultSegments = [
    { text: `${info.friendName}(${info.bandName})との対バンが終わった！`, type: 'neutral' },
    { text: `${info.venueName} / 動員${info.audience.toLocaleString()}人`, type: 'neutral' },
    { text: `知名度が${info.fameGain}増えた`, type: 'plus' },
  ];
  if (info.gala !== undefined) {
    resultSegments.push({ text: `ギャラ${yen(info.gala)}を受け取った`, type: 'money' });
  } else if (info.profit !== undefined) {
    resultSegments.push(info.profit >= 0
      ? { text: `利益が${yen(info.profit)}増えた`, type: 'money' }
      : { text: `${yen(Math.abs(info.profit))}の赤字になった`, type: 'minus' });
  }
  // 吹き出しに収まる行数で区切る(1ページに詰め込むと文字が隠れてしまうため)
  const resultPages = segmentsToPages(resultSegments);
  const partnerChar = window.MEMBER_CHARS && window.MEMBER_CHARS[info.friendId];
  const portraits = [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }];
  if (partnerChar) portraits.push({ src: partnerChar.convo, name: info.friendName, active: true });

  if (info.isRyoheiFirstCollab) {
    // りょーぺの初回対バンは「参加する？」を挟まず、この後RP4が打ち上げの導入を兼ねる
    showMultiPageDialogue(
      portraits, window.GameState.playerName || 'タケル', resultPages,
      dialogueChoices([{ label: '次へ', action: 'closeDialogue();', noEcho: true }]),
      window.VENUE_OUTSIDE_BG, 'live',
      triggerRyoheiRP4ThenAfterparty
    );
    return;
  }

  const page2 = `<p class="dialogue-line">打ち上げがあるみたいだ</p><p class="dialogue-line">参加する？</p>`;
  showMultiPageDialogue(
    portraits, window.GameState.playerName || 'タケル', [...resultPages, page2],
    dialogueChoices([
      { label: 'はい', action: `respondAfterpartyUI(true,'${info.friendId}')` },
      { label: 'いいえ', action: `respondAfterpartyUI(false,'${info.friendId}')`, cancel: true },
    ]),
    window.VENUE_OUTSIDE_BG, 'live'
  );
}

// りょーぺの初回対バンに限り、打ち上げの「参加する？」の代わりにRP4(お金を貸してくれ)が導入を兼ねる
function triggerRyoheiRP4ThenAfterparty() {
  const ryoheiImg = (window.MEMBER_CHARS && window.MEMBER_CHARS.ryohei) ? window.MEMBER_CHARS.ryohei.convo : heroPortrait();
  const segments = [
    { text: 'タケル「打ち上げ代貸してくれ！」', type: 'neutral' },
    { text: 'りょーぺ「ちゃんと返せよ！」', type: 'neutral' },
  ];
  playCompleteWipeTransition(() => {
    showResultDialogue(
      [{ src: ryoheiImg, name: 'りょーぺ', active: true }],
      'りょーぺ', segments, null, window.AFTERPARTY_BG, null,
      () => {
        playCompleteWipeTransition(() => {
          afterpartyPartnerKey = 'ryohei';
          GameActions.startAfterparty();
          showDrinkPrompt(true);
        }, false);
      }
    );
  }, false);
}

let bgmStatusMsg = '';

let homeMenuOpen = false;
function toggleHomeMenu() {
  homeMenuOpen = !homeMenuOpen;
  render();
}
// ホームのMENU。カセットテープ風のパネルに、項目をコマンドとして並べる。
function homeMenuPopoverHtml() {
  const s = window.GameState;
  const unread = (s.mailbox || []).filter(m => !m.read).length;
  const items = [
    { icon: '📮', label: 'メールボックス', sub: 'オファーやお知らせ', badge: unread, action: "homeMenuOpen=false;setTab('mailbox');" },
    { icon: '📖', label: 'あそびかた', sub: 'ルールをおさらい', action: "homeMenuOpen=false;openHowTo('game');" },
    { icon: '⚙️', label: '設定', sub: 'サウンド・データ', action: "homeMenuOpen=false;setTab('settings');" },
    { icon: '🏠', label: 'タイトルへ戻る', sub: '進行状況は保存されます', action: "homeMenuOpen=false;returnToTitle();" },
  ];
  const rows = items.map(it => `
    <button class="menu-cmd" onclick="${it.action}">
      <span class="menu-cmd-cursor">▶</span>
      <span class="menu-cmd-icon">${it.icon}</span>
      <span class="menu-cmd-text">
        <span class="menu-cmd-label">${it.label}${it.badge ? `<span class="menu-cmd-badge">${it.badge}</span>` : ''}</span>
        <span class="menu-cmd-sub">${it.sub}</span>
      </span>
    </button>`).join('');
  return `
    <div class="home-menu-backdrop" onclick="homeMenuOpen=false;render();"></div>
    <div class="home-menu-panel">
      <div class="menu-panel-head">
        <span class="menu-panel-title">MENU</span>
        <button class="menu-panel-close" onclick="homeMenuOpen=false;render();">✕</button>
      </div>
      <div class="menu-panel-player">
        <img src="${currentIconUrl()}" class="menu-panel-face" />
        <div class="menu-panel-info">
          <p class="menu-panel-name">${s.playerName || 'タケル'}</p>
          <p class="menu-panel-band">${s.bandName || ''}</p>
          <p class="menu-panel-date">${turnToDateLabel(s.turn)} / 残り${Math.max(0, window.GameData.TOTAL_TURNS - s.turn + 1)}週</p>
        </div>
      </div>
      <div class="menu-cmd-list">${rows}</div>
      <div class="menu-panel-bgm">
        <span>${bgmMuted ? '🔇' : '🔔'} サウンド</span>
        <button class="menu-bgm-toggle ${bgmMuted ? '' : 'on'}" onclick="toggleBgmMute();render();">${bgmMuted ? 'OFF' : 'ON'}</button>
      </div>
    </div>
  `;
}

function screenMenu() {
  return `
    <div class="header"><button class="back" onclick="setTab('home');">←</button><span>MENU</span></div>
    <div class="list" style="padding:0 14px;">
      <div class="row" onclick="setTab('mailbox')">
        <div class="thumb">📮</div>
        <div class="row-text"><p class="row-title">メールボックス</p><p class="row-sub">対バンオファーやお知らせを確認</p></div>
      </div>
      <div class="row" onclick="setTab('settings')">
        <div class="thumb">⚙️</div>
        <div class="row-text"><p class="row-title">設定</p><p class="row-sub">サウンド・データなど</p></div>
      </div>
    </div>
  `;
}

function screenSettings() {
  return sectionTitle('設定') +
    `<p class="settings-group-label">🔊 サウンド</p>
    <div class="list">
      <div class="row" onclick="toggleBgmMute()">
        <div class="thumb">${bgmMuted ? '🔇' : '🔔'}</div>
        <div class="row-text">
          <p class="row-title">ミュート</p>
          <p class="row-sub">BGM・効果音をまとめて消す</p>
        </div>
        <span class="row-value ${bgmMuted ? '' : 'gold'}">${bgmMuted ? 'ON' : 'OFF'}</span>
      </div>
      <div class="row volume-row">
        <div class="thumb">🎵</div>
        <div class="row-text">
          <p class="row-title">BGMの音量 <span class="volume-value" id="vol-bgm-value">${volumeSettings.bgm}%</span></p>
          <input type="range" class="volume-slider" min="0" max="100" step="5"
                 value="${volumeSettings.bgm}" oninput="setVolume('bgm', this.value)" />
        </div>
      </div>
      <div class="row volume-row">
        <div class="thumb">🔊</div>
        <div class="row-text">
          <p class="row-title">効果音の音量 <span class="volume-value" id="vol-sfx-value">${volumeSettings.sfx}%</span></p>
          <input type="range" class="volume-slider" min="0" max="100" step="5"
                 value="${volumeSettings.sfx}" oninput="setVolume('sfx', this.value)" />
        </div>
      </div>
    </div>
    <p class="settings-group-label">👤 プレイヤー</p>
    <div class="list">
      <div class="row" onclick="showIconPicker()">
        <img src="${currentIconUrl()}" class="thumb" style="object-fit:cover;object-position:top center;" />
        <div class="row-text">
          <p class="row-title">アイコン</p>
          <p class="row-sub">ランキングや事務所に表示されます</p>
        </div>
        <span class="row-value gold">変更</span>
      </div>
      <div class="row" onclick="openAccountNameEdit()">
        <div class="thumb">✎</div>
        <div class="row-text">
          <p class="row-title">アカウント名</p>
          <p class="row-sub">${getAccountName() || '未設定'}</p>
        </div>
        <span class="row-value gold">変更</span>
      </div>
    </div>
    <p class="settings-group-label">🎮 ゲーム</p>
    <div class="list">
      <div class="row" onclick="openHowTo('game')">
        <div class="thumb">📖</div>
        <div class="row-text">
          <p class="row-title">あそびかた</p>
          <p class="row-sub">ゲームの遊び方を確認する</p>
        </div>
      </div>
      <div class="row" onclick="returnToTitle()">
        <div class="thumb">🏠</div>
        <div class="row-text">
          <p class="row-title">タイトルへ戻る</p>
          <p class="row-sub">進行状況はそのまま保持されます</p>
        </div>
      </div>
      <div class="row" onclick="clearSaveData()">
        <div class="thumb">🗑️</div>
        <div class="row-text">
          <p class="row-title">セーブデータを削除</p>
          <p class="row-sub">進行状況を消してやり直す(元に戻せません)</p>
        </div>
      </div>
    </div>
    <p class="settings-version">version ${window.APP_VERSION || '?'}</p>`;
}

function clearSaveData() {
  showModal(`
    <div class="modal-card">
      <p class="modal-title">セーブデータを削除</p>
      <p class="modal-sub">セーブデータを削除しますか？<br>この操作は元に戻せません。</p>
      <button class="modal-primary-btn" onclick="closeModal();confirmClearSaveData();">削除する</button>
      <button class="modal-close-btn" onclick="closeModal()">キャンセル</button>
    </div>
  `);
}

function confirmClearSaveData() {
  GameActions.deleteSaveData();
  appPhase = 'title';
  render();
  updateBGM('title');
}

function returnToTitle() {
  showModal(`
    <div class="modal-card">
      <p class="modal-title">タイトルへ戻る</p>
      <p class="modal-sub">タイトル画面に戻りますか？<br>(進行状況はそのまま保持されます)</p>
      <button class="modal-primary-btn" onclick="closeModal();confirmReturnToTitle();">戻る</button>
      <button class="modal-close-btn" onclick="closeModal()">キャンセル</button>
    </div>
  `);
}

function confirmReturnToTitle() {
  appPhase = 'title';
  render();
  updateBGM('title');
}

function manualStartBGM() {
  const audioEl = document.getElementById('bgmPlayer');
  if (!audioEl) { bgmStatusMsg = 'プレイヤーが見つかりません'; render(); return; }
  bgmMuted = false;
  audioEl.muted = false;
  if (!audioEl.src) {
    updateBGM(currentTab);
  }
  audioEl.play().then(() => {
    bgmStatusMsg = '再生を開始しました';
    render();
  }).catch(err => {
    bgmStatusMsg = 'エラー: ' + (err && err.message ? err.message : String(err));
    render();
  });
}

const GOODS_EMOJI = { sticker: '🏷️', tshirt_short: '👕', tshirt_long: '👕', hoodie: '🧥', towel: '🧺', keyholder: '🔑' };
let goodsFlowState = { type: null, quantity: null, price: null };

function screenGoods() {
  if (!goodsFlowState.type) {
    const s = window.GameState;
    const month = s.month;
    const totalStock = (s.goodsInventory || []).reduce((a, inv) => a + inv.remaining, 0);
    const cards = window.GameData.GOODS.map(g => {
      const stock = (s.goodsInventory || []).filter(inv => inv.key === g.key).reduce((a, inv) => a + inv.remaining, 0);
      // 旬の時期は売れやすいので、その月に入っているものは目立たせる
      const inSeason = g.seasonMonths && g.seasonMonths.indexOf(month) >= 0;
      return `
      <button class="goods-card ${inSeason ? 'goods-card-hot' : ''}"
        onclick="goodsFlowState={type:'${g.key}',quantity:${g.minQty},price:${g.priceMin}};render();">
        ${inSeason ? '<span class="goods-season">旬</span>' : ''}
        <span class="goods-card-imgwrap">
          <img src="${window.GOODS_THUMB[g.key]}" class="goods-card-img" loading="lazy" decoding="async" />
        </span>
        <span class="goods-card-name">${g.name}</span>
        <span class="goods-card-price">¥${g.priceMin.toLocaleString()}〜</span>
        <span class="goods-card-stock ${stock > 0 ? 'has-stock' : ''}">在庫 ${stock.toLocaleString()}</span>
      </button>`;
    }).join('');
    return `
      <div class="craft-hero" style="background-image:url('${window.HOME_BG}')">
        <div class="craft-hero-shade"></div>
        <img src="${window.TAKERU_HAPPY_IMG || window.RECORDING_CHARS.guitar_idle}" class="craft-hero-char" />
        <div class="craft-hero-text">
          <p class="craft-hero-label">GOODS</p>
          <p class="craft-hero-title">グッズを作る</p>
          <p class="craft-hero-sub">ライブの物販で売れます${totalStock > 0 ? ` / 在庫 ${totalStock.toLocaleString()}個` : ''}</p>
        </div>
      </div>
      ${feverBanner()}
      <div class="craft-block">
        <p class="craft-block-label">何を作る？ <span class="craft-block-hint">「旬」は今の季節に売れやすい商品です</span></p>
        <div class="goods-grid">${cards}</div>
      </div>
    ` + logBox();
  }

  const g = window.GameData.GOODS.find(x => x.key === goodsFlowState.type);
  const qty = goodsFlowState.quantity;
  const price = goodsFlowState.price;
  const totalCost = qty * g.unitCost;
  const currentStock = (window.GameState.goodsInventory || []).filter(inv => inv.key === g.key).reduce((a, inv) => a + inv.remaining, 0);
  const seasonNote = g.seasonMonths ? `<p class="row-sub">旬な時期: ${g.seasonMonths.map(m => m + '月').join('/')}(売れやすい)</p>` : '';

  const inSeason = g.seasonMonths && g.seasonMonths.indexOf(window.GameState.month) >= 0;
  return `<div class="header"><button class="back" onclick="goodsFlowState={type:null,quantity:null,price:null};render();">←</button><span>${g.name}</span></div>
    <div class="goods-detail-hero">
      <div class="goods-detail-imgwrap">
        <img src="${window.GOODS_THUMB[g.key]}" class="goods-detail-img" />
      </div>
      <div class="goods-detail-info">
        <p class="goods-detail-name">${g.name}${inSeason ? '<span class="goods-season goods-season-inline">旬</span>' : ''}</p>
        <p class="goods-detail-sub">原価 ¥${g.unitCost.toLocaleString()}/個 ・ 体力-${g.healthCost}%</p>
        <p class="goods-detail-sub">現在の在庫 <b>${currentStock.toLocaleString()}</b>個</p>
      </div>
    </div>
    <div style="padding:12px 14px 0;">
      <p class="section-label" style="padding:0 0 4px;">制作数: ${qty.toLocaleString()}個(最低${g.minQty}個)</p>
      <input id="goodsQtyInput" type="number" value="${qty}" min="${g.minQty}" step="1" class="text-input" style="width:100%;text-align:center;" oninput="setGoodsQty(this.value)" />
      <div class="grid3" style="margin-top:8px;">
        <button class="genre-btn" onclick="adjustGoodsQty(1)">+1</button>
        <button class="genre-btn" onclick="adjustGoodsQty(10)">+10</button>
        <button class="genre-btn" onclick="adjustGoodsQty(100)">+100</button>
      </div>
      ${seasonNote}
    </div>
    <div style="padding:14px 14px 0;">
      <p class="section-label" style="padding:0 0 4px;">売値: <span id="goodsPriceLabel">¥${price.toLocaleString()}</span>(¥${g.priceMin.toLocaleString()}〜¥${g.priceMax.toLocaleString()})</p>
      <input type="range" min="${g.priceMin}" max="${g.priceMax}" step="50" value="${price}"
        oninput="goodsFlowState.price=parseInt(this.value);document.getElementById('goodsPriceLabel').innerText='¥'+parseInt(this.value).toLocaleString();"
        style="width:100%;" />
    </div>
    <div style="padding:12px 14px 0;"><p class="row-sub" style="text-align:center;">制作費用合計: ¥${totalCost.toLocaleString()}(¥${g.unitCost.toLocaleString()}×${qty.toLocaleString()}個)</p></div>
    <div style="padding:8px 14px 0;"><button class="rest-btn" onclick="confirmMakeGoods()">この内容で制作する</button></div>
    ${logBox()}`;
}

function adjustGoodsQty(delta) {
  const g = window.GameData.GOODS.find(x => x.key === goodsFlowState.type);
  goodsFlowState.quantity = Math.max(g.minQty, goodsFlowState.quantity + delta);
  render();
}

function setGoodsQty(val) {
  const g = window.GameData.GOODS.find(x => x.key === goodsFlowState.type);
  const n = parseInt(val, 10) || g.minQty;
  goodsFlowState.quantity = Math.max(g.minQty, n);
}

function confirmMakeGoods() {
  const params = goodsFlowState;
  goodsFlowState = { type: null, quantity: null, price: null };
  GameActions.makeGoods(params.type, params.quantity, params.price);
}

let statusTab = 'basic'; // 'basic' | 'special'

function raiseStatUI(key, amount) {
  amount = amount || 1;
  let successCount = 0;
  for (let i = 0; i < amount; i++) {
    const r = StatsEngine.raiseStat(window.GameState, key);
    if (!r.ok) break;
    successCount++;
  }
  if (successCount === 0) {
    playSfx('deny');
    addLog('経験点が足りません', 'neutral');
  } else {
    playSfx('levelup', { minGap: 0 });
    const newValue = window.GameState.stats[key];
    addLog(`${StatsEngine.STAT_DEFS[key].name}が${newValue}になった(${StatsEngine.getRank(newValue)}ランク)`, 'plus');
  }
  render();
}

function unlockAbilityUI(key) {
  const r = StatsEngine.tryUnlockAbility(window.GameState, key);
  if (!r.ok) {
    playSfx('deny');
    addLog('特殊能力の習得条件を満たしていません', 'neutral');
  } else {
    playSfx('fanfare', { minGap: 0 });
    addLog(`特殊能力「${r.label}」を習得した！`, 'plus');
  }
  render();
}

// 次のデビューまでに何が足りないかを出す。
// メジャーは知名度だけでなく総合力も条件なので、これが無いと「なぜ声がかからないのか」が分からない。
function debutGoalCard() {
  const s = window.GameState;
  const G = window.GameData;
  if (s.agencyStatus === 'major') {
    return `<div class="debut-goal"><span class="debut-goal-title">メジャーデビュー済み</span></div>`;
  }
  const rows = [];
  let title;
  if (s.agencyStatus === 'unsigned') {
    title = 'インディーズデビューの条件';
    const best = Math.max(s.fame, s.followers);
    rows.push(goalRow('知名度またはフォロワー', Math.round(best), G.INDIE_OFFER_THRESHOLD));
    rows.push(goalRow('総合力(Dランク以上)', Math.round(StatsEngine.calcOverallScore(s)), G.INDIE_OVERALL_REQUIRED));
  } else {
    title = 'メジャーデビューの条件';
    rows.push(goalRow('知名度', Math.round(s.fame), G.MAJOR_FAME_REQUIRED));
    rows.push(goalRow('フォロワー', Math.round(s.followers), G.MAJOR_FOLLOWERS_REQUIRED));
    rows.push(goalRow('総合力(Cランク以上)', Math.round(StatsEngine.calcOverallScore(s)), G.MAJOR_OVERALL_REQUIRED));
    if (G.meetsMajorRequirements()) {
      rows.push(`<p class="debut-goal-note">条件は満たしている。あとは声がかかるのを待つだけだ</p>`);
    }
  }
  return `<div class="debut-goal">
      <span class="debut-goal-title">${title}</span>
      ${rows.join('')}
    </div>`;
}

function goalRow(label, now, need) {
  const done = now >= need;
  const pct = Math.max(0, Math.min(100, (now / need) * 100));
  return `<div class="debut-goal-row ${done ? 'is-done' : ''}">
      <span class="debut-goal-label">${label}</span>
      <span class="debut-goal-num">${now.toLocaleString()} / ${need.toLocaleString()}${done ? ' ✓' : ''}</span>
      <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
    </div>`;
}

function statRankRows(s) {
  return StatsEngine.STAT_ORDER.map(key => {
    const def = StatsEngine.STAT_DEFS[key];
    const val = s.stats[key] || 0;
    const rank = StatsEngine.getRank(val);
    const cost = StatsEngine.pointCost(val);
    const perCat = Math.ceil(cost / def.categories.length);
    const canRaise = def.categories.every(c => (s.expPool[c] || 0) >= perCat);
    const catLabel = def.categories.map(c => StatsEngine.EXP_CATEGORY_NAMES[c]).join('+');
    const rankLetter = rank[0];
    return `
      <div class="rank-stat-row">
        <div class="rank-stat-top">
          <span class="rank-badge rank-${rankLetter}">${rank}</span>
          <span class="rank-stat-name">${def.name}</span>
          <span class="rank-stat-value">${val}</span>
          <button class="rank-up-btn" ${canRaise ? '' : 'disabled'} onclick="raiseStatUI('${key}',1)">+1</button>
          <button class="rank-up-btn rank-up-btn-10" ${canRaise ? '' : 'disabled'} onclick="raiseStatUI('${key}',10)">+10</button>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${Math.min(100, val)}%"></div></div>
        <p class="rank-stat-sub">消費経験点(${catLabel}):各<b>${perCat}</b></p>
      </div>`;
  }).join('');
}

// 能力のランクに応じたCSSクラス。通常=青、金=金、超特殊=虹。
function abilityToneClass(def, tier) {
  if (def && def.negative) return 'ability-tone-bad';
  if (def && def.super) return 'ability-tone-super';
  if (tier === 'gold') return 'ability-tone-gold';
  return 'ability-tone-normal';
}

function abilityRows(s) {
  return Object.entries(StatsEngine.ABILITIES).map(([key, def]) => {
    const owned = (s.abilities || []).find(a => a.key === key);
    // マイナス能力とセンスは自分では習得できない。持っていないうちは一覧に出さない。
    if (def.unlockType === 'special' && !owned) return '';
    const tierIdx = owned ? def.tiers.findIndex(t => t.tier === owned.tier) : -1;
    const nextTier = def.tiers[tierIdx + 1];
    const currentLabel = owned ? def.tiers[tierIdx].label : '未習得';
    const isGold = !!(owned && owned.tier === 'gold');
    let actionHtml;
    if (def.unlockType === 'special') {
      actionHtml = `<p class="rank-stat-sub">${def.negative ? 'イベントの結果でついてしまった能力です' : '持って生まれた才能です'}</p>`;
    } else if (nextTier) {
      let can = false;
      let costLabel = '';
      if (def.unlockType === 'mastery') {
        const mastery = (s.jobMastery && s.jobMastery[def.masteryJob]) || 0;
        can = mastery >= 100;
        costLabel = `アルバイト熟練度MAX(${mastery}/100)`;
      } else {
        const cost = nextTier.cost || {};
        can = Object.keys(cost).every(c => (s.expPool[c] || 0) >= cost[c]);
        costLabel = Object.entries(cost).map(([c, v]) => `${StatsEngine.EXP_CATEGORY_NAMES[c]}${v}`).join(' ');
      }
      actionHtml = `<button class="rank-up-btn" ${can ? '' : 'disabled'} onclick="unlockAbilityUI('${key}')">${nextTier.label}を習得</button><p class="rank-stat-sub">必要: ${costLabel}</p>`;
    } else {
      actionHtml = `<p class="rank-stat-sub">これ以上の段階はありません</p>`;
    }
    return `
      <div class="ability-row ${abilityToneClass(def, owned ? owned.tier : null)} ${isGold ? 'ability-gold' : ''} ${def.negative ? 'ability-negative' : ''}">
        <div class="ability-row-top"><span class="ability-name">${def.name}</span><span class="ability-current">${currentLabel}</span></div>
        <p class="ability-effect">${def.effect}</p>
        ${actionHtml}
      </div>`;
  }).join('');
}

function screenStatus() {
  const s = window.GameState;
  const releasedCount = (s.releases || []).filter(r => r.released).length;
  const overallRank = StatsEngine.getOverallRank(s);
  const overallScore = Math.round(StatsEngine.calcOverallScore(s));
  const expPoolHtml = StatsEngine.EXP_CATEGORIES.map(c => `
    <div class="exp-pool-chip"><span>${StatsEngine.EXP_CATEGORY_NAMES[c]}</span><span>${s.expPool[c] || 0}</span></div>
  `).join('');
  return `
    <img class="hero-box" src="${currentIconUrl()}" />
    <p class="hero-name">${s.playerName || 'タケル'}</p>
    <p class="hero-caption">${s.bandName || 'タケルバンド'} — ${turnToDateLabel(s.turn)} / ${s.agencyStatus === 'major' ? 'メジャー' : (s.agencyStatus === 'indie' ? ((window.GameData.indieLabelDef(s.indieLabel) || {}).name || 'インディーズ所属') : '無所属')}</p>
    <div class="overall-rank-card">
      <span class="overall-rank-badge">${overallRank}</span>
      <span>総合ランク(素点 ${overallScore})</span>
    </div>
    ${debutGoalCard()}
    <p class="section-label">習得済みの特殊能力</p>
    <div style="padding:0 14px 8px;display:flex;flex-wrap:wrap;gap:6px;">
      ${(s.abilities || []).length > 0
        ? (s.abilities || []).map(a => {
            const def = StatsEngine.ABILITIES[a.key];
            const tierInfo = def ? def.tiers.find(t => t.tier === a.tier) : null;
            const label = tierInfo ? tierInfo.label : (def ? def.name : a.key);
            return `<span class="ability-chip ${abilityToneClass(def, a.tier)}">${label}</span>`;
          }).join('')
        : '<p class="empty" style="text-align:left;">まだ特殊能力を習得していません</p>'}
    </div>
    <div class="status-tabs">
      <button class="${statusTab === 'basic' ? 'tab-active' : ''}" onclick="statusTab='basic';render();">基本能力</button>
      <button class="${statusTab === 'special' ? 'tab-active' : ''}" onclick="statusTab='special';render();">特殊能力</button>
    </div>
    ${statusTab === 'basic' ? `
      <p class="section-label">現在の経験点</p>
      <div class="exp-pool-row">${expPoolHtml}</div>
      <div class="list" style="padding:0 14px;">${statRankRows(s)}</div>
    ` : `
      <div class="list" style="padding:0 14px;">${abilityRows(s)}</div>
    `}

    <div class="statgrid">
      <div class="statcard"><p class="statcard-label">所持金</p><p class="statcard-value" style="${s.money < 0 ? 'color:#E06A6A;' : ''}">${s.money < 0 ? '-' : ''}${yen(Math.abs(s.money))}</p></div>
      <div class="statcard"><p class="statcard-label">知名度</p><p class="statcard-value">${Math.round(s.fame).toLocaleString()}</p></div>
      <div class="statcard"><p class="statcard-label">フォロワー</p><p class="statcard-value">${Math.round(s.followers).toLocaleString()}</p></div>
      <div class="statcard"><p class="statcard-label">リリース枚数</p><p class="statcard-value">${releasedCount}枚</p></div>
    </div>
    ${logBox()}
  `;
}

function sectionTitle(title) {
  return `<p class="screen-title">${title}</p>`;
}

// 定期ライブ当日は、ライブ会場へ向かうまで練習・アルバイト・レコーディング・休むができない。
// 作曲だけは例外的に許可する。
function liveDayBlockedScreen(actionLabel) {
  const s = window.GameState;
  const isTakumaCollab = s.takumaEvents && s.takumaEvents.collabAnnounced;
  const message = isTakumaCollab ? '今日はたくまとの対バンの日。<br>まずは会場へ向かおう。' : '今日は定期ライブの日。<br>まずは会場へ向かおう。';
  const goAction = isTakumaCollab
    ? "dialogueState=null;friendOfferFlowState={offer:window.GameState.takumaPendingOffer,members:[]};setTab('friendlive');render();"
    : "closeDialogueAndGoTo('live');";
  return `
    <div class="header"><span>${actionLabel}</span></div>
    <p class="empty" style="margin-top:60px;">${message}</p>
    <div style="padding:8px 14px 0;"><button class="rest-btn" onclick="${goAction}">会場へ向かう</button></div>
  `;
}

// 定期ライブ・たくまとの対バンのどちらか(未消化)が控えているかどうか
function isSpecialLiveDayPending() {
  const s = window.GameState;
  return !!s.liveDayAnnounced || !!(s.takumaEvents && s.takumaEvents.collabAnnounced);
}

function statChip(label, numericValue, displayValue, cls, key, subLabel) {
  let flash = '';
  if (prevStats[key] !== null && numericValue !== prevStats[key]) {
    flash = numericValue > prevStats[key] ? ' chip-up' : ' chip-down';
  }
  const subHtml = subLabel ? `<span class="chip-sublabel">${subLabel}</span>` : '';
  return `<div class="stat-chip ${cls}${flash}"><span class="chip-label">${label}</span>${subHtml}<span class="chip-value">${displayValue}</span></div>`;
}

// ===== プレイヤーアイコン =====
// 端末にひとつ保存し、ステータス画面・HUD・タイトル・ランキングで共通して使う。
// 既定はタケルの待機絵。プリセットから選ぶか、手持ちの画像をアップロードできる。
const PROFILE_ICON_KEY = 'takeru_profile_icon';
let profileIconUrl = null;   // 起動時に読み込む(下のloadProfileIconで設定)

function iconPresets() {
  const M = window.MEMBER_CHARS || {};
  const H = window.HOME_CHAR_STATES || {};
  return [
    { key: 'takeru',        label: 'タケル',     url: H.normal },
    { key: 'takeru_happy',  label: 'タケル(笑)', url: window.TAKERU_HAPPY_IMG },
    { key: 'takeru_cold',   label: 'タケル(不調)', url: H.cold },
    { key: 'guitar',        label: 'ギター',     url: (window.RECORDING_CHARS || {}).guitar_idle },
    { key: 'vocal',         label: 'ボーカル',   url: (window.RECORDING_CHARS || {}).vocal1 },
    { key: 'kisara',        label: 'きさら',     url: M.kisara && M.kisara.idle },
    { key: 'itsuki',        label: 'いつき',     url: M.itsuki && M.itsuki.idle },
    { key: 'ryohei',        label: 'りょーぺ',   url: M.ryohei && M.ryohei.idle },
    { key: 'takuma',        label: 'たくま',     url: M.takuma && M.takuma.idle },
  ].filter(p => !!p.url);
}

// 既定アイコン(タケル待機)
function defaultIconUrl() {
  return (window.HOME_CHAR_STATES && window.HOME_CHAR_STATES.normal) || '';
}

// 今使っているアイコン。未設定なら既定を返すので、呼び出し側でフォールバックは不要。
function currentIconUrl() {
  return profileIconUrl || defaultIconUrl();
}

function loadProfileIcon() {
  try {
    const v = localStorage.getItem(PROFILE_ICON_KEY);
    profileIconUrl = v && v.trim() ? v : null;
  } catch (e) { profileIconUrl = null; }
}

function setProfileIcon(url) {
  profileIconUrl = url || null;
  try {
    if (url) localStorage.setItem(PROFILE_ICON_KEY, url);
    else localStorage.removeItem(PROFILE_ICON_KEY);
  } catch (e) { /* 保存できない環境は今回のプレイ中だけ有効 */ }
  syncFirebaseProfile();   // ランキングに出るアイコンも更新する
  render();
}

// アイコン選択ダイアログ
function showIconPicker() {
  const cur = currentIconUrl();
  const tiles = iconPresets().map(p => `
    <button class="icon-pick ${p.url === cur ? 'icon-pick-on' : ''}" onclick="setProfileIcon('${p.url}');closeModal();">
      <img src="${p.url}" loading="lazy" decoding="async" />
      <span>${p.label}</span>
    </button>`).join('');
  showModal(`
    <div class="modal-card modal-card-scroll">
      <p class="modal-title">アイコンを選ぶ</p>
      <div class="icon-pick-grid">${tiles}</div>
      <input type="file" id="profileUploadInput" accept="image/*" style="display:none;" onchange="handleProfileUpload(event)" />
      <button class="modal-primary-btn" onclick="document.getElementById('profileUploadInput').click()">画像から選ぶ</button>
      <button class="modal-close-btn" onclick="closeModal()">閉じる</button>
    </div>
  `);
}

function copyPlayerId() {
  const id = (window.GameState && window.GameState.playerId) || '';
  if (!id) return;
  const onDone = () => {
    playerIdCopied = true;
    render();
    setTimeout(() => { playerIdCopied = false; render(); }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(id).then(onDone).catch(() => copyPlayerIdFallback(id, onDone));
  } else {
    copyPlayerIdFallback(id, onDone);
  }
}

function copyPlayerIdFallback(text, onDone) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) { /* ignore */ }
  onDone();
}

// アップロードされた画像は、保存できるよう小さく作り直してから取っておく。
// 元のサイズのまま持つと数MBになり、localStorageに入りきらないため。
function handleProfileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const size = 160;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      // 中央を正方形に切り出す
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      try {
        setProfileIcon(canvas.toDataURL('image/jpeg', 0.82));
      } catch (err) {
        setProfileIcon(e.target.result);
      }
      closeModal();
    };
    img.onerror = function () { setProfileIcon(e.target.result); closeModal(); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function statusBar() {
  const s = window.GameState;
  const money = Math.round(s.money);
  const followers = Math.round(s.followers);
  const fame = Math.round(s.fame);
  const health = Math.round(s.health);

  const iconHtml = `<img src="${currentIconUrl()}" class="profile-icon" loading="lazy" decoding="async" />`;

  const moneyDisplay = money < 0 ? `-${Math.abs(money).toLocaleString()}` : money.toLocaleString();
  const moneyCls = 'chip-money' + (money < 0 ? ' chip-money-negative' : '');

  const html = `<div class="statusbar">
    <div class="statusbar-top">
      ${iconHtml}
      <p class="statusbar-date">${turnToDateLabel(s.turn)}${conditionLabel(s.condition)}</p>
    </div>
    <div class="statusbar-chips">
      ${statChip('💰', money, moneyDisplay, moneyCls, 'money')}
      ${statChip('👥', followers, followers.toLocaleString(), 'chip-followers', 'followers', 'フォロワー')}
      ${statChip('⭐', fame, fame.toLocaleString(), 'chip-fame', 'fame', '知名度')}
      ${statChip('❤️', health, health + '%', 'chip-health', 'health')}
    </div>
  </div>`;

  prevStats = { money, followers, fame, health };
  return html;
}

const SCREENS = {
  home: screenHome,
  status: screenStatus,
  job: screenJob,
  practice: screenPractice,
  song: screenSong,
  recording: screenRecording,
  live: screenLive,
  goods: screenGoods,
  friend: screenFriend,
  mailbox: screenMailbox,
  friendlive: screenFriendLive,
  ranking: screenRanking,
  rivalstatus: screenRivalStatus,
  settings: screenSettings,
  menu: screenMenu,
};

const NAV_TABS = [
  { tab: 'home', asset: 'btn_home', label: '家' },
  { tab: 'job', asset: 'btn_job', label: 'バイト' },
  { tab: 'practice', asset: 'btn_practice', label: '練習' },
  { tab: 'song', asset: 'btn_song', label: '作曲' },
  { tab: 'live', asset: 'btn_venue', label: 'ライブ' },
  { tab: 'goods', asset: 'btn_goods', label: 'グッズ' },
  { tab: 'friend', asset: 'btn_friend', label: 'フレンド' },
  { tab: 'status', asset: 'btn_character', label: 'ステータス' },
];

// 吹き出し表示中やローディング演出中は、誤操作で別画面に移れないようにする
function isNavLocked() {
  if (dialogueState) return true;
  if (jobScreenState.phase === 'working') return true;
  if (practiceScreenState.phase === 'working') return true;
  if (liveSessionState.active) return true;
  if (recordingSessionState.active) return true;
  if (promoLoadingState) return true;
  if (window.KeibaEvent && window.KeibaEvent.isBusy()) return true; // レース中
  return false;
}

function bottomNav() {
  const pendingFriendCount = (firebaseInboxRequests || []).length;
  const locked = isNavLocked();
  // メジャーデビュー後はアルバイトができなくなり、代わりに事務所の画面になる
  const major = window.GameState.agencyStatus === 'major';
  const items = NAV_TABS.map(t => (major && t.tab === 'job')
      ? { tab: 'job', asset: 'btn_character', label: '事務所' } : t).map(t => `
    <button class="nav-btn ${currentTab === t.tab ? 'nav-active' : ''}" ${locked ? 'disabled' : ''} onclick="setTab('${t.tab}')">
      <img src="${window.NAV_ICONS[t.asset]}" class="nav-icon" loading="lazy" decoding="async" />
      <span class="nav-label">${t.label}</span>
      ${t.tab === 'friend' && pendingFriendCount > 0 ? `<span class="nav-badge">${pendingFriendCount}</span>` : ''}
    </button>
  `).join('');
  return `<div class="bottom-nav" id="bottomNavBox">${items}</div>`;
}

let restInProgress = false; // 連続タップでdoRest()が二重に走ってしまうのを防ぐガード
function triggerRestCutin() {
  if (restInProgress) return;
  restInProgress = true;
  const overlay = document.getElementById('restCutinOverlay');
  if (!overlay) { finishRestWithDateWipe(); return; }
  overlay.classList.add('active');
  setTimeout(() => {
    overlay.classList.add('fade-out');
    setTimeout(() => {
      finishRestWithDateWipe();
    }, 350);
  }, 1700);
}

// 「おやすみなさい」のカットインが終わってから、日付変更アニメーションを表示してホームへ戻る。
function finishRestWithDateWipe() {
  GameActions.doRest();
  const s = window.GameState;
  const hasSpecialEvent = hasPendingSpecialEvent();
  playCompleteWipeTransition(() => {
    setTab('home');
    showStartOfDayPopupsIfAny();
    restInProgress = false;
  }, hasSpecialEvent ? false : dateWipeLabel(window.GameState.turn), !hasSpecialEvent);
}

let modalQueue = [];

function queuePopup(renderFn) {
  modalQueue.push(renderFn);
  if (modalQueue.length === 1) {
    renderFn();
  }
}

function showModal(innerHtml) {
  const root = document.getElementById('modalRoot');
  if (!root) return;
  root.innerHTML = `<div class="modal-backdrop" id="modalBackdrop">${innerHtml}</div>`;
  playSfx('notify');
  requestAnimationFrame(() => {
    const b = document.getElementById('modalBackdrop');
    if (b) b.classList.add('active');
  });
}

function closeModal() {
  const backdrop = document.getElementById('modalBackdrop');
  if (backdrop) backdrop.classList.remove('active');
  setTimeout(() => {
    const b = document.getElementById('modalBackdrop');
    if (b && b.classList.contains('active')) return; // 新しいポップアップが表示済みなら消さない
    modalQueue.shift();
    if (modalQueue.length > 0) {
      modalQueue[0]();
    } else {
      const root = document.getElementById('modalRoot');
      if (root) root.innerHTML = '';
      endEventBgmIfIdle();
    }
  }, 250);
}

// 曲の完成・定期ライブ当日といった「1日の始まり」に見せるべきポップアップを、
// 日付変更アニメーションの後に順番(曲完成が先、ライブ当日が後)で表示する。
//
// ===== イベント追加時の標準フロー(特に指定がない限り今後もこの形に合わせる) =====
//   [練習・アルバイト・レコーディング等の成果表示]
//     → タップ
//     → 暗転(文字なし。playCompleteWipeTransition(fn, false))
//     → イベント本編(showDialogueScene等を使ったシーン)
//     → イベントの成果表示(showResultDialogue)
//     → タップ
//     → 日付変更の暗転(白文字。dateWipeLabel(現在のturn), isDateChange=true)
//     → ホーム(→showStartOfDayPopupsIfAnyで次に控えている別のポップアップがあれば続けて表示)
// イベント本編は日付を追加で進めないため、最後の日付変更演出はturnをそのまま使う(+1しない)。
// 例: showDrNasakenaiScene1〜finalizeDrNasakenaiChoiceの一連の実装を参照。

// ===== エンディング =====
// 2年間の終わりは、ゲーム中の他のイベントと同じ「暗転(ワイプ)でつなぐ」文法で見せる。
//   ホーム → 暗転(文字なし) → エンディングタイトルカード(タップ)
//        → 暗転(文字なし) → 経験点の振り直し → 暗転(文字なし) → リザルト
//        → 暗転(「COMPLETE」の代わりにバンド名を金文字で表示) → タイトル画面
// 背景はライブ会場を強くぼかしたもの + 上からのスポットライトで、
// 「ライブハウスの照明が落ちた後」の空気に寄せている。
let endingFlowStarted = false;
function startEndingFlow() {
  if (endingFlowStarted) return; // 二重に入らないようにする
  endingFlowStarted = true;
  const enter = () => {
    appPhase = 'endingTitle';
    render();
    updateBGM('ending');
  };
  // showStartOfDayPopupsIfAny()経由の通常ルートでは、既に日付変更の暗転が画面を覆っている。
  // そこへ暗転を重ねると、外側の後片付け(980ms)に内側のオーバーレイまで消されて一瞬チラつくため、
  // 覆われている時は呼び出し元の暗転にそのまま乗る。覆われていない時だけ自前で1枚挟む。
  if (document.querySelector('#modalRoot .wipe-transition-overlay')) enter();
  else playCompleteWipeTransition(enter, false);
}

// エンディングの共通の下敷き(ぼかした会場背景 + スポットライト)。
// 背景は「最後にたどり着いた会場」(知名度から決まる)を使い、
// 小さなライブハウスで終わったのか武道館まで行ったのかがそのまま絵に出るようにする。
function endingVenueBg() {
  const venue = window.GameData.pickVenueForPlayer();
  return (venue && window.VENUE_BG[venue.key]) || window.VENUE_BG.small || window.HOME_BG;
}

// variant: 'stage' = タイトルカード用(背景がゆっくり動く) / 'panel' = 一覧画面用(静止・より暗い)。
// 一覧画面はボタン操作のたびにrender()で作り直されるため、背景を動かすと押すたびに
// アニメーションが頭から再生されてチラついてしまう。そちらは静止させておく。
function endingBackdropHtml(variant) {
  const bg = endingVenueBg();
  const cls = variant === 'stage' ? '' : ' ending-backdrop-static';
  return `
    <div class="ending-bg${cls}" style="background-image:url('${bg}');"></div>
    <div class="ending-spotlight${cls}"></div>
  `;
}

// ---- 1. タイトルカード(タップで進む) ----
function screenEndingTitleFull() {
  const s = window.GameState;
  return `
    <div class="ending-screen">
      ${endingBackdropHtml('stage')}
      <div class="ending-layer">
        <div class="ending-title-card" onclick="goEndingAllocate()">
          <p class="ending-kicker">2 YEARS OF</p>
          <div class="ending-rule"></div>
          <p class="ending-band-name">${s.bandName || 'タケルバンド'}</p>
          <p class="ending-title-sub">〜 2年半の軌跡 〜</p>
          <p class="ending-title-years">${window.GameData.turnToDateLabel(1)} 〜 ${window.GameData.turnToDateLabel(window.GameData.TOTAL_TURNS)}</p>
          <p class="ending-title-venue">最終到達 ${window.GameData.pickVenueForPlayer().name}</p>
        </div>
      </div>
      <p class="ending-tap-hint"><span>▼ タップして続ける</span></p>
    </div>
  `;
}

function goEndingAllocate() {
  playCompleteWipeTransition(() => {
    appPhase = 'endingAllocate';
    render();
  }, false);
}

// ---- 2. 残った経験点の振り直し ----
let endingAllocTab = 'stats';

function screenEndingAllocateFull() {
  const s = window.GameState;
  const expPoolHtml = StatsEngine.EXP_CATEGORIES.map(c => `
    <div class="exp-pool-chip"><span>${StatsEngine.EXP_CATEGORY_NAMES[c]}</span><span>${s.expPool[c] || 0}</span></div>
  `).join('');
  return `
    <div class="ending-screen">
      ${endingBackdropHtml()}
      <div class="ending-layer">
        <div class="ending-header">
          <span class="ending-header-main">2年半のサクセス、お疲れ様！</span>
          <span class="ending-header-sub">FINAL</span>
        </div>
        <!-- screen-body(フェードイン)は付けない。+1/+10を押すたびにrender()で作り直されて
             一覧全体が毎回フェードし直してしまうため。入場時は暗転が覆っているので不要。 -->
        <div class="ending-allocate-body">
          <p class="howto-intro">最後に、残った経験点でステータスと特殊能力を取れます。</p>
          <p class="ending-section-label">現在の経験点</p>
          <div class="exp-pool-row">${expPoolHtml}</div>
          <div class="status-tabs" style="margin:6px 14px 10px;">
            <button class="${endingAllocTab === 'stats' ? 'tab-active' : ''}" onclick="endingAllocTab='stats';render();">ステータス</button>
            <button class="${endingAllocTab === 'ability' ? 'tab-active' : ''}" onclick="endingAllocTab='ability';render();">特殊能力</button>
          </div>
          <div class="list" style="padding:0 14px;">${
            endingAllocTab === 'ability' ? abilityRows(s) : statRankRows(s)
          }</div>
          <div style="padding:0 14px;">
            <button class="rest-btn ending-finish-btn" onclick="goEndingSummary()">エンディングへ進む</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function goEndingSummary() {
  playCompleteWipeTransition(() => {
    appPhase = 'endingSummary';
    render();
  }, false);
}

// ---- 3. リザルト ----
// 数値はrender()後に endingSummaryIntro() でカウントアップさせるため、
// ここでは最終値をdata属性に持たせ、表示は0から始めておく。
let endingSaved = false;
function screenEndingSummaryFull() {
  const s = window.GameState;
  const overallRank = StatsEngine.getOverallRank(s);
  const overallScore = Math.round(StatsEngine.calcOverallScore(s));
  const releasedCount = (s.releases || []).filter(r => r.released).length;
  const totalUnitsSold = (s.releases || []).reduce((sum, r) => sum + (r.totalSold || 0), 0);
  const statRows = StatsEngine.STAT_ORDER.map(key => {
    const def = StatsEngine.STAT_DEFS[key];
    const val = s.stats[key] || 0;
    return `<div class="ending-stat-line">
      <span class="ending-stat-name">${def.name}</span>
      <span class="ending-stat-rank">${StatsEngine.getRank(val)}</span>
    </div>`;
  }).join('');

  if (!endingSaved) {
    endingSaved = true;
    saveCompletedRun(overallRank, overallScore, releasedCount, totalUnitsSold);
  }

  const card = (label, value, fmt) =>
    `<div class="statcard"><p class="statcard-label">${label}</p>
      <p class="statcard-value ending-count" data-to="${value}" data-fmt="${fmt}">0</p></div>`;

  return `
    <div class="ending-screen">
      ${endingBackdropHtml()}
      <div class="ending-layer">
        <div class="ending-header">
          <span class="ending-header-main">${s.bandName || 'タケルバンド'}</span>
          <span class="ending-header-sub">RESULT</span>
        </div>
        <div class="ending-summary-body">
          <div class="ending-rank-card">
            <div class="ending-rank-badge-wrap">
              <div class="ending-rank-ring"></div>
              <div class="ending-rank-badge">${overallRank}</div>
            </div>
            <div class="ending-rank-caption">
              <span class="ending-rank-label">SUCCESS RANK</span>
              <span class="ending-rank-score">サクセス総合ランク(素点 ${overallScore})</span>
            </div>
          </div>
          <div class="statgrid ending-statgrid">
            ${card('総取得金額', Math.round(s.totalEarnings || 0), 'yen')}
            ${card('総リリース枚数', releasedCount, 'cd')}
            ${card('総販売数', totalUnitsSold, 'cd')}
            ${card('知名度', Math.round(s.fame), 'num')}
          </div>
          <p class="ending-section-label">最終ステータス</p>
          <div class="ending-stat-list">${statRows}</div>
          <div class="ending-finish-wrap">
            <button class="rest-btn ending-finish-btn" onclick="finishEndingFlow()">サクセス終了</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// リザルトの数字を0からカウントアップさせる(ホームHUDと同じanimateCountUpを使う)。
// ランクバッジのポップ(0.45s〜)を見せてから始めたいので、少し遅らせて走らせる。
function endingSummaryIntro() {
  const fmts = {
    yen: v => yen(v),
    cd: v => v.toLocaleString() + '枚',
    num: v => v.toLocaleString(),
  };
  document.querySelectorAll('.ending-count').forEach((el, i) => {
    const to = Number(el.dataset.to) || 0;
    const fmt = fmts[el.dataset.fmt] || fmts.num;
    el.textContent = fmt(0);
    setTimeout(() => animateCountUp(el, 0, to, 900, fmt), 620 + i * 90);
  });
}

// サクセス完走時の記録を保存する。
// ローカル(サクセス済みのキャラ)には常に保存し、オンライン(全プレイヤー対象のランキング)には
// Firebaseが利用可能な場合のみ、既存のプレイヤープロフィール仕組みを使って反映する。
function saveCompletedRun(overallRank, overallScore, releasedCount, totalUnitsSold) {
  const s = window.GameState;
  const record = {
    playerId: s.playerId,
    playerName: s.playerName || 'タケル',
    iconUrl: currentIconUrl(),
    bandName: s.bandName || 'タケルバンド',
    overallRank, overallScore,
    agencyStatus: s.agencyStatus || 'unsigned',
    indieLabel: s.indieLabel || '',
    debutTurn: s.agencyJoinTurn || null,
    totalEarnings: Math.round(s.totalEarnings || 0),
    releasedCount, totalUnitsSold,
    bestAudience: s.bestAudience || 0,
    fame: Math.round(s.fame), followers: Math.round(s.followers),
    // 詳細表示用。5ステータスと習得した特殊能力のラベルを残しておく。
    stats: StatsEngine.STAT_ORDER.reduce((o, k) => { o[k] = Math.round(s.stats[k] || 0); return o; }, {}),
    abilities: (s.abilities || []).map(a => {
      const def = StatsEngine.ABILITIES[a.key];
      const tier = def ? def.tiers.find(t => t.tier === a.tier) : null;
      return {
        label: tier ? tier.label : (def ? def.name : a.key),
        negative: !!(def && def.negative),
        tone: abilityToneClass(def, a.tier),
      };
    }),
    completedAt: Date.now(),
  };
  try {
    const key = 'takeru_completed_runs';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(record);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
  } catch (e) { /* localStorageが使えない環境は無視 */ }

  if (window.FirebaseSvc && window.FirebaseSvc.isConfigured() && window.FirebaseSvc.isReady()) {
    window.FirebaseSvc.upsertPlayerProfile({
      playerId: s.playerId, playerName: s.playerName, bandName: s.bandName,
      fame: Math.round(s.fame), followers: Math.round(s.followers),
      money: Math.round(s.money), level: overallScore,
      releases: (s.releases || []).map(r => ({ title: r.title, totalSold: r.totalSold, released: r.released })),
    });
    // 1回のサクセスの成績を、ランキングと「所属バンド」の元データとして1件ずつ残す。
    // 返ってくるIDをローカルの記録にも控えておくと、あとで両方まとめて消せる。
    window.FirebaseSvc.saveCompletedRun(record).then(runId => {
      if (!runId) return;
      try {
        const key = 'takeru_completed_runs';
        const runs = JSON.parse(localStorage.getItem(key) || '[]');
        const mine = runs.find(r => r.completedAt === record.completedAt);
        if (mine) { mine.remoteId = runId; localStorage.setItem(key, JSON.stringify(runs)); }
      } catch (e) { /* 保存できない環境は無視 */ }
    });
    rankingData = null;    // 次回ランキング画面を開いた時に最新の状態を取り直す
    majorBandsData = null; // 事務所画面の所属バンド一覧も取り直す
  }
}

// ---- 4. タイトルへ ----
// 最後の暗転だけは文字入り(バンド名)にして、「この物語はここで幕」という区切りを付ける。
function finishEndingFlow() {
  const bandName = (window.GameState.bandName || 'タケルバンド');
  endingSaved = false;
  endingFlowStarted = false;
  playCompleteWipeTransition(() => {
    appPhase = 'title';
    render();
    updateBGM('title');
  }, bandName);
}

function showStartOfDayPopupsIfAny() {
  const s = window.GameState;
  // 2年間のサクセス期間が終了していたら、通常のホーム画面には戻らずエンディングの流れに入る。
  if (s.gameEnded) {
    startEndingFlow();
    return;
  }
  if (s.justCompletedSong) {
    const song = s.justCompletedSong;
    s.justCompletedSong = null;
    showSongPopup(song);
    return;
  }
  if (s.justDrNasakenaiEvent) {
    s.justDrNasakenaiEvent = false;
    // showStartOfDayPopupsIfAny()は必ず「既に暗転中(onMidpoint内)」から呼ばれるため、
    // ここで別の暗転を新たに重ねると、1つ目の暗転が終わった瞬間に一瞬何も覆うものが無くなり
    // 裏のホーム画面が見えてしまう。呼び出し元の暗転をそのまま使い、ここでは重ねて包まない。
    showDrNasakenaiScene1();
    return;
  }
  if (s.justTakumaEvent) {
    const key = s.justTakumaEvent;
    s.justTakumaEvent = null;
    showTakumaEventPopup(key);
    return;
  }
  if (s.justIndieLabelOffer) {
    s.justIndieLabelOffer = false;
    // ナサケナーイ博士と同じく、呼び出し元の暗転にそのまま乗る(ここで暗転を重ねない)
    showIndieLabelScene(true);
    return;
  }
  if (s.justKeibaEvent) {
    const info = s.justKeibaEvent;
    s.justKeibaEvent = null;
    showKeibaScene1(info.raceName);
    return;
  }
  if (s.justChoiceEvent) {
    const info = s.justChoiceEvent;
    s.justChoiceEvent = null;
    showChoiceEventScene(info.key);
    return;
  }
  if (s.justLiveDayArrived) {
    const info = s.justLiveDayArrived;
    // 実際にまだライブ当日である時だけ出す。
    // 何かの都合で持ち越されていた場合に、翌週になってから出てしまうのを防ぐ。
    s.justLiveDayArrived = null;
    if (s.liveDayAnnounced && s.turn >= s.nextLiveTurn) {
      showLiveDayPopup(info);
      return;
    }
  }
  if (s.justTakumaCollabDay) {
    s.justTakumaCollabDay = false;
    showTakumaCollabDayPopup();
    return;
  }
}

// ===== インディーズレーベルのオファー(ロケットミュージックエンターテイメント 堀 良音) =====
// 知名度またはフォロワーが2000を超えると、行動後の暗転に続いて発生する。
// 流れ: 導入(堀の挨拶) → レーベルを選ぶ(3択+断る) → 確認(はい/いいえ)
//       → はい: 所属した結果表示 → 日付変更の暗転でホームへ
//       → いいえ: レーベル選びに戻る
//       → 断る: 堀の返事 → 日付変更の暗転でホームへ
function indieLabelPortraits() {
  return [
    { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
    { src: window.HORI_IMG, name: '堀 良音', active: true },
  ];
}

const HORI_SPEAKER = '堀 良音(ロケットミュージックエンターテイメント)';

// withIntro: 初回は堀の挨拶から。「いいえ」で戻ってきた時は選び直しの一言だけにする。
function showIndieLabelScene(withIntro) {
  setEventBgm(true);   // イベント中はイベントBGMに切り替える
  const s = window.GameState;
  const bandName = s.bandName || 'タケルバンド';
  const text = withIntro
    ? `初めまして、ロケットミュージックエンターテイメントの堀 良音(ほり よしお)です。${bandName}のライブや音源を知って興味が湧いちゃってね。弊社管轄のインディーズレーベルからデビューしてみないかい？`
    : 'どのレーベルにするか、もう一度選んでみて。';
  const choices = window.GameData.INDIE_LABELS.map(label => ({
    label: label.name,
    sub: label.perk,
    action: `confirmIndieLabel('${label.key}')`,
  }));
  choices.push({ label: '今回は断る', action: 'declineIndieLabelUi()', cancel: true });
  showDialogueScene(indieLabelPortraits(), HORI_SPEAKER, text, dialogueChoices(choices), window.VENUE_OUTSIDE_BG);
}

function confirmIndieLabel(labelKey) {
  const label = window.GameData.indieLabelDef(labelKey);
  if (!label) return;
  showDialogueScene(
    indieLabelPortraits(), HORI_SPEAKER,
    `本当に${label.name}でいいかな？`,
    dialogueChoices([
      // ここまでに選んだレーベルを表示したままにしたいので、選択の記録は上書きしない
      { label: 'はい', action: `finalizeIndieLabel('${label.key}')`, noEcho: true },
      { label: 'いいえ', action: 'showIndieLabelScene(false)', cancel: true, noEcho: true },
    ]),
    window.VENUE_OUTSIDE_BG
  );
}

function finalizeIndieLabel(labelKey) {
  playSfx('fanfare', { minGap: 0 });
  const segments = GameActions.acceptIndieLabel(labelKey);
  showResultDialogue(
    indieLabelPortraits(), window.GameState.playerName || 'タケル',
    segments, null, window.VENUE_OUTSIDE_BG, null,
    closeToHomeAnimated // 結果を閉じたら日付変更の暗転でホームへ戻る
  );
}

function declineIndieLabelUi() {
  GameActions.declineIndieLabelOffer();
  showDialogueScene(
    indieLabelPortraits(), HORI_SPEAKER,
    'そっか、残念だな。気が変わったらいつでも声をかけてよ。',
    null, window.VENUE_OUTSIDE_BG, null,
    closeToHomeAnimated
  );
}


// ===== 選択肢つきの小イベント =====
// 発生の抽選は game.js の triggerFlavorEvent が行い、ここでは会話と選択肢だけを持つ。
// 流れは他イベントと同じで、暗転 → 会話 → 選択 → 結果表示 → 日付変更でホーム。
//
// 一枚絵は window.EVENT_IMG[キー] に入れると自動で使われる。
// まだ用意していないキーは、雰囲気の近い既存の背景で代用する。
const CHOICE_EVENT_FALLBACK_BG = {
  street:   () => window.VENUE_OUTSIDE_BG,
  gear:     () => window.STUDIO_BG.a,
  sns:      () => window.HOME_BG,
  magazine: () => window.VENUE_OUTSIDE_BG,
  parent:   () => window.HOME_BG,
  onair:    () => window.AFTERPARTY_BG,
  labelreq: () => window.LAB_BG,
};

function choiceEventBg(key) {
  const img = window.EVENT_IMG && window.EVENT_IMG[key];
  if (img) return img;
  const fb = CHOICE_EVENT_FALLBACK_BG[key];
  return (fb && fb()) || window.HOME_BG;
}

// イベント専用の一枚絵には登場人物が描き込まれているので、その場合は立ち絵を重ねない。
// 一枚絵がまだ無く既存の背景で代用しているイベントだけ、立ち絵を出す。
function hasEventImage(key) {
  return !!(window.EVENT_IMG && window.EVENT_IMG[key]);
}

function choiceEventPortraits(key) {
  if (hasEventImage(key)) return [];
  const name = window.GameState.playerName || 'タケル';
  if (key === 'labelreq') {
    return [
      { src: idlePortrait(), name, active: true },
      { src: window.HORI_IMG || heroPortrait(), name: '堀 良音', active: true },
    ];
  }
  return [{ src: idlePortrait(), name, active: true }];
}

function showChoiceEventScene(key) {
  setEventBgm(true);   // イベント中はイベントBGMに切り替える
  const s = window.GameState;
  const name = s.playerName || 'タケル';
  const bg = choiceEventBg(key);

  if (key === 'street') {
    showDialogueScene(choiceEventPortraits(key), name,
      '駅前で弾いていたら、いつのまにか人だかりができていた。もう少し続けてみる？',
      dialogueChoices([
        { label: '続ける', action: "resolveChoiceEvent('street', true)" },
        { label: '切り上げる', action: "resolveChoiceEvent('street', false)", cancel: true },
      ]), bg);
    return;
  }
  if (key === 'gear') {
    showDialogueScene(choiceEventPortraits(key), name,
      'ギターの弦が切れて、アンプの調子もおかしい。修理に出すと15,000円かかりそうだ。',
      dialogueChoices([
        { label: '直す', action: "resolveChoiceEvent('gear', true)" },
        { label: 'だましだまし使う', action: "resolveChoiceEvent('gear', false)", cancel: true },
      ]), bg);
    return;
  }
  if (key === 'sns') {
    showDialogueScene(choiceEventPortraits(key), name,
      '練習の動画が思いがけず伸びている。このまま投稿を増やして波に乗る？',
      dialogueChoices([
        { label: '乗っかって投稿を増やす', action: "resolveChoiceEvent('sns', true)" },
        { label: '自然体でいく', action: "resolveChoiceEvent('sns', false)", cancel: true },
      ]), bg);
    return;
  }
  if (key === 'magazine') {
    showDialogueScene(choiceEventPortraits(key), name,
      'インディーズ誌から取材の依頼が来た。誌面に載れば名前が広まりそうだ。',
      dialogueChoices([
        { label: '受ける', action: "resolveChoiceEvent('magazine', true)" },
        { label: '断る', action: "resolveChoiceEvent('magazine', false)", cancel: true },
      ]), bg);
    return;
  }
  if (key === 'parent') {
    showDialogueScene(choiceEventPortraits(key), name,
      '実家から電話だ。「音楽、まだ続けてるの？」',
      dialogueChoices([
        { label: '説得する', action: "resolveChoiceEvent('parent', true)" },
        { label: '曖昧にごまかす', action: "resolveChoiceEvent('parent', false)", cancel: true },
      ]), bg);
    return;
  }
  if (key === 'labelreq') {
    // 要求するジャンルはここで決め、選択肢の文面と結果で同じものを使う
    pendingLabelGenre = window.GameData.GENRES[Math.floor(Math.random() * window.GameData.GENRES.length)];
    const label = window.GameData.indieLabelDef();
    const staff = window.HORI_IMG || heroPortrait();
    showDialogueScene(
      choiceEventPortraits(key),
      `堀 良音(${label ? label.name : 'レーベル'})`,
      `次の作品なんだけどね、${pendingLabelGenre}でいってみない？12週以内に出してくれたら、うちからの後押しをもっと強くできるよ。`,
      dialogueChoices([
        { label: '応える', action: "resolveChoiceEvent('labelreq', true)" },
        { label: '断る', action: "resolveChoiceEvent('labelreq', false)", cancel: true },
      ]), bg);
    return;
  }
  // onair: 選択肢なし。結果だけ見せて終わる
  const res = GameActions.resolveCdOnAir();
  showResultDialogue(choiceEventPortraits(key), name, res.segments, null, bg, null, closeToHomeAnimated);
}

let pendingLabelGenre = null;

// 選択の結果を出して、日付変更でホームへ戻る
function resolveChoiceEvent(key, choice) {
  const s = window.GameState;
  const name = s.playerName || 'タケル';
  const bg = choiceEventBg(key);
  let out;
  if (key === 'street') out = GameActions.resolveStreetLive(choice);
  else if (key === 'gear') out = GameActions.resolveBrokenGear(choice);
  else if (key === 'sns') out = GameActions.resolveSnsBuzz(choice);
  else if (key === 'magazine') out = GameActions.resolveMagazine(choice);
  else if (key === 'parent') out = GameActions.resolveParentCall(choice);
  else out = GameActions.resolveLabelRequest(choice, pendingLabelGenre);

  const segments = Array.isArray(out) ? out : out.segments;
  // 取材は丸1週つかう。結果を読んでから日付が進むよう、閉じる直前に消化する。
  const spendWeek = !Array.isArray(out) && out.spendWeek;
  const portraits = choiceEventPortraits(key);

  showResultDialogue(portraits, name, segments, null, bg, null, () => {
    if (spendWeek) GameActions.spendExtraWeek();
    closeToHomeAnimated();
  });
}

// ===== ナサケナーイ博士イベント =====
function showDrNasakenaiScene1() {
  setEventBgm(true);   // イベント中はイベントBGMに切り替える
  showDialogueScene(
    [
      { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
      { src: window.DR_NASAKENAI_IMG, name: 'ナサケナーイ博士', active: true },
    ],
    'ナサケナーイ博士',
    'チョットスミマセーーン！ワタシ、アナタノライブミマシター！アナタ、トテモノビシロアルネー！モッタイナイネー！ダカラチョットツイテクルプリーズ！！',
    null,
    window.NIGHT_PARK_BG
  );
  // 最終ページは吹き出し全体のタップでスライド演出を開始する(▼だけの狭い当たり判定だと反応が悪く感じるため)。
  // closeDialogue()はキャラを消してからonCloseを呼ぶため、まだキャラが画面上に存在するこの仕組みを使う。
  dialogueState.onLastTap = beginDrNasakenaiSlideOut;
}

// キャラが右にスライドして画面外へ→暗転(文字なし)→研究所シーンへ
// (「▼」インジケーターのタップから直接呼ばれるので、この時点ではまだキャラ・吹き出しが画面上に存在する)
function beginDrNasakenaiSlideOut() {
  const row = document.querySelector('.dialogue-portrait-row-mini');
  if (row) row.classList.add('dr-slide-out');
  const bubble = document.querySelector('.dialogue-bubble-inline');
  if (bubble) {
    bubble.style.transition = 'opacity 0.3s ease';
    bubble.style.opacity = '0';
  }
  setTimeout(() => {
    playCompleteWipeTransition(() => {
      dialogueState = null; // スライド演出が終わってから初めて閉じる
      showDrNasakenaiScene2();
    }, false);
  }, 380);
}

function showDrNasakenaiScene2() {
  showDialogueScene(
    [
      { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
      { src: window.DR_NASAKENAI_IMG, name: 'ナサケナーイ博士', active: true },
    ],
    'ナサケナーイ博士',
    'サッソクデスガ、アナタオナヤミナンデスカー！',
    dialogueChoices([
      { label: '元気になりたい', action: "confirmDrNasakenaiChoice('genki')" },
      { label: 'もっと強くなりたい', action: "confirmDrNasakenaiChoice('strong')" },
      { label: 'お金がほしい', action: "confirmDrNasakenaiChoice('money')" },
      { label: '人気者になりたい', action: "confirmDrNasakenaiChoice('fame')" },
      { label: '何も望まない', action: "finalizeDrNasakenaiChoice('nothing')", cancel: true },
    ]),
    window.LAB_BG
  );
}

function confirmDrNasakenaiChoice(key) {
  showDialogueScene(
    [
      { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
      { src: window.DR_NASAKENAI_IMG, name: 'ナサケナーイ博士', active: true },
    ],
    'ナサケナーイ博士',
    'ホント二ホント二イイデスカー？ホショウアリマセーーン',
    dialogueChoices([
      // 「はい」はここまでの選択(願いごと)を表示したままにしたいので、選択の記録は上書きしない
      { label: 'はい', action: `finalizeDrNasakenaiChoice('${key}')`, noEcho: true },
      { label: '考えなおす', action: 'showDrNasakenaiScene2();', cancel: true, noEcho: true },
    ]),
    window.LAB_BG
  );
}

// イベント標準フロー(今後、特に指定がない限り新しいイベントもこの形に合わせる):
//   [行動の成果表示]→タップ→暗転(文字なし)→イベント本編→イベントの成果表示→タップ→日付変更の暗転(白文字)→ホーム
// イベント本編そのものは日付を追加で進めない(元の行動の時点で既に進んでいる)ため、
// 最後の日付変更演出はdateWipeLabelに現在のturnをそのまま渡す(+1しない)。
function finalizeDrNasakenaiChoice(key) {
  playDrNasakenaiBlackout(() => {
    const result = GameActions.resolveDrNasakenaiChoice(key);
    setTab('home');
    showResultDialogue(
      [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }],
      window.GameState.playerName || 'タケル',
      result.segments,
      null,
      window.HOME_BG,
      null,
      () => {
        dialogueState = null;
        playCompleteWipeTransition(() => {
          showStartOfDayPopupsIfAny();
        }, dateWipeLabel(window.GameState.turn), true);
      }
    );
  });
}

// 画面が一瞬で暗転→3秒間そのまま→ゆっくりフェードインしながらonRevealの内容を表示する
function playDrNasakenaiBlackout(onReveal) {
  const root = document.getElementById('modalRoot');
  if (!root) { onReveal(); return; }
  root.innerHTML = `<div id="drBlackout" class="dr-blackout"></div>`;
  setTimeout(() => {
    onReveal();
    const el = document.getElementById('drBlackout');
    if (el) {
      requestAnimationFrame(() => { el.classList.add('dr-blackout-fadein'); });
      setTimeout(() => { if (root.contains(el)) root.innerHTML = ''; }, 1300);
    }
  }, 3000);
}

function showSongPopup(song) {
  const expLines = Object.entries(song.appliedExp || {})
    .filter(([, v]) => v > 0)
    .map(([cat, v]) => `<p class="dialogue-line dialogue-line-plus">${StatsEngine.EXP_CATEGORY_NAMES[cat]}経験点を${v}得た</p>`)
    .join('');
  showModal(`
    <div class="modal-card" style="padding:0;overflow:hidden;">
      <img src="${window.TAKERU_HAPPY_IMG || heroPortrait()}" style="width:100%;display:block;" />
      <div class="dialogue-bubble-inline" style="position:static;">
        <p class="dialogue-line" style="color:#3AA65C;font-weight:800;">「${song.title}」が完成した</p>
        <div class="dialogue-text">
          <p class="dialogue-line">${song.genre} / 完成度${song.completion}</p>
          ${expLines}
          <p class="dialogue-line" style="margin-top:4px;">早速レコーディングする？</p>
        </div>
        ${dialogueChoices([
          { label: 'はい', action: "closeModal();setTab('recording');showStartOfDayPopupsIfAny();", noEcho: true },
          { label: 'いいえ', action: 'closeModal();showStartOfDayPopupsIfAny();', cancel: true, noEcho: true },
        ])}
      </div>
    </div>
  `);
}

function showReleasePopup(info) {
  playCompleteWipeTransition(() => {
    const segments = [
      { text: `「${info.title}」をリリースした`, type: 'money' },
      { text: `初動 ${info.totalSold.toLocaleString()}枚 / 売上 ${yen(info.sales)}`, type: 'neutral' },
      info.netVsCost >= 0
        ? { text: `制作費を上回る黒字(+${yen(info.netVsCost)})`, type: 'plus' }
        : { text: `制作費に届かず赤字(${yen(info.netVsCost)})`, type: 'minus' },
    ];
    showResultDialogue(
      [{ src: window.TAKERU_HAPPY_IMG || heroPortrait(), name: window.GameState.playerName || 'タケル', active: true }],
      window.GameState.playerName || 'タケル',
      segments,
      null,
      window.STUDIO_BG[info.studioKey] || window.HOME_BG,
      'recording',
      finalizeRecordingDayThenHome
    );
  });
}

// レコーディング(→リリース)の一連の流れの最後に呼ぶ。ここで初めて日付を進めてから帰宅する。
function finalizeRecordingDayThenHome() {
  GameActions.finalizeRecordingDay();
  const s = window.GameState;
  const hasSpecialEvent = hasPendingSpecialEvent();
  playCompleteWipeTransition(() => {
    setTab('home');
    showStartOfDayPopupsIfAny();
  }, hasSpecialEvent ? false : dateWipeLabel(window.GameState.turn), !hasSpecialEvent);
}

function showRecordingPopup(info) {
  const expLines = Object.entries(info.appliedExp || {})
    .filter(([, v]) => v > 0)
    .map(([cat, v]) => ({ text: `${StatsEngine.EXP_CATEGORY_NAMES[cat]}経験点を${v}得た`, type: 'plus' }));
  playCompleteWipeTransition(() => {
    showResultDialogue(
      [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }],
      window.GameState.playerName || 'タケル',
      [
        { text: `レコーディング完了！「${info.title}」(${info.typeName})`, type: 'neutral' },
        { text: `${info.songCount}曲収録 / ${info.studioName}`, type: 'neutral' },
        { text: `完成度${info.completionAvg}になった`, type: 'plus' },
        ...expLines,
      ],
      dialogueChoices([
        { label: 'リリース', action: `closeDialogue();GameActions.releaseCD(${info.releaseId});` },
        { label: '今はしない', action: 'dialogueState.onClose=finalizeRecordingDayThenHome;closeDialogue();', cancel: true },
      ]),
      window.STUDIO_BG[info.studioKey] || window.HOME_BG,
      'recording'
    );
  });
}

function showLiveFinishedDialogue(info) {
  const expLines = info.appliedExp
    ? StatsEngine.EXP_CATEGORIES
        .filter(c => (info.appliedExp[c] || 0) > 0)
        .map(c => ({ text: `${StatsEngine.EXP_CATEGORY_NAMES[c]}経験点を${info.appliedExp[c]}得た`, type: 'plus' }))
    : [];
  const resultSegments = [
    { text: `${info.venueName}でのライブが終わった！`, type: 'neutral' },
    ...(info.guestName ? [{ text: `${info.guestBand ? info.guestBand + 'の' : ''}${info.guestName}が対バンしてくれた！`, type: 'plus' }] : []),
    { text: `動員${info.audience.toLocaleString()}人 / 出来${info.performanceFinal}`, type: 'neutral' },
    { text: `知名度が${info.fameGain}増えた`, type: 'plus' },
    ...expLines,
    info.profit >= 0
      ? { text: `利益が${yen(info.profit)}増えた`, type: 'plus' }
      : { text: `${yen(Math.abs(info.profit))}の赤字になった`, type: 'minus' },
  ];
  // 対バンの相手がいない普通のライブは、打ち上げが無い日もある(50%)。
  // その場合はまっすぐ帰るので、少しだけ体力が戻る。
  const hasParty = !!info.guestName || Math.random() < 0.5;
  if (!hasParty) {
    const s2 = window.GameState;
    const maxHealth = s2.maxHealthMult || 100;
    const before = s2.health;
    s2.health = Math.min(maxHealth, s2.health + 10);
    const healed = Math.round(s2.health - before);
    resultSegments.push({ text: '今日は打ち上げなし。まっすぐ帰って休んだ', type: 'neutral' });
    if (healed > 0) resultSegments.push({ text: `体力が${healed}回復した`, type: 'plus' });
    showResultDialogue(
      [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }],
      window.GameState.playerName || 'タケル',
      resultSegments, null, window.VENUE_OUTSIDE_BG, 'live',
      closeToHomeAnimated
    );
    return;
  }
  // 吹き出しに収まる行数で区切る(1ページに詰め込むと文字が隠れてしまうため)
  const resultPages = segmentsToPages(resultSegments);
  const page2 = `<p class="dialogue-line">打ち上げがあるみたいだ</p><p class="dialogue-line">参加する？</p>`;
  showMultiPageDialogue(
    [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }],
    window.GameState.playerName || 'タケル',
    [...resultPages, page2],
    dialogueChoices([
      { label: 'はい', action: 'respondAfterpartyUI(true)' },
      { label: 'いいえ', action: 'respondAfterpartyUI(false)', cancel: true },
    ]),
    window.VENUE_OUTSIDE_BG,
    'live'
  );
}

function respondAfterpartyUI(join, partnerKey) {
  const s = window.GameState;
  const hasSpecialEvent = !join && hasPendingSpecialEvent();
  // 打ち上げに行く場合はまだ日付は変わらない(打ち上げ後にまとめて変わる)。
  // 行かない場合はここが最終ステップなので日付変更演出を見せる(特別なイベントが控えている時は文字なしにする)。
  const label = join ? false : (hasSpecialEvent ? false : dateWipeLabel(window.GameState.turn));
  playCompleteWipeTransition(() => {
    if (join) {
      afterpartyPartnerKey = partnerKey || null; // 対バン相手がいればそのまま打ち上げにも同席する
      GameActions.startAfterparty();
      showDrinkPrompt(true);
    } else {
      dialogueState = null;
      setTab('home');
      showStartOfDayPopupsIfAny();
    }
  }, label, !join && !hasSpecialEvent);
}

// isFirst: 「打ち上げが始まった」の導入つきかどうか(2杯目以降は「○杯目...どうする？」のみ)
function afterpartyPortraits() {
  const s = window.GameState;
  const portraits = [{ src: window.DRINK_IMAGES.d1, name: s.playerName || 'タケル', active: true }];
  const partner = afterpartyPartnerKey && window.MEMBER_CHARS && window.MEMBER_CHARS[afterpartyPartnerKey];
  if (partner) {
    const partnerName = (window.GameData.NPC_MEMBERS[afterpartyPartnerKey] || {}).name || '';
    portraits.push({ src: partner.convo, name: partnerName, active: false });
  }
  return portraits;
}

function showDrinkPrompt(isFirst) {
  const s = window.GameState;
  const drinks = (s.afterpartyState && s.afterpartyState.drinks) || 0;
  const introHtml = isFirst
    ? `<p class="dialogue-line">打ち上げが開始1時間...</p><p class="dialogue-line">飲みゲームが始まった！</p>`
    : `<p class="dialogue-line">${drinks}杯目…どうする？</p>`;
  const buttonsHtml = isFirst
    ? dialogueChoices([
        { label: '参加する', action: 'handleDrinkChoice(true)' },
        { label: '逃げる', action: 'handleDrinkFlee()', cancel: true },
      ])
    : dialogueChoices([
        { label: '飲む', action: 'handleDrinkChoice(true)' },
        { label: 'やめる', action: 'handleDrinkChoice(false)', cancel: true },
      ]);
  showMultiPageDialogue(
    afterpartyPortraits(),
    s.playerName || 'タケル',
    [introHtml],
    buttonsHtml,
    window.AFTERPARTY_BG,
    'live'
  );
}

function handleDrinkChoice(wantDrink) {
  if (!wantDrink) {
    finishAfterpartyFlow();
    return;
  }
  const s = window.GameState;
  const isFirstDrink = !((s.afterpartyState && s.afterpartyState.drinks) || 0);
  const imgEl = document.querySelector('.dialogue-portrait-mini');
  // 「参加する」を押した最初の1杯目は、いきなり飲み3を表示する
  if (imgEl) imgEl.src = isFirstDrink ? window.DRINK_IMAGES.d3 : window.DRINK_IMAGES.d2;
  setTimeout(() => {
    const result = GameActions.drinkAtAfterparty();
    if (result.done) {
      const finalImg = result.vomited ? window.DRINK_IMAGES.vomit : window.DRINK_IMAGES.d3;
      if (imgEl) imgEl.src = finalImg;
      setTimeout(() => finishAfterpartyFlow(), 500);
    } else {
      if (imgEl) imgEl.src = window.DRINK_IMAGES.d1;
      showDrinkPrompt(false);
    }
  }, 550);
}

// 飲みゲームから「逃げる」を選んだ場合。体力のみ回復し、経験点は得られない。
function handleDrinkFlee() {
  const result = GameActions.fleeAfterparty();
  const segments = [{ text: '隙を見て打ち上げから逃げ出した…', type: 'neutral' }];
  if (result.healthGain > 0) segments.push({ text: `体力が${result.healthGain}回復した`, type: 'plus' });
  result.intimacyDrops.forEach(d => segments.push({ text: `${d.name}との親密度が下がった`, type: 'minus' }));

  const finalPortraits = afterpartyPortraits();
  finalPortraits[0] = { src: window.DRINK_IMAGES.d1, name: window.GameState.playerName || 'タケル', active: true };
  showResultDialogue(
    finalPortraits,
    window.GameState.playerName || 'タケル',
    segments,
    null,
    window.AFTERPARTY_BG,
    'live',
    () => {
      afterpartyPartnerKey = null;
      GameActions.endAfterpartyAndGoHome();
      const s = window.GameState;
      const hasSpecialEvent = hasPendingSpecialEvent();
      playCompleteWipeTransition(() => {
        setTab('home');
        showStartOfDayPopupsIfAny();
      }, hasSpecialEvent ? false : dateWipeLabel(window.GameState.turn), !hasSpecialEvent);
    }
  );
}

function finishAfterpartyFlow() {
  const result = GameActions.finishAfterparty();
  const applied = result.applied || {};
  const segments = [];
  if (result.vomited) segments.push({ text: '飲みすぎて吐いてしまった…', type: 'minus' });
  segments.push({ text: `${result.drinks}杯飲んだ`, type: 'neutral' });
  Object.keys(applied).forEach(cat => {
    if (applied[cat] > 0) segments.push({ text: `${StatsEngine.EXP_CATEGORY_NAMES[cat]}経験点を${applied[cat]}得た`, type: 'plus' });
  });
  if (result.tier.health > 0) segments.push({ text: `体力が${result.tier.health}回復した`, type: 'plus' });
  else if (result.tier.health < 0) segments.push({ text: `体力が${Math.abs(result.tier.health)}下がった`, type: 'minus' });
  if (window.GameState.lastLiveHadMembers) {
    segments.push(result.tier.intimacy >= 0
      ? { text: `メンバーとの親密度が${result.tier.intimacy}上がった`, type: 'plus' }
      : { text: `メンバーとの親密度が${Math.abs(result.tier.intimacy)}下がった`, type: 'minus' });
  }
  // 対バン相手が打ち上げに同席していた場合、その相手との親密度も結果に応じて変動する(メンバーの場合と同じ扱い)
  if (afterpartyPartnerKey) {
    const partnerFriend = window.GameState.friends.find(f => f.id === afterpartyPartnerKey);
    if (partnerFriend && partnerFriend.intimacy !== undefined) {
      partnerFriend.intimacy += result.tier.intimacy;
      segments.push(result.tier.intimacy >= 0
        ? { text: `${partnerFriend.name}との親密度が${result.tier.intimacy}上がった`, type: 'plus' }
        : { text: `${partnerFriend.name}との親密度が${Math.abs(result.tier.intimacy)}下がった`, type: 'minus' });
    }
  }
  const gsAfter = window.GameState;
  if (gsAfter.afterpartyKnackGained) segments.push({ text: '打ち上げ◯のコツをつかんだ！(習得に必要な経験点が半分になった)', type: 'plus' });
  if (gsAfter.justKnack) {
    segments.push({ text: `10杯飲み切るのを${window.GameData.AFTERPARTY_KING_TIMES}回達成！金特殊能力「${gsAfter.justKnack.label}」のコツをつかんだ！`, type: 'money' });
    gsAfter.justKnack = null;
  } else if (result.drinks >= 10 && !(gsAfter.knacks || {}).afterpartyKing) {
    segments.push({ text: `10杯飲み切った(${gsAfter.tenDrinkCount}/${window.GameData.AFTERPARTY_KING_TIMES})`, type: 'plus' });
  }
  if (result.hungover) segments.push({ text: '二日酔いになってしまった…翌日は体調が優れない', type: 'minus' });

  const finalImg = result.vomited ? window.DRINK_IMAGES.vomit : (result.drinks > 0 ? window.DRINK_IMAGES.d3 : window.DRINK_IMAGES.d1);
  const finalPortraits = afterpartyPortraits();
  finalPortraits[0] = { src: finalImg, name: window.GameState.playerName || 'タケル', active: true };
  showResultDialogue(
    finalPortraits,
    window.GameState.playerName || 'タケル',
    segments,
    null,
    window.AFTERPARTY_BG,
    'live',
    () => {
      afterpartyPartnerKey = null;
      GameActions.endAfterpartyAndGoHome();
      const s = window.GameState;
      const hasSpecialEvent = hasPendingSpecialEvent();
      playCompleteWipeTransition(() => {
        setTab('home');
        showStartOfDayPopupsIfAny();
      }, hasSpecialEvent ? false : dateWipeLabel(window.GameState.turn), !hasSpecialEvent);
    }
  );
}

function showRyoheiCollabDayPopup() {
  playCompleteWipeTransition(() => {
    showDialogueScene(
      [],
      window.GameState.playerName || 'タケル',
      '今日はりょーぺのバンド アフターワークと対バンの日だ',
      dialogueChoices([{ label: '会場へ行く', action: "dialogueState=null;friendOfferFlowState={offer:window.GameState.ryoheiPendingOffer,members:[]};setTab('friendlive');advanceModalQueueOnly();", noEcho: true }])
    );
  }, false);
}

// ===== たくま(KAME)イベント =====
// showStartOfDayPopupsIfAny()経由(=既に暗転中)で呼ばれるため、ここでは別の暗転を重ねない。
function showTakumaEventPopup(key) {
  setEventBgm(true);   // イベント中はイベントBGMに切り替える
  const takumaImg = (window.MEMBER_CHARS && window.MEMBER_CHARS.takuma) ? window.MEMBER_CHARS.takuma.convo : heroPortrait();
  const playerName = window.GameState.playerName || 'タケル';

  if (key === 'TKM1') {
    showDialogueScene(
      [
        { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
        { src: takumaImg, name: 'たくま', active: true },
      ],
      'たくま',
      `お疲れー！俺も${playerName}と同じ地元でKAMEってバンドやってるねんけど、もし良かったら今度対バンしよや！`,
      null,
      window.VENUE_OUTSIDE_BG,
      null,
      () => { GameActions.resolveTakumaTkm1(); closeToHomeAnimated(); }
    );
    return;
  }
  if (key === 'TKM2') {
    showDialogueScene(
      [
        { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
        { src: takumaImg, name: 'たくま', active: true },
      ],
      'たくま',
      `俺、壁見つめることが趣味なんやけど、${playerName}はどう思う？`,
      dialogueChoices([
        { label: 'その気持ちわかる', action: "resolveTakumaTkm2Ui('agree')" },
        { label: 'は？', action: "resolveTakumaTkm2Ui('huh')", cancel: true },
      ]),
      window.VENUE_OUTSIDE_BG
    );
    return;
  }
  if (key === 'TKM3') {
    // 実際にオファーを受けた時と同じロジックで日程を仮計算し、台詞にそのまま反映する
    const s = window.GameState;
    let targetTurn = s.turn + 2;
    if (targetTurn === s.nextLiveTurn) targetTurn += 1;
    const dateLabel = turnToDateLabel(targetTurn);
    showDialogueScene(
      [
        { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
        { src: takumaImg, name: 'たくま', active: true },
      ],
      'たくま',
      `${dateLabel}にイベントやるねんけど、予定とかどう？空いてたらでてほしいなと思ってるんやけど`,
      dialogueChoices([
        { label: 'オファーを受ける', action: `resolveTakumaTkm3Ui(true,${targetTurn})` },
        { label: '断る', action: `resolveTakumaTkm3Ui(false,${targetTurn})`, cancel: true },
      ]),
      window.VENUE_OUTSIDE_BG
    );
    return;
  }
}

function resolveTakumaTkm3Ui(accept, targetTurn) {
  if (accept) {
    GameActions.acceptTakumaCollab(targetTurn);
  } else {
    GameActions.declineTakumaCollab();
  }
  const takumaImg = (window.MEMBER_CHARS && window.MEMBER_CHARS.takuma) ? window.MEMBER_CHARS.takuma.convo : heroPortrait();
  const reaction = accept ? 'ありがとう！' : 'まじか〜';
  showDialogueScene(
    [
      { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
      { src: takumaImg, name: 'たくま', active: true },
    ],
    'たくま',
    reaction,
    null,
    window.VENUE_OUTSIDE_BG,
    null,
    closeToHomeAnimated
  );
}

function resolveTakumaTkm2Ui(choiceKey) {
  GameActions.resolveTakumaTkm2(choiceKey);
  const takumaImg = (window.MEMBER_CHARS && window.MEMBER_CHARS.takuma) ? window.MEMBER_CHARS.takuma.convo : heroPortrait();
  const reaction = choiceKey === 'agree' ? 'イェーーーーーーイ' : 'は？ってなんやねん！じゃあ今度なんかいい趣味教えてや！';
  showDialogueScene(
    [
      { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
      { src: takumaImg, name: 'たくま', active: true },
    ],
    'たくま',
    reaction,
    null,
    window.VENUE_OUTSIDE_BG,
    null,
    closeToHomeAnimated
  );
}

function showTakumaCollabDayPopup() {
  showDialogueScene(
    [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }],
    window.GameState.playerName || 'タケル',
    '今日はたくまのバンド KAMEと対バンの日だ',
    dialogueChoices([{ label: '会場へ行く', action: "dialogueState=null;friendOfferFlowState={offer:window.GameState.takumaPendingOffer,members:[]};setTab('friendlive');advanceModalQueueOnly();", noEcho: true }]),
    window.HOME_BG
  );
}

// RP1(りょーぺとの初回イベント)。onCloseで次に何を表示するか指定できる。
function showRyoheiRP1Dialogue(onClose) {
  setEventBgm(true);   // イベント中はイベントBGMに切り替える
  const ryoheiImg = (window.MEMBER_CHARS && window.MEMBER_CHARS.ryohei) ? window.MEMBER_CHARS.ryohei.convo : heroPortrait();
  const segments = [
    { text: '今日のライブ良かったよ！', type: 'neutral' },
    { text: '俺もアフターワークってバンドやってて、今度よかったら対バンしよう！', type: 'neutral' },
    { text: '筋力経験点を10得た', type: 'plus' },
    { text: '技術経験点を10得た', type: 'plus' },
    { text: '知力経験点を10得た', type: 'plus' },
    { text: '精神経験点を10得た', type: 'plus' },
    { text: 'りょーぺとの親密度が7上がった', type: 'plus' },
    { text: 'りょーぺがフレンドになった！', type: 'money' },
  ];
  showResultDialogue(
    [
      { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
      { src: ryoheiImg, name: 'りょーぺ', active: true },
    ],
    'りょーぺ', segments, null, window.VENUE_OUTSIDE_BG, null, onClose
  );
}

function showRyoheiEventPopup(key) {
  setEventBgm(true);   // イベント中はイベントBGMに切り替える
  const ryoheiImg = (window.MEMBER_CHARS && window.MEMBER_CHARS.ryohei) ? window.MEMBER_CHARS.ryohei.convo : heroPortrait();

  if (key === 'RP1') {
    playCompleteWipeTransition(() => {
      showRyoheiRP1Dialogue(closeToHomeAnimated);
    }, false);
    return;
  }

  if (key === 'RP3') {
    playCompleteWipeTransition(() => {
      showDialogueScene(
        [
          { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
          { src: ryoheiImg, name: 'りょーぺ', active: true },
        ],
        'りょーぺ',
        'おい！タケル！いい加減2000円返せ！',
        dialogueChoices([
          { label: '返す', action: 'GameActions.resolveRyoheiRP3(true);closeDialogue();' },
          { label: '断る', action: 'GameActions.resolveRyoheiRP3(false);closeDialogue();', cancel: true },
        ]),
        window.VENUE_OUTSIDE_BG,
        null,
        closeToHomeAnimated
      );
    }, false);
    return;
  }

  if (key === 'RP4') {
    const segments = [
      { text: 'タケル「打ち上げ代貸してくれ！」', type: 'neutral' },
      { text: 'りょーぺ「ちゃんと返せよ！」', type: 'neutral' },
    ];
    playCompleteWipeTransition(() => {
      showResultDialogue(
        [{ src: ryoheiImg, name: 'りょーぺ', active: true }],
        'りょーぺ', segments, null, window.AFTERPARTY_BG, null, closeToHomeAnimated
      );
    }, false);
    return;
  }
}

function showLiveDayPopup(info) {
  // 日付変更アニメーションの後に呼ばれる(showStartOfDayPopupsIfAny経由)ため、ここで別途ワイプは挟まない
  // 背景は家(ホーム画面と同じHOME_BG)。キャラの立ち位置は
  // dialogueBubbleInnerHtml側でHOME_BG専用のクラス(dialogue-portrait-row-home)を使い、
  // ホーム画面本来の立ち位置に揃えている。
  showDialogueScene(
    [{ src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true }],
    window.GameState.playerName || 'タケル',
    `今日は${info.venueName}でライブの日だ！準備はできてる…よし、行こう！`,
    dialogueChoices([
      { label: '会場へ向かう', action: "closeDialogueAndGoTo('live');" },
      { label: 'あとにする', action: 'closeDialogue();', cancel: true },
    ]),
    window.HOME_BG
  );
}



function render() {
  const app = document.getElementById('app');

  if (appPhase !== 'game') {
    if (appPhase === 'title') app.innerHTML = screenTitleFull();
    else if (appPhase === 'howto') app.innerHTML = screenHowToFull();
    else if (appPhase === 'accountname') app.innerHTML = screenAccountNameFull();
    else if (appPhase === 'story') app.innerHTML = screenStoryFull();
    else if (appPhase === 'bandname') app.innerHTML = screenBandNameFull();
    else if (appPhase === 'charalog') app.innerHTML = charaProfileKey ? screenCharaProfileFull() : screenCharaLogFull();
    else if (appPhase === 'completed') app.innerHTML = screenCompletedFull();
    else if (appPhase === 'rankingtitle') app.innerHTML = screenRankingTitleFull();
    else if (appPhase === 'endingTitle') app.innerHTML = screenEndingTitleFull();
    else if (appPhase === 'endingAllocate') app.innerHTML = screenEndingAllocateFull();
    else if (appPhase === 'endingSummary') {
      app.innerHTML = screenEndingSummaryFull();
      // 数字のカウントアップはDOMを描いた後でないと掴めないので、次フレームで走らせる
      requestAnimationFrame(endingSummaryIntro);
    }
    return;
  }

  const prevScroll = document.getElementById('screenScrollBox');
  const scrollTop = prevScroll ? prevScroll.scrollTop : 0;
  const prevNav = document.getElementById('bottomNavBox');
  const navScrollLeft = prevNav ? prevNav.scrollLeft : 0;

  suppressStatusBar = false; // 各描画の最初にリセット。背景HUDのある画面は自身でtrueにする
  // 会話吹き出し表示中は、現在のタブに関わらず必ず吹き出しを描画する
  // (背景で発生したランダムイベント等でタブと吹き出しの紐付けがずれても迷子にならないように)
  const bodyHtml = dialogueState ? dialogueResultScreen() : (SCREENS[currentTab] || screenStatus)();
  const barHtml = suppressStatusBar ? '' : statusBar();
  app.innerHTML = `<div class="screen-scroll" id="screenScrollBox">${barHtml}<div class="screen-body">${bodyHtml}</div></div>${bottomNav()}`;

  const newScroll = document.getElementById('screenScrollBox');
  if (newScroll) newScroll.scrollTop = scrollTop;
  const newNav = document.getElementById('bottomNavBox');
  if (newNav) newNav.scrollLeft = navScrollLeft;

  // ホームHUDの体力ゲージを高品質にアニメーションさせる
  const healthFillEl = document.getElementById('homeHealthFill');
  if (healthFillEl) {
    const maxH = window.GameState.maxHealthMult || 100;
    const targetHealth = Math.max(0, Math.min(maxH, window.GameState.health));
    const targetPct = maxH > 0 ? Math.max(0, Math.min(100, (targetHealth / maxH) * 100)) : 0;
    requestAnimationFrame(() => {
      healthFillEl.style.width = targetPct + '%';
      healthFillEl.style.background = healthBarColor(targetHealth);
    });
    lastRenderedHealth = targetHealth;
  }

  // ホームHUDの所持金・フォロワー・知名度を高品質にカウントアニメーションさせる
  const hudMoneyEl = document.getElementById('hudMoney');
  if (hudMoneyEl) {
    const targetMoney = Math.round(window.GameState.money);
    const fromMoney = lastRenderedMoney === null ? targetMoney : lastRenderedMoney;
    animateCountUp(hudMoneyEl, fromMoney, targetMoney, 650, v => (v < 0 ? '-¥' + Math.abs(v).toLocaleString() : '¥' + v.toLocaleString()));
    lastRenderedMoney = targetMoney;
  }
  const hudFollowersEl = document.getElementById('hudFollowers');
  if (hudFollowersEl) {
    const targetFollowers = Math.round(window.GameState.followers);
    const fromFollowers = lastRenderedFollowers === null ? targetFollowers : lastRenderedFollowers;
    animateCountUp(hudFollowersEl, fromFollowers, targetFollowers, 650, v => v.toLocaleString() + '人');
    lastRenderedFollowers = targetFollowers;
  }
  const hudFameEl = document.getElementById('hudFame');
  if (hudFameEl) {
    const targetFame = Math.round(window.GameState.fame);
    const fromFame = lastRenderedFame === null ? targetFame : lastRenderedFame;
    animateCountUp(hudFameEl, fromFame, targetFame, 650);
    lastRenderedFame = targetFame;
  }

  const s = window.GameState;
  if (s.justLiveCancelled) {
    const info = s.justLiveCancelled;
    s.justLiveCancelled = null;
    queuePopup(() => showLiveCancelledPopup(info));
  }
  if (s.justNegativeAbility) {
    const got = s.justNegativeAbility;
    s.justNegativeAbility = null;
    queuePopup(() => showNegativeAbilityPopup(got));
  }
  if (s.justInsufficientFunds) {
    s.justInsufficientFunds = false;
    showInsufficientFundsToast();
  }
  if (s.justRyoheiEvent) {
    const info = s.justRyoheiEvent;
    s.justRyoheiEvent = null;
    queuePopup(() => showRyoheiEventPopup(info.key));
  }
  if (s.justRyoheiCollabDay) {
    s.justRyoheiCollabDay = false;
    queuePopup(() => showRyoheiCollabDayPopup());
  }
  if (s.justRecordedCD) {
    const info = s.justRecordedCD;
    s.justRecordedCD = null;
    queuePopup(() => showRecordingPopup(info));
  }
  if (s.justReleasedCD) {
    const info = s.justReleasedCD;
    s.justReleasedCD = null;
    queuePopup(() => showReleasePopup(info));
  }
  if (s.justFriendOffer) {
    const offer = s.justFriendOffer;
    s.justFriendOffer = null;
    queuePopup(() => showFriendOfferPopup(offer));
  }
  if (s.justFlavorEvent) {
    const ev = s.justFlavorEvent;
    s.justFlavorEvent = null;
    queuePopup(() => showFlavorEventPopup(ev));
  }
  if (s.justAgencyOffer) {
    const offer = s.justAgencyOffer;
    s.justAgencyOffer = null;
    queuePopup(() => showAgencyOfferPopup(offer));
  }

  GameActions.saveGame();

  if (appPhase === 'game') {
    const now = Date.now();
    if (now - lastProfileSyncAt > 20000) {
      lastProfileSyncAt = now;
      syncFirebaseProfile();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 初回起動ならアカウント名の入力から。2回目以降はそのままタイトルへ。
  loadProfileIcon();
  loadVolumeSettings();
  appPhase = initialAppPhase();
  preloadCriticalImages();
  render();
  updateBGM('title');
  preloadCommonImagesWhenIdle();
  // ピンチズーム・ダブルタップズームを完全に無効化(iOS Safari対策含む)
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  if (window.FirebaseSvc) {
    window.FirebaseSvc.init().then((ok) => {
      if (ok && appPhase === 'game') syncFirebaseProfile();
    });
  }
  const audioElInit = document.getElementById('bgmPlayer');
  if (audioElInit) {
    audioElInit.addEventListener('error', () => {
      const err = audioElInit.error;
      bgmStatusMsg = '読み込みエラー(コード' + (err ? err.code : '?') + ')';
      if (currentTab === 'settings') render();
    });
  }
  if (window.Sfx) window.Sfx.setMuted(bgmMuted);
  const unlockAudio = () => {
    audioUnlocked = true;
    if (window.Sfx) {
      window.Sfx.unlock();
      // iOSでも音量スライダーが効くよう、BGMをWebAudio経由に切り替える
      window.Sfx.attachBgm(document.getElementById('bgmPlayer'));
      applyVolumeSettings();
    }
    const audioEl = document.getElementById('bgmPlayer');
    if (!audioEl) return;
    audioEl.muted = bgmMuted;
    if (audioEl.paused && !bgmMuted) {
      audioEl.play().then(() => {
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('pointerdown', unlockAudio);
      }).catch(() => {});
    } else {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('pointerdown', unlockAudio);
    }
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
  document.addEventListener('pointerdown', unlockAudio);
});
