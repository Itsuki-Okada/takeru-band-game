// ===== 選択肢のあるイベントのプレビュー(開発用) =====
// index.html?event=1 で開くと、下に一覧が出て、選択肢のあるイベントをその場で再生できる。
// 条件が揃うまで待たなくても、吹き出し・コマンドウィンドウ・分岐の見え方を何度でも確認できる。
// ?event=dr のようにキーを指定すると、そのイベントを直接開く。
//
// パラメータが無い通常起動では何もしない。
// リリース時は、このファイルと index.html の <script src="event-preview.js"></script> の
// 1行を消せば完全に取り除ける(ゲーム本体のコードには一切手を入れていない)。

(function () {
  const params = new URLSearchParams(location.search);
  if (!params.has('event')) return;

  // 各イベントは「共通の下ごしらえ(setup) → 再生(play)」の形で登録する。
  // choices はプレビュー一覧に出すための説明で、実際の選択肢はゲーム本体側が持っている。
  const EVENTS = [
    {
      key: 'liveday', label: 'ライブ当日', choices: '会場へ向かう / あとにする',
      play: () => showLiveDayPopup({ venueName: '中規模ライブハウス' }),
    },
    {
      key: 'dr', label: 'ナサケナーイ博士', choices: '願いごと5択 → はい / 考えなおす',
      play: () => showDrNasakenaiScene1(),
    },
    {
      key: 'ryohei_offer', label: 'りょーぺのオファー', choices: '出演する / 見送る',
      play: () => showFriendOfferPopup({
        friendId: 'ryohei', friendName: 'りょーぺ', bandName: 'リョウヘイズ',
        friendFame: 3000, friendFollowers: 5000, venueKey: 'mid', gala: 30000,
      }),
    },
    {
      key: 'takuma_offer', label: 'たくまのオファー', choices: '出演する / 見送る',
      play: () => showFriendOfferPopup({
        friendId: 'takuma', friendName: 'たくま', bandName: 'KAME',
        friendFame: 2500, friendFollowers: 4200, venueKey: 'mid', gala: 25000,
      }),
    },
    {
      key: 'tkm2', label: 'たくま(壁の話)', choices: 'その気持ちわかる / は？',
      play: () => showTakumaEventPopup('TKM2'),
    },
    {
      key: 'tkm3', label: 'たくまの対バン打診', choices: 'オファーを受ける / 断る',
      play: () => showTakumaEventPopup('TKM3'),
    },
    {
      key: 'street', label: '路上ライブ', choices: '続ける / 切り上げる',
      play: () => showChoiceEventScene('street'),
    },
    {
      key: 'gear', label: '楽器が壊れた', choices: '直す / だましだまし使う',
      play: () => showChoiceEventScene('gear'),
    },
    {
      key: 'sns', label: 'SNSがバズる', choices: '乗っかる / 自然体',
      setup: () => { window.GameState.followers = 3200; },
      play: () => showChoiceEventScene('sns'),
    },
    {
      key: 'magazine', label: '雑誌の取材', choices: '受ける / 断る(受けると1週消費)',
      play: () => showChoiceEventScene('magazine'),
    },
    {
      key: 'parent', label: '親から電話', choices: '説得する / ごまかす',
      play: () => showChoiceEventScene('parent'),
    },
    {
      key: 'onair', label: 'CDが有線で流れる', choices: '選択肢なし',
      setup: () => {
        window.GameState.releases = [{
          id: 1, title: 'ネオンの夜', type: 'ep', typeName: 'EP', songCount: 5, genres: ['ロック'],
          completionAvg: 84, price: 1800, released: true, totalSold: 4200, salesActive: false, weeksElapsed: 4,
        }];
      },
      play: () => showChoiceEventScene('onair'),
    },
    {
      key: 'labelreq', label: 'レーベルからの要求', choices: '応える / 断る',
      setup: () => { const s = window.GameState; s.agencyStatus = 'indie'; s.indieLabel = 'orion'; s.labelRequest = null; s.labelRequestDone = false; },
      play: () => showChoiceEventScene('labelreq'),
    },
    {
      key: 'keiba', label: 'きさらの競馬', choices: '行く / やめておく → 馬券購入 → レース',
      setup: () => { window.GameState.money = 500000; },
      play: () => showKeibaScene1('ロケット記念'),
    },
    {
      key: 'indie', label: 'インディーズレーベル', choices: 'レーベル3択+断る → はい/いいえ',
      setup: () => { window.GameState.fame = 2400; },
      play: () => showIndieLabelScene(true),
    },
    {
      key: 'rp1', label: 'りょーぺ(初対面)', choices: '選択肢なし(タップのみ)',
      play: () => showRyoheiEventPopup('RP1'),
    },
    {
      key: 'rp3', label: 'りょーぺ(2000円)', choices: '返す / 断る',
      play: () => showRyoheiEventPopup('RP3'),
    },
    {
      key: 'livefin', label: 'ライブ終了→打ち上げ', choices: 'はい / いいえ',
      play: () => showLiveFinishedDialogue({
        venueName: '中規模ライブハウス', audience: 284, performanceFinal: 78,
        fameGain: 420, profit: 94572,
      }),
    },
    {
      key: 'collabfin', label: '対バン終了→打ち上げ', choices: 'はい / いいえ',
      setup: () => { afterpartyPartnerKey = 'takuma'; },
      play: () => showCollabLiveFinishedDialogue({
        friendId: 'takuma', friendName: 'たくま', bandName: 'KAME',
        venueName: '中規模ライブハウス', audience: 312, fameGain: 380, gala: 25000,
      }),
    },
    {
      key: 'drink', label: '打ち上げの飲みゲーム', choices: '参加する / 逃げる',
      setup: () => { afterpartyPartnerKey = 'takuma'; GameActions.startAfterparty(); },
      play: () => showDrinkPrompt(true),
    },
    {
      key: 'song', label: '曲が完成', choices: 'はい / いいえ(モーダル)',
      play: () => showSongPopup({
        title: '真夜中のロータリー', genre: 'ロック', completion: 82,
        appliedExp: { int: 12, ski: 8 },
      }),
    },
    {
      key: 'recording', label: 'レコーディング完了', choices: 'リリース / 今はしない',
      setup: () => {
        // 「リリース」を押した時に本物と同じ処理が走るよう、対応するリリース待ちのCDを用意しておく
        const s = window.GameState;
        s.releases = [{
          id: 1, title: 'ネオンの夜', type: 'ep', typeName: 'EP', songCount: 5,
          completionAvg: 84, price: 1800, released: false, totalSold: 0,
        }];
      },
      play: () => showRecordingPopup({
        releaseId: 1, title: 'ネオンの夜', typeName: 'EP', songCount: 5,
        studioName: '中規模スタジオ', studioKey: 'b', completionAvg: 84,
        appliedExp: { ski: 10, int: 6 },
      }),
    },
  ];

  // どのイベントも「ある程度活動が進んだ状態」から見たいので、共通でこのくらいの数値にしておく。
  function resetBaseState() {
    GameActions.startNewGameWithNames('タケル', 'ネオン・サーキット');
    const s = window.GameState;
    s.turn = 40;
    s.fame = 6800;
    s.followers = 12400;
    s.money = 480000;
    s.health = 100;
    s.stats = { vocal: 74, play: 81, compose: 66, performance: 62, mental: 58 };
    s.mailbox = []; // 新規ゲームのお小遣いメールはイベントの確認に関係ないので消しておく
    dialogueState = null;
    // closeModal()は250ms後に#modalRootを空にするため、直後に出したポップアップや
    // 暗転オーバーレイまで消してしまう。ここでは同期的に片付ける。
    modalQueue.length = 0;
    const modalRoot = document.getElementById('modalRoot');
    if (modalRoot) modalRoot.innerHTML = '';
    appPhase = 'game';
    setTab('home');
  }

  function play(key) {
    const ev = EVENTS.find(e => e.key === key) || EVENTS[0];
    resetBaseState();
    if (ev.setup) ev.setup();
    ev.play();
    const bar = document.getElementById('eventPreviewBar');
    if (bar) {
      bar.dataset.current = ev.key;
      bar.querySelectorAll('button[data-k]').forEach(b => b.classList.toggle('epb-on', b.dataset.k === ev.key));
      const note = bar.querySelector('.epb-note');
      if (note) note.textContent = `${ev.label} — ${ev.choices}`;
    }
  }

  function buildToolbar(current) {
    const bar = document.createElement('div');
    bar.id = 'eventPreviewBar';
    bar.innerHTML = `
      <div class="epb-head">
        <span class="epb-title">EVENT PREVIEW</span>
        <span class="epb-note"></span>
      </div>
      <div class="epb-grid">
        ${EVENTS.map(e => `<button data-k="${e.key}" title="${e.choices}">${e.label}</button>`).join('')}
      </div>
      <button class="epb-replay" data-k="__replay">選んだイベントをもう一度</button>
    `;
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      play(btn.dataset.k === '__replay' ? (bar.dataset.current || EVENTS[0].key) : btn.dataset.k);
    });
    document.body.appendChild(bar);

    const style = document.createElement('style');
    style.textContent = `
      #eventPreviewBar {
        position: fixed; left: 50%; bottom: 10px; transform: translateX(-50%);
        width: min(92vw, 460px); padding: 8px 10px 10px; z-index: 999;
        background: rgba(20,20,26,0.95); border: 1px solid #37373F; border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
      }
      #eventPreviewBar .epb-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 7px; }
      #eventPreviewBar .epb-title { font-size: 9px; letter-spacing: 0.18em; color: #C7B98A; flex-shrink: 0; }
      #eventPreviewBar .epb-note { font-size: 10px; color: #8A8A94; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #eventPreviewBar .epb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
      #eventPreviewBar button {
        font-size: 10.5px; padding: 6px 4px; border-radius: 7px; cursor: pointer;
        background: #24242D; border: 1px solid #37373F; color: #EDEDED;
        font-family: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #eventPreviewBar button.epb-on { background: #C9971F; border-color: #E8C468; color: #1B1508; font-weight: 700; }
      #eventPreviewBar .epb-replay { width: 100%; margin-top: 6px; color: #C7B98A; }
    `;
    document.head.appendChild(style);
    bar.dataset.current = current;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const asked = params.get('event');
    const start = EVENTS.some(e => e.key === asked) ? asked : EVENTS[0].key;
    // ui.js側の初期化(タイトル画面の描画)が終わってから差し込む
    setTimeout(() => {
      buildToolbar(start);
      play(start);
    }, 0);
  });
})();
