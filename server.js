// server.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process'; // ✅ هذا هو السطر المناسب

const app = express();
const PORT = 3000;  

let serverUrl = ""; // سيتم تحديثه من ngrok
const logPath = path.join('./logs', 'threats.csv');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
    console.error("❌ GitHub token not found in environment variables!");
    process.exit(1);
}

// ✅ إعداد الميدل وير
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use(express.static('public'));

// ✅ إنشاء مجلد وملف logs إذا لم يكن موجودًا
if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
}
if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, 'Timestamp,IP,Method,ThreatType\n');
}

// ✅ تسجيل التهديد
app.post('/api/logs', (req, res) => {
    const { timestamp, ip, method, threatType } = req.body;
    const logLine = `${timestamp},${ip},${method},${threatType}\n`;
    fs.appendFileSync(logPath, logLine);
    res.status(200).json({ message: 'تم تسجيل التهديد' });
});

// ✅ عرض التهديدات
app.get('/api/logs', (req, res) => {
    if (!fs.existsSync(logPath)) return res.json([]);
    const data = fs.readFileSync(logPath, 'utf-8').trim().split('\n').slice(1);
    const logs = data.map(line => {
        const [timestamp, ip, method, threatType] = line.split(',');
        return { timestamp, ip, method, threatType };
    });
    res.json(logs.reverse());
});

// ✅ تهديد سريع (بصيغة ثانية)
import https from 'https';

app.get('/api/threats', (req, res) => {
  const githubUrl = 'https://raw.githubusercontent.com/etiqotwf/liveServer/main/public/logs/threats.csv';
  https.get(githubUrl, (githubRes) => {
    let data = '';
    githubRes.on('data', chunk => data += chunk);
    githubRes.on('end', () => res.send(data));
  }).on('error', (err) => {
    console.error('❌ Error fetching CSV from GitHub:', err.message);
    res.status(500).send('Error fetching data');
  });
});

// ✅ تحميل التهديدات كـ CSV
app.get('/download/csv', (req, res) => {
    res.download(path.join('./logs', 'threats.csv'));
});

// ✅ تحميل التهديدات كـ JSON
app.get('/download/json', (req, res) => {
    const data = fs.readFileSync(logPath, 'utf8')
        .split('\n').slice(1).filter(Boolean).map(row => {
            const [Timestamp, IP, Method, ThreatType] = row.split(',');
            return { Timestamp, IP, Method, ThreatType };
        });
    res.json(data);
});

// ✅ استقبال بيانات النتيجة
app.post("/submit", (req, res) => {
    const { name, phone, date, startTime, timeTaken, score } = req.body;
    const maxScore = 25;
    const numericScore = parseFloat(score);

    if (isNaN(numericScore) || numericScore < 0 || numericScore > maxScore) {
        return res.status(400).json({ message: "❌ Invalid score value!" });
    }

    const percentage = ((numericScore / maxScore) * 100).toFixed(2) + "%";
    const logEntry = `🧑 Name       : ${name}\n📞 Phone     : ${phone}\n📅 Date      : ${date}\n⏰ Start Time: ${startTime}\n⏳ Time Taken: ${timeTaken}\n🏆 Score     : ${numericScore}/${maxScore} (${percentage})\n-----------------------------------\n`;

    console.log("📥 Data received:");
    console.log(logEntry);

    fs.appendFile("data.txt", logEntry, (err) => {
        if (err) {
            console.error("❌ Error saving data:", err);
            return res.status(500).json({ message: "❌ Error saving data!" });
        }
        console.log("✅ Data saved to data.txt");
    });

    res.json({ message: "✅ Data received successfully!", receivedData: { ...req.body, percentage } });
});

// ✅ جلب عنوان ngrok
app.get("/ngrok-url", (req, res) => {
    if (serverUrl) {
        res.json({ serverUrl });
    } else {
        res.status(500).json({ message: "ngrok has not started yet!" });
    }
});

// ✅ بدء الخادم
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);

    exec("pgrep -f 'ngrok' && pkill -f 'ngrok'", () => {
        exec("ngrok.exe http 3000 --log=stdout", (err) => {
            if (err) {
                console.error("❌ Error starting ngrok:", err);
                return;
            }
            console.log("✅ ngrok started successfully!");
        });

        setTimeout(() => {
            exec("curl -s http://127.0.0.1:4040/api/tunnels", (err, stdout) => {
                if (err || !stdout) {
                    console.log("⚠️ Trying PowerShell instead of curl...");
                    exec("powershell -Command \"(Invoke-WebRequest -Uri 'http://127.0.0.1:4040/api/tunnels' -UseBasicParsing).Content\"", (psErr, psStdout) => {
                        if (psErr || !psStdout) {
                            console.error("❌ Error fetching ngrok URL:", psErr);
                            return;
                        }
                        processNgrokResponse(psStdout);
                    });
                } else {
                    processNgrokResponse(stdout);
                }
            });
        }, 5000);
    });
});

// ✅ معالجة استجابة ngrok
function processNgrokResponse(response) {
    try {
        const tunnels = JSON.parse(response);
        serverUrl = tunnels.tunnels[0]?.public_url;

        if (serverUrl) {
            console.log(`✅ Server is available at: 🔗 ${serverUrl}`);
            fs.writeFileSync("serverUrl.json", JSON.stringify({ serverUrl }));

            pushToGitHub();
        } else {
            console.log("⚠️ No ngrok URL found.");
        }
    } catch (parseError) {
        console.error("❌ Error parsing ngrok response:", parseError);
    }
}

// ✅ تنفيذ أوامر Git
function runCommand(command, args, callback) {
    const process = spawn(command, args);

    process.stdout.on("data", (data) => console.log(`stdout: ${data}`));
    process.stderr.on("data", (data) => console.error(`stderr: ${data}`));

    process.on("close", (code) => {
        if (code !== 0) return console.error(`❌ Command failed: ${command} ${args.join(" ")}`);
        callback();
    });
}

// ✅ رفع ملف إلى GitHub
function pushToGitHub() {
    console.log("📤 Pushing updates to GitHub...");

    runCommand("git", ["add", "."], () => {
        runCommand("git", ["commit", "-m", "Auto update"], () => {
            runCommand("git", ["push", `https://etiqotwf:${GITHUB_TOKEN}@github.com/etiqotwf/liveServer1.git`, "main"], () => {
                console.log("✅ All changes successfully pushed to GitHub!");
            });
        });
    });
}

// ✅ إضافة تهديد وتحديث GitHub تلقائيًا
app.post('/api/add-threat', (req, res) => {
    const { ip, method, threatType } = req.body;

    if (!ip || !method || !threatType) {
        return res.status(400).json({ message: '❌ Missing threat data' });
    }

    const timestamp = new Date().toISOString();
    const newLine = `${timestamp},${ip},${method},${threatType}\n`;

    try {
        fs.appendFileSync(logPath, newLine);
        console.log(`✅ Threat added: ${ip}, ${method}, ${threatType}`);

        // 🔁 تحديث GitHub تلقائيًا
        pushToGitHub();

        res.status(200).json({ message: '✅ Threat added and pushed to GitHub' });
    } catch (err) {
        console.error("❌ Failed to write threat:", err);
        res.status(500).json({ message: '❌ Failed to write threat' });
    }
});
