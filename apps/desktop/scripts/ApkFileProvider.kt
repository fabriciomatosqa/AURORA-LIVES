package com.aurora.lives

// Must have a different ComponentName from Tauri's FileProvider. Authorities
// alone do not isolate two providers registered with the same class name.
class ApkFileProvider : androidx.core.content.FileProvider()
