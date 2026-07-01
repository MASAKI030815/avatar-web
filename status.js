// ===== ステータス定義 & 同期ストア =====

// ステータスの種類。online のときだけ会議（アバター）を表示する。
window.STATUS_DEFS = {
  online: {
    label: "対応中",
    showMeeting: true,          // 会議画面を出す
    color: "#1565c0",
    message: "お話しできます",
  },
  away: {
    label: "離席中",
    showMeeting: false,
    color: "#607d8b",
    message: "ただいま席を外しています。しばらくお待ちください。",
  },
  busy: {
    label: "他件対応中",
    showMeeting: false,
    color: "#e08600",
    message: "ただいま他のご対応中です。少々お待ちください。",
  },
  closed: {
    label: "業務終了",
    showMeeting: false,
    color: "#455a64",
    message: "本日の業務は終了しました。またのご利用をお待ちしております。",
  },
};

// 同期する状態オブジェクト。
//   status: 対応中/離席中/他件対応中/業務終了 のキー
//   hidden: true=アバターを一時的に非表示（通話は維持）
//   muted:  true=ミュート
window.DEFAULT_STATE = { status: "away", hidden: false, muted: false };

// 同期ストア。Firebase 設定があれば Realtime DB、なければ localStorage+BroadcastChannel。
// subscribe(cb) は状態オブジェクトを渡す。set(partial) は差分マージして保存。
(function () {
  const cfg = window.AVATAR_CONFIG;
  const key = "avatar-status:" + (cfg.statusKey || "default");
  const useFirebase = !!(cfg.firebase && cfg.firebase.databaseURL);

  function merge(state) {
    return Object.assign({}, window.DEFAULT_STATE, state || {});
  }

  function makeLocalStore() {
    const channel = ("BroadcastChannel" in window) ? new BroadcastChannel(key) : null;
    const listeners = [];
    function current() {
      try { return merge(JSON.parse(localStorage.getItem(key))); }
      catch (e) { return merge(); }
    }
    function notify(v) { listeners.forEach((cb) => cb(v)); }
    if (channel) channel.onmessage = (e) => notify(merge(e.data));
    window.addEventListener("storage", (e) => {
      if (e.key === key) { try { notify(merge(JSON.parse(e.newValue))); } catch (_) {} }
    });
    return {
      mode: "local",
      subscribe(cb) { listeners.push(cb); cb(current()); },
      set(partial) {
        const next = merge(Object.assign(current(), partial));
        localStorage.setItem(key, JSON.stringify(next));
        if (channel) channel.postMessage(next);
        notify(next);
      },
    };
  }

  function makeFirebaseStore() {
    // Firebase を <script> で先に読み込んでおく前提（compat SDK）
    firebase.initializeApp({
      apiKey: cfg.firebase.apiKey,
      databaseURL: cfg.firebase.databaseURL,
      projectId: cfg.firebase.projectId,
    });
    const ref = firebase.database().ref("avatarStatus/" + (cfg.statusKey || "default"));
    let last = merge();
    return {
      mode: "firebase",
      subscribe(cb) { ref.on("value", (snap) => { last = merge(snap.val()); cb(last); }); },
      set(partial) { ref.set(merge(Object.assign({}, last, partial))); },
    };
  }

  window.StatusStore = useFirebase ? makeFirebaseStore() : makeLocalStore();
})();
