'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { LogLevel, LogEntry } from '@/lib/types';

let logIdCounter = 0;

function generateLogId(): string {
  return `log_${Date.now()}_${++logIdCounter}`;
}

export interface PipelineLogCallbacks {
  addLog: (level: LogLevel, message: string) => void;
  addStreamEntry: (id: string, message: string) => void;
  appendStream: (id: string, chunk: string) => void;
  finalizeStream: (id: string) => void;
  clearLogs: () => void;
}

export function useLog(): PipelineLogCallbacks & { logs: LogEntry[] } {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef(logs);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const addLog = useCallback((level: LogLevel, message: string) => {
    const entry: LogEntry = {
      id: generateLogId(),
      timestamp: Date.now(),
      level,
      message,
    };
    setLogs((prev) => [...prev, entry]);
  }, []);

  const addStreamEntry = useCallback((id: string, message: string) => {
    const entry: LogEntry = {
      id,
      timestamp: Date.now(),
      level: 'info',
      message,
      streamContent: '',
      streaming: true,
    };
    setLogs((prev) => [...prev, entry]);
  }, []);

  const appendStream = useCallback((id: string, chunk: string) => {
    setLogs((prev) =>
      prev.map((log) =>
        log.id === id
          ? { ...log, streamContent: (log.streamContent || '') + chunk }
          : log
      )
    );
  }, []);

  const finalizeStream = useCallback((id: string) => {
    setLogs((prev) =>
      prev.map((log) =>
        log.id === id ? { ...log, streaming: false } : log
      )
    );
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, addLog, addStreamEntry, appendStream, finalizeStream, clearLogs };
}
