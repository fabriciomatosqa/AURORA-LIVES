package com.aurora.lives

import android.app.Activity
import android.os.Bundle
import android.content.Intent
import android.content.ClipData
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File

/** Test fixture only. Never copied into the production application. */
class UpdateTestActivity : Activity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        getSharedPreferences("update-test", 0).edit().putString("sentinel", "keep-my-data").commit()
        try {
            val apk = File(cacheDir, "aurora-lives-updates/update.apk")
            apk.parentFile!!.mkdirs()
            assets.open("update.apk").use { input -> apk.outputStream().use { input.copyTo(it) } }
            val uri = FileProvider.getUriForFile(this, "$packageName.aurora.fileprovider", apk)
            val intent = if (this.intent.getBooleanExtra("legacy", false)) {
                Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    .apply { clipData = ClipData.newRawUri("Legacy", uri) }
            } else {
                val sha = assets.open("update.sha256").bufferedReader().use { it.readText().trim() }
                ApkUpdateInstaller(this).prepare(apk.path, sha, apk.length(), "0.0.26")
            }
            startActivity(intent)
        } catch (error: Exception) {
            Log.e("AuroraIntegration", "Launch failed", error)
            File(filesDir, "launch-error.txt").writeText(error.stackTraceToString())
        }
    }
}
