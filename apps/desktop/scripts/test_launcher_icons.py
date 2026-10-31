"""Regression: the original crystalline logo replaces stale launcher resources."""
from pathlib import Path
import importlib.util
import tempfile
import unittest
from PIL import Image

desktop = Path(__file__).resolve().parent.parent
script = Path(__file__).with_name("sync-android-launcher.py")
spec = importlib.util.spec_from_file_location("aurora_launcher",script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class IconTests(unittest.TestCase):
    def test_stale_icon_overwritten_and_original_unmodified(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            official = desktop.parents[1]/"assets/branding/Emblema Triangular Neon Cristalino.png"
            res = root/"res"
            stale = res/"mipmap-mdpi/ic_launcher.png"
            stale.parent.mkdir(parents=True)
            Image.new("RGBA",(48,48),(255,210,0,255)).save(stale)
            manifest = root/"AndroidManifest.xml"
            manifest.write_text('<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:icon="@drawable/template"></application></manifest>')
            before = official.read_bytes()
            written = module.generate(official,official,res,manifest)
            self.assertEqual(len(written),18)
            self.assertEqual(official.read_bytes(),before)
            with Image.open(stale) as result:
                self.assertNotEqual(result.getpixel((24,24)),(255,210,0,255))
            self.assertIn('android:roundIcon="@mipmap/ic_launcher_round"',manifest.read_text())
            self.assertIn('@mipmap/ic_launcher_foreground',(res/"mipmap-anydpi-v26/ic_launcher.xml").read_text())


if __name__ == "__main__":
    unittest.main()
