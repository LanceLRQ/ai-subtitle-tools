use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 获取配置文件路径
fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;
    Ok(config_dir.join("config.json"))
}

/// 默认配置 JSON
fn default_config() -> &'static str {
    r#"{
  "ffmpeg": {
    "path": ""
  },
  "funasr": {
    "url": "http://127.0.0.1:17000",
    "apiKey": "",
    "model": "qwen3-asr-1.7b"
  },
  "llm": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "",
    "model": "gpt-4o-mini"
  },
  "translation": {
    "enabled": false,
    "batchSize": 10,
    "bilingual": true,
    "targetLanguage": "中文"
  },
  "debug": {
    "enabled": false
  }
}"#
}

/// 读取配置文件，不存在则返回默认配置
#[tauri::command]
pub fn read_config(app: AppHandle) -> Result<String, String> {
    let path = config_path(&app)?;

    if path.exists() {
        fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config: {}", e))
    } else {
        Ok(default_config().to_string())
    }
}

/// 写入配置文件，自动创建目录
#[tauri::command]
pub fn write_config(app: AppHandle, config_json: String) -> Result<(), String> {
    let path = config_path(&app)?;

    // 确保目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    fs::write(&path, config_json)
        .map_err(|e| format!("Failed to write config: {}", e))
}
