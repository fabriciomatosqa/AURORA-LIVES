# Android updater investigation — 2026-10-31

## Published APK evidence

The published v0.0.24 APK was downloaded independently and inspected, including its binary AndroidManifest and resources (not just the repository source).

| Check | Result |
| --- | --- |
| APK size | 16,186,916 bytes |
| APK SHA-256 | `19de448faf3ab268d1c061cbd456057d303ccd137ca405538517502b9f0c4fba` |
| GitHub asset digest | Same SHA-256 |
| ZIP contents | Every entry passes CRC |
| Package / version | `com.aurora.lives`, 0.0.24, versionCode 24 |
| minSdk / ABI | 26 / ARM64 |
| `apksigner verify --verbose` | Valid APK Signature Scheme v2 |
| `zipalign -c -P 16 4` | Pass |
| v0.0.23 and v0.0.24 certificate | Same certificate |
| Certificate fingerprint published since v0.0.19 | `fc79f0f54efda7bce8ace574e107c696e9566b234914f9d76918ca446513ebc7` |

v0.0.23 SHA-256: `2bf22c9d6d3a773570165141b6f2709638263a08772200f82ee47eb9b7ee1c65`.

The old binary manifest contains two providers with identical class name `androidx.core.content.FileProvider`:

- `com.aurora.lives.fileprovider`, supplied by Tauri, with cache root `my_cache_images` and external root `my_images`.
- `com.aurora.lives.aurora.fileprovider`, supplied by the updater, with cache root `aurora_verified_apks` under `aurora-lives-updates/`.

Distinct authorities do not give these components distinct ComponentNames. Android can reuse a provider instance attached with the other metadata/path strategy. A URI generated for `aurora_verified_apks` can consequently be unreadable even though direct filesystem validation succeeds. The API 29 and API 35 emulators reproduced the failure as:

```text
java.lang.SecurityException: The authority com.aurora.lives.aurora.fileprovider does not match the one of the contentProvider: com.aurora.lives.fileprovider
at android.content.ContentProvider.validateIncomingAuthority
at android.content.ContentResolver.openInputStream
```

This establishes the URI/component failure independently of APK integrity and explains why changing the installation Intent did not fix the update.

Reference: [Android FileProvider documentation](https://developer.android.com/reference/androidx/core/content/FileProvider) recommends a subclass rather than direct use of FileProvider. The emulator regression test must reproduce the old read failure before accepting a correction.

The AURORA IPTV was inspected read-only. It has one update provider and uses a narrow cache path, ACTION_VIEW, the APK MIME type, ClipData and a temporary read grant. Its signing key and repository were not modified.

## Correction

- Give the updater its own `com.aurora.lives.ApkFileProvider` component. Retain Tauri's existing provider for its original operations.
- Repair both newly generated and already patched Android manifests. Reject duplicated component names.
- Send expected SHA-256, byte count and version from Rust's verified download state to Kotlin; compare them again rather than computing an unrelated new baseline.
- Check package identity, exact version/code, increasing code, minSdk, native ABI and exact installed signer equality. Request both GET_SIGNATURES and GET_SIGNING_CERTIFICATES, as IPTV does: the Android 9/10 archive parser only collects certificates when GET_SIGNATURES is present. The API 29 integration test exposed this additional compatibility defect; equality checks remain mandatory.
- Read the entire shared content URI and compare its byte count/hash to Rust's verified metadata before starting the installer.
- Run native verification on a worker thread and launch the system UI on the Activity thread.
- Keep the APK in app-private cache with the original narrow FileProvider path and temporary read permission.
- Record native validation failures and URI diagnostics in Logcat under `AuroraApkInstaller`.
- Gate production APK publication on on-device integration tests, and inspect the final APK's packaged manifest, signature, alignment, CRC and ABI before publication.

The startup check, two-hour timer, explicit user acceptance, progress bar and retry flow remain in the existing updater hook. Android may suspend timers while the process is stopped or sleeping; this implementation does not add a background scheduling service.

## Reproduce the Android tests

Use an isolated emulator, never a phone containing the user's real LIVES data. The integration harness deliberately installs disposable applications with the real package ID and a disposable debug signing identity. These are not distribution APKs and are never attached to a release.

Prerequisites: JDK 17, Gradle 8.13, SDK platform 35, build-tools 36, adb and a booted API 29 or 35 emulator. Set ANDROID_HOME and include Gradle/adb in PATH.

```bash
bash apps/desktop/scripts/android-integration/build-fixtures.sh
python3 apps/desktop/scripts/android-integration/run-device-tests.py
```

The harness uses the production `ApkUpdateInstaller.kt` and `ApkFileProvider.kt`, not a reimplementation. It produces an old manifest fixture, a fixed installed fixture and a newer candidate with a matching test certificate. It also creates an incompatible-certificate candidate.

The device run:

1. Requires the old duplicate-provider URI read to fail, saving the exception and the old installer UI.
2. Requires valid-APK URI reading to succeed with the fixed provider.
3. Starts a second app under a different UID using the same MIME/URI/ClipData/read grant; checks every byte, SHA-256 and size.
4. Rejects changed bytes, wrong size, wrong version, path traversal, an invalid archive and a different certificate.
5. Opens the actual Android Package Installer, confirms the normal update prompt and checks installed versionCode 26 plus a retained preference sentinel.

Results, installer UI XML and Logcat are uploaded by the `android-updater-tests.yml` reusable workflow. Test signing keys are disposable and are not uploaded.

## Physical-device verification

The updater of an already installed old APK cannot be repaired by the new APK before that APK is installed. To bootstrap from v0.0.23/24, download the first corrected signed APK from the official release and open it using Android's Downloads/Files application. Install it over the existing application; do not uninstall or clear app data. The certificate must remain the fingerprint above.

After that baseline is installed, use Settings → Atualizações online → Verificar atualizações, accept the following signed version and confirm the Android installer. Check that the displayed installed version changes after relaunch and that preferences remain intact.

For device-specific diagnostics:

```bash
adb logcat -c
# Reproduce the update on the phone.
adb logcat -d -v threadtime > lives-update-logcat.txt
adb shell dumpsys package com.aurora.lives > lives-installed-package.txt
```

Inspect `AuroraApkInstaller`, `FileProvider`, `PackageInstaller` and `PackageManager` messages. Logs can contain device/application information; review them before sharing.

The emulators establish Android provider/grant behavior and installation/data retention for the shared native updater. They do not emulate Xiaomi/HyperOS, ARM64 hardware, the user's existing cache contents, audio/video devices or real mobile-network conditions. Those observations must not be represented as physical-device test results.

## Measured regression results

[Android integration run](https://github.com/fabriciomatosqa/AURORA-LIVES/actions/runs/41213356275)

| Environment | Legacy URI/parse failure reproduced | Native tests | Actual system-installer update | Data sentinel |
| --- | --- | --- | --- | --- |
| Android 10, API 29 | Yes: authority mismatch and parsing dialog | 9 passed | fixture versionCode 25 → 26 | Preserved |
| Android 15, API 35 | Yes: authority mismatch and parsing dialog | 9 passed | fixture versionCode 25 → 26 | Preserved |

Both device jobs execute the production native installer helper, including validation against download metadata, package/version/certificate checks, cross-UID URI reading and negative integrity/compatibility tests. These are emulator fixture results, not claims of a POCO physical-device test. The full ARM64 Tauri APK is compiled and inspected separately in the release pipeline.

The first corrected distribution is 0.0.25. Version 0.0.26 retains the same updater implementation and provides the following real, signed release for an in-app transition after manually installing 0.0.25 over the old version.
