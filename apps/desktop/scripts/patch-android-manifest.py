#!/usr/bin/env python3
"""Patch Tauri generated AndroidManifest, preserving permissions and rotation."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ANDROID = "http://schemas.android.com/apk/res/android"
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
xml = re.sub(r'\s+android:screenOrientation="[^"]+"', "", xml)
xml = re.sub(r'\s+android:resizeableActivity="false"', ' android:resizeableActivity="true"', xml)
manifest.write_text(xml, encoding="utf-8")
try:
    root = ET.fromstring(xml)
except ET.ParseError as error:
    raise SystemExit(f"AndroidManifest inválido: {error}")
if root.tag != "manifest" or root.find("application") is None:
    raise SystemExit("Manifesto não contém <application>.")
permissions = [entry.get(f"{{{ANDROID}}}name") for entry in root.findall("uses-permission")]
assert "android.permission.RECORD_AUDIO" in permissions
assert "android.permission.INTERNET" in permissions
assert not any(f"{{{ANDROID}}}screenOrientation" in activity.attrib for activity in root.iter("activity"))
print("Manifesto Android: Internet, microfone e rotação permitidos.")
