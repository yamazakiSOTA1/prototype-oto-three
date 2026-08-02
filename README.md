# 斬撃連携インタラクティブWebアプリ

このプロジェクトは、スマホのDeviceMotion APIとPCのCanvas描画を連携させ、Firebase Realtime Databaseを介して斬撃体験を共有する作品です。

## 使い方

1. `firebase.js` の `firebaseConfig` に自分の Firebase プロジェクトの設定を入力します。
2. `sounds/` フォルダーに以下のファイルを追加します。
   - `slash_start.mp3`
   - `slash_end.mp3`
3. `index.html` をブラウザで開き、スマホ側とPC側をそれぞれ選択します。
4. 同じ Firebase Realtime Database を両方のデバイスで共有してください。

## ファイル構成

- `index.html` : 起動画面とデバイス選択
- `style.css` : 共通スタイル
- `firebase.js` : Firebase Realtime Database の初期化と読み書き処理
- `smartphone.js` : スマホ側のモーション検出、演出、送信処理
- `pc.js` : PC側のイベント受信、Canvas演出、音声再生処理
- `effects.js` : PC側の斬撃エフェクト生成ロジック
- `sounds/` : 音声ファイル配置場所

## GitHub Pages への公開

1. このリポジトリを GitHub にプッシュします。
2. GitHub リポジトリの `Settings > Pages` から `main` ブランチと `/ (root)` を公開対象に設定します。
3. `index.html` がルートに存在するため、そのまま公開できます。

## 注意

- スマホ側のブラウザでは DeviceMotion のアクセス許可が必要です。
- ブラウザの自動再生制限により、音声再生が最初はユーザー操作後に許可される場合があります。
- Firebase の接続情報は必ず自分のプロジェクト用に差し替えてください。
