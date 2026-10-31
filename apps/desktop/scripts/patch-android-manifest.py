#!/usr/bin/env python3
"""Patch Tauri generated AndroidManifest, preserving permissions and rotation."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ANDROID = "http://schemas.android.com/apk/res/android"

# Keep the Kotlin implementation in the repository; the generated Android
# project is ignored, so every CI build installs this implementation explicitly.
ANDROID_INSTALLER_PLUGIN = (Path(__file__).parent / "ApkInstallerPlugin.kt").read_text(encoding="utf-8")
manifest = Path("src-tauri/gen/android/app/src/main/AndroidManifest.xml")
if not manifest.is_file():
    raise SystemExit("AndroidManifest não foi gerado pelo Tauri android init.")

xml = manifest.read_text(encoding="utf-8")
missing = []
for permission in (
    "android.permission.INTERNET",
    "android.permission.RECORD_AUDIO",
    "android.permission.MODIFY_AUDIO_SETTINGS",
    "android.permission.WAKE_LOCK",
    "android.permission.REQUEST_INSTALL_PACKAGES",
):
    if permission not in xml:
        missing.append(f'    <uses-permission android:name="{permission}" />')
if "android.hardware.microphone" not in xml:
    missing.append(
        '    <uses-feature android:name="android.hardware.microphone" android:required="false" />'
    )
if missing:
    xml, count = re.subn(r"(<application\b)", "\n".join(missing) + "\n    " + r"\1", xml, count=1)
    if count != 1:
        raise SystemExit("Tag <application> não encontrada.")
# The verified APK is shared through an app-private FileProvider URI.
if "com.aurora.lives.aurora.fileprovider" not in xml:
    provider = (
        '        <provider android:name="com.aurora.lives.ApkFileProvider" '
        'android:authorities="com.aurora.lives.aurora.fileprovider" '
        'android:exported="false" android:grantUriPermissions="true">\n'
        '            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" '
        'android:resource="@xml/aurora_apk_paths" />\n'
        '        </provider>\n'
    )
    xml, count = re.subn(r'(</application>)', provider + r'\1', xml, count=1)
    if count != 1:
        raise SystemExit("Tag </application> não encontrada.")
xml = re.sub(r'\s+android:screenOrientation="[^"]+"', "", xml)
xml = re.sub(r'\s+android:resizeableActivity="false"', ' android:resizeableActivity="true"', xml)
# Also repair a previously patched generated tree, not just a clean `android init`.
ET.register_namespace("android", ANDROID)
root = ET.fromstring(xml)
for entry in root.findall(".//provider"):
    if entry.get(f"{{{ANDROID}}}authorities") == "com.aurora.lives.aurora.fileprovider":
        entry.set(f"{{{ANDROID}}}name", "com.aurora.lives.ApkFileProvider")
xml = ET.tostring(root, encoding="unicode")
manifest.write_text(xml, encoding="utf-8")
resources = Path("src-tauri/gen/android/app/src/main/res/xml")
resources.mkdir(parents=True, exist_ok=True)
(resources / "aurora_apk_paths.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<paths xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <cache-path name="aurora_verified_apks" path="aurora-lives-updates/" />\n'
    '</paths>\n',
    encoding="utf-8",
)
plugin = Path("src-tauri/gen/android/app/src/main/java/com/aurora/lives/ApkInstallerPlugin.kt")
plugin.parent.mkdir(parents=True, exist_ok=True)
plugin.write_text(ANDROID_INSTALLER_PLUGIN, encoding="utf-8")
for helper in ("ApkFileProvider.kt", "ApkUpdateInstaller.kt"):
    (plugin.parent / helper).write_text(
        (Path(__file__).parent / helper).read_text(encoding="utf-8"), encoding="utf-8"
    )
try:
    root = ET.fromstring(xml)
except ET.ParseError as error:
    raise SystemExit(f"AndroidManifest inválido: {error}")
if root.tag != "manifest" or root.find("application") is None:
    raise SystemExit("Manifesto não contém <application>.")
permissions = [entry.get(f"{{{ANDROID}}}name") for entry in root.findall("uses-permission")]
assert "android.permission.RECORD_AUDIO" in permissions
assert "android.permission.INTERNET" in permissions
assert "android.permission.REQUEST_INSTALL_PACKAGES" in permissions
providers = root.findall(".//provider")
assert len([p for p in providers if p.get(f"{{{ANDROID}}}authorities") == "com.aurora.lives.aurora.fileprovider"]) == 1
provider_names = [p.get(f"{{{ANDROID}}}name") for p in providers]
assert len(provider_names) == len(set(provider_names)), "Provider ComponentName duplicado."
assert not any(f"{{{ANDROID}}}screenOrientation" in activity.attrib for activity in root.iter("activity"))
print("Android: microfone, rotação, FileProvider e instalador APK nativo configurados.")
