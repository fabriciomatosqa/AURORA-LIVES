import unittest

from android_screen_awake import patch_main_activity


class AndroidScreenAwakeTests(unittest.TestCase):
    def test_injects_foreground_only_flag_and_is_idempotent(self):
        source = "package com.aurora.lives\n\nimport app.tauri.TauriActivity\n\nclass MainActivity : TauriActivity()\n"
        patched = patch_main_activity(source)
        self.assertIn("FLAG_KEEP_SCREEN_ON", patched)
        self.assertIn("override fun onResume()", patched)
        self.assertIn("override fun onPause()", patched)
        self.assertIn("window.clearFlags(", patched)
        self.assertEqual(patch_main_activity(patched), patched)

    def test_preserves_generated_tauri_activity_members(self):
        source = ("class MainActivity : TauriActivity() {\n"
                  "    override fun onCreate(savedInstanceState: android.os.Bundle?) {\n"
                  "        super.onCreate(savedInstanceState)\n"
                  "    }\n"
                  "}\n")
        patched = patch_main_activity(source)
        self.assertIn("super.onCreate(savedInstanceState)", patched)
        self.assertIn("FLAG_KEEP_SCREEN_ON", patched)
        self.assertEqual(patched.count("class MainActivity"), 1)
        self.assertEqual(patch_main_activity(patched), patched)

    def test_rejects_existing_lifecycle_override_or_missing_class(self):
        with self.assertRaisesRegex(ValueError, "revisão necessária"):
            patch_main_activity("class MainActivity : TauriActivity() {\n override fun onResume() {}\n}")
        with self.assertRaisesRegex(ValueError, "declaração da classe não encontrada"):
            patch_main_activity("class OtherActivity : TauriActivity() {}")


if __name__ == "__main__":
    unittest.main()
