#!/usr/bin/env python3
"""Use AURORA IPTV-style persistent test key lifecycle for AURORA LIVES.

The first main build bootstraps a TEST key. Later builds restore the exact
keystore and private credentials from Actions cache, or recover from Secrets.
If any Android-signed release exists, never silently generate a replacement.
Test keys in Actions caches are NOT appropriate for public production use.
"""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import secrets
import subprocess

SIGNING_DIR = Path(".signing")
KEYSTORE = SIGNING_DIR / "aurora-lives.jks"
CREDS = SIGNING_DIR / "credentials.json"
ALIAS = "aurora-lives"
PROPERTIES = Path("src-tauri/gen/android/keystore.properties")


def run(*args: str, input_text: str | None = None) -> str:
    return subprocess.check_output(args, text=True, input=input_text, stderr=subprocess.PIPE).strip()


def has_published_signed_apk() -> bool:
    releases = json.loads(run("gh", "api", "repos/fabriciomatosqa/AURORA-LIVES/releases?per_page=100"))
    return any(
        not r.get("draft") and any(a.get("name") == "ANDROID-CERT-SHA256.txt" for a in r.get("assets", []))
        for r in releases
    )


def validate_key(password: str, alias: str) -> None:
    # -list verifies that password and alias really match the stored keystore.
    run("keytool", "-list", "-keystore", str(KEYSTORE),
        "-storepass", password, "-alias", alias)


def main() -> None:
    if os.getenv("GITHUB_REF") != "refs/heads/main":
        raise SystemExit("Signing test key may be used only on main.")
    SIGNING_DIR.mkdir(parents=True, exist_ok=True)
    SIGNING_DIR.chmod(0o700)

    supplied = [os.environ.get(k, "") for k in
                ("ANDROID_KEY_BASE64", "ANDROID_KEY_PASSWORD", "ANDROID_KEY_ALIAS")]
    if 0 < sum(bool(v) for v in supplied) < 3:
        raise SystemExit("Configure all three signing secrets, or none.")

    has_key, has_creds = KEYSTORE.is_file(), CREDS.is_file()
    if has_key != has_creds:
        raise SystemExit("Incomplete cached signing key; will not create a replacement.")

    if has_key:
        data = json.loads(CREDS.read_text(encoding="utf-8"))
        password = data["password"]
        alias = data["alias"]
        if len(supplied[0]) > 0:
            candidate = base64.b64decode(supplied[0], validate=True)
            if candidate != KEYSTORE.read_bytes() or supplied[1:] != [password, alias]:
                raise SystemExit("Cached identity differs from repository secrets. Refusing rotation.")
        print("Original signing key restored from Actions cache.")
    elif supplied[0]:
        KEYSTORE.write_bytes(base64.b64decode(supplied[0], validate=True))
        password, alias = supplied[1:]
        CREDS.write_text(json.dumps({"password": password, "alias": alias}), encoding="utf-8")
        print("Original signing key restored from GitHub Secrets.")
    else:
        if has_published_signed_apk():
            raise SystemExit("The original signing key is missing. Restore the original secret or cache; never replace it.")
        password = secrets.token_urlsafe(32)
        alias = ALIAS
        run("keytool", "-genkeypair", "-noprompt", "-storetype", "PKCS12",
            "-keystore", str(KEYSTORE), "-alias", alias,
            "-keyalg", "RSA", "-keysize", "3072", "-validity", "10000",
            "-storepass", password, "-keypass", password,
            "-dname", "CN=AURORA LIVES, OU=Test Apps, O=AURORA, C=BR")
        CREDS.write_text(json.dumps({"password": password, "alias": alias}), encoding="utf-8")
        print("Generated initial AURORA LIVES TEST key (not a production release identity).")

    validate_key(password, alias)
    KEYSTORE.chmod(0o600)
    CREDS.chmod(0o600)

    # Never echo private key data or the signing password to job logs.
    PROPERTIES.parent.mkdir(parents=True, exist_ok=True)
    PROPERTIES.write_text(
        "password=" + password + "\n"
        + "keyAlias=" + alias + "\n"
        + "storeFile=" + str(KEYSTORE.resolve()) + "\n",
        encoding="utf-8",
    )
    PROPERTIES.chmod(0o600)


if __name__ == "__main__":
    main()
