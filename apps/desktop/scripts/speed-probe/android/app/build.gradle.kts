plugins { id("com.android.application") }
android {
    namespace = "com.aurora.speedprobe"
    compileSdk = 35
    buildToolsVersion = "36.0.0"
    defaultConfig {
        applicationId = "com.aurora.speedprobe"
        minSdk = 26
        targetSdk = 35
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
dependencies {
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
