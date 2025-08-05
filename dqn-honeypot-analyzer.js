// dqn-honeypot-analyzer.js
import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const ACTIONS = ['block', 'alert', 'ignore'];
const MODEL_FILE = 'model.json';
const WEIGHTS_FILE = 'weights.bin';
const LEARNING_RATE = 0.01;

// ✅ دالة تحويل السطر إلى state
function encodeState(log) {
  const ipSuspicion = log.includes('192.168') ? 0 : 1;
  const requestType = log.includes('POST') ? 1 : 0;
  const keywordDetected = /(malware|attack|scan)/i.test(log) ? 1 : 0;
  return [ipSuspicion, requestType, keywordDetected, 0, 0, 0, 0, 0]; // padding
}

// ✅ تحميل النموذج من الملف
async function loadModel() {
  if (!fs.existsSync(MODEL_FILE) || !fs.existsSync(WEIGHTS_FILE)) {
    console.error("❌ Model files not found.");
    process.exit(1);
  }

  const modelData = JSON.parse(fs.readFileSync(MODEL_FILE));
  const weightData = fs.readFileSync(WEIGHTS_FILE);

  const artifacts = {
    modelTopology: modelData.modelTopology,
    weightSpecs: modelData.weightSpecs,
    weightData: new Uint8Array(weightData).buffer
  };

  const model = await tf.loadLayersModel(tf.io.fromMemory(artifacts));
  model.compile({ optimizer: tf.train.adam(LEARNING_RATE), loss: 'categoricalCrossentropy' });
  return model;
}

// ✅ اختيار الإجراء بناءً على توقع النموذج
async function selectAction(model, state) {
  const input = tf.tensor2d([state]);
  const prediction = model.predict(input);
  const actionIdx = (await prediction.argMax(1).data())[0];
  return ACTIONS[actionIdx];
}

// ✅ تنفيذ الإجراء بناءً على التصنيف
function executeAction(action, log, ip, method, threatType) {
  switch (action) {
    case 'block':
      console.log(chalk.redBright(`[BLOCKED] ${log}`));
      break;
    case 'alert':
      console.log(chalk.yellowBright(`[ALERT] ${log}`));
      break;
    default:
      console.log(chalk.gray(`[IGNORED] ${log}`));
  }

  // ❗ يمكن لاحقًا إرسال نتائج التحليل لواجهة عرض أو نظام تنبيه
}

// ✅ استقبال الرسالة من السيرفر
process.on('message', async ({ log }) => {
  const model = await loadModel();
  const state = encodeState(log);

  const action = await selectAction(model, state);

  const [ip, method, ...rest] = log.split(' ');
  const threatType = rest.join(' ') || 'unknown';

  executeAction(action, log, ip, method, threatType);

  // 🟡 إرسال الإجراء كنص للخارج (stdout) ليتم قراءته من السيرفر
  process.send({ action });
});

