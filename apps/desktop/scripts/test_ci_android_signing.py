import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).with_name("ci-android-signing.py")
spec = importlib.util.spec_from_file_location("aurora_ci_signing", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AndroidSigningTests(unittest.TestCase):
    def test_private_test_key_lifecycle_requires_known_previous_identity(self):
        self.assertEqual(module.ALIAS, "aurora-lives")
        self.assertEqual(module.KEYSTORE.name, "aurora-lives.jks")
        self.assertIn(".signing", module.KEYSTORE.parts)

    def test_ci_script_does_not_embed_signing_secrets(self):
        script = source.read_text(encoding="utf-8")
        self.assertIn("if has_published_signed_apk():", script)
        self.assertIn("Refusing rotation", script)
        self.assertIn("secrets.token_urlsafe(32)", script)


if __name__ == "__main__":
    unittest.main()
