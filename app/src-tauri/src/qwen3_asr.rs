use std::path::Path;

use reqwest::multipart;
use tokio::fs::File;
use tokio_util::codec::{BytesCodec, FramedRead};

use crate::file_ops;

/// 允许的音频文件扩展名
const ALLOWED_AUDIO_EXTS: &[&str] = &["wav", "mp3", "flac", "ogg", "m4a", "aac", "wma"];

/// 提交音频文件到 Qwen3-ASR-Service 进行识别
#[tauri::command]
pub async fn qwen3_submit_asr(
    audio_path: String,
    base_url: String,
    api_key: String,
) -> Result<String, String> {
    // 校验路径安全性
    file_ops::validate_path(&audio_path)?;

    // 校验文件扩展名
    let ext = Path::new(&audio_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !ALLOWED_AUDIO_EXTS.contains(&ext.as_str()) {
        return Err(format!(
            "Only audio files are allowed, got: .{} (allowed: {})",
            ext,
            ALLOWED_AUDIO_EXTS.join(", ")
        ));
    }

    // 异步打开文件，流式读取
    let file = File::open(&audio_path)
        .await
        .map_err(|e| format!("Failed to open audio file '{}': {}", audio_path, e))?;

    let filename = Path::new(&audio_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio.wav")
        .to_string();

    let stream = FramedRead::new(file, BytesCodec::new());
    let body = reqwest::Body::wrap_stream(stream);

    let mime_type = match ext.as_str() {
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "wma" => "audio/x-ms-wma",
        _ => "application/octet-stream",
    };

    let file_part = multipart::Part::stream(body)
        .file_name(filename)
        .mime_str(mime_type)
        .map_err(|e| format!("Failed to set MIME type: {}", e))?;

    let form = multipart::Form::new().part("file", file_part);

    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/asr", base_url.trim_end_matches('/'));

    let mut request = client.post(&url).multipart(form);

    if !api_key.is_empty() {
        request = request.bearer_auth(&api_key);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Qwen3 ASR submit request failed: {}", e))?;

    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Qwen3 ASR submit response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Qwen3 ASR submit error ({}): {}", status, body_text));
    }

    Ok(body_text)
}

/// 轮询 Qwen3-ASR-Service 任务状态
#[tauri::command]
pub async fn qwen3_poll_asr(
    base_url: String,
    task_id: String,
    api_key: String,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/asr/{}", base_url.trim_end_matches('/'), task_id);

    let mut request = client.get(&url);

    if !api_key.is_empty() {
        request = request.bearer_auth(&api_key);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Qwen3 ASR poll request failed: {}", e))?;

    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Qwen3 ASR poll response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Qwen3 ASR poll error ({}): {}", status, body_text));
    }

    Ok(body_text)
}

/// Qwen3-ASR-Service 健康检查
#[tauri::command]
pub async fn qwen3_health_check(
    base_url: String,
    api_key: String,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/health", base_url.trim_end_matches('/'));

    let mut request = client.get(&url);

    if !api_key.is_empty() {
        request = request.bearer_auth(&api_key);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Qwen3 ASR health check failed: {}", e))?;

    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Qwen3 ASR health response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Qwen3 ASR health check error ({}): {}", status, body_text));
    }

    Ok(body_text)
}
