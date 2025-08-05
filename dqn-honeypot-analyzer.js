import * as tf from '@tensorflow/tfjs';

// مسارات النموذج
const MODEL_URL = './model.json';

const ACTIONS = ['block', 'alert', 'ignore'];
const LEARNING_RATE = 0.01;

// ✅ دالة تحويل السطر إلى state
function encodeState(log) {
  const ipSuspicion = log.includes('192.168') ? 0 : 1;
  const requestType = log.includes('POST') ? 1 : 0;
  const keywordDetected = /(malware|attack|scan)/i.test(log) ? 1 : 0;
  return [ipSuspicion, requestType, keywordDetected, 0, 0, 0, 0, 0]; // padding
}

// ✅ تحميل النموذج من المتصفح
async function loadModel() {
  const model = await tf.loadLayersModel(MODEL_URL);
  model.compile({
    optimizer: tf.train.adam(LEARNING_RATE),
    loss: 'categoricalCrossentropy',
  });
  return model;
}

// ✅ اختيار الإجراء
async function selectAction(model, state) {
  const input = tf.tensor2d([state]);
  const prediction = model.predict(input);
  const actionIdx = (await prediction.argMax(1).data())[0];
  return ACTIONS[actionIdx];
}

// ✅ تنفيذ الإجراء
function executeAction(action, log) {
  const resultBox = document.getElementById('results');
  const line = document.createElement('div');

  switch (action) {
    case 'block':
      line.style.color = 'red';
      line.textContent = `[BLOCKED] ${log}`;
      break;
    case 'alert':
      line.style.color = 'orange';
      line.textContent = `[ALERT] ${log}`;
      break;
    default:
      line.style.color = 'gray';
      line.textContent = `[IGNORED] ${log}`;
  }

  resultBox.appendChild(line);
}

// ✅ تحليل سجل واحد
async function analyzeLog(log, model) {
  const state = encodeState(log);
  const action = await selectAction(model, state);
  executeAction(action, log);
}

// ✅ مثال لتشغيل التحليل من واجهة المستخدم
document.getElementById('analyze-btn').addEventListener('click', async () => {
  const logInput = document.getElementById('log-input').value.trim();
  if (!logInput) return;

  const model = await loadModel();
  analyzeLog(logInput, model);
});
