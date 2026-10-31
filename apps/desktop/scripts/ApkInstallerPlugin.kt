package com.aurora.lives

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class InstallApkArgs {
    lateinit var path: String
}

/**
 * APK files come from the Rust updater AFTER SHA-256 verification.
 * Reject paths outside the private updates cache: no arbitrary file execution.
 * Android's package manager verifies signing certificates and may prompt the user.
 */
@TauriPlugin
class ApkInstallerPlugin(private val activity: Activity) : Plugin(activity) {
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

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !activity.packageManager.canRequestPackageInstalls()) {
                val permission = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.packageName)
                )
                activity.startActivity(permission)
                invoke.reject("Autorize 'Instalar apps desconhecidos' para o AURORA LIVES no Android e pressione 'Instalar atualização' novamente.")
                return
            }

            val uri = FileProvider.getUriForFile(
                activity, activity.packageName + ".aurora.fileprovider", file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            invoke.resolve(JSObject())
        } catch (error: Exception) {
            invoke.reject("Falha ao abrir o instalador Android: " + (error.message ?: "erro desconhecido"))
        }
    }
}
