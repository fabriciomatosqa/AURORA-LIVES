//! Measurement Lab NDT7-only speed test.
//! Native phase events expose actual transfer readings to the UI while running.
use ndt7_client::{
    client::ClientBuilder,
    spec::{Measurement, Origin},
};
use serde::Serialize;
use std::{
    net::{IpAddr, SocketAddr},
    time::{Duration, Instant},
};
use tauri::Emitter;
use tokio::time::timeout;

const PROGRESS_EVENT: &str = "aurora:connection-progress";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedResult {
    download_mbps: f64,
    upload_mbps: f64,
    ping_ms: f64,
    jitter_ms: f64,
    public_ip: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SpeedProgress {
    phase: String,
    download_mbps: Option<f64>,
    upload_mbps: Option<f64>,
    ping_ms: Option<f64>,
    jitter_ms: Option<f64>,
    public_ip: Option<String>,
}

#[derive(Default)]
struct Samples {
    download: Option<f64>,
    upload: Option<f64>,
    upload_client: Option<f64>,
    rtt: Vec<f64>,
    public_ip: Option<String>,
}

fn mbps(bytes: i64, micros: i64) -> Option<f64> {
    if bytes <= 0 || micros <= 0 { return None; }
    let speed = (bytes as f64 * 8.0) / (micros as f64);
    (speed.is_finite() && speed > 0.0).then_some(speed)
}

fn public_ip(endpoint: &str) -> Option<String> {
    let addr = endpoint.parse::<SocketAddr>().ok()?.ip();
    match addr {
        IpAddr::V4(ip) if !ip.is_private() && !ip.is_loopback() &&
            !ip.is_link_local() && !ip.is_multicast() && !ip.is_unspecified() &&
            !ip.is_broadcast() && !(ip.octets()[0] == 100 && (64..=127).contains(&ip.octets()[1])) =>
            Some(ip.to_string()),
        IpAddr::V6(ip) if !ip.is_unique_local() && !ip.is_loopback() &&
            !ip.is_unicast_link_local() && !ip.is_multicast() && !ip.is_unspecified() =>
            Some(ip.to_string()),
        _ => None
    }
}

fn observe(measurement: &Measurement, download: bool, out: &mut Samples) {
    if measurement.origin == Some(Origin::Server) {
        if out.public_ip.is_none() {
            out.public_ip = measurement.connection_info.as_ref().and_then(|c| public_ip(&c.client));
        }
        if let Some(tcp) = &measurement.tcp_info {
            if let Some(rtt) = tcp.rtt.or(tcp.min_rtt) {
                if rtt > 0 && rtt < 10_000_000 && out.rtt.len() < 200 {
                    out.rtt.push(rtt as f64 / 1000.0);
                }
            }
            if !download {
                if let (Some(bytes), Some(time)) = (tcp.bytes_received, tcp.elapsed_time) {
                    if let Some(rate) = mbps(bytes, time) { out.upload = Some(rate); }
                }
            }
        }
    }
    if measurement.origin == Some(Origin::Client) {
        if let Some(app) = &measurement.app_info {
            if let Some(rate) = mbps(app.num_bytes, app.elapsed_time) {
                if download { out.download = Some(rate); }
                else { out.upload_client = Some(rate); }
            }
        }
    }
}

fn median_and_jitter(samples: &[f64]) -> Option<(f64, f64)> {
    if samples.len() < 2 { return None; }
    let mut sorted = samples.to_vec();
    sorted.sort_by(f64::total_cmp);
    let ping = sorted[sorted.len() / 2];
    let jitter = samples.windows(2).map(|pair| (pair[1] - pair[0]).abs()).sum::<f64>()
        / (samples.len() - 1) as f64;
    (ping.is_finite() && jitter.is_finite()).then_some((ping, jitter))
}

fn make_progress(phase: &str, samples: &Samples) -> SpeedProgress {
    let latency = median_and_jitter(&samples.rtt);
    SpeedProgress {
        phase: phase.to_owned(),
        download_mbps: samples.download,
        upload_mbps: samples.upload.or(samples.upload_client),
        ping_ms: latency.map(|v| v.0),
        jitter_ms: latency.map(|v| v.1),
        public_ip: samples.public_ip.clone(),
    }
}

fn emit_progress(app: &tauri::AppHandle, phase: &str, samples: &Samples) {
    // The event is ephemeral and contains no persisted IP or measurement history.
    let _ = app.emit(PROGRESS_EVENT, make_progress(phase, samples));
}

async fn execute(app: &tauri::AppHandle) -> Result<SpeedResult, String> {
    // Official NDT7 Locate selects the server and secure WSS endpoints.
    // No custom speed server, TLS bypass, or invented fallback readings.
    let mut client = ClientBuilder::new("aurora-lives", env!("CARGO_PKG_VERSION")).build();
    let mut readings = Samples::default();
    emit_progress(app, "locating", &readings);

    timeout(Duration::from_secs(45), async {
        let handle = client.start_download(None).await
            .map_err(|e| format!("Não foi possível conectar ao servidor M-Lab para download: {e}"))?;
        emit_progress(app, "download", &readings);
        let mut rx = handle.rx;
        let mut last_event = Instant::now();
        while let Some(received) = rx.recv().await {
            let measurement = received.map_err(|e| format!("M-Lab interrompeu o download: {e}"))?;
            observe(&measurement, true, &mut readings);
            if last_event.elapsed() >= Duration::from_millis(220) {
                emit_progress(app, "download", &readings);
                last_event = Instant::now();
            }
        }
        emit_progress(app, "download", &readings);
        Ok::<(), String>(())
    }).await.map_err(|_| "O download NDT7 ultrapassou 45 segundos. Verifique a conexão com o M-Lab e tente novamente.".to_string())??;

    if readings.download.is_none() {
        return Err("O M-Lab encerrou o download sem informar velocidade válida.".to_string());
    }

    emit_progress(app, "connecting-upload", &readings);
    timeout(Duration::from_secs(45), async {
        let handle = client.start_upload(None).await
            .map_err(|e| format!("Não foi possível conectar ao servidor M-Lab para upload: {e}"))?;
        emit_progress(app, "upload", &readings);
        let mut rx = handle.rx;
        let mut last_event = Instant::now();
        while let Some(received) = rx.recv().await {
            let measurement = received.map_err(|e| format!("M-Lab interrompeu o upload: {e}"))?;
            observe(&measurement, false, &mut readings);
            if last_event.elapsed() >= Duration::from_millis(220) {
                emit_progress(app, "upload", &readings);
                last_event = Instant::now();
            }
        }
        emit_progress(app, "upload", &readings);
        Ok::<(), String>(())
    }).await.map_err(|_| "O upload NDT7 ultrapassou 45 segundos. Verifique a conexão com o M-Lab e tente novamente.".to_string())??;

    let download_mbps = readings.download.ok_or("M-Lab não retornou bytes de download válidos.")?;
    let upload_mbps = readings.upload.or(readings.upload_client)
        .ok_or("M-Lab não retornou bytes de upload válidos.")?;
    let (ping_ms, jitter_ms) = median_and_jitter(&readings.rtt)
        .ok_or("M-Lab não retornou amostras suficientes de latência TCP.")?;
    emit_progress(app, "complete", &readings);
    Ok(SpeedResult { download_mbps, upload_mbps, ping_ms, jitter_ms, public_ip: readings.public_ip })
}

#[tauri::command]
pub async fn measure_connection(app: tauri::AppHandle) -> Result<SpeedResult, String> {
    // Overall deadline includes discovery, download and upload. No endless spinner.
    timeout(Duration::from_secs(95), execute(&app)).await
        .map_err(|_| "O teste M-Lab excedeu 95 segundos. Confira a internet ou tente novamente.".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use ndt7_client::spec::{AppInfo, ConnectionInfo, TCPInfo};

    #[test]
    fn real_byte_counters_in_microseconds() {
        assert_eq!(mbps(1_000_000, 1_000_000), Some(8.0));
        assert_eq!(mbps(0, 1_000_000), None);
        assert_eq!(mbps(1, 0), None);
    }
    #[test]
    fn extracts_public_address_from_mlab_server_not_lan() {
        assert_eq!(public_ip("198.51.100.10:3420"), Some("198.51.100.10".into()));
        assert_eq!(public_ip("[2606:4700:4700::1111]:4200"), Some("2606:4700:4700::1111".into()));
        for ip in ["192.168.1.4:123", "100.64.1.1:4444", "127.0.0.1:22", "[::1]:80", "localhost:8888"] {
            assert_eq!(public_ip(ip), None);
        }
    }
    #[test]
    fn reads_ndt7_server_tcp_rtt_and_byte_statistics() {
        let mut out = Samples::default();
        observe(&Measurement {
            origin: Some(Origin::Client),
            app_info: Some(AppInfo { num_bytes: 2_000_000, elapsed_time: 1_000_000 }),
            ..Default::default()
        }, true, &mut out);
        assert_eq!(out.download, Some(16.0));
        for rtt in [12_000, 14_000, 18_000] {
            observe(&Measurement {
                origin: Some(Origin::Server),
                tcp_info: Some(TCPInfo { rtt: Some(rtt), bytes_received: Some(6_000_000), elapsed_time: Some(2_000_000), ..Default::default() }),
                connection_info: Some(ConnectionInfo { client: "1.1.1.1:4444".into(), ..Default::default() }),
                ..Default::default()
            }, false, &mut out);
        }
        assert_eq!(out.upload, Some(24.0));
        assert_eq!(out.public_ip.as_deref(), Some("1.1.1.1"));
        assert_eq!(median_and_jitter(&out.rtt), Some((14.0, 3.0)));
    }
    #[test]
    fn progress_has_real_nullable_values_during_discovery() {
        let out = Samples::default();
        let p = make_progress("locating", &out);
        assert_eq!(p.phase, "locating");
        assert_eq!(p.download_mbps, None);
        assert_eq!(p.upload_mbps, None);
        assert_eq!(p.ping_ms, None);
    }
    #[tokio::test]
    #[ignore = "Live NDT7 publishes runner IP and test results in M-Lab open data"]
    async fn mlab_live_smoke() {
        // This live smoke uses its own connection with no Tauri AppHandle.
        // Kept ignored; the app's event transport is covered by native compilation.
        let mut client = ClientBuilder::new("aurora-lives-smoke", "0.0.29").build();
        let handle = client.start_download(None).await.expect("M-Lab download should connect");
        let mut rx = handle.rx;
        let mut samples = Samples::default();
        while let Some(m) = rx.recv().await { observe(&m.expect("valid download"), true, &mut samples); }
        let handle = client.start_upload(None).await.expect("M-Lab upload should connect");
        let mut rx = handle.rx;
        while let Some(m) = rx.recv().await { observe(&m.expect("valid upload"), false, &mut samples); }
        assert!(samples.download.unwrap_or_default() > 0.0);
        assert!(samples.upload.or(samples.upload_client).unwrap_or_default() > 0.0);
        assert!(median_and_jitter(&samples.rtt).is_some());
    }
}
