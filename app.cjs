require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { spawn } = require("child_process");
const unzipper = require("unzipper");
const plist = require("plist");
const bplistParser = require("bplist-parser");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const UPLOAD_URL = (process.env.UPLOAD_URL || "").trim();
const WORK_DIR = (process.env.WORK_DIR || "").trim();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!UPLOAD_URL || !WORK_DIR || !ENCRYPTION_KEY) {
  console.error("Error: UPLOAD_URL, WORK_DIR, and ENCRYPTION_KEY must be set in the environment variables.");
  process.exit(1);
}
if (Buffer.from(ENCRYPTION_KEY, "hex").length !== 32) {
  console.error("Error: ENCRYPTION_KEY must be a 32-byte hexadecimal string.");
  process.exit(1);
}

const DEFAULT_IPA_PATH = "/home/dai1228/Portal-1.9.0.ipa";
if (!fs.existsSync(DEFAULT_IPA_PATH)) {
  console.error(`Error: Default IPA not found at path: ${DEFAULT_IPA_PATH}`);
  process.exit(1);
}

const dirs = ["p12", "mp", "temp", "signed", "plist", "users"];
for (const d of dirs) {
  const dirPath = path.join(WORK_DIR, d);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

app.use(express.static(path.join(__dirname, "dist")));
app.use("/signed", express.static(path.join(WORK_DIR, "signed")));
app.use("/plist", express.static(path.join(WORK_DIR, "plist")));
app.use("/icons", express.static(path.join(WORK_DIR, "icons")));

const upload = multer({
  dest: path.join(WORK_DIR, "temp"),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      ".ipa",
      ".p12",
      ".mobileprovision",
      ".deb",
      ".dylib",
      ".png",
      ".jpg",
      ".jpeg",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${ext}. Allowed: ${allowedExtensions.join(", ")}`));
    }
  },
});

function generateRandomSuffix() {
  const randomStr = Math.random().toString(36).substring(2, 8);
  return Date.now() + "_" + randomStr;
}

function generateUserId() {
  return crypto.randomBytes(16).toString("hex");
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

const directoriesToClean = ["mp", "p12", "plist", "temp", "signed"].map((dir) =>
  path.join(WORK_DIR, dir)
);
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
const MAX_FILE_AGE_MS = 30 * 60 * 1000;
async function performCleanup() {
  console.log("Starting cleanup process...");
  for (const dir of directoriesToClean) {
    await deleteOldFiles(dir, MAX_FILE_AGE_MS);
  }
  console.log("Cleanup process completed.");
}
setInterval(performCleanup, CLEANUP_INTERVAL_MS);
performCleanup();

function spawnPromise(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, options);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
      console.log(`stdout: ${data}`);
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(`stderr: ${data}`);
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "");
}

function parseUrlFromOutput(output) {
  const lines = output.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("URL")) {
      const parts = trimmed.split(":");
      if (parts.length > 1) {
        return parts.slice(1).join(":").trim();
      }
    }
  }
  return "";
}

function generateManifestPlist(ipaUrl, bundleId, bundleVersion, displayName, iconUrl) {
  const defaultBundleId = "com.example.default";
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
                        <string>${iconUrl}</string>
                    </dict>
                    <dict>
                        <key>kind</key>
                        <string>full-size-image</string>
                        <key>needs-shine</key>
                        <false/>
                        <key>url</key>
                        <string>${iconUrl}</string>
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

const algorithm = "aes-256-cbc";
const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
const ivLength = 16;
function encrypt(text) {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}
function decrypt(encryptedText) {
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted text format");
  }
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

app.use(async (req, res, next) => {
  if (!req.cookies.userId) {
    const userId = generateUserId();
    res.cookie("userId", userId, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    req.userId = userId;
    console.log(`Assigned new user ID: ${userId}`);
  } else {
    req.userId = req.cookies.userId;
    console.log(`Existing user ID: ${req.userId}`);
  }
  next();
});

// Helper function to shell escape arguments that might contain spaces or special characters.
function shellEscape(arg) {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

async function runCyanIfNeeded(inputIpa, outputIpa, req) {
  const cyanArgs = ["-i", inputIpa, "-o", outputIpa];
  if (req.body.cyan_name && req.body.cyan_name.trim() !== "") {
    cyanArgs.push("-n", req.body.cyan_name.trim());
  }
  if (req.body.cyan_version && req.body.cyan_version.trim() !== "") {
    cyanArgs.push("-v", req.body.cyan_version.trim());
  }
  if (req.body.cyan_bundle_id && req.body.cyan_bundle_id.trim() !== "") {
    cyanArgs.push("-b", req.body.cyan_bundle_id.trim());
  }
  if (req.body.cyan_minimum && req.body.cyan_minimum.trim() !== "") {
    cyanArgs.push("-m", req.body.cyan_minimum.trim());
  }
  // If a cyan icon was uploaded, move it and add to the arguments.
  if (req.files["cyan_icon"] && req.files["cyan_icon"].length > 0) {
    const iconFile = req.files["cyan_icon"][0];
    const movedIconPath = path.join(WORK_DIR, "temp", iconFile.originalname);
    await fsp.rename(iconFile.path, movedIconPath);
    cyanArgs.push("-k", movedIconPath);
    // Save the moved icon path on the request for later use in manifest generation.
    req.cyanIconPath = movedIconPath;
  }
  if (req.files["cyan_tweaks"] && req.files["cyan_tweaks"].length > 0) {
    const tweakPaths = [];
    for (const twk of req.files["cyan_tweaks"]) {
      const movedTweakPath = path.join(WORK_DIR, "temp", twk.originalname);
      await fsp.rename(twk.path, movedTweakPath);
      tweakPaths.push(movedTweakPath);
    }
    cyanArgs.push("-f", ...tweakPaths);
  }
  if (req.body.cyan_remove_supported) {
    cyanArgs.push("-u");
  }
  if (req.body.cyan_no_watch) {
    cyanArgs.push("-w");
  }
  if (req.body.cyan_enable_documents) {
    cyanArgs.push("-d");
  }
  if (req.body.cyan_fakesign) {
    cyanArgs.push("-s");
  }
  if (req.body.cyan_thin) {
    cyanArgs.push("-q");
  }
  if (req.body.cyan_remove_extensions) {
    cyanArgs.push("-e");
  }
  if (req.body.cyan_ignore_encrypted) {
    cyanArgs.push("--ignore-encrypted");
  }
  
  // Escape each argument to handle spaces and special characters.
  const escapedArgs = cyanArgs.map(shellEscape).join(" ");
  const cyanCommand = `yes | cyan ${escapedArgs}`;
  console.log(`Running cyan: ${cyanCommand}`);
  await spawnPromise("sh", ["-c", cyanCommand]);
  console.log("Cyan modifications complete.");
  return outputIpa;
}

app.post(
  "/sign",
  upload.fields([
    { name: "ipa", maxCount: 1 },
    { name: "p12", maxCount: 1 },
    { name: "mobileprovision", maxCount: 1 },
    { name: "cyan_icon", maxCount: 1 },
    { name: "cyan_tweaks", maxCount: 20 },
  ]),
  async (req, res) => {
    let uniqueSuffix;
    let ipaPath;
    let signedIpaPath;
    let p12Path;
    let mpPath;
    let outputIpaPath;
    console.log("Form Submission Received");
    try {
      const p12Password = req.body.p12_password || "";
      if (req.body.ipa_direct_link && req.body.ipa_direct_link.trim() !== "") {
        uniqueSuffix = generateRandomSuffix();
        ipaPath = path.join(WORK_DIR, "temp", `input_${uniqueSuffix}.ipa`);
        try {
          await spawnPromise("curl", ["-L", req.body.ipa_direct_link, "-o", ipaPath]);
        } catch (e) {
          console.error("Error downloading IPA from direct link:", e);
          throw new Error("Error downloading IPA from direct link: " + e.message);
        }
        outputIpaPath = ipaPath;
        console.log(`Downloaded IPA from direct link: ${req.body.ipa_direct_link}`);
      } else if (req.files["ipa"]) {
        uniqueSuffix = generateRandomSuffix();
        ipaPath = path.join(WORK_DIR, "temp", `input_${uniqueSuffix}.ipa`);
        await fsp.rename(req.files["ipa"][0].path, ipaPath);
        outputIpaPath = ipaPath;
        console.log(`Received IPA: ${req.files["ipa"][0].originalname}`);
      } else {
        ipaPath = DEFAULT_IPA_PATH;
        outputIpaPath = ipaPath;
        console.log(`No IPA provided. Using default IPA at: ${DEFAULT_IPA_PATH}`);
      }
      if (req.files["p12"] && req.files["mobileprovision"]) {
        uniqueSuffix = generateRandomSuffix();
        p12Path = path.join(WORK_DIR, "p12", `cert_${uniqueSuffix}.p12`);
        mpPath = path.join(WORK_DIR, "mp", `app_${uniqueSuffix}.mobileprovision`);
        await fsp.rename(req.files["p12"][0].path, p12Path);
        await fsp.rename(req.files["mobileprovision"][0].path, mpPath);
        console.log(`Received temporary certificates: ${p12Path}, ${mpPath}`);
      } else {
        return res.status(400).json({ success: false, error: "P12 and MobileProvision files are required." });
      }
      try {
        await spawnPromise("openssl", ["smime", "-inform", "der", "-verify", "-noverify", "-in", mpPath, "-out", "/dev/null"]);
        console.log("Mobile provision file verified successfully.");
      } catch (mpError) {
        console.error("Error verifying mobile provision file:", mpError);
        return res.status(400).json({ success: false, error: "Invalid mobile provision file." });
      }
      let mpData = await fsp.readFile(mpPath, "utf8");
      let plistStart = mpData.indexOf("<?xml");
      let plistEnd = mpData.indexOf("</plist>") + 8;
      if (plistStart === -1 || plistEnd === -1) {
        console.error("Mobile provision file does not contain a valid plist.");
        return res.status(400).json({ success: false, error: "Invalid mobile provision file." });
      }
      let mpPlistString = mpData.substring(plistStart, plistEnd);
      let mpPlist;
      try {
        mpPlist = plist.parse(mpPlistString);
      } catch (err) {
        console.error("Error parsing mobile provision plist:", err);
        return res.status(400).json({ success: false, error: "Invalid mobile provision file format." });
      }
      let devCerts = mpPlist.DeveloperCertificates;
      if (!devCerts || !Array.isArray(devCerts) || devCerts.length === 0) {
        console.error("No DeveloperCertificates found in mobile provision file.");
        return res.status(400).json({ success: false, error: "Mobile provision file does not contain developer certificates." });
      }
      let p12Fingerprint = await spawnPromise("sh", [
        "-c",
        `openssl pkcs12 -legacy -in ${p12Path} -nokeys -clcerts -passin pass:${p12Password} | openssl x509 -noout -fingerprint -sha1`,
      ]);
      p12Fingerprint = p12Fingerprint.replace("SHA1 Fingerprint=", "").trim();
      console.log("P12 fingerprint:", p12Fingerprint);
      let matchFound = false;
      for (const certData of devCerts) {
        let tempCertPath = path.join(WORK_DIR, "temp", `mp_cert_${generateRandomSuffix()}.der`);
        await fsp.writeFile(tempCertPath, certData, "base64");
        try {
          let mpCertFingerprint = await spawnPromise("openssl", [
            "x509",
            "-inform",
            "der",
            "-noout",
            "-fingerprint",
            "-sha1",
            "-in",
            tempCertPath,
          ]);
          mpCertFingerprint = mpCertFingerprint.replace("SHA1 Fingerprint=", "").trim();
          console.log("Mobile provision certificate fingerprint:", mpCertFingerprint);
          if (mpCertFingerprint === p12Fingerprint) {
            matchFound = true;
          }
        } catch (err) {
          console.error("Error extracting fingerprint from mobile provision certificate:", err);
        }
        await fsp.unlink(tempCertPath);
      }
      if (!matchFound) {
        console.error("The certificate in the P12 file does not match any certificate in the mobile provision file.");
        return res.status(400).json({
          success: false,
          error:
            "The certificate in the P12 file does not match any certificate embedded in the mobile provision file. Please check that you have uploaded the correct P12 and mobile provision files.",
        });
      }
      // Run cyan modifications on the IPA (if any advanced options were passed)
      const cyanOutputIpaPath = path.join(WORK_DIR, "temp", `cyan_${uniqueSuffix || generateRandomSuffix()}.ipa`);
      let finalIpaForSigning = await runCyanIfNeeded(outputIpaPath, cyanOutputIpaPath, req);
      // (Optional) Remove dylibs if requested
      if (req.body.remove_dylibs) {
        try {
          const dylibsToRemove = JSON.parse(req.body.remove_dylibs);
          if (Array.isArray(dylibsToRemove) && dylibsToRemove.length > 0) {
            const extractionDir = path.join(WORK_DIR, "temp", `extracted_${generateRandomSuffix()}`);
            await fsp.mkdir(extractionDir, { recursive: true });
            await new Promise((resolve, reject) => {
              fs.createReadStream(finalIpaForSigning)
                .pipe(unzipper.Extract({ path: extractionDir }))
                .on("close", resolve)
                .on("error", reject);
            });
            async function removeDylibRecursive(dir, fileName) {
              const entries = await fsp.readdir(dir, { withFileTypes: true });
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  await removeDylibRecursive(fullPath, fileName);
                } else {
                  if (entry.name === fileName) {
                    await fsp.rm(fullPath, { force: true });
                    console.log(`Removed dylib: ${fullPath}`);
                  }
                }
              }
            }
            for (const dylibName of dylibsToRemove) {
              await removeDylibRecursive(extractionDir, dylibName);
            }
            const removedIpaPath = path.join(WORK_DIR, "temp", `removed_${uniqueSuffix || generateRandomSuffix()}.ipa`);
            await spawnPromise("sh", ["-c", `cd ${extractionDir} && zip -r ${removedIpaPath} *`]);
            finalIpaForSigning = removedIpaPath;
            await fsp.rm(extractionDir, { recursive: true, force: true });
          }
        } catch (err) {
          console.error("Error during dylib removal:", err);
          return res.status(500).json({ success: false, error: "Failed to remove dylibs: " + err.message });
        }
      }
      // Execute zsign to create the signed IPA.
      signedIpaPath = path.join(WORK_DIR, "signed", `signed_${uniqueSuffix || generateRandomSuffix()}.ipa`);
      const zsignArgs = ["-z", "5", "-k", p12Path];
      if (p12Password.trim() !== "") {
        zsignArgs.push("-p", p12Password);
      }
      zsignArgs.push("-m", mpPath, "-o", signedIpaPath, finalIpaForSigning);
      console.log(`Executing zsign: zsign ${zsignArgs.join(" ")}`);
      await spawnPromise("zsign", zsignArgs);
      console.log(`Signed IPA created at: ${signedIpaPath}`);

      // ***** Extract Info.plist from the signed IPA *****
      let bundleId = "com.example.unknown";
      let bundleVersion = "1.0.0";
      let displayName = "App";
      let extractedIconUrl = "";
      let plistDataSigned = null;
      try {
        if (!fs.existsSync(signedIpaPath)) {
          throw new Error("Signed IPA file not found for Info.plist extraction.");
        }
        const directory = await unzipper.Open.file(signedIpaPath);
        const infoPlistEntry = directory.files.find((f) => f.path.match(/^Payload\/.*\.app\/Info\.plist$/));
        if (!infoPlistEntry) {
          throw new Error("Couldn't find Info.plist in the signed IPA.");
        }
        const plistBufferSigned = await infoPlistEntry.buffer();
        try {
          plistDataSigned = plist.parse(plistBufferSigned.toString("utf8"));
        } catch (xmlParseError) {
          try {
            const parsed = await bplistParser.parseBuffer(plistBufferSigned);
            plistDataSigned = parsed && parsed.length > 0 ? parsed[0] : null;
            if (!plistDataSigned) {
              throw new Error("Parsed binary plist is empty.");
            }
          } catch (binaryParseError) {
            console.error("XML and binary plist parsing failed:", binaryParseError);
            throw new Error("Failed to parse Info.plist.");
          }
        }
        bundleId = plistDataSigned["CFBundleIdentifier"] || bundleId;
        bundleVersion = plistDataSigned["CFBundleVersion"] || bundleVersion;
        displayName = plistDataSigned["CFBundleDisplayName"] || plistDataSigned["CFBundleName"] || displayName;
      } catch (plistError) {
        console.error("Error extracting Info.plist:", plistError);
        return res.status(500).json({ success: false, error: "Failed to extract Info.plist from the signed IPA." });
      }

      // ***** Handle the app icon for manifest *****
      // If a cyan icon was uploaded (i.e. -k was present), use that image for the manifest.
      if (req.cyanIconPath && fs.existsSync(req.cyanIconPath)) {
        try {
          const iconsDir = path.join(WORK_DIR, "icons");
          if (!fs.existsSync(iconsDir)) {
            fs.mkdirSync(iconsDir, { recursive: true });
          }
          const iconFilename = sanitizeFilename(displayName) + "_" + (uniqueSuffix || generateRandomSuffix()) + ".png";
          const iconFilePath = path.join(iconsDir, iconFilename);
          await fsp.copyFile(req.cyanIconPath, iconFilePath);
          extractedIconUrl = new URL(`icons/${iconFilename}`, UPLOAD_URL).toString();
          console.log(`Using uploaded cyan icon for manifest: ${iconFilePath}`);
        } catch (err) {
          console.error("Error processing uploaded cyan icon:", err);
        }
      }
      // If no cyan icon was uploaded or an error occurred, extract the icon from the IPA.
      if (!extractedIconUrl) {
        try {
          const directory = await unzipper.Open.file(signedIpaPath);
          const infoPlistEntry = directory.files.find((f) => f.path.match(/^Payload\/.*\.app\/Info\.plist$/));
          if (!infoPlistEntry) {
            throw new Error("Couldn't find Info.plist in the signed IPA for icon extraction.");
          }
          const appFolderPath = path.dirname(infoPlistEntry.path);
          let iconEntry = directory.files.find(f =>
            f.path.startsWith(appFolderPath) && f.path.endsWith("AppIcon76x76@2x~ipad.png")
          );
          if (!iconEntry) {
            iconEntry = directory.files.find(f =>
              f.path.startsWith(appFolderPath) && f.path.endsWith("icon.png")
            );
          }
          if (iconEntry) {
            const iconBuffer = await iconEntry.buffer();
            const iconsDir = path.join(WORK_DIR, "icons");
            if (!fs.existsSync(iconsDir)) {
              fs.mkdirSync(iconsDir, { recursive: true });
            }
            const iconFilename = sanitizeFilename(displayName) + "_" + (uniqueSuffix || generateRandomSuffix()) + ".png";
            const iconFilePath = path.join(iconsDir, iconFilename);
            await fsp.writeFile(iconFilePath, iconBuffer);
            extractedIconUrl = new URL(`icons/${iconFilename}`, UPLOAD_URL).toString();
            console.log(`Extracted icon saved to: ${iconFilePath}`);
          } else {
            console.log("No specified icon found in the .app folder; using default icon.");
            extractedIconUrl = "https://ipasign.pro/assets/Cult.png";
          }
        } catch (iconError) {
          console.error("Error extracting icon from IPA:", iconError);
          extractedIconUrl = "https://ipasign.pro/assets/Cult.png";
        }
      }

      // ***** Handle signed IPA upload (Storj optional) *****
      let ipaUrlForManifest = "";
      if (req.body.use_storj) {
        const bucketName = "my-bucket"; // adjust if needed
        const storjFileName = path.basename(signedIpaPath);
        console.log("Uploading signed IPA to Storj for permanent link...");
        await spawnPromise("uplink", ["cp", signedIpaPath, `sj://${bucketName}/${storjFileName}`]);
        console.log("Upload to Storj complete.");
        const permShareOutput = await spawnPromise("uplink", ["share", `sj://${bucketName}/${storjFileName}`, "--url", "--not-after=none"]);
        let permUrl = parseUrlFromOutput(permShareOutput);
        permUrl = permUrl.replace("/s/", "/raw/");
        console.log("Permanent URL:", permUrl);
        ipaUrlForManifest = permUrl;
        // Delete local IPA after successful Storj upload.
        await fsp.rm(signedIpaPath, { force: true });
        console.log("Local signed IPA file deleted after uploading for permanent link.");
      } else {
        // Use the server URL to serve the signed IPA.
        ipaUrlForManifest = new URL(`signed/${path.basename(signedIpaPath)}`, UPLOAD_URL).toString();
        console.log("Using server URL for signed IPA:", ipaUrlForManifest);
      }

      // ***** Generate manifest plist using the IPA URL *****
      const manifestPlist = generateManifestPlist(ipaUrlForManifest, bundleId, bundleVersion, displayName, extractedIconUrl);
      const plistFilename = sanitizeFilename(displayName) + "_" + (uniqueSuffix || generateRandomSuffix()) + ".plist";
      const plistPath = path.join(WORK_DIR, "plist", plistFilename);
      await fsp.writeFile(plistPath, manifestPlist, "utf8");
      console.log(`Generated manifest plist at: ${plistPath}`);
      const manifestUrl = new URL(`plist/${plistFilename}`, UPLOAD_URL).toString();
      const installLink = `itms-services://?action=download-manifest&url=${manifestUrl}`;
      console.log(`Install link: ${installLink}`);
      res.json({
        success: true,
        signedIpaUrl: ipaUrlForManifest,
        manifestUrl: manifestUrl,
        installLink: installLink,
        bundleId: bundleId,
        bundleVersion: bundleVersion,
        displayName: displayName,
      });
    } catch (err) {
      console.error("Error during signing process:", err);
      res.status(500).json({ success: false, error: err.message });
    } finally {
      try {
        if (uniqueSuffix) {
          if (req.files["ipa"] && ipaPath !== DEFAULT_IPA_PATH && fs.existsSync(ipaPath)) {
            await fsp.rm(ipaPath, { force: true });
            console.log(`Removed uploaded IPA at: ${ipaPath}`);
          }
        }
      } catch (cleanupErr) {
        console.error("Error during cleanup:", cleanupErr);
      }
    }
  }
);

function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, error: "File too large. Max 2GB." });
    }
    return res.status(400).json({ success: false, error: err.message });
  } else if (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
  next();
}

app.use(multerErrorHandler);
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});
const port = 3010;
app.listen(port, () => {
  console.log(`Server running on port ${port}. Open http://localhost:${port}/`);
});