use serde::Serialize;
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

/// 检查 FFmpeg 版本，返回版本字符串的第一行
#[tauri::command]
pub async fn check_ffmpeg_version(path: String) -> Result<String, String> {
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
    let first_line = stdout
        .lines()
        .next()
        .unwrap_or("unknown version")
        .to_string();

    Ok(first_line)
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

/// 异步执行 FFmpeg，通过事件推送进度
#[tauri::command]
pub async fn run_ffmpeg(
    app: AppHandle,
    ffmpeg_path: String,
    args: Vec<String>,
) -> Result<(), String> {
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
                // 尝试从 FFmpeg 输出中解析进度百分比
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
    // FFmpeg 输出格式示例: "frame=  120 fps= 24 ... time=00:00:05.00 ..."
    // 这里无法知道总时长，只输出时间供前端计算
    if line.contains("time=") {
        // 提取 time 值用于前端计算进度
        if let Some(time_str) = line.split("time=").nth(1) {
            let time_part = time_str.split_whitespace().next().unwrap_or("");
            if let Some(_) = parse_time_to_seconds(time_part) {
                // 返回 None，让前端根据总时长计算百分比
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
