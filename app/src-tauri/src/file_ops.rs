use std::fs;
use std::path::Path;

/// 根据视频路径生成临时音频文件路径（同目录下 .wav）
#[tauri::command]
pub fn get_temp_audio_path(video_path: String) -> Result<String, String> {
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
    fs::write(&path, content)
        .map_err(|e| format!("Failed to save file '{}': {}", path, e))
}

/// 读取文件二进制内容（音频上传用）
#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

/// 删除文件
#[tauri::command]
pub fn remove_file(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove file '{}': {}", path, e))
    } else {
        Ok(())
    }
}
