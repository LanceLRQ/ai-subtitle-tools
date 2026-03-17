use std::path::Path;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// curl 二进制名称
fn curl_bin() -> &'static str {
    if cfg!(target_os = "windows") {
        "curl.exe"
    } else {
        "curl"
    }
}

/// 从 curl 输出中分离 body 和 HTTP 状态码
/// curl 使用 -w "\n%{http_code}" 在 stdout 末尾追加状态码
fn parse_curl_output(stdout: &str) -> (String, u16) {
    if let Some(pos) = stdout.rfind('\n') {
        let body = &stdout[..pos];
        let code_str = stdout[pos + 1..].trim();
        let code = code_str.parse::<u16>().unwrap_or(0);
        (body.to_string(), code)
    } else {
        (stdout.to_string(), 0)
    }
}

/// 通过 curl 上传音频文件到 FunASR API
#[tauri::command]
pub async fn upload_audio_to_asr(
    audio_path: String,
    asr_url: String,
    api_key: String,
    model: String,
) -> Result<String, String> {
    let path = Path::new(&audio_path);
    if !path.exists() {
        return Err(format!("Audio file does not exist: {}", audio_path));
    }

    let file_size = tokio::fs::metadata(&audio_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);
    log::info!(
        "[ASR] Uploading audio: {} ({:.1} MB)",
        audio_path,
        file_size as f64 / 1024.0 / 1024.0
    );

    let url = format!(
        "{}/v1/audio/transcriptions",
        asr_url.trim_end_matches('/')
    );

    let mut cmd = Command::new(curl_bin());
    cmd.arg("-s").arg("-S")
       .arg("-w").arg("\n%{http_code}")
       .arg("-X").arg("POST")
       .arg("-F").arg(format!("file=@{};type=audio/wav", audio_path))
       .arg("-F").arg(format!("model={}", model))
       .arg("-F").arg("response_format=verbose_json")
       .arg("-F").arg("language=auto")
       .arg("-F").arg("word_timestamps=true");

    if !api_key.is_empty() {
        cmd.arg("-H").arg(format!("Authorization: Bearer {}", api_key));
    }

    cmd.arg(&url);

    log::info!("[ASR] Sending curl request to {}", url);
    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let code = output.status.code().unwrap_or(-1);
        let body = if stdout.is_empty() { &stderr } else { &stdout };
        return Err(format!("FunASR request failed (curl exit {}): {}", code, body));
    }

    let (body, http_code) = parse_curl_output(&stdout);
    if http_code >= 400 {
        return Err(format!("FunASR API error (HTTP {}): {}", http_code, body));
    }

    log::info!("[ASR] Success (HTTP {}), response length: {} bytes", http_code, body.len());
    Ok(body)
}

/// SSE 流式数据事件
#[derive(Clone, serde::Serialize)]
pub struct LlmStreamChunk {
    pub content: String,
}

/// 通过 curl 发送 LLM 流式请求，SSE 数据通过 Tauri 事件推送
#[tauri::command]
pub async fn curl_post_stream(
    app: AppHandle,
    url: String,
    api_key: String,
    body: String,
) -> Result<String, String> {
    log::info!("[LLM] curl_post_stream to {}", url);

    let mut cmd = Command::new(curl_bin());
    cmd.arg("-s").arg("-S")
       .arg("-N")  // no-buffer, for streaming
       .arg("-X").arg("POST")
       .arg("-H").arg("Content-Type: application/json");

    if !api_key.is_empty() {
        cmd.arg("-H").arg(format!("Authorization: Bearer {}", api_key));
    }

    cmd.arg("-d").arg(&body)
       .arg(&url)
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    let stdout = child.stdout.take()
        .ok_or("Failed to capture curl stdout")?;

    let mut reader = BufReader::new(stdout).lines();
    let mut accumulated = String::new();

    while let Ok(Some(line)) = reader.next_line().await {
        let trimmed = line.trim();
        if trimmed.is_empty() || !trimmed.starts_with("data: ") {
            continue;
        }
        let data = &trimmed[6..];
        if data == "[DONE]" {
            continue;
        }

        if let Ok(chunk) = serde_json::from_str::<serde_json::Value>(data) {
            if let Some(content) = chunk
                .get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("delta"))
                .and_then(|d| d.get("content"))
                .and_then(|c| c.as_str())
            {
                accumulated.push_str(content);
                let _ = app.emit("llm-stream-chunk", LlmStreamChunk {
                    content: content.to_string(),
                });
            }
        }
    }

    let status = child.wait().await
        .map_err(|e| format!("curl process error: {}", e))?;

    if !status.success() {
        let code = status.code().unwrap_or(-1);
        if accumulated.is_empty() {
            return Err(format!("LLM API error (curl exit {})", code));
        }
        return Err(format!("LLM API error (curl exit {}): {}", code, accumulated));
    }

    log::info!("[LLM] Stream done, response length: {} bytes", accumulated.len());
    Ok(accumulated)
}

/// 通过 curl 发送 LLM 非流式请求
#[tauri::command]
pub async fn curl_post_json(
    url: String,
    api_key: String,
    body: String,
) -> Result<String, String> {
    log::info!("[LLM] curl_post_json to {}", url);

    let mut cmd = Command::new(curl_bin());
    cmd.arg("-s").arg("-S")
       .arg("-w").arg("\n%{http_code}")
       .arg("-X").arg("POST")
       .arg("-H").arg("Content-Type: application/json");

    if !api_key.is_empty() {
        cmd.arg("-H").arg(format!("Authorization: Bearer {}", api_key));
    }

    cmd.arg("-d").arg(&body)
       .arg(&url);

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let code = output.status.code().unwrap_or(-1);
        let body = if stdout.is_empty() { &stderr } else { &stdout };
        return Err(format!("LLM request failed (curl exit {}): {}", code, body));
    }

    let (body, http_code) = parse_curl_output(&stdout);
    if http_code >= 400 {
        return Err(format!("LLM API error (HTTP {}): {}", http_code, body));
    }

    log::info!("[LLM] Success (HTTP {}), response length: {} bytes", http_code, body.len());
    Ok(body)
}
