#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Every user installs the same self-contained desktop client.
    // Direct WebRTC uses free public signaling; no local Go server is launched.
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to start AURORA LIVES");
}
