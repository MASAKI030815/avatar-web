// ===== 設定ファイル =====
// ここだけ書き換えれば、会議ルーム名・同期方式を変更できる。

window.AVATAR_CONFIG = {
  // --- Jitsi 会議設定 ---
  // JaaS（8x8）構成。埋め込み＋モデレーターJWTで「参加待ち」問題を解消。
  jitsi: {
    domain: "8x8.vc",
    appId: "vpaas-magic-cookie-3a518f0ee8eb425ca08cd293ecd138da",
    kid: "vpaas-magic-cookie-3a518f0ee8eb425ca08cd293ecd138da/29a467",
    room: "yamada-avatar-desk-01",  // 実際の会議名は `${appId}/${room}` になる
    displayName: "山田（ネットワークエンジニア）",
    // JWT を発行する Cloudflare Worker の URL
    tokenEndpoint: "https://jaas-token.masaki030815.workers.dev/token",
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
