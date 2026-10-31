#!/usr/bin/env python3
"""Regression for Android APK installation dispatch, like AURORA IPTV."""
from pathlib import Path
import unittest

class AndroidInstallerIntentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = Path(__file__).with_name("ApkInstallerPlugin.kt").read_text(encoding="utf-8")

    def test_installer_uses_view_with_content_uri_and_mime_type(self):
        source = self.source
        self.assertIn('Intent(Intent.ACTION_VIEW)', source)
        self.assertNotIn('Intent(Intent.ACTION_INSTALL_PACKAGE)', source)
        self.assertIn('FileProvider.getUriForFile', source)
        self.assertIn('setDataAndType(uri, "application/vnd.android.package-archive")', source)
        self.assertIn('Intent.FLAG_GRANT_READ_URI_PERMISSION', source)
        self.assertIn('ClipData.newRawUri', source)
        self.assertIn('activity.startActivity(intent)', source)

    def test_archive_is_validated_before_installation(self):
        source = self.source
        self.assertIn('validateApk(file)', source)
        self.assertIn('ZipFile(file).use', source)
        self.assertIn('archive.packageName != activity.packageName', source)
        self.assertIn('incoming != existing', source)

if __name__ == "__main__":
    unittest.main()
