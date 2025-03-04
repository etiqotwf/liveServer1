const tf = require('@tensorflow/tfjs');

// 🏗️ 1️⃣ إنشاء نموذج الشبكة العصبية
const model = tf.sequential();
model.add(tf.layers.dense({ units: 10, activation: 'relu', inputShape: [1] })); // طبقة مخفية بوحدات Relu
model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' })); // طبقة إخراج بقيمة بين 0 و 1

// ⚙️ 2️⃣ إعداد النموذج للتدريب
model.compile({
    loss: 'binaryCrossentropy', // دالة الخسارة لتصنيف ثنائي
    optimizer: 'adam', // المحسّن لتسريع التعلم
    metrics: ['accuracy'] // قياس الدقة أثناء التدريب
});

// 📊 3️⃣ بيانات التدريب
const codes = [1234567, 2345678, 3456789, 4567890, 5678901, 6789012, 7890123, 8901234]; // مجموعة من الأكواد
const labels = codes.map(code => (Math.floor((code / 10000) % 10) % 2 === 0 ? 0 : 1)); // الجنس: 0 (ذكر) - 1 (أنثى)

const xs = tf.tensor2d(codes.map(code => [Math.floor((code / 10000) % 10)])); // استخراج الرقم الثالث فقط
const ys = tf.tensor2d(labels, [labels.length, 1]); // القيم المستهدفة للجنس

// 🚀 4️⃣ تدريب النموذج
async function trainModel() {
    console.log("🏋️ Training the model..."); // بدء التدريب
    await model.fit(xs, ys, { epochs: 200 }); // تدريب النموذج لمدة 200 تكرار
    console.log("✅ Training completed!"); // انتهاء التدريب

    // 🔍 5️⃣ تجربة التنبؤ
    const testCode = 3476789; // تجربة كود جديد
    const thirdDigit = Math.floor((testCode / 10000) % 10); // استخراج الرقم الثالث
    const prediction = model.predict(tf.tensor2d([[thirdDigit]])); // تنبؤ بالجنس

    prediction.array().then(result => {
        console.log(`🔮 Prediction for code ${testCode}:`, result[0][0] > 0.5 ? "Female 👩" : "Male 👨");
    });
}

// تشغيل التدريب
trainModel();
