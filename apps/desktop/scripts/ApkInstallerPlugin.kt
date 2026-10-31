package com.aurora.lives

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

@InvokeArg
class InstallApkArgs {
    lateinit var path: String
    lateinit var sha256: String
    lateinit var version: String
    var size: Long = 0
}

/** Tauri adapter; validation and URI preparation also run in Android integration tests. */
@TauriPlugin
class ApkInstallerPlugin(private val activity: Activity) : Plugin(activity) {
    private val busy = AtomicBoolean(false)

    @Command
    fun installApk(invoke: Invoke) {
        if (!busy.compareAndSet(false, true)) {
            invoke.reject("Uma instalação já está sendo preparada.")
            return
        }
        // Hashing and archive inspection must not block the WebView/UI thread.
        thread(name = "aurora-apk-verify") {
            try {
                val args = invoke.parseArgs(InstallApkArgs::class.java)
                val intent = ApkUpdateInstaller(activity).prepare(
                    args.path, args.sha256, args.size, args.version
                )
                activity.runOnUiThread {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                            !activity.packageManager.canRequestPackageInstalls()) {
                            activity.startActivity(Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + activity.packageName)
                            ))
                            invoke.reject("Autorize instalar aplicativos para o AURORA LIVES nas configurações do Android e tente novamente.")
                        } else {
                            activity.startActivity(intent)
                            invoke.resolve(JSObject())
                        }
                    } catch (error: Exception) {
                        Log.e("AuroraApkInstaller", "Falha ao abrir instalador", error)
                        invoke.reject(error.message ?: "Falha ao abrir o instalador Android.")
                    } finally {
                        busy.set(false)
                    }
                }
            } catch (error: Exception) {
                Log.e("AuroraApkInstaller", "Falha na validação do APK/URI", error)
                invoke.reject(error.message ?: "Falha ao preparar a instalação Android.")
                busy.set(false)
            }
        }
    }
}
