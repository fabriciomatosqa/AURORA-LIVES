package com.aurora.lives

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Process
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ApkUpdaterTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private fun candidate(): File {
        val apk = File(context.cacheDir, "aurora-lives-updates/update.apk")
        apk.parentFile!!.mkdirs()
        context.assets.open("update.apk").use { input -> apk.outputStream().use { input.copyTo(it) } }
        return apk
    }
    private fun sha(file: File) = MessageDigest.getInstance("SHA-256").digest(file.readBytes())
        .joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun blocked(expected: String, action: () -> Unit) {
        try { action(); fail("Invalid APK was accepted") }
        catch (error: IllegalArgumentException) { assertTrue(error.message, error.message!!.contains(expected)) }
    }

    @Test fun validApkIsReadableThroughContentUri() {
        val apk = candidate()
        val intent = ApkUpdateInstaller(context).prepare(apk.path, sha(apk), apk.length(), "0.0.26")
        assertEquals(Intent.ACTION_VIEW, intent.action)
        assertEquals("application/vnd.android.package-archive", intent.type)
        assertEquals("content", intent.data!!.scheme)
        assertArrayEquals(apk.readBytes(), context.contentResolver.openInputStream(intent.data!!)!!.use { it.readBytes() })
    }

    @Test fun separateUidReadsEveryByteWithTemporaryGrant() {
        val apk = candidate()
        val latch = CountDownLatch(1)
        var result: Intent? = null
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, intent: Intent) { result = intent; latch.countDown() }
        }
        ContextCompat.registerReceiver(context, receiver, IntentFilter("com.aurora.lives.PROBE_RESULT"), ContextCompat.RECEIVER_EXPORTED)
        try {
            val intent = ApkUpdateInstaller(context).prepare(apk.path, sha(apk), apk.length(), "0.0.26")
                .setComponent(ComponentName("com.aurora.probe", "com.aurora.probe.ProbeActivity"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            assertTrue("External URI reader timed out", latch.await(30, TimeUnit.SECONDS))
            assertNull(result!!.getStringExtra("error"))
            assertNotEquals(Process.myUid(), result!!.getIntExtra("uid", -1))
            assertEquals(apk.length(), result!!.getLongExtra("size", -1))
            assertEquals(sha(apk), result!!.getStringExtra("sha256"))
        } finally { context.unregisterReceiver(receiver) }
    }

    @Test fun changedFileIsRejectedAgainstRustDigest() {
        val apk = candidate(); val expected = sha(apk); val size = apk.length()
        apk.appendBytes(byteArrayOf(0))
        blocked("SHA-256") { ApkUpdateInstaller(context).prepare(apk.path, expected, size, "0.0.26") }
    }

    @Test fun wrongSizeIsRejected() {
        val apk = candidate()
        blocked("SHA-256") { ApkUpdateInstaller(context).prepare(apk.path, sha(apk), apk.length() + 1, "0.0.26") }
    }

    @Test fun wrongVersionIsRejected() {
        val apk = candidate()
        blocked("Versão") { ApkUpdateInstaller(context).prepare(apk.path, sha(apk), apk.length(), "0.0.27") }
    }

    @Test fun traversalOutsideUpdateDirectoryIsRejected() {
        val apk = candidate()
        blocked("pasta segura") { ApkUpdateInstaller(context).prepare(File(context.cacheDir, "aurora-lives-updates/../outside.apk").path, sha(apk), apk.length(), "0.0.26") }
    }

    @Test fun invalidArchiveIsRejectedEvenWithMatchingHash() {
        val apk = candidate(); apk.writeText("not an APK")
        blocked("APK inválido") { ApkUpdateInstaller(context).prepare(apk.path, sha(apk), apk.length(), "0.0.26") }
    }

    @Test fun differentCertificateIsRejected() {
        val apk = candidate()
        context.assets.open("wrong-signer.apk").use { input -> apk.outputStream().use { input.copyTo(it) } }
        blocked("Assinatura") { ApkUpdateInstaller(context).prepare(apk.path, sha(apk), apk.length(), "0.0.26") }
    }
}

@RunWith(AndroidJUnit4::class)
class LegacyProviderTest {
    @Test fun duplicateProviderComponentBreaksUriRead() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val apk = File(context.cacheDir, "aurora-lives-updates/update.apk")
        apk.parentFile!!.mkdirs(); apk.writeText("provider-read-probe")
        val uri = FileProvider.getUriForFile(context, context.packageName + ".aurora.fileprovider", apk)
        try {
            context.contentResolver.openInputStream(uri)!!.use { it.readBytes() }
            fail("Legacy collision did not reproduce on this Android image")
        } catch (error: IllegalArgumentException) {
            android.util.Log.i("AuroraLegacyProof", "Reproduced: $error")
        } catch (error: java.io.FileNotFoundException) {
            android.util.Log.i("AuroraLegacyProof", "Reproduced: $error")
        }
    }
}
