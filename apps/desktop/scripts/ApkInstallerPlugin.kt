package com.aurora.lives

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File
import java.security.MessageDigest

@InvokeArg
class InstallApkArgs {
    lateinit var path: String
}

/**
 * Native Android updater aligned with the AURORA IPTV validation strategy.
 * The Rust backend already verifies the trusted release URL and SHA-256.
 * Here Android additionally verifies package identity, monotonic versionCode,
 * and exact signing-certificate equality before invoking the OS installer.
 */
@TauriPlugin
class ApkInstallerPlugin(private val activity: Activity) : Plugin(activity) {
    private fun versionCode(info: PackageInfo): Long =
        if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }

    private fun signerDigests(info: PackageInfo): Set<String> {
        @Suppress("DEPRECATION")
        val signatures = if (Build.VERSION.SDK_INT >= 28) {
            info.signingInfo?.apkContentsSigners
        } else info.signatures
        return signatures.orEmpty().map { sig ->
            MessageDigest.getInstance("SHA-256").digest(sig.toByteArray())
                .joinToString("") { byte -> "%02x".format(byte.toInt() and 255) }
        }.toSet()
    }

    private fun validateApk(file: File) {
        val manager = activity.packageManager
        @Suppress("DEPRECATION")
        val flags = if (Build.VERSION.SDK_INT >= 28)
            PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        @Suppress("DEPRECATION")
        val archive = manager.getPackageArchiveInfo(file.absolutePath, flags)
            ?: throw IllegalArgumentException("APK inválido ou incompatível.")
        @Suppress("DEPRECATION")
        val installed = manager.getPackageInfo(activity.packageName, flags)
        if (archive.packageName != activity.packageName) {
            throw IllegalArgumentException("O pacote baixado não é do AURORA LIVES.")
        }
        if (versionCode(archive) <= versionCode(installed)) {
            throw IllegalArgumentException("O APK não é mais recente que a versão instalada.")
        }
        if (Build.VERSION.SDK_INT >= 24 && (archive.applicationInfo?.minSdkVersion ?: Int.MAX_VALUE) > Build.VERSION.SDK_INT) {
            throw IllegalArgumentException("Esta versão não é compatível com seu Android.")
        }
        val existing = signerDigests(installed)
        val incoming = signerDigests(archive)
        if (existing.isEmpty() || incoming != existing) {
            throw IllegalArgumentException(
                "Assinatura diferente da versão instalada. Faça backup antes da migração para o APK de assinatura permanente."
            )
        }
    }

    @Command
    fun installApk(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(InstallApkArgs::class.java)
            val folder = File(activity.cacheDir, "aurora-lives-updates").canonicalFile
            val file = File(args.path).canonicalFile
            if (!file.path.startsWith(folder.path + File.separator) ||
                !file.name.endsWith(".apk") || !file.isFile || file.length() == 0L) {
                invoke.reject("APK fora da pasta segura de atualizações.")
                return
            }

            validateApk(file)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !activity.packageManager.canRequestPackageInstalls()) {
                activity.startActivity(Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.packageName)
                ))
                invoke.reject("Autorize instalar aplicativos para o AURORA LIVES nas configurações do Android e tente novamente.")
                return
            }

            val uri = FileProvider.getUriForFile(
                activity, activity.packageName + ".aurora.fileprovider", file
            )
            // Prefer the Android system APK installer, not a generic VIEW handler.
            val intent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                clipData = ClipData.newRawUri("AURORA LIVES", uri)
            }
            // Give the resolved installer access to this private cached APK.
            intent.resolveActivity(activity.packageManager)?.packageName?.let { packageName ->
                activity.grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            try {
                activity.startActivity(intent)
            } catch (_: android.content.ActivityNotFoundException) {
                // Some customized Android versions only provide ACTION_VIEW.
                val fallback = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    clipData = ClipData.newRawUri("AURORA LIVES", uri)
                }
                activity.startActivity(fallback)
            }
            // Rust deserializes the native JSON object, not a unit/null response.
            invoke.resolve(JSObject())
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Falha ao abrir o instalador Android.")
        }
    }
}
