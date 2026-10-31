#!/usr/bin/env python3
"""Re-encode generated Android launch icons as standard 8-bit RGBA PNGs.

Keeps exactly the original colors, dimensions, alpha and logo composition.
Source artwork (Emblema Triangular Neon Cristalino.png) is never modified.
This works around AAPT2 resource-compile errors with the CLI-generated PNGs.
"""
from pathlib import Path
from PIL import Image
import os

icons = Path("src-tauri/icons/android")
paths = list(icons.rglob("*.png"))
if len(paths) < 10:
    raise SystemExit(f"Android icon output absent or incomplete: {icons} ({len(paths)} PNGs)")

for path in paths:
    with Image.open(path) as original:
        original.load()
        before_size = original.size
        result = original.convert("RGBA")
        if result.size != before_size:
            raise SystemExit(f"Unexpected icon size change: {path}")
        # Only generated icons are touched. The master logo is not processed.
        temp = path.with_suffix(".clean.png")
        try:
            result.save(temp, format="PNG", optimize=True, compress_level=6)
            with Image.open(temp) as verified:
                if verified.mode != "RGBA" or verified.size != before_size:
                    raise SystemExit(f"Output is not 8-bit RGBA: {path}")
                # Pixel-for-pixel comparison ensures no visible change.
                if verified.tobytes() != result.tobytes():
                    raise SystemExit(f"Icon pixels were modified: {path}")
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)

print(f"Normalized {len(paths)} generated Android PNGs without modifying the master logo.")
