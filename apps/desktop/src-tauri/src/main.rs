#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

/// The Go API is a private local development sidecar, not a second application.
struct LocalApi(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // All users install the same AURORA LIVES package.
            // The local test API starts inside that package; nobody installs a separate server.
            let command = app.shell().sidecar("aurora-api")?;
            let (_events, child) = command.spawn()?;
            app.manage(LocalApi(Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to initialize AURORA LIVES")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                // Avoid leaving a listening development API after closing the UI.
                if let Ok(mut guard) = app_handle.state::<LocalApi>().0.lock() {
                    if let Some(child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
