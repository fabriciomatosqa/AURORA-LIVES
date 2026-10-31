plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.aurora.probe"
    compileSdk = 35
    buildToolsVersion = "36.0.0"
    defaultConfig { applicationId = "com.aurora.probe"; minSdk = 26; targetSdk = 35 }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
