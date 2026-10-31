#!/usr/bin/env python3
"""Publish the actual Android package metadata, like the AURORA IPTV.

CI must reject a package name, code, certificate or build type mismatch.
Only the certificate fingerprint is published. Private keys remain in secrets.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

PACKAGE_NAME = "com.aurora.lives"
MAX_APK = 250 * 1024 * 1024


def metadata(badging: str, signature: str, apk: Path, expected_version: str, expected_signer: str) -> dict:
    pkg = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging)
    if pkg is None or pkg.group(1) != PACKAGE_NAME or pkg.group(3) != expected_version:
        raise ValueError("APK package/version mismatch")
    release_code = sum(int(x) * scale for x, scale in zip(expected_version.split("."), (1_000_000, 1000, 1)))
    if int(pkg.group(2)) != release_code:
        raise ValueError("Unexpected Android versionCode")
    certs = re.findall(r"Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]{64})", signature)
    if len(certs) != 1 or certs[0].lower() != expected_signer.lower():
        raise ValueError("Signing identity does not match APK manifest")
    if apk.stat().st_size < 1024 or apk.stat().st_size > MAX_APK:
        raise ValueError("APK size outside permitted range")
    sdk = re.search(r"sdkVersion:'(\d+)'", badging)
    if not sdk:
        raise ValueError("APK minSdk missing")
    with apk.open("rb") as handle:
        digest = hashlib.file_digest(handle, "sha256").hexdigest()
    return {
        "schemaVersion": 1,
        "packageName": PACKAGE_NAME,
        "versionCode": int(pkg.group(2)),
        "versionName": pkg.group(3),
        "minSdk": int(sdk.group(1)),
        "signerSha256": expected_signer.lower(),
        "apkName": apk.name,
        "sha256": digest,
        "size": apk.stat().st_size,
    }


def main():
    apk, certificate = Path(sys.argv[1]), Path(sys.argv[2])
    sdk_root = Path(os.environ.get("ANDROID_HOME") or os.environ["ANDROID_SDK_ROOT"])
    tools = sdk_root / "build-tools" / "36.0.0"
    badging = subprocess.check_output([str(tools / "aapt"), "dump", "badging", str(apk)], text=True)
    sig = subprocess.check_output([str(tools / "apksigner"), "verify", "--print-certs", str(apk)], text=True)
    expected = certificate.read_text(encoding="utf-8").strip()
    version = json.loads(Path("package.json").read_text(encoding="utf-8"))["version"]
    obj = metadata(badging, sig, apk, version, expected)
    target = apk.parent / "aurora-lives-update.json"
    target.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Verified Android package v{version}, versionCode={obj['versionCode']}, signer={expected}")


if __name__ == "__main__":
    main()
