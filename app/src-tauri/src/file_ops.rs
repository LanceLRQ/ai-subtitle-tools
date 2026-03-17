use std::fs;
use std::path::{Path, Component};
use tauri::ipc::Response;

/// 校验路径安全性：拒绝路径遍历攻击
fn validate_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);

    // 拒绝包含 ".." 的路径分量
    for component in p.components() {
        if matches!(component, Component::ParentDir) {
            return Err(format!("Path traversal not allowed: {}", path));
        }
    }

    // 必须是绝对路径
    if !p.is_absolute() {
        return Err(format!("Only absolute paths are allowed: {}", path));
    }

    Ok(())
}

/// 将文件名中的非安全字符替换为下划线，并去除首尾空白
fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = sanitized.trim_matches('_');
    if trimmed.is_empty() {
        "audio".to_string()
    } else {
        trimmed.to_string()
    }
}

/// 在系统临时目录下生成音频文件路径
#[tauri::command]
pub fn get_temp_audio_path(video_path: String) -> Result<String, String> {
    let path = Path::new(&video_path);

    let stem = path
        .file_stem()
        .ok_or("Invalid video file path")?
        .to_string_lossy();

    let safe_stem = sanitize_filename(&stem);

    // 使用系统临时目录，加 pid 避免多实例冲突
    let temp_dir = std::env::temp_dir();
    let app_temp = temp_dir.join("ai-subtitle-tools");
    fs::create_dir_all(&app_temp)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let audio_path = app_temp.join(format!(
        "{}_{}.wav",
        safe_stem,
        std::process::id()
    ));

    Ok(audio_path.to_string_lossy().to_string())
}

/// 清理应用临时目录下的所有文件
#[tauri::command]
pub fn cleanup_temp_files() -> Result<(), String> {
    let temp_dir = std::env::temp_dir().join("ai-subtitle-tools");
    if temp_dir.exists() {
        if let Ok(entries) = fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    Ok(())
}

/// 保存调试日志文件（覆盖写入）
#[tauri::command]
pub fn save_debug_file(path: String, content: String) -> Result<(), String> {
    validate_path(&path)?;

    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext != "json" && ext != "log" {
        return Err(format!("Debug files must be .json or .log, got: .{}", ext));
    }

    fs::write(&path, content)
        .map_err(|e| format!("Failed to save debug file '{}': {}", path, e))
}

/// 追加调试日志文件内容
#[tauri::command]
pub fn append_debug_file(path: String, content: String) -> Result<(), String> {
    validate_path(&path)?;

    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext != "log" {
        return Err(format!("Append only allowed for .log files, got: .{}", ext));
    }

    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open debug file '{}': {}", path, e))?;

    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to append to debug file '{}': {}", path, e))
}

/// 保存文本文件（SRT 导出用）
#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    validate_path(&path)?;

    // 限制只能保存 .srt 文件
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext != "srt" {
        return Err(format!("Only .srt files can be saved, got: .{}", ext));
    }

    fs::write(&path, content)
        .map_err(|e| format!("Failed to save file '{}': {}", path, e))
}

/// 读取文件二进制内容（音频上传用）
///
/// 返回 `tauri::ipc::Response` 以使用二进制 IPC 传输，
/// 避免 `Vec<u8>` 被 JSON 序列化为数字数组导致的严重性能问题。
#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Response, String> {
    validate_path(&path)?;

    // 限制只能读取音频文件
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let allowed_audio_exts = ["wav", "mp3", "flac", "ogg", "m4a", "aac", "wma"];
    if !allowed_audio_exts.contains(&ext.as_str()) {
        return Err(format!(
            "Only audio files can be read, got: .{} (allowed: {})",
            ext,
            allowed_audio_exts.join(", ")
        ));
    }

    let bytes = fs::read(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;

    Ok(Response::new(bytes))
}

/// 删除临时文件
#[tauri::command]
pub fn remove_file(path: String) -> Result<(), String> {
    validate_path(&path)?;

    // 只允许删除应用临时目录下的文件
    let app_temp = std::env::temp_dir().join("ai-subtitle-tools");
    let file_path = Path::new(&path);

    if !file_path.starts_with(&app_temp) {
        return Err(format!("Only temp files can be removed: {}", path));
    }

    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|e| format!("Failed to remove file '{}': {}", path, e))
    } else {
        Ok(())
    }
}
