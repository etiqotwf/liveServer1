import { exec } from "child_process";
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import cliTable from "cli-table3";
import inquirer from "inquirer";
import chalk from "chalk";
import figlet from "figlet";
import boxen from "boxen";
import ora from "ora";
import terminalKit from "terminal-kit"; 
import gradient from "gradient-string";
import mammoth from "mammoth"; // مكتبة استخراج نصوص من docx
import xlsx from "xlsx";
import pdfParse from "pdf-parse";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { transliterate } from "transliteration";
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib'; // تستخدم لتحويل الصور إلى PDF
import { c } from 'tar';
import promptSync from "prompt-sync";
import crypto from 'crypto';
import os from 'os';
import archiver from "archiver";




const prompt = promptSync({ sigint: true });

const tempDir = "temp"; // مجلد مؤقت لفك تشفير الملفات


const encryptionKey = crypto.randomBytes(32); // يجب حفظ هذا المفتاح لاسترجاع الملفات لاحقًا





const { terminal } = terminalKit; // استخراج `terminal`


const passwordFile = path.join(process.cwd(), 'password.json');

const secretKey = crypto.scryptSync('mySuperSecretKey', 'salt', 32);
const iv = Buffer.alloc(16, 0);

function encrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// إذا الملف مش موجود، ننشئه بباسورد افتراضي مشفر
if (!fs.existsSync(passwordFile)) {
  const defaultPassword = {
    password: encrypt("1234")
  };
  fs.writeFileSync(passwordFile, JSON.stringify(defaultPassword, null, 2), 'utf8');
  console.log("✅ password.json file created with encrypted password.");
} else {
  console.log("📄 password.json already exists.");
}







// تحويل fileURL إلى path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'archive.db');

// التأكد من وجود قاعدة البيانات قبل محاولة حذفها
const dbExists = fs.existsSync(dbPath);

// فتح قاعدة البيانات
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return;

    // إنشاء الجدول إذا لم يكن موجودًا
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS archived_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            file_extension TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            original_path TEXT NOT NULL,
            archived_path TEXT NOT NULL,
            archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;

    db.run(createTableQuery, (err) => {
        if (err) return;

        // التحقق من وجود الأعمدة encryption_key و encrypted_data
        db.all("PRAGMA table_info(archived_files);", (err, rows) => {
            if (err) return;

            const columns = rows.map(row => row.name);
            if (!columns.includes("encryption_key")) {
                db.run("ALTER TABLE archived_files ADD COLUMN encryption_key TEXT;", (err) => {
                    if (err) return;
                });
            }

            if (!columns.includes("encrypted_data")) {
                db.run("ALTER TABLE archived_files ADD COLUMN encrypted_data BLOB;", (err) => {
                    if (err) return;
                });
            }

            // التحقق من وجود سجلات
            db.get(`SELECT COUNT(*) AS count FROM archived_files`, (err, row) => {
                if (err) return;

                if (row.count > 0) {
                    return;
                } else if (dbExists) {
                    db.run(`DELETE FROM archived_files`, (err) => {
                        if (err) return;

                        // إعادة تعيين العداد AUTOINCREMENT
                        db.run(`DELETE FROM sqlite_sequence WHERE name='archived_files'`, (err) => {
                            if (err) return;
                        });
                    });
                }
            });
        });
    });
});

// إنشاء مجلد الأرشيف إذا لم يكن موجودًا
const archiveDir = path.join(__dirname, 'archive');

if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir);
}


// دالة لفتح قاعدة البيانات والتحقق من وجود الأعمدة وإنشاء الجدول
function manageDatabase() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dbPath = path.join(__dirname, 'archive.db');

    // التأكد من وجود قاعدة البيانات قبل محاولة حذفها
    const dbExists = fs.existsSync(dbPath);

    // فتح قاعدة البيانات
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("❌ Error opening database:", err.message);
            return;
        }

        console.log("✅ Database opened successfully.");

        // إنشاء الجدول إذا لم يكن موجودًا
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS archived_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                file_extension TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                original_path TEXT NOT NULL,
                archived_path TEXT NOT NULL,
                archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        db.run(createTableQuery, (err) => {
            if (err) {
                console.error("❌ Error creating table:", err.message);
                return;
            }

            console.log("✅ Table 'archived_files' checked/created successfully.");

            // التحقق من وجود الأعمدة encryption_key و encrypted_data
            db.all("PRAGMA table_info(archived_files);", (err, rows) => {
                if (err) {
                    console.error("❌ Error checking table schema:", err.message);
                    return;
                }

                const columns = rows.map(row => row.name);
                if (!columns.includes("encryption_key")) {
                    db.run("ALTER TABLE archived_files ADD COLUMN encryption_key TEXT;", (err) => {
                        if (err) {
                            console.error("❌ Error adding encryption_key column:", err.message);
                        } else {
                            console.log("✅ encryption_key column added successfully.");
                        }
                    });
                }

                if (!columns.includes("encrypted_data")) {
                    db.run("ALTER TABLE archived_files ADD COLUMN encrypted_data BLOB;", (err) => {
                        if (err) {
                            console.error("❌ Error adding encrypted_data column:", err.message);
                        } else {
                            console.log("✅ encrypted_data column added successfully.");
                        }
                    });
                }

                // حذف جميع السجلات مباشرة بدون التحقق من عددها
                if (dbExists) {
                    console.log("🗑️ Deleting all entries...");

                    db.run(`DELETE FROM archived_files`, (err) => {
                        if (err) {
                            console.error("❌ Error deleting records:", err.message);
                            return;
                        }
                        console.log("✅ All records deleted.");

                        // إعادة تعيين العداد AUTOINCREMENT
                        db.run(`DELETE FROM sqlite_sequence WHERE name='archived_files'`, (err) => {
                            if (err) {
                                console.error("❌ Error resetting AUTOINCREMENT:", err.message);
                            } else {
                                console.log("✅ AUTOINCREMENT reset successfully.");
                            }
                        });

                        // حذف مجلد الأرشيف بعد حذف البيانات
                        const archiveDir = path.join(__dirname, 'archive');
                        if (fs.existsSync(archiveDir)) {
                            fs.rmSync(archiveDir, { recursive: true, force: true });
                            console.log(`✅ Deleted archive directory: ${archiveDir}`);
                        }
                    });
                }
            });
        });
    });

    // إنشاء مجلد الأرشيف إذا لم يكن موجودًا
    const archiveDir = path.join(__dirname, 'archive');
    console.log(`📂 Archive directory: ${archiveDir}`);

    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir);
        console.log(`✅ Created directory: ${archiveDir}`);
    }
    

}




function openFile(id) {
    db.get("SELECT archived_path, encryption_key FROM archived_files WHERE id = ?", [id], (err, row) => {
        if (err) return console.error("❌ Error retrieving file:", err.message);
        if (!row) return console.log("❌ File not found.");

        const encryptedFilePath = row.archived_path;
        const fileName = path.basename(encryptedFilePath, ".enc");
        const decryptedPath = path.join(archiveDir, fileName);
        const encryptionKey = Buffer.from(row.encryption_key, 'hex');
        const iv = Buffer.alloc(16, 0);

        const decryptStream = () => {
            return new Promise((resolve, reject) => {
                const decipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey, iv);
                const input = fs.createReadStream(encryptedFilePath);
                const output = fs.createWriteStream(decryptedPath);

                input.pipe(decipher).pipe(output);

                output.on("finish", resolve);
                output.on("error", reject);
                input.on("error", reject);
            });
        };

        const encryptStream = () => {
            return new Promise((resolve, reject) => {
                const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv);
                const input = fs.createReadStream(decryptedPath);
                const output = fs.createWriteStream(encryptedFilePath);

                input.pipe(cipher).pipe(output);

                output.on("finish", () => {
                    exec(`powershell -Command "Remove-Item -Path '${decryptedPath}' -Force"`, (err) => {
                        if (err) {
                            console.error("❌ Failed to delete decrypted file:", err.message);
                        } else {
                            console.log(`✅ Decrypted file deleted successfully: ${decryptedPath}`);
                        }
                        resolve();
                    });
                });

                output.on("error", reject);
                input.on("error", reject);
            });
        };

        // تنفيذ فك التشفير ثم التشغيل
        decryptStream()
            .then(() => {
                console.log(`✅ File successfully decrypted: ${decryptedPath}`);

                let child;
                const startTime = Date.now();

                try {
                    child = exec(`"${decryptedPath}"`);
                } catch (err) {
                    console.warn("⚠️ Failed to launch player, will re-encrypt after timeout.");
                    setTimeout(encryptStream, 60000);
                    return;
                }

                // إعادة التشفير عند إغلاق البرنامج
                child.on('exit', () => {
                    const duration = (Date.now() - startTime) / 1000;
                    if (duration < 5) {
                        console.warn("⚠️ Player closed too quickly. Scheduling delayed re-encryption...");
                        setTimeout(encryptStream, 30000);
                    } else {
                        console.log("📁 Media app closed. Starting encryption...");
                        encryptStream();
                    }
                });

                // fallback احتياطي بعد 5 دقائق
                setTimeout(() => {
                    if (fs.existsSync(decryptedPath)) {
                        console.warn("⚠️ Fallback triggered: forcing re-encryption after timeout.");
                        encryptStream();
                    }
                }, 5 * 60 * 1000);
            })
            .catch(err => {
                console.error("❌ Error decrypting or opening file:", err);
            });
    });
}





async function searchFiles() {
    const { keyword, fromDate, toDate, minSizeKB, maxSizeKB } = await inquirer.prompt([
        {
            type: "input",
            name: "keyword",
            message: "🔍 Enter search keyword (name, date, extension, path, or content):"
        },
        {
            type: "input",
            name: "fromDate",
            message: "📅 From date (YYYY-MM-DD) [optional]:"
        },
        {
            type: "input",
            name: "toDate",
            message: "📅 To date (YYYY-MM-DD) [optional]:"
        },
        {
            type: "input",
            name: "minSizeKB",
            message: "📏 Minimum file size in KB [optional]:"
        },
        {
            type: "input",
            name: "maxSizeKB",
            message: "📏 Maximum file size in KB [optional]:"
        }
    ]);

    // تحويل الأحجام من KB إلى Bytes
    const minSize = minSizeKB ? parseInt(minSizeKB) * 1024 : null;
    const maxSize = maxSizeKB ? parseInt(maxSizeKB) * 1024 : null;

    // بناء الاستعلام والبارامترات ديناميكيًا
    let query = `
        SELECT * FROM archived_files 
        WHERE (file_name LIKE ? 
        OR file_extension LIKE ? 
        OR archived_at LIKE ? 
        OR archived_path LIKE ?)
    `;
    let params = Array(4).fill(`%${keyword}%`);

    if (fromDate) {
        query += ` AND date(archived_at) >= date(?)`;
        params.push(fromDate);
    }

    if (toDate) {
        query += ` AND date(archived_at) <= date(?)`;
        params.push(toDate);
    }

    if (minSize) {
        query += ` AND file_size >= ?`;
        params.push(minSize);
    }

    if (maxSize) {
        query += ` AND file_size <= ?`;
        params.push(maxSize);
    }

    try {
        let rows = await new Promise((resolve, reject) => {
            db.all(query, params, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        if (rows.length === 0) {
            console.log(chalk.yellow("⚠️ No matching files found."));
            return;
        }

        let resultsText = `=======================================\n`;
        resultsText += `📂 🔍 Search Results (${new Date().toLocaleString("en-US")}) - Total: ${rows.length} files\n`;
        resultsText += `=======================================\n\n`;

        const table = new cliTable({
            head: [
                chalk.white("🆔 ID"), chalk.white("📜 Name"), chalk.white("🗂️ Ext"), chalk.white("📏 Size (KB)"), chalk.white("📅 Date Archived"), chalk.white("📍 Path")
            ],
            colWidths: [5, 25, 8, 12, 18, 50],
            wordWrap: true
        });

        for (let row of rows) {
            table.push([
                row.id,
                row.file_name,
                row.file_extension,
                (row.file_size / 1024).toFixed(2),
                row.archived_at,
                row.archived_path
            ]);

            resultsText += `🆔 ${row.id}\n`;
            resultsText += `📜 Name: ${row.file_name}\n`;
            resultsText += `🗂️ Extension: ${row.file_extension}\n`;
            resultsText += `📏 Size: ${(row.file_size / 1024).toFixed(2)} KB\n`;
            resultsText += `📅 Date Archived: ${row.archived_at}\n`;
            resultsText += `📍 Path: ${row.archived_path}\n`;
            resultsText += `---------------------------------------\n`;
        }

        console.log(table.toString());

        const fileName = "search_results.txt";
        fs.writeFileSync(fileName, resultsText, "utf8");
        console.log(chalk.blue(`📂 Search results saved in: ${fileName}`));

        const { openFile } = await inquirer.prompt([
            {
                type: "confirm",
                name: "openFile",
                message: "📄 Do you want to open the search results file?",
                default: false
            }
        ]);

        if (openFile) {
            exec(`"${fileName}"`, (err) => {
                if (err) {
                    console.error(chalk.red(`❌ Error opening file: ${fileName}`));
                }
            });
        }

    } catch (error) {
        console.error(chalk.red("❌ Error searching records:"), error.message);
    }
}
// دالة لفتح متصفح الملفات



/// مسار ملف الإكسل
const excelFilePath = path.join(archiveDir, 'archived_files.xlsx');

// Function to check if the file is locked (opened by another program)
function isFileLocked(filePath) {
    try {
        const fileDescriptor = fs.openSync(filePath, 'r+'); // Try to open the file for reading and writing
        fs.closeSync(fileDescriptor); // Close it immediately if successful
        return false; // File is not locked
    } catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
            return true; // File is locked or being used
        }
        throw err; // Other errors
    }
}

async function waitForFileToUnlock(filePath, retries = 50, delay = 10000) {
    for (let i = 0; i < retries; i++) {
        if (!isFileLocked(filePath)) {
            return true; // File is now unlocked
        }
        console.log(`🔄 Waiting for file to be closed... Attempt ${i + 1}/${retries}`);
        await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
    }
    return false; // Still locked after all retries
}


async function updateExcelFile(newRecord) {

    try {
        // ✅ First, check if the Excel file is open
        if (fs.existsSync(excelFilePath)) {
            const unlocked = await waitForFileToUnlock(excelFilePath);
            if (!unlocked) {
                console.error("❌ The Excel file is still open after multiple attempts. Update canceled.");
                return;
            }
        }
        
    
        let workbook;
        let worksheet;
        let data = [];

        // تحميل الملف أو إنشاء جديد
        if (fs.existsSync(excelFilePath)) {
            workbook = xlsx.readFile(excelFilePath);
            const sheetName = workbook.SheetNames[0];
            worksheet = workbook.Sheets[sheetName];
            if (worksheet) {
                data = xlsx.utils.sheet_to_json(worksheet);
            }
        } else {
            workbook = xlsx.utils.book_new();
        }

        newRecord.id = data.length + 1;
        newRecord.archive_date = new Date().toLocaleString('en-GB');

        delete newRecord.encryption_key;
        delete newRecord.encrypted_data;

        data.push(newRecord);

        worksheet = xlsx.utils.json_to_sheet(data);

        worksheet["!cols"] = [
            { wch: 20 },
            { wch: 12 },
            { wch: 12 },
            { wch: 15 },
            { wch: 45 },
            { wch: 20 },
            { wch: 5 }
        ];

        // حذف الشيتات القديمة
        if (workbook.SheetNames.length > 0) {
            workbook.SheetNames.forEach(sheetName => {
                delete workbook.Sheets[sheetName];
            });
            workbook.SheetNames = [];
        }

        xlsx.utils.book_append_sheet(workbook, worksheet, "Archived Files");

        xlsx.writeFile(workbook, excelFilePath);

        console.log(`✅ Excel file updated successfully: ${excelFilePath}`);
    } catch (error) {
        console.error("❌ Error updating Excel file:", error);
    }
}


// الكود الرئيسي بعد التعديل
export async function archiveFile(filePath) {
    const fileName = path.basename(filePath);
    const archiveFileName = fileName + ".enc";
    const archivePath = path.join(archiveDir, archiveFileName);
    const fileExtension = path.extname(fileName).slice(1);
    const fileSize = fs.statSync(filePath).size;

    try {
        const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, Buffer.alloc(16, 0));

        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(archivePath);

        // عملية التشفير والتخزين باستخدام Stream
        input.pipe(cipher).pipe(output);

        // عند الانتهاء من الكتابة
        output.on('finish', () => {
            console.log(`✅ File successfully encrypted and archived as: ${archiveFileName}`);
            console.log(`📄 Original file remains unchanged: ${filePath}`);

            // لا يمكن حفظ البيانات المشفرة مباشرة (encryptedData) لأنها لم تُقرأ بالكامل
            db.run(
                `INSERT INTO archived_files (file_name, file_extension, file_size, original_path, archived_path, encryption_key, encrypted_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [fileName, fileExtension, fileSize, filePath, archivePath, encryptionKey.toString("hex"), null], // null لعدم وجود encryptedData
                function (err) {
                    if (err) {
                        console.error("❌ Error saving record to database:", err.message);
                    } else {
                        console.log(`📂 File record saved in database (ID: ${this.lastID})`);
                        updateExcelFile({
                            file_name: fileName,
                            file_extension: fileExtension,
                            file_size: fileSize,
                            original_path: filePath,
                            archived_path: archivePath,
                            archive_date: new Date().toLocaleString("en-GB")
                        });
                    }
                }
            );
        });

        output.on('error', (err) => {
            console.error("❌ Error during writing file:", err);
        });

    } catch (err) {
        console.error("❌ Error setting up encryption stream:", err);
    }
}





// 📦 ضغط المجلد إلى .zip
function zipFolder(sourceFolder, zipPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", () => resolve());
        archive.on("error", err => reject(err));

        archive.pipe(output);
        archive.directory(sourceFolder, false);
        archive.finalize();
    });
}

// 🔐 أرشفة وتشفير المجلد
export async function archiveFolder(folderPath) {
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        console.error("❌ Not a valid folder:", folderPath);
        return;
    }

    let folderName = path.basename(folderPath);

    // ✅ تحويل الاسم العربي إلى إنجليزي آمن
let cleanFolderName = transliterate(folderName).replace(/[^a-zA-Z0-9-_]/g, "");
    if (!cleanFolderName) cleanFolderName = "ArchivedFolder";

    const zipPath = path.join(archiveDir, `${cleanFolderName}.zip`);
    const encryptedPath = zipPath + ".enc";

    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }

    try {
        console.log("📦 Zipping folder...");
        await zipFolder(folderPath, zipPath);

        console.log("🔐 Encrypting...");
        const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, Buffer.alloc(16, 0));
        const input = fs.createReadStream(zipPath);
        const output = fs.createWriteStream(encryptedPath);

        input.pipe(cipher).pipe(output);

        output.on("finish", () => {
            console.log("✅ Folder zipped and encrypted as:", encryptedPath);

            // 🧹 حذف النسخة غير المشفرة
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
                console.log("🗑️ Unencrypted ZIP file removed:", zipPath);
            }

            const fileSize = fs.statSync(encryptedPath).size;

            // 💾 حفظ في قاعدة البيانات
            db.run(
                `INSERT INTO archived_files (
                    file_name,
                    file_extension,
                    file_size,
                    original_path,
                    archived_path,
                    encryption_key,
                    encrypted_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    cleanFolderName,
                    "folder",
                    fileSize,
                    folderPath,
                    encryptedPath,
                    encryptionKey.toString("hex"),
                    null
                ],
                function (err) {
                    if (err) {
                        console.error("❌ Error saving to DB:", err.message);
                    } else {
                        console.log(`📁 Folder archived and saved in DB (ID: ${this.lastID})`);

                        // 📊 تحديث ملف الإكسل
                        updateExcelFile({
                            file_name: cleanFolderName,
                            file_extension: "folder",
                            file_size: fileSize,
                            original_path: folderPath,
                            archived_path: encryptedPath,
                            archive_date: new Date().toLocaleString("en-GB")
                        });
                    }
                }
            );
        });

        output.on("error", (err) => {
            console.error("❌ Error during encryption:", err.message);
        });

    } catch (err) {
        console.error("❌ General archiving error:", err.message);
    }
}




// دالة لعرض الملفات المؤرشفة في جدول
async function listArchivedFiles() {
    const spinner = ora("📦 Fetching archived files...").start();

    const tableData = [];

    db.each(
        "SELECT * FROM archived_files",
        (err, row) => {
            if (err) {
                spinner.fail("❌ Error fetching records: " + err.message);
                return;
            }

            tableData.push([
                row.id?.toString() || "",
                row.file_name || "",
                row.file_extension || "",
                row.file_size ? (row.file_size / 1024).toFixed(2) + " KB" : "",
                row.archived_at || "",
                row.archived_path || ""
            ]);
        },
        (err, count) => {
            if (err) {
                spinner.fail("❌ Error completing fetch: " + err.message);
                return;
            }

            spinner.succeed(`🔍 Retrieved ${count} rows.`);

            if (count === 0) {
                console.log("📂 No archived files found.");
                return;
            }

            terminal.clear();
            terminal.table(
                [["ID", "Name", "Extension", "Size (KB)", "Date Archived", "Path"], ...tableData],
                {
                    hasBorder: true,
                    borderChars: "lightRounded",
                    width: terminal.width - 2,
                    fit: true
                }
            );

            terminal("\nUse ↑ ↓ to scroll, Press 'q' to exit.\n");

            terminal.grabInput({ mouse: "button" });

            terminal.on("key", (key) => {
                if (key === "q") {
                    terminal("\nExiting...\n");
                    process.exit();
                }
            });
        }
    );
}



// دالة لحذف ملف من الأرشيف وإعادته إلى مساره الأصلي
async function restoreFile(id) {
    db.get("SELECT * FROM archived_files WHERE id = ?", [id], async (err, row) => {
        if (err) {
            console.error("❌ Error retrieving file:", err.message);
            return;
        }

        if (!row) {
            console.log("❌ File not found.");
            return;
        }

        const encryptedPath = row.archived_path;        // المسار المشفر
        const originalPath = row.original_path;          // المسار الأصلي للملف
        const encryptionKey = Buffer.from(row.encryption_key, 'hex'); // مفتاح التشفير

        try {
            // فك التشفير إلى المسار الأصلي
            await decryptFile(encryptedPath, originalPath, encryptionKey, null, true);

            // حذف الملف المشفر بعد نجاح فك التشفير
            fs.unlinkSync(encryptedPath);

            // حذف السجل من قاعدة البيانات
            db.run("DELETE FROM archived_files WHERE id = ?", [id], (err) => {
                if (err) {
                    console.error("❌ Error deleting record:", err.message);
                } else {
                    console.log(`✅ File restored successfully and decrypted: ${originalPath}`);
                }
            });
        } catch (err) {
            console.error("❌ Error restoring file:", err);
        }
    });
}


// دالة لحذف ملف نهائيًا من الأرشيف وقاعدة البيانات
async function deleteFile(id) {
    db.get("SELECT archived_path FROM archived_files WHERE id = ?", [id], async (err, row) => {
        if (err) {
            console.error("❌ Error retrieving file:", err.message);
            return;
        }

        if (!row) {
            console.log("❌ File not found.");
            return;
        }

        // طلب تأكيد المستخدم قبل الحذف
        const { confirm } = await inquirer.prompt([
            {
                type: "confirm",
                name: "confirm",
                message: chalk.red(`⚠️ Are you sure you want to delete this file permanently?`),
                default: false,
            },
        ]);

        if (!confirm) {
            console.log("🚫 Deletion cancelled.");
            return;
        }

        try {
            fs.unlinkSync(row.archived_path);
            db.run("DELETE FROM archived_files WHERE id = ?", [id], (err) => {
                if (err) {
                    console.error("❌ Error deleting record:", err.message);
                } else {
                    console.log("✅ File deleted permanently.");
                }
            });
        } catch (err) {
            console.error("❌ Error deleting file:", err);
        }
    });
}



function printTitle() {
    console.clear();
    
    console.log(
        gradient.pastel.multiline(
            figlet.textSync("File Manager", { 
                font: "Big",
                horizontalLayout: "full",
                verticalLayout: "default"
            })
        )
    );

    console.log(
        boxen(chalk.bold.white("Information Security and Data Archiving Module ensures secure data management and archiving in the File Management System!"), { 
            padding: 1,  
            margin: .5,  
            backgroundColor: "black",
            borderStyle: "bold", 
            borderColor: "cyan", 
            align: "center"
        })
    );

    // جلب الوقت والتاريخ الحالي
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-GB'); // HH:mm:ss
    const formattedDate = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeAndDate = ` ${formattedTime}  ${formattedDate}`;

    // جلب الإحصائيات من الأرشيف
    const archiveStats = getArchiveStats();
    let statsMessage = "";

    if (archiveStats) {
        statsMessage = ` Total: ${archiveStats.total} | PDF: ${archiveStats.types.pdf} | DOCX: ${archiveStats.types.docx} | TXT: ${archiveStats.types.txt} | Excel: ${archiveStats.types.xlsx + archiveStats.types.xls} | Images: ${archiveStats.types.jpg + archiveStats.types.jpeg} | Other: ${archiveStats.types.other}`;
    } else {
        statsMessage = " No files found in archive.";
    }

    // حساب حجم قاعدة البيانات (الأرشيف)
    const archiveSize = getArchiveSize();
    
    // طباعة الإحصائيات بجانب التاريخ والوقت
    console.log(
        boxen(
            chalk.bold.yellow(`${statsMessage} | Database Size: ${archiveSize} MB | ${timeAndDate}`), {
                padding: .5,
                margin: 1,
                backgroundColor: "black",
                borderStyle: "bold",
                borderColor: "cyan",
                align: "center"
            }
        )
    );

    console.log(
        chalk.underline(
            gradient(['#FF4500', '#FFA500', '#FFFF00'])(" Designed by Ahmed Amer\n")
        )
    );
}

// دالة لحساب حجم قاعدة البيانات (الأرشيف)
function getArchiveSize() {
    let totalSize = 0;
    const archiveFolderPath = './archive'; // مسار المجلد الذي يحتوي على الملفات في قاعدة البيانات

    // جلب جميع الملفات داخل المجلد
    const files = fs.readdirSync(archiveFolderPath);

    files.forEach(file => {
        const filePath = path.join(archiveFolderPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
            totalSize += stats.size; // إضافة حجم الملف للمجموع
        }
    });

    // تحويل الحجم إلى ميغابايت (MB)
    return (totalSize / (1024 * 1024)).toFixed(2);
}
// مسار مجلد الأرشيف
const archiveDirectory = path.resolve(__dirname, 'archive');  // استبدل هذا بمسار مجلد الأرشيف الفعلي لديك

// دالة لإحضار إحصائيات الأرشيف
function getArchiveStats() {
    const archiveFiles = getArchiveFiles(); // جلب الملفات من الأرشيف
    if (archiveFiles.length === 0) {
        return null;
    }

    // تصنيف الملفات حسب النوع
    const fileTypes = {
        pdf: 0,
        docx: 0,
        txt: 0,
        xlsx: 0,
        xls: 0,
        jpg: 0,
        jpeg: 0,
        other: 0
    };

    // تصنيف الملفات حسب النوع
    archiveFiles.forEach(file => {
        // إزالة وسم 'enc' إن وجد
        const originalName = file.replace(/\.enc$/, '');  
        const ext = path.extname(originalName).toLowerCase();

        if (ext === '.pdf') fileTypes.pdf++;
        else if (ext === '.docx') fileTypes.docx++;
        else if (ext === '.txt') fileTypes.txt++;
        else if (ext === '.xlsx') fileTypes.xlsx++;
        else if (ext === '.xls') fileTypes.xls++;
        else if (ext === '.jpg') fileTypes.jpg++;
        else if (ext === '.jpeg') fileTypes.jpeg++;
        else fileTypes.other++;
    });

    return {
        total: archiveFiles.length,
        types: fileTypes
    };
}

// دالة لإحضار الملفات من الأرشيف
function getArchiveFiles() {
    try {
        // قراءة الملفات من مجلد الأرشيف
        const files = fs.readdirSync(archiveDirectory);
        return files.filter(file => fs.statSync(path.join(archiveDirectory, file)).isFile());
    } catch (err) {
        console.error(chalk.red('Error reading archive directory:', err));
        return [];
    }
}





async function requestPassword() {
  const data = JSON.parse(fs.readFileSync(passwordFile, 'utf8'));
  const storedEncryptedPassword = data.password;
  const correctPassword = decrypt(storedEncryptedPassword);

  const { password } = await inquirer.prompt([
    {
      type: "password",
      name: "password",
      message: chalk.green("🔑 Please Enter Password : "),
      mask: "*"
    }
  ]);

  if (password !== correctPassword) {
    console.log(chalk.yellowBright("❌ Wrong Password"));
    process.exit();
  }
}


// دالة تغيير الباسورد
async function changePassword() {
  const data = JSON.parse(fs.readFileSync(passwordFile, 'utf8'));
  const storedEncryptedPassword = data.password;
  const correctPassword = decrypt(storedEncryptedPassword);

  const { oldPassword } = await inquirer.prompt([
    {
      type: "password",
      name: "oldPassword",
      message: chalk.green("🔐 Enter current password: "),
      mask: "*"
    }
  ]);

  if (oldPassword !== correctPassword) {
    console.log(chalk.red("❌ Incorrect current password."));
    return;
  }

  const { newPassword, confirmPassword } = await inquirer.prompt([
    {
      type: "password",
      name: "newPassword",
      message: chalk.green("🔐 Enter new password: "),
      mask: "*"
    },
    {
      type: "password",
      name: "confirmPassword",
      message: chalk.green("🔐 Confirm new password: "),
      mask: "*"
    }
  ]);

  if (newPassword !== confirmPassword) {
    console.log(chalk.red("❌ Passwords do not match."));
    return;
  }

  // تشفير وحفظ الباسورد الجديد
  data.password = encrypt(newPassword);
  fs.writeFileSync(passwordFile, JSON.stringify(data, null, 2), 'utf8');

  console.log(chalk.green("✅ Password changed successfully."));
}



async function convertImageToPdf(imagePath, pdfPath) {
    const image = await sharp(imagePath).toBuffer();
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const img = await pdfDoc.embedJpg(image);
    page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(pdfPath, pdfBytes);
    console.log(`✅ Image converted to PDF: ${pdfPath}`);
}

async function convertPdfToDocx(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: The file is not found at the path: ${filePath}`);
        return;
    }

    const extname = path.extname(filePath).toLowerCase();

   // ✅ التعامل مع Excel وتحويله إلى JSON
if (extname === ".xlsx") {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    // تحويل المفاتيح من رموز إلى أسماء مفهومة
    const mappedData = rawData.map((row, index) => ({
        id: index + 1,
        name: row["👤 الاسم"] || "",
        phone: row["📞 الهاتف"] || "",
        email: row["📧 الإدارة"] || "",
        qualification: row["🎓 المؤهل"] || "",
        job: row["💼 الوظيفة"] || "",
        course: row["📚 الدورة"] || "",
        duration: row["⏳ المدة"] || "",
        type: row["⚧ الاقامة"] || "",
        datetime: row["📅 تاريخ ووقت التسجيل"] || ""
    }));

    const outputJson = filePath.replace(/\.xlsx$/, ".json");
    fs.writeFileSync(outputJson, JSON.stringify(mappedData, null, 2));
    console.log(`✅ Excel converted to mapped JSON: ${outputJson}`);
    return;
}

    // ✅ إذا كانت صورة، نحولها أولًا إلى PDF
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(extname)) {
        const tempPdfPath = filePath.replace(extname, '.pdf');
        await convertImageToPdf(filePath, tempPdfPath);
        filePath = tempPdfPath; // نستخدم PDF المحول
    }

    // ✅ تحويل PDF إلى DOCX
    const outputDocxPath = filePath.replace(/\.pdf$/, ".docx");
    const pdfBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text.trim();
    const paragraphs = extractedText.split("\n").filter(p => p.trim() !== "");

    const doc = new Document({
        sections: [{
            properties: {},
            children: paragraphs.map(paragraph => {
                const isTitle = paragraph.includes(":") || paragraph.split(" ").length <= 5;
                return new Paragraph({
                    bidirectional: true,
                    children: [
                        new TextRun({
                            text: paragraph,
                            bold: isTitle,
                            size: isTitle ? 32 : 26,
                            font: "Arial",
                        }),
                    ],
                    spacing: { after: isTitle ? 250 : 150 },
                });
            }),
        }],
    });

    const docBuffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputDocxPath, docBuffer);
    console.log(`✅ Conversion successful: ${outputDocxPath}`);
}







export async function mainMenu() {
  while (true) {
    printTitle();

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        prefix: " ",
        message: "",
        choices: [
         { key: "A", name: "\x1b[1m\x1b[33m[1] [A] Archive a Secure File\x1b[0m", value: "archive" },
                    { key: "AF", name: "\x1b[1m\x1b[33m[2] [AF] Archive a Folder\x1b[0m", value: "archiveFolder" },
                    { key: "L", name: "\x1b[1m\x1b[36m[3] [L] List archived files\x1b[0m", value: "list" },
                    { key: "S", name: "\x1b[1m\x1b[38;5;10m[4] [S] Search for files\x1b[0m", value: "search" },
                    { key: "SI", name: "\x1b[1m\x1b[38;5;154m[5] [SI] Search inside a file\x1b[0m", value: "searchInside" },
                    { key: "C", name: "\x1b[1m\x1b[38;5;49m[6] [C] Convert PDF ↔ DOCX\x1b[0m", value: "convert" },
                    { key: "PDF", name: "\x1b[1m\x1b[38;5;159m[7] [PDF] Create PDF from images\x1b[0m", value: "createPdf" },
                    { key: "O", name: "\x1b[1m\x1b[38;5;223m[8] [O] Open a file\x1b[0m", value: "open" },
                    { key: "R", name: "\x1b[1m\x1b[38;5;51m[9] [R] Restore a file\x1b[0m", value: "restore" },
                    { key: "X", name: "\x1b[1m\x1b[38;5;220m[10] [X] Delete a file\x1b[0m", value: "delete" },
                    { key: "B", name: "\x1b[1m\x1b[38;5;228m[11] [B] Backup the archive folder\x1b[0m", value: "backup" },
                    { key: "DB", name: "\x1b[1m\x1b[38;5;214m[12] [DB] Reset database\x1b[0m", value: "restoreDatabase" },
                    { key: "P", name: "\x1b[1m\x1b[38;5;183m[13] [P] Change Password\x1b[0m", value: "changePassword" },
                    { key: "E", name: "\x1b[1m\x1b[37m[x] [E] Exit\x1b[0m", value: "exit" }
        ],
        pageSize: 12,
        loop: false,
      },
    ]);

    // فصل مرئي
    console.log(chalk.gray('\n────────────────────────────────────────────\n'));

    if (action === "archive") {
      console.log(chalk.yellowBright("\n📁 Archiving a secure file...\n"));
      await openFilePicker(archiveFile);

    } else if (action === "archiveFolder") {
      console.log(chalk.yellowBright("\n📂 Archiving a folder...\n"));
      try {
        const folderPath = await openFolderPicker();
        await archiveFolder(folderPath);
        console.log(chalk.green("✅ Folder archived successfully."));
      } catch (err) {
        console.error(chalk.red(err.message));
      }

    } else if (action === "list") {
      console.log(chalk.cyan("\n📄 Listing archived files...\n"));
      listArchivedFiles();

    } else if (action === "search") {
      console.log(chalk.green("\n🔍 Searching for files...\n"));
      await searchFiles();

    } else if (action === "searchInside") {
      console.log(chalk.greenBright("\n📂 Searching inside a file...\n"));
      await searchInsideFile();

    } else if (action === "convert") {
      console.log(chalk.blueBright("\n📄 Converting PDF ↔ DOCX...\n"));
      await openFilePicker(convertPdfToDocx);

    } else if (action === "createPdf") {
      console.log(chalk.cyanBright("\n🖼️ Creating PDF from images...\n"));

      const { folderPath, outputPdf } = await inquirer.prompt([
        {
          type: "input",
          name: "folderPath",
          message: "Enter the folder path containing images:",
          default: "./scanner_output"
        },
        {
          type: "input",
          name: "outputPdf",
          message: "Enter the output PDF file path:",
          default: "./scanner_output/scanned_output.pdf"
        }
      ]);

      try {
        if (!fs.existsSync(folderPath)) {
          console.log(chalk.red("❌ Folder does not exist."));
        } else {
          await createPdfFromImages(folderPath, outputPdf);
          console.log(chalk.green(`✅ PDF created successfully at ${outputPdf}`));
        }
      } catch (err) {
        console.error(chalk.red("❌ Error creating PDF:"), err.message);
      }

    } else if (action === "open") {
      const { id } = await inquirer.prompt([{ type: "input", name: "id", message: chalk.blue("🖥️ Enter file ID to open:") }]);
      openFile(parseInt(id));

    } else if (action === "restore") {
      const { id } = await inquirer.prompt([{ type: "input", name: "id", message: chalk.yellow("🔄 Enter file ID to restore:") }]);
      restoreFile(parseInt(id));

    } else if (action === "delete") {
      const { id } = await inquirer.prompt([{ type: "input", name: "id", message: chalk.red("⚠️ Enter file ID to delete:") }]);
      deleteFile(parseInt(id));

    } else if (action === "changePassword") {
      console.log(chalk.gray("\n🔑 Changing password...\n"));
      await changePassword();

    } else if (action === "backup") {
      console.log(chalk.magenta("\n💾 Creating a backup...\n"));

      const { backup } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'backup',
          message: 'Do you want to create a backup of the archive folder?',
          default: false,
        },
      ]);

      if (backup) {
        const archiveFolderPath = path.join(__dirname, 'archive');
        const backupFolderPath = 'G:/Backup/ArchiveBackup';
        const backupFilePath = path.join(backupFolderPath, 'archive_backup.tar.gz');

        if (!fs.existsSync(backupFolderPath)) {
          fs.mkdirSync(backupFolderPath, { recursive: true });
        }

        try {
          await c(
            {
              gzip: true,
              file: backupFilePath,
              cwd: path.dirname(archiveFolderPath),
            },
            [path.basename(archiveFolderPath)]
          );
          console.log(chalk.green(`✅ Backup created successfully at ${backupFilePath}`));
        } catch (error) {
          console.error(chalk.red(`Error creating backup: ${error.message}`));
        }
      }

    } else if (action === "restoreDatabase") {
      console.log(chalk.magenta("\n🛠️ Restoring the database...\n"));

      const { restoreDb } = await inquirer.prompt([{
        type: 'confirm',
        name: 'restoreDb',
        message: 'Do you want to restore the database?',
        default: false,
      }]);

      if (restoreDb) {
        manageDatabase();
      }

    } else {
      console.log(chalk.magenta("\n👋 Exiting... Have a great day!\n"));
      process.exit();
    }

    // نهاية كل تنفيذ
    await inquirer.prompt([{ type: "input", name: "pause", message: chalk.gray("\nPress ENTER to return to the main menu...") }]);
  }
}


async function createPdfFromImages() {
    const desktopPath = path.join(os.homedir(), 'Desktop');

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'folderName',
            message: 'Enter the folder name (inside Desktop) containing files:',
            default: 'scanner_output'
        },
        {
            type: 'input',
            name: 'outputFileName',
            message: 'Enter the output PDF file name:',
            default: 'merged_output.pdf'
        }
    ]);

    const folderPath = path.join(desktopPath, answers.folderName);

    // إنشاء المجلد لو مش موجود
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        console.log(`✅ Created folder: ${folderPath}`);
    }

    const outputPdfPath = path.join(folderPath, answers.outputFileName);

    // تصفية الملفات لتكون فقط صور أو PDF
    const files = fs
        .readdirSync(folderPath)
        .filter((file) => /\.(jpe?g|png|pdf)$/i.test(file))
        .map((file) => path.join(folderPath, file));

    if (files.length === 0) {
        console.log("⚠️ No images or PDFs found in this folder.");
        return;
    }

    try {
        const pdfDoc = await PDFDocument.create();

        for (const filePath of files) {
            const fileExt = path.extname(filePath).toLowerCase();

            if (fileExt === '.pdf') {
                // دمج PDF
                const existingPdfBytes = fs.readFileSync(filePath);
                const srcDoc = await PDFDocument.load(existingPdfBytes);
                const copiedPages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());

                copiedPages.forEach((page) => pdfDoc.addPage(page));
            } else {
                // دمج صورة
                const imgBytes = fs.readFileSync(filePath);
                let img;
                if (fileExt === '.png') {
                    img = await pdfDoc.embedPng(imgBytes);
                } else {
                    img = await pdfDoc.embedJpg(imgBytes);
                }

                const page = pdfDoc.addPage([img.width, img.height]);
                page.drawImage(img, {
                    x: 0,
                    y: 0,
                    width: img.width,
                    height: img.height,
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPdfPath, pdfBytes);
        console.log(`✅ PDF created successfully: ${outputPdfPath}`);
    } catch (err) {
        console.error("❌ Error creating PDF:", err.message);
    }
}





export function openFilePicker(callback) {
  const command = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
    Add-Type -AssemblyName System.Windows.Forms;
    $dialog = New-Object System.Windows.Forms.OpenFileDialog;
    $dialog.Filter = 'All Files (*.*)|*.*';
    $dialog.Multiselect = $true;
    $result = $dialog.ShowDialog();
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      $dialog.FileNames
    }
  `.trim().replace(/\n/g, "; ");

  exec(`powershell -NoProfile -Command "${command}"`, { encoding: "utf8" }, (error, stdout) => {
    if (error) {
      console.error("❌ Error selecting files:", error.message);
      return;
    }

    const filePaths = stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && fs.existsSync(line));

    if (filePaths.length === 0) {
      console.log("❌ No valid files selected.");
      return;
    }

    filePaths.forEach((filePath) => {
      const fileDir = path.dirname(filePath);
      const fileExt = path.extname(filePath);
      const originalFileName = path.basename(filePath, fileExt);

      let newFileName = transliterate(originalFileName).replace(/[^a-zA-Z0-9]/g, "");
      if (!newFileName) newFileName = "ConvertedFile";

      const newFilePath = path.join(fileDir, newFileName + fileExt);

      fs.rename(filePath, newFilePath, (err) => {
        if (err) {
          console.error("❌ Error renaming file:", err.message);
          return;
        }

        console.log("✅ File renamed to:", newFilePath);
        callback(newFilePath);
      });
    });
  });
}



export function openFolderPicker() {
  return new Promise((resolve, reject) => {
    const command = `
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
      Add-Type -AssemblyName System.Windows.Forms;
      $dialog = New-Object System.Windows.Forms.FolderBrowserDialog;
      $dialog.Description = 'Select a folder to archive';
      $result = $dialog.ShowDialog();
      if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $dialog.SelectedPath
      }
    `.trim().replace(/\n/g, "; ");

    exec(`powershell -NoProfile -Command "${command}"`, { encoding: "utf8" }, (error, stdout) => {
      if (error) {
        return reject(error);
      }

      const folderPath = stdout.trim();

      if (!folderPath || !fs.existsSync(folderPath)) {
        return reject(new Error());
      }

      resolve(folderPath);
    });
  });
}



async function extractTextFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let text = "";

    try {
        if (ext === ".docx") {
            const { value } = await mammoth.extractRawText({ path: filePath });
            text = value.toLowerCase();
        } else if (ext === ".xlsx") {
            const workbook = xlsx.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            sheetNames.forEach(sheet => {
                const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1 });
                text += sheetData.flat().join(" ").toLowerCase() + " ";
            });
        } else if ([".jpg", ".jpeg", ".png"].includes(ext)) {
            const { data: { text: ocrText } } = await recognize(filePath);
            text = ocrText.toLowerCase();
        } else {
            console.warn(`⚠️ Unsupported file type: ${filePath}`);
        }
    } catch (error) {
        console.error(`❌ Error processing file ${filePath}:`, error.message);
    }

    return text;
}



if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir); // إنشاء مجلد مؤقت إذا لم يكن موجودًا

async function searchInsideFile() {
    try {
        const { keywords } = await inquirer.prompt([
            { type: 'input', name: 'keywords', message: chalk.cyan('🔍 Enter keywords (comma-separated):') }
        ]);

        const keywordsArray = keywords.split(',').map(k => k.trim().toLowerCase()); // تحويل الكلمات إلى lowercase

        let foundFiles = [];

        const files = await getEncryptedFiles(); // جلب الملفات المشفرة من قاعدة البيانات

        let resultsText = `=======================================\n`;
        resultsText += `📂 🔍 Search Results (${new Date().toLocaleString("en-US")})\n`;
        resultsText += `=======================================\n\n`;

        for (const { id, encryptedFilePath, encryptionKey, originalFileName } of files) {
            const decryptedPath = path.join('archive', originalFileName); // استبدال temp بـ archive

            try {
                await decryptFile(encryptedFilePath, decryptedPath, encryptionKey); // فك التشفير

                // ✅ تخطي الملفات غير المدعومة (غير Word أو Excel)
                if (!/\.(docx|xlsx|doc|xls)$/i.test(originalFileName)) {
                    continue; // لا تحاول استخراج النص من الملفات غير المدعومة
                }

                let text = "";
                try {
                    text = await extractTextFromFile(decryptedPath); 
                    text = text.toLowerCase();
                } catch (error) {
                    continue; // تجاهل أي خطأ وعدم طباعة شيء
                }

                // التحقق مما إذا كانت جميع الكلمات موجودة
                const allKeywordsFound = keywordsArray.every(keyword => text.includes(keyword));

                if (allKeywordsFound) {
                    foundFiles.push(originalFileName);
                    const stats = fs.statSync(decryptedPath); // الحصول على بيانات الملف
                    const fileSize = (stats.size / 1024).toFixed(2); // الحجم بالـ KB
                    const folderPath = path.dirname(decryptedPath); // المسار الأصلي للفولدر

                    // أخذ أول 5 سطور من النص
                    const firstFiveLines = text.split('\n').filter(line => line.trim() !== '').slice(0, 5).join('\n');

                    // عرض التفاصيل بشكل احترافي في التيرمينال جنبًا إلى جنب
                    console.log(chalk.white.bold(`---------------------------------------`)); // تعديل اللون إلى الأبيض
                    console.log(chalk.bold.green(`✅ Keywords found in: ${originalFileName}`));
                    console.log(chalk.bold.cyan(`--- File Details ---`));
                    console.log(
                        chalk.white.bold(`ID ${id}  |  (N) Name: ${originalFileName}  |  (E) Extension: ${path.extname(originalFileName)}  |  (S) Size: ${fileSize} KB  |  (F) Folder: ${folderPath}`)
                    );
                    console.log(chalk.white.bold(`---------------------------------------`)); // تعديل اللون إلى الأبيض
                    
                    // حفظ النتيجة (عرض أول 5 سطور من النص)
                    resultsText += `🆔 ${id}\n`;
                    resultsText += `📜 Name: ${originalFileName}\n`;
                    resultsText += `🗂️ Extension: ${path.extname(originalFileName)}\n`;
                    resultsText += `📏 Size: ${fileSize} KB\n`;
                    resultsText += `📅 Folder: ${folderPath}\n`;
                    resultsText += `📄 File Content:\n${text.split('\n').filter(line => line.trim() !== '').join(' | ') || 'No content to display.'}\n`;
                    resultsText += `---------------------------------------\n`;
                }
            } catch (error) {
                // تجاهل الأخطاء
            } finally {
                // حذف النسخة المفكوك تشفيرها بعد البحث لضمان الأمان
                if (fs.existsSync(decryptedPath)) {
                    fs.unlinkSync(decryptedPath);
                }
            }
        }

        if (foundFiles.length === 0) {
            console.log(chalk.yellow('⚠️ No matching files found.'));
        } else {
            // حفظ النتائج في ملف
            const fileName = 'search_results.txt';
            fs.writeFileSync(fileName, resultsText, 'utf8');
            console.log(chalk.blue(`📂 Search results saved in: ${fileName}`));

            // عرض خيار فتح الملف مع التفاصيل
            const { openFile } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'openFile',
                    message: chalk.cyan('📄 Do you want to open the search results file? Here are the details:'),
                    default: false
                }
            ]);

            if (openFile) {
                exec(`"${fileName}"`, (err) => {
                    if (err) {
                        console.error(chalk.red(`❌ Error opening file: ${fileName}`));
                    }
                });
            }
        }
    } catch (error) {
        console.error(chalk.red("❌ Error searching records:"), error.message);
    }
}




// 🔹 دالة لجلب الملفات المشفرة من قاعدة البيانات
function getEncryptedFiles() {
    return new Promise((resolve, reject) => {
        db.all("SELECT id, archived_path, encryption_key FROM archived_files", [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const files = rows.map(row => ({
                    id: row.id,  // إضافة الـ ID
                    encryptedFilePath: row.archived_path,
                    encryptionKey: Buffer.from(row.encryption_key, 'hex'),
                    originalFileName: path.basename(row.archived_path, ".enc")
                }));
                resolve(files);
            }
        });
    });
}


// 🔹 دالة لفك تشفير الملفات مؤقتًا للبحث فيها
function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
}

function decryptFile(encryptedFilePath, decryptedPath, encryptionKey, originalHash = null, skipHashCheck = false) {
    return new Promise((resolve, reject) => {
        try {
            const decipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey, Buffer.alloc(16, 0));

            const input = fs.createReadStream(encryptedFilePath);
            const output = fs.createWriteStream(decryptedPath);

            input.pipe(decipher).pipe(output);

            output.on('finish', async () => {
                if (skipHashCheck || !originalHash) {
                    // ✅ تخطي التحقق من الهاش إذا لم يتم توفيره
                    resolve();
                    return;
                }

                try {
                    const hash = await calculateFileHash(decryptedPath);
                    if (hash === originalHash) {
                        console.log("✅ File decrypted and verified successfully.");
                        resolve();
                    } else {
                        console.warn("⚠️ File decrypted but hash does not match!");
                        reject(new Error("Decryption succeeded but file integrity check failed."));
                    }
                } catch (hashErr) {
                    reject(hashErr);
                }
            });

            output.on('error', (err) => reject(err));
            input.on('error', (err) => reject(err));

        } catch (err) {
            reject(err);
        }
    });
}


async function startApp() {
    await requestPassword();
    await mainMenu();
}

// تشغيل البرنامج
startApp();