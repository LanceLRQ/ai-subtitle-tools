mod config;
mod ffmpeg;
mod file_ops;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            config::read_config,
            config::write_config,
            ffmpeg::check_ffmpeg_version,
            ffmpeg::get_app_dir,
            ffmpeg::run_ffmpeg,
            file_ops::get_temp_audio_path,
            file_ops::save_file,
            file_ops::read_file_bytes,
            file_ops::remove_file,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
