use std::fs;
use std::path::{Path, Component};

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

/// 根据视频路径生成临时音频文件路径（同目录下 .wav）
#[tauri::command]
pub fn get_temp_audio_path(video_path: String) -> Result<String, String> {
    validate_path(&video_path)?;

    let path = Path::new(&video_path);

    let stem = path
        .file_stem()
        .ok_or("Invalid video file path")?
        .to_string_lossy();

    let parent = path
        .parent()
        .ok_or("Cannot get parent directory")?
        .to_string_lossy();

    let audio_path = format!("{}/{}_temp_audio.wav", parent, stem);
    Ok(audio_path)
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
#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
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

    fs::read(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

/// 删除临时文件
#[tauri::command]
pub fn remove_file(path: String) -> Result<(), String> {
    validate_path(&path)?;

    // 只允许删除临时音频文件
    let file_name = Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if !file_name.contains("_temp_audio") {
        return Err(format!("Only temp audio files can be removed: {}", path));
    }

    if Path::new(&path).exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove file '{}': {}", path, e))
    } else {
        Ok(())
    }
}
