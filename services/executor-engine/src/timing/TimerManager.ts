import { EventEmitter } from 'events';

export interface Timer {
  id: string;
  durationMs: number;
  startedAt: number;
  remainingMs: number;
  isPaused: boolean;
}

export declare interface TimerManager {
  on(event: 'timer-expired', listener: (timer: Timer) => void): this;
}

export class TimerManager extends EventEmitter {
  private readonly timers = new Map<string, Timer>();
  private interval?: NodeJS.Timeout;

  constructor(private readonly tickIntervalMs: number) {
    super();
  }

  public startTimer(id: string, durationMs: number): Timer {
    const timer: Timer = {
      id,
      durationMs,
      startedAt: Date.now(),
      remainingMs: durationMs,
      isPaused: false
    };
    this.timers.set(id, timer);
    this.ensureInterval();
    return timer;
  }

  public pauseTimer(id: string): void {
    const timer = this.timers.get(id);
    if (!timer || timer.isPaused) return;
    timer.remainingMs = timer.durationMs - (Date.now() - timer.startedAt);
    timer.isPaused = true;
    this.timers.set(id, timer);
  }

  public resumeTimer(id: string): void {
    const timer = this.timers.get(id);
    if (!timer || !timer.isPaused) return;
    timer.startedAt = Date.now();
    timer.isPaused = false;
    this.timers.set(id, timer);
    this.ensureInterval();
  }

  public stopTimer(id: string): void {
    this.timers.delete(id);
    if (this.timers.size === 0) {
      this.stopInterval();
    }
  }

  private ensureInterval(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  private stopInterval(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private tick(): void {
    const now = Date.now();
    for (const timer of this.timers.values()) {
      if (timer.isPaused) continue;
      const elapsed = now - timer.startedAt;
      if (elapsed >= timer.durationMs) {
        this.timers.delete(timer.id);
        this.emit('timer-expired', timer);
      }
    }
    if (this.timers.size === 0) {
      this.stopInterval();
    }
  }
}
