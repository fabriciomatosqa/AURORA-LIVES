//! User-initiated HTTPS speed test against Cloudflare's public edge.
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{net::IpAddr, time::{Duration, Instant}};

const EDGE: &str = "https://speed.cloudflare.com";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedResult {
    download_mbps: f64,
    upload_mbps: f64,
    ping_ms: f64,
    jitter_ms: f64,
    public_ip: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NetworkMeta { client_ip: Option<String> }

fn throughput(bytes: usize, duration: Duration) -> Result<f64, String> {
    if bytes == 0 || duration.is_zero() { return Err("Amostra de velocidade inválida.".into()); }
    Ok(8.0 * bytes as f64 / duration.as_secs_f64() / 1_000_000.0)
}

fn median(samples: &[f64]) -> Result<f64, String> {
    if samples.is_empty() { return Err("Nenhuma amostra de ping.".into()); }
    let mut sorted = samples.to_vec();
    sorted.sort_by(f64::total_cmp);
    Ok(sorted[sorted.len()/2])
}

fn jitter(samples: &[f64]) -> f64 {
    if samples.len() < 2 { return 0.0; }
    samples.windows(2).map(|p| (p[1] - p[0]).abs()).sum::<f64>() / (samples.len()-1) as f64
}

fn is_public_ip(ip: &str) -> bool {
    match ip.parse::<IpAddr>() {
        Ok(IpAddr::V4(x)) => !x.is_private() && !x.is_loopback() && !x.is_link_local()
          && !x.is_multicast() && !x.is_unspecified() && !x.is_broadcast(),
        Ok(IpAddr::V6(x)) => !x.is_unique_local() && !x.is_loopback() && !x.is_unicast_link_local()
          && !x.is_multicast() && !x.is_unspecified(),
        Err(_) => false,
    }
}

async fn public_ip(client: &Client) -> Option<String> {
    let response = client.get(format!("{EDGE}/meta")).send().await.ok()?;
    let meta = response.json::<NetworkMeta>().await.ok()?;
    meta.client_ip.filter(|ip| is_public_ip(ip))
}

async fn download(client: &Client, bytes: usize) -> Result<f64, String> {
    let start = Instant::now();
    let response = client.get(format!("{EDGE}/__down?bytes={bytes}"))
        .header("Cache-Control", "no-store")
        .header("Accept-Encoding", "identity")
        .send().await.map_err(|e| format!("Download do teste falhou: {e}"))?;
    if !response.status().is_success() { return Err(format!("Download HTTP {}.", response.status())); }
    let mut stream = response.bytes_stream();
    let mut received = 0usize;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Transferência interrompida: {e}"))?;
        received = received.saturating_add(chunk.len());
        if received > bytes { return Err("Servidor retornou dados excedentes.".into()); }
    }
    if received != bytes { return Err("Download incompleto; nenhuma velocidade será estimada.".into()); }
    throughput(received, start.elapsed())
}

async fn upload(client: &Client, bytes: usize) -> Result<f64, String> {
    // Fixed synthetic zero bytes, never personal data; maximum 8 MB payload.
    let start = Instant::now();
    let response = client.post(format!("{EDGE}/__up"))
        .header("Content-Type", "application/octet-stream")
        .body(vec![0_u8; bytes])
        .send().await.map_err(|e| format!("Upload do teste falhou: {e}"))?;
    if !response.status().is_success() { return Err(format!("Upload HTTP {}.", response.status())); }
    response.bytes().await.map_err(|e| format!("Upload não confirmado: {e}"))?;
    throughput(bytes, start.elapsed())
}

#[tauri::command]
pub async fn measure_connection() -> Result<SpeedResult, String> {
    // No WebView CORS, 29 MB maximum traffic, 25 s per request.
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(25))
        .build().map_err(|e| format!("Falha ao inicializar teste: {e}"))?;
    let ip = public_ip(&client).await;
    let mut samples = Vec::with_capacity(6);
    for _ in 0..6 {
        let start = Instant::now();
        let response = client.get(format!("{EDGE}/__down?bytes=0"))
            .header("Cache-Control", "no-store")
            .send().await.map_err(|e| format!("Falha de ping: {e}"))?;
        if !response.status().is_success() { return Err(format!("Ping HTTP {}.", response.status())); }
        response.bytes().await.map_err(|e| format!("Falha na leitura do ping: {e}"))?;
        samples.push(start.elapsed().as_secs_f64() * 1_000.0);
    }
    let ping_ms = median(&samples)?;
    let jitter_ms = jitter(&samples);
    download(&client, 2_000_000).await?;
    let download_mbps = download(&client, 18_000_000).await?;
    upload(&client, 1_000_000).await?;
    let upload_mbps = upload(&client, 8_000_000).await?;
    Ok(SpeedResult { download_mbps, upload_mbps, ping_ms, jitter_ms, public_ip: ip })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn calculates_real_transfer_rate_and_jitter() {
        assert_eq!(throughput(1_000_000, Duration::from_secs(1)).unwrap(), 8.0);
        assert!(throughput(0, Duration::from_secs(1)).is_err());
        assert_eq!(median(&[5.0,10.0,3.0]).unwrap(), 5.0);
        assert_eq!(jitter(&[10.0,20.0,15.0]), 7.5);
    }
    #[test]
    fn only_public_ip_is_accepted() {
        for ip in ["127.0.0.1","192.168.1.1","10.0.0.1","::1","fc00::1","invalid"] {
            assert!(!is_public_ip(ip), "{ip}");
        }
        assert!(is_public_ip("1.1.1.1"));
        assert!(is_public_ip("2606:4700:4700::1111"));
    }
}
