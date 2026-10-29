use rusty_ytdl::{RequestOptions, Video, VideoOptions, VideoQuality, VideoSearchOptions};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use url::Url;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub video_id: String,
    pub url: String,
    pub title: String,
    pub artist: String,
    pub duration: f64,
    pub thumbnail: String,
}
pub fn canonical_url(input: &str) -> Result<(String, String), String> {
    let url =
        Url::parse(input.trim()).map_err(|_| "Cole um link válido do YouTube.".to_string())?;
    if url.scheme() != "https"
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Use um link HTTPS do YouTube.".into());
    }
    let host = url.host_str().unwrap_or("");
    let id = match host {
        "youtu.be" | "www.youtu.be" => url.path().trim_matches('/').to_owned(),
        "youtube.com" | "www.youtube.com" | "m.youtube.com" | "music.youtube.com" => {
            if url.path() == "/watch" {
                url.query_pairs()
                    .find(|(key, _)| key == "v")
                    .map(|(_, v)| v.into_owned())
                    .unwrap_or_default()
            } else {
                let parts: Vec<_> = url.path().trim_matches('/').split('/').collect();
                if parts.len() == 2 && ["shorts", "embed", "live"].contains(&parts[0]) {
                    parts[1].into()
                } else {
                    String::new()
                }
            }
        }
        _ => return Err("Este campo aceita apenas links do YouTube.".into()),
    };
    if id.len() != 11
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err("O link precisa apontar para um vídeo, não para um canal ou playlist.".into());
    }
    Ok((format!("https://www.youtube.com/watch?v={id}"), id))
}
pub fn video(
    url: &str,
    filter: VideoSearchOptions,
    quality: VideoQuality,
) -> Result<Video<'_>, String> {
    let client = rusty_ytdl::reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    Video::new_with_options(
        url,
        VideoOptions {
            filter,
            quality,
            request_options: RequestOptions {
                client: Some(client),
                max_retries: Some(1),
                ..Default::default()
            },
            ..Default::default()
        },
    )
    .map_err(|e| e.to_string())
}
pub async fn preview(input: &str) -> Result<Preview, String> {
    let (url, id) = canonical_url(input)?;
    let video = video(&url, VideoSearchOptions::Audio, VideoQuality::HighestAudio)?;
    let info = tokio::time::timeout(Duration::from_secs(45), video.get_info())
        .await
        .map_err(|_| "O YouTube demorou para responder. Tente novamente.".to_string())?
        .map_err(|e| {
            format!(
                "O rusty_ytdl não conseguiu consultar este vídeo: {e}. Tente outro link público."
            )
        })?;
    let details = info.video_details;
    if details.is_private || details.age_restricted || details.is_live_content {
        return Err("Use um vídeo público e gravado, sem restrição de idade. Transmissões ao vivo não são suportadas.".into());
    }
    let duration: f64 = details
        .length_seconds
        .parse()
        .map_err(|_| "Duração indisponível.".to_string())?;
    if !duration.is_finite() || duration <= 0.0 {
        return Err("O vídeo não tem uma duração válida.".into());
    }
    Ok(Preview {
        video_id: id.clone(),
        url,
        title: details.title,
        artist: details
            .author
            .map(|a| a.name)
            .unwrap_or_else(|| "YouTube".into()),
        duration,
        thumbnail: format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg"),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalizes_supported_links() {
        for input in [
            "https://youtu.be/jNQXAC9IVRw?t=2",
            "https://www.youtube.com/watch?v=jNQXAC9IVRw&list=abc",
            "https://music.youtube.com/watch?v=jNQXAC9IVRw",
            "https://www.youtube.com/shorts/jNQXAC9IVRw",
        ] {
            assert_eq!(
                canonical_url(input).unwrap().0,
                "https://www.youtube.com/watch?v=jNQXAC9IVRw"
            );
        }
    }
    #[test]
    fn rejects_foreign_hosts_and_non_video_urls() {
        for input in [
            "https://youtube.com.evil.test/watch?v=jNQXAC9IVRw",
            "file:///etc/passwd",
            "https://youtube.com/playlist?list=abc",
            "https://user@youtube.com/watch?v=jNQXAC9IVRw",
            "https://youtu.be/../../etc",
            "--help",
            "https://youtu.be/invalid",
        ] {
            assert!(canonical_url(input).is_err(), "{input}");
        }
    }
}
