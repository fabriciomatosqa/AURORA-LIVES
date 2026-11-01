"""Safe, idempotent addition of an Android foreground-only screen wake flag.

Tauri generates and ignores MainActivity.kt; the patch must run after every
'android init' in both CI and local APK builds.
"""
import re

MARKER = "AURORA_KEEP_SCREEN_ON"
MAIN_ACTIVITY = re.compile(
    r"(?m)^class MainActivity\s*:\s*TauriActivity\(\)\s*(?:\{\s*\})?\s*\Z"
)


def patch_main_activity(source: str) -> str:
    if MARKER in source:
        return source
    match = MAIN_ACTIVITY.search(source)
    if match is None:
        raise ValueError("MainActivity do Tauri mudou; patch de tela ativa não é seguro")
    replacement = """class MainActivity : TauriActivity() {
    // AURORA_KEEP_SCREEN_ON: prevent dimming only while this Activity is visible.
    override fun onResume() {
        super.onResume()
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    override fun onPause() {
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        super.onPause()
    }
}
"""
    return source[:match.start()] + replacement
