#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod updater;

fn main() {
    // Every participant installs the same self-contained WebRTC client.
    // The native updater only connects to the public, official GitHub Releases.
    tauri::Builder::default()
        .manage(updater::UpdateService::new().expect("failed to initialize AURORA updater"))
        .invoke_handler(tauri::generate_handler![
            updater::check_for_updates,
            updater::download_update,
            updater::install_update
        ])
        .run(tauri::generate_context!())
        .expect("failed to start AURORA LIVES");
}
