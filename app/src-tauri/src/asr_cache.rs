use redb::{Database, ReadableTable, ReadableTableMetadata, TableDefinition};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const TABLE: TableDefinition<&str, &str> = TableDefinition::new("asr_cache");

/// 获取缓存数据库路径
fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    // 确保目录存在
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;

    Ok(config_dir.join("asr_cache.redb"))
}

/// 打开或创建数据库
fn open_db(app: &AppHandle) -> Result<Database, String> {
    let path = db_path(app)?;
    Database::create(&path).map_err(|e| format!("Failed to open ASR cache database: {}", e))
}

/// 检查是否存在 ASR 缓存
#[tauri::command]
pub fn check_asr_cache(app: AppHandle, video_path: String) -> Result<bool, String> {
    let db = open_db(&app)?;
    let txn = db
        .begin_read()
        .map_err(|e| format!("Failed to begin read transaction: {}", e))?;
    let table = txn.open_table(TABLE);

    match table {
        Ok(table) => {
            let result = table
                .get(video_path.as_str())
                .map_err(|e| format!("Failed to read cache: {}", e))?;
            Ok(result.is_some())
        }
        Err(redb::TableError::TableDoesNotExist(_)) => Ok(false),
        Err(e) => Err(format!("Failed to open cache table: {}", e)),
    }
}

/// 读取 ASR 缓存
#[tauri::command]
pub fn read_asr_cache(app: AppHandle, video_path: String) -> Result<String, String> {
    let db = open_db(&app)?;
    let txn = db
        .begin_read()
        .map_err(|e| format!("Failed to begin read transaction: {}", e))?;
    let table = txn
        .open_table(TABLE)
        .map_err(|e| format!("Failed to open cache table: {}", e))?;

    let value = table
        .get(video_path.as_str())
        .map_err(|e| format!("Failed to read cache: {}", e))?
        .ok_or_else(|| format!("No cache found for: {}", video_path))?;

    Ok(value.value().to_string())
}

/// 获取 ASR 缓存文件大小（字节），不存在则返回 0
#[tauri::command]
pub fn get_asr_cache_size(app: AppHandle) -> Result<u64, String> {
    let path = db_path(&app)?;
    if path.exists() {
        let metadata = std::fs::metadata(&path)
            .map_err(|e| format!("Failed to get cache file metadata: {}", e))?;
        Ok(metadata.len())
    } else {
        Ok(0)
    }
}

/// 清除 ASR 缓存（删除数据库文件）
#[tauri::command]
pub fn clear_asr_cache(app: AppHandle) -> Result<(), String> {
    let path = db_path(&app)?;
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete cache file: {}", e))?;
    }
    Ok(())
}

/// 缓存条目信息
#[derive(Clone, serde::Serialize)]
pub struct AsrCacheEntry {
    pub video_path: String,
    pub data_size: usize,
}

/// 分页查询结果
#[derive(Clone, serde::Serialize)]
pub struct AsrCacheListResult {
    pub entries: Vec<AsrCacheEntry>,
    pub total: usize,
}

/// 列出 ASR 缓存条目（分页）
#[tauri::command]
pub fn list_asr_cache(app: AppHandle, offset: usize, limit: usize) -> Result<AsrCacheListResult, String> {
    let db = open_db(&app)?;
    let txn = db
        .begin_read()
        .map_err(|e| format!("Failed to begin read transaction: {}", e))?;
    let table = match txn.open_table(TABLE) {
        Ok(table) => table,
        Err(redb::TableError::TableDoesNotExist(_)) => return Ok(AsrCacheListResult { entries: vec![], total: 0 }),
        Err(e) => return Err(format!("Failed to open cache table: {}", e)),
    };

    let total = table.len()
        .map_err(|e| format!("Failed to get table length: {}", e))? as usize;

    let mut entries = Vec::new();
    let iter = table
        .iter()
        .map_err(|e| format!("Failed to iterate cache: {}", e))?;
    for (i, item) in iter.enumerate() {
        if i < offset { continue; }
        if entries.len() >= limit { break; }
        let (key, value) = item.map_err(|e| format!("Failed to read entry: {}", e))?;
        entries.push(AsrCacheEntry {
            video_path: key.value().to_string(),
            data_size: value.value().len(),
        });
    }
    Ok(AsrCacheListResult { entries, total })
}

/// 删除单条 ASR 缓存
#[tauri::command]
pub fn delete_asr_cache_entry(app: AppHandle, video_path: String) -> Result<(), String> {
    let db = open_db(&app)?;
    let txn = db
        .begin_write()
        .map_err(|e| format!("Failed to begin write transaction: {}", e))?;
    {
        let mut table = txn
            .open_table(TABLE)
            .map_err(|e| format!("Failed to open cache table: {}", e))?;
        table
            .remove(video_path.as_str())
            .map_err(|e| format!("Failed to delete cache entry: {}", e))?;
    }
    txn.commit()
        .map_err(|e| format!("Failed to commit: {}", e))?;
    Ok(())
}

/// 写入 ASR 缓存
#[tauri::command]
pub fn write_asr_cache(
    app: AppHandle,
    video_path: String,
    asr_json: String,
) -> Result<(), String> {
    let db = open_db(&app)?;
    let txn = db
        .begin_write()
        .map_err(|e| format!("Failed to begin write transaction: {}", e))?;
    {
        let mut table = txn
            .open_table(TABLE)
            .map_err(|e| format!("Failed to open cache table: {}", e))?;
        table
            .insert(video_path.as_str(), asr_json.as_str())
            .map_err(|e| format!("Failed to write cache: {}", e))?;
    }
    txn.commit()
        .map_err(|e| format!("Failed to commit cache: {}", e))?;
    Ok(())
}
