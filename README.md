# SwitchBot Battery Alert System

SwitchBot デバイス（ロック・キーパッド）のバッテリー残量を定期的に監視し、しきい値以下になった場合に Slack へ通知するシステムです。GitHub Actions を使用して自動実行されます。

## 📋 機能

- 🔋 SwitchBot ロック類のバッテリー残量を自動チェック
- 📊 設定可能なバッテリーしきい値（デフォルト: 30%）
- 📱 Slack への自動通知
- ⏰ GitHub Actions による定期実行（毎日 9:00 JST）
- 🎯 特定デバイスのみを監視するフィルタリング機能
- 🔍 詳細なログ出力とエラーハンドリング

## 🎯 対象デバイス

以下のデバイスタイプが自動的に監視対象となります:

- Lock (スマートロック)
- Lock Pro (スマートロック Pro)
- Lock Ultra (スマートロック Ultra)
- Lock Lite (スマートロック Lite)
- Keypad (キーパッド)
- Keypad Touch (キーパッドタッチ)

## 🚀 セットアップ

### 1. SwitchBot API 認証情報の取得

1. SwitchBot アプリを開く
2. **プロフィール** → **設定** へ移動
3. **アプリバージョン** を 10 回タップ
4. **開発者向けオプション** が表示される
5. **トークン** と **シークレット** をコピー

詳細: [SwitchBot API ドキュメント](https://github.com/OpenWonderLabs/SwitchBotAPI)

### 2. Slack Webhook URL の作成

1. [Slack API](https://api.slack.com/messaging/webhooks) にアクセス
2. **Create New App** をクリック
3. **From scratch** を選択してアプリを作成
4. **Incoming Webhooks** を有効化
5. **Add New Webhook to Workspace** をクリック
6. 通知を送信するチャンネルを選択
7. 生成された **Webhook URL** をコピー

### 3. GitHub Secrets の設定

リポジトリの **Settings** → **Secrets and variables** → **Actions** → **New repository secret** から以下を設定:

| Secret 名 | 説明 | 必須 | 例 |
|----------|------|------|-----|
| `SWITCHBOT_TOKEN` | SwitchBot API トークン | ✅ | `c1234567890abcdef...` |
| `SWITCHBOT_SECRET` | SwitchBot API シークレット | ✅ | `abcdef1234567890...` |
| `SLACK_WEBHOOK_URL` | Slack Webhook URL | ✅ | `https://hooks.slack.com/services/...` |
| `BATTERY_THRESHOLD` | バッテリーしきい値（%） | ❌ | `30` (デフォルト) |
| `SWITCHBOT_DEVICE_IDS` | 監視対象デバイス ID（カンマ区切り） | ❌ | `AAAAAA,BBBBBB` |

### 4. 依存パッケージのインストール（ローカルテスト用）

```bash
npm install
```

## 🧪 ローカルでのテスト

### 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成:

```bash
cp .env.example .env
```

`.env` ファイルに実際の認証情報を設定してください。

### スクリプトの実行

```bash
npm run check
```

または

```bash
node scripts/check-switchbot-battery.js
```

### 出力例

```
🔍 SwitchBot バッテリーチェックを開始します...
📊 バッテリーしきい値: 30%
🎯 監視対象: 全てのロック/キーパッドデバイス
📡 デバイス一覧を取得中...
✅ 5 個のデバイスを取得しました

🔋 2 個のデバイスのバッテリーをチェックします...

🟢 玄関ドア (Lock / AAAAAA): 85%
🔴 裏口ドア (Lock Pro / BBBBBB): 25%

============================================================
⚠️  1 個のデバイスがしきい値以下です！
📤 Slack へ通知を送信中...
✅ Slack 通知を送信しました
✅ 処理が完了しました。
```

## ⚙️ カスタマイズ

### スケジュールの変更

[.github/workflows/check-battery.yml](.github/workflows/check-battery.yml) の `cron` 式を編集:

```yaml
schedule:
  # 毎日 12:00 JST (3:00 UTC) に実行する場合
  - cron: '0 3 * * *'
```

cron 式の参考: [crontab.guru](https://crontab.guru/)

### バッテリーしきい値の変更

GitHub Secrets の `BATTERY_THRESHOLD` を変更するか、ローカルの `.env` ファイルで設定:

```bash
BATTERY_THRESHOLD=20
```

### 特定デバイスのみ監視

デバイス ID を取得するには、一度スクリプトを実行してログを確認するか、以下のコマンドで API を直接呼び出します:

```bash
curl -H "Authorization: YOUR_TOKEN" https://api.switch-bot.com/v1.1/devices
```

取得したデバイス ID を GitHub Secrets または `.env` に設定:

```bash
SWITCHBOT_DEVICE_IDS=AAAAAA,BBBBBB,CCCCCC
```

## 🔄 GitHub Actions での実行

### 自動実行

設定したスケジュール（デフォルト: 毎日 9:00 JST）で自動的に実行されます。

### 手動実行

1. GitHub リポジトリの **Actions** タブを開く
2. **SwitchBot Battery Check** ワークフローを選択
3. **Run workflow** をクリック

### 実行ログの確認

**Actions** タブから過去の実行履歴とログを確認できます。

## 🐛 トラブルシューティング

### エラー: 必須の環境変数が設定されていません

GitHub Secrets に `SWITCHBOT_TOKEN`、`SWITCHBOT_SECRET`、`SLACK_WEBHOOK_URL` が正しく設定されているか確認してください。

### エラー: SwitchBot devices API エラー: 401

- トークンとシークレットが正しいか確認
- SwitchBot アプリで開発者向けオプションが有効になっているか確認

### エラー: battery フィールドがありません

一部のデバイス（特にキーパッド）は、現在の API バージョンでバッテリー情報を返さない場合があります。これは SwitchBot API の仕様によるものです。

### Slack 通知が届かない

- Webhook URL が正しいか確認
- Slack アプリが正しいチャンネルに追加されているか確認
- Webhook URL の有効期限が切れていないか確認

## 📝 環境変数リファレンス

詳細な環境変数の説明は [.env.example](.env.example) を参照してください。

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|-------------|------|
| `SWITCHBOT_TOKEN` | SwitchBot API トークン | - | ✅ |
| `SWITCHBOT_SECRET` | SwitchBot API シークレット | - | ✅ |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL | - | ✅ |
| `BATTERY_THRESHOLD` | バッテリー残量のしきい値（%） | `30` | ❌ |
| `SWITCHBOT_DEVICE_IDS` | 監視対象デバイス ID（カンマ区切り） | 全デバイス | ❌ |

## 📚 参考資料

- [SwitchBot API ドキュメント](https://github.com/OpenWonderLabs/SwitchBotAPI)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)

## 📄 ライセンス

MIT
