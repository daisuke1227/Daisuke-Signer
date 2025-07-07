# Daisuke-Signer
Daisuke Signer is an experimental iPA signer and front end made using [zsign](https://github.com/zhlynn/zsign), a CJS wrapper, and Vite for a frontend. The signer
includes easy ways to sign any iPA file using custom certificates and the ability to modify
the iPA however you want using [cyan](https://github.com/asdfzxcvbn/pyzule-rw)

> [!TIP]
> You can change App Names, Version, Bundle ID, and icons, as well as adding your own tweaks to
> make your sideloading experience easier.

<img width="840" alt="Screenshot 2025-07-06 at 10 48 12 PM" src="https://github.com/user-attachments/assets/99d5f0af-7924-4359-9f7f-24066b5948d9" />

## Building Instructions
1. Download the repo code as a zip file.
2. Run this in the project directory
```
npm install
```
3. In the .env file replace these values for your environment
```env
UPLOAD_URL=https://ipasign.pro/
WORK_DIR=/home/dai1228/signer/uploads
PORT=3000
DEFAULT_IPA_PATH=/home/dai1228/Portal-1.9.0.ipa
ENCRYPTION_KEY=f526826e8d522a909d18566e840a591ef8b922dea6502bcbf5348a42ddd75091
```

4. Run the website and signer using:
```
npm run dev
```
