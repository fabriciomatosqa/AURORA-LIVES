//! Test harness imports the production engine; no Tauri/GTK required.
#[path = "../../../../src-tauri/src/speed_engine.rs"]
pub mod engine;

#[cfg(target_os = "android")]
mod android {
    use super::engine;
    use jni::{JNIEnv, objects::JClass, sys::jstring};
    use std::time::Duration;

    #[no_mangle]
    pub extern "system" fn Java_com_aurora_speedprobe_NativeProbe_legacy(mut env: JNIEnv, _: JClass) -> jstring {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let result = runtime.block_on(async {
            tokio::spawn(async {
                let client = reqwest13::Client::builder().timeout(Duration::from_secs(10)).build().unwrap();
                client.get("https://locate.measurementlab.net/v2/nearest/ndt/ndt7").send().await
                    .map(|r| r.status().as_u16()).map_err(|e| e.without_url().to_string())
            }).await
        });
        // A caught JoinError is evidence, not an Android process crash.
        let message = match result {
            Err(error) => format!("PANIC: {error}"),
            Ok(result) => format!("NO_PANIC: {result:?}"),
        };
        env.new_string(message).unwrap().into_raw()
    }

    #[no_mangle]
    pub extern "system" fn Java_com_aurora_speedprobe_NativeProbe_fixed(mut env: JNIEnv, _: JClass) -> jstring {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let result = runtime.block_on(engine::discover());
        let message = match result {
            Ok(targets) => format!("OK: {} secure M-Lab targets", targets.len()),
            Err(error) => format!("ERROR: {error}"),
        };
        env.new_string(message).unwrap().into_raw()
    }
}
