// scripts/check-switchbot-battery.js
// SwitchBot ロック類のバッテリーを監視して、閾値以下なら Slack に通知する

// ローカルテスト用: .env ファイルから環境変数を読み込む
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ====== 環境変数 ======
const SWITCHBOT_TOKEN = process.env.SWITCHBOT_TOKEN;
const SWITCHBOT_SECRET = process.env.SWITCHBOT_SECRET;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// しきい値（%）
const BATTERY_THRESHOLD = parseInt(process.env.BATTERY_THRESHOLD || '30', 10);

// 監視対象を限定したい場合は、カンマ区切りで deviceId を指定
// 例: SWITCHBOT_DEVICE_IDS="AAAAAA,BBBBBB"
const TARGET_DEVICE_IDS = process.env.SWITCHBOT_DEVICE_IDS
  ? process.env.SWITCHBOT_DEVICE_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

if (!SWITCHBOT_TOKEN || !SWITCHBOT_SECRET || !SLACK_WEBHOOK_URL) {
  console.error('❌ エラー: 必須の環境変数が設定されていません。');
  console.error('必要な環境変数: SWITCHBOT_TOKEN, SWITCHBOT_SECRET, SLACK_WEBHOOK_URL');
  console.error('詳細は .env.example を参照してください。');
  process.exit(1);
}

console.log('🔍 SwitchBot バッテリーチェックを開始します...');
console.log(`📊 バッテリーしきい値: ${BATTERY_THRESHOLD}%`);
if (TARGET_DEVICE_IDS) {
  console.log(`🎯 監視対象デバイス ID: ${TARGET_DEVICE_IDS.join(', ')}`);
} else {
  console.log('🎯 監視対象: 全てのロック/キーパッドデバイス');
}

// ====== SwitchBot API ヘッダ生成 ======
function buildHeaders() {
  const nonce = uuidv4();
  const t = Date.now().toString(); // 13桁ミリ秒
  const data = SWITCHBOT_TOKEN + t + nonce;

  const sign = crypto
    .createHmac('sha256', SWITCHBOT_SECRET)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  return {
    Authorization: SWITCHBOT_TOKEN,
    sign,
    t,
    nonce,
    'Content-Type': 'application/json',
  };
}

// ====== SwitchBot API 呼び出し ======
async function fetchDevices() {
  console.log('📡 デバイス一覧を取得中...');
  const res = await axios.get('https://api.switch-bot.com/v1.1/devices', {
    headers: buildHeaders(),
  });

  if (res.data.statusCode !== 100) {
    throw new Error(
      `SwitchBot devices API エラー: ${res.data.statusCode} ${res.data.message}`
    );
  }

  const deviceCount = res.data.body?.deviceList?.length || 0;
  console.log(`✅ ${deviceCount} 個のデバイスを取得しました`);

  return res.data.body?.deviceList || [];
}

async function fetchStatus(deviceId) {
  const res = await axios.get(
    `https://api.switch-bot.com/v1.1/devices/${deviceId}/status`,
    { headers: buildHeaders() }
  );

  if (res.data.statusCode !== 100) {
    throw new Error(
      `SwitchBot status API エラー (${deviceId}): ${res.data.statusCode} ${res.data.message}`
    );
  }
  return res.data.body;
}

// ====== Slack 通知 ======
async function sendSlack(text) {
  console.log('📤 Slack へ通知を送信中...');
  await axios.post(SLACK_WEBHOOK_URL, { text });
  console.log('✅ Slack 通知を送信しました');
}

function formatDeviceName(device) {
  return `${device.deviceName || 'Unknown'} (${device.deviceType || 'Unknown'} / ${device.deviceId})`;
}

// API レート制限対策: リクエスト間に待機時間を追加
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ====== メイン処理 ======
async function main() {
  try {
    const devices = await fetchDevices();

    // ロック / キーパッド系だけに絞る
    const targetTypes = ['Lock', 'Lock Pro', 'Lock Ultra', 'Lock Lite', 'Keypad', 'Keypad Touch'];

    const candidateDevices = devices.filter((d) => {
      const t = d.deviceType;
      if (!t || !targetTypes.includes(t)) return false;
      if (TARGET_DEVICE_IDS && !TARGET_DEVICE_IDS.includes(d.deviceId)) return false;
      return true;
    });

    if (candidateDevices.length === 0) {
      console.log('⚠️  対象のロック/キーパッドデバイスが見つかりませんでした。');
      console.log('💡 ヒント: SWITCHBOT_DEVICE_IDS が設定されている場合は、デバイス ID を確認してください。');
      return;
    }

    console.log(`\n🔋 ${candidateDevices.length} 個のデバイスのバッテリーをチェックします...\n`);

    const deviceStatuses = [];
    const lowDevices = [];

    for (const device of candidateDevices) {
      let status;
      try {
        status = await fetchStatus(device.deviceId);
        // API レート制限対策: 各リクエスト間に500ms待機
        await sleep(500);
      } catch (err) {
        console.error(`❌ ステータス取得失敗: ${formatDeviceName(device)}`);
        console.error(`   エラー: ${err.message}`);
        continue;
      }

      // Lock は API v1.1 のステータスに battery が含まれる（例: 95）
      let battery = NaN;

      if (typeof status.battery === 'number') {
        battery = status.battery;
      } else if (typeof status.battery === 'string') {
        battery = parseInt(status.battery, 10);
      }

      if (Number.isNaN(battery)) {
        // キーパッドなど、現状 battery が取れない場合はここに来る可能性が高い
        console.log(
          `⚠️  battery フィールドがありません: ${formatDeviceName(device)}`
        );
        console.log(`   利用可能なフィールド: ${Object.keys(status).join(', ')}`);
        continue;
      }

      const isLow = battery <= BATTERY_THRESHOLD;
      const statusIcon = isLow ? '🔴' : '🟢';

      console.log(`${statusIcon} ${formatDeviceName(device)}: ${battery}%`);

      deviceStatuses.push({ device, battery, isLow });

      if (isLow) {
        lowDevices.push({ device, battery });
      }
    }

    console.log('\n' + '='.repeat(60));

    if (deviceStatuses.length === 0) {
      console.log('⚠️  バッテリー情報を取得できたデバイスがありませんでした。');
      return;
    }

    // 日付を取得（JST）
    const now = new Date();
    const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const dateStr = jstDate.toISOString().split('T')[0];

    // Slack 通知用のメッセージを作成（全デバイスを表示）
    const deviceLines = deviceStatuses.map(({ device, battery, isLow }) => {
      const icon = isLow ? '🔴' : '🟢';
      const warning = isLow ? ' ⚠️ *要交換*' : '';
      const deviceName = device.deviceName || 'Unknown';
      const deviceType = device.deviceType || 'Unknown';
      return `${icon} ${deviceName} (${deviceType}): *${battery}%*${warning}`;
    });

    let text = `:battery: *SwitchBot バッテリーレポート* (${dateStr})\n\n`;
    text += deviceLines.join('\n');
    text += `\n\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `しきい値: *${BATTERY_THRESHOLD}%*\n`;

    if (lowDevices.length > 0) {
      text += `⚠️ *${lowDevices.length}個のデバイス*がバッテリー交換を推奨します`;
      console.log(`⚠️  ${lowDevices.length} 個のデバイスがしきい値以下です！`);
    } else {
      text += `✅ 全てのデバイスのバッテリーは正常です`;
      console.log(`✅ 全てのデバイスのバッテリーがしきい値 ${BATTERY_THRESHOLD}% より上でした。`);
    }

    await sendSlack(text);
    console.log('✅ 処理が完了しました。');
  } catch (err) {
    console.error('\n❌ エラーが発生しました:');
    console.error(err.message);
    if (err.response) {
      console.error('API レスポンス:', err.response.data);
    }
    process.exit(1);
  }
}

main();
