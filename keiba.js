// ===== きさらの競馬イベント =====
// 発生(5%)は game.js の checkKeibaEvent が判定し、UI側は showKeibaScene1 から入る。
//   きさらの誘い → 行く/やめておく
//     → 行く: 出馬表と馬券購入 → レース(横スクロール) → 払い戻し → 日付変更でホーム
//     → やめておく: きさらの返事 → 日付変更でホーム
//
// レースは「先に最後まで計算してから再生する」方式。着順と払い戻しが先に確定するので、
// 描画のコマ落ちやタブ切り替えで結果がブレることがない。
(function () {
  const DISTANCE = 2000;          // レース距離(m)。直線コース
  // 見かけの速さは変えずに距離だけ伸ばしたいので、WINNER_TIMEも距離に比例させている
  const WINNER_TIME = 13.8;       // 勝ち馬がゴールするまでの秒数(=レース演出の長さ)
  const SIM_DT = 1 / 30;          // 位置を記録する刻み(秒)
  const LANE_H = 29;              // 1頭ぶんのレーンの高さ(px)。8頭がコースに収まる高さにしてある
  const PX_PER_M = 1.4;           // 1mあたりの描画px。大きいほど速く見える
  const LAST_SPURT = 400;         // 残りこの距離から「最後の直線」として盛り上げる(m)
  const PAYOUT_RATE = 0.8;        // 控除率20%(単勝・複勝・馬連)
  const PAYOUT_RATE_TRIFECTA = 0.75;

  // 8頭。silkは勝負服(帽子と胴)、coatは馬体の色。
  const HORSES = [
    { no: 1, name: 'カミナリギター',   power: 79, style: 'nige',  coat: '#8A6444', silk: '#E2574C', silk2: '#FFFFFF' },
    { no: 2, name: 'ネオンサーキット', power: 84, style: 'senko', coat: '#3C3330', silk: '#3C7FD0', silk2: '#F2D648' },
    { no: 3, name: 'ヨアケノウタ',     power: 72, style: 'sashi', coat: '#B08E68', silk: '#4FAF6D', silk2: '#FFFFFF' },
    { no: 4, name: 'ハコイリムスメ',   power: 88, style: 'senko', coat: '#5E4630', silk: '#F2D648', silk2: '#2E2A28' },
    { no: 5, name: 'ドラムロール',     power: 75, style: 'oikomi',coat: '#C9B39A', silk: '#8E5BC9', silk2: '#FFFFFF' },
    { no: 6, name: 'ゲッコウソナタ',   power: 81, style: 'sashi', coat: '#4B4442', silk: '#E07C3E', silk2: '#2E2A28' },
    { no: 7, name: 'ワンマンライブ',   power: 69, style: 'nige',  coat: '#9A7350', silk: '#20B2C4', silk2: '#FFFFFF' },
    { no: 8, name: 'サイゴノサビ',     power: 77, style: 'oikomi',coat: '#6E5540', silk: '#D24E8E', silk2: '#FFFFFF' },
  ];

  const STYLE_LABEL = { nige: '逃げ', senko: '先行', sashi: '差し', oikomi: '追込' };
  const CONDITION_LABEL = ['絶不調', '不調', '平凡', '好調', '絶好調'];

  // 脚質ごとのペース配分。uは0(スタート)〜1(ゴール)で、値が大きいほどその時点で速い。
  // 逃げは前半速く終いが甘い、追込はその逆。1次式にしてあるので、
  // 「その馬がuの時点で何%進んでいるか」を積分の閉じた式で出せる。
  const PACE = {
    nige:   { a: 1.14, b: -0.30 },
    senko:  { a: 1.06, b: -0.12 },
    sashi:  { a: 0.92, b: 0.17 },
    oikomi: { a: 0.84, b: 0.33 },
  };
  // uの時点での進捗(0〜1)。ゴール(u=1)でちょうど1になる。
  function progressAt(style, u) {
    const { a, b } = PACE[style] || PACE.senko;
    const uu = Math.max(0, Math.min(1, u));
    return (a * uu + b * uu * uu / 2) / (a + b / 2);
  }

  // ---- レースを1つ組み立てる(出走表・オッズ・着順まで全部ここで確定させる) ----
  function buildRace(raceName) {
    const runners = HORSES.map(h => {
      const conditionIdx = Math.floor(Math.random() * 5);           // その日の調子
      const condition = 0.90 + conditionIdx * 0.05;                  // 0.90〜1.10
      return Object.assign({}, h, {
        conditionIdx,
        conditionLabel: CONDITION_LABEL[conditionIdx],
        styleLabel: STYLE_LABEL[h.style],
        strength: h.power * condition,
      });
    });

    const probs = winProbabilities(runners);
    runners.forEach((r, i) => { r.winProb = probs[i]; });
    const place3 = top3Probabilities(probs);
    runners.forEach((r, i) => {
      r.odds = roundOdds(PAYOUT_RATE / probs[i]);
      r.placeOdds = roundOdds(PAYOUT_RATE / place3[i]);
    });

    // 着順は先にオッズと同じ確率モデルから抽選する。
    // こうしておくと「表示しているオッズ = 実際に当たる確率」が必ず一致し、
    // 走行アニメーションの揺らぎで払い戻しの期待値がズレることがない。
    const order = drawOrder(probs);
    const sim = choreograph(runners, order);
    return { raceName, runners, order, frames: sim.frames, duration: sim.duration };
  }

  // ハーヴィル法で着順を1つ抽選する(1着を引いたら残りで2着を引く、の繰り返し)。
  function drawOrder(probs) {
    const remaining = probs.map((p, i) => ({ i, p }));
    const order = [];
    while (remaining.length > 0) {
      const total = remaining.reduce((a, r) => a + r.p, 0);
      let x = Math.random() * total;
      let pick = remaining.length - 1;
      for (let k = 0; k < remaining.length; k++) {
        x -= remaining[k].p;
        if (x <= 0) { pick = k; break; }
      }
      order.push(remaining[pick].i);
      remaining.splice(pick, 1);
    }
    return order;
  }

  // 抽選で決まった着順どおりにゴールする走行を組み立てる。
  // 各馬に「ゴールする時刻」を配り、脚質のペース配分で道中の位置を決めるので、
  // 逃げ馬が先行して差し馬が後方から追い込む、といった動きが自然に出る。
  function choreograph(runners, order) {
    const finishT = new Array(runners.length);
    const runoutMax = new Array(runners.length);
    let t = WINNER_TIME;
    order.forEach((idx, rank) => {
      // 上位ほど着差を詰める。1着と2着はハナ差〜クビ差になりやすく、
      // 下位に向かうほど離れていく。最後まで競り合って見えるようにするため。
      if (rank > 0) {
        t += rank <= 2 ? 0.05 + Math.random() * 0.14
           : rank <= 4 ? 0.12 + Math.random() * 0.28
                       : 0.20 + Math.random() * 0.42;
      }
      finishT[idx] = t;
      // ゴール後に止まる位置。上位ほど前で止まるので、静止画になっても着順が読める。
      runoutMax[idx] = (order.length - rank) * 11;
    });
    const duration = Math.max.apply(null, finishT) + 0.4;

    const frames = [];
    const phase = runners.map(() => Math.random() * Math.PI * 2);
    for (let time = 0; time <= duration; time += SIM_DT) {
      const snap = [];
      for (let i = 0; i < runners.length; i++) {
        const u = time / finishT[i];
        let pos = DISTANCE * progressAt(runners[i].style, u);
        if (u < 1) {
          // 道中の押し引き。大きめに振って順位の入れ替わりを増やすが、
          // ゴールが近づくほど小さくなるので最終的な着順は崩れない。
          const fade = Math.pow(1 - u, 1.5);
          pos += (Math.sin(time * 1.7 + phase[i]) * 16 + Math.sin(time * 0.73 + phase[i] * 1.7) * 10) * fade;
          pos = Math.max(0, Math.min(DISTANCE - 0.5, pos));
        } else {
          // ゴール後も少しだけ走り抜ける。先にゴールした馬ほど前に出るので、
          // 止まった絵になっても1着から順に並んで見える。
          // 伸ばしすぎると上位馬が画面外に出てしまうため、脚を緩める形で頭を抑えている。
          const runout = (time - finishT[i]) * (DISTANCE / finishT[i]) * 0.55;
          pos = DISTANCE + Math.min(runoutMax[i], runout);
        }
        snap.push(pos);
      }
      frames.push(snap);
    }
    return { frames, duration };
  }

  // 強さから単勝の当たる確率を出す。差が出過ぎないよう指数で寝かせている。
  function winProbabilities(runners) {
    const raw = runners.map(r => Math.pow(r.strength / 70, 5));
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map(v => v / sum);
  }

  // 3着以内に入る確率(ハーヴィル法)。馬連・三連単のオッズも同じ考え方で出す。
  function top3Probabilities(p) {
    const n = p.length;
    return p.map((pi, i) => {
      let acc = pi;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        acc += p[j] * pi / (1 - p[j]);                   // 2着
        for (let k = 0; k < n; k++) {
          if (k === i || k === j) continue;
          acc += p[j] * (p[k] / (1 - p[j])) * (pi / (1 - p[j] - p[k])); // 3着
        }
      }
      return Math.min(0.995, acc);
    });
  }

  function roundOdds(v) {
    const x = Math.max(1.1, v);
    if (x < 10) return Math.round(x * 10) / 10;
    if (x < 100) return Math.round(x);
    return Math.round(x / 10) * 10;
  }

  // ---- 馬券 ----
  // 選ぶ頭数と、当たりの判定・払い戻し倍率をまとめて持つ。
  const BET_TYPES = {
    tan:      { key: 'tan',      label: '単勝',   pick: 1, ordered: false, desc: '1着を当てる' },
    fuku:     { key: 'fuku',     label: '複勝',   pick: 1, ordered: false, desc: '3着以内に入れば的中' },
    umaren:   { key: 'umaren',   label: '馬連',   pick: 2, ordered: false, desc: '1・2着の組み合わせ(順不同)' },
    sanrentan:{ key: 'sanrentan',label: '三連単', pick: 3, ordered: true,  desc: '1・2・3着を着順どおりに' },
  };

  function betOdds(race, typeKey, picks) {
    const p = race.runners.map(r => r.winProb);
    const idx = picks.map(no => no - 1);
    if (typeKey === 'tan') return race.runners[idx[0]].odds;
    if (typeKey === 'fuku') return race.runners[idx[0]].placeOdds;
    if (typeKey === 'umaren') {
      const [a, b] = idx;
      const prob = p[a] * p[b] / (1 - p[a]) + p[b] * p[a] / (1 - p[b]);
      return roundOdds(PAYOUT_RATE / prob);
    }
    const [a, b, c] = idx;
    const prob = p[a] * (p[b] / (1 - p[a])) * (p[c] / (1 - p[a] - p[b]));
    return roundOdds(PAYOUT_RATE_TRIFECTA / prob);
  }

  function isHit(race, typeKey, picks) {
    const order = race.order.map(i => race.runners[i].no); // 1着から順の馬番
    if (typeKey === 'tan') return order[0] === picks[0];
    if (typeKey === 'fuku') return order.slice(0, 3).includes(picks[0]);
    if (typeKey === 'umaren') {
      const top2 = order.slice(0, 2);
      return picks.every(n => top2.includes(n));
    }
    return order[0] === picks[0] && order[1] === picks[1] && order[2] === picks[2];
  }

  window.KeibaCore = {
    DISTANCE, LANE_H, PX_PER_M, LAST_SPURT, BET_TYPES, STYLE_LABEL,
    buildRace, betOdds, isHit,
  };
})();

// ===== 競馬イベントのUI =====
// 画面は SCREENS.keiba として登録し、setTab('keiba') で入る(フレンドライブと同じ作り)。
(function () {
  const Core = window.KeibaCore;
  const VIEW_W = 358;             // 背景コンテナの幅(=.home-bgと同じ)
  const CAMERA_LEAD = 0.38;       // 先頭馬を画面のどのあたりに置くか

  // 画面の状態。phase: 'bet' 馬券購入 / 'racing' レース中 / 'result' 結果
  let st = null;
  let rafId = null;

  window.KeibaEvent = {
    isBusy: () => !!(st && st.phase === 'racing'),
  };

  // ---- 1. きさらの誘い ----
  function showKeibaScene1(raceName) {
    setEventBgm(true);   // 競馬もイベント扱い
    const kisara = (window.MEMBER_CHARS && window.MEMBER_CHARS.kisara) ? window.MEMBER_CHARS.kisara.convo : heroPortrait();
    showDialogueScene(
      [
        { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
        { src: kisara, name: 'きさら', active: true },
      ],
      'きさら',
      `タケルさん、今日${raceName}ですよ！わたし行きますけどどうしますか？`,
      dialogueChoices([
        { label: '行く', action: `startKeiba('${raceName}')` },
        { label: 'やめておく', action: 'declineKeiba()', cancel: true },
      ]),
      window.HOME_BG
    );
  }

  function declineKeiba() {
    const kisara = (window.MEMBER_CHARS && window.MEMBER_CHARS.kisara) ? window.MEMBER_CHARS.kisara.convo : heroPortrait();
    showDialogueScene(
      [
        { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
        { src: kisara, name: 'きさら', active: true },
      ],
      'きさら',
      'えー、そうですか。じゃあ結果だけ報告しますね！',
      null, window.HOME_BG, null, closeToHomeAnimated
    );
  }

  // ---- 2. 競馬場へ(出馬表と馬券購入) ----
  function startKeiba(raceName) {
    dialogueState = null;
    st = {
      phase: 'bet',
      race: Core.buildRace(raceName),
      betType: 'tan',
      picks: [],
      amount: 0,
      spectateOnly: false,
      frame: 0,
      startedAt: 0,
      payout: 0,
      hit: false,
    };
    setTab('keiba');
    advanceModalQueueOnly();
  }

  function setBetType(key) {
    if (!st || st.phase !== 'bet') return;
    st.betType = key;
    st.picks = [];
    render();
  }

  // 馬番をタップして選ぶ/外す。三連単だけは選んだ順(=着順)が意味を持つ。
  function togglePick(no) {
    if (!st || st.phase !== 'bet') return;
    const type = Core.BET_TYPES[st.betType];
    const at = st.picks.indexOf(no);
    if (at >= 0) { st.picks.splice(at, 1); }
    else if (st.picks.length < type.pick) { st.picks.push(no); }
    render();
  }

  function addAmount(v) {
    if (!st || st.phase !== 'bet') return;
    const limit = Math.min(window.GameData.KEIBA_BET_LIMIT, Math.floor(window.GameState.money));
    st.amount = Math.max(0, Math.min(limit, st.amount + v));
    render();
  }

  function clearAmount() { if (st) { st.amount = 0; render(); } }

  function currentOdds() {
    const type = Core.BET_TYPES[st.betType];
    if (st.picks.length !== type.pick) return null;
    return Core.betOdds(st.race, st.betType, st.picks);
  }

  function canBuy() {
    const type = Core.BET_TYPES[st.betType];
    return st.picks.length === type.pick && st.amount > 0 && window.GameState.money >= st.amount;
  }

  // ---- 3. レース ----
  function buyAndStart() {
    if (!canBuy()) return;
    if (!GameActions.placeKeibaBet(st.amount)) return;
    st.spectateOnly = false;
    beginRace();
  }

  function spectateOnly() {
    st.spectateOnly = true;
    st.amount = 0;
    beginRace();
  }

  function beginRace() {
    spurtShown = false;
    st.phase = 'racing';
    st.frame = 0;
    st.startedAt = performance.now();
    render();
    requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!st || st.phase !== 'racing') return;
    const elapsed = (now - st.startedAt) / 1000;
    const total = st.race.frames.length;
    st.frame = Math.min(total - 1, Math.floor(elapsed / (1 / 30)));
    paintRace();
    if (st.frame >= total - 1) { finishRace(); return; }
    rafId = requestAnimationFrame(tick);
  }

  function skipRace() {
    if (!st || st.phase !== 'racing') return;
    if (rafId) cancelAnimationFrame(rafId);
    st.frame = st.race.frames.length - 1;
    finishRace();
  }

  function finishRace() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    st.phase = 'result';
    if (!st.spectateOnly) {
      st.hit = Core.isHit(st.race, st.betType, st.picks);
      const odds = Core.betOdds(st.race, st.betType, st.picks);
      st.payout = st.hit ? Math.round(st.amount * odds) : 0;
      st.odds = odds;
    }
    render();
    paintRace(); // 画面を作り直したので、ゴール時点の位置を描き直す
    // 結果の音。的中なら払い戻しのコイン音、はずれなら残念な音。
    if (typeof playSfx === 'function') {
      if (st.spectateOnly) playSfx('cheer', { minGap: 0 });
      else if (st.hit) playSfx('fanfare', { minGap: 0 });
      else playSfx('fail', { minGap: 0 });
    }
  }

  // ---- 4. 結果を受け取ってホームへ ----
  function leaveKeiba() {
    const race = st.race;
    const spectate = st.spectateOnly;
    const payout = st.payout;
    const amount = st.amount;
    const label = spectate ? '' : `${Core.BET_TYPES[st.betType].label} ${st.picks.join('-')}`;
    const winner = race.runners[race.order[0]];
    st = null;
    if (!spectate) {
      GameActions.receiveKeibaPayout(payout, amount, race.raceName, label);
    } else {
      // 馬券を買っていない時も、行った記録としてログには残す
      GameActions.receiveKeibaPayout(0, 0, race.raceName, '(見るだけ)');
    }
    const kisara = (window.MEMBER_CHARS && window.MEMBER_CHARS.kisara) ? window.MEMBER_CHARS.kisara.convo : heroPortrait();
    const segments = [
      { text: `${race.raceName}は${winner.no}番 ${winner.name}が勝った！`, type: 'neutral' },
    ];
    if (!spectate) {
      segments.push(payout > 0
        ? { text: `払い戻し ${yen(payout)}を受け取った`, type: 'money' }
        : { text: `馬券ははずれ… ${yen(amount)}を失った`, type: 'minus' });
    }
    setTab('home');
    showResultDialogue(
      [
        { src: idlePortrait(), name: window.GameState.playerName || 'タケル', active: true },
        { src: kisara, name: 'きさら', active: true },
      ],
      'きさら', segments, null, window.HOME_BG, null, closeToHomeAnimated
    );
  }

  // ---- 馬の絵(SVG。画像を持たずに色だけ差し替えて8頭ぶん作る) ----
  // 右向きの横から見た姿。脚は付け根を軸にCSSで回してギャロップさせる。
  function horseSvg(h, i) {
    const dur = (0.24 + (i % 4) * 0.014).toFixed(3);  // 脚の回転。速いほど疾走感が出る
    return `
      <svg class="keiba-horse-svg" viewBox="0 0 64 44" style="--coat:${h.coat};--silk:${h.silk};--silk2:${h.silk2};--gallop:${dur}s;">
        <ellipse class="keiba-shadow" cx="30" cy="41.5" rx="16" ry="2.4"/>
        <g class="keiba-bob">
          <!-- 奥側の脚(先に描いて体の後ろに回す) -->
          <path class="keiba-leg keiba-leg-b1 keiba-leg-far" d="M17.5 26 h3.2 l-0.7 13 h-2.2 z"/>
          <path class="keiba-leg keiba-leg-f1 keiba-leg-far" d="M39.5 26 h3.2 l-0.7 13 h-2.2 z"/>
          <!-- 尾 -->
          <path class="keiba-tail" d="M17 21 C10 20 5 25 3 32 C7 28 9 27 11.5 26 C8.5 30 7.5 33 7.5 36.5 C11 31 14.5 27.5 18.5 25.5 Z"/>
          <!-- 胴 -->
          <path class="keiba-coat" d="M16 24 C16 18 22 15 30 15 C36 15 42 16 45 19 C47.5 21 47.5 26.5 45 29.5 C40 31.5 22 31.5 18 29.5 C16.2 28.4 16 26 16 24 Z"/>
          <!-- 首と頭 -->
          <path class="keiba-coat" d="M43 20 C45 13 50 8 54 6 L61 11 L58.5 15 C53.5 14 49.5 19 47.5 24 Z"/>
          <path class="keiba-coat" d="M53.6 6.2 L55 1.5 L57.4 6 Z"/>
          <path class="keiba-mane" d="M45 15 C48.5 9.5 52 6.5 55 5 L53 9.5 C50 11.5 47.5 16 46.5 18.5 Z"/>
          <!-- 騎手 -->
          <g class="keiba-jockey">
            <path class="keiba-silk" d="M26 16.5 C28 10 33 7.5 37.5 9.5 C40 11 40 15 38 17.5 L28.5 18.5 Z"/>
            <path class="keiba-silk" d="M37.5 12.5 L46.5 16.5 L45.5 19 L36.5 15.5 Z"/>
            <circle class="keiba-silk2" cx="40" cy="8" r="3.6"/>
            <path class="keiba-silk2" d="M37.6 6.6 L43.6 5.2 L43.6 8 Z"/>
          </g>
          <!-- 手前側の脚 -->
          <path class="keiba-leg keiba-leg-b2" d="M21.5 26 h3.4 l-0.8 13 h-2.2 z"/>
          <path class="keiba-leg keiba-leg-f2" d="M43 26 h3.4 l-0.8 13 h-2.2 z"/>
        </g>
      </svg>`;
  }

  // ---- 画面 ----
  function screenKeiba() {
    if (!st) return '<div class="howto-screen"><div class="howto-header"><span>競馬場</span></div></div>';
    if (st.phase === 'bet') return screenKeibaBet();
    return screenKeibaTrack();
  }

  function screenKeibaBet() {
    const s = window.GameState;
    const race = st.race;
    const type = Core.BET_TYPES[st.betType];
    const limit = Math.min(window.GameData.KEIBA_BET_LIMIT, Math.floor(s.money));
    const odds = currentOdds();

    const typeTabs = Object.keys(Core.BET_TYPES).map(k => `
      <button class="keiba-type-btn ${st.betType === k ? 'on' : ''}" onclick="KeibaEvent.setBetType('${k}')">${Core.BET_TYPES[k].label}</button>
    `).join('');

    const rows = race.runners.map(h => {
      const at = st.picks.indexOf(h.no);
      const badge = at >= 0 ? (type.ordered ? `${at + 1}着` : '選択') : '';
      return `
        <button class="keiba-row ${at >= 0 ? 'picked' : ''}" onclick="KeibaEvent.togglePick(${h.no})">
          <span class="keiba-no" style="--silk:${h.silk};">${h.no}</span>
          <span class="keiba-row-main">
            <span class="keiba-row-name">${h.name}</span>
            <span class="keiba-row-sub">${h.styleLabel} / 調子 ${h.conditionLabel}</span>
          </span>
          <span class="keiba-row-odds">${h.odds.toFixed(1)}<small>倍</small></span>
          ${badge ? `<span class="keiba-pick-badge">${badge}</span>` : ''}
        </button>`;
    }).join('');

    return `
      <div class="howto-screen">
        <div class="keiba-header">
          <span class="keiba-title">${race.raceName}</span>
          <span class="keiba-sub">芝${Core.DISTANCE}m / 8頭立て</span>
        </div>
        <div class="keiba-bet-body">
          <p class="ending-section-label">馬券の種類</p>
          <div class="keiba-type-row">${typeTabs}</div>
          <p class="keiba-hint">${type.desc}${type.ordered ? '(タップした順が着順になります)' : ''} — ${st.picks.length}/${type.pick}頭選択中</p>
          <p class="ending-section-label">出走表(オッズは単勝)</p>
          <div class="keiba-list">${rows}</div>
          <p class="ending-section-label">賭け金(上限 ${yen(window.GameData.KEIBA_BET_LIMIT)})</p>
          <div class="keiba-amount-row">
            <button class="keiba-amt-btn" onclick="KeibaEvent.addAmount(100)">+100</button>
            <button class="keiba-amt-btn" onclick="KeibaEvent.addAmount(500)">+500</button>
            <button class="keiba-amt-btn" onclick="KeibaEvent.addAmount(1000)">+1000</button>
            <button class="keiba-amt-btn" onclick="KeibaEvent.addAmount(5000)">+5000</button>
            <button class="keiba-amt-btn keiba-amt-clear" onclick="KeibaEvent.clearAmount()">クリア</button>
          </div>
          <div class="keiba-slip">
            <div class="keiba-slip-line"><span>購入金額</span><b>${yen(st.amount)}</b></div>
            <div class="keiba-slip-line"><span>オッズ</span><b>${odds === null ? '—' : odds.toFixed(1) + '倍'}</b></div>
            <div class="keiba-slip-line keiba-slip-total"><span>的中時の払い戻し</span><b>${odds === null || st.amount === 0 ? '—' : yen(Math.round(st.amount * odds))}</b></div>
            <p class="keiba-hint">所持金 ${yen(s.money)} / 今日賭けられるのは ${yen(limit)} まで<br>払い戻しの上限は ${yen(window.GameData.KEIBA_PAYOUT_LIMIT)} です</p>
          </div>
          <div style="padding:0 14px 4px;">
            <button class="rest-btn ending-finish-btn" ${canBuy() ? '' : 'disabled'} onclick="KeibaEvent.buyAndStart()">この馬券で勝負する</button>
            <button class="rest-btn" onclick="KeibaEvent.spectateOnly()">馬券は買わずに見る</button>
          </div>
        </div>
      </div>`;
  }

  function screenKeibaTrack() {
    const race = st.race;
    const lanes = race.runners.map((h, i) => `
      <div class="keiba-lane" style="top:${i * Core.LANE_H}px;">
        <div class="keiba-runner" id="keibaRunner${i}">${horseSvg(h, i)}<span class="keiba-runner-no" style="--silk:${h.silk};">${h.no}</span></div>
      </div>`).join('');

    // 進行バー。全馬の位置関係が一目で分かる。
    const dots = race.runners.map((h, i) =>
      `<span class="keiba-bar-dot" id="keibaBarDot${i}" style="--silk:${h.silk};">${h.no}</span>`
    ).join('');

    const marks = trackMarks().join('');
    const worldW = Core.DISTANCE * Core.PX_PER_M + 160;

    return `
      <div class="howto-screen">
        <div class="keiba-header">
          <span class="keiba-title">${race.raceName}</span>
          <span class="keiba-sub">芝${Core.DISTANCE}m</span>
          <span class="keiba-remain" id="keibaRemain">残り${Core.DISTANCE}m</span>
        </div>
        <div class="keiba-bar"><div class="keiba-bar-spurt"></div>${dots}</div>
        <div class="keiba-track" id="keibaTrack">
          <div class="keiba-sky"></div>
          <div class="keiba-speedlines" id="keibaSpeedLines"></div>
          <div class="keiba-world" id="keibaWorld" style="width:${worldW}px;">
            <div class="keiba-rail keiba-rail-top"></div>
            ${marks}
            <div class="keiba-goal" style="left:${Core.DISTANCE * Core.PX_PER_M}px;"><span>GOAL</span></div>
            <div class="keiba-lanes">${lanes}</div>
            <div class="keiba-rail keiba-rail-bottom" style="top:${race.runners.length * Core.LANE_H}px;"></div>
          </div>
          <div class="keiba-spurt-flash" id="keibaSpurtFlash">LAST <b>${Core.LAST_SPURT}</b>m</div>
          ${st.phase === 'racing'
            ? `<button class="keiba-skip" onclick="KeibaEvent.skipRace()">スキップ ≫</button>`
            : ''}
        </div>
        <div class="keiba-callout" id="keibaCallout"></div>
        ${st.phase === 'racing' ? '' : resultPanel()}
      </div>`;
  }

  // 200mごとのハロン棒と、最後の直線の標識
  function trackMarks() {
    const out = [];
    for (let m = 200; m < Core.DISTANCE; m += 200) {
      const remain = Core.DISTANCE - m;
      const spurt = remain === Core.LAST_SPURT;
      out.push(`<div class="keiba-mark ${spurt ? 'is-spurt' : ''}" style="left:${m * Core.PX_PER_M}px;"><span>残${remain}</span></div>`);
    }
    return out;
  }

  function resultPanel() {
    const race = st.race;
    const rows = race.order.slice(0, 3).map((idx, rank) => {
      const h = race.runners[idx];
      return `<div class="keiba-result-row"><span class="keiba-rank">${rank + 1}着</span><span class="keiba-no" style="--silk:${h.silk};">${h.no}</span><span class="keiba-row-name">${h.name}</span></div>`;
    }).join('');
    let slip = '';
    if (!st.spectateOnly) {
      slip = `
        <div class="keiba-slip ${st.hit ? 'hit' : 'miss'}">
          <div class="keiba-slip-line"><span>${Core.BET_TYPES[st.betType].label} ${st.picks.join('-')}</span><b>${st.hit ? '的中！' : 'はずれ'}</b></div>
          <div class="keiba-slip-line keiba-slip-total"><span>払い戻し</span><b>${yen(st.payout)}</b></div>
        </div>`;
    }
    return `
      <div class="keiba-result">
        ${rows}
        ${slip}
        <div style="padding:8px 14px 14px;">
          <button class="rest-btn ending-finish-btn" onclick="KeibaEvent.leaveKeiba()">競馬場をあとにする</button>
        </div>
      </div>`;
  }

  // ---- 描画(レース中は毎フレームここだけ書き換える。render()は呼ばない) ----
  let spurtShown = false;

  function paintRace() {
    const race = st.race;
    const positions = race.frames[st.frame];
    const world = document.getElementById('keibaWorld');
    if (!world) return;

    let leader = 0;
    for (let i = 1; i < positions.length; i++) if (positions[i] > positions[leader]) leader = i;

    const worldW = Core.DISTANCE * Core.PX_PER_M + 160;
    let camera = positions[leader] * Core.PX_PER_M - VIEW_W * CAMERA_LEAD;
    camera = Math.max(0, Math.min(worldW - VIEW_W, camera));
    world.style.transform = `translateX(${-camera}px)`;

    for (let i = 0; i < positions.length; i++) {
      const el = document.getElementById('keibaRunner' + i);
      if (el) el.style.transform = `translateX(${positions[i] * Core.PX_PER_M}px)`;
      const dot = document.getElementById('keibaBarDot' + i);
      if (dot) dot.style.left = Math.min(100, (positions[i] / Core.DISTANCE) * 100) + '%';
    }

    const remain = Math.max(0, Math.round(Core.DISTANCE - positions[leader]));
    const remainEl = document.getElementById('keibaRemain');
    if (remainEl) remainEl.textContent = `残り${remain}m`;

    // 最後の直線に入ったら一度だけ煽る
    const flash = document.getElementById('keibaSpurtFlash');
    if (flash && st.phase === 'racing' && !spurtShown && remain <= Core.LAST_SPURT) {
      spurtShown = true;
      if (typeof playSfx === 'function') playSfx('cheer', { minGap: 0 }); // 最後の直線で歓声
      flash.classList.add('on');
    }

    // 速度線。先頭が速いほど濃く出して、スピード感を足す
    const lines = document.getElementById('keibaSpeedLines');
    if (lines) {
      const prev = st.frame > 0 ? race.frames[st.frame - 1][leader] : positions[leader];
      const speed = (positions[leader] - prev) / (1 / 30);  // m/s
      lines.style.opacity = st.phase === 'racing' ? Math.max(0, Math.min(0.5, (speed - 100) / 160)).toFixed(2) : 0;
    }

    const callout = document.getElementById('keibaCallout');
    if (callout) {
      if (st.phase === 'result') {
        // ゴール後は位置で並べ替えると同着扱いになってしまうので、確定した着順を出す
        callout.innerHTML = `<span class="keiba-remain">確定</span>` +
          race.order.slice(0, 3).map((idx, k) =>
            `<span class="keiba-call-item"><b>${k + 1}</b>${race.runners[idx].no} ${race.runners[idx].name}</span>`).join('');
      } else {
        const top = positions.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p).slice(0, 3);
        callout.innerHTML = top.map((o, k) =>
          `<span class="keiba-call-item"><b>${k + 1}</b>${race.runners[o.i].no} ${race.runners[o.i].name}</span>`).join('');
      }
    }
  }

  // 外から使うもの
  Object.assign(window.KeibaEvent, {
    showKeibaScene1, startKeiba, declineKeiba,
    setBetType, togglePick, addAmount, clearAmount,
    buyAndStart, spectateOnly, skipRace, leaveKeiba,
    screenKeiba,
  });
  // 吹き出しのボタンから直接呼べるように、よく使うものはグローバルにも出しておく
  window.showKeibaScene1 = showKeibaScene1;
  window.startKeiba = startKeiba;
  window.declineKeiba = declineKeiba;
  SCREENS.keiba = screenKeiba;
})();
