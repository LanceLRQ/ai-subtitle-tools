'use client';

import { open } from '@tauri-apps/plugin-dialog';

interface FilePickerProps {
  videoPath: string;
  onSelect: (path: string) => void;
  disabled?: boolean;
}

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm'];

export default function FilePicker({ videoPath, onSelect, disabled }: FilePickerProps) {
  const handleClick = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Video',
            extensions: VIDEO_EXTENSIONS,
          },
        ],
      });

      if (selected) {
        onSelect(selected as string);
      }
    } catch (err) {
      console.error('File picker error:', err);
    }
  };

  // 提取文件名用于显示
  const fileName = videoPath ? videoPath.split(/[/\\]/).pop() : '';

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={disabled}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
      >
        选择视频文件
      </button>
      {videoPath ? (
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-200 truncate" title={videoPath}>
            {fileName}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{videoPath}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">支持 {VIDEO_EXTENSIONS.join(', ')} 格式</p>
      )}
    </div>
  );
}
