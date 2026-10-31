#!/usr/bin/env python3
"""Generate a private, persistent Android signing keystore on the user's own PC.

Never checks the key into GitHub. Secrets must be configured by the repository
owner; this script will never upload keys, phone home or print private material.
"""
from __future__ import annotations

import base64
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys

OUTPUT_DIR = Path.home() / ".aurora-lives-signing"
ALIAS = "aurora-lives"
FILES = ("aurora-lives.jks", "key.base64", "password.txt", "alias.txt")


def main() -> None:
    keytool = shutil.which("keytool")
    if not keytool:
        sys.exit("Erro: Java JDK/keytool nao encontrado. Instale JDK 17 ou posterior.")
    OUTPUT_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    if any((OUTPUT_DIR / name).exists() for name in FILES):
        sys.exit("Uma chave ja existe nessa pasta. Recusando sobrescrever: " + str(OUTPUT_DIR))
    password = secrets.token_urlsafe(30)
    keystore = OUTPUT_DIR / FILES[0]
    command = [
        keytool, "-genkeypair", "-noprompt", "-storetype", "PKCS12",
        "-keystore", str(keystore), "-alias", ALIAS,
        "-keyalg", "RSA", "-keysize", "3072",
        "-validity", "10000", "-storepass", password, "-keypass", password,
        "-dname", "CN=AURORA LIVES, OU=Apps, O=AURORA, C=BR",
    ]
    try:
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        contents = {
            "key.base64": base64.b64encode(keystore.read_bytes()).decode("ascii"),
            "password.txt": password,
            "alias.txt": ALIAS,
        }
        for name, value in contents.items():
            target = OUTPUT_DIR / name
            with target.open("x", encoding="utf-8") as dest:
                dest.write(value + "\n")
            try:
                target.chmod(0o600)
            except OSError:
                pass
        try:
            keystore.chmod(0o600)
        except OSError:
            pass
    except Exception:
        # Do not leave an orphaned keystore with missing metadata.
        if keystore.exists():
            keystore.unlink()
        raise
    print("Chave Android persistente criada em:", OUTPUT_DIR)
    print("Guarde um backup privado de aurora-lives.jks e da senha.")
    print("Cadastre os 3 valores como GitHub Actions Secrets no repositorio:")
    print("ANDROID_KEY_BASE64  <-  key.base64")
    print("ANDROID_KEY_PASSWORD  <-  password.txt")
    print("ANDROID_KEY_ALIAS  <-  alias.txt")
    print("Nunca envie a chave, a senha ou o base64 para este chat.")


if __name__ == "__main__":
    main()
