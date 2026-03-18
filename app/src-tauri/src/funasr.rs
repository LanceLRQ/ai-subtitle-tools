use std::path::Path;

use reqwest::multipart;
use tokio::fs::File;
use tokio_util::codec::{BytesCodec, FramedRead};

use crate::file_ops;

/// 允许的音频文件扩展名
const ALLOWED_AUDIO_EXTS: &[&str] = &["wav", "mp3", "flac", "ogg", "m4a", "aac", "wma"];

/// 调用 FunASR API 识别音频文件（流式上传，不加载整个文件到内存）
#[tauri::command]
pub async fn recognize_speech(
    audio_path: String,
    funasr_url: String,
    api_key: String,
    model: String,
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

    // 异步打开文件，用流式读取避免加载整个文件到内存
    let file = File::open(&audio_path)
        .await
        .map_err(|e| format!("Failed to open audio file '{}': {}", audio_path, e))?;

    // 获取文件名用于 multipart filename
    let filename = Path::new(&audio_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio.wav")
        .to_string();

    // 用 FramedRead + BytesCodec 将文件转为异步 Stream（~8KB 块读取）
    let stream = FramedRead::new(file, BytesCodec::new());
    let body = reqwest::Body::wrap_stream(stream);

    // 构建 multipart form，使用 Part::stream 实现流式上传
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

    let form = multipart::Form::new()
        .part("file", file_part)
        .text("model", model)
        .text("response_format", "verbose_json")
        .text("language", "auto")
        .text("word_timestamps", "true")
        .text("enable_speaker_diarization", "false");

    // 构建 HTTP 客户端（无总超时，大文件上传可能很慢）
    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // 发送 POST 请求
    let url = format!(
        "{}/v1/audio/transcriptions",
        funasr_url.trim_end_matches('/')
    );

    let mut request = client.post(&url).multipart(form);

    if !api_key.is_empty() {
        request = request.bearer_auth(&api_key);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("FunASR request failed: {}", e))?;

    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read FunASR response: {}", e))?;

    if !status.is_success() {
        return Err(format!("FunASR API error ({}): {}", status, body_text));
    }

    // 返回 JSON 字符串，让 JS 侧负责类型解析
    Ok(body_text)
}
