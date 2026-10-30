// The same Rust/Tauri application is compiled for desktop and Android.
// Desktop installer updates are never exposed as Android commands: an APK
// must be installed and signed by Android's package manager instead.
#[cfg(desktop)]
mod updater;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // Android WebView has its own media permission layer in addition to the
    // RECORD_AUDIO runtime permission in AndroidManifest. Allow only the
    // microphone request; Android still asks the user for OS authorization.
    // Camera/location and every other permission keep their default behavior.
    #[cfg(target_os = "android")]
    let builder = builder.on_permission_request(|_, kind| match kind {
        tauri::webview::PermissionKind::Microphone => tauri::webview::PermissionResponse::Allow,
        _ => tauri::webview::PermissionResponse::Default,
    });

    #[cfg(desktop)]
    let builder = builder
        .manage(updater::UpdateService::new().expect("failed to initialize AURORA updater"))
        .invoke_handler(tauri::generate_handler![
            updater::check_for_updates,
            updater::download_update,
            updater::cancel_update_download,
            updater::install_update
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("failed to start AURORA LIVES");
}
