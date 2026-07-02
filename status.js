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

// 同期する状態オブジェクト（操作側の在席状態。全客先共通）。
window.DEFAULT_STATE = { status: "away", hidden: false, muted: false };

// 接続（客先端末ごと）の承認レコード。
//   approval: "pending" | "approved" | "rejected"
//   permanent: true=永続許可（次回以降も自動承認）
window.CONN_DEFAULT = { name: "", approval: "pending", permanent: false };

(function () {
  const cfg = window.AVATAR_CONFIG;
  const skey = cfg.statusKey || "default";
  const useFirebase = !!(cfg.firebase && cfg.firebase.databaseURL);
  window.AVATAR_USE_FIREBASE = useFirebase;

  // Firebase を1回だけ初期化して db を共有
  let db = null;
  if (useFirebase) {
    firebase.initializeApp({
      apiKey: cfg.firebase.apiKey,
      databaseURL: cfg.firebase.databaseURL,
      projectId: cfg.firebase.projectId,
    });
    db = firebase.database();
  }

  // 端末ごとの固有ID（localStorage 保存）
  window.getDeviceId = function () {
    let id = localStorage.getItem("avatar-device-id");
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? "dev-" + crypto.randomUUID().slice(0, 8)
        : "dev-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("avatar-device-id", id);
    }
    return id;
  };

  // ---------- StatusStore（操作側の在席状態）----------
  function mergeState(s) { return Object.assign({}, window.DEFAULT_STATE, s || {}); }

  function statusLocal() {
    const key = "avatar-status:" + skey;
    const channel = ("BroadcastChannel" in window) ? new BroadcastChannel(key) : null;
    const listeners = [];
    function current() {
      try { return mergeState(JSON.parse(localStorage.getItem(key))); }
      catch (e) { return mergeState(); }
    }
    function notify(v) { listeners.forEach((cb) => cb(v)); }
    if (channel) channel.onmessage = (e) => notify(mergeState(e.data));
    window.addEventListener("storage", (e) => {
      if (e.key === key) { try { notify(mergeState(JSON.parse(e.newValue))); } catch (_) {} }
    });
    return {
      mode: "local",
      subscribe(cb) { listeners.push(cb); cb(current()); },
      set(partial) {
        const next = mergeState(Object.assign(current(), partial));
        localStorage.setItem(key, JSON.stringify(next));
        if (channel) channel.postMessage(next);
        notify(next);
      },
    };
  }

  function statusFirebase() {
    const ref = db.ref("avatarStatus/" + skey);
    let last = mergeState();
    return {
      mode: "firebase",
      subscribe(cb) { ref.on("value", (snap) => { last = mergeState(snap.val()); cb(last); }); },
      set(partial) { ref.set(mergeState(Object.assign({}, last, partial))); },
    };
  }

  window.StatusStore = useFirebase ? statusFirebase() : statusLocal();

  // ---------- ConnStore（接続承認：端末ごと）----------
  function mergeConn(c) { return Object.assign({}, window.CONN_DEFAULT, c || {}); }

  function connLocal() {
    const key = "avatar-clients:" + skey;
    const channel = ("BroadcastChannel" in window) ? new BroadcastChannel(key) : null;
    const allListeners = [];
    const selfListeners = {}; // id -> [cb]
    function readMap() {
      try { return JSON.parse(localStorage.getItem(key)) || {}; }
      catch (e) { return {}; }
    }
    function writeMap(map) {
      localStorage.setItem(key, JSON.stringify(map));
      if (channel) channel.postMessage(map);
      fire(map);
    }
    function fire(map) {
      allListeners.forEach((cb) => cb(map));
      Object.keys(selfListeners).forEach((id) => {
        (selfListeners[id] || []).forEach((cb) => cb(map[id] ? mergeConn(map[id]) : null));
      });
    }
    if (channel) channel.onmessage = (e) => fire(e.data || {});
    window.addEventListener("storage", (e) => { if (e.key === key) fire(readMap()); });
    return {
      mode: "local",
      registerSelf(id, info) {
        const map = readMap();
        const now = Date.now();
        const rec = map[id];
        if (!rec) {
          map[id] = mergeConn({ name: info.name || "", ua: info.ua || "", approval: "pending", permanent: false, firstSeen: now, lastSeen: now });
        } else {
          rec.lastSeen = now;
          rec.approval = rec.permanent ? "approved" : "pending";
          if (!rec.name && info.name) rec.name = info.name;
          map[id] = rec;
        }
        writeMap(map);
      },
      onSelf(id, cb) { (selfListeners[id] = selfListeners[id] || []).push(cb); const m = readMap(); cb(m[id] ? mergeConn(m[id]) : null); },
      onAll(cb) { allListeners.push(cb); cb(readMap()); },
      update(id, patch) { const map = readMap(); map[id] = mergeConn(Object.assign({}, map[id], patch)); writeMap(map); },
      remove(id) { const map = readMap(); delete map[id]; writeMap(map); },
    };
  }

  function connFirebase() {
    const root = db.ref("clients/" + skey);
    return {
      mode: "firebase",
      registerSelf(id, info) {
        const ref = root.child(id);
        ref.once("value").then((snap) => {
          const now = Date.now();
          const rec = snap.val();
          if (!rec) {
            ref.set(mergeConn({ name: info.name || "", ua: info.ua || "", approval: "pending", permanent: false, firstSeen: now, lastSeen: now }));
          } else {
            const patch = { lastSeen: now, approval: rec.permanent ? "approved" : "pending" };
            if (!rec.name && info.name) patch.name = info.name;
            ref.update(patch);
          }
        });
      },
      onSelf(id, cb) { root.child(id).on("value", (snap) => cb(snap.val() ? mergeConn(snap.val()) : null)); },
      onAll(cb) { root.on("value", (snap) => cb(snap.val() || {})); },
      update(id, patch) { root.child(id).update(patch); },
      remove(id) { root.child(id).remove(); },
    };
  }

  window.ConnStore = useFirebase ? connFirebase() : connLocal();
})();

// ---------- JaaS JWT ヘルパー ----------
// Cloudflare Worker から参加用トークンを取得する。
window.jaasRoomName = function () {
  const j = window.AVATAR_CONFIG.jitsi;
  return j.appId + "/" + j.room;
};
window.getJaasToken = async function (opts) {
  opts = opts || {};
  const j = window.AVATAR_CONFIG.jitsi;
  const p = new URLSearchParams();
  if (opts.name) p.set("name", opts.name);
  if (opts.id) p.set("id", opts.id);
  if (opts.moderator) { p.set("moderator", "true"); if (opts.key) p.set("key", opts.key); }
  const res = await fetch(j.tokenEndpoint + "?" + p.toString());
  const data = await res.json();
  if (!data.jwt) throw new Error(data.error || "token error");
  return data.jwt;
};
