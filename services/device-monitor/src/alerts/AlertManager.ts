import { EventEmitter } from 'events';
import { logger } from '../logger';
import type { DeviceRecord } from '../devices/types';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
  device?: Pick<DeviceRecord, 'id' | 'roomId' | 'puzzleId' | 'status'>;
  createdAt: number;
  acknowledgedAt?: number;
}

export declare interface AlertManager {
  on(event: 'alert-raised', listener: (alert: Alert) => void): this;
  on(event: 'alert-acknowledged', listener: (alert: Alert) => void): this;
}

export class AlertManager extends EventEmitter {
  private readonly alerts: Alert[] = [];

  public raiseAlert(partial: Omit<Alert, 'id' | 'createdAt'>): Alert {
    const alert: Alert = {
      ...partial,
      id: `alert-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: Date.now()
    };

    this.alerts.push(alert);
    this.emit('alert-raised', alert);
    logger.warn({ alert }, 'Alert raised');
    return alert;
  }

  public acknowledge(id: string): Alert | undefined {
    const alert = this.alerts.find((entry) => entry.id === id);
    if (!alert) {
      return undefined;
    }

    alert.acknowledgedAt = Date.now();
    this.emit('alert-acknowledged', alert);
    logger.info({ alertId: id }, 'Alert acknowledged');
    return alert;
  }

  public list(): Alert[] {
    return this.alerts.slice(-50);
  }
}
