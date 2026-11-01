"""Safely inject Android's foreground-only screen wake flag into Tauri MainActivity.

The Tauri-generated MainActivity may contain lifecycle/plugin hooks. Preserve
those hooks and all source code; insert new methods inside its existing body.
"""
import re

MARKER = "AURORA_KEEP_SCREEN_ON"
MAIN_ACTIVITY = re.compile(r"\bclass\s+MainActivity\s*:\s*TauriActivity\(\)")

METHODS = """
    // AURORA_KEEP_SCREEN_ON: keep display active only while this Activity is visible.
    override fun onResume() {
        super.onResume()
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    override fun onPause() {
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        super.onPause()
    }
"""


def patch_main_activity(source: str) -> str:
    if MARKER in source:
        return source
    match = MAIN_ACTIVITY.search(source)
    if match is None:
        raise ValueError("MainActivity do Tauri mudou; declaração da classe não encontrada")
    if re.search(r"\boverride\s+fun\s+on(?:Resume|Pause)\s*\(", source[match.end():]):
        raise ValueError("MainActivity já possui ciclo de vida customizado; revisão necessária")

    remainder = source[match.end():]
    first_non_whitespace = re.search(r"\S", remainder)
    if first_non_whitespace is not None and remainder[first_non_whitespace.start()] == "{":
        # Preserve any current onCreate, plugin setup, or members.
        body_at = match.end() + first_non_whitespace.start() + 1
        return source[:body_at] + METHODS + source[body_at:]
    # Tauri's default Kotlin Activity may have no explicit body.
    return source[:match.end()] + " {" + METHODS + "\n}" + source[match.end():]
