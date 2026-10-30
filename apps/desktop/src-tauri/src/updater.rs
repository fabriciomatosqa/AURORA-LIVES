//! Native GitHub Releases updater for the preview distribution.
//!
//! No authentication, GitHub tokens, arbitrary URLs or servers are needed.
//! Only exact assets from fabriciomatosqa/AURORA-LIVES are accepted, and the
//! downloaded installer must match SHA256SUMS.txt from the same published release.
//! This is an integrity check, NOT a substitute for a code-signing certificate.
//! Installation is always explicitly requested by the user.
use futures_util::StreamExt;
use reqwest::{redirect::Policy, Client};
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::Read,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

const REPOSITORY: &str = "fabriciomatosqa/AURORA-LIVES";
const RELEASE_API: &str =
    "https://api.github.com/repos/fabriciomatosqa/AURORA-LIVES/releases?per_page=30";
const CHECKSUM_FILE: &str = "SHA256SUMS.txt";
const MAX_DOWNLOAD: u64 = 250 * 1024 * 1024;
const MAX_CHECKSUM_FILE: usize = 64 * 1024;

#[derive(Debug, Deserialize, Clone)]
struct Release {
    tag_name: String,
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    body: Option<String>,
    published_at: Option<String>,
    assets: Vec<ReleaseAsset>,
}
#[derive(Debug, Deserialize, Clone)]
struct ReleaseAsset {
    name: String,
    browser_download_url: String,
    size: u64,
    #[serde(default)]
    digest: Option<String>,
}
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
    tag: String,
    version: String,
    notes: String,
    published_at: Option<String>,
    size_bytes: u64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    current_version: String,
    latest: Option<AvailableUpdate>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    version: String,
    file_name: String,
    size_bytes: u64,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    downloaded_bytes: u64,
    total_bytes: u64,
    percent: u8,
}
#[derive(Clone)]
struct VerifiedInstaller {
    tag: String,
    version: String,
    path: PathBuf,
    sha256: String,
    size: u64,
}

pub struct UpdateService {
    client: Client,
    downloaded: Mutex<Option<VerifiedInstaller>>,
    busy: AtomicBool,
    cancel_requested: AtomicBool,
}
impl UpdateService {
    pub fn new() -> Result<Self, String> {
        let client = Client::builder()
            .user_agent("AURORA-LIVES-Desktop-Updater")
            .redirect(Policy::custom(|attempt| {
                let address = attempt.url();
                let allowed_host = matches!(address.host_str(),
                    Some("github.com" | "api.github.com" |
                         "release-assets.githubusercontent.com" | "objects.githubusercontent.com"));
                if attempt.previous().len() >= 8 || address.scheme() != "https" || !allowed_host {
                    attempt.stop()
                } else {
                    attempt.follow()
                }
            }))
            .timeout(Duration::from_secs(180))
            .build()
            .map_err(|e| format!("Falha ao preparar conexão: {e}"))?;
        Ok(Self {
            client,
            downloaded: Mutex::new(None),
            busy: AtomicBool::new(false),
            cancel_requested: AtomicBool::new(false),
        })
    }
}

#[cfg(target_os = "windows")]
fn installer_name() -> &'static str {
    "AURORA-LIVES-Windows-x64-Setup.exe"
}
#[cfg(target_os = "linux")]
fn installer_name() -> &'static str {
    "AURORA-LIVES-Linux-amd64.deb"
}
#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn installer_name() -> &'static str {
    "unsupported"
}

/// Our -preview suffix identifies a GitHub pre-release channel, not a
/// semantic version prerelease: installed binaries use x.y.z.
fn parse_tag(tag: &str) -> Option<Version> {
    let raw = tag.strip_prefix('v').unwrap_or(tag);
    let raw = raw.strip_suffix("-preview").unwrap_or(raw);
    Version::parse(raw).ok()
}

fn official_url(tag: &str, asset: &ReleaseAsset) -> bool {
    // Exact URL matching means neither the JavaScript view nor arbitrary
    // GitHub release body text can redirect the executable download.
    !tag.is_empty()
        && !tag.contains('/')
        && asset.browser_download_url
            == format!(
                "https://github.com/{REPOSITORY}/releases/download/{tag}/{}",
                asset.name
            )
}

fn asset_for<'a>(release: &'a Release, file_name: &str) -> Option<&'a ReleaseAsset> {
    release
        .assets
        .iter()
        .find(|a| a.name == file_name && a.size > 0 && a.size <= MAX_DOWNLOAD && official_url(&release.tag_name, a))
}

fn suitable(release: &Release, current: &Version, include_prereleases: bool) -> bool {
    !release.draft && (include_prereleases || !release.prerelease)
        && parse_tag(&release.tag_name).is_some_and(|v| v > *current)
        && asset_for(release, installer_name()).is_some()
        && asset_for(release, CHECKSUM_FILE).is_some()
}

fn newest<'a>(releases: &'a [Release], current: &Version, include_prereleases: bool) -> Option<&'a Release> {
    releases
        .iter()
        .filter(|r| suitable(r, current, include_prereleases))
        .max_by_key(|r| parse_tag(&r.tag_name))
}

async fn published_releases(client: &Client) -> Result<Vec<Release>, String> {
    client
        .get(RELEASE_API)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Não foi possível acessar o GitHub: {e}"))?
        .error_for_status()
        .map_err(|e| format!("GitHub não respondeu à consulta de versões: {e}"))?
        .json::<Vec<Release>>()
        .await
        .map_err(|e| format!("Resposta inesperada do GitHub: {e}"))
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle, include_prereleases: bool) -> Result<CheckResult, String> {
    let current = app.package_info().version.clone();
    let service = app.state::<UpdateService>();
    let client = service.client.clone();
    let releases = published_releases(&client).await?;
    let latest = newest(&releases, &current, include_prereleases).map(|release| AvailableUpdate {
        tag: release.tag_name.clone(),
        version: parse_tag(&release.tag_name).expect("already filtered").to_string(),
        // Rendered as plain text in React; never inserted as HTML.
        notes: release.body.as_deref().unwrap_or("").chars().take(700).collect(),
        published_at: release.published_at.clone(),
        size_bytes: asset_for(release, installer_name()).expect("already filtered").size,
    });
    Ok(CheckResult {
        current_version: current.to_string(),
        latest,
    })
}

fn expected_checksum(manifest: &str, filename: &str) -> Result<String, String> {
    for line in manifest.lines() {
        let mut fields = line.split_whitespace();
        let hash = fields.next().unwrap_or("");
        let raw_name = fields.next().unwrap_or("");
        let name = raw_name.trim_start_matches('*');
        if name == filename && hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Ok(hash.to_ascii_lowercase());
        }
    }
    Err("A versão não possui uma soma SHA-256 válida para este sistema.".to_string())
}

fn hash_file(path: &Path) -> Result<String, String> {
    let mut f = File::open(path).map_err(|e| format!("Não foi possível ler o instalador: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = f.read(&mut buffer).map_err(|e| format!("Falha ao verificar o instalador: {e}"))?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

struct BusyReset<'a>(&'a AtomicBool);
impl Drop for BusyReset<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub async fn download_update(app: AppHandle, tag: String, include_prereleases: bool) -> Result<DownloadResult, String> {
    let state = app.state::<UpdateService>();
    if state.busy.swap(true, Ordering::SeqCst) {
        return Err("Já existe um download de atualização em andamento.".into());
    }
    let _busy = BusyReset(&state.busy);
    state.cancel_requested.store(false, Ordering::SeqCst);
    let client = state.client.clone();
    let current = app.package_info().version.clone();

    // Never accept an arbitrary URL, file name or path from the front end.
    let releases = published_releases(&client).await?;
    let release = newest(&releases, &current, include_prereleases)
        .filter(|release| release.tag_name == tag)
        .ok_or("Esta versão não está mais disponível como atualização. Verifique novamente.")?;
    let asset = asset_for(release, installer_name())
        .ok_or("Instalador indisponível para este sistema.")?;
    let checksums = asset_for(release, CHECKSUM_FILE)
        .ok_or("A versão não possui arquivo de verificação SHA-256.")?;

    let manifest_bytes = client
        .get(&checksums.browser_download_url)
        .send()
        .await
        .map_err(|e| format!("Falha ao baixar arquivo de verificação: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Arquivo de verificação indisponível: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Erro ao ler a soma de verificação: {e}"))?;
    if manifest_bytes.len() > MAX_CHECKSUM_FILE {
        return Err("O arquivo de verificação excede o tamanho permitido.".into());
    }
    let manifest = String::from_utf8(manifest_bytes.to_vec())
        .map_err(|_| "Arquivo SHA-256 inválido.".to_string())?;
    let sha256 = expected_checksum(&manifest, &asset.name)?;
    // GitHub supplies an independent metadata digest on modern releases.
    if let Some(github_digest) = &asset.digest {
        let expected = format!("sha256:{sha256}");
        if !github_digest.eq_ignore_ascii_case(&expected) {
            return Err("O SHA-256 da API do GitHub não corresponde ao manifesto do release.".into());
        }
    }
    let version = parse_tag(&release.tag_name)
        .ok_or("Versão do GitHub inválida.")?
        .to_string();

    let dir = std::env::temp_dir().join("aurora-lives-updates");
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Não foi possível criar diretório de atualização: {e}"))?;
    let path = dir.join(format!("{}-{}", &sha256[..16], asset.name));
    let result = DownloadResult {
        version: version.clone(), file_name: asset.name.clone(), size_bytes: asset.size
    };

    if path.is_file() && hash_file(&path)? == sha256 {
        let mut saved = state.downloaded.lock().map_err(|_| "Estado do atualizador indisponível.")?;
        *saved = Some(VerifiedInstaller { tag, version, path, sha256, size: asset.size });
        let _ = app.emit("aurora:update-progress", ProgressEvent {
            downloaded_bytes: asset.size, total_bytes: asset.size, percent: 100
        });
        return Ok(result);
    }
    let _ = tokio::fs::remove_file(&path).await;

    // Partially downloaded files are never executable or offered for installation.
    let partial = dir.join(format!("{}-{}.part", &sha256[..16], asset.name));
    let _ = tokio::fs::remove_file(&partial).await;
    let transfer: Result<(), String> = async {
        if state.cancel_requested.load(Ordering::SeqCst) {
            return Err("Download cancelado.".into());
        }
        let response = client
            .get(&asset.browser_download_url)
            .send()
            .await
            .map_err(|e| format!("Falha de rede ao baixar atualização: {e}"))?
            .error_for_status()
            .map_err(|e| format!("O instalador não está disponível no GitHub: {e}"))?;

        let mut stream = response.bytes_stream();
        let mut file = tokio::fs::File::create(&partial)
            .await
            .map_err(|e| format!("Não foi possível salvar o instalador: {e}"))?;
        let mut hasher = Sha256::new();
        let mut received = 0u64;
        let mut last_percent: i16 = -1;
        while let Some(chunk) = stream.next().await {
            if state.cancel_requested.load(Ordering::SeqCst) {
                return Err("Download cancelado.".into());
            }
            let chunk = chunk.map_err(|e| format!("Download interrompido: {e}"))?;
            received += chunk.len() as u64;
            if received > asset.size || received > MAX_DOWNLOAD {
                return Err("O download excedeu o tamanho do instalador publicado.".into());
            }
            hasher.update(&chunk);
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Não foi possível gravar o instalador: {e}"))?;
            let pct = (received.saturating_mul(100) / asset.size).min(100) as i16;
            if pct != last_percent {
                last_percent = pct;
                let _ = app.emit("aurora:update-progress", ProgressEvent {
                    downloaded_bytes: received, total_bytes: asset.size, percent: pct as u8
                });
            }
        }
        if state.cancel_requested.load(Ordering::SeqCst) {
            return Err("Download cancelado.".into());
        }
        file.flush().await.map_err(|e| format!("Falha ao finalizar o arquivo: {e}"))?;
        file.sync_all().await.map_err(|e| format!("Falha ao salvar instalador: {e}"))?;
        drop(file);
        if received != asset.size {
            return Err("O instalador foi baixado incompleto.".into());
        }
        let actual = format!("{:x}", hasher.finalize());
        if actual != sha256 {
            return Err("Verificação SHA-256 falhou. O arquivo não será executado.".into());
        }
        tokio::fs::rename(&partial, &path)
            .await
            .map_err(|e| format!("Não foi possível finalizar o instalador: {e}"))?;
        Ok(())
    }.await;

    if let Err(err) = transfer {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(err);
    }

    let mut saved = state.downloaded.lock().map_err(|_| "Estado do atualizador indisponível.")?;
    *saved = Some(VerifiedInstaller { tag, version, path, sha256, size: asset.size });
    Ok(result)
}

/// Open only a previously downloaded and SHA-256-verified official installer.
/// Windows installer runs as a separate process, then the app exits. On Linux
/// xdg-open invokes the configured package manager which may ask for privileges.
#[tauri::command]
pub fn cancel_update_download(app: AppHandle) -> Result<(), String> {
    let state = app.state::<UpdateService>();
    if state.busy.load(Ordering::SeqCst) {
        state.cancel_requested.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub fn install_update(app: AppHandle) -> Result<(), String> {
    let state = app.state::<UpdateService>();
    if state.busy.load(Ordering::SeqCst) {
        return Err("Aguarde o download terminar.".into());
    }
    let stored = state.downloaded.lock()
        .map_err(|_| "Estado do atualizador indisponível.")?
        .clone().ok_or("Baixe e verifique uma atualização antes de instalar.")?;
    if parse_tag(&stored.tag).as_ref() != Some(&Version::parse(&stored.version).map_err(|e| e.to_string())?)
        || !stored.path.is_file()
        || stored.path.metadata().map(|m| m.len()).unwrap_or(0) != stored.size
        || hash_file(&stored.path)? != stored.sha256 {
        return Err("O instalador não passou na verificação de integridade.".into());
    }
    #[cfg(target_os = "windows")]
    {
        // Our Windows distribution now uses Inno Setup, like AURORA AutoFill.
        // The user has explicitly approved this update in the application.
        Command::new(&stored.path)
            .args(["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART",
                   "/SP-", "/AURORAUPDATE=1"])
            .spawn()
            .map_err(|e| format!("Não foi possível iniciar o instalador do Windows: {e}"))?;
        app.exit(0);
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&stored.path)
            .spawn()
            .map_err(|e| format!("Não foi possível abrir o instalador Linux: {e}. Instale o pacote .deb usando o gerenciador de pacotes."))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        Err("Atualizações disponíveis apenas para Windows e Linux.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn asset(name: &str, tag: &str, size: u64) -> ReleaseAsset {
        ReleaseAsset {
            name: name.into(),
            browser_download_url: format!("https://github.com/{REPOSITORY}/releases/download/{tag}/{name}"),
            size,
            digest: None
        }
    }
    fn release(tag: &str, draft: bool) -> Release {
        Release { tag_name: tag.into(), draft, prerelease: tag.contains("-preview"), body: None,
            published_at: None,
            assets: vec![asset(installer_name(), tag, 100), asset(CHECKSUM_FILE, tag, 85)]
        }
    }

    #[test]
    fn compares_preview_tags_with_installed_semver() {
        assert_eq!(parse_tag("v0.0.5-preview"), Some(Version::new(0, 0, 5)));
        assert_eq!(parse_tag("v0.0.6"), Some(Version::new(0, 0, 6)));
        assert!(parse_tag("../../other").is_none());
        assert!(parse_tag("hello").is_none());
        let versions = vec![release("v0.0.5-preview", false), release("v0.0.9-preview", true),
            release("v0.0.6-preview", false)];
        assert_eq!(newest(&versions, &Version::new(0,0,5), true).unwrap().tag_name, "v0.0.6-preview");
        assert!(newest(&versions, &Version::new(0,0,6), true).is_none());
    }

    #[test]
    fn rejects_external_assets_and_oversized_downloads() {
        let mut r = release("v0.0.6-preview", false);
        r.assets[0].browser_download_url = "https://evil.example/setup.exe".to_owned();
        assert!(!suitable(&r, &Version::new(0,0,5), true));
        r.assets[0] = asset(installer_name(), &r.tag_name, MAX_DOWNLOAD + 1);
        assert!(!suitable(&r, &Version::new(0,0,5)));
    }

    #[test]
    fn parses_only_matching_sha256_manifest_line() {
        let hash = "a".repeat(64);
        let checksums = format!("{}  wrong.exe\n{}  {}\n", "b".repeat(64), hash, installer_name());
        assert_eq!(expected_checksum(&checksums, installer_name()).unwrap(), hash);
        assert!(expected_checksum("deadbeef  other.exe", installer_name()).is_err());
    }

    #[test]
    fn stable_channel_does_not_offer_unapproved_previews() {
        let versions = vec![release("v0.0.6-preview", false), release("v0.0.7", false)];
        assert_eq!(newest(&versions, &Version::new(0,0,5), false).unwrap().tag_name, "v0.0.7");
        assert!(newest(&versions[..1], &Version::new(0,0,5), false).is_none());
        assert!(newest(&versions[..1], &Version::new(0,0,5), true).is_some());
    }

    #[test]
    fn github_digest_can_be_compared_against_checksum_manifest() {
        let hash = "d".repeat(64);
        let a = asset(installer_name(), "v0.0.6-preview", 200);
        let manifest = format!("{}  {}", hash, a.name);
        let checksum = expected_checksum(&manifest, &a.name).unwrap();
        assert_eq!(format!("sha256:{checksum}"), format!("sha256:{hash}"));
    }

    #[test]
    fn hashes_files_without_loading_them_entirely() {
        let file = std::env::temp_dir().join(format!("aurora-sha-test-{}", std::process::id()));
        std::fs::write(&file, b"test").unwrap();
        assert_eq!(hash_file(&file).unwrap(),
          "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
        let _ = std::fs::remove_file(file);
    }
}
