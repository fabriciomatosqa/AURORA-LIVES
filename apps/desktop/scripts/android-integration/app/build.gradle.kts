plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.aurora.lives"
    compileSdk = 35
    buildToolsVersion = "36.0.0"
    defaultConfig {
        applicationId = "com.aurora.lives"
        minSdk = 26
        targetSdk = 35
        versionCode = providers.gradleProperty("fixtureCode").orElse("25").get().toInt()
        versionName = "0.0.$versionCode"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["updaterProvider"] = if (providers.gradleProperty("brokenProvider").orNull == "true")
            "androidx.core.content.FileProvider" else "com.aurora.lives.ApkFileProvider"
    }
    sourceSets.getByName("main").java.srcDir(layout.buildDirectory.dir("shared"))
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
val sharedUpdater by tasks.registering(Copy::class) {
    from("../..") { include("ApkFileProvider.kt", "ApkUpdateInstaller.kt") }
    into(layout.buildDirectory.dir("shared"))
}
tasks.named("preBuild").configure { dependsOn(sharedUpdater) }
dependencies {
    implementation("androidx.core:core:1.13.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
