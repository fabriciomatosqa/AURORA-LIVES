import importlib.util
import pathlib
import tempfile
import unittest

MODULE = pathlib.Path(__file__).with_name("verify-android-release.py")
spec = importlib.util.spec_from_file_location("aurora_verify_release", MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class SigningMetadataTests(unittest.TestCase):
    def test_validated_version_and_signature(self):
        with tempfile.TemporaryDirectory() as tmp:
            apk = pathlib.Path(tmp) / "AURORA-LIVES-Android-arm64.apk"
            apk.write_bytes(b"0" * 1200)
            sig = "Signer #1 certificate SHA-256 digest: " + ("a" * 64)
            badging = "package: name='com.aurora.lives' versionCode='17' versionName='0.0.17'\nsdkVersion:'26'"
            info = module.metadata(badging, sig, apk, "0.0.17", "a" * 64)
            self.assertEqual(info["versionCode"], 17)
            self.assertEqual(info["packageName"], "com.aurora.lives")
            with self.assertRaises(ValueError):
                module.metadata(badging, sig, apk, "0.0.17", "b" * 64)
            with self.assertRaises(ValueError):
                module.metadata(badging.replace("com.aurora.lives", "com.other"), sig, apk, "0.0.17", "a" * 64)
            with self.assertRaises(ValueError):
                module.metadata(badging.replace("versionCode='17'", "versionCode='16'"), sig, apk, "0.0.17", "a" * 64)

if __name__ == "__main__":
    unittest.main()

class PackagedProviderTests(unittest.TestCase):
    def tree(self, updater):
        return f'''  E: application (line=1)
    E: provider (line=2)
      A: android:name(0x01010003)="androidx.core.content.FileProvider"
      A: android:authorities(0x01010018)="com.aurora.lives.fileprovider"
      E: meta-data (line=3)
        A: android:name(0x01010003)="android.support.FILE_PROVIDER_PATHS"
    E: provider (line=4)
      A: android:name(0x01010003)="{updater}"
      A: android:authorities(0x01010018)="com.aurora.lives.aurora.fileprovider"
      E: meta-data (line=5)
        A: android:name(0x01010003)="android.support.FILE_PROVIDER_PATHS"
'''

    def test_packaged_legacy_collision_is_blocked(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            module.verify_provider_manifest(self.tree("androidx.core.content.FileProvider"))

    def test_isolated_component_is_accepted(self):
        module.verify_provider_manifest(self.tree("com.aurora.lives.ApkFileProvider"))
