"use client";

import { useEffect, useState, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: 'device' | 'puzzle' | 'effect' | 'audio' | 'mqtt' | 'error' | 'info';
  message: string;
  data?: Record<string, any>;
}

interface ActivityLogProps {
  maxEvents?: number;
  autoScroll?: boolean;
}

export function ActivityLog({ maxEvents = 100, autoScroll = true }: ActivityLogProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && !isPaused && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll, isPaused]);

  // Add event handler (will be used by parent component or WebSocket)
  const addEvent = (event: Omit<ActivityEvent, 'id'>) => {
    setEvents((prev) => {
      const newEvent: ActivityEvent = {
        ...event,
        id: `${event.timestamp}-${Math.random().toString(36).substr(2, 9)}`
      };
      const updated = [newEvent, ...prev];
      return updated.slice(0, maxEvents);
    });
  };

  // Expose addEvent function via window for external access (temporary for testing)
  useEffect(() => {
    (window as any).__addActivityEvent = addEvent;
    return () => {
      delete (window as any).__addActivityEvent;
    };
  }, []);

  const clearEvents = () => {
    setEvents([]);
  };

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'device':
        return '🔌';
      case 'puzzle':
        return '🧩';
      case 'effect':
        return '✨';
      case 'audio':
        return '🎵';
      case 'mqtt':
        return '📡';
      case 'error':
        return '❌';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const getEventColor = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'device':
        return 'text-blue-400';
      case 'puzzle':
        return 'text-purple-400';
      case 'effect':
        return 'text-green-400';
      case 'audio':
        return 'text-pink-400';
      case 'mqtt':
        return 'text-cyan-400';
      case 'error':
        return 'text-red-400';
      case 'info':
      default:
        return 'text-slate-400';
    }
  };

  return (
    <section className="mb-12">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Activity Log</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time events from MQTT, devices, puzzles, and effects
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
              isPaused
                ? 'bg-yellow-900/30 border-yellow-700 text-yellow-300 hover:bg-yellow-900/50'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            type="button"
            onClick={clearEvents}
            className="px-3 py-1.5 text-xs font-medium border border-slate-700 rounded-md text-slate-300 hover:bg-slate-800 transition-colors"
          >
            🗑 Clear
          </button>
          <span className="px-3 py-1.5 text-xs text-slate-400 border border-slate-800 rounded-md bg-slate-900/50">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto font-mono text-xs">
          {events.length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              <p className="text-lg mb-2">📭</p>
              <p>No events yet. Waiting for activity...</p>
              <p className="text-[10px] mt-2 text-slate-600">
                Events will appear when devices connect or puzzles are triggered
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="px-4 py-2.5 hover:bg-slate-900/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5 flex-shrink-0">
                      {getEventIcon(event.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`font-medium ${getEventColor(event.type)}`}>
                          {event.type.toUpperCase()}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                        </span>
                        <span className="text-slate-600 text-[10px] font-normal">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-200 leading-relaxed">{event.message}</p>
                      {event.data && Object.keys(event.data).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-slate-500 hover:text-slate-400 text-[10px]">
                            Show data →
                          </summary>
                          <pre className="mt-2 p-2 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-400 overflow-x-auto">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>

      {isPaused && (
        <div className="mt-2 px-4 py-2 bg-yellow-900/20 border border-yellow-700/50 rounded-md text-xs text-yellow-300">
          ⚠️ Activity log is paused. New events are not being displayed.
        </div>
      )}
    </section>
  );
}
