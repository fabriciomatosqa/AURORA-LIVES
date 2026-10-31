#!/usr/bin/env bash
# Disposable test-only keys/APKs. Never used for distribution or production signing.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p artifacts app/src/main/assets
rm -f app/src/main/assets/*.apk app/src/main/assets/*.sha256
# Candidate, then a certificate-mismatched candidate, then the installed baseline.
gradle :app:assembleDebug :probe:assembleDebug -PfixtureCode=26 --console=plain
cp app/build/outputs/apk/debug/app-debug.apk artifacts/candidate.apk
cp probe/build/outputs/apk/debug/probe-debug.apk artifacts/probe.apk
keytool -genkeypair -keystore artifacts/other-test.jks -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 30 -dname 'CN=Disposable integration test' -noprompt
# Re-sign a copy with a disposable identity, retaining the exact version/package.
"$ANDROID_HOME/build-tools/36.0.0/apksigner" sign --ks artifacts/other-test.jks --ks-pass pass:android --ks-key-alias androiddebugkey --out artifacts/wrong-signer.apk artifacts/candidate.apk
cp artifacts/candidate.apk app/src/main/assets/update.apk
cp artifacts/wrong-signer.apk app/src/main/assets/wrong-signer.apk
sha256sum artifacts/candidate.apk | cut -d ' ' -f 1 > app/src/main/assets/update.sha256
gradle :app:assembleDebug :app:assembleDebugAndroidTest -PfixtureCode=25 --console=plain
cp app/build/outputs/apk/debug/app-debug.apk artifacts/fixed.apk
cp app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk artifacts/tests.apk
gradle :app:assembleDebug -PfixtureCode=25 -PbrokenProvider=true --console=plain
cp app/build/outputs/apk/debug/app-debug.apk artifacts/broken.apk
# No private test key needs to leave the runner.
rm artifacts/other-test.jks
