use serde::Serialize;
use std::path::Path;
use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Clone, Serialize)]
pub struct FFmpegProgress {
    pub line: String,
    pub percent: Option<f64>,
}

#[derive(Clone, Serialize)]
pub struct FFmpegDone {
    pub success: bool,
    pub message: String,
}

/// 验证路径指向的二进制文件名是否为 ffmpeg
fn validate_ffmpeg_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    let file_name = p
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    if file_name != "ffmpeg" {
        return Err(format!(
            "Invalid FFmpeg path: binary name '{}' is not 'ffmpeg'",
            p.file_name().unwrap_or_default().to_string_lossy()
        ));
    }
    Ok(())
}

/// 验证 -version 输出确实来自 FFmpeg
fn validate_ffmpeg_output(output: &str) -> Result<String, String> {
    let first_line = output
        .lines()
        .next()
        .unwrap_or("")
        .to_string();

    if !first_line.to_lowercase().contains("ffmpeg") {
        return Err(format!(
            "Binary does not appear to be FFmpeg. Output: {}",
            first_line
        ));
    }

    Ok(first_line)
}

/// 检查 FFmpeg 版本，返回版本字符串的第一行
#[tauri::command]
pub async fn check_ffmpeg_version(path: String) -> Result<String, String> {
    // 对非 PATH 查找的路径，验证二进制名
    if path != "ffmpeg" {
        validate_ffmpeg_path(&path)?;
    }

    let output = Command::new(&path)
        .arg("-version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to execute '{}': {}", path, e))?;

    if !output.status.success() {
        return Err(format!("FFmpeg exited with status: {}", output.status));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    validate_ffmpeg_output(&stdout)
}

/// 获取应用可执行文件所在目录
#[tauri::command]
pub fn get_app_dir(app: AppHandle) -> Result<String, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    Ok(resource_dir.to_string_lossy().to_string())
}

/// 获取当前工作目录
#[tauri::command]
pub fn get_cwd() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to get current directory: {}", e))
}

/// 提取视频音频（结构化参数，Rust 侧构建 FFmpeg 命令）
#[tauri::command]
pub async fn run_ffmpeg_extract_audio(
    app: AppHandle,
    ffmpeg_path: String,
    input_path: String,
    output_path: String,
) -> Result<(), String> {
    // 验证 FFmpeg 路径
    if ffmpeg_path != "ffmpeg" {
        validate_ffmpeg_path(&ffmpeg_path)?;
    }

    // 验证输入文件存在
    if !Path::new(&input_path).exists() {
        return Err(format!("Input file does not exist: {}", input_path));
    }

    // 验证输出路径的父目录存在
    if let Some(parent) = Path::new(&output_path).parent() {
        if !parent.exists() {
            return Err(format!("Output directory does not exist: {}", parent.display()));
        }
    }

    // 在 Rust 侧构建固定的 FFmpeg 参数，不接受前端传入的原始 args
    let args = vec![
        "-i", &input_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-y",
        &output_path,
    ];

    let mut child = Command::new(&ffmpeg_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;

    // FFmpeg 的进度信息输出在 stderr
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let percent = parse_ffmpeg_progress(&line);
                let _ = app_clone.emit(
                    "ffmpeg-progress",
                    FFmpegProgress {
                        line: line.clone(),
                        percent,
                    },
                );
            }
        });
    }

    // 等待 FFmpeg 完成
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for FFmpeg: {}", e))?;

    let done = if status.success() {
        FFmpegDone {
            success: true,
            message: "FFmpeg completed successfully".to_string(),
        }
    } else {
        FFmpegDone {
            success: false,
            message: format!("FFmpeg exited with code: {}", status),
        }
    };

    app.emit("ffmpeg-done", done.clone())
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    if done.success {
        Ok(())
    } else {
        Err(done.message)
    }
}

/// 从 FFmpeg stderr 输出中解析进度信息
fn parse_ffmpeg_progress(line: &str) -> Option<f64> {
    if line.contains("time=") {
        if let Some(time_str) = line.split("time=").nth(1) {
            let time_part = time_str.split_whitespace().next().unwrap_or("");
            if parse_time_to_seconds(time_part).is_some() {
                return None;
            }
        }
    }
    None
}

/// 将 HH:MM:SS.ms 格式解析为秒数
fn parse_time_to_seconds(time_str: &str) -> Option<f64> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() == 3 {
        let hours: f64 = parts[0].parse().ok()?;
        let minutes: f64 = parts[1].parse().ok()?;
        let seconds: f64 = parts[2].parse().ok()?;
        Some(hours * 3600.0 + minutes * 60.0 + seconds)
    } else {
        None
    }
}
