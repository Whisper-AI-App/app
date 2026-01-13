WIP - general notes to include, carry forwards however

# Running on iOS

## Running in an emulator

Relatively straightforward.

Pre-reqs:

- xcode
- emulator
- mac device

Run:

`pnpm run ios`

## Running on a device

> This guidance is for contributors who are named on the Apple team and have the right access to code signing and provisional profiles.

Whisper has additional entitlements to support the resources needed to run LLMs on a mobile phone. With that in mind, runing the app on a real device in development requires a slightly different approach.

This means `pnpm ios --device` tends not to work well. Below is an alternative approach.

Pre-reqs:

- xcode
- iphone
- mac device

Run:

1. `pnpm prebuild --platform ios --clean`

2. `pnpm start` - once running, continue to step 3

3. `xed ios` - this will open xcode with the Whisper project

.. probably some steps for developer to be able to actually build...

4. Tap the 'Run' icon, top left. This will build the app, with the correct provision profile and access.

5. Once the app has built and been installed on your phone, you'll want to open your Camera app and scan the QR code in the termal that has `pnpm start` running.

This should open Whisper and link the app to the dev server.
