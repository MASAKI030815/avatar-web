// ===== 設定ファイル =====
// ここだけ書き換えれば、会議ルーム名・同期方式を変更できる。

window.AVATAR_CONFIG = {
  // --- Jitsi 会議設定 ---
  jitsi: {
    domain: "meet.jit.si",          // Jitsi サーバー（無料公開サーバー）
    room: "yamada-avatar-desk-01",  // 会議ルーム名（推測されにくい固有名にする）
    displayName: "山田（ネットワークエンジニア）", // 客先側に見える名前
  },

  // --- ステータス同期方式 ---
  // firebase.databaseURL を空のままにすると「ローカル同期モード」で動作する
  //   （同一ブラウザの別タブ間だけ同期。UX確認・デモ用）
  // 別デバイス（操作側PC ⇔ 客先タブレット）で同期するには、
  //   Firebase Realtime Database を作成して下記を埋める（docs/frontend.md 参照）。
  firebase: {
    apiKey: "AIzaSyDbNii9TBM4nudh2NziR18zjoPNcLLbqfQ",
    databaseURL: "https://yamada-avatar-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "yamada-avatar",
  },

  // Firebase 上でステータスを保存するキー（複数拠点を運用するなら拠点ごとに変える）
  statusKey: "desk-01",
};
