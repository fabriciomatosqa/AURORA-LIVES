package com.aurora.lives

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import java.util.zip.ZipFile

/** Shared by the production APK and the on-device integration harness. */
class ApkUpdateInstaller(private val context: Context) {
    private fun versionCode(info: PackageInfo): Long =
        if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }

    private fun signerDigests(info: PackageInfo): Set<String> {
        @Suppress("DEPRECATION")
        val signatures = if (Build.VERSION.SDK_INT >= 28) {
            info.signingInfo?.apkContentsSigners ?: info.signatures
        } else info.signatures
        return signatures.orEmpty().map { sig ->
            MessageDigest.getInstance("SHA-256").digest(sig.toByteArray()).hex()
        }.toSet()
    }

    private fun ByteArray.hex() = joinToString("") { "%02x".format(it.toInt() and 255) }

    private fun digest(input: InputStream): Pair<Long, String> {
        val hash = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(65536)
        var size = 0L
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            hash.update(buffer, 0, count)
            size += count
        }
        return size to hash.digest().hex()
    }

    private fun validateApk(file: File, expectedVersion: String) {
        val manager = context.packageManager
        @Suppress("DEPRECATION")
        // Android 9/10's archive parser collects certificates only when the
        // legacy flag is also present. IPTV uses the same combined flags.
        val flags = PackageManager.GET_SIGNATURES or if (Build.VERSION.SDK_INT >= 28)
            PackageManager.GET_SIGNING_CERTIFICATES else 0
        @Suppress("DEPRECATION")
        val archive = manager.getPackageArchiveInfo(file.absolutePath, flags)
            ?: throw IllegalArgumentException("APK inválido ou incompatível.")
        @Suppress("DEPRECATION")
        val installed = manager.getPackageInfo(context.packageName, flags)
        require(archive.packageName == context.packageName) { "O pacote baixado não é do AURORA LIVES." }
        val parts = expectedVersion.split('.').map { it.toLong() }
        require(parts.size == 3) { "Versão de atualização inválida." }
        val expectedCode = parts[0] * 1_000_000 + parts[1] * 1000 + parts[2]
        require(archive.versionName == expectedVersion && versionCode(archive) == expectedCode &&
            versionCode(archive) > versionCode(installed)) { "Versão do APK diferente da atualização esperada ou não é mais recente." }
        require((archive.applicationInfo?.minSdkVersion ?: Int.MAX_VALUE) <= Build.VERSION.SDK_INT) {
            "Esta versão não é compatível com seu Android."
        }
        val existing = signerDigests(installed)
        val incoming = signerDigests(archive)
        Log.i("AuroraApkInstaller", "Certificados: installed=$existing incoming=$incoming")
        require(existing.isNotEmpty() && incoming == existing) {
            "Assinatura do APK diferente da versão instalada. A atualização foi bloqueada."
        }
        ZipFile(file).use { zip ->
            require(zip.getEntry("AndroidManifest.xml") != null) { "O APK não contém manifesto Android." }
            val abis = zip.entries().asSequence().map { it.name }
                .filter { it.startsWith("lib/") && it.endsWith(".so") }
                .map { it.split('/')[1] }.toSet()
            require(abis.isEmpty() || Build.SUPPORTED_ABIS.any { it in abis }) {
                "O APK não é compatível com a arquitetura deste aparelho."
            }
        }
        Log.i("AuroraApkInstaller", "Pacote validado: installed=${versionCode(installed)} incoming=${versionCode(archive)} signer=$incoming")
    }

    fun prepare(path: String, sha256: String, size: Long, version: String): Intent {
        require(sha256.matches(Regex("[a-f0-9]{64}")) && size in 1..(250L * 1024 * 1024)) {
            "Metadados de integridade do APK inválidos."
        }
        val folder = File(context.cacheDir, "aurora-lives-updates").canonicalFile
        val file = File(path).canonicalFile
        require(file.path.startsWith(folder.path + File.separator) &&
            file.name.endsWith(".apk") && file.isFile) { "APK fora da pasta segura de atualizações." }
        val expected = size to sha256
        require(file.inputStream().use { digest(it) } == expected) {
            "O APK não corresponde ao tamanho/SHA-256 verificado pelo download."
        }
        validateApk(file, version)
        val authority = context.packageName + ".aurora.fileprovider"
        val provider = context.packageManager.resolveContentProvider(authority, 0)
            ?: throw IllegalStateException("FileProvider de atualização não registrado.")
        require(provider.name == ApkFileProvider::class.java.name && !provider.exported && provider.grantUriPermissions) {
            "Configuração do FileProvider de atualização inválida."
        }
        val uri = FileProvider.getUriForFile(context, authority, file)
        // Read through the same component/URI the installer will use. A valid
        // filesystem APK alone does not establish that its content URI works.
        val shared = context.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("Não foi possível abrir a URI do APK.")
        require(shared.use { digest(it) } == expected) {
            "O APK compartilhado pelo FileProvider difere do arquivo validado."
        }
        Log.i("AuroraApkInstaller", "URI validada: authority=$authority bytes=$size sha256=$sha256")
        return Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = ClipData.newRawUri("AURORA LIVES", uri)
        }
    }
}
