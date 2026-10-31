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
use futures_util::StreamExt;
use ndt7_client::{client::{AddressFamily, TestHandle}, locate::{LocateResponse, Target}};
use tokio::time::timeout;

const LOCATE_URL: &str = "https://locate.measurementlab.net/v2/nearest/ndt/ndt7";
const TOTAL_DEADLINE: Duration = Duration::from_secs(95);

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
pub struct SpeedProgress {
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

// Reuse the bundled-root TLS configuration already used by the updater.
// ndt7-client 0.3's implicit Locate uses reqwest 0.13/platform-verifier,
// which requires separate Android JVM initialization. Never enter that path.
pub async fn discover() -> Result<Vec<Target>, String> {
    let client = reqwest::Client::builder()
        .user_agent(concat!("aurora-lives/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(10))
        .build().map_err(|_| "Não foi possível preparar a conexão segura com o M-Lab.")?;
    let response = client.get(LOCATE_URL).send().await
        .map_err(|e| format!("Não foi possível localizar servidores M-Lab: {}", e.without_url()))?
        .error_for_status().map_err(|e| format!("O serviço de localização M-Lab retornou erro: {}", e.without_url()))?;
    if response.status() == reqwest::StatusCode::NO_CONTENT {
        return Err("O M-Lab está sem servidores disponíveis agora. Tente novamente em instantes.".into());
    }
    let mut bytes = Vec::new();
    let mut chunks = response.bytes_stream();
    while let Some(chunk) = chunks.next().await {
        let chunk = chunk.map_err(|_| "Falha ao ler os servidores M-Lab.")?;
        if bytes.len() + chunk.len() > 128 * 1024 {
            return Err("A resposta de servidores M-Lab excedeu o limite permitido.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    decode_targets(&bytes)
}

fn official_service(url: &str) -> bool {
    reqwest::Url::parse(url).ok().is_some_and(|u| u.scheme() == "wss" &&
        u.username().is_empty() && u.password().is_none() &&
        u.host_str().is_some_and(|h| h.ends_with(".measurement-lab.org")) &&
        matches!(u.path(), "/ndt/v7/download" | "/ndt/v7/upload"))
}

fn decode_targets(bytes: &[u8]) -> Result<Vec<Target>, String> {
    let response: LocateResponse = serde_json::from_slice(bytes)
        .map_err(|_| "Resposta inválida do serviço de localização M-Lab.")?;
    let targets: Vec<_> = response.results.into_iter().filter(|t| {
        let urls = t.service_urls("wss");
        urls.download.as_deref().is_some_and(official_service) &&
            urls.upload.as_deref().is_some_and(official_service)
    }).take(3).collect();
    if targets.is_empty() { return Err("O M-Lab não informou servidores seguros disponíveis.".into()); }
    Ok(targets)
}

async fn connect(targets: &[Target], download: bool) -> Result<TestHandle, String> {
    for target in targets {
        let urls = target.service_urls("wss");
        let url = if download { urls.download } else { urls.upload };
        let Some(url) = url else { continue };
        // The upstream client tries only the first DNS address. Retry with IPv4
        // when an advertised IPv6 route is unavailable (common on mobile/VPNs).
        for family in [AddressFamily::Any, AddressFamily::Ipv4Only] {
            let mut client = ClientBuilder::new("aurora-lives", env!("CARGO_PKG_VERSION"))
                .address_family(family).build();
            let attempt = async {
                if download { client.start_download(Some(&url)).await }
                else { client.start_upload(Some(&url)).await }
            };
            if let Ok(Ok(handle)) = timeout(Duration::from_secs(4), attempt).await {
                return Ok(handle);
            }
        }
    }
    Err("Não foi possível conectar aos servidores M-Lab. Verifique sua rede e tente novamente.".into())
}

async fn execute(mut progress: impl FnMut(SpeedProgress) + Send) -> Result<SpeedResult, String> {
    let mut readings = Samples::default();
    progress(make_progress("locating", &readings));
    let targets = discover().await?;
    progress(make_progress("connecting-download", &readings));
    let handle = connect(&targets, true).await?;
    progress(make_progress("download", &readings));
    timeout(Duration::from_secs(20), async {
        let mut rx = handle.rx;
        let mut last_event = Instant::now();
        while let Some(received) = rx.recv().await {
            let measurement = received.map_err(|e| format!("M-Lab interrompeu o download: {e}"))?;
            observe(&measurement, true, &mut readings);
            if last_event.elapsed() >= Duration::from_millis(220) {
                progress(make_progress("download", &readings));
                last_event = Instant::now();
            }
        }
        progress(make_progress("download", &readings));
        Ok::<(), String>(())
    }).await.map_err(|_| "O download M-Lab ultrapassou o tempo permitido.".to_string())??;
    if readings.download.is_none() {
        return Err("O M-Lab encerrou o download sem informar velocidade válida.".into());
    }
    progress(make_progress("connecting-upload", &readings));
    let handle = connect(&targets, false).await?;
    progress(make_progress("upload", &readings));
    timeout(Duration::from_secs(15), async {
        let mut rx = handle.rx;
        let mut last_event = Instant::now();
        while let Some(received) = rx.recv().await {
            let measurement = received.map_err(|e| format!("M-Lab interrompeu o upload: {e}"))?;
            observe(&measurement, false, &mut readings);
            if last_event.elapsed() >= Duration::from_millis(220) {
                progress(make_progress("upload", &readings));
                last_event = Instant::now();
            }
        }
        progress(make_progress("upload", &readings));
        Ok::<(), String>(())
    }).await.map_err(|_| "O upload M-Lab ultrapassou o tempo permitido.".to_string())??;
    let download_mbps = readings.download.ok_or("M-Lab não retornou bytes de download válidos.")?;
    let upload_mbps = readings.upload.or(readings.upload_client)
        .ok_or("M-Lab não retornou bytes de upload válidos.")?;
    let (ping_ms, jitter_ms) = median_and_jitter(&readings.rtt)
        .ok_or("M-Lab não retornou amostras suficientes de latência TCP.")?;
    progress(make_progress("complete", &readings));
    Ok(SpeedResult { download_mbps, upload_mbps, ping_ms, jitter_ms, public_ip: readings.public_ip })
}

async fn guarded<T, F>(future: F, limit: Duration) -> Result<T, String>
where T: Send + 'static, F: std::future::Future<Output = Result<T, String>> + Send + 'static {
    let task = tokio::spawn(future);
    let abort = task.abort_handle();
    match timeout(limit, task).await {
        Ok(Ok(result)) => result,
        Ok(Err(error)) => {
            eprintln!("AURORA connection task failed: {error}");
            Err("O teste de conexão foi interrompido por uma falha interna. Tente novamente.".into())
        }
        Err(_) => {
            abort.abort();
            Err("O teste M-Lab excedeu 95 segundos. Confira a internet e tente novamente.".into())
        }
    }
}

pub async fn measure(progress: impl FnMut(SpeedProgress) + Send + 'static) -> Result<SpeedResult, String> {
    guarded(execute(progress), TOTAL_DEADLINE).await
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
    #[test]
    fn rejects_unsafe_or_non_mlab_discovery_urls() {
        assert!(official_service("wss://ndt-mlab1.example.measurement-lab.org/ndt/v7/download?access_token=test"));
        for url in ["ws://mlab.measurement-lab.org/ndt/v7/download", "wss://evil.test/ndt/v7/download", "wss://mlab.measurement-lab.org.evil.test/ndt/v7/upload"] {
            assert!(!official_service(url));
        }
        assert!(decode_targets(br#"{"results":[]}"#).is_err());
        assert!(decode_targets(b"not JSON").is_err());
    }
    #[tokio::test]
    async fn panic_reaches_caller_instead_of_leaving_ipc_pending() {
        let result = guarded::<(), _>(async { panic!("native verifier not initialized") }, Duration::from_secs(1)).await;
        assert!(result.unwrap_err().contains("falha interna"));
    }
    #[tokio::test]
    async fn hung_worker_has_a_finite_deadline() {
        let result = guarded::<(), _>(std::future::pending(), Duration::from_millis(10)).await;
        assert!(result.unwrap_err().contains("excedeu"));
    }
    #[tokio::test]
    #[ignore = "Live NDT7 publishes runner IP and test results in M-Lab open data"]
    async fn mlab_live_smoke() {
        let phases = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let collected = phases.clone();
        let result = measure(move |p| collected.lock().unwrap().push(p)).await.expect("real M-Lab test");
        assert!(result.download_mbps > 0.0 && result.upload_mbps > 0.0);
        assert!(result.ping_ms > 0.0 && result.jitter_ms >= 0.0);
        let phases = phases.lock().unwrap();
        assert!(phases.iter().any(|p| p.phase == "download" && p.download_mbps.is_some()));
        assert!(phases.iter().any(|p| p.phase == "upload" && p.upload_mbps.is_some()));
        assert_eq!(phases.last().unwrap().phase, "complete");
        println!("Real M-Lab: download={:.2} Mbps upload={:.2} Mbps ping={:.2} ms jitter={:.2} ms", result.download_mbps, result.upload_mbps, result.ping_ms, result.jitter_ms);
    }
}
