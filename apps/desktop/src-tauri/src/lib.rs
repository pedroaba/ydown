mod acquisition;
mod youtube;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(path.join("audio")).map_err(|e| e.to_string())?;
    Ok(path)
}
fn database(app: &AppHandle) -> Result<Connection, String> {
    let db = Connection::open(data_dir(app)?.join("library.sqlite3")).map_err(|e| e.to_string())?;
    db.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version=1;").map_err(|e| e.to_string())?;
    Ok(db)
}
#[tauri::command]
fn load_state(app: AppHandle, key: String) -> Result<Option<String>, String> {
    use rusqlite::OptionalExtension;
    database(&app)?
        .query_row("SELECT value FROM app_state WHERE key=?1", [key], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn save_state(app: AppHandle, key: String, value: String) -> Result<(), String> {
    use rusqlite::OptionalExtension;
    let mut incoming: serde_json::Value =
        serde_json::from_str(&value).map_err(|e| e.to_string())?;
    let mut db = database(&app)?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    if key == "local.library.v1" {
        let stored: Option<String> = tx
            .query_row("SELECT value FROM app_state WHERE key=?1", [&key], |row| {
                row.get(0)
            })
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some(stored) = stored {
            let current: serde_json::Value =
                serde_json::from_str(&stored).map_err(|e| e.to_string())?;
            if let (Some(old), Some(next)) = (
                current["tracks"].as_array(),
                incoming["tracks"].as_array_mut(),
            ) {
                for track in old {
                    if track["id"].as_str().is_some_and(|id| id.starts_with("yt-"))
                        && !next.iter().any(|t| t["id"] == track["id"])
                    {
                        next.push(track.clone());
                    }
                }
            }
        }
    }
    tx.execute("INSERT INTO app_state (key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,incoming.to_string()]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn audio_path(app: AppHandle, source: String) -> Result<String, String> {
    let filename = source.strip_prefix("local:").ok_or("Origem inválida.")?;
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Caminho inválido.".into());
    }
    let path = data_dir(&app)?.join("audio").join(filename);
    if !path.is_file() {
        return Err("Arquivo não encontrado. Baixe este conteúdo novamente.".into());
    }
    Ok(path.to_string_lossy().into_owned())
}
#[derive(Serialize)]
struct StorageInfo {
    path: String,
    bytes: u64,
}
#[tauri::command]
fn storage_info(app: AppHandle) -> Result<StorageInfo, String> {
    let path = data_dir(&app)?;
    let bytes = fs::read_dir(path.join("audio"))
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum();
    Ok(StorageInfo {
        path: path.to_string_lossy().into_owned(),
        bytes,
    })
}
pub fn run() {
    tauri::Builder::default()
        .manage(acquisition::DownloadManager::default())
        .setup(|app| {
            acquisition::recover(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            acquisition::preview_youtube,
            acquisition::enqueue_youtube,
            acquisition::list_downloads,
            acquisition::cancel_download,
            acquisition::retry_download,
            acquisition::media_tools,
            audio_path,
            storage_info
        ])
        .build(tauri::generate_context!())
        .expect("Não foi possível iniciar LOCAL")
        .run(|app, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                acquisition::stop(app);
            }
        });
}
