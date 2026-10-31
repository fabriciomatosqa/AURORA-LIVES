#!/usr/bin/env python3
"""Replace stale Android launcher icons with the ORIGINAL AURORA crystal logo.

Executed after 'tauri android init', before building the APK. No source art is edited.
"""
from pathlib import Path
from hashlib import sha256
import re
import xml.etree.ElementTree as ET
from PIL import Image

DESKTOP = Path(__file__).resolve().parent.parent
SOURCE = DESKTOP / "src-tauri/icons/source.png"
MASTER = DESKTOP.parents[1] / "assets/branding/Emblema Triangular Neon Cristalino.png"
RES = DESKTOP / "src-tauri/gen/android/app/src/main/res"
MANIFEST = DESKTOP / "src-tauri/gen/android/app/src/main/AndroidManifest.xml"
SHA = "230aafa4ba6aaf9d5d65d30e4ae725fb1b246e20e95a835bac998d18cb3498a7"
DENSITIES = {"mdpi":1, "hdpi":1.5, "xhdpi":2, "xxhdpi":3, "xxxhdpi":4}
ANDROID_NS = "http://schemas.android.com/apk/res/android"


def generate(source=SOURCE, master=MASTER, res=RES, manifest=MANIFEST):
    if not manifest.is_file():
        raise RuntimeError("Execute tauri android init primeiro.")
    raw = source.read_bytes()
    if sha256(raw).hexdigest() != SHA or master.read_bytes() != raw:
        raise RuntimeError("A origem deve ser exatamente Emblema Triangular Neon Cristalino.png.")
    with Image.open(source) as im:
        if im.mode != "RGBA" or im.size != (1254,1254):
            raise RuntimeError("A imagem original deve ser RGBA 1254 x 1254.")
        logo = im.copy()
    written = []
    for density, ratio in DENSITIES.items():
        dest_dir = res / ("mipmap-" + density)
        dest_dir.mkdir(parents=True, exist_ok=True)
        for name, dp, fill in (
            ("ic_launcher.png",48,0.88),
            ("ic_launcher_round.png",48,0.76),
            ("ic_launcher_foreground.png",108,0.66),
        ):
            side = round(dp * ratio)
            art_side = round(side * fill)
            art = logo.resize((art_side,art_side),Image.Resampling.LANCZOS)
            img = Image.new("RGBA",(side,side),(0,0,0,0))
            margin = (side-art_side)//2
            img.alpha_composite(art,(margin,margin))
            target = dest_dir / name
            img.save(target,"PNG",compress_level=7)
            with Image.open(target) as checked:
                if checked.mode != "RGBA" or checked.size != (side,side) or checked.tobytes() != img.tobytes():
                    raise RuntimeError(f"Ícone Android inválido: {target}")
            written.append(target)

    # Android 8+ adaptive icons; explicitly override any Tauri template references.
    adaptive = res / "mipmap-anydpi-v26"
    adaptive.mkdir(parents=True, exist_ok=True)
    xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
 <background android:drawable="@color/aurora_launcher_background"/>
 <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''
    for name in ("ic_launcher.xml","ic_launcher_round.xml"):
        target = adaptive/name
        target.write_text(xml,encoding="utf-8")
        written.append(target)
    color = res/"values/aurora_launcher_colors.xml"
    color.parent.mkdir(parents=True,exist_ok=True)
    color.write_text('<?xml version="1.0" encoding="utf-8"?><resources><color name="aurora_launcher_background">#080D19</color></resources>',encoding="utf-8")
    written.append(color)

    text = manifest.read_text(encoding="utf-8")
    found = re.search(r"<application\b[^>]*>",text,re.DOTALL)
    if not found:
        raise RuntimeError("Manifest Android sem application.")
    tag = found.group()
    for attr,value in (("icon","@mipmap/ic_launcher"),("roundIcon","@mipmap/ic_launcher_round")):
        pattern = rf'android:{attr}="[^"]*"'
        new = f'android:{attr}="{value}"'
        tag = re.sub(pattern,new,tag) if re.search(pattern,tag) else tag[:-1]+" "+new+">"
    manifest.write_text(text[:found.start()]+tag+text[found.end():],encoding="utf-8")
    app = ET.parse(manifest).getroot().find("application")
    if app is None or app.get(f"{{{ANDROID_NS}}}icon") != "@mipmap/ic_launcher" or app.get(f"{{{ANDROID_NS}}}roundIcon") != "@mipmap/ic_launcher_round":
        raise RuntimeError("AndroidManifest não usa os ícones oficiais AURORA.")
    print(f"Logo AURORA original validada: SHA256 {SHA}; {len(written)} ícones Android sincronizados.")
    return written


if __name__ == "__main__":
    generate()
