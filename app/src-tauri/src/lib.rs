mod asr_cache;
mod config;
mod ffmpeg;
mod file_ops;
mod funasr;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            config::read_config,
            config::write_config,
            ffmpeg::check_ffmpeg_version,
            ffmpeg::get_app_dir,
            ffmpeg::run_ffmpeg_extract_audio,
            file_ops::get_temp_audio_path,
            file_ops::save_file,
            file_ops::save_debug_file,
            file_ops::append_debug_file,
            file_ops::read_file_bytes,
            file_ops::remove_file,
            file_ops::cleanup_temp_files,
            funasr::recognize_speech,
            asr_cache::check_asr_cache,
            asr_cache::read_asr_cache,
            asr_cache::write_asr_cache,
        ])
        .setup(|app| {
            let log_level = if cfg!(debug_assertions) {
                log::LevelFilter::Info
            } else {
                log::LevelFilter::Warn
            };
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .build(),
            )?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
