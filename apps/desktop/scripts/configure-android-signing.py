#!/usr/bin/env python3
"""Configure Gradle release signing using secrets, never files in source control."""
from pathlib import Path

gradle = Path("src-tauri/gen/android/app/build.gradle.kts")
if not gradle.is_file():
    raise SystemExit("Execute tauri android init antes de configurar a assinatura.")
content = gradle.read_text(encoding="utf-8")
anchor = "    buildTypes {"
if content.count(anchor) != 1:
    raise SystemExit("Seção buildTypes não encontrada de forma inequívoca.")
if "auroraRelease" in content:
    raise SystemExit("Assinatura já configurada.")
signing = """    signingConfigs {
        create("auroraRelease") {
            val keystoreProperties = java.util.Properties()
            val propertiesFile = rootProject.file("keystore.properties")
            require(propertiesFile.isFile) { "Missing keystore.properties" }
            propertiesFile.inputStream().use { keystoreProperties.load(it) }
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("password")
            storeFile = file(keystoreProperties.getProperty("storeFile"))
            storePassword = keystoreProperties.getProperty("password")
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("auroraRelease")
        }
    }
"""
gradle.write_text(content.replace(anchor, signing + "\n" + anchor, 1), encoding="utf-8")
print("Build Android release assinado com keystore de secrets.")
