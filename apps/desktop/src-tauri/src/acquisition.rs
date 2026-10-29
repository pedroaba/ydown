use crate::{
    data_dir, database,
    youtube::{self, Preview},
};
use rusty_ytdl::{stream::Stream, VideoQuality, VideoSearchOptions};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use tokio::{io::AsyncWriteExt, sync::watch};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub url: String,
    pub kind: String,
    pub title: String,
    pub status: String,
    pub received: u64,
    pub total: Option<u64>,
    pub error: Option<String>,
    pub track_id: Option<String>,
    pub created_at: u64,
    pub preview: Preview,
}
#[derive(Default)]
struct Inner {
    jobs: Vec<Job>,
    running: bool,
    stopping: bool,
    controls: HashMap<String, watch::Sender<bool>>,
}
#[derive(Default)]
pub struct DownloadManager(Mutex<Inner>);
fn persist(app: &AppHandle, job: &Job) -> Result<(), String> {
    database(app)?.execute("INSERT INTO download_jobs (id,data) VALUES (?1,?2) ON CONFLICT(id) DO UPDATE SET data=excluded.data", rusqlite::params![job.id,serde_json::to_string(job).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
    Ok(())
}
fn update(app: &AppHandle, id: &str, patch: impl FnOnce(&mut Job)) -> Result<(), String> {
    let manager = app.state::<DownloadManager>();
    let mut inner = manager.0.lock().map_err(|e| e.to_string())?;
    let job = inner
        .jobs
        .iter_mut()
        .find(|j| j.id == id)
        .ok_or("Download não encontrado.")?;
    patch(job);
    persist(app, job)
}
pub fn recover(app: &AppHandle) -> Result<(), String> {
    let db = database(app)?;
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS download_jobs (id TEXT PRIMARY KEY, data TEXT NOT NULL);",
    )
    .map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT data FROM download_jobs ORDER BY rowid")
        .map_err(|e| e.to_string())?;
    let values = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut jobs = Vec::new();
    for raw in values {
        let mut job: Job =
            serde_json::from_str(&raw.map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        if ["queued", "downloading", "processing"].contains(&job.status.as_str()) {
            job.status = "failed".into();
            job.error = Some("Interrompido ao fechar o aplicativo. Tente novamente.".into());
            persist(app, &job)?;
        }
        jobs.push(job);
    }
    app.state::<DownloadManager>()
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .jobs = jobs;
    Ok(())
}
pub fn stop(app: &AppHandle) {
    if let Ok(mut inner) = app.state::<DownloadManager>().0.lock() {
        inner.stopping = true;
        for sender in inner.controls.values() {
            let _ = sender.send(true);
        }
    }
}
#[tauri::command]
pub async fn preview_youtube(url: String) -> Result<Preview, String> {
    youtube::preview(&url).await
}
#[tauri::command]
pub fn list_downloads(app: AppHandle) -> Result<Vec<Job>, String> {
    Ok(app
        .state::<DownloadManager>()
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .jobs
        .clone())
}
#[tauri::command]
pub async fn enqueue_youtube(app: AppHandle, url: String, kind: String) -> Result<Job, String> {
    if !["audio", "video"].contains(&kind.as_str()) {
        return Err("Escolha áudio ou vídeo.".into());
    }
    tool_path(&app, "ffmpeg")?;
    tool_path(&app, "ffprobe")?;
    let (url, id) = youtube::canonical_url(&url)?;
    let job_id = format!("yt-{id}-{kind}");
    {
        let manager = app.state::<DownloadManager>();
        let inner = manager.0.lock().map_err(|e| e.to_string())?;
        if let Some(existing) = inner.jobs.iter().find(|j| j.id == job_id) {
            return Ok(existing.clone());
        }
    }
    let preview = youtube::preview(&url).await?;
    let job = Job {
        id: job_id,
        url,
        kind,
        title: preview.title.clone(),
        status: "queued".into(),
        received: 0,
        total: None,
        error: None,
        track_id: None,
        created_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        preview,
    };
    {
        let manager = app.state::<DownloadManager>();
        let mut inner = manager.0.lock().map_err(|e| e.to_string())?;
        if let Some(existing) = inner.jobs.iter().find(|j| j.id == job.id) {
            return Ok(existing.clone());
        }
        persist(&app, &job)?;
        inner.jobs.push(job.clone());
    }
    launch(&app);
    Ok(job)
}
#[tauri::command]
pub fn cancel_download(app: AppHandle, id: String) -> Result<(), String> {
    let manager = app.state::<DownloadManager>();
    let mut inner = manager.0.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = inner.controls.get(&id) {
        let _ = sender.send(true);
    }
    let job = inner
        .jobs
        .iter_mut()
        .find(|j| j.id == id)
        .ok_or("Download não encontrado.")?;
    if job.status == "queued" {
        job.status = "cancelled".into();
        persist(&app, job)?;
    }
    Ok(())
}
#[tauri::command]
pub fn retry_download(app: AppHandle, id: String) -> Result<(), String> {
    update(&app, &id, |job| {
        if ["failed", "cancelled"].contains(&job.status.as_str()) {
            job.status = "queued".into();
            job.received = 0;
            job.total = None;
            job.error = None;
        }
    })?;
    launch(&app);
    Ok(())
}
fn launch(app: &AppHandle) {
    let manager = app.state::<DownloadManager>();
    {
        let mut inner = manager.0.lock().unwrap();
        if inner.running || inner.stopping {
            return;
        }
        inner.running = true;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let next = {
                let manager = app.state::<DownloadManager>();
                let mut inner = manager.0.lock().unwrap();
                if inner.stopping {
                    inner.running = false;
                    return;
                }
                let next = inner.jobs.iter().find(|j| j.status == "queued").cloned();
                if let Some(job) = next {
                    let (tx, rx) = watch::channel(false);
                    inner.controls.insert(job.id.clone(), tx);
                    Some((job, rx))
                } else {
                    inner.running = false;
                    None
                }
            };
            let Some((job, mut cancel)) = next else {
                return;
            };
            let _ = update(&app, &job.id, |j| j.status = "downloading".into());
            let result = download(&app, &job, &mut cancel).await;
            let _ = update(&app, &job.id, |j| match result {
                Ok(()) => {
                    j.status = "completed".into();
                    j.track_id = Some(j.id.clone());
                    j.error = None;
                }
                Err(ref e) if e == "cancelled" => {
                    j.status = "cancelled".into();
                    j.error = None;
                }
                Err(ref e) => {
                    j.status = "failed".into();
                    j.error = Some(e.clone());
                }
            });
            app.state::<DownloadManager>()
                .0
                .lock()
                .unwrap()
                .controls
                .remove(&job.id);
            let _ = tokio::fs::remove_dir_all(
                data_dir(&app)
                    .unwrap_or_default()
                    .join("downloads")
                    .join(&job.id),
            )
            .await;
        }
    });
}
async fn cancellable<T>(
    cancel: &mut watch::Receiver<bool>,
    future: impl std::future::Future<Output = Result<T, String>>,
) -> Result<T, String> {
    if *cancel.borrow() {
        return Err("cancelled".into());
    }
    tokio::select! { biased; _=cancel.changed()=>Err("cancelled".into()), result=future=>result }
}
async fn stream_to_file(
    app: &AppHandle,
    job: &Job,
    stream: Box<dyn Stream + Send + Sync>,
    path: &std::path::Path,
    base: u64,
    total: u64,
    cancel: &mut watch::Receiver<bool>,
) -> Result<u64, String> {
    let expected = stream.content_length() as u64;
    let mut file = tokio::fs::File::create(path)
        .await
        .map_err(|e| e.to_string())?;
    let mut received = 0;
    let mut last = Instant::now() - Duration::from_secs(1);
    loop {
        let chunk = cancellable(cancel, async {
            tokio::time::timeout(Duration::from_secs(45), stream.chunk())
                .await
                .map_err(|_| "Sem resposta ao baixar. Tente novamente.".to_string())?
                .map_err(|e| format!("Falha no download pelo rusty_ytdl: {e}"))
        })
        .await?;
        let Some(chunk) = chunk else {
            break;
        };
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Não foi possível gravar o arquivo: {e}"))?;
        received += chunk.len() as u64;
        if last.elapsed() > Duration::from_millis(350) {
            update(app, &job.id, |j| {
                j.received = base + received;
                j.total = (total > 0).then_some(total);
            })?;
            last = Instant::now();
        }
    }
    file.sync_all().await.map_err(|e| e.to_string())?;
    if received == 0 || (expected > 0 && received != expected) {
        return Err("Download incompleto. Tente novamente.".into());
    }
    update(app, &job.id, |j| {
        j.received = base + received;
        j.total = Some(total.max(base + received));
    })?;
    Ok(received)
}
async fn download(
    app: &AppHandle,
    job: &Job,
    cancel: &mut watch::Receiver<bool>,
) -> Result<(), String> {
    let dir = data_dir(app)?.join("downloads").join(&job.id);
    let _ = tokio::fs::remove_dir_all(&dir).await;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| e.to_string())?;
    let audio = youtube::video(
        &job.url,
        VideoSearchOptions::Audio,
        VideoQuality::HighestAudio,
    )?;
    let audio = cancellable(cancel, async {
        audio
            .stream()
            .await
            .map_err(|e| format!("O rusty_ytdl não conseguiu abrir o áudio: {e}"))
    })
    .await?;
    let video = if job.kind == "video" {
        let filter = VideoSearchOptions::Custom(Arc::new(|f| {
            f.has_video && !f.has_audio && f.height.unwrap_or(0) <= 1080
        }));
        let video = youtube::video(&job.url, filter, VideoQuality::HighestVideo)?;
        Some(
            cancellable(cancel, async {
                video
                    .stream()
                    .await
                    .map_err(|e| format!("O rusty_ytdl não conseguiu abrir o vídeo: {e}"))
            })
            .await?,
        )
    } else {
        None
    };
    let total = audio.content_length() as u64
        + video
            .as_ref()
            .map(|s| s.content_length() as u64)
            .unwrap_or(0);
    let received =
        stream_to_file(app, job, audio, &dir.join("audio.input"), 0, total, cancel).await?;
    if let Some(video) = video {
        stream_to_file(
            app,
            job,
            video,
            &dir.join("video.input"),
            received,
            total,
            cancel,
        )
        .await?;
    }
    update(app, &job.id, |j| j.status = "processing".into())?;
    let ext = if job.kind == "video" { "mp4" } else { "m4a" };
    let pending = dir.join(format!("final.{ext}"));
    let mut command = tokio::process::Command::new(tool_path(app, "ffmpeg")?);
    command
        .args(["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i"])
        .arg(dir.join("audio.input"));
    if job.kind == "video" {
        command.arg("-i").arg(dir.join("video.input")).args([
            "-map", "1:v:0", "-map", "0:a:0", "-c:v", "libx264", "-preset", "veryfast", "-crf",
            "22", "-pix_fmt", "yuv420p",
        ]);
    } else {
        command.arg("-vn");
    }
    command
        .args(["-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"])
        .arg(&pending)
        .kill_on_drop(true);
    let output = cancellable(cancel, async {
        tokio::time::timeout(Duration::from_secs(1800), command.output())
            .await
            .map_err(|_| "O processamento demorou demais.".to_string())?
            .map_err(|e| e.to_string())
    })
    .await?;
    if !output.status.success() {
        return Err(format!(
            "FFmpeg: {}",
            String::from_utf8_lossy(&output.stderr)
                .chars()
                .take(800)
                .collect::<String>()
        ));
    }
    let duration = probe(app, &pending).await?;
    if *cancel.borrow() {
        return Err("cancelled".into());
    }
    // Commit the finalized file and library record before reporting completion.
    let filename = format!("{}.{ext}", job.id);
    let dest = data_dir(app)?.join("audio").join(&filename);
    tokio::fs::rename(&pending, &dest)
        .await
        .map_err(|e| e.to_string())?;
    let mut track = json!({"id":job.id,"title":job.preview.title,"artist":job.preview.artist,"album":"YouTube","duration":duration,"color":"#3b3b3b","source":format!("local:{filename}"),"mediaKind":job.kind,"originUrl":job.url});
    // Artwork is optional; media remains usable offline even if its thumbnail is unavailable.
    if let Ok(response) = rusty_ytdl::reqwest::Client::new()
        .get(&job.preview.thumbnail)
        .timeout(Duration::from_secs(10))
        .send()
        .await
    {
        if response.status().is_success() {
            if let Ok(bytes) = response.bytes().await {
                if bytes.len() < 5_000_000 && bytes.starts_with(&[0xff, 0xd8]) {
                    let cover = format!("{}.jpg", job.id);
                    if tokio::fs::write(data_dir(app)?.join("audio").join(&cover), bytes)
                        .await
                        .is_ok()
                    {
                        track["artwork"] = json!(format!("local:{cover}"));
                    }
                }
            }
        }
    }
    if *cancel.borrow() {
        let _ = tokio::fs::remove_file(&dest).await;
        let _ =
            tokio::fs::remove_file(data_dir(app)?.join("audio").join(format!("{}.jpg", job.id)))
                .await;
        return Err("cancelled".into());
    }
    if let Err(error) = commit_track(app, track) {
        let _ = tokio::fs::remove_file(&dest).await;
        return Err(error);
    }
    Ok(())
}
fn commit_track(app: &AppHandle, track: Value) -> Result<(), String> {
    use rusqlite::OptionalExtension;
    let mut db = database(app)?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let raw: Option<String> = tx
        .query_row(
            "SELECT value FROM app_state WHERE key='local.library.v1'",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let mut library: Value = match raw {
        Some(raw) => serde_json::from_str(&raw).map_err(|e| e.to_string())?,
        None => json!({"tracks":[],"favoriteIds":[],"playlists":[]}),
    };
    let tracks = library["tracks"]
        .as_array_mut()
        .ok_or("Biblioteca inválida.")?;
    if !tracks.iter().any(|t| t["id"] == track["id"]) {
        tracks.push(track);
    }
    tx.execute("INSERT INTO app_state(key,value) VALUES ('local.library.v1',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[library.to_string()]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
async fn probe(app: &AppHandle, path: &std::path::Path) -> Result<f64, String> {
    let output = tokio::time::timeout(
        Duration::from_secs(30),
        tokio::process::Command::new(tool_path(app, "ffprobe")?)
            .args([
                "-v",
                "error",
                "-show_entries",
                "format=duration:stream=codec_type",
                "-of",
                "json",
            ])
            .arg(path)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| "A validação do arquivo demorou demais.".to_string())?
    .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("O FFprobe rejeitou o arquivo baixado.".into());
    }
    let info: Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
    let duration = info["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|n| n.is_finite() && *n > 0.0)
        .ok_or("O arquivo não tem uma duração válida.")?;
    if !info["streams"]
        .as_array()
        .is_some_and(|s| s.iter().any(|s| s["codec_type"] == "audio"))
    {
        return Err("O arquivo não contém áudio.".into());
    }
    Ok(duration)
}
fn tool_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        let base = if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries/macos-arm64")
        } else {
            app.path()
                .resource_dir()
                .map_err(|e| e.to_string())?
                .join("binaries/macos-arm64")
        };
        let path = base.join(name);
        if path.is_file() {
            return Ok(path);
        }
    }
    Err(format!(
        "O binário {name} não está incluído para este sistema/arquitetura."
    ))
}
#[tauri::command]
pub async fn media_tools(app: AppHandle) -> Result<Vec<String>, String> {
    let mut tools = vec!["rusty_ytdl · revisão b1c6eb7 (Rust)".into()];
    for name in ["ffmpeg", "ffprobe"] {
        let output = tokio::process::Command::new(tool_path(&app, name)?)
            .arg("-version")
            .kill_on_drop(true)
            .output()
            .await
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!("Não foi possível executar {name}."));
        }
        tools.push(
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .unwrap_or(name)
                .to_string(),
        );
    }
    Ok(tools)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn cancellation_interrupts_pending_work() {
        let (sender, mut receiver) = watch::channel(false);
        let task = tokio::spawn(async move {
            cancellable(&mut receiver, async {
                tokio::time::sleep(Duration::from_secs(30)).await;
                Ok(())
            })
            .await
        });
        sender.send(true).unwrap();
        let result = tokio::time::timeout(Duration::from_secs(1), task)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(result, Err("cancelled".to_string()));
    }
}
