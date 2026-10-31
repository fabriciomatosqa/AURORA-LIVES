//! Tauri transport for the bounded, platform-independent M-Lab engine.
#[path = "speed_engine.rs"]
mod engine;
use tauri::Emitter;
pub use engine::SpeedResult;

#[tauri::command]
pub async fn measure_connection(app: tauri::AppHandle) -> Result<SpeedResult, String> {
    engine::measure(move |progress| {
        let _ = app.emit("aurora:connection-progress", progress);
    }).await
}
