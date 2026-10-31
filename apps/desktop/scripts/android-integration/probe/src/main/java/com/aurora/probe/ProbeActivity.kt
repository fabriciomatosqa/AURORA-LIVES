package com.aurora.probe

import android.app.Activity
import android.os.Bundle
import android.os.Process
import android.content.Intent
import java.security.MessageDigest

/** Independent UID, exercising the actual temporary Intent URI grant. */
class ProbeActivity : Activity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        val result = Intent("com.aurora.lives.PROBE_RESULT").setPackage("com.aurora.lives")
        try {
            val uri = intent.data!!
            val hash = MessageDigest.getInstance("SHA-256")
            var size = 0L
            contentResolver.openInputStream(uri)!!.use { input ->
                val buffer = ByteArray(65536)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    hash.update(buffer, 0, count); size += count
                }
            }
            result.putExtra("sha256", hash.digest().joinToString("") { "%02x".format(it.toInt() and 255) })
                .putExtra("size", size).putExtra("uid", Process.myUid())
        } catch (error: Exception) { result.putExtra("error", error.stackTraceToString()) }
        sendBroadcast(result)
        finish()
    }
}
