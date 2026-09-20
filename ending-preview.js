// ===== エンディングのプレビュー(開発用) =====
// index.html?ending=1 で開くと、サンプルのプレイ結果を流し込んでエンディングだけを再生する。
// 2年分プレイしなくても、暗転〜タイトルカード〜振り直し〜リザルトの流れを何度でも確認できる。
// パラメータが無い通常起動では何もしない。
//
// リリース時は、このファイルと index.html の <script src="ending-preview.js"></script> の
// 1行を消せば完全に取り除ける(ゲーム本体のコードには一切手を入れていない)。

(function () {
  const params = new URLSearchParams(location.search);
  if (!params.has('ending')) return;

  // 到達した会場は知名度(fame)から決まるため、プリセットごとに背景も変わる。
  const PRESETS = {
    low: {
      label: '伸び悩み(小規模ライブハウス)',
      bandName: 'タケルバンド',
      fame: 120, followers: 90, money: 32000, totalEarnings: 48000,
      stats: { vocal: 31, play: 44, compose: 18, performance: 25, mental: 52 },
      expPool: { str: 12, ski: 4, int: 0, men: 7 },
      abilities: [],
      releases: [],
    },
    mid: {
      label: '中堅(Zepp風会場)',
      bandName: 'ネオン・サーキット',
      fame: 6800, followers: 12400, money: 480000, totalEarnings: 2260000,
      stats: { vocal: 74, play: 81, compose: 66, performance: 62, mental: 58 },
      expPool: { str: 90, ski: 120, int: 70, men: 40 },
      abilities: [{ key: 'onkan', tier: 'normal' }],
      releases: [
        { title: '始発待ち', released: true, totalSold: 4800 },
        { title: 'ネオンの夜', released: true, totalSold: 11200 },
      ],
    },
    high: {
      label: '大成功(武道館)',
      bandName: 'ネオン・サーキット',
      fame: 62000, followers: 184000, money: 7400000, totalEarnings: 24800000,
      stats: { vocal: 108, play: 115, compose: 96, performance: 102, mental: 88 },
      expPool: { str: 240, ski: 310, int: 180, men: 150 },
      abilities: [{ key: 'onkan', tier: 'gold' }, { key: 'rhythm', tier: 'normal' }],
      releases: [
        { title: '始発待ち', released: true, totalSold: 42000 },
        { title: 'ネオンの夜', released: true, totalSold: 96500 },
        { title: 'サーキット', released: true, totalSold: 214800 },
        { title: '真夜中のロータリー', released: true, totalSold: 88300 },
        { title: 'LAST SONG', released: true, totalSold: 301500 },
      ],
    },
  };

  function seed(presetKey) {
    const p = PRESETS[presetKey] || PRESETS.mid;
    GameActions.startNewGameWithNames('タケル', p.bandName);
    const s = window.GameState;
    s.turn = window.GameData.TOTAL_TURNS;
    s.gameEnded = true;
    s.fame = p.fame;
    s.followers = p.followers;
    s.money = p.money;
    s.totalEarnings = p.totalEarnings;
    s.stats = Object.assign({}, p.stats);
    s.expPool = Object.assign({}, p.expPool);
    s.abilities = p.abilities.map(a => Object.assign({}, a));
    s.releases = p.releases.map(r => Object.assign({}, r));
    s.mailbox = []; // 新規ゲームのお小遣いメールはエンディングに関係ないので消しておく
  }

  // プレビューでサクセス記録を書き足してしまうと「サクセス済みのキャラ」が汚れるため、
  // 保存だけ無効化する(リザルト画面の見た目は本番とまったく同じ)。
  function disableSaving() {
    if (window.__endingPreviewSaveDisabled) return;
    window.__endingPreviewSaveDisabled = true;
    window.saveCompletedRun = function () { /* プレビュー中は記録しない */ };
  }

  function play(presetKey) {
    disableSaving();
    seed(presetKey);
    endingFlowStarted = false;
    endingSaved = false;
    appPhase = 'game';
    startEndingFlow();
  }

  function buildToolbar(current) {
    const bar = document.createElement('div');
    bar.id = 'endingPreviewBar';
    bar.innerHTML = `
      <span class="epb-title">ENDING PREVIEW</span>
      ${Object.keys(PRESETS).map(k =>
        `<button data-k="${k}" class="${k === current ? 'epb-on' : ''}">${PRESETS[k].label}</button>`
      ).join('')}
      <button data-k="__replay" class="epb-replay">最初から再生</button>
    `;
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const k = btn.dataset.k === '__replay' ? (bar.dataset.current || 'mid') : btn.dataset.k;
      bar.dataset.current = k;
      bar.querySelectorAll('button[data-k]').forEach(b => b.classList.toggle('epb-on', b.dataset.k === k));
      play(k);
    });
    bar.dataset.current = current;
    document.body.appendChild(bar);

    const style = document.createElement('style');
    style.textContent = `
      #endingPreviewBar {
        position: fixed; left: 50%; bottom: 12px; transform: translateX(-50%);
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center;
        max-width: 92vw; padding: 8px 10px; z-index: 999;
        background: rgba(20,20,26,0.94); border: 1px solid #37373F; border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
      }
      #endingPreviewBar .epb-title { font-size: 9px; letter-spacing: 0.18em; color: #C7B98A; margin-right: 4px; }
      #endingPreviewBar button {
        font-size: 11px; padding: 6px 10px; border-radius: 8px; cursor: pointer;
        background: #24242D; border: 1px solid #37373F; color: #EDEDED;
        font-family: inherit;
      }
      #endingPreviewBar button.epb-on { background: #C9971F; border-color: #E8C468; color: #1B1508; font-weight: 700; }
      #endingPreviewBar .epb-replay { color: #C7B98A; }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const preset = PRESETS[params.get('rank')] ? params.get('rank') : 'mid';
    // ui.js側の初期化(タイトル画面の描画)が終わってから差し込む
    setTimeout(() => {
      buildToolbar(preset);
      play(preset);
    }, 0);
  });
})();
