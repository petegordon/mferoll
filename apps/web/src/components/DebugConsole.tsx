'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

// Global log storage
const logEntries: LogEntry[] = [];
const maxLogs = 100;
const listeners: Set<() => void> = new Set();

// Debug logger that stores logs for the debug panel
export const debugLog = {
  info: (message: string) => addLog('info', message),
  warn: (message: string) => addLog('warn', message),
  error: (message: string) => addLog('error', message),
  debug: (message: string) => addLog('debug', message),
  clear: () => {
    logEntries.length = 0;
    notifyListeners();
  },
};

function addLog(level: LogEntry['level'], message: string) {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level,
    message,
  };

  logEntries.push(entry);

  // Keep only the last maxLogs entries
  if (logEntries.length > maxLogs) {
    logEntries.shift();
  }

  // Also log to console
  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleFn(`[${level.toUpperCase()}] ${message}`);

  notifyListeners();
}

function notifyListeners() {
  listeners.forEach(listener => listener());
}

function useLogs() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return logEntries;
}

export function DebugConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const logs = useLogs();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && isOpen && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, isOpen, isMinimized]);

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-green-400';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 2
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white px-3 py-2 rounded-lg text-xs font-mono shadow-lg opacity-70 hover:opacity-100 transition-opacity"
      >
        Debug
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 bg-gray-900 text-white rounded-lg shadow-xl font-mono text-xs transition-all ${
        isMinimized ? 'w-32' : 'w-80 max-w-[90vw]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="font-bold">Debug</span>
        <div className="flex gap-2">
          <button
            onClick={() => debugLog.clear()}
            className="text-gray-400 hover:text-white"
            title="Clear"
          >
            C
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-400 hover:text-white"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '+' : '-'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white"
            title="Close"
          >
            X
          </button>
        </div>
      </div>

      {/* Log content */}
      {!isMinimized && (
        <div
          ref={scrollRef}
          className="h-48 overflow-y-auto p-2 space-y-1"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No logs yet</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-2 leading-tight">
                <span className="text-gray-500 flex-shrink-0">
                  {formatTime(log.timestamp)}
                </span>
                <span className={`${getLevelColor(log.level)} break-all`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
