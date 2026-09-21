// ===== Firebase連携サービス =====
// このファイルは window.FirebaseSvc として各種機能を公開します。
// index.html の window.firebaseConfig が正しく設定されていない場合、
// オンライン機能は自動的に無効化され、これまで通りローカル(ダミー)動作にフォールバックします。

(function () {
  let app = null;
  let auth = null;
  let db = null;
  let currentUser = null;
  let ready = false;
  let initPromise = null;
  let lastStatus = '未接続';

  function isConfigured() {
    const c = window.firebaseConfig;
    return !!(c && c.apiKey && c.apiKey !== 'YOUR_API_KEY');
  }

  function getStatus() {
    return lastStatus;
  }

  function waitForSdk(retriesLeft) {
    return new Promise((resolve) => {
      const check = (n) => {
        if (typeof firebase !== 'undefined') { resolve(true); return; }
        if (n <= 0) { resolve(false); return; }
        setTimeout(() => check(n - 1), 300);
      };
      check(retriesLeft);
    });
  }

  function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!isConfigured()) {
        lastStatus = 'firebaseConfig未設定です(index.htmlを確認してください)';
        console.warn('[FirebaseSvc] ' + lastStatus);
        return false;
      }
      const sdkLoaded = await waitForSdk(10); // 最大3秒ほど読み込みを待つ
      if (!sdkLoaded) {
        lastStatus = 'Firebase SDKの読み込みに失敗しました(通信環境をご確認ください)';
        console.warn('[FirebaseSvc] ' + lastStatus);
        return false;
      }
      try {
        app = firebase.initializeApp(window.firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        await auth.signInAnonymously();
        return await new Promise((resolve) => {
          auth.onAuthStateChanged((user) => {
            if (user) {
              currentUser = user;
              ready = true;
              lastStatus = '接続済み';
              resolve(true);
            }
          });
        });
      } catch (err) {
        lastStatus = '初期化に失敗しました: ' + (err && err.message ? err.message : String(err));
        console.warn('[FirebaseSvc] ' + lastStatus);
        return false;
      }
    })();
    return initPromise;
  }

  function isReady() {
    return ready;
  }

  // 自分のプレイヤー情報をFirestoreに公開プロフィールとして保存(検索・ランキング対象になる)
  async function upsertPlayerProfile({ playerId, playerName, bandName, iconUrl, fame, followers, level, skills, releases, money }) {
    if (!ready) return false;
    try {
      const releasedOnly = (releases || []).filter(r => r.released !== false);
      const best = releasedOnly.reduce((a, r) => (!a || r.totalSold > a.totalSold) ? r : a, null);
      await db.collection('players').doc(currentUser.uid).set({
        playerId,
        playerName,
        bandName,
        iconUrl: iconUrl || '',
        fame: fame || 0,
        followers: followers || 0,
        level: level || 1,
        money: money || 0,
        skills: skills || {},
        releases: releasedOnly.slice(0, 10), // 最新10枚まで
        bestReleaseSales: best ? best.totalSold : 0,
        bestReleaseTitle: best ? best.title : '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return true;
    } catch (err) {
      console.warn('[FirebaseSvc] プロフィール更新に失敗', err);
      return false;
    }
  }

  // ===== サクセスの完走記録 =====
  // 1回のサクセスが終わるたびに completedRuns に1件ずつ積む。
  // ランキングと、メジャー所属バンド一覧の元データになる。
  async function saveCompletedRun(record) {
    if (!ready) return null;
    try {
      const doc = {
        uid: currentUser.uid,
        playerId: record.playerId || '',
        playerName: record.playerName || 'タケル',
        bandName: record.bandName || '',
        iconUrl: record.iconUrl || '',
        overallRank: record.overallRank || 'G',
        overallScore: Math.round(record.overallScore || 0),
        agencyStatus: record.agencyStatus || 'unsigned',  // 'major' | 'indie' | 'unsigned'
        isMajor: record.agencyStatus === 'major',
        indieLabel: record.indieLabel || '',
        debutTurn: record.debutTurn || null,
        fame: Math.round(record.fame || 0),
        followers: Math.round(record.followers || 0),
        totalEarnings: Math.round(record.totalEarnings || 0),
        releasedCount: record.releasedCount || 0,
        totalUnitsSold: record.totalUnitsSold || 0,
        bestAudience: record.bestAudience || 0,
        stats: record.stats || {},
        abilities: record.abilities || [],
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      const ref = await db.collection('completedRuns').add(doc);
      return ref.id;
    } catch (err) {
      console.warn('[FirebaseSvc] サクセス記録の保存に失敗', err);
      return null;
    }
  }

  // 完走記録のランキング(field で並べ替え)
  async function fetchCompletedRuns(field, limit) {
    if (!ready) return [];
    try {
      const snap = await db.collection('completedRuns')
        .orderBy(field || 'overallScore', 'desc')
        .limit(limit || 30).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[FirebaseSvc] サクセス記録の取得に失敗', err);
      return [];
    }
  }

  // メジャーデビューまで行ったバンドの一覧(事務所画面の「所属バンド」に出す)
  async function fetchMajorBands(limit) {
    if (!ready) return [];
    try {
      const snap = await db.collection('completedRuns')
        .where('isMajor', '==', true)
        .orderBy('fame', 'desc')
        .limit(limit || 20).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      // 複合インデックスが未作成だと失敗するので、その場合は並べ替えなしで取り直す
      try {
        const snap2 = await db.collection('completedRuns').where('isMajor', '==', true).limit(limit || 20).get();
        return snap2.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.fame || 0) - (a.fame || 0));
      } catch (err2) {
        console.warn('[FirebaseSvc] メジャーバンドの取得に失敗', err2);
        return [];
      }
    }
  }

  // 自分の完走記録を1件消す(ランキングからも消える)
  async function deleteCompletedRun(runId) {
    if (!ready || !runId) return false;
    try {
      await db.collection('completedRuns').doc(runId).delete();
      return true;
    } catch (err) {
      console.warn('[FirebaseSvc] 記録の削除に失敗', err);
      return false;
    }
  }

  // アカウント名を変えた時、過去の完走記録の名前もまとめて直す
  async function renameMyRuns(newName) {
    if (!ready) return 0;
    try {
      const snap = await db.collection('completedRuns').where('uid', '==', currentUser.uid).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { playerName: newName }));
      await batch.commit();
      return snap.size;
    } catch (err) {
      console.warn('[FirebaseSvc] 記録の名前変更に失敗', err);
      return 0;
    }
  }

  // ランキング取得(fame / followers / money / bestReleaseSales のいずれかで降順)
  async function fetchRanking(field, limit) {
    if (!ready) return [];
    try {
      const snap = await db.collection('players').orderBy(field, 'desc').limit(limit || 50).get();
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[FirebaseSvc] ランキング取得に失敗', err);
      return [];
    }
  }

  // 特定プレイヤーの最新プロフィールを取得(フレンド詳細表示用)
  async function fetchPlayerProfile(uid) {
    if (!ready) return null;
    try {
      const doc = await db.collection('players').doc(uid).get();
      if (!doc.exists) return null;
      return { uid: doc.id, ...doc.data() };
    } catch (err) {
      console.warn('[FirebaseSvc] プロフィール取得に失敗', err);
      return null;
    }
  }

  // プレイヤーIDで他のプレイヤーを検索(自分自身は除外)
  async function searchPlayerById(playerId) {
    if (!ready) return null;
    try {
      const snap = await db.collection('players').where('playerId', '==', playerId).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      if (doc.id === currentUser.uid) return { self: true };
      return { uid: doc.id, ...doc.data() };
    } catch (err) {
      console.warn('[FirebaseSvc] 検索に失敗', err);
      return null;
    }
  }

  // 自分宛の保留中フレンド申請を取得(1回だけ)
  async function fetchPendingRequests() {
    if (!ready) return [];
    try {
      const snap = await db.collection('friendRequests')
        .where('toUid', '==', currentUser.uid)
        .where('status', '==', 'pending')
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[FirebaseSvc] 保留中の申請取得に失敗', err);
      return [];
    }
  }

  // 自分宛の保留中フレンド申請をリアルタイム監視(相手から届いた瞬間に反映される)
  function listenToPendingRequests(callback) {
    if (!ready) return () => {};
    return db.collection('friendRequests')
      .where('toUid', '==', currentUser.uid)
      .where('status', '==', 'pending')
      .onSnapshot((snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => {
        console.warn('[FirebaseSvc] フレンド申請の監視でエラー', err);
      });
  }

  // 自分のフレンド一覧をリアルタイム監視(相手が承認した瞬間に反映される)
  function listenToFriends(callback) {
    if (!ready) return () => {};
    return db.collection('players').doc(currentUser.uid).collection('friends')
      .onSnapshot(async (snap) => {
        const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        const withProfiles = await Promise.all(list.map(async (f) => {
          const profile = await fetchPlayerProfile(f.uid);
          return profile ? { ...f, ...profile } : f;
        }));
        callback(withProfiles);
      }, (err) => {
        console.warn('[FirebaseSvc] フレンド一覧の監視でエラー', err);
      });
  }

  // フレンド申請を送る
  async function sendFriendRequest(toUid, myProfile) {
    if (!ready) return false;
    try {
      // 既に同じ相手への保留中の申請がないか確認
      const existing = await db.collection('friendRequests')
        .where('fromUid', '==', currentUser.uid)
        .where('toUid', '==', toUid)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
      if (!existing.empty) return true; // 既に送信済み

      await db.collection('friendRequests').add({
        fromUid: currentUser.uid,
        fromPlayerId: myProfile.playerId,
        fromPlayerName: myProfile.playerName,
        fromBandName: myProfile.bandName,
        toUid,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    } catch (err) {
      console.warn('[FirebaseSvc] フレンド申請の送信に失敗', err);
      return false;
    }
  }

  // フレンド申請を承認(双方のfriendsサブコレクションに追加)
  // フレンド申請を承認(自分自身のfriendsサブコレクションにのみ書き込む。
  // 相手側の追加は、相手が自分の「送信した申請」の承認状態を監視して自分で行う)
  async function acceptFriendRequest(requestId, fromUid, fromProfile) {
    if (!ready) return false;
    try {
      const reqRef = db.collection('friendRequests').doc(requestId);
      await reqRef.update({ status: 'accepted' });

      await db.collection('players').doc(currentUser.uid)
        .collection('friends').doc(fromUid).set({
          playerId: fromProfile.playerId,
          playerName: fromProfile.playerName,
          bandName: fromProfile.bandName,
          addedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      return true;
    } catch (err) {
      console.warn('[FirebaseSvc] フレンド申請の承認に失敗', err);
      return false;
    }
  }

  // 自分が「送信した」申請のうち、承認されたものを監視。
  // 承認されたら自分自身のfriendsサブコレクションに相手を追加する(自分の領域への書き込みなので許可される)
  function listenToAcceptedOutgoingRequests(callback) {
    if (!ready) return () => {};
    return db.collection('friendRequests')
      .where('fromUid', '==', currentUser.uid)
      .where('status', '==', 'accepted')
      .onSnapshot(async (snap) => {
        const accepted = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const req of accepted) {
          try {
            const already = await db.collection('players').doc(currentUser.uid)
              .collection('friends').doc(req.toUid).get();
            if (already.exists) continue; // 既に追加済みならスキップ
            const toProfile = await fetchPlayerProfile(req.toUid);
            if (!toProfile) continue;
            await db.collection('players').doc(currentUser.uid)
              .collection('friends').doc(req.toUid).set({
                playerId: toProfile.playerId,
                playerName: toProfile.playerName,
                bandName: toProfile.bandName,
                addedAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
          } catch (err) {
            console.warn('[FirebaseSvc] 承認済み申請の反映に失敗', err);
          }
        }
        if (accepted.length > 0) callback(accepted);
      }, (err) => {
        console.warn('[FirebaseSvc] 送信済み申請の監視でエラー', err);
      });
  }

  async function declineFriendRequest(requestId) {
    if (!ready) return false;
    try {
      await db.collection('friendRequests').doc(requestId).update({ status: 'declined' });
      return true;
    } catch (err) {
      console.warn('[FirebaseSvc] フレンド申請の見送りに失敗', err);
      return false;
    }
  }

  // 自分のフレンド一覧を取得(登録時点のスナップショット)
  async function fetchFriends() {
    if (!ready) return [];
    try {
      const snap = await db.collection('players').doc(currentUser.uid).collection('friends').get();
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[FirebaseSvc] フレンド一覧取得に失敗', err);
      return [];
    }
  }

  // 自分のフレンド一覧を、各フレンドの「今の」プロフィール(CD・能力値・知名度など)付きで取得
  async function fetchFriendsWithProfiles() {
    const list = await fetchFriends();
    const results = await Promise.all(list.map(async (f) => {
      const profile = await fetchPlayerProfile(f.uid);
      return profile ? { ...f, ...profile } : f;
    }));
    return results;
  }

  window.FirebaseSvc = {
    init,
    isReady,
    isConfigured,
    getStatus,
    upsertPlayerProfile,
    fetchPlayerProfile,
    fetchRanking,
    saveCompletedRun,
    deleteCompletedRun,
    fetchCompletedRuns,
    fetchMajorBands,
    renameMyRuns,
    searchPlayerById,
    sendFriendRequest,
    fetchPendingRequests,
    listenToPendingRequests,
    listenToFriends,
    listenToAcceptedOutgoingRequests,
    acceptFriendRequest,
    declineFriendRequest,
    fetchFriends,
    fetchFriendsWithProfiles,
  };
})();
