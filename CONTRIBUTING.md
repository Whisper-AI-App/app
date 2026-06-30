# Contributing to Whisper AI

Thanks for your interest in contributing to Whisper! We welcome contributions from everyone.

## Contents

- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Guidelines](#guidelines)
- [License](#license)
- [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
- [Commercial Use & Enterprise Inquiries](#commercial-use--enterprise-inquiries)
- [Community & Questions](#community--questions)

## Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm (comes with Node.js)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- For iOS: macOS with Xcode
- For Android: Android Studio with an emulator or physical device

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies with `npm install`
4. Run the app with `npm run ios` or `npm run android` (see **Caching model downloads on emulators** below when running on an emulator)

## How to Contribute

### Finding Work

Browse our open issues. If you find an unassigned issue you'd like to work on, comment on it to let us know you're picking it up.

### Working on an Issue

1. **Check for a spec** - Some issues include a specification or implementation details. Feel free to follow it or propose alternatives if you think you have a better approach.

2. **No spec? Write one** - If the issue lacks a spec, draft one and post it in the issue comments for approval before starting work.

3. **Submit a PR** - When ready, open a pull request referencing the issue. By doing so, you agree to the CLA terms stated above. We'll review it and work with you to get it merged.

## Guidelines

- Keep PRs focused on a single issue
- Follow existing code patterns and conventions
- Run `npm run lint` before submitting

### Caching model downloads on emulators

When working on model-download code, emulators re-fetch multi-gigabyte GGUF files on every fresh install. To avoid this, run the local caching proxy in a separate terminal:

```bash
npm run caching         # start proxy on http://localhost:8787
npm run caching:clear   # wipe the .cache/ directory
```

`src/utils/dev-proxy.ts` automatically routes downloads through the proxy on emulators in dev mode; physical devices and production builds bypass it entirely.

## Running on Emulators

### Android

#### Standard (macOS / Linux / Windows native)

1. Install [Android Studio](https://developer.android.com/studio)
2. Once installed, open Android Studio and go to **Device Manager** (phone icon in the right sidebar)
3. Click **+** → **Create Virtual Device** → Select **Pixel 8** → Click **Next**
4. Download and select **API 35** as the system image → Click **Finish**
5. Press the **▶ Play** button next to your device to start the emulator — wait for it to fully boot
6. In your terminal, run:
```bash
   npx expo start
```
7. Press **a** to open the app on your Android emulator

---

#### WSL2 (Windows Subsystem for Linux)

> **Important:** Android Studio must be installed on **Windows**, not inside WSL. WSL cannot run `.exe` binaries directly, so the Android SDK needs to live on the Windows side.

**Step 1 — Install Android Studio on Windows**

Download and install [Android Studio](https://developer.android.com/studio) on Windows. During setup, make sure the following are checked:
- Android SDK
- Android SDK Platform-Tools
- Android Virtual Device

**Step 2 — Create and start a virtual device**

- Open Android Studio → **Device Manager** (right sidebar)
- Click **+** → **Create Virtual Device** → **Pixel 8** → **API 35** → **Finish**
- Press **▶** to start the emulator and wait for it to fully boot before continuing

**Step 3 — Point WSL to the Windows Android SDK**

Open your WSL terminal and find your Windows username:
```bash
ls /mnt/c/Users/
```

Then add the Android SDK path to your shell config:
```bash
echo 'export ANDROID_HOME=/mnt/c/Users/<your-windows-username>/AppData/Local/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc
```

Replace `<your-windows-username>` with the folder name you saw in the previous step.

**Step 4 — Run the app**

```bash
npx expo start
```

Press **a** — Expo will detect the running emulator and deploy the app to it.

> **Troubleshooting:** If you see `adb ENOENT`, double check that:
> - The emulator is fully booted in Android Studio before pressing `a`
> - Your `ANDROID_HOME` path is correct (`ls $ANDROID_HOME/platform-tools/` should list files)
> - You ran `source ~/.bashrc` after editing the file

---

### iOS

> macOS only — iOS simulators require Xcode which is not available on Windows or Linux.

1. Install [Xcode](https://apps.apple.com/app/xcode/id497799835) from the Mac App Store
2. Open Xcode at least once to accept the license agreement and install additional components
3. Install the Xcode Command Line Tools:
```bash
   xcode-select --install
```
4. Run the app:
```bash
   npx expo start
```
5. Press **i** to open the app in the iOS Simulator

---

### Writing & Running Tests

Run the full test suite:
```bash
npm test
```

Run a specific test file:
```bash
npm test -- src/__tests__/your-file.test.ts
```

Run tests in watch mode during development:
```bash
npm test -- --watch
```

## Community & Questions

Join our Discord to connect with other contributors, ask questions, and share ideas:
[Join our Discord](https://discord.gg/A6JxByaKNX)

You can also open an issue or comment on an existing one. We're happy to help.

## License

This project uses the [PolyForm Noncommercial License](./LICENSE).

We chose a fair-source license because transparency is at the heart of Whisper. You can read, verify, and trust the code that runs on your device. Personal and non-commercial use is free. If you'd like to use Whisper commercially, [get in touch](#commercial-use--enterprise-inquiries).

## Contributor License Agreement (CLA)

Thank you for contributing! We fair-source our code for transparency and welcome community improvements.

By submitting a Pull Request or contributing code to this repository, you agree to our full [Contributor License Agreement](./CLA.md).

The highlights:

1. **Grant of Rights:** You grant Ava Technologies Global Ltd a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, sublicense, and distribute your contributions.
2. **Right to Commercialize:** You specifically acknowledge that Ava Technologies Global Ltd may include your contributions in paid versions of the software (such as the App Store/Google Play versions) and future Enterprise offerings under different license terms.
3. **Ownership:** You represent that you are the owner of the code you are contributing or have the legal right to submit it.
4. **No Warranty:** You provide your contributions on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

## Commercial Use & Enterprise Inquiries

This software is licensed for non-commercial use only. If you wish to use this software for business purposes, commercial redistribution, or are interested in our upcoming Enterprise Offering, please contact:

https://avatechnologies.org/contact