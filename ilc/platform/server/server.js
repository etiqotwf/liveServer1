// ===== Imports =====
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import fs from "fs";
import https from "https";
import { exec, spawn } from "child_process";
import { fileURLToPath } from "url";

// ===== Fix __dirname for ES Modules =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== App & Server =====
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});
const PORT = 3000;


let serverUrl = "";
const logDir = './public/logs';
const logPath = path.join(logDir, 'threats.csv');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
    console.error("❌ GitHub token not found in environment variables!");
    process.exit(1);
}

// ✅ Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ✅ إنشاء مجلد logs داخل public إن لم يكن موجودًا
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, 'Timestamp,IP,Method,ThreatType\n');
}

// ✅ API لتسجيل التهديد
app.post('/api/logs', (req, res) => {
  const { timestamp, ip, method, threatType } = req.body;

  // ✅ استبدال الذكاء الاصطناعي بخط تسجيل بسيط
const logLine = `${timestamp},${ip},${method},${threatType},manual\n`;
fs.appendFileSync(logPath, logLine);
res.status(200).json({ message: '✅ Threat logged without AI (analyzed in frontend)', action: "manual" });

});


// ✅ API لعرض التهديدات
app.get('/api/logs', (req, res) => {
    if (!fs.existsSync(logPath)) return res.json([]);
    const data = fs.readFileSync(logPath, 'utf-8').trim().split('\n').slice(1);
    const logs = data.map(line => {
        const [timestamp,ip,method,threatType,action
] = line.split(',');
        return { timestamp,ip,method,threatType,action
 };
    });
    res.json(logs.reverse());
});

// ✅ API لعرض ملف CSV من GitHub
app.get('/api/threats', (req, res) => {
    const githubUrl = 'https://raw.githubusercontent.com/etiqotwf/liveServer1/main/public/logs/threats.csv';
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
    res.download(logPath);
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

// ✅ API للحصول على ngrok URL
app.get("/ngrok-url", (req, res) => {
    if (serverUrl) {
        res.json({ serverUrl });
    } else {
        res.status(500).json({ message: "ngrok has not started yet!" });
    }
});

io.on("connection", socket => {
  console.log("🟢 User connected:", socket.id);

  socket.on("joinRoom", courseId => {
    socket.join(courseId);
    console.log(`📚 User joined course: ${courseId}`);
  });

  socket.on("sendMessage", data => {
    io.to(data.courseId).emit("newMessage", data);
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});



// ✅ بدء الخادم و ngrok
server.listen(PORT, () => {
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

// ✅ تحليل رد ngrok
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

// ✅ رفع الملفات إلى GitHub
function runCommand(command, args, callback) {
    const process = spawn(command, args);

    process.stdout.on("data", (data) => console.log(`stdout: ${data}`));
    process.stderr.on("data", (data) => console.error(`stderr: ${data}`));

    process.on("close", (code) => {
        if (code !== 0) return console.error(`❌ Command failed: ${command} ${args.join(" ")}`);
        callback();
    });
}

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

// ✅ API لإضافة تهديد وتحديث GitHub
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

        pushToGitHub();

        res.status(200).json({ message: '✅ Threat added and pushed to GitHub' });
    } catch (err) {
        console.error("❌ Failed to write threat:", err);
        res.status(500).json({ message: '❌ Failed to write threat' });
    }
});
