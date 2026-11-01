import unittest

from android_screen_awake import patch_main_activity


class AndroidScreenAwakeTests(unittest.TestCase):
    def test_injects_foreground_only_flag(self):
        source = "package com.aurora.lives\n\nimport app.tauri.TauriActivity\n\nclass MainActivity : TauriActivity()\n"
        patched = patch_main_activity(source)
        self.assertIn("FLAG_KEEP_SCREEN_ON", patched)
        self.assertIn("override fun onResume()", patched)
        self.assertIn("override fun onPause()", patched)
        self.assertIn("window.clearFlags(", patched)
        self.assertEqual(patch_main_activity(patched), patched)

    def test_rejects_custom_main_activity_instead_of_damaging_it(self):
        with self.assertRaisesRegex(ValueError, "não é seguro"):
            patch_main_activity("class MainActivity : TauriActivity() {\n  fun custom() {}\n}")


if __name__ == "__main__":
    unittest.main()
