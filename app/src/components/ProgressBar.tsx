'use client';

import type { PipelineStage } from '@/lib/types';

interface ProgressBarProps {
  stage: PipelineStage;
  progress: number;
  message: string;
  stageLabel: string;
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  'idle': 'bg-gray-500',
  'detecting-ffmpeg': 'bg-yellow-500',
  'extracting-audio': 'bg-orange-500',
  'recognizing': 'bg-blue-500',
  'translating': 'bg-purple-500',
  'exporting': 'bg-cyan-500',
  'done': 'bg-green-500',
  'error': 'bg-red-500',
};

export default function ProgressBar({ stage, progress, message, stageLabel }: ProgressBarProps) {
  if (stage === 'idle') return null;

  const color = STAGE_COLORS[stage];

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{stageLabel}</span>
        {progress > 0 && <span className="text-gray-400">{progress}%</span>}
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${Math.max(progress, stage === 'done' || stage === 'error' ? 100 : 5)}%` }}
        />
      </div>
      {message && (
        <p className={`text-xs truncate ${stage === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
