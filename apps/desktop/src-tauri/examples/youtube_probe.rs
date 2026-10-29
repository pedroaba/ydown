#[path = "../src/youtube.rs"]
mod youtube;
use rusty_ytdl::{VideoQuality, VideoSearchOptions};
use std::time::Duration;
#[tokio::main]
async fn main() -> Result<(), String> {
    let url = std::env::args()
        .nth(1)
        .ok_or("Informe um link de vídeo público de teste.")?;
    let preview = youtube::preview(&url).await?;
    println!("Título: {} | Duração: {}s", preview.title, preview.duration);
    let video = youtube::video(
        &preview.url,
        VideoSearchOptions::Audio,
        VideoQuality::HighestAudio,
    )?;
    let stream = tokio::time::timeout(Duration::from_secs(45), video.stream())
        .await
        .map_err(|_| "Timeout ao abrir stream".to_string())?
        .map_err(|e| e.to_string())?;
    let mut count = 0;
    while let Some(chunk) = tokio::time::timeout(Duration::from_secs(45), stream.chunk())
        .await
        .map_err(|_| "Timeout ao baixar chunk".to_string())?
        .map_err(|e| e.to_string())?
    {
        count += chunk.len();
    }
    if count == 0 {
        return Err("Stream vazio".into());
    }
    println!("Download Rust confirmado: {count} bytes (sem adicionar à biblioteca).");
    Ok(())
}
