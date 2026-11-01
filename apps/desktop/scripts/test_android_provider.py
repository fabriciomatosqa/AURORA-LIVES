"""Exercise generation with the provider already supplied by Tauri."""
from pathlib import Path
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

class ProviderTests(unittest.TestCase):
    def test_distinct_components_and_repeatable_patch(self):
        script = Path(__file__).with_name('patch-android-manifest.py').resolve()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = root / 'src-tauri/gen/android/app/src/main/AndroidManifest.xml'
            manifest.parent.mkdir(parents=True)
            manifest.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application><provider android:name="androidx.core.content.FileProvider" android:authorities="com.aurora.lives.fileprovider" /></application></manifest>')
            activity = manifest.parent / 'java/com/aurora/lives/MainActivity.kt'
            activity.parent.mkdir(parents=True, exist_ok=True)
            activity.write_text('package com.aurora.lives\n\nimport app.tauri.TauriActivity\n\nclass MainActivity : TauriActivity()\n')
            for _ in range(2):
                subprocess.run(['python3', str(script)], cwd=root, check=True, capture_output=True)
            providers = ET.parse(manifest).findall('.//provider')
            names = [p.get('{http://schemas.android.com/apk/res/android}name') for p in providers]
            self.assertEqual(len(names), len(set(names)))
            self.assertIn('com.aurora.lives.ApkFileProvider', names)
            self.assertTrue((manifest.parent / 'java/com/aurora/lives/ApkFileProvider.kt').exists())

    def test_existing_legacy_provider_is_repaired(self):
        script = Path(__file__).with_name('patch-android-manifest.py').resolve()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest = root / 'src-tauri/gen/android/app/src/main/AndroidManifest.xml'
            manifest.parent.mkdir(parents=True)
            manifest.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application><provider android:name="androidx.core.content.FileProvider" android:authorities="com.aurora.lives.fileprovider"/><provider android:name="androidx.core.content.FileProvider" android:authorities="com.aurora.lives.aurora.fileprovider"/></application></manifest>')
            activity = manifest.parent / 'java/com/aurora/lives/MainActivity.kt'
            activity.parent.mkdir(parents=True, exist_ok=True)
            activity.write_text('package com.aurora.lives\n\nimport app.tauri.TauriActivity\n\nclass MainActivity : TauriActivity()\n')
            subprocess.run(['python3', str(script)], cwd=root, check=True, capture_output=True)
            providers = ET.parse(manifest).findall('.//provider')
            self.assertEqual([p.get('{http://schemas.android.com/apk/res/android}name') for p in providers],
                             ['androidx.core.content.FileProvider', 'com.aurora.lives.ApkFileProvider'])
