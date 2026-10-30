#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod updater;

fn main() {
    tauri::Builder::default()
        .manage(updater::UpdateService::new().expect("failed to initialize AURORA updater"))
        .invoke_handler(tauri::generate_handler![
            updater::check_for_updates,
            updater::download_update,
            updater::cancel_update_download,
            updater::install_update
        ])
        .run(tauri::generate_context!())
        .expect("failed to start AURORA LIVES");
}
