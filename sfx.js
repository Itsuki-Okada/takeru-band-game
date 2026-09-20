// ===== 効果音 =====
// 音声ファイルを持たず、WebAudioでその場で合成する。
// ファミコン風の短い音にしてあるので、ドット絵の画面とケンカしない。
// 使い方: Sfx.play('tap') / Sfx.play('gain') など。
// ミュートはBGMの設定と共有していて、ui.js の bgmMuted から setMuted() で伝える。
(function () {
  let ctx = null;
  let master = null;
  let muted = false;
  let lastPlayedAt = {};   // 同じ音が一瞬に重なって割れるのを防ぐ

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.60;   // 効果音のピークがBGMより約10dB上に出る音量(ui.jsのBGM_VOLUMEと対)
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  // 1音ぶんの発振。t0からdurだけ鳴らし、freqは[開始, 終了]で指定するとスライドする。
  function tone(t0, dur, freq, type, vol, slideTo) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    // クリックノイズが出ないよう、頭と終わりを短くフェードさせる
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // ノイズ系(ドラムっぽい音)。バズや失敗の演出に使う。
  function noise(t0, dur, vol, hp) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = hp || 800;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0);
  }

  // 音色の定義。tはctx.currentTimeからの相対秒。
  const VOICES = {
    // --- 操作音 ---
    tap:     t => { tone(t, 0.055, 880, 'square', 0.30, 660); },                       // 一般的なボタン
    select:  t => { tone(t, 0.045, 660, 'square', 0.28); tone(t + 0.05, 0.08, 988, 'square', 0.28); }, // 選択肢の決定
    cancel:  t => { tone(t, 0.05, 420, 'square', 0.26); tone(t + 0.05, 0.09, 280, 'square', 0.26); },  // 戻る・断る
    page:    t => { tone(t, 0.030, 1320, 'triangle', 0.18); },                         // 吹き出しの送り(連打するので控えめ)
    nav:     t => { tone(t, 0.04, 740, 'triangle', 0.26, 880); },                      // タブ切り替え
    open:    t => { tone(t, 0.05, 520, 'triangle', 0.24); tone(t + 0.045, 0.07, 780, 'triangle', 0.24); }, // 画面・モーダルを開く
    deny:    t => { tone(t, 0.10, 200, 'square', 0.30); tone(t + 0.10, 0.14, 150, 'square', 0.30); },  // お金が足りない等

    // --- 結果音 ---
    gain:    t => { [784, 988, 1319].forEach((f, i) => tone(t + i * 0.055, 0.10, f, 'square', 0.26)); },      // 経験点・知名度・フォロワー増
    loss:    t => { [523, 415, 311].forEach((f, i) => tone(t + i * 0.06, 0.12, f, 'sawtooth', 0.26)); },      // 減少
    coin:    t => { tone(t, 0.06, 988, 'square', 0.28); tone(t + 0.06, 0.22, 1319, 'square', 0.26); },        // お金が増えた
    spend:   t => { tone(t, 0.07, 660, 'triangle', 0.28); tone(t + 0.07, 0.16, 440, 'triangle', 0.26); },     // お金を使った
    fanfare: t => { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, 0.14, f, 'square', 0.28));
                    tone(t + 0.36, 0.42, 1047, 'square', 0.26); },                                            // デビュー・大成功
    levelup: t => { [659, 880, 1109, 1319].forEach((f, i) => tone(t + i * 0.05, 0.10, f, 'triangle', 0.26)); },// ステータスアップ
    fail:    t => { tone(t, 0.18, 330, 'sawtooth', 0.26, 110); noise(t, 0.20, 0.10, 500); },                   // 失敗・炎上
    cheer:   t => { noise(t, 0.45, 0.14, 1200); [784, 988].forEach((f, i) => tone(t + i * 0.07, 0.12, f, 'square', 0.20)); }, // 歓声っぽい音

    // --- 既存コードから呼ばれているキー ---
    complete: t => { [659, 880, 1047].forEach((f, i) => tone(t + i * 0.07, 0.13, f, 'square', 0.26));
                     tone(t + 0.21, 0.26, 1319, 'square', 0.24); },                                    // 行動の完了(ライブ・練習・作曲など)
    notify:   t => { tone(t, 0.07, 880, 'triangle', 0.26); tone(t + 0.09, 0.14, 1175, 'triangle', 0.24); }, // お知らせ・場面転換
  };

  function play(key, opts) {
    if (muted) return;
    const voice = VOICES[key];
    if (!voice) return;
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    // 同じ音の連打は間引く(一覧を素早く操作した時に音が濁らないように)
    const now = performance.now();
    const gap = (opts && opts.minGap) != null ? opts.minGap : 40;
    if (lastPlayedAt[key] && now - lastPlayedAt[key] < gap) return;
    lastPlayedAt[key] = now;
    try { voice(ctx.currentTime + 0.001); } catch (e) { /* ignore */ }
  }

  const MASTER_VOLUME = 0.60;   // 効果音全体の音量(ui.jsのBGM_VOLUMEと対で調整する)

  window.Sfx = {
    play,
    setMuted(v) { muted = !!v; },
    isMuted() { return muted; },
    unlock() { if (ensureCtx() && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    // 効果音だけの音量を変えたい時に使う(設定画面から呼べるようにしてある)
    setVolume(v) { if (ensureCtx()) master.gain.value = Math.max(0, Math.min(1, v)); },
    getVolume() { return master ? master.gain.value : MASTER_VOLUME; },
    // 出力にアナライザーを挟んで返す。音量の確認やVUメーターを作りたい時用。
    tapOutput() {
      if (!ensureCtx()) return null;
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      master.connect(an);
      return an;
    },
    keys: Object.keys(VOICES),
  };
})();
