require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const unzipper = require('unzipper');
const plist = require('plist');
const bplistParser = require('bplist-parser');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const UPLOAD_URL = (process.env.UPLOAD_URL || '').trim();
const WORK_DIR = (process.env.WORK_DIR || '').trim();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!UPLOAD_URL || !WORK_DIR || !ENCRYPTION_KEY) {
  console.error("Error: UPLOAD_URL, WORK_DIR, and ENCRYPTION_KEY must be set in the environment variables.");
  process.exit(1);
}

if (Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
  console.error("Error: ENCRYPTION_KEY must be a 32-byte hexadecimal string.");
  process.exit(1);
}

const DEFAULT_IPA_PATH = '/home/dai1228/Portal-1.9.0.ipa';

if (!fs.existsSync(DEFAULT_IPA_PATH)) {
  console.error(`Error: Default IPA not found at path: ${DEFAULT_IPA_PATH}`);
  process.exit(1);
}

const dirs = ['p12', 'mp', 'temp', 'signed', 'plist', 'users'];
for (const d of dirs) {
  const dirPath = path.join(WORK_DIR, d);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/signed', express.static(path.join(WORK_DIR, 'signed')));
app.use('/plist', express.static(path.join(WORK_DIR, 'plist')));

const upload = multer({
  dest: path.join(WORK_DIR, 'temp'),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.ipa', '.p12', '.mobileprovision', '.deb', '.dylib', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${ext}. Allowed: ${allowedExtensions.join(', ')}`));
    }
  }
});

function generateRandomSuffix() {
  const randomStr = Math.random().toString(36).substring(2, 8);
  return Date.now() + '_' + randomStr;
}

function generateUserId() {
  return crypto.randomBytes(16).toString('hex');
}

async function deleteOldFiles(directory, maxAgeInMs) {
  try {
    const files = await fsp.readdir(directory);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(directory, file);
      try {
        const stats = await fsp.stat(filePath);
        const fileAge = now - stats.mtimeMs;
        if (fileAge > maxAgeInMs) {
          await fsp.unlink(filePath);
          console.log(`Deleted file: ${filePath}`);
        }
      } catch (err) {
        console.error(`Error processing file ${filePath}:`, err);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${directory}:`, err);
  }
}

const directoriesToClean = ['mp', 'p12', 'plist', 'temp', 'signed'].map(dir => path.join(WORK_DIR, dir));
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
const MAX_FILE_AGE_MS = 30 * 60 * 1000;

async function performCleanup() {
  console.log('Starting cleanup process...');
  for (const dir of directoriesToClean) {
    await deleteOldFiles(dir, MAX_FILE_AGE_MS);
  }
  console.log('Cleanup process completed.');
}

setInterval(performCleanup, CLEANUP_INTERVAL_MS);
performCleanup();

function spawnPromise(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, options);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`stdout: ${data}`);
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`stderr: ${data}`);
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '');
}

function generateManifestPlist(ipaUrl, bundleId, bundleVersion, displayName) {
  const defaultBundleId = 'com.example.default';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
"http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>items</key>
        <array>
            <dict>
                <key>assets</key>
                <array>
                    <dict>
                        <key>kind</key>
                        <string>software-package</string>
                        <key>url</key>
                        <string>${ipaUrl}</string>
                    </dict>
                    <dict>
                        <key>kind</key>
                        <string>display-image</string>
                        <key>needs-shine</key>
                        <false/>
                        <key>url</key>
                        <string>https://raw.githubusercontent.com/daisuke1227/RevengeUpdates/refs/heads/main/WSF.png</string>
                    </dict>
                    <dict>
                        <key>kind</key>
                        <string>full-size-image</string>
                        <key>needs-shine</key>
                        <false/>
                        <key>url</key>
                        <string>https://raw.githubusercontent.com/daisuke1227/RevengeUpdates/refs/heads/main/WSF.png</string>
                    </dict>
                </array>
                <key>metadata</key>
                <dict>
                    <key>bundle-identifier</key>
                    <string>${bundleId ? bundleId : defaultBundleId}</string>
                    <key>bundle-version</key>
                    <string>${bundleVersion}</string>
                    <key>kind</key>
                    <string>software</string>
                    <key>title</key>
                    <string>${displayName}</string>
                </dict>
            </dict>
        </array>
    </dict>
</plist>`;
}

const algorithm = 'aes-256-cbc';
const key = Buffer.from(ENCRYPTION_KEY, 'hex');
const ivLength = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

app.use(async (req, res, next) => {
  if (!req.cookies.userId) {
    const userId = generateUserId();
    res.cookie('userId', userId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
    req.userId = userId;
    console.log(`Assigned new user ID: ${userId}`);
  } else {
    req.userId = req.cookies.userId;
    console.log(`Existing user ID: ${req.userId}`);
  }
  next();
});

function getUserCertPaths(userId) {
  const userDir = path.join(WORK_DIR, 'users', userId);
  const p12Path = path.join(userDir, 'cert.p12');
  const mpPath = path.join(userDir, 'app.mobileprovision');
  const passwordPath = path.join(userDir, 'password.enc');
  return { userDir, p12Path, mpPath, passwordPath };
}

async function runCyanIfNeeded(inputIpa, outputIpa, req) {
  const cyanArgs = ['-i', inputIpa, '-o', outputIpa];
  if (req.body.cyan_name && req.body.cyan_name.trim() !== '') {
    cyanArgs.push('-n', req.body.cyan_name.trim());
  }
  if (req.body.cyan_version && req.body.cyan_version.trim() !== '') {
    cyanArgs.push('-v', req.body.cyan_version.trim());
  }
  if (req.body.cyan_bundle_id && req.body.cyan_bundle_id.trim() !== '') {
    cyanArgs.push('-b', req.body.cyan_bundle_id.trim());
  }
  if (req.body.cyan_minimum && req.body.cyan_minimum.trim() !== '') {
    cyanArgs.push('-m', req.body.cyan_minimum.trim());
  }
  if (req.files['cyan_icon'] && req.files['cyan_icon'].length > 0) {
    const iconFile = req.files['cyan_icon'][0];
    const movedIconPath = path.join(WORK_DIR, 'temp', iconFile.originalname);
    await fsp.rename(iconFile.path, movedIconPath);
    cyanArgs.push('-k', movedIconPath);
  }
  if (req.files['cyan_tweaks'] && req.files['cyan_tweaks'].length > 0) {
    const tweakPaths = [];
    for (const twk of req.files['cyan_tweaks']) {
      const movedTweakPath = path.join(WORK_DIR, 'temp', twk.originalname);
      await fsp.rename(twk.path, movedTweakPath);
      tweakPaths.push(movedTweakPath);
    }
    cyanArgs.push('-f', ...tweakPaths);
  }
  if (req.body.cyan_remove_supported) {
    cyanArgs.push('-u');
  }
  if (req.body.cyan_no_watch) {
    cyanArgs.push('-w');
  }
  if (req.body.cyan_enable_documents) {
    cyanArgs.push('-d');
  }
  if (req.body.cyan_fakesign) {
    cyanArgs.push('-s');
  }
  if (req.body.cyan_thin) {
    cyanArgs.push('-q');
  }
  if (req.body.cyan_remove_extensions) {
    cyanArgs.push('-e');
  }
  if (req.body.cyan_remove_encrypted) {
    cyanArgs.push('-g');
  }
  if (req.body.cyan_ignore_encrypted) {
    cyanArgs.push('--ignore-encrypted');
  }
  if (req.body.cyan_overwrite) {
    cyanArgs.push('--overwrite');
  }
  if (req.body.cyan_compress_level && req.body.cyan_compress_level.trim() !== '') {
    cyanArgs.push('-c', req.body.cyan_compress_level.trim());
  }
  const userDidSomething = cyanArgs.length > 4;
  if (!userDidSomething) {
    console.log('No cyan modifications requested. Skipping...');
    return inputIpa;
  }
  console.log(`Running cyan: cyan ${cyanArgs.join(' ')}`);
  await spawnPromise('cyan', cyanArgs);
  console.log('Cyan modifications complete.');
  return outputIpa;
}

app.post('/sign', 
  upload.fields([
    { name: 'ipa', maxCount: 1 },
    { name: 'p12', maxCount: 1 },
    { name: 'mobileprovision', maxCount: 1 },
    { name: 'cyan_icon', maxCount: 1 },
    { name: 'cyan_tweaks', maxCount: 20 }
  ]),
  async (req, res) => {
    let uniqueSuffix;
    let ipaPath;
    let signedIpaPath;
    let p12Path;
    let mpPath;
    let outputIpaPath;
    let encryptedPassword = null;
    const userId = req.userId;
    const saveCert = req.body.save_cert === 'on';
    const useSavedCerts = req.body.use_saved_certs === 'on';

    console.log('Form Submission Received');
    console.log('Use Saved Certificates:', useSavedCerts ? 'Yes' : 'No');
    console.log('Save Certificates:', saveCert ? 'Yes' : 'No');

    try {
      const p12Password = req.body.p12_password;
      const { userDir, p12Path: userP12Path, mpPath: userMpPath, passwordPath } = getUserCertPaths(userId);
      let decryptedPwd = null;
      if (useSavedCerts) {
        if (fs.existsSync(userP12Path) && fs.existsSync(userMpPath)) {
          p12Path = userP12Path;
          mpPath = userMpPath;
          if (fs.existsSync(passwordPath)) {
            const encryptedPwd = await fsp.readFile(passwordPath, 'utf8');
            decryptedPwd = decrypt(encryptedPwd);
            console.log(`Using saved certificates with password for user ID: ${userId}`);
          } else {
            decryptedPwd = null;
            console.log(`Using saved certificates WITHOUT a password for user ID: ${userId}`);
          }
        } else {
          console.log(`No saved certificates found for user ID: ${userId}`);
          return res.status(400).send("Error: No saved certificates found. Please upload your P12 and MobileProvision files.");
        }
      }
      if (req.files['ipa']) {
        uniqueSuffix = generateRandomSuffix();
        ipaPath = path.join(WORK_DIR, 'temp', `input_${uniqueSuffix}.ipa`);
        await fsp.rename(req.files['ipa'][0].path, ipaPath);
        outputIpaPath = ipaPath;
        console.log(`Received IPA: ${req.files['ipa'][0].originalname}`);
      } else {
        ipaPath = DEFAULT_IPA_PATH;
        outputIpaPath = ipaPath;
        console.log(`No IPA uploaded. Using default IPA at: ${DEFAULT_IPA_PATH}`);
      }
      if (!useSavedCerts) {
        if (saveCert) {
          if (!req.files['p12'] || !req.files['mobileprovision']) {
            return res.status(400).send("Error: P12 and MobileProvision files are required to save certificates.");
          }
          if (!fs.existsSync(userDir)) {
            await fsp.mkdir(userDir, { recursive: true });
            console.log(`Created user directory: ${userDir}`);
          }
          await fsp.rename(req.files['p12'][0].path, userP12Path);
          await fsp.rename(req.files['mobileprovision'][0].path, userMpPath);
          p12Path = userP12Path;
          mpPath = userMpPath;
          console.log(`Saved certificates for user ID: ${userId}`);
          if (p12Password && p12Password.trim() !== '') {
            encryptedPassword = encrypt(p12Password);
            await fsp.writeFile(passwordPath, encryptedPassword, 'utf8');
            console.log(`Saved encrypted password for user ID: ${userId}`);
          } else {
            if (fs.existsSync(passwordPath)) {
              await fsp.unlink(passwordPath);
              console.log(`Removed existing password for user ID: ${userId}`);
            }
            console.log(`Certificates saved without a password for user ID: ${userId}`);
          }
        } else {
          if (req.files['p12'] && req.files['mobileprovision']) {
            uniqueSuffix = generateRandomSuffix();
            p12Path = path.join(WORK_DIR, 'p12', `cert_${uniqueSuffix}.p12`);
            mpPath = path.join(WORK_DIR, 'mp', `app_${uniqueSuffix}.mobileprovision`);
            await fsp.rename(req.files['p12'][0].path, p12Path);
            await fsp.rename(req.files['mobileprovision'][0].path, mpPath);
            console.log(`Received temporary certificates: ${p12Path}, ${mpPath}`);
          } else {
            return res.status(400).send("Error: P12 and MobileProvision files are required.");
          }
        }
      }
      const cyanOutputIpaPath = path.join(WORK_DIR, 'temp', `cyan_${uniqueSuffix || generateRandomSuffix()}.ipa`);
      const finalIpaForSigning = await runCyanIfNeeded(outputIpaPath, cyanOutputIpaPath, req);
      signedIpaPath = path.join(WORK_DIR, 'signed', `signed_${uniqueSuffix || generateRandomSuffix()}.ipa`);
      const zsignArgs = ['-z', '5', '-k', p12Path];
      if (useSavedCerts && decryptedPwd !== null && decryptedPwd.trim() !== '') {
        zsignArgs.push('-p', decryptedPwd);
      } else if (!useSavedCerts && p12Password && p12Password.trim() !== '') {
        zsignArgs.push('-p', p12Password);
      }
      zsignArgs.push('-m', mpPath, '-o', signedIpaPath, finalIpaForSigning);
      console.log(`Executing zsign: zsign ${zsignArgs.join(' ')}`);
      await spawnPromise('zsign', zsignArgs);
      console.log(`Signed IPA created at: ${signedIpaPath}`);
      let bundleId = 'com.example.unknown';
      let bundleVersion = '1.0.0';
      let displayName = 'App';
      try {
        const directory = await unzipper.Open.file(signedIpaPath);
        let infoPlistEntry = directory.files.find(f =>
          f.path.match(/^Payload\/.*\.app\/Info\.plist$/)
        );
        if (!infoPlistEntry) {
          return res.status(500).send("Error: Couldn't find Info.plist in the signed IPA.");
        }
        const plistBufferSigned = await infoPlistEntry.buffer();
        let plistDataSigned;
        try {
          plistDataSigned = plist.parse(plistBufferSigned.toString('utf8'));
        } catch (xmlParseError) {
          try {
            const parsed = await bplistParser.parseBuffer(plistBufferSigned);
            plistDataSigned = parsed && parsed.length > 0 ? parsed[0] : null;
            if (!plistDataSigned) {
              throw new Error("Parsed binary plist is empty.");
            }
          } catch (binaryParseError) {
            console.error("XML and binary plist parsing failed:", binaryParseError);
            return res.status(500).send("Error: Failed to parse Info.plist.");
          }
        }
        bundleId = plistDataSigned['CFBundleIdentifier'] || bundleId;
        bundleVersion = plistDataSigned['CFBundleVersion'] || bundleVersion;
        displayName = plistDataSigned['CFBundleDisplayName']
          || plistDataSigned['CFBundleName']
          || displayName;
      } catch (plistError) {
        console.error("Error extracting Info.plist:", plistError);
        return res.status(500).send("Error: Failed to extract Info.plist from the signed IPA.");
      }
      const ipaUrl = new URL(`signed/${path.basename(signedIpaPath)}`, UPLOAD_URL).toString();
      const manifestPlist = generateManifestPlist(ipaUrl, bundleId, bundleVersion, displayName);
      const filename = sanitizeFilename(displayName) + '_' + (uniqueSuffix || generateRandomSuffix()) + '.plist';
      const plistPath = path.join(WORK_DIR, 'plist', filename);
      await fsp.writeFile(plistPath, manifestPlist, 'utf8');
      console.log(`Generated manifest plist at: ${plistPath}`);
      const manifestUrl = new URL(`plist/${filename}`, UPLOAD_URL).toString();
      const installLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
      console.log(`Install link: ${installLink}`);
      const resultUrl = new URL('result.html', `${UPLOAD_URL}/`);
      resultUrl.searchParams.append('installLink', installLink);
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta http-equiv="refresh" content="0; url=${resultUrl.href}">
          </head>
          <body></body>
        </html>
      `);
    } catch (err) {
      console.error('Error during signing process:', err);
      res.status(500).send(`Error: ${err.message}`);
    } finally {
      try {
        if (uniqueSuffix) {
          const signedIpa = path.join(WORK_DIR, 'signed', `signed_${uniqueSuffix}.ipa`);
          if (req.files['ipa'] && ipaPath !== DEFAULT_IPA_PATH && fs.existsSync(ipaPath)) {
            await fsp.rm(ipaPath, { force: true });
            console.log(`Removed uploaded IPA at: ${ipaPath}`);
          }
        }
      } catch (cleanupErr) {
        console.error('Error during cleanup:', cleanupErr);
      }
    }
  }
);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'pages', 'index.tsx'));
});

function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).send("Error: File too large. Max 2GB.");
    }
    return res.status(400).send(`Multer Error: ${err.message}`);
  } else if (err) {
    return res.status(500).send(`Server Error: ${err.message}`);
  }
  next();
}
app.use(multerErrorHandler);

const port = 3003;
app.listen(port, () => {
  console.log(`Server running on port ${port}. Open http://localhost:${port}/`);
});
