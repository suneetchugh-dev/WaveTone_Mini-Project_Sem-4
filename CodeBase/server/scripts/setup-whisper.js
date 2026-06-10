import fs from 'fs';
import path from 'path';
import https from 'https';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BIN_DIR = path.join(__dirname, '..', 'bin');
const MODEL_DIR = path.join(__dirname, '..', 'models');

// Whisper.cpp precompiled Windows binaries (v1.5.4)
const WHISPER_ZIP_URL = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip';
const WHISPER_ZIP_PATH = path.join(BIN_DIR, 'whisper-bin-x64.zip');

// ggml-tiny.en.bin model
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin';
const MODEL_PATH = path.join(MODEL_DIR, 'ggml-tiny.en.bin');

// Create directories
if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}
if (!fs.existsSync(MODEL_DIR)) {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download: ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    console.log(`Extracting ${zipPath}...`);
    // Use PowerShell to extract zip natively on Windows
    exec(`powershell -command "Expand-Archive -Force '${zipPath}' '${destDir}'"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Extraction error: ${error.message}`);
        return reject(error);
      }
      resolve();
    });
  });
}

async function setup() {
  try {
    // 1. Download Model
    if (!fs.existsSync(MODEL_PATH)) {
      await downloadFile(MODEL_URL, MODEL_PATH);
      console.log('Model downloaded successfully.');
    } else {
      console.log('Model already exists, skipping.');
    }

    // 2. Download and extract whisper.cpp binary
    const mainExePath = path.join(BIN_DIR, 'main.exe');
    if (!fs.existsSync(mainExePath)) {
      await downloadFile(WHISPER_ZIP_URL, WHISPER_ZIP_PATH);
      await extractZip(WHISPER_ZIP_PATH, BIN_DIR);
      fs.unlinkSync(WHISPER_ZIP_PATH); // cleanup
      console.log('Whisper.cpp binaries downloaded and extracted successfully.');
    } else {
      console.log('Whisper.cpp binaries already exist, skipping.');
    }

    console.log('Setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setup();
